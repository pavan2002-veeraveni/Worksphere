import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ── tasks ──────────────────────────────────────────────────────────────
  await knex.schema.createTable('tasks', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    t.uuid('milestone_id').references('id').inTable('milestones').onDelete('SET NULL');
    t.uuid('parent_task_id').references('id').inTable('tasks').onDelete('SET NULL');
    t.string('title', 500).notNullable();
    t.text('description');
    t.string('status', 50).defaultTo('todo');
    t.string('priority', 20).defaultTo('medium');
    t.uuid('assignee_id').references('id').inTable('users').onDelete('SET NULL');
    t.uuid('reporter_id').notNullable().references('id').inTable('users');
    t.date('due_date');
    t.decimal('estimated_hours', 8, 2);
    t.decimal('actual_hours', 8, 2);
    t.integer('sort_order').defaultTo(0);
    t.integer('version').defaultTo(1);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // CHECK constraints for tasks
  await knex.raw(`
    ALTER TABLE tasks
    ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('todo', 'in_progress', 'in_review', 'done', 'cancelled'))
  `);

  await knex.raw(`
    ALTER TABLE tasks
    ADD CONSTRAINT tasks_priority_check
    CHECK (priority IN ('low', 'medium', 'high', 'critical'))
  `);

  // ── comments ───────────────────────────────────────────────────────────
  await knex.schema.createTable('comments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('task_id').notNullable().references('id').inTable('tasks').onDelete('CASCADE');
    t.uuid('author_id').notNullable().references('id').inTable('users');
    t.text('content').notNullable();
    t.uuid('parent_comment_id').references('id').inTable('comments').onDelete('SET NULL');
    t.boolean('is_edited').defaultTo(false);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // ── attachments ────────────────────────────────────────────────────────
  await knex.schema.createTable('attachments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('task_id').references('id').inTable('tasks').onDelete('CASCADE');
    t.uuid('comment_id').references('id').inTable('comments').onDelete('CASCADE');
    t.uuid('uploaded_by').notNullable().references('id').inTable('users');
    t.string('file_name', 500).notNullable();
    t.bigInteger('file_size').notNullable();
    t.string('mime_type', 255).notNullable();
    t.string('storage_key', 1000).notNullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // ── task_watchers ──────────────────────────────────────────────────────
  await knex.schema.createTable('task_watchers', (t) => {
    t.uuid('task_id').notNullable().references('id').inTable('tasks').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.primary(['task_id', 'user_id']);
  });

  // ── Indexes ────────────────────────────────────────────────────────────
  await knex.schema.alterTable('tasks', (t) => {
    t.index(['project_id', 'status'], 'idx_tasks_project_status');
    t.index(['assignee_id'], 'idx_tasks_assignee');
    t.index(['parent_task_id'], 'idx_tasks_parent');
  });

  await knex.schema.alterTable('comments', (t) => {
    t.index(['task_id'], 'idx_comments_task');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('task_watchers');
  await knex.schema.dropTableIfExists('attachments');
  await knex.schema.dropTableIfExists('comments');
  await knex.schema.dropTableIfExists('tasks');
}
