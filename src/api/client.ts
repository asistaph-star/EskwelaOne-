/**
 * Base API Client for DigiSkwela Backend
 * 
 * Automatically attaches the authentication JWT to all requests.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

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
      window.dispatchEvent(new CustomEvent('api_unauthorized'));
    }
    throw new ApiError(
      response.status,
      data?.error?.code || 'UNKNOWN_ERROR',
      data?.error?.message || 'An unexpected error occurred.'
    );
  }

  return data.data as T;
}

export const apiClient = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body: any) => request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(endpoint: string, body: any) => request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
