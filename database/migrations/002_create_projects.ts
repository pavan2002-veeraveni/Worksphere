import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ── teams ──────────────────────────────────────────────────────────────
  await knex.schema.createTable('teams', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.text('description');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // ── team_members ───────────────────────────────────────────────────────
  await knex.schema.createTable('team_members', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('team_id').notNullable().references('id').inTable('teams').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('role', 50).defaultTo('member');

    t.unique(['team_id', 'user_id']);
  });

  // ── projects ───────────────────────────────────────────────────────────
  await knex.schema.createTable('projects', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.text('description');
    t.string('status', 50).defaultTo('planning');
    t.string('priority', 20).defaultTo('medium');
    t.date('start_date');
    t.date('end_date');
    t.uuid('created_by').references('id').inTable('users');
    t.uuid('team_id').references('id').inTable('teams');
    t.jsonb('settings').defaultTo('{}');
    t.integer('version').defaultTo(1);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // CHECK constraints for projects
  await knex.raw(`
    ALTER TABLE projects
    ADD CONSTRAINT projects_status_check
    CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'archived'))
  `);

  await knex.raw(`
    ALTER TABLE projects
    ADD CONSTRAINT projects_priority_check
    CHECK (priority IN ('low', 'medium', 'high', 'critical'))
  `);

  // ── milestones ─────────────────────────────────────────────────────────
  await knex.schema.createTable('milestones', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.text('description');
    t.date('due_date');
    t.string('status', 50).defaultTo('pending');
    t.integer('sort_order').defaultTo(0);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // ── Indexes ────────────────────────────────────────────────────────────
  await knex.schema.alterTable('projects', (t) => {
    t.index(['org_id', 'status'], 'idx_projects_org_status');
    t.index(['team_id'], 'idx_projects_team');
  });

  await knex.schema.alterTable('milestones', (t) => {
    t.index(['project_id'], 'idx_milestones_project');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('milestones');
  await knex.schema.dropTableIfExists('projects');
  await knex.schema.dropTableIfExists('team_members');
  await knex.schema.dropTableIfExists('teams');
}
