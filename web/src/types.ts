export type CategoryId = 'cafe' | 'public' | 'landmark' | 'hotel' | 'school';

export interface Category {
  id: CategoryId;
  label: string;
  short: string;
  color: string;
}

export interface Location {
  id: number;
  slug: string;
  catId: CategoryId;
  name: string;
  subtitle: string | null;
  address: string;
  lat: number;
  lng: number;
  status: 'draft' | 'published';
  createdAt: string;
  // Present when fetched via ?sort=popular
  commentCount?: number;
  avgRating?: number | null;
}

export interface CafeContent {
  tagline?: string;
  hours: { day: string; hours: string }[];
  menu: { cat: string; items: { name: string; desc: string; price: string }[] }[];
  contact: { phone?: string; web?: string };
}

export interface PublicContent {
  tagline: string;
  hours: [string, string][];
  contact: { phone: string; email: string; address: string };
  services: string[];
}

export interface HotelContent {
  tagline: string;
  contact: { phone: string; email: string; address: string };
  rooms: { name: string; beds: string; area: string; price: string; amen: string }[];
  facts: { num: string; em?: string; label: string }[];
}

export interface LandmarkContent {
  tagline: string;
  facts: { num: string; em?: string; label: string }[];
  story: string[];
}

export interface SchoolContent {
  tagline: string;
  contact: { phone: string; email: string; address: string };
  facts: { num: string; em?: string; label: string }[];
  programs: string[];
}

export type ModuleContent =
  | CafeContent
  | PublicContent
  | HotelContent
  | LandmarkContent
  | SchoolContent;

export interface LocationWithContent extends Location {
  content: ModuleContent | Record<string, never>;
  favoritedByMe: boolean;
  checkinsLast24h: number;
  commentSummary: { count: number; avgRating: number | null };
}

export interface CommentNode {
  id: number;
  body: string;
  rating: number | null;
  createdAt: string;
  author: { id: number; displayName: string };
  replies: CommentNode[];
}

export interface FavoriteRow extends Location {
  favoritedAt: string;
}

export interface MyComment {
  id: number;
  body: string;
  rating: number | null;
  createdAt: string;
  locationId: number;
  locationSlug: string;
  locationName: string;
}

export interface RecentComment {
  id: number;
  body: string;
  rating: number | null;
  createdAt: string;
  author: { id: number; displayName: string };
  location: { id: number; slug: string; name: string; catId: CategoryId };
}

export type ReservationStatus = 'pending' | 'approved' | 'declined' | 'cancelled';

export interface CafeReservationPayload {
  tableId: string;
  slotStart: string;
  slotEnd: string;
  guests: number;
}

export interface HotelReservationPayload {
  roomKey: string;
  dateFrom: string;
  dateTo: string;
  guests: number;
}

export type ReservationPayload = CafeReservationPayload | HotelReservationPayload;

export interface MyReservation {
  id: number;
  payload: ReservationPayload;
  status: ReservationStatus;
  createdAt: string;
  decidedAt: string | null;
  locationId: number;
  locationSlug: string;
  locationName: string;
  locationCatId: CategoryId;
}

export interface OwnerReservation extends MyReservation {
  userId: number;
  userDisplayName: string;
  userEmail: string;
}

export interface AvailabilityRow {
  payload: ReservationPayload;
  status: ReservationStatus;
}

export type FloorPlanItem =
  | { id: string; type: 'table'; x: number; y: number; w: number; h: number; label: string; capacity: number }
  | { id: string; type: 'room';  x: number; y: number; w: number; h: number; label: string; roomKey: string; capacity: number }
  | { id: string; type: 'wall';  x: number; y: number; w: number; h: number }
  | { id: string; type: 'door';  x: number; y: number };

export interface FloorPlanLayout {
  width: number;
  height: number;
  items: FloorPlanItem[];
}

export interface AdminUserRow {
  id: number;
  email: string;
  displayName: string;
  role: 'admin' | 'business' | 'user';
  createdAt: string;
  ownedLocations: { id: number; slug: string; name: string }[];
}

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  cafe: 'Kafić · restoran',
  public: 'Javna služba',
  landmark: 'Znamenitost',
  hotel: 'Smeštaj',
  school: 'Obrazovanje',
};
