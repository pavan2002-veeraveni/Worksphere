import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getDb } from '../config/database';
import { ApiError } from '../utils/ApiError';

export interface SafeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isPlatformAdmin: boolean;
  isActive: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type SignupRole = 'owner' | 'project_manager';
export type PortalLoginRole = 'platform_admin' | SignupRole;

const ALLOWED_PORTAL_ORG_ROLES = new Set<string>(['owner', 'project_manager']);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function deriveNamesFromEmail(
  email: string,
  role?: SignupRole,
): { firstName: string; lastName: string } {
  const localPart = email.split('@')[0] || 'workspace';
  const cleaned = localPart
    .split(/[._+-]+/)
    .map((part) => part.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean);
  const capitalize = (val: string) => val.charAt(0).toUpperCase() + val.slice(1);
  const firstName = (cleaned[0] ? capitalize(cleaned[0]) : 'Workspace').slice(0, 100);
  const roleFallback =
    role === 'owner' ? 'Owner' : role === 'project_manager' ? 'Manager' : 'User';
  const rawLast = cleaned.slice(1).map(capitalize).join(' ');
  const lastName = (rawLast || roleFallback).slice(0, 100);
  return { firstName, lastName };
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function toSafeUser(row: Record<string, unknown>): SafeUser {
  return {
    id: String(row.id),
    email: String(row.email),
    firstName: String(row.first_name),
    lastName: String(row.last_name),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    isPlatformAdmin: Boolean(row.is_platform_admin),
    isActive: Boolean(row.is_active),
  };
}

function parseExpiryToMs(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 3600 * 1000;
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 3600 * 1000,
    d: 24 * 3600 * 1000,
  };
  return amount * multipliers[unit];
}

