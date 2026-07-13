export type CategoryId =
  | 'cafe'
  | 'public'
  | 'landmark'
  | 'hotel'
  | 'school'
  | 'vodoinstalater'
  | 'elektricar'
  | 'automehanicar';

export type MajstorCategoryId = 'vodoinstalater' | 'elektricar' | 'automehanicar';

export function isMajstorCategory(catId: CategoryId): catId is MajstorCategoryId {
  return catId === 'vodoinstalater' || catId === 'elektricar' || catId === 'automehanicar';
}

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
  village: string | null;
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

export interface MajstorContent {
  tagline?: string;
  contact?: { phone?: string; address?: string };
  hours?: { day: string; hours: string }[];
  services?: string[];
  note?: string;
}

export type ModuleContent =
  | CafeContent
  | PublicContent
  | HotelContent
  | LandmarkContent
  | SchoolContent
  | MajstorContent;

export interface LocationWithContent extends Location {
  content: ModuleContent | Record<string, never>;
  favoritedByMe: boolean;
  checkinsLast24h: number;
  commentSummary: { count: number; avgRating: number | null };
}

export interface CommentAuthor {
  id: number;
  displayName: string;
  role: 'admin' | 'business' | 'user' | 'guest' | 'curator' | 'majstor';
}

export interface CommentNode {
  id: number;
  body: string;
  rating: number | null;
  createdAt: string;
  author: CommentAuthor;
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
  author: CommentAuthor;
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
  role: 'admin' | 'business' | 'user' | 'curator' | 'majstor';
  createdAt: string;
  ownedLocations: { id: number; slug: string; name: string }[];
  curatedVillages: string[];
  majstorCategories: string[];
}

export interface VillageInfo {
  name: string;
  populationCensus2002: number | null;
  populationCensus2022: number | null;
  areaKm2: number | null;
  distanceKm: number | null;
  direction: string | null;
  lat: number | null;
  lon: number | null;
  isSeat: boolean;
  story: string | null;
  curators: { id: number; displayName: string }[];
}

export type ServiceRequestStatus =
  | 'pending'
  | 'quoted'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'completed';

export interface ServiceRequestPayload {
  description: string;
  photoIds: number[];
}

export interface ServiceRequestQuote {
  priceRsd: number;
  note: string;
  availableDate: string;
}

export interface MyServiceRequest {
  id: number;
  payload: ServiceRequestPayload;
  quote: ServiceRequestQuote | null;
  status: ServiceRequestStatus;
  createdAt: string;
  decidedAt: string | null;
  locationId: number;
  locationSlug: string;
  locationName: string;
  locationCatId: CategoryId;
}

export interface OwnerServiceRequest extends MyServiceRequest {
  userId: number;
  userDisplayName: string;
  userEmail: string;
}

// --- Usluge (broadcast zahtevi za majstore po kategorijama) ---

export type ServiceJobStatus = 'open' | 'accepted' | 'completed' | 'cancelled';
export type ServiceOfferStatus = 'active' | 'accepted' | 'archived';

export interface ServiceJobPayload {
  description: string;
  note?: string;
  photoIds: number[];
}

export interface JobOffer {
  id: number;
  majstorUserId: number;
  majstorDisplayName: string;
  // Telefon majstora — server ga vraća samo na prihvaćenoj ponudi.
  majstorPhone: string | null;
  quote: ServiceRequestQuote;
  status: ServiceOfferStatus;
  createdAt: string;
  updatedAt: string;
  // Ocena naručioca — postoji samo na prihvaćenoj ponudi završenog posla.
  ratingStars: number | null;
  ratingComment: string | null;
}

export interface MyServiceJob {
  id: number;
  categoryId: string;
  payload: ServiceJobPayload;
  targetUserIds: number[] | null;
  status: ServiceJobStatus;
  acceptedOfferId: number | null;
  createdAt: string;
  completedAt: string | null;
  completedBy: number | null;
  offers: JobOffer[];
}

export interface MajstorJob {
  id: number;
  categoryId: string;
  payload: ServiceJobPayload;
  status: ServiceJobStatus;
  createdAt: string;
  completedAt: string | null;
  requesterDisplayName: string;
  // Otkrivaju se tek kada je MOJA ponuda prihvaćena.
  requesterEmail: string | null;
  requesterId: number | null;
  myOffer: {
    id: number;
    quote: ServiceRequestQuote;
    status: ServiceOfferStatus;
    createdAt: string;
    updatedAt: string;
    ratingStars: number | null;
    ratingComment: string | null;
  } | null;
  archivedReason: 'accepted_other' | 'cancelled' | null;
}

// Metrike majstora — prikazuju se u pickeru na /usluge i na /majstori.
export interface MajstorStats {
  avgRating: number | null;
  ratingCount: number;
  completedJobs: number;
  avgResponseMinutes: number | null;
}

export interface MajstorPublic extends MajstorStats {
  id: number;
  displayName: string;
}

export interface MajstorReview {
  stars: number;
  comment: string | null;
  ratedAt: string;
  categoryId: string;
  reviewerName: string;
}

// Red javnog imenika majstora (GET /api/majstori) — kategorije + zadnje ocene.
export interface MajstorDirectoryEntry extends MajstorStats {
  id: number;
  displayName: string;
  categories: string[];
  reviews: MajstorReview[];
}

export interface UslugeStat {
  categoryId: string;
  majstorCount: number;
}

export type EventStatus = 'published' | 'cancelled';

export interface CityEvent {
  id: number;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  status: EventStatus;
  locationId: number;
  locationSlug: string;
  locationName: string;
  locationCatId: CategoryId;
  village?: string | null;
}

export interface LocationEvent {
  id: number;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  status: EventStatus;
}

