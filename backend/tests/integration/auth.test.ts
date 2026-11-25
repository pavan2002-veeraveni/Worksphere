import request from 'supertest';
import app from '../../src/app';
import { createMockDb } from '../helpers/mockDb';

describe('Authentication & Token Rotation API (/api/v1/auth)', () => {
  beforeEach(() => {
    createMockDb();
  });

  it('registers, logs in, rotates refresh tokens, and detects token reuse', async () => {
    // 1. Register
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'alice@example.com',
        password: 'Password123!',
        firstName: 'Alice',
        lastName: 'Smith',
      });
    expect(reg.status).toBe(201);
    expect(reg.body.success).toBe(true);
    expect(reg.body.data.user.email).toBe('alice@example.com');
    expect(reg.body.data.user.password_hash).toBeUndefined();
    expect(reg.headers['x-request-id']).toBeDefined();

    // 2. Duplicate email rejected
    const dup = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'alice@example.com',
        password: 'Password123!',
        firstName: 'Alice',
        lastName: 'Smith',
      });
    expect(dup.status).toBe(409);

    // 3. Login
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'Password123!' });
    expect(login.status).toBe(200);
    const { accessToken, refreshToken: rt1 } = login.body.data.tokens;

    // 4. Access protected profile
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe('alice@example.com');

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

  it('rejects invalid input and bad credentials without leaking stack traces', async () => {
    const weakPw = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'not-an-email',
        password: 'short',
        firstName: '',
        lastName: 'Doe',
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
