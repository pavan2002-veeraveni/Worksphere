import type { Knex } from 'knex';

/**
 * Pre-computed bcrypt hash for "Password123!"
 * Generated with bcrypt cost factor 10.
 */
const PASSWORD_HASH = '$2b$10$rICGuaY0A0wLpGOEqGxF4uYPdQPN5RJHWW0Jv5hKGTe8C8s5sQTCy';

// ── Static UUIDs for deterministic seeding ──────────────────────────────
const IDS = {
  // Users
  adminUser: 'a0000000-0000-0000-0000-000000000001',
  aliceUser: 'a0000000-0000-0000-0000-000000000002',
  bobUser: 'a0000000-0000-0000-0000-000000000003',
  carolUser: 'a0000000-0000-0000-0000-000000000004',
  daveUser: 'a0000000-0000-0000-0000-000000000005',

  // Organizations
  acmeOrg: 'b0000000-0000-0000-0000-000000000001',
  globexOrg: 'b0000000-0000-0000-0000-000000000002',

  // Teams – Acme
  acmeEngTeam: 'c0000000-0000-0000-0000-000000000001',
  acmeDesignTeam: 'c0000000-0000-0000-0000-000000000002',
  // Teams – Globex
  globexProdTeam: 'c0000000-0000-0000-0000-000000000003',
  globexMktgTeam: 'c0000000-0000-0000-0000-000000000004',

  // Projects – Acme
  acmeProj1: 'd0000000-0000-0000-0000-000000000001',
  acmeProj2: 'd0000000-0000-0000-0000-000000000002',
  acmeProj3: 'd0000000-0000-0000-0000-000000000003',
  // Projects – Globex
  globexProj1: 'd0000000-0000-0000-0000-000000000004',
  globexProj2: 'd0000000-0000-0000-0000-000000000005',
  globexProj3: 'd0000000-0000-0000-0000-000000000006',

  // Milestones
  ms1: 'e0000000-0000-0000-0000-000000000001',
  ms2: 'e0000000-0000-0000-0000-000000000002',
  ms3: 'e0000000-0000-0000-0000-000000000003',
  ms4: 'e0000000-0000-0000-0000-000000000004',
  ms5: 'e0000000-0000-0000-0000-000000000005',
  ms6: 'e0000000-0000-0000-0000-000000000006',

  // Tasks
  task1: 'f0000000-0000-0000-0000-000000000001',
  task2: 'f0000000-0000-0000-0000-000000000002',
  task3: 'f0000000-0000-0000-0000-000000000003',
  task4: 'f0000000-0000-0000-0000-000000000004',
  task5: 'f0000000-0000-0000-0000-000000000005',
  task6: 'f0000000-0000-0000-0000-000000000006',
  task7: 'f0000000-0000-0000-0000-000000000007',
  task8: 'f0000000-0000-0000-0000-000000000008',
  task9: 'f0000000-0000-0000-0000-000000000009',
  task10: 'f0000000-0000-0000-0000-000000000010',
  // Subtasks
  subtask1: 'f1000000-0000-0000-0000-000000000001',
  subtask2: 'f1000000-0000-0000-0000-000000000002',
  subtask3: 'f1000000-0000-0000-0000-000000000003',
  subtask4: 'f1000000-0000-0000-0000-000000000004',

  // Comments
  comment1: 'f2000000-0000-0000-0000-000000000001',
  comment2: 'f2000000-0000-0000-0000-000000000002',
  comment3: 'f2000000-0000-0000-0000-000000000003',
  comment4: 'f2000000-0000-0000-0000-000000000004',
  comment5: 'f2000000-0000-0000-0000-000000000005',

  // Activity
  activity1: 'f3000000-0000-0000-0000-000000000001',
  activity2: 'f3000000-0000-0000-0000-000000000002',
  activity3: 'f3000000-0000-0000-0000-000000000003',
  activity4: 'f3000000-0000-0000-0000-000000000004',
  activity5: 'f3000000-0000-0000-0000-000000000005',
};

