import { getDb } from '../config/database';
import { enqueueJob, QUEUE_NAMES } from '../jobs/queue';
import { generateIdempotencyKey } from '../utils/idempotency';
import { emitToUser } from '../websocket/socketManager';

export const notificationService = {
  async create(input: {
    orgId: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    metadata?: Record<string, unknown>;
    idempotencyKey?: string;
  }) {
    const db = getDb();
    const [notification] = await db('notifications')
      .insert({
        org_id: input.orgId,
        user_id: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link || null,
        metadata: JSON.stringify(input.metadata || {}),
      })
      .returning('*');

    emitToUser(input.userId, 'notification:new', notification);
    return notification;
  },

  async enqueueIdempotentNotification(input: {
    idempotencyParts: Array<string | number>;
    orgId: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    metadata?: Record<string, unknown>;
    sendEmail?: boolean;
    recipientEmail?: string;
  }) {
    const idempotencyKey = generateIdempotencyKey('notif', ...input.idempotencyParts);
    const queued = await enqueueJob(
      QUEUE_NAMES.NOTIFICATION,
      input.type,
      {
        idempotencyKey,
        orgId: input.orgId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
        metadata: input.metadata,
        sendEmail: input.sendEmail,
        recipientEmail: input.recipientEmail,
      },
      { jobId: idempotencyKey },
    );

    if (!queued.queued) {
      // Direct synchronous fallback if Redis/BullMQ is disabled, still respecting idempotency
      await dbInsertIdempotentNotification(idempotencyKey, input);
    }
  },

  async getUserNotifications(userId: string, orgId: string, limit: number, offset: number) {
    const db = getDb();
    const baseQuery = db('notifications').where({ user_id: userId, org_id: orgId });
    const countRow = await baseQuery.clone().count<{ count: string }[]>('* as count').first();
    const rows = await baseQuery
      .clone()
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return { rows, total: Number(countRow?.count || 0) };
  },

  async getUnreadCount(userId: string, orgId: string): Promise<number> {
    const row = await getDb()('notifications')
      .where({ user_id: userId, org_id: orgId, is_read: false })
      .count<{ count: string }[]>('* as count')
      .first();
    return Number(row?.count || 0);
  },

  async markAsRead(userId: string, orgId: string, notificationId: string) {
    const [updated] = await getDb()('notifications')
      .where({ id: notificationId, user_id: userId, org_id: orgId })
      .update({ is_read: true })
      .returning('*');
    return updated;
  },

  async markAllAsRead(userId: string, orgId: string) {
    return getDb()('notifications')
      .where({ user_id: userId, org_id: orgId, is_read: false })
      .update({ is_read: true });
  },
};

async function dbInsertIdempotentNotification(
  idempotencyKey: string,
  input: {
    orgId: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const db = getDb();
  const inserted = await db('processed_events')
    .insert({
      event_id: idempotencyKey,
      event_type: `notification:${input.type}`,
      result: JSON.stringify({ mode: 'sync-fallback' }),
    })
    .onConflict('event_id')
    .ignore()
    .returning('id');

  if (inserted.length === 0) return;

  await notificationService.create(input);
}
