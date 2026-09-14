const TOKEN_KEY = 'registry_token';

// The backend's base URL. In development, Vite's dev-server proxy (see
// vite.config.ts) forwards /api requests to localhost:4000, so this can
// stay empty. In production (Vercel), set VITE_API_URL to your deployed
// backend's full URL (e.g. https://nyandarua-registry-backend.onrender.com)
// as an environment variable in the Vercel project settings — never commit
// a real backend URL into this file directly.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new ApiError(res.status, body?.error || res.statusText, body?.details);
  }
  return body as T;
}

// For multipart/form-data uploads (file attachments). Deliberately does
// NOT set Content-Type — the browser sets it automatically, including
// the multipart boundary string, which we can't generate ourselves.
// Setting it manually here would break the upload silently.
async function requestForm<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api${path}`, { method: 'POST', headers, body: formData });

  if (res.status === 401) clearToken();

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new ApiError(res.status, body?.error || res.statusText, body?.details);
  }
  return body as T;
}

export function attachmentDownloadUrl(noteId: number, attachmentId: number): string {
  const token = getToken();
  // Downloads are plain <a href> navigations, which can't carry an
  // Authorization header — so the token rides along as a query param
  // instead, and the backend accepts it from either place for this
  // one route. (See requireAuth in the backend for that fallback.)
  return `${API_BASE}/api/notes/${noteId}/attachments/${attachmentId}/download?token=${encodeURIComponent(token || '')}`;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  postForm: <T>(path: string, formData: FormData) => requestForm<T>(path, formData),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
