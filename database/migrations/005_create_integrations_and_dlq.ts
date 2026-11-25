import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ── outgoing_webhooks ──────────────────────────────────────────────────
  await knex.schema.createTable('outgoing_webhooks', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.text('url').notNullable();
    t.specificType('events', 'TEXT[]').notNullable();
    t.string('secret', 255).notNullable();
    t.boolean('is_active').defaultTo(true);
    t.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // ── webhook_deliveries ─────────────────────────────────────────────────
  await knex.schema.createTable('webhook_deliveries', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('webhook_id').notNullable().references('id').inTable('outgoing_webhooks').onDelete('CASCADE');
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('event_type', 100).notNullable();
    t.string('delivery_id', 255).unique().notNullable();
    t.jsonb('payload').notNullable();
    t.integer('status_code');
    t.text('response_body');
    t.integer('attempt_count').defaultTo(1);
    t.string('status', 30).defaultTo('pending');
    t.timestamp('delivered_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_status_check
    CHECK (status IN ('pending', 'delivered', 'failed'))
  `);

  // ── subscriptions (Stripe sandbox) ─────────────────────────────────────
  await knex.schema.createTable('subscriptions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').unique().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('stripe_customer_id', 255);
    t.string('stripe_subscription_id', 255);
    t.string('plan', 50).defaultTo('free');
    t.string('status', 50).defaultTo('active');
    t.timestamp('current_period_end', { useTz: true });
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // ── dead_letter_jobs ───────────────────────────────────────────────────
  await knex.schema.createTable('dead_letter_jobs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('queue_name', 100).notNullable();
    t.string('job_id', 255).notNullable();
    t.string('job_name', 255).notNullable();
    t.uuid('org_id').references('id').inTable('organizations').onDelete('SET NULL');
    t.jsonb('payload').notNullable();
    t.text('error_message').notNullable();
    t.text('stack_trace');
    t.integer('attempts_made').defaultTo(0);
    t.string('status', 30).defaultTo('failed');
    t.timestamp('retried_at', { useTz: true });
    t.timestamp('resolved_at', { useTz: true });
    t.timestamp('failed_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE dead_letter_jobs
    ADD CONSTRAINT dead_letter_jobs_status_check
    CHECK (status IN ('failed', 'retried', 'resolved', 'discarded'))
  `);

  await knex.schema.alterTable('outgoing_webhooks', (t) => {
    t.index(['org_id', 'is_active'], 'idx_webhooks_org_active');
  });

  await knex.schema.alterTable('webhook_deliveries', (t) => {
    t.index(['webhook_id', 'created_at'], 'idx_webhook_deliveries_hook');
  });

  await knex.schema.alterTable('dead_letter_jobs', (t) => {
    t.index(['queue_name', 'status'], 'idx_dlq_queue_status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('dead_letter_jobs');
  await knex.schema.dropTableIfExists('subscriptions');
  await knex.schema.dropTableIfExists('webhook_deliveries');
  await knex.schema.dropTableIfExists('outgoing_webhooks');
}
