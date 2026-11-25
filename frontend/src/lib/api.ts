import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse, AuthTokens } from '@/types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('auth_tokens');
      if (raw) {
        try {
          const tokens: AuthTokens = JSON.parse(raw);
          config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        } catch {
          // ignore malformed storage
        }
      }
      const orgId = localStorage.getItem('current_org_id');
      if (orgId && !config.headers['X-Org-ID']) {
        config.headers['X-Org-ID'] = orgId;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

let isRefreshing = false;
let failedQueue: {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}[] = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(token!);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const raw = localStorage.getItem('auth_tokens');
        if (!raw) throw new Error('No tokens');
        const tokens: AuthTokens = JSON.parse(raw);

        const { data } = await axios.post<ApiResponse<AuthTokens>>(
          `${API_BASE_URL}/auth/refresh-token`,
          { refreshToken: tokens.refreshToken },
        );

        if (data.success && data.data) {
          localStorage.setItem('auth_tokens', JSON.stringify(data.data));
          api.defaults.headers.common.Authorization = `Bearer ${data.data.accessToken}`;
          originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
          processQueue(null, data.data.accessToken);
          return api(originalRequest);
        }

        throw new Error('Refresh failed');
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('auth_tokens');
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export async function get<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
  const response = await api.get<ApiResponse<T>>(url, { params });
  return response.data;
}

export async function post<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
  const response = await api.post<ApiResponse<T>>(url, body);
  return response.data;
}

export async function put<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
  const response = await api.put<ApiResponse<T>>(url, body);
  return response.data;
}

export async function del<T>(url: string): Promise<ApiResponse<T>> {
  const response = await api.delete<ApiResponse<T>>(url);
  return response.data;
}

export default api;
