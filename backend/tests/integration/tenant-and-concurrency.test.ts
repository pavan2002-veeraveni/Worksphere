import request from 'supertest';
import app from '../../src/app';
import { createMockDb, MemoryStore } from '../helpers/mockDb';

describe('Tenant Isolation, RBAC & Concurrent Task Updates (Capstone Challenge)', () => {
  let store: MemoryStore;
  let ownerAcmeToken: string;
  let memberAcmeToken: string;
  let auditorAcmeToken: string;
  let ownerGlobexToken: string;
  let acmeOrgId: string;
  let globexOrgId: string;

  beforeEach(async () => {
    ({ store } = createMockDb());

    const regOwnerA = await request(app).post('/api/v1/auth/register').send({
      email: 'owner@acme.io',
      password: 'Password123!',
      firstName: 'Acme',
      lastName: 'Owner',
    });
    ownerAcmeToken = regOwnerA.body.data.tokens.accessToken;

    const regMemberA = await request(app).post('/api/v1/auth/register').send({
      email: 'member@acme.io',
      password: 'Password123!',
      firstName: 'Acme',
      lastName: 'Member',
    });
    memberAcmeToken = regMemberA.body.data.tokens.accessToken;

    const regAuditorA = await request(app).post('/api/v1/auth/register').send({
      email: 'auditor@acme.io',
      password: 'Password123!',
      firstName: 'Acme',
      lastName: 'Auditor',
    });
    auditorAcmeToken = regAuditorA.body.data.tokens.accessToken;

    const regOwnerB = await request(app).post('/api/v1/auth/register').send({
      email: 'owner@globex.io',
      password: 'Password123!',
      firstName: 'Globex',
      lastName: 'Owner',
    });
    ownerGlobexToken = regOwnerB.body.data.tokens.accessToken;

    const orgA = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${ownerAcmeToken}`)
      .send({ name: 'Acme Corp' });
    acmeOrgId = orgA.body.data.id;

    const orgB = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${ownerGlobexToken}`)
      .send({ name: 'Globex Inc' });
    globexOrgId = orgB.body.data.id;

    // Add member & auditor to Acme
    store.organization_members.push(
      {
        id: 'mem-1',
        org_id: acmeOrgId,
        user_id: regMemberA.body.data.user.id,
        role: 'team_member',
      },
      {
        id: 'mem-2',
        org_id: acmeOrgId,
        user_id: regAuditorA.body.data.user.id,
        role: 'auditor',
      },
    );
  });

  it('enforces server-side RBAC and strict cross-tenant isolation', async () => {
    // Owner creates project in Acme
    const projRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerAcmeToken}`)
      .set('X-Org-ID', acmeOrgId)
      .send({ name: 'Acme Secret Project', status: 'active', priority: 'high' });
    expect(projRes.status).toBe(201);
    const projectId = projRes.body.data.id;

    // Team member cannot create a project
    const memberCreateProj = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${memberAcmeToken}`)
      .set('X-Org-ID', acmeOrgId)
      .send({ name: 'Unauthorized Project' });
    expect(memberCreateProj.status).toBe(403);

    // Auditor can read projects & audit logs, but CANNOT create tasks
    const auditorRead = await request(app)
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${auditorAcmeToken}`)
      .set('X-Org-ID', acmeOrgId);
    expect(auditorRead.status).toBe(200);
    expect(auditorRead.body.data.length).toBe(1);

    const auditorWrite = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${auditorAcmeToken}`)
      .set('X-Org-ID', acmeOrgId)
      .send({ projectId, title: 'Auditor should not write' });
    expect(auditorWrite.status).toBe(403);

    // Cross-tenant access attempt by Globex owner against Acme org -> 403
    const crossOrgHeader = await request(app)
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerGlobexToken}`)
      .set('X-Org-ID', acmeOrgId);
    expect(crossOrgHeader.status).toBe(403);

    // Cross-tenant access attempt by Globex owner using Globex org ID to read Acme project -> 404
    const crossProj = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${ownerGlobexToken}`)
      .set('X-Org-ID', globexOrgId);
    expect(crossProj.status).toBe(404);
  });

  it('prevents silent overwrites on concurrent task updates (409 Conflict) and logs complete activity history', async () => {
    const projRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerAcmeToken}`)
      .set('X-Org-ID', acmeOrgId)
      .send({ name: 'Concurrency Project', status: 'active' });
    const projectId = projRes.body.data.id;

    const memberUser = store.users.find((u) => u.email === 'member@acme.io')!;
    const taskRes = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${ownerAcmeToken}`)
      .set('X-Org-ID', acmeOrgId)
      .send({
        projectId,
        title: 'Concurrent Task',
        status: 'todo',
        priority: 'high',
        assigneeId: memberUser.id,
      });
    expect(taskRes.status).toBe(201);
    const task = taskRes.body.data;
    expect(task.version).toBe(1);

    // User A and User B both read version 1 and send concurrent updates
    const [resA, resB] = await Promise.all([
      request(app)
        .put(`/api/v1/tasks/${task.id}`)
        .set('Authorization', `Bearer ${ownerAcmeToken}`)
        .set('X-Org-ID', acmeOrgId)
        .send({ status: 'in_progress', version: 1 }),
      request(app)
        .put(`/api/v1/tasks/${task.id}`)
        .set('Authorization', `Bearer ${memberAcmeToken}`)
        .set('X-Org-ID', acmeOrgId)
        .send({ status: 'done', version: 1 }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    const conflictRes = resA.status === 409 ? resA : resB;
    expect(conflictRes.body.error.code).toBe('OPTIMISTIC_LOCK_CONFLICT');
    expect(conflictRes.body.error.details.currentVersion).toBe(2);

    // Activity history preserves created + single winning update (no phantom overwrite history)
    const activityRes = await request(app)
      .get(`/api/v1/activity/tasks/${task.id}`)
      .set('Authorization', `Bearer ${ownerAcmeToken}`)
      .set('X-Org-ID', acmeOrgId);
    expect(activityRes.status).toBe(200);
    expect(activityRes.body.data.length).toBe(2);
  });
});
