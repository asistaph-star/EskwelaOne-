/**
 * Base API Client for DigiSkwela Backend
 * 
 * Automatically attaches the authentication JWT to all requests.
 */

export const API_BASE_URL = (typeof window !== 'undefined' && (window as any).__API_BASE_URL__) || import.meta.env.VITE_API_URL || (import.meta.env.VITE_BACKEND_URL ? `${import.meta.env.VITE_BACKEND_URL}/api` : 'http://localhost:4001/api');
export const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export function resolveBackendUrl(urlOrPath: string): string {
  if (!urlOrPath) return '';
  if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath;
  return `${BACKEND_ORIGIN}${urlOrPath.startsWith('/') ? '' : '/'}${urlOrPath}`;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 409) {
      window.dispatchEvent(new CustomEvent('api_conflict', { detail: { endpoint } }));
    }
    if (response.status === 401) {
      // Professional session management:
      // A 401 during secondary verification/sudo-mode (such as entering a confirmation password)
      // must NOT terminate the user's active session.
      // Only true session-level authentication failures (e.g., token expired/missing) trigger global logout.
      const isPasswordMismatch =
        data?.error?.message?.toLowerCase().includes('password') ||
        data?.error?.code === 'INVALID_PASSWORD' ||
        data?.error?.code === 'INVALID_ADMIN_PASSWORD';

      if (!isPasswordMismatch) {
        window.dispatchEvent(new CustomEvent('api_unauthorized'));
      }
    }
    throw new ApiError(
      response.status,
      data?.error?.code || data?.code || 'UNKNOWN_ERROR',
      data?.message || data?.error?.message || 'An unexpected error occurred.'
    );
  }

  return (data?.data !== undefined ? data.data : data) as T;
}

export const apiClient = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: any) => request<T>(endpoint, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(endpoint: string, body?: any) => request<T>(endpoint, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(endpoint: string, body?: any) => request<T>(endpoint, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
  postFormData: <T>(endpoint: string, body: FormData) => request<T>(endpoint, { method: 'POST', body }),
};
