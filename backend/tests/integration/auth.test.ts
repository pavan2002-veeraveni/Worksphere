import request from 'supertest';
import app from '../../src/app';
import { createMockDb, MemoryStore } from '../helpers/mockDb';

describe('Authentication, RBAC & Token Rotation API (/api/v1/auth)', () => {
  let store: MemoryStore;

  beforeEach(() => {
    ({ store } = createMockDb());
  });

  it('registers with role (without first/last name), logs in, rotates refresh tokens, and detects reuse', async () => {
    // 1. Register as Organization Owner without firstName/lastName
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'alice@example.com',
        password: 'Password123!',
        role: 'owner',
      });
    expect(reg.status).toBe(201);
    expect(reg.body.success).toBe(true);
    expect(reg.body.data.user.email).toBe('alice@example.com');
    expect(reg.body.data.user.firstName).toBe('Alice');
    expect(reg.body.data.user.password_hash).toBeUndefined();
    expect(reg.body.data.organizations).toHaveLength(1);
    expect(reg.body.data.organizations[0].role).toBe('owner');
    expect(reg.headers['x-request-id']).toBeDefined();

    // 2. Duplicate email rejected
    const dup = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'alice@example.com',
        password: 'Password123!',
        role: 'owner',
      });
    expect(dup.status).toBe(409);

    // 3. Role-enforced login
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'Password123!', role: 'owner' });
    expect(login.status).toBe(200);
    expect(login.body.data.organizations[0].role).toBe('owner');
    const { accessToken, refreshToken: rt1 } = login.body.data.tokens;

    // 4. Access protected profile
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe('alice@example.com');
    expect(me.body.data.organizations[0].role).toBe('owner');

    // 5. Rotate refresh token
    const refresh = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: rt1 });
    expect(refresh.status).toBe(200);
    const rt2 = refresh.body.data.refreshToken;
    expect(rt2).not.toBe(rt1);

    // 6. Replay old revoked refresh token -> reuse detection revokes token family!
    const replay = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: rt1 });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('REFRESH_TOKEN_REUSED');

    // 7. Subsequent attempt with rt2 must now ALSO be revoked
    const afterReuse = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: rt2 });
    expect(afterReuse.status).toBe(401);
  });

  it('enforces RBAC on signup and login (only Organization Owner, Project Manager, and Platform Admin)', async () => {
    // Disallowed signup roles are rejected
    for (const disallowedRole of ['team_member', 'auditor', 'platform_admin']) {
      const blockedSignup = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: `${disallowedRole}@example.com`,
          password: 'Password123!',
          role: disallowedRole,
        });
      expect(blockedSignup.status).toBe(400);
      expect(blockedSignup.body.error.code).toBe('VALIDATION_ERROR');
    }

    // Signup as Project Manager succeeds
    const pmReg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'pm.lead@example.com',
        password: 'Password123!',
        role: 'project_manager',
      });
    expect(pmReg.status).toBe(201);
    expect(pmReg.body.data.organizations[0].role).toBe('project_manager');

    // Login fails if selecting a role not held by user or disallowed portal role
    const wrongRoleLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'pm.lead@example.com', password: 'Password123!', role: 'owner' });
    expect(wrongRoleLogin.status).toBe(403);
    expect(wrongRoleLogin.body.error.code).toBe('ROLE_FORBIDDEN');

    const disallowedPortalRole = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'pm.lead@example.com', password: 'Password123!', role: 'team_member' });
    expect(disallowedPortalRole.status).toBe(400);

    // Team-member-only user cannot log into portal even without explicit role parameter
    const memberReg = await request(app).post('/api/v1/auth/register').send({
      email: 'member.only@example.com',
      password: 'Password123!',
    });
    store.organization_members.push({
      id: 'mem-team-only',
      org_id: pmReg.body.data.organizations[0].id,
      user_id: memberReg.body.data.user.id,
      role: 'team_member',
    });

    const memberLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'member.only@example.com', password: 'Password123!' });
    expect(memberLogin.status).toBe(403);
    expect(memberLogin.body.error.code).toBe('ROLE_FORBIDDEN');
  });

  it('rejects invalid input and bad credentials without leaking stack traces', async () => {
    const weakPw = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'not-an-email',
        password: 'short',
        role: 'owner',
      });
    expect(weakPw.status).toBe(400);
    expect(weakPw.body.error.code).toBe('VALIDATION_ERROR');
    expect(weakPw.body.error.stack).toBeUndefined();

    const badLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'Password123!' });
    expect(badLogin.status).toBe(401);
  });
});
