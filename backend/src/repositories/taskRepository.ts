import { Knex } from 'knex';
import { getDb } from '../config/database';
import { withOptimisticLock } from '../utils/optimisticLock';

export interface TaskRecord extends Record<string, unknown> {
  id: string;
  project_id: string;
  milestone_id?: string | null;
  parent_task_id?: string | null;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  assignee_id?: string | null;
  reporter_id: string;
  due_date?: string | null;
  estimated_hours?: number | null;
  actual_hours?: number | null;
  sort_order?: number;
  version: number;
  created_at?: string;
  updated_at?: string;
}

export interface TaskFilters {
  projectId?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  search?: string;
}

export const taskRepository = {
  db(): Knex {
    return getDb();
  },

  async findByOrg(orgId: string, filters: TaskFilters, limit: number, offset: number) {
    const baseQuery = this.db()('tasks as t')
      .join('projects as p', 'p.id', 't.project_id')
      .where('p.org_id', orgId);

    if (filters.projectId) baseQuery.andWhere('t.project_id', filters.projectId);
    if (filters.status) baseQuery.andWhere('t.status', filters.status);
    if (filters.priority) baseQuery.andWhere('t.priority', filters.priority);
    if (filters.assigneeId) baseQuery.andWhere('t.assignee_id', filters.assigneeId);
    if (filters.search) {
      baseQuery.andWhere((qb) => {
        qb.whereILike('t.title', `%${filters.search}%`).orWhereILike('t.description', `%${filters.search}%`);
      });
    }

    const countRow = await baseQuery.clone().count<{ count: string }[]>('t.id as count').first();
    const rows = await baseQuery
      .clone()
      .select('t.*', 'p.org_id')
      .orderBy('t.sort_order', 'asc')
      .orderBy('t.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return { rows, total: Number(countRow?.count || 0) };
  },

  async findByIdInOrg(orgId: string, taskId: string, trx?: Knex.Transaction) {
    const query = (trx || this.db())('tasks as t')
      .join('projects as p', 'p.id', 't.project_id')
      .where({ 't.id': taskId, 'p.org_id': orgId })
      .select('t.*', 'p.org_id')
      .first();
    return query;
  },

  async create(trx: Knex.Transaction, userId: string, data: Record<string, unknown>) {
    const [created] = await trx('tasks')
      .insert({
        project_id: data.projectId,
        milestone_id: data.milestoneId ?? null,
        parent_task_id: data.parentTaskId ?? null,
        title: data.title,
        description: data.description ?? null,
        status: data.status ?? 'todo',
        priority: data.priority ?? 'medium',
        assignee_id: data.assigneeId ?? null,
        reporter_id: userId,
        due_date: data.dueDate ?? null,
        estimated_hours: data.estimatedHours ?? null,
        actual_hours: data.actualHours ?? null,
        sort_order: data.sortOrder ?? 0,
      })
      .returning('*');
    return created;
  },

  async updateWithLock(
    trx: Knex.Transaction,
    taskId: string,
    version: number,
    data: Record<string, unknown>,
  ): Promise<TaskRecord> {
    const mapped: Record<string, unknown> = {};
    if (data.milestoneId !== undefined) mapped.milestone_id = data.milestoneId;
    if (data.title !== undefined) mapped.title = data.title;
    if (data.description !== undefined) mapped.description = data.description;
    if (data.status !== undefined) mapped.status = data.status;
    if (data.priority !== undefined) mapped.priority = data.priority;
    if (data.assigneeId !== undefined) mapped.assignee_id = data.assigneeId;
    if (data.dueDate !== undefined) mapped.due_date = data.dueDate;
    if (data.estimatedHours !== undefined) mapped.estimated_hours = data.estimatedHours;
    if (data.actualHours !== undefined) mapped.actual_hours = data.actualHours;
    if (data.sortOrder !== undefined) mapped.sort_order = data.sortOrder;

    return withOptimisticLock<TaskRecord>(trx, 'tasks', taskId, version, mapped);
  },

  async delete(orgId: string, taskId: string): Promise<boolean> {
    const task = await this.findByIdInOrg(orgId, taskId);
    if (!task) return false;
    const count = await this.db()('tasks').where({ id: taskId }).del();
    return count > 0;
  },

  async findSubtasks(taskId: string) {
    return this.db()('tasks').where({ parent_task_id: taskId }).orderBy('sort_order', 'asc');
  },

  async findComments(taskId: string, limit: number, offset: number) {
    const rows = await this.db()('comments as c')
      .join('users as u', 'u.id', 'c.author_id')
      .where('c.task_id', taskId)
      .select('c.*', 'u.first_name', 'u.last_name', 'u.email', 'u.avatar_url')
      .orderBy('c.created_at', 'asc')
      .limit(limit)
      .offset(offset);

    const countRow = await this.db()('comments')
      .where({ task_id: taskId })
      .count<{ count: string }[]>('* as count')
      .first();

    return { rows, total: Number(countRow?.count || 0) };
  },

  async createComment(taskId: string, authorId: string, content: string, parentCommentId?: string | null) {
    const [row] = await this.db()('comments')
      .insert({
        task_id: taskId,
        author_id: authorId,
        content,
        parent_comment_id: parentCommentId ?? null,
      })
      .returning('*');
    return row;
  },

  async updateComment(taskId: string, commentId: string, authorId: string, content: string) {
    const [row] = await this.db()('comments')
      .where({ id: commentId, task_id: taskId, author_id: authorId })
      .update({ content, is_edited: true, updated_at: this.db().fn.now() })
      .returning('*');
    return row;
  },

  async deleteComment(taskId: string, commentId: string) {
    const count = await this.db()('comments').where({ id: commentId, task_id: taskId }).del();
    return count > 0;
  },

  async addAttachment(data: {
    taskId?: string | null;
    commentId?: string | null;
    uploadedBy: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    storageKey: string;
  }) {
    const [row] = await this.db()('attachments')
      .insert({
        task_id: data.taskId ?? null,
        comment_id: data.commentId ?? null,
        uploaded_by: data.uploadedBy,
        file_name: data.fileName,
        file_size: data.fileSize,
        mime_type: data.mimeType,
        storage_key: data.storageKey,
      })
      .returning('*');
    return row;
  },

  async findAttachments(taskId: string) {
    return this.db()('attachments').where({ task_id: taskId }).orderBy('created_at', 'desc');
  },

  async findWatchers(taskId: string) {
    return this.db()('task_watchers as tw')
      .join('users as u', 'u.id', 'tw.user_id')
      .where('tw.task_id', taskId)
      .select('u.id', 'u.email', 'u.first_name', 'u.last_name');
  },

  async addWatcher(taskId: string, userId: string) {
    await this.db()('task_watchers')
      .insert({ task_id: taskId, user_id: userId })
      .onConflict(['task_id', 'user_id'])
      .ignore();
  },

  async removeWatcher(taskId: string, userId: string) {
    await this.db()('task_watchers').where({ task_id: taskId, user_id: userId }).del();
  },
};
