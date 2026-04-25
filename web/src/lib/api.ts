import type { Category, Location, LocationWithContent } from '../types';
import { getToken } from './auth';

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export const api = {
  listCategories: () => request<Category[]>('/api/categories'),
  listLocations: (params: { cat?: string; q?: string; includeDrafts?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.cat) qs.set('cat', params.cat);
    if (params.q) qs.set('q', params.q);
    if (params.includeDrafts) qs.set('includeDrafts', '1');
    const s = qs.toString();
    return request<Location[]>(`/api/locations${s ? `?${s}` : ''}`);
  },
  getLocation: (slug: string) => request<LocationWithContent>(`/api/locations/${slug}`),
  adminListLocations: () => request<Location[]>('/api/admin/locations'),
  adminCreateLocation: (body: { name: string; address: string; catId: string; subtitle?: string; lat?: number; lng?: number }) =>
    request<Location>('/api/admin/locations', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateLocation: (id: number, patch: Partial<{ status: 'draft' | 'published'; name: string; address: string; subtitle: string; lat: number; lng: number }>) =>
    request<Location>(`/api/admin/locations/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  login: (username: string, password: string) =>
    request<{ token: string; user: { id: number; username: string } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
};