export async function seed(knex: Knex): Promise<void> {
  // Truncate in reverse dependency order
  await knex.raw('TRUNCATE TABLE activity_log CASCADE');
  await knex.raw('TRUNCATE TABLE notifications CASCADE');
  await knex.raw('TRUNCATE TABLE audit_events CASCADE');
  await knex.raw('TRUNCATE TABLE workflow_rules CASCADE');
  await knex.raw('TRUNCATE TABLE processed_events CASCADE');
  await knex.raw('TRUNCATE TABLE task_watchers CASCADE');
  await knex.raw('TRUNCATE TABLE attachments CASCADE');
  await knex.raw('TRUNCATE TABLE comments CASCADE');
  await knex.raw('TRUNCATE TABLE tasks CASCADE');
  await knex.raw('TRUNCATE TABLE milestones CASCADE');
  await knex.raw('TRUNCATE TABLE projects CASCADE');
  await knex.raw('TRUNCATE TABLE team_members CASCADE');
  await knex.raw('TRUNCATE TABLE teams CASCADE');
  await knex.raw('TRUNCATE TABLE invitations CASCADE');
  await knex.raw('TRUNCATE TABLE organization_members CASCADE');
  await knex.raw('TRUNCATE TABLE refresh_tokens CASCADE');
  await knex.raw('TRUNCATE TABLE users CASCADE');
  await knex.raw('TRUNCATE TABLE organizations CASCADE');

  // ── Users ──────────────────────────────────────────────────────────────
  await knex('users').insert([
    {
      id: IDS.adminUser,
      email: 'admin@worksphere.io',
      password_hash: PASSWORD_HASH,
      first_name: 'Platform',
      last_name: 'Admin',
      is_platform_admin: true,
      is_active: true,
    },
    {
      id: IDS.aliceUser,
      email: 'alice@acme.com',
      password_hash: PASSWORD_HASH,
      first_name: 'Alice',
      last_name: 'Johnson',
      is_platform_admin: false,
      is_active: true,
    },
    {
      id: IDS.bobUser,
      email: 'bob@acme.com',
      password_hash: PASSWORD_HASH,
      first_name: 'Bob',
      last_name: 'Williams',
      is_platform_admin: false,
      is_active: true,
    },
    {
      id: IDS.carolUser,
      email: 'carol@globex.com',
      password_hash: PASSWORD_HASH,
      first_name: 'Carol',
      last_name: 'Martinez',
      is_platform_admin: false,
      is_active: true,
    },
    {
      id: IDS.daveUser,
      email: 'dave@globex.com',
      password_hash: PASSWORD_HASH,
      first_name: 'Dave',
      last_name: 'Chen',
      is_platform_admin: false,
      is_active: true,
    },
  ]);

  // ── Organizations ──────────────────────────────────────────────────────
  await knex('organizations').insert([
    {
      id: IDS.acmeOrg,
      name: 'Acme Corp',
      slug: 'acme-corp',
      plan: 'professional',
      settings: JSON.stringify({ maxProjects: 50, features: ['time_tracking', 'gantt'] }),
    },
    {
      id: IDS.globexOrg,
      name: 'Globex Inc',
      slug: 'globex-inc',
      plan: 'enterprise',
      settings: JSON.stringify({ maxProjects: 200, features: ['time_tracking', 'gantt', 'audit_log', 'sso'] }),
    },
  ]);

  // ── Organization Members ───────────────────────────────────────────────
  await knex('organization_members').insert([
    // Acme Corp members
    { org_id: IDS.acmeOrg, user_id: IDS.adminUser, role: 'owner' },
    { org_id: IDS.acmeOrg, user_id: IDS.aliceUser, role: 'project_manager', invited_by: IDS.adminUser },
    { org_id: IDS.acmeOrg, user_id: IDS.bobUser, role: 'team_member', invited_by: IDS.aliceUser },
    // Globex Inc members
    { org_id: IDS.globexOrg, user_id: IDS.carolUser, role: 'owner' },
    { org_id: IDS.globexOrg, user_id: IDS.daveUser, role: 'project_manager', invited_by: IDS.carolUser },
    { org_id: IDS.globexOrg, user_id: IDS.aliceUser, role: 'auditor', invited_by: IDS.carolUser },
  ]);

  // ── Teams ──────────────────────────────────────────────────────────────
  await knex('teams').insert([
    { id: IDS.acmeEngTeam, org_id: IDS.acmeOrg, name: 'Engineering', description: 'Core engineering team' },
    { id: IDS.acmeDesignTeam, org_id: IDS.acmeOrg, name: 'Design', description: 'UX/UI design team' },
    { id: IDS.globexProdTeam, org_id: IDS.globexOrg, name: 'Product', description: 'Product management team' },
    { id: IDS.globexMktgTeam, org_id: IDS.globexOrg, name: 'Marketing', description: 'Growth marketing team' },
  ]);

  // ── Team Members ───────────────────────────────────────────────────────
  await knex('team_members').insert([
    { team_id: IDS.acmeEngTeam, user_id: IDS.aliceUser, role: 'lead' },
    { team_id: IDS.acmeEngTeam, user_id: IDS.bobUser, role: 'member' },
    { team_id: IDS.acmeDesignTeam, user_id: IDS.bobUser, role: 'lead' },
    { team_id: IDS.globexProdTeam, user_id: IDS.carolUser, role: 'lead' },
    { team_id: IDS.globexProdTeam, user_id: IDS.daveUser, role: 'member' },
    { team_id: IDS.globexMktgTeam, user_id: IDS.daveUser, role: 'lead' },
  ]);

  // ── Projects ───────────────────────────────────────────────────────────
  await knex('projects').insert([
    // Acme projects
    {
      id: IDS.acmeProj1,
      org_id: IDS.acmeOrg,
      name: 'Platform Redesign',
      description: 'Complete overhaul of the customer-facing platform UI/UX.',
      status: 'active',
      priority: 'high',
      start_date: '2025-01-15',
      end_date: '2025-06-30',
      created_by: IDS.aliceUser,
      team_id: IDS.acmeEngTeam,
    },
    {
      id: IDS.acmeProj2,
      org_id: IDS.acmeOrg,
      name: 'API v3 Migration',
      description: 'Migrate REST API from v2 to v3 with GraphQL support.',
      status: 'planning',
      priority: 'critical',
      start_date: '2025-03-01',
      end_date: '2025-09-30',
      created_by: IDS.aliceUser,
      team_id: IDS.acmeEngTeam,
    },
    {
      id: IDS.acmeProj3,
      org_id: IDS.acmeOrg,
      name: 'Brand Guidelines Update',
      description: 'Refresh brand identity and design system components.',
      status: 'active',
      priority: 'medium',
      start_date: '2025-02-01',
      end_date: '2025-04-30',
      created_by: IDS.bobUser,
      team_id: IDS.acmeDesignTeam,
    },
    // Globex projects
    {
      id: IDS.globexProj1,
      org_id: IDS.globexOrg,
      name: 'Mobile App Launch',
      description: 'Build and launch the Globex mobile application on iOS and Android.',
      status: 'active',
      priority: 'critical',
      start_date: '2025-01-01',
      end_date: '2025-07-31',
      created_by: IDS.carolUser,
      team_id: IDS.globexProdTeam,
    },
    {
      id: IDS.globexProj2,
      org_id: IDS.globexOrg,
      name: 'Q2 Marketing Campaign',
      description: 'Multi-channel campaign for the Q2 product launch.',
      status: 'planning',
      priority: 'high',
      start_date: '2025-04-01',
      end_date: '2025-06-30',
      created_by: IDS.daveUser,
      team_id: IDS.globexMktgTeam,
    },
    {
      id: IDS.globexProj3,
      org_id: IDS.globexOrg,
      name: 'Data Pipeline Overhaul',
      description: 'Replace legacy ETL with modern streaming architecture.',
      status: 'on_hold',
      priority: 'medium',
      start_date: '2025-05-01',
      end_date: '2025-12-31',
      created_by: IDS.carolUser,
      team_id: IDS.globexProdTeam,
    },
  ]);

  // ── Milestones ─────────────────────────────────────────────────────────
  await knex('milestones').insert([
    // Acme - Platform Redesign
    { id: IDS.ms1, project_id: IDS.acmeProj1, name: 'Design Phase Complete', due_date: '2025-03-01', status: 'completed', sort_order: 1 },
    { id: IDS.ms2, project_id: IDS.acmeProj1, name: 'Beta Release', due_date: '2025-05-15', status: 'pending', sort_order: 2 },
    // Acme - API v3
    { id: IDS.ms3, project_id: IDS.acmeProj2, name: 'Schema Design Approval', due_date: '2025-04-01', status: 'pending', sort_order: 1 },
    // Globex - Mobile App
    { id: IDS.ms4, project_id: IDS.globexProj1, name: 'Alpha Build', due_date: '2025-03-15', status: 'completed', sort_order: 1 },
    { id: IDS.ms5, project_id: IDS.globexProj1, name: 'App Store Submission', due_date: '2025-07-01', status: 'pending', sort_order: 2 },
    // Globex - Marketing
    { id: IDS.ms6, project_id: IDS.globexProj2, name: 'Creative Assets Ready', due_date: '2025-04-20', status: 'pending', sort_order: 1 },
  ]);

  // ── Tasks ──────────────────────────────────────────────────────────────
  await knex('tasks').insert([
    // Acme - Platform Redesign tasks
    {
      id: IDS.task1,
      project_id: IDS.acmeProj1,
      milestone_id: IDS.ms1,
      title: 'Create wireframes for dashboard',
      description: 'Design wireframes for the new dashboard layout including widgets and navigation.',
      status: 'done',
      priority: 'high',
      assignee_id: IDS.bobUser,
      reporter_id: IDS.aliceUser,
      due_date: '2025-02-15',
      estimated_hours: 24,
      actual_hours: 20,
      sort_order: 1,
    },
    {
      id: IDS.task2,
      project_id: IDS.acmeProj1,
      milestone_id: IDS.ms2,
      title: 'Implement responsive navigation',
      description: 'Build the responsive sidebar and top navigation components.',
      status: 'in_progress',
      priority: 'high',
      assignee_id: IDS.aliceUser,
      reporter_id: IDS.aliceUser,
      due_date: '2025-04-01',
      estimated_hours: 40,
      actual_hours: 15,
      sort_order: 2,
    },
    {
      id: IDS.task3,
      project_id: IDS.acmeProj1,
      milestone_id: IDS.ms2,
      title: 'Set up component library',
      description: 'Initialize Storybook and create base component library.',
      status: 'in_review',
      priority: 'medium',
      assignee_id: IDS.bobUser,
      reporter_id: IDS.aliceUser,
      due_date: '2025-03-20',
      estimated_hours: 32,
      actual_hours: 30,
      sort_order: 3,
    },
    // Acme - API v3 tasks
    {
      id: IDS.task4,
      project_id: IDS.acmeProj2,
      milestone_id: IDS.ms3,
      title: 'Draft GraphQL schema',
      description: 'Design the initial GraphQL schema covering all v2 endpoints.',
      status: 'todo',
      priority: 'critical',
      assignee_id: IDS.aliceUser,
      reporter_id: IDS.aliceUser,
      due_date: '2025-03-25',
      estimated_hours: 16,
      sort_order: 1,
    },
    {
      id: IDS.task5,
      project_id: IDS.acmeProj2,
      title: 'Write migration guide for API consumers',
      description: 'Document breaking changes and provide migration examples.',
      status: 'todo',
      priority: 'medium',
      assignee_id: IDS.bobUser,
      reporter_id: IDS.aliceUser,
      due_date: '2025-05-01',
      estimated_hours: 12,
      sort_order: 2,
    },
    // Globex - Mobile App tasks
    {
      id: IDS.task6,
      project_id: IDS.globexProj1,
      milestone_id: IDS.ms4,
      title: 'Set up React Native project',
      description: 'Initialize the React Native project with TypeScript, navigation, and state management.',
      status: 'done',
      priority: 'high',
      assignee_id: IDS.daveUser,
      reporter_id: IDS.carolUser,
      due_date: '2025-02-01',
      estimated_hours: 16,
      actual_hours: 14,
      sort_order: 1,
    },
    {
      id: IDS.task7,
      project_id: IDS.globexProj1,
      milestone_id: IDS.ms5,
      title: 'Implement push notifications',
      description: 'Integrate Firebase Cloud Messaging for iOS and Android push notifications.',
      status: 'in_progress',
      priority: 'high',
      assignee_id: IDS.daveUser,
      reporter_id: IDS.carolUser,
      due_date: '2025-06-01',
      estimated_hours: 24,
      actual_hours: 8,
      sort_order: 2,
    },
    {
      id: IDS.task8,
      project_id: IDS.globexProj1,
      title: 'Design onboarding flow',
      description: 'Create onboarding screens with animations for first-time users.',
      status: 'todo',
      priority: 'medium',
      assignee_id: IDS.carolUser,
      reporter_id: IDS.carolUser,
      due_date: '2025-05-15',
      estimated_hours: 20,
      sort_order: 3,
    },
    // Globex - Marketing tasks
    {
      id: IDS.task9,
      project_id: IDS.globexProj2,
      milestone_id: IDS.ms6,
      title: 'Create social media content calendar',
      description: 'Plan 3 months of social media posts across all platforms.',
      status: 'in_progress',
      priority: 'high',
      assignee_id: IDS.daveUser,
      reporter_id: IDS.daveUser,
      due_date: '2025-04-10',
      estimated_hours: 10,
      actual_hours: 4,
      sort_order: 1,
    },
    {
      id: IDS.task10,
      project_id: IDS.globexProj2,
      title: 'Design email campaign templates',
      description: 'Build responsive HTML email templates for the product launch series.',
      status: 'cancelled',
      priority: 'low',
      assignee_id: IDS.carolUser,
      reporter_id: IDS.daveUser,
      due_date: '2025-04-25',
      estimated_hours: 8,
      sort_order: 2,
    },
  ]);

  // ── Subtasks ───────────────────────────────────────────────────────────
  await knex('tasks').insert([
    {
      id: IDS.subtask1,
      project_id: IDS.acmeProj1,
      parent_task_id: IDS.task2,
      title: 'Build sidebar component',
      status: 'done',
      priority: 'high',
      assignee_id: IDS.aliceUser,
      reporter_id: IDS.aliceUser,
      estimated_hours: 12,
      actual_hours: 10,
      sort_order: 1,
    },
    {
      id: IDS.subtask2,
      project_id: IDS.acmeProj1,
      parent_task_id: IDS.task2,
      title: 'Build top navigation bar',
      status: 'in_progress',
      priority: 'high',
      assignee_id: IDS.aliceUser,
      reporter_id: IDS.aliceUser,
      estimated_hours: 12,
      sort_order: 2,
    },
    {
      id: IDS.subtask3,
      project_id: IDS.globexProj1,
      parent_task_id: IDS.task7,
      title: 'Configure FCM for Android',
      status: 'done',
      priority: 'medium',
      assignee_id: IDS.daveUser,
      reporter_id: IDS.carolUser,
      estimated_hours: 8,
      actual_hours: 6,
      sort_order: 1,
    },
    {
      id: IDS.subtask4,
      project_id: IDS.globexProj1,
      parent_task_id: IDS.task7,
      title: 'Configure APNs for iOS',
      status: 'todo',
      priority: 'medium',
      assignee_id: IDS.daveUser,
      reporter_id: IDS.carolUser,
      estimated_hours: 8,
      sort_order: 2,
    },
  ]);

  // ── Task Watchers ──────────────────────────────────────────────────────
  await knex('task_watchers').insert([
    { task_id: IDS.task2, user_id: IDS.bobUser },
    { task_id: IDS.task4, user_id: IDS.bobUser },
    { task_id: IDS.task7, user_id: IDS.carolUser },
  ]);

  // ── Comments ───────────────────────────────────────────────────────────
  await knex('comments').insert([
    {
      id: IDS.comment1,
      task_id: IDS.task1,
      author_id: IDS.aliceUser,
      content: 'Great work on the wireframes! The dashboard layout looks clean and intuitive.',
    },
    {
      id: IDS.comment2,
      task_id: IDS.task1,
      author_id: IDS.bobUser,
      content: 'Thanks Alice! I incorporated the feedback from the stakeholder review.',
    },
    {
      id: IDS.comment3,
      task_id: IDS.task2,
      author_id: IDS.aliceUser,
      content: 'I\'m working on the sidebar collapse animation. Should be ready for review by EOD.',
    },
    {
      id: IDS.comment4,
      task_id: IDS.task7,
      author_id: IDS.carolUser,
      content: 'Make sure we handle notification permissions gracefully on both platforms.',
    },
    {
      id: IDS.comment5,
      task_id: IDS.task7,
      author_id: IDS.daveUser,
      content: 'Good point. I\'ll add a custom permissions prompt before the system dialog.',
      parent_comment_id: IDS.comment4,
    },
  ]);

  // ── Activity Log ───────────────────────────────────────────────────────
  await knex('activity_log').insert([
    {
      id: IDS.activity1,
      org_id: IDS.acmeOrg,
      project_id: IDS.acmeProj1,
      task_id: IDS.task1,
      actor_id: IDS.bobUser,
      action: 'task.status_changed',
      entity_type: 'task',
      entity_id: IDS.task1,
      changes: JSON.stringify({ status: { from: 'in_review', to: 'done' } }),
      metadata: JSON.stringify({ project_name: 'Platform Redesign' }),
    },
    {
      id: IDS.activity2,
      org_id: IDS.acmeOrg,
      project_id: IDS.acmeProj1,
      actor_id: IDS.aliceUser,
      action: 'project.created',
      entity_type: 'project',
      entity_id: IDS.acmeProj1,
      changes: JSON.stringify({}),
      metadata: JSON.stringify({ project_name: 'Platform Redesign' }),
    },
    {
      id: IDS.activity3,
      org_id: IDS.acmeOrg,
      project_id: IDS.acmeProj1,
      task_id: IDS.task2,
      actor_id: IDS.aliceUser,
      action: 'task.assigned',
      entity_type: 'task',
      entity_id: IDS.task2,
      changes: JSON.stringify({ assignee_id: { from: null, to: IDS.aliceUser } }),
    },
    {
      id: IDS.activity4,
      org_id: IDS.globexOrg,
      project_id: IDS.globexProj1,
      task_id: IDS.task6,
      actor_id: IDS.daveUser,
      action: 'task.status_changed',
      entity_type: 'task',
      entity_id: IDS.task6,
      changes: JSON.stringify({ status: { from: 'in_progress', to: 'done' } }),
    },
    {
      id: IDS.activity5,
      org_id: IDS.globexOrg,
      project_id: IDS.globexProj1,
      actor_id: IDS.carolUser,
      action: 'comment.created',
      entity_type: 'comment',
      entity_id: IDS.comment4,
      metadata: JSON.stringify({ task_id: IDS.task7, task_title: 'Implement push notifications' }),
    },
  ]);
}
