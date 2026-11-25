import { getDb } from '../config/database';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

export interface DeadLetterRecord {
  id: string;
  queue_name: string;
  job_id: string;
  job_name: string;
  org_id: string | null;
  payload: Record<string, unknown>;
  error_message: string;
  stack_trace: string | null;
  attempts_made: number;
  status: 'failed' | 'retried' | 'resolved' | 'discarded';
  retried_at: string | null;
  resolved_at: string | null;
  failed_at: string;
}

export const deadLetterHandler = {
  async recordFailure(params: {
    queueName: string;
    jobId: string;
    jobName: string;
    orgId?: string | null;
    payload: Record<string, unknown>;
    error: Error;
    attemptsMade: number;
  }): Promise<DeadLetterRecord> {
    metrics.recordJobFailed();
    logger.error('Moving failed job to dead-letter table', {
      queueName: params.queueName,
      jobId: params.jobId,
      jobName: params.jobName,
      attemptsMade: params.attemptsMade,
      error: params.error.message,
    });

    const [row] = await getDb()('dead_letter_jobs')
      .insert({
        queue_name: params.queueName,
        job_id: params.jobId,
        job_name: params.jobName,
        org_id: params.orgId || null,
        payload: JSON.stringify(params.payload),
        error_message: params.error.message,
        stack_trace: params.error.stack || null,
        attempts_made: params.attemptsMade,
        status: 'failed',
      })
      .returning('*');

    return row as DeadLetterRecord;
  },

  async listDeadLetterJobs(orgId?: string, statusFilter?: string) {
    const query = getDb()('dead_letter_jobs').orderBy('failed_at', 'desc').limit(100);
    if (orgId) query.where({ org_id: orgId });
    if (statusFilter) query.where({ status: statusFilter });
    return query;
  },

  async markRetried(id: string, orgId?: string): Promise<DeadLetterRecord | undefined> {
    const query = getDb()('dead_letter_jobs').where({ id });
    if (orgId) query.andWhere({ org_id: orgId });
    const [row] = await query
      .update({ status: 'retried', retried_at: getDb().fn.now() })
      .returning('*');
    return row as DeadLetterRecord | undefined;
  },

  async markResolved(id: string): Promise<DeadLetterRecord | undefined> {
    const [row] = await getDb()('dead_letter_jobs')
      .where({ id })
      .update({ status: 'resolved', resolved_at: getDb().fn.now() })
      .returning('*');
    return row as DeadLetterRecord | undefined;
  },
};
