import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorBody, AuthResponse } from '@slog/shared';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: Array<{ path: string; code: string; message: string }> = [],
  ) {
    super(message);
  }
}

/**
 * The access token lives only in memory, never in localStorage: a page reload
 * obtains a new one through the httpOnly refresh cookie.
 */
let accessToken: string | null = null;
let refreshing: Promise<AuthResponse> | null = null;
const sessionListeners = new Set<(auth: AuthResponse | null) => void>();

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function onSessionChange(listener: (auth: AuthResponse | null) => void) {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

export const http = axios.create({ baseURL: '/api', withCredentials: true, timeout: 20000 });

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`);
  return config;
});

export function refreshSession(): Promise<AuthResponse> {
  refreshing ??= axios
    .post<AuthResponse>('/api/auth/refresh', null, { withCredentials: true, headers: { 'X-Requested-With': 'slog' } })
    .then((res) => {
      setAccessToken(res.data.accessToken);
      sessionListeners.forEach((l) => l(res.data));
      return res.data;
    })
    .catch((err) => {
      setAccessToken(null);
      sessionListeners.forEach((l) => l(null));
      throw toApiError(err);
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const axiosError = err as AxiosError<ApiErrorBody>;
  const body = axiosError.response?.data;
  if (body?.error) return new ApiError(axiosError.response!.status, body.error.code, body.error.message, body.error.details);
  if (axiosError.response) return new ApiError(axiosError.response.status, 'internal', axiosError.message);
  return new ApiError(0, 'network', axiosError.message ?? 'Network error');
}

http.interceptors.response.use(undefined, async (err: AxiosError<ApiErrorBody>) => {
  const original = err.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  const code = err.response?.data?.error?.code;
  const isAuthCall = original?.url?.startsWith('/auth/');
  if (err.response?.status === 401 && original && !original._retried && !isAuthCall && (code === 'token_expired' || code === 'unauthorized')) {
    original._retried = true;
    await refreshSession();
    return http(original);
  }
  throw toApiError(err);
});

export async function api<T>(config: AxiosRequestConfig): Promise<T> {
  const res = await http.request<T>(config);
  return res.data;
}
