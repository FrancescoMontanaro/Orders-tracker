import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getAccessToken, setAccessToken } from './token';

export interface TokenResponse {
  access_token: string;
  refresh_token: string; // server sets httpOnly cookie for refresh
  token_type?: 'bearer';
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// Main API instance with credentials for cookies
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send cookies (refresh_token)
});

// Attach Authorization header if access token exists
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Refresh logic for expired tokens
let isRefreshing = false;
let pendingQueue: { resolve: (value: unknown) => void; reject: (reason?: any) => void; config: InternalAxiosRequestConfig }[] = [];

/**
 * Queue requests while token is refreshing
 */
function enqueueRequest(config: InternalAxiosRequestConfig) {
  return new Promise((resolve, reject) => {
    pendingQueue.push({ resolve, reject, config });
  }) as Promise<any>;
}

/**
 * Retry queued requests after refresh
 */
function flushQueue(error: any, token: string | null) {
  pendingQueue.forEach(({ resolve, reject, config }) => {
    if (error) return reject(error);
    if (token) {
      config.headers = config.headers || {};
      (config.headers as any)['Authorization'] = `Bearer ${token}`;
    }
    resolve(api(config));
  });
  pendingQueue = [];
}

// Intercept 401 responses and attempt token refresh
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original?._retry) {
      if (isRefreshing) {
        return enqueueRequest(original);
      }

      original._retry = true;
      isRefreshing = true;

      try {
        // Attempt refresh. Backend should read refresh_token from httpOnly cookie.
        const { data } = await axios.post<TokenResponse>(`${API_BASE_URL}/auth/refresh`, null, {
          withCredentials: true,
        });

        setAccessToken(data.access_token);
        flushQueue(null, data.access_token);
        return api(original);
      } catch (refreshErr) {
        setAccessToken(null);
        flushQueue(refreshErr, null);
        // let the caller handle redirect to login
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Authless API instance for endpoints that don't require Authorization header
export const authlessApi: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});