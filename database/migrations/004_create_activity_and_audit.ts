import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ── activity_log ───────────────────────────────────────────────────────
  await knex.schema.createTable('activity_log', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.uuid('project_id').references('id').inTable('projects').onDelete('SET NULL');
    t.uuid('task_id').references('id').inTable('tasks').onDelete('SET NULL');
    t.uuid('actor_id').notNullable().references('id').inTable('users');
    t.string('action', 100).notNullable();
    t.string('entity_type', 100).notNullable();
    t.uuid('entity_id').notNullable();
    t.jsonb('changes');
    t.jsonb('metadata');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // ── audit_events ───────────────────────────────────────────────────────
  await knex.schema.createTable('audit_events', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.uuid('actor_id').notNullable().references('id').inTable('users');
    t.string('action', 100).notNullable();
    t.string('resource_type', 100).notNullable();
    t.uuid('resource_id').notNullable();
    t.specificType('ip_address', 'INET');
    t.text('user_agent');
    t.uuid('request_id');
    t.jsonb('old_values');
    t.jsonb('new_values');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // ── notifications ─────────────────────────────────────────────────────
  await knex.schema.createTable('notifications', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('type', 100).notNullable();
    t.string('title', 500).notNullable();
    t.text('message');
    t.text('link');
    t.boolean('is_read').defaultTo(false);
    t.jsonb('metadata');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // ── workflow_rules ─────────────────────────────────────────────────────
  await knex.schema.createTable('workflow_rules', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.uuid('project_id').references('id').inTable('projects').onDelete('SET NULL');
    t.string('name', 255).notNullable();
    t.text('description');
    t.string('trigger_event', 100).notNullable();
    t.jsonb('conditions');
    t.jsonb('actions');
    t.boolean('is_active').defaultTo(true);
    t.uuid('created_by').notNullable().references('id').inTable('users');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // ── processed_events ───────────────────────────────────────────────────
  await knex.schema.createTable('processed_events', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('event_id', 255).unique().notNullable();
    t.string('event_type', 100).notNullable();
    t.timestamp('processed_at', { useTz: true }).defaultTo(knex.fn.now());
    t.jsonb('result');
  });

  // ── Indexes ────────────────────────────────────────────────────────────
  await knex.schema.alterTable('activity_log', (t) => {
    t.index(['org_id', 'created_at'], 'idx_activity_org_created');
    t.index(['task_id'], 'idx_activity_task');
  });

  await knex.schema.alterTable('audit_events', (t) => {
    t.index(['org_id', 'created_at'], 'idx_audit_org_created');
  });

  await knex.schema.alterTable('notifications', (t) => {
    t.index(['user_id', 'is_read', 'created_at'], 'idx_notifications_user_read');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('processed_events');
  await knex.schema.dropTableIfExists('workflow_rules');
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('audit_events');
  await knex.schema.dropTableIfExists('activity_log');
}