export const authService = {
  generateAccessToken(user: SafeUser): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isPlatformAdmin: user.isPlatformAdmin,
        type: 'access',
      },
      config.jwt.secret,
      { expiresIn: config.jwt.accessExpiry as jwt.SignOptions['expiresIn'] },
    );
  },

  generateRefreshToken(userId: string): string {
    return jwt.sign(
      {
        sub: userId,
        jti: crypto.randomUUID(),
        type: 'refresh',
      },
      config.jwt.secret,
      { expiresIn: config.jwt.refreshExpiry as jwt.SignOptions['expiresIn'] },
    );
  },

  async register(data: {
    email: string;
    password: string;
    role?: SignupRole;
    firstName?: string;
    lastName?: string;
    organizationName?: string;
  }): Promise<{
    user: SafeUser;
    tokens: TokenPair;
    organizations: Array<{ id: string; name: string; slug: string; plan: string; role: SignupRole }>;
  }> {
    const db = getDb();
    const normalizedEmail = data.email.toLowerCase().trim();

    if (data.role !== undefined && !ALLOWED_PORTAL_ORG_ROLES.has(data.role)) {
      throw ApiError.forbidden(
        'Signup access is restricted to Organization Owner and Project Manager roles',
        'SIGNUP_ROLE_FORBIDDEN',
      );
    }

    const existing = await db('users').where({ email: normalizedEmail }).first('id');
    if (existing) {
      throw ApiError.conflict('An account with this email already exists', undefined, 'EMAIL_EXISTS');
    }

    const derived = deriveNamesFromEmail(normalizedEmail, data.role);
    const firstName = data.firstName?.trim() || derived.firstName;
    const lastName = data.lastName?.trim() || derived.lastName;
    const passwordHash = await bcrypt.hash(data.password, config.jwt.bcryptRounds);

    const { created, organizations } = await db.transaction(async (trx) => {
      const [userRow] = await trx('users')
        .insert({
          email: normalizedEmail,
          password_hash: passwordHash,
          first_name: firstName,
          last_name: lastName,
        })
        .returning('*');

      const provisionedOrgs: Array<{
        id: string;
        name: string;
        slug: string;
        plan: string;
        role: SignupRole;
      }> = [];

      if (data.role) {
        const orgName = data.organizationName?.trim() || `${firstName}'s Workspace`;
        const baseSlug = slugify(orgName) || 'workspace';
        const slug = `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;
        const [org] = await trx('organizations')
          .insert({
            name: orgName,
            slug,
            plan: 'free',
            settings: JSON.stringify({}),
          })
          .returning('*');

        await trx('organization_members').insert({
          org_id: org.id,
          user_id: userRow.id,
          role: data.role,
          invited_by: userRow.id,
        });

        provisionedOrgs.push({
          id: String(org.id),
          name: String(org.name),
          slug: String(org.slug),
          plan: String(org.plan || 'free'),
          role: data.role,
        });
      }

      return { created: userRow, organizations: provisionedOrgs };
    });

    const safeUser = toSafeUser(created);
    const tokens = await this.issueTokenPair(safeUser);
    return { user: safeUser, tokens, organizations };
  },

  async login(
    email: string,
    password: string,
    role?: PortalLoginRole,
  ): Promise<{ user: SafeUser; tokens: TokenPair; organizations: unknown[] }> {
    const db = getDb();
    const userRow = await db('users').where({ email: email.toLowerCase().trim() }).first();
    if (!userRow) {
      throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (!userRow.is_active) {
      throw ApiError.forbidden('Account is deactivated', 'ACCOUNT_INACTIVE');
    }

    const passwordValid = await bcrypt.compare(password, userRow.password_hash);
    if (!passwordValid) {
      throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const safeUser = toSafeUser(userRow);
    const rawOrganizations = await db('organizations as o')
      .join('organization_members as om', 'om.org_id', 'o.id')
      .where('om.user_id', safeUser.id)
      .select('o.id', 'o.name', 'o.slug', 'o.plan', 'om.role');

    const organizations = rawOrganizations.filter((org: { role?: unknown }) =>
      ALLOWED_PORTAL_ORG_ROLES.has(String(org.role)),
    );

    if (role === 'platform_admin') {
      if (!safeUser.isPlatformAdmin) {
        throw ApiError.forbidden(
          `Role verification failed: ${safeUser.email} does not have Platform Admin privileges.`,
          'ROLE_FORBIDDEN',
        );
      }
    } else if (role === 'owner' || role === 'project_manager') {
      const hasRequestedRole = organizations.some((org: { role?: unknown }) => org.role === role);
      if (!hasRequestedRole) {
        const label = role === 'owner' ? 'Organization Owner' : 'Project Manager';
        throw ApiError.forbidden(
          `Role verification failed: ${safeUser.email} does not hold the ${label} role in any organization.`,
          'ROLE_FORBIDDEN',
        );
      }
    } else if (
      rawOrganizations.length > 0 &&
      !safeUser.isPlatformAdmin &&
      organizations.length === 0
    ) {
      throw ApiError.forbidden(
        'Access denied: Login is restricted to Platform Admin, Organization Owner, and Project Manager roles.',
        'ROLE_FORBIDDEN',
      );
    }

    await db('users').where({ id: userRow.id }).update({ last_login_at: db.fn.now() });

    const tokens = await this.issueTokenPair(safeUser);
    return { user: safeUser, tokens, organizations };
  },

  async issueTokenPair(user: SafeUser): Promise<TokenPair> {
    const db = getDb();
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user.id);
    const expiresAt = new Date(Date.now() + parseExpiryToMs(config.jwt.refreshExpiry));

    await db('refresh_tokens').insert({
      user_id: user.id,
      token_hash: hashToken(refreshToken),
      expires_at: expiresAt,
    });

    return { accessToken, refreshToken };
  },

  /**
   * Rotates refresh tokens atomically and revokes the entire token family
   * if an already-revoked token is presented (token reuse protection).
   */
  async refreshToken(token: string): Promise<TokenPair> {
    let decoded: { sub: string; type: string };
    try {
      decoded = jwt.verify(token, config.jwt.secret) as { sub: string; type: string };
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }

    if (decoded.type !== 'refresh') {
      throw ApiError.unauthorized('Invalid token type', 'INVALID_TOKEN_TYPE');
    }

    const db = getDb();
    const tokenHash = hashToken(token);

    const preCheck = await db('refresh_tokens').where({ token_hash: tokenHash }).first();
    if (!preCheck) {
      throw ApiError.unauthorized('Refresh token not recognized', 'INVALID_REFRESH_TOKEN');
    }
    if (preCheck.revoked_at) {
      // Possible token theft/replay: commit family revocation before throwing
      await db('refresh_tokens')
        .where({ user_id: preCheck.user_id })
        .whereNull('revoked_at')
        .update({ revoked_at: db.fn.now() });
      throw ApiError.unauthorized(
        'Refresh token reuse detected; all sessions revoked',
        'REFRESH_TOKEN_REUSED',
      );
    }

    return db.transaction(async (trx) => {
      const stored = await trx('refresh_tokens').where({ token_hash: tokenHash }).first();
      if (!stored || stored.revoked_at) {
        throw ApiError.unauthorized('Refresh token not recognized or revoked', 'INVALID_REFRESH_TOKEN');
      }

      if (new Date(stored.expires_at).getTime() <= Date.now()) {
        throw ApiError.unauthorized('Refresh token expired', 'REFRESH_TOKEN_EXPIRED');
      }

      const userRow = await trx('users').where({ id: stored.user_id }).first();
      if (!userRow || !userRow.is_active) {
        throw ApiError.unauthorized('User account is inactive', 'ACCOUNT_INACTIVE');
      }

      await trx('refresh_tokens')
        .where({ id: stored.id })
        .update({ revoked_at: trx.fn.now() });

      const safeUser = toSafeUser(userRow);
      const accessToken = this.generateAccessToken(safeUser);
      const newRefreshToken = this.generateRefreshToken(safeUser.id);
      const expiresAt = new Date(Date.now() + parseExpiryToMs(config.jwt.refreshExpiry));

      await trx('refresh_tokens').insert({
        user_id: safeUser.id,
        token_hash: hashToken(newRefreshToken),
        expires_at: expiresAt,
      });

      return { accessToken, refreshToken: newRefreshToken };
    });
  },

  async logout(userId: string, refreshToken?: string): Promise<void> {
    const db = getDb();
    if (refreshToken) {
      await db('refresh_tokens')
        .where({ user_id: userId, token_hash: hashToken(refreshToken) })
        .whereNull('revoked_at')
        .update({ revoked_at: db.fn.now() });
    } else {
      await db('refresh_tokens')
        .where({ user_id: userId })
        .whereNull('revoked_at')
        .update({ revoked_at: db.fn.now() });
    }
  },

  async getProfile(userId: string) {
    const db = getDb();
    const userRow = await db('users').where({ id: userId }).first();
    if (!userRow) {
      throw ApiError.notFound('User not found');
    }
    const rawOrganizations = await db('organizations as o')
      .join('organization_members as om', 'om.org_id', 'o.id')
      .where('om.user_id', userId)
      .select('o.id', 'o.name', 'o.slug', 'o.plan', 'om.role');

    const organizations = rawOrganizations.filter((org: { role?: unknown }) =>
      ALLOWED_PORTAL_ORG_ROLES.has(String(org.role)),
    );

    return {
      ...toSafeUser(userRow),
      organizations,
    };
  },
};
