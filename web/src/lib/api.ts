import type {
  AdminUserRow,
  AvailabilityRow,
  Category,
  CityEvent,
  CommentAuthor,
  CommentNode,
  EventStatus,
  FavoriteRow,
  FloorPlanLayout,
  Location,
  LocationEvent,
  LocationWithContent,
  MyComment,
  MyReservation,
  MyServiceRequest,
  OwnerReservation,
  OwnerServiceRequest,
  RecentComment,
  ReservationPayload,
  ServiceRequestQuote,
} from '../types';
import { getToken, type Role } from './auth';

export interface CurrentUser {
  id: number;
  // Null for guest accounts (they have no email until they upgrade).
  email: string | null;
  displayName: string;
  role: Role;
  emailVerifiedAt: string | null;
  ownedLocationIds: number[];
}

export interface AuthResponse {
  token: string;
  user: { id: number; email: string | null; displayName: string; role: Role };
}

export interface RegisterResponse {
  ok: true;
  email: string;
  message: string;
}

export interface AppSettings {
  registrationEnabled: boolean;
  guestsCanBook: boolean;
}

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

// Sibling of `request` for multipart uploads — must NOT set Content-Type
// (the browser sets it with the correct boundary).
async function uploadRequest<T>(url: string, formData: FormData): Promise<T> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(url, { method: 'POST', body: formData, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export function mediaUrl(id: number): string {
  return `/api/media/${id}`;
}

export const api = {
  listCategories: () => request<Category[]>('/api/categories'),
  listLocations: (
    params: {
      cat?: string;
      q?: string;
      includeDrafts?: boolean;
      sort?: 'recent' | 'popular';
      limit?: number;
    } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.cat) qs.set('cat', params.cat);
    if (params.q) qs.set('q', params.q);
    if (params.includeDrafts) qs.set('includeDrafts', '1');
    if (params.sort) qs.set('sort', params.sort);
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    const s = qs.toString();
    return request<Location[]>(`/api/locations${s ? `?${s}` : ''}`);
  },
  recentComments: (params: { limit?: number; cat?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.cat) qs.set('cat', params.cat);
    const s = qs.toString();
    return request<RecentComment[]>(`/api/comments/recent${s ? `?${s}` : ''}`);
  },
  getLocation: (slug: string) => request<LocationWithContent>(`/api/locations/${slug}`),
  adminListLocations: () => request<Location[]>('/api/admin/locations'),
  adminCreateLocation: (body: { name: string; address: string; catId: string; subtitle?: string; lat?: number; lng?: number; status?: 'draft' | 'published' }) =>
    request<Location>('/api/admin/locations', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateLocation: (
    id: number,
    patch: Partial<{
      status: 'draft' | 'published';
      name: string;
      address: string;
      subtitle: string;
      lat: number;
      lng: number;
      content: unknown;
    }>,
  ) =>
    request<Location>(`/api/admin/locations/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  adminDeleteLocation: (id: number) =>
    request<{ ok: true; id: number }>(`/api/admin/locations/${id}`, { method: 'DELETE' }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, displayName: string) =>
    request<RegisterResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    }),
  verifyEmail: (token: string) =>
    request<AuthResponse>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  resendVerification: (email: string) =>
    request<{ ok: true; message: string }>('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  getMe: () => request<CurrentUser>('/api/me'),
  updateMe: (patch: { displayName: string }) =>
    request<{ id: number; email: string | null; displayName: string; role: Role }>('/api/me', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  guestSignup: (displayName: string) =>
    request<AuthResponse>('/api/auth/guest', {
      method: 'POST',
      body: JSON.stringify({ displayName }),
    }),
  upgradeGuest: (email: string, password: string) =>
    request<RegisterResponse>('/api/auth/upgrade', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  favorite: (slug: string) =>
    request<{ favorited: true }>(`/api/locations/${slug}/favorite`, { method: 'POST' }),
  unfavorite: (slug: string) =>
    request<{ favorited: false }>(`/api/locations/${slug}/favorite`, { method: 'DELETE' }),
  myFavorites: () => request<FavoriteRow[]>('/api/me/favorites'),
  listComments: (slug: string) => request<CommentNode[]>(`/api/locations/${slug}/comments`),
  postComment: (slug: string, body: { body: string; rating?: number; parentId?: number }) =>
    request<{
      id: number;
      body: string;
      rating: number | null;
      parentId: number | null;
      createdAt: string;
      author: CommentAuthor;
    }>(`/api/locations/${slug}/comments`, { method: 'POST', body: JSON.stringify(body) }),
  myComments: () => request<MyComment[]>('/api/me/comments'),
  checkin: (slug: string) =>
    request<{ id: number; createdAt: string }>(`/api/locations/${slug}/checkin`, { method: 'POST' }),

  // Reservations — visitor side
  createReservation: (slug: string, payload: ReservationPayload) =>
    request<MyReservation>(`/api/locations/${slug}/reservations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  myReservations: () => request<MyReservation[]>('/api/me/reservations'),
  cancelReservation: (id: number) =>
    request<MyReservation>(`/api/me/reservations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled' }),
    }),
  availability: (slug: string, from: string, to: string) =>
    request<AvailabilityRow[]>(
      `/api/locations/${slug}/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),

  // Owner side
  ownerLocations: () => request<Location[]>('/api/owner/locations'),
  ownerReservations: (params: { status?: string; locationId?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.locationId) qs.set('locationId', String(params.locationId));
    const s = qs.toString();
    return request<OwnerReservation[]>(`/api/owner/reservations${s ? `?${s}` : ''}`);
  },
  ownerDecideReservation: (id: number, status: 'approved' | 'declined') =>
    request<OwnerReservation>(`/api/owner/reservations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  ownerUpdateLocation: (
    id: number,
    patch: Partial<{ name: string; subtitle: string; address: string; content: unknown }>,
  ) =>
    request<Location>(`/api/owner/locations/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  ownerComments: () =>
    request<{
      id: number;
      body: string;
      rating: number | null;
      createdAt: string;
      parentId: number | null;
      locationId: number;
      locationSlug: string;
      locationName: string;
      authorId: number;
      authorName: string;
    }[]>('/api/owner/comments'),

  // Admin user management
  adminListUsers: (q?: string) =>
    request<AdminUserRow[]>(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  adminUpdateUser: (id: number, patch: { role?: Role; displayName?: string }) =>
    request<{ id: number; email: string; displayName: string; role: Role }>(
      `/api/admin/users/${id}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  adminGrantOwnership: (userId: number, locationId: number) =>
    request<{ ok: true; userId: number; locationId: number }>(
      `/api/admin/users/${userId}/grant-ownership`,
      { method: 'POST', body: JSON.stringify({ locationId }) },
    ),
  adminRevokeOwnership: (userId: number, locationId: number) =>
    request<{ ok: true }>(
      `/api/admin/users/${userId}/grant-ownership/${locationId}`,
      { method: 'DELETE' },
    ),

  // Floor plan
  getFloorPlan: (slug: string) =>
    request<{ layout: FloorPlanLayout; updatedAt: string }>(`/api/locations/${slug}/map`),
  ownerSaveFloorPlan: (locationId: number, layout: FloorPlanLayout) =>
    request<{ layout: FloorPlanLayout; updatedAt: string }>(
      `/api/owner/locations/${locationId}/map`,
      { method: 'PUT', body: JSON.stringify({ layout }) },
    ),
  ownerDeleteFloorPlan: (locationId: number) =>
    request<{ ok: true }>(`/api/owner/locations/${locationId}/map`, { method: 'DELETE' }),

  // Media
  uploadMedia: (file: File) => {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return uploadRequest<{ id: number }>(`/api/uploads`, fd);
  },

  // Service requests — visitor side
  createServiceRequest: (slug: string, body: { description: string; photoIds: number[] }) =>
    request<MyServiceRequest>(`/api/locations/${slug}/service-requests`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  myServiceRequests: () => request<MyServiceRequest[]>('/api/me/service-requests'),
  acceptServiceRequest: (id: number) =>
    request<MyServiceRequest>(`/api/me/service-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
    }),
  cancelServiceRequest: (id: number) =>
    request<MyServiceRequest>(`/api/me/service-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled' }),
    }),

  // Service requests — owner side
  ownerServiceRequests: (params: { status?: string; locationId?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.locationId) qs.set('locationId', String(params.locationId));
    const s = qs.toString();
    return request<OwnerServiceRequest[]>(`/api/owner/service-requests${s ? `?${s}` : ''}`);
  },
  ownerQuoteServiceRequest: (id: number, quote: ServiceRequestQuote) =>
    request<OwnerServiceRequest>(`/api/owner/service-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ quote }),
    }),
  ownerDeclineServiceRequest: (id: number) =>
    request<OwnerServiceRequest>(`/api/owner/service-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'declined' }),
    }),
  ownerCompleteServiceRequest: (id: number) =>
    request<OwnerServiceRequest>(`/api/owner/service-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    }),

  // Settings
  getSettings: () => request<AppSettings>('/api/settings'),
  adminUpdateSettings: (patch: Partial<AppSettings>) =>
    request<AppSettings>('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  // Events
  listEvents: (params: { cat?: string; limit?: number; includePast?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.cat) qs.set('cat', params.cat);
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.includePast) qs.set('includePast', '1');
    const s = qs.toString();
    return request<CityEvent[]>(`/api/events${s ? `?${s}` : ''}`);
  },
  listLocationEvents: (slug: string, params: { includePast?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.includePast) qs.set('includePast', '1');
    const s = qs.toString();
    return request<LocationEvent[]>(`/api/locations/${slug}/events${s ? `?${s}` : ''}`);
  },
  ownerListEvents: (params: { locationId?: number; includePast?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.locationId !== undefined) qs.set('locationId', String(params.locationId));
    if (params.includePast) qs.set('includePast', '1');
    const s = qs.toString();
    return request<CityEvent[]>(`/api/owner/events${s ? `?${s}` : ''}`);
  },
  ownerCreateEvent: (body: {
    locationId: number;
    title: string;
    description?: string | null;
    startsAt: string;
    endsAt?: string | null;
    status?: EventStatus;
  }) =>
    request<CityEvent>('/api/owner/events', { method: 'POST', body: JSON.stringify(body) }),
  ownerUpdateEvent: (
    id: number,
    body: Partial<{ title: string; description: string | null; startsAt: string; endsAt: string | null; status: EventStatus }>,
  ) =>
    request<CityEvent>(`/api/owner/events/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  ownerDeleteEvent: (id: number) =>
    request<{ ok: true }>(`/api/owner/events/${id}`, { method: 'DELETE' }),
};
