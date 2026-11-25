import request from 'supertest';
import app from '../../src/app';
import { createMockDb, MemoryStore } from '../helpers/mockDb';

describe('Core Modules: Orgs, Invitations, Teams, Projects, Milestones, Tasks, Comments, Workflows & ICS', () => {
  let store: MemoryStore;
  let ownerToken: string;
  let inviteeToken: string;
  let orgId: string;

  beforeEach(async () => {
    ({ store } = createMockDb());

    const reg1 = await request(app).post('/api/v1/auth/register').send({
      email: 'lead@acme.io',
      password: 'Password123!',
      firstName: 'Lead',
      lastName: 'User',
    });
    ownerToken = reg1.body.data.tokens.accessToken;

    const reg2 = await request(app).post('/api/v1/auth/register').send({
      email: 'dev@acme.io',
      password: 'Password123!',
      firstName: 'Dev',
      lastName: 'Engineer',
    });
    inviteeToken = reg2.body.data.tokens.accessToken;

    const org = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Acme Workflows' });
    orgId = org.body.data.id;
  });

  it('supports invitation lifecycle, teams, projects, milestones, tasks, subtasks, comments, workflow automation, and ICS export', async () => {
    // 1. Invite member & accept invitation
    const inv = await request(app)
      .post(`/api/v1/organizations/${orgId}/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'dev@acme.io', role: 'team_member' });
    expect(inv.status).toBe(201);

    const accept = await request(app)
      .post(`/api/v1/organizations/invitations/${inv.body.data.token}/accept`)
      .set('Authorization', `Bearer ${inviteeToken}`);
    expect(accept.status).toBe(200);
    expect(accept.body.data.role).toBe('team_member');

    // 2. Create team & add member
    const team = await request(app)
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Org-ID', orgId)
      .send({ name: 'Platform Engineering' });
    expect(team.status).toBe(201);

    const devUser = store.users.find((u) => u.email === 'dev@acme.io')!;
    const addMem = await request(app)
      .post(`/api/v1/teams/${team.body.data.id}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Org-ID', orgId)
      .send({ userId: devUser.id, role: 'member' });
    expect(addMem.status).toBe(201);

    // 3. Create project & milestone
    const proj = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Org-ID', orgId)
      .send({ name: 'Launch v2', status: 'active', priority: 'critical', teamId: team.body.data.id });
    expect(proj.status).toBe(201);
    const projectId = proj.body.data.id;

    const ms = await request(app)
      .post(`/api/v1/projects/${projectId}/milestones`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Org-ID', orgId)
      .send({ name: 'Beta Milestone', dueDate: '2026-12-20', status: 'in_progress' });
    expect(ms.status).toBe(201);

    // 4. Create workflow rule: when critical task created -> create checklist subtask
    const rule = await request(app)
      .post('/api/v1/workflow-rules')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Org-ID', orgId)
      .send({
        name: 'Auto-subtask for critical tasks',
        triggerEvent: 'task.created',
        conditions: [{ field: 'priority', operator: 'equals', value: 'critical' }],
        actions: [{ type: 'create_subtask', params: { title: 'Security Sign-off', priority: 'high' } }],
      });
    expect(rule.status).toBe(201);

    // 5. Create critical task -> triggers workflow rule creating subtask
    const task = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${inviteeToken}`)
      .set('X-Org-ID', orgId)
      .send({
        projectId,
        milestoneId: ms.body.data.id,
        title: 'Deploy Auth Gateway',
        priority: 'critical',
        dueDate: '2026-12-15',
      });
    expect(task.status).toBe(201);

    const subtasks = await request(app)
      .get(`/api/v1/tasks/${task.body.data.id}/subtasks`)
      .set('Authorization', `Bearer ${inviteeToken}`)
      .set('X-Org-ID', orgId);
    expect(subtasks.status).toBe(200);
    expect(subtasks.body.data.some((s: any) => s.title === 'Security Sign-off')).toBe(true);

    // 6. Add comment & watcher
    const comment = await request(app)
      .post(`/api/v1/tasks/${task.body.data.id}/comments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Org-ID', orgId)
      .send({ content: 'Please verify JWT rotation tests before deploy.' });
    expect(comment.status).toBe(201);

    const watcher = await request(app)
      .post(`/api/v1/tasks/${task.body.data.id}/watchers`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Org-ID', orgId);
    expect(watcher.status).toBe(200);

    // 7. Export ICS calendar feed
    const ics = await request(app)
      .get(`/api/v1/projects/${projectId}/calendar.ics`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Org-ID', orgId);
    expect(ics.status).toBe(200);
    expect(ics.text).toContain('BEGIN:VCALENDAR');
    expect(ics.text).toContain('Deploy Auth Gateway');
  });
});
