import { config } from '../config';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

async function callAnalytics<T>(path: string, init?: RequestInit): Promise<T> {
  let lastError: Error | null = null;
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.analytics.timeoutMs);
    try {
      const response = await fetch(`${config.analytics.url}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.analytics.apiKey,
          ...(init?.headers || {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ detail: response.statusText }));
        if (response.status >= 400 && response.status < 500) {
          throw new ApiError(response.status, 'ANALYTICS_ERROR', body.detail || 'Analytics error');
        }
        throw new Error(`Analytics service returned HTTP ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      lastError = err as Error;
      logger.warn('Analytics service call failed', { path, attempt, error: lastError.message });
    } finally {
      clearTimeout(timer);
    }
  }

  throw ApiError.serviceUnavailable('Analytics service is currently unavailable', {
    reason: lastError?.message,
  });
}

export const analyticsProxyService = {
  getSummary(orgId: string) {
    return callAnalytics(`/api/v1/analytics/summary?org_id=${encodeURIComponent(orgId)}`);
  },

  getWorkload(orgId: string) {
    return callAnalytics(`/api/v1/analytics/workload?org_id=${encodeURIComponent(orgId)}`);
  },

  getProjectHealth(orgId: string, projectId: string) {
    return callAnalytics(
      `/api/v1/analytics/projects/${encodeURIComponent(projectId)}/health?org_id=${encodeURIComponent(orgId)}`,
    );
  },

  getCycleTime(orgId: string, projectId: string) {
    return callAnalytics(
      `/api/v1/analytics/projects/${encodeURIComponent(projectId)}/cycle-time?org_id=${encodeURIComponent(orgId)}`,
    );
  },

  getDeliveryMetrics(orgId: string, projectId: string, startDate?: string, endDate?: string) {
    const qs = new URLSearchParams({ org_id: orgId });
    if (startDate) qs.set('start_date', startDate);
    if (endDate) qs.set('end_date', endDate);
    return callAnalytics(
      `/api/v1/analytics/projects/${encodeURIComponent(projectId)}/delivery?${qs.toString()}`,
    );
  },
};