export type NewsStatus = 'draft' | 'pending' | 'published';

export interface NewsItem {
  id: number;
  locationId: number;
  title: string;
  slug: string;
  body: string;
  publishedAt: string | null;
  createdAt: string;
  locationName: string;
  locationSlug: string;
  locationCatId: CategoryId;
  village: string | null;
}

export interface OwnerNewsItem extends NewsItem {
  status: NewsStatus;
  updatedAt: string;
}

export interface Alumnus {
  id: number;
  locationId: number;
  fullName: string;
  graduationYear: number;
  homeroomTeacher: string;
  motto: string;
  // Absent in public responses when caller is not authenticated.
  email?: string | null;
  photoMediaId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerAlumnus extends Alumnus {
  locationName?: string;
  locationSlug?: string;
  locationCatId?: CategoryId;
}

// --- Oglasna tabla ---

export type AdCategory = 'prodajem' | 'kupujem' | 'usluge' | 'poslovi' | 'ostalo';
export type AdContactMethod = 'link' | 'phone' | 'email' | 'message';
export type AdStatus = 'active' | 'archived';

export interface Ad {
  id: number;
  userId: number;
  title: string;
  description: string;
  category: AdCategory;
  priceRsd: number | null;
  village: string;
  photoMediaId: number | null;
  contactMethod: AdContactMethod;
  contactValue: string | null;
  status: AdStatus;
  permanent: boolean;
  createdAt: string;
  updatedAt: string;
  authorDisplayName: string;
}

export interface AdInput {
  title: string;
  description: string;
  category: AdCategory;
  priceRsd: number | null;
  village: string;
  photoMediaId: number | null;
  contactMethod: AdContactMethod;
  contactValue: string | null;
}

export const AD_CATEGORY_LABELS: Record<AdCategory, string> = {
  prodajem: 'Prodajem',
  kupujem: 'Kupujem',
  usluge: 'Usluge',
  poslovi: 'Poslovi',
  ostalo: 'Ostalo',
};

// --- Prijava komunalnih problema ("Problemi") ---

export type ProblemStatus = 'open' | 'solved';

export interface Problem {
  id: number;
  catId: string;
  title: string;
  description: string;
  village: string;
  address: string | null;
  lat: number;
  lng: number;
  photoMediaId: number | null;
  status: ProblemStatus;
  solvedAt: string | null;
  createdAt: string;
  // Display ime ulogovanog prijavioca; null = anonimna prijava.
  reporterName: string | null;
  votes: number;
  commentCount: number;
  // Da li je trenutni (ulogovani) korisnik glasao — false za anonimne.
  voted: boolean;
}

export interface ProblemCommentItem {
  id: number;
  body: string;
  createdAt: string;
  author: CommentAuthor;
  // Komentar u ime opštine (autor je admin ili kustos).
  official: boolean;
}

export interface ProblemDetail extends Problem {
  // Sme li trenutni korisnik da menja status (admin / kustos sela / prijavilac).
  canResolve: boolean;
  comments: ProblemCommentItem[];
}

export interface ProblemInput {
  catId: string;
  title: string;
  description: string;
  village: string;
  address?: string | null;
  lat: number;
  lng: number;
  photoMediaId?: number | null;
}

// --- "Zaboravljeni biseri" ---

export type BiserStatus = 'pending' | 'published' | 'rejected';

export interface Biser {
  id: number;
  title: string;
  year: number;
  village: string;
  // Priča/anegdota — pasusi razdvojeni praznim redom, UI deli na \n\n.
  story: string;
  lat: number;
  lng: number;
  // NULL → UI prikazuje sepija placeholder (seed primeri / obrisan media red).
  photoMediaId: number | null;
  nowPhotoMediaId: number | null;
  status: BiserStatus;
  createdAt: string;
  // Display ime autora; null kad je nalog obrisan.
  contributorName: string | null;
  likes: number;
  commentCount: number;
  liked: boolean;
}

export interface BiserCommentItem {
  id: number;
  body: string;
  createdAt: string;
  author: { id: number; displayName: string };
}

export interface BiserDetail extends Biser {
  // Sme li trenutni korisnik da odobri/odbije (admin / kustos sela).
  canModerate: boolean;
  // Sme li da naknadno doda/ukloni "Danas" fotku (autor ili moderator).
  canEdit: boolean;
  comments: BiserCommentItem[];
}

export interface BiserInput {
  title: string;
  year: number;
  village: string;
  story: string;
  lat: number;
  lng: number;
  photoMediaId: number;
  nowPhotoMediaId?: number | null;
}

// --- In-site messaging (poruke) ---

export interface ConversationSummary {
  id: number;
  adId: number | null;
  adTitleSnapshot: string | null;
  lastMessageAt: string;
  counterpartyId: number;
  counterpartyName: string;
  lastSnippet: string | null;
  lastSnippetAt: string | null;
  unreadCount: number;
  adActive: boolean;
}

export interface Message {
  id: number;
  senderId: number;
  body: string;
  createdAt: string;
}

export interface Notifications {
  unreadMessages: number;
  reservationUpdates: number;
  followedUpdates: number;
  uslugeUpdates: number;
  majstorJobs: number;
  ownerComments: number;
}

export interface ConversationDetail {
  id: number;
  adId: number | null;
  adTitleSnapshot: string | null;
  adActive: boolean;
  counterpartyId: number;
  counterpartyName: string;
  messages: Message[];
}

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  cafe: 'Kafić · restoran',
  public: 'Javna služba',
  landmark: 'Znamenitost',
  hotel: 'Smeštaj',
  school: 'Obrazovanje',
  vodoinstalater: 'Vodoinstalater',
  elektricar: 'Električar',
  automehanicar: 'Automehaničar',
};
