const startTime = Date.now();

interface MetricsState {
  httpRequestsTotal: number;
  httpErrorsTotal: number;
  conflictsDetectedTotal: number;
  jobsProcessedTotal: number;
  jobsFailedTotal: number;
  statusCodes: Record<string, number>;
}

const state: MetricsState = {
  httpRequestsTotal: 0,
  httpErrorsTotal: 0,
  conflictsDetectedTotal: 0,
  jobsProcessedTotal: 0,
  jobsFailedTotal: 0,
  statusCodes: {},
};

export const metrics = {
  recordRequest(statusCode: number): void {
    state.httpRequestsTotal += 1;
    const key = String(statusCode);
    state.statusCodes[key] = (state.statusCodes[key] || 0) + 1;
    if (statusCode >= 500) state.httpErrorsTotal += 1;
    if (statusCode === 409) state.conflictsDetectedTotal += 1;
  },
  recordJobProcessed(): void {
    state.jobsProcessedTotal += 1;
  },
  recordJobFailed(): void {
    state.jobsFailedTotal += 1;
  },
  snapshot() {
    return {
      uptimeSeconds: Math.round((Date.now() - startTime) / 1000),
      ...state,
    };
  },
  toPrometheus(): string {
    return [
      '# HELP worksphere_http_requests_total Total HTTP requests handled',
      '# TYPE worksphere_http_requests_total counter',
      `worksphere_http_requests_total ${state.httpRequestsTotal}`,
      '# HELP worksphere_http_errors_total Total HTTP 5xx responses',
      '# TYPE worksphere_http_errors_total counter',
      `worksphere_http_errors_total ${state.httpErrorsTotal}`,
      '# HELP worksphere_optimistic_lock_conflicts_total Total optimistic locking 409 conflicts',
      '# TYPE worksphere_optimistic_lock_conflicts_total counter',
      `worksphere_optimistic_lock_conflicts_total ${state.conflictsDetectedTotal}`,
      '# HELP worksphere_jobs_processed_total Total background jobs processed',
      '# TYPE worksphere_jobs_processed_total counter',
      `worksphere_jobs_processed_total ${state.jobsProcessedTotal}`,
      '# HELP worksphere_jobs_failed_total Total background jobs failed',
      '# TYPE worksphere_jobs_failed_total counter',
      `worksphere_jobs_failed_total ${state.jobsFailedTotal}`,
    ].join('\n');
  },
};
