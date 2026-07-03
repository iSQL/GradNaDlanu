import type {
  Ad,
  AdInput,
  AdminUserRow,
  Alumnus,
  AvailabilityRow,
  Category,
  ConversationDetail,
  ConversationSummary,
  Message,
  Notifications,
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
  NewsItem,
  NewsStatus,
  OwnerAlumnus,
  OwnerNewsItem,
  OwnerReservation,
  OwnerServiceRequest,
  RecentComment,
  ReservationPayload,
  ServiceRequestQuote,
  VillageInfo,
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
  curatedVillages: string[];
}

export type NewsletterCategory = 'desavanja' | 'poruke' | 'marketing';
export type NewsletterStatus = 'pending' | 'confirmed' | 'unsubscribed';

export interface NewsletterPrefs {
  desavanja: boolean;
  poruke: boolean;
  marketing: boolean;
}

export interface NewsletterCounts {
  pending: number;
  confirmed: number;
  unsubscribed: number;
  desavanja: number;
  poruke: number;
  marketing: number;
}

export interface CuratorCommentRow {
  id: number;
  body: string;
  rating: number | null;
  status: 'visible' | 'hidden' | 'flagged';
  createdAt: string;
  parentId: number | null;
  locationId: number;
  locationSlug: string;
  locationName: string;
  village: string | null;
  authorId: number;
  authorName: string;
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
  guestsCanPostAds: boolean;
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
  adminCreateLocation: (body: { name: string; address: string; catId: string; subtitle?: string; village?: string | null; lat?: number; lng?: number; status?: 'draft' | 'published' }) =>
    request<Location>('/api/admin/locations', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateLocation: (
    id: number,
    patch: Partial<{
      status: 'draft' | 'published';
      name: string;
      address: string;
      subtitle: string;
      village: string | null;
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
    patch: Partial<{ name: string; subtitle: string; address: string; village: string | null; content: unknown }>,
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
  adminGrantCurator: (userId: number, village: string) =>
    request<{ ok: true; userId: number; village: string }>(
      `/api/admin/users/${userId}/grant-curator`,
      { method: 'POST', body: JSON.stringify({ village }) },
    ),
  adminRevokeCurator: (userId: number, village: string) =>
    request<{ ok: true }>(
      `/api/admin/users/${userId}/grant-curator/${encodeURIComponent(village)}`,
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
  uploadMedia: (file: File, kind?: 'service_photo' | 'alumni_photo' | 'ad_photo') => {
    const fd = new FormData();
    fd.append('file', file, file.name);
    if (kind) fd.append('kind', kind);
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
  listEvents: (params: { cat?: string; village?: string; limit?: number; includePast?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.cat) qs.set('cat', params.cat);
    if (params.village) qs.set('village', params.village);
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
  ownerDeletePastEvents: (locationId?: number) => {
    const qs = locationId !== undefined ? `?locationId=${locationId}` : '';
    return request<{ deleted: number }>(`/api/owner/events/past${qs}`, { method: 'DELETE' });
  },

  // News
  listNews: (params: { village?: string; locationId?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.village) qs.set('village', params.village);
    if (params.locationId !== undefined) qs.set('locationId', String(params.locationId));
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    const s = qs.toString();
    return request<NewsItem[]>(`/api/news${s ? `?${s}` : ''}`);
  },
  getNews: (slug: string) => request<NewsItem>(`/api/news/${slug}`),
  getEvent: (id: number) => request<CityEvent>(`/api/events/${id}`),

  // Owner news
  ownerListNews: (params: { locationId?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.locationId !== undefined) qs.set('locationId', String(params.locationId));
    const s = qs.toString();
    return request<OwnerNewsItem[]>(`/api/owner/news${s ? `?${s}` : ''}`);
  },
  ownerCreateNews: (body: { locationId: number; title: string; body: string; status?: NewsStatus }) =>
    request<OwnerNewsItem>('/api/owner/news', { method: 'POST', body: JSON.stringify(body) }),
  ownerUpdateNews: (
    id: number,
    body: Partial<{ title: string; body: string; status: NewsStatus }>,
  ) =>
    request<OwnerNewsItem>(`/api/owner/news/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  ownerDeleteNews: (id: number) =>
    request<{ ok: true }>(`/api/owner/news/${id}`, { method: 'DELETE' }),

  // Newsletter
  subscribeNewsletter: (email: string, prefs: NewsletterPrefs, consent: boolean) =>
    request<{ ok: true }>(`/api/newsletter/subscribe`, {
      method: 'POST',
      body: JSON.stringify({ email, prefs, consent }),
    }),
  confirmNewsletter: (token: string) =>
    request<{ ok: true; email: string; prefs: NewsletterPrefs }>(`/api/newsletter/confirm`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  getNewsletterPrefs: (token: string) =>
    request<{ email: string; status: NewsletterStatus; prefs: NewsletterPrefs }>(
      `/api/newsletter/prefs?token=${encodeURIComponent(token)}`,
    ),
  updateNewsletterPrefs: (token: string, prefs: NewsletterPrefs) =>
    request<{ ok: true; prefs: NewsletterPrefs }>(`/api/newsletter/prefs`, {
      method: 'POST',
      body: JSON.stringify({ token, prefs }),
    }),
  unsubscribeNewsletter: (token: string) =>
    request<{ ok: true }>(`/api/newsletter/unsubscribe`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  getMyNewsletter: () =>
    request<{ subscribed: boolean; prefs: NewsletterPrefs }>(`/api/me/newsletter`),
  updateMyNewsletter: (payload: { subscribed: boolean; prefs: NewsletterPrefs }) =>
    request<{ subscribed: boolean; prefs: NewsletterPrefs }>(`/api/me/newsletter`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  adminNewsletterCounts: () =>
    request<{ counts: NewsletterCounts }>(`/api/admin/newsletter/subscribers`),
  adminSendNewsletter: (payload: { category: NewsletterCategory; subject: string; bodyText: string }) =>
    request<{ ok: true; sent: number; failed: number; total: number }>(
      `/api/admin/newsletter/send`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  // Alumni
  listAlumni: (slug: string, params: { year?: number; q?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.year !== undefined) qs.set('year', String(params.year));
    if (params.q) qs.set('q', params.q);
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    const s = qs.toString();
    return request<Alumnus[]>(`/api/locations/${slug}/alumni${s ? `?${s}` : ''}`);
  },
  ownerListAlumni: (params: { locationId?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.locationId !== undefined) qs.set('locationId', String(params.locationId));
    const s = qs.toString();
    return request<OwnerAlumnus[]>(`/api/owner/alumni${s ? `?${s}` : ''}`);
  },
  ownerCreateAlumnus: (body: {
    locationId: number;
    fullName: string;
    graduationYear: number;
    homeroomTeacher: string;
    motto: string;
    email?: string | null;
    photoMediaId?: number | null;
  }) => request<OwnerAlumnus>('/api/owner/alumni', { method: 'POST', body: JSON.stringify(body) }),
  ownerUpdateAlumnus: (
    id: number,
    body: Partial<{
      fullName: string;
      graduationYear: number;
      homeroomTeacher: string;
      motto: string;
      email: string | null;
      photoMediaId: number | null;
    }>,
  ) =>
    request<OwnerAlumnus>(`/api/owner/alumni/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  ownerDeleteAlumnus: (id: number) =>
    request<{ ok: true }>(`/api/owner/alumni/${id}`, { method: 'DELETE' }),

  // Villages (public — drives /naselja)
  listVillages: () => request<VillageInfo[]>('/api/villages'),

  // Curator (kustos) side
  curatorVillages: () => request<string[]>('/api/curator/villages'),
  curatorLocations: () => request<Location[]>('/api/curator/locations'),
  curatorCreateLocation: (body: {
    name: string;
    address: string;
    catId: string;
    village: string;
    subtitle?: string | null;
    lat?: number;
    lng?: number;
    content?: unknown;
  }) =>
    request<Location>('/api/curator/locations', { method: 'POST', body: JSON.stringify(body) }),
  curatorUpdateLocation: (
    id: number,
    patch: Partial<{ name: string; subtitle: string | null; address: string; content: unknown }>,
  ) =>
    request<Location>(`/api/curator/locations/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  curatorComments: () => request<CuratorCommentRow[]>('/api/curator/comments'),
  curatorSetCommentStatus: (id: number, status: 'visible' | 'hidden') =>
    request<{ id: number; status: 'visible' | 'hidden' | 'flagged' }>(
      `/api/curator/comments/${id}`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
    ),

  // Oglasna tabla (ads)
  listOglasi: (params: { category?: string; village?: string; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.category) qs.set('category', params.category);
    if (params.village) qs.set('village', params.village);
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.offset !== undefined) qs.set('offset', String(params.offset));
    const s = qs.toString();
    return request<Ad[]>(`/api/oglasi${s ? `?${s}` : ''}`);
  },
  getOglas: (id: number) => request<Ad>(`/api/oglasi/${id}`),
  myOglasi: () => request<Ad[]>('/api/me/oglasi'),
  createOglas: (body: AdInput) =>
    request<Ad>('/api/oglasi', { method: 'POST', body: JSON.stringify(body) }),
  updateOglas: (id: number, body: AdInput) =>
    request<Ad>(`/api/oglasi/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteOglas: (id: number) =>
    request<{ ok: true }>(`/api/oglasi/${id}`, { method: 'DELETE' }),
  adminListArchivedOglasi: () => request<Ad[]>('/api/admin/oglasi/archived'),
  adminRestoreOglas: (id: number) =>
    request<Ad>(`/api/admin/oglasi/${id}/restore`, { method: 'POST' }),
  adminSetOglasPermanent: (id: number, permanent: boolean) =>
    request<Ad>(`/api/admin/oglasi/${id}/permanent`, {
      method: 'PATCH',
      body: JSON.stringify({ permanent }),
    }),

  // Poruke (conversations / messages)
  myConversations: () => request<ConversationSummary[]>('/api/me/conversations'),
  getConversation: (id: number) => request<ConversationDetail>(`/api/conversations/${id}`),
  startConversation: (body: { adId?: number; recipientId?: number; body: string }) =>
    request<{ id: number }>('/api/conversations', { method: 'POST', body: JSON.stringify(body) }),
  postMessage: (conversationId: number, body: string) =>
    request<Message>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
  markConversationRead: (conversationId: number) =>
    request<{ ok: true }>(`/api/conversations/${conversationId}/read`, { method: 'POST' }),
  deleteConversation: (conversationId: number) =>
    request<{ ok: true }>(`/api/conversations/${conversationId}`, { method: 'DELETE' }),

  // Notifications (Moj prostor badge)
  getNotifications: () => request<Notifications>('/api/me/notifications'),
  markSeen: (section: 'reservations' | 'feed') =>
    request<{ ok: true }>('/api/me/seen', { method: 'POST', body: JSON.stringify({ section }) }),
};
