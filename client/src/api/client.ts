import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { getCookie } from '@/lib/utils';

const baseURL = import.meta.env.VITE_API_URL || '';

export const api: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
});

// Attach CSRF token from cookie on mutating requests.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? 'get').toLowerCase();
  if (method !== 'get' && method !== 'head' && method !== 'options') {
    const token = getCookie('csv_csrf');
    if (token) {
      config.headers.set('X-CSRF-Token', token);
    }
  }
  return config;
});

// 401-refresh interceptor: try once, then redirect to login.
let refreshPromise: Promise<void> | null = null;

async function performRefresh(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/api/auth/refresh')
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

interface RetryConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

api.interceptors.response.use(
  (resp) => resp,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    if (!original || original._retried) {
      return Promise.reject(error);
    }
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }
    // Don't try to refresh on the refresh endpoint itself.
    if (original.url?.includes('/auth/refresh') || original.url?.includes('/auth/login')) {
      return Promise.reject(error);
    }
    try {
      await performRefresh();
      original._retried = true;
      return api.request(original);
    } catch {
      // Refresh failed — bubble the original error.
      return Promise.reject(error);
    }
  },
);
