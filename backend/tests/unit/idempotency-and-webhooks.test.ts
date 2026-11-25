import Stripe from 'stripe';
import request from 'supertest';
import app from '../../src/app';
import { config } from '../../src/config';
import { webhookService } from '../../src/integrations/webhookService';
import { deadLetterHandler } from '../../src/jobs/deadLetterHandler';
import { processNotificationJob } from '../../src/jobs/workers/notificationWorker';
import { createMockDb, MemoryStore } from '../helpers/mockDb';

describe('Jobs Idempotency, Dead-Letter Recovery & Third-Party Webhooks', () => {
  let store: MemoryStore;

  beforeEach(() => {
    ({ store } = createMockDb());
    store.organizations.push({
      id: 'b0000000-0000-0000-0000-000000000001',
      name: 'Acme Corp',
      slug: 'acme-corp',
      plan: 'free',
    });
    store.users.push({
      id: 'a0000000-0000-0000-0000-000000000002',
      email: 'alice@acme.io',
      first_name: 'Alice',
      last_name: 'Smith',
      password_hash: 'hash',
      is_active: true,
      is_platform_admin: false,
    });
  });

  it('prevents duplicate notifications when background jobs retry', async () => {
    const payload = {
      idempotencyKey: 'notif:task:123:v2:status:in_progress',
      orgId: 'b0000000-0000-0000-0000-000000000001',
      userId: 'a0000000-0000-0000-0000-000000000002',
      type: 'task_updated',
      title: 'Status Updated',
      message: 'Task moved to In Progress',
    };

    const firstRun = await processNotificationJob(payload);
    const secondRun = await processNotificationJob(payload);
    const thirdRun = await processNotificationJob(payload);

    expect(firstRun.skipped).toBe(false);
    expect(secondRun.skipped).toBe(true);
    expect(thirdRun.skipped).toBe(true);
    expect(store.notifications.length).toBe(1);
  });

  it('records dead-letter jobs and supports recovery transition', async () => {
    const failed = await deadLetterHandler.recordFailure({
      queueName: 'notifications',
      jobId: 'job-99',
      jobName: 'task_assigned',
      orgId: 'b0000000-0000-0000-0000-000000000001',
      payload: { test: true },
      error: new Error('SMTP connection timeout'),
      attemptsMade: 3,
    });
    expect(failed.status).toBe('failed');

    const listed = await deadLetterHandler.listDeadLetterJobs('b0000000-0000-0000-0000-000000000001');
    expect(listed.length).toBe(1);

    const retried = await deadLetterHandler.markRetried(failed.id);
    expect(retried?.status).toBe('retried');
  });

  it('verifies Stripe webhook signatures and prevents duplicate event processing', async () => {
    const eventPayload = JSON.stringify({
      id: 'evt_test_12345',
      object: 'event',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          status: 'active',
          metadata: { orgId: 'b0000000-0000-0000-0000-000000000001' },
        },
      },
    });

    const stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2023-10-16' });
    const header = stripe.webhooks.generateTestHeaderString({
      payload: eventPayload,
      secret: config.stripe.webhookSecret,
    });

    // Invalid signature rejected
    const badSig = await request(app)
      .post('/api/v1/integrations/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 't=123,v1=invalid')
      .send(eventPayload);
    expect(badSig.status).toBe(400);
    expect(badSig.body.error.code).toBe('INVALID_WEBHOOK_SIGNATURE');

    // Valid signature accepted and processed once
    const ok1 = await request(app)
      .post('/api/v1/integrations/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', header)
      .send(eventPayload);
    expect(ok1.status).toBe(200);
    expect(ok1.body.data.duplicate).toBe(false);

    // Duplicate delivery detected and skipped
    const ok2 = await request(app)
      .post('/api/v1/integrations/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', header)
      .send(eventPayload);
    expect(ok2.status).toBe(200);
    expect(ok2.body.data.duplicate).toBe(true);
  });

  it('signs and verifies outgoing webhook HMAC-SHA256 payloads', () => {
    const body = JSON.stringify({ id: 'del-1', event: 'task.created' });
    const secret = 'whsec_test_secret_123456';
    const ts = 1700000000;
    const sig = webhookService.signPayload(body, secret, ts);

    expect(webhookService.verifySignature(body, sig, secret, ts)).toBe(true);
    expect(webhookService.verifySignature(body, sig, 'wrong-secret', ts)).toBe(false);
  });
});
