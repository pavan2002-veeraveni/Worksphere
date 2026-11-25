import request from 'supertest';
import app from '../../src/app';
import * as dbModule from '../../src/config/database';
import { createMockDb } from '../helpers/mockDb';

describe('Health, Readiness, Metrics & Failure Paths', () => {
  it('returns /health, /metrics, and /ready when dependencies are healthy', async () => {
    createMockDb();
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('healthy');

    const ready = await request(app).get('/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.status).toBe('ready');

    const metrics = await request(app).get('/metrics').set('Accept', 'application/json');
    expect(metrics.status).toBe(200);
    expect(metrics.body.httpRequestsTotal).toBeGreaterThan(0);
  });

  it('returns 503 on /ready when database check fails (failure path)', async () => {
    const spy = jest.spyOn(dbModule, 'checkDatabaseHealth').mockResolvedValueOnce(false);
    const ready = await request(app).get('/ready');
    expect(ready.status).toBe(503);
    expect(ready.body.status).toBe('degraded');
    expect(ready.body.checks.database).toBe('down');
    spy.mockRestore();
  });

  it('returns 503 when analytics downstream service is unreachable (failure path)', async () => {
    const { store } = createMockDb();
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: 'owner@resilience.io',
      password: 'Password123!',
      firstName: 'Res',
      lastName: 'User',
    });
    const token = reg.body.data.tokens.accessToken;
    const org = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Resilience Org' });
    const orgId = org.body.data.id;
    expect(store.organizations.length).toBe(1);

    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await request(app)
      .get('/api/v1/integrations/analytics/summary')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Org-ID', orgId);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    fetchSpy.mockRestore();
  });
});
