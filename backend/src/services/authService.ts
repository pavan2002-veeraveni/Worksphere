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
    firstName: string;
    lastName: string;
  }): Promise<{ user: SafeUser; tokens: TokenPair }> {
    const db = getDb();
    const normalizedEmail = data.email.toLowerCase().trim();

    const existing = await db('users').where({ email: normalizedEmail }).first('id');
    if (existing) {
      throw ApiError.conflict('An account with this email already exists', undefined, 'EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(data.password, config.jwt.bcryptRounds);
    const [created] = await db('users')
      .insert({
        email: normalizedEmail,
        password_hash: passwordHash,
        first_name: data.firstName,
        last_name: data.lastName,
      })
      .returning('*');

    const safeUser = toSafeUser(created);
    const tokens = await this.issueTokenPair(safeUser);
    return { user: safeUser, tokens };
  },

  async login(
    email: string,
    password: string,
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

    await db('users').where({ id: userRow.id }).update({ last_login_at: db.fn.now() });

    const safeUser = toSafeUser(userRow);
    const tokens = await this.issueTokenPair(safeUser);
    const organizations = await db('organizations as o')
      .join('organization_members as om', 'om.org_id', 'o.id')
      .where('om.user_id', safeUser.id)
      .select('o.id', 'o.name', 'o.slug', 'o.plan', 'om.role');

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
    const organizations = await db('organizations as o')
      .join('organization_members as om', 'om.org_id', 'o.id')
      .where('om.user_id', userId)
      .select('o.id', 'o.name', 'o.slug', 'o.plan', 'om.role');

    return {
      ...toSafeUser(userRow),
      organizations,
    };
  },
};
