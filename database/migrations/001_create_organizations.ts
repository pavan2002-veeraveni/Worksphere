import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Enable uuid-ossp extension
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // ── organizations ──────────────────────────────────────────────────────
  await knex.schema.createTable('organizations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.string('slug', 255).unique().notNullable();
    t.string('plan', 50).defaultTo('free');
    t.text('logo_url');
    t.jsonb('settings').defaultTo('{}');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // ── users ──────────────────────────────────────────────────────────────
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('email', 255).unique().notNullable();
    t.string('password_hash', 255).notNullable();
    t.string('first_name', 100).notNullable();
    t.string('last_name', 100).notNullable();
    t.text('avatar_url');
    t.boolean('is_platform_admin').defaultTo(false);
    t.boolean('is_active').defaultTo(true);
    t.timestamp('last_login_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // ── organization_members ───────────────────────────────────────────────
  await knex.schema.createTable('organization_members', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('role', 50).notNullable();
    t.uuid('invited_by').references('id').inTable('users');
    t.timestamp('joined_at', { useTz: true }).defaultTo(knex.fn.now());

    t.unique(['org_id', 'user_id']);
  });

  // Add CHECK constraint on role
  await knex.raw(`
    ALTER TABLE organization_members
    ADD CONSTRAINT organization_members_role_check
    CHECK (role IN ('owner', 'project_manager', 'team_member', 'auditor'))
  `);

  // ── invitations ────────────────────────────────────────────────────────
  await knex.schema.createTable('invitations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('email', 255).notNullable();
    t.string('role', 50).notNullable();
    t.string('token', 255).unique().notNullable();
    t.uuid('invited_by').references('id').inTable('users');
    t.string('status', 20).defaultTo('pending');
    t.timestamp('expires_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Add CHECK constraint on status
  await knex.raw(`
    ALTER TABLE invitations
    ADD CONSTRAINT invitations_status_check
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
  `);

  // ── refresh_tokens ─────────────────────────────────────────────────────
  await knex.schema.createTable('refresh_tokens', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('token_hash', 255).unique().notNullable();
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.timestamp('revoked_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('refresh_tokens');
  await knex.schema.dropTableIfExists('invitations');
  await knex.schema.dropTableIfExists('organization_members');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('organizations');
  await knex.raw('DROP EXTENSION IF EXISTS "uuid-ossp"');
}
