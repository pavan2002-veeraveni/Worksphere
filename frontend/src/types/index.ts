// ─── User & Auth ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isPlatformAdmin: boolean;
  isActive: boolean;
  organizations?: UserOrgMembership[];
}

export interface UserOrgMembership {
  id: string;
  name: string;
  slug: string;
  plan: OrgPlan;
  role: OrgRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ─── Organization ───────────────────────────────────────────────────────────

export type OrgPlan = 'free' | 'starter' | 'professional' | 'enterprise';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: OrgPlan;
  logoUrl: string | null;
  settings: Record<string, unknown>;
}

export type OrgRole = 'owner' | 'project_manager' | 'team_member' | 'auditor';

export interface OrganizationMember {
  id: string;
  org_id?: string;
  orgId?: string;
  user_id?: string;
  userId?: string;
  role: OrgRole;
  email?: string;
  first_name?: string;
  last_name?: string;
  user?: User;
  joined_at?: string;
  joinedAt?: string;
}

// ─── Project ────────────────────────────────────────────────────────────────

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface Project {
  id: string;
  org_id?: string;
  orgId?: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: Priority;
  start_date?: string | null;
  startDate?: string | null;
  end_date?: string | null;
  endDate?: string | null;
  created_by?: string;
  createdBy?: string;
  team_id?: string | null;
  teamId?: string | null;
  settings: Record<string, unknown>;
  version: number;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

// ─── Milestone ──────────────────────────────────────────────────────────────

export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';

export interface Milestone {
  id: string;
  project_id?: string;
  projectId?: string;
  name: string;
  description: string | null;
  due_date?: string | null;
  dueDate?: string | null;
  status: MilestoneStatus;
  sort_order?: number;
  sortOrder?: number;
}

// ─── Task ───────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';

export interface Task {
  id: string;
  project_id?: string;
  projectId?: string;
  milestone_id?: string | null;
  milestoneId?: string | null;
  parent_task_id?: string | null;
  parentTaskId?: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  assignee_id?: string | null;
  assigneeId?: string | null;
  reporter_id?: string;
  reporterId?: string;
  due_date?: string | null;
  dueDate?: string | null;
  estimated_hours?: number | null;
  estimatedHours?: number | null;
  actual_hours?: number | null;
  actualHours?: number | null;
  sort_order?: number;
  sortOrder?: number;
  version: number;
  assignee?: User;
  reporter?: User;
  subtasks?: Task[];
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

// ─── Comment ────────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  task_id?: string;
  taskId?: string;
  author_id?: string;
  authorId?: string;
  content: string;
  parent_comment_id?: string | null;
  parentCommentId?: string | null;
  is_edited?: boolean;
  isEdited?: boolean;
  first_name?: string;
  last_name?: string;
  email?: string;
  author?: User;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

// ─── Attachment ─────────────────────────────────────────────────────────────

export interface Attachment {
  id: string;
  task_id?: string | null;
  taskId?: string | null;
  file_name?: string;
  fileName?: string;
  file_size?: number;
  fileSize?: number;
  mime_type?: string;
  mimeType?: string;
  storage_key?: string;
  storageKey?: string;
  created_at?: string;
}

// ─── Notification ───────────────────────────────────────────────────────────

export type NotificationType =
  | 'task_assigned'
  | 'task_updated'
  | 'comment_added'
  | 'mention'
  | 'deadline_approaching'
  | 'project_updated'
  | 'member_invited';

export interface Notification {
  id: string;
  org_id?: string;
  user_id?: string;
  type: NotificationType | string;
  title: string;
  message: string;
  link: string | null;
  is_read?: boolean;
  isRead?: boolean;
  metadata: Record<string, unknown>;
  created_at?: string;
  createdAt?: string;
}

// ─── Team ───────────────────────────────────────────────────────────────────

export type TeamRole = 'lead' | 'member';

export interface Team {
  id: string;
  org_id?: string;
  name: string;
  description: string | null;
  members?: TeamMember[];
}

export interface TeamMember {
  id: string;
  team_id?: string;
  user_id?: string;
  role: TeamRole;
  first_name?: string;
  last_name?: string;
  email?: string;
  user?: User;
}

// ─── Activity ───────────────────────────────────────────────────────────────

export interface ActivityEntry {
  id: string;
  org_id?: string;
  project_id?: string | null;
  task_id?: string | null;
  actor_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  changes: Record<string, unknown>;
  metadata: Record<string, unknown>;
  actor_first_name?: string;
  actor_last_name?: string;
  actor_email?: string;
  created_at?: string;
  createdAt?: string;
}

// ─── Workflow ───────────────────────────────────────────────────────────────

export interface WorkflowRule {
  id: string;
  org_id?: string;
  project_id?: string | null;
  name: string;
  description: string | null;
  trigger_event?: string;
  triggerEvent?: string;
  conditions: Array<{ field: string; operator: string; value?: unknown }>;
  actions: Array<{ type: string; params: Record<string, unknown> }>;
  is_active?: boolean;
  isActive?: boolean;
  created_at?: string;
}

// ─── Audit ──────────────────────────────────────────────────────────────────

export interface AuditEvent {
  id: string;
  org_id?: string;
  actor_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  ip_address?: string | null;
  request_id?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  actor_first_name?: string;
  actor_last_name?: string;
  actor_email?: string;
  created_at?: string;
}

// ─── API Response ───────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: PaginationMeta;
  error?: ApiError;
  requestId?: string;
}
