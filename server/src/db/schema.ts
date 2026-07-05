import {
  pgTable,
  text,
  serial,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  primaryKey,
  numeric,
  boolean,
  unique,
  smallint,
} from 'drizzle-orm/pg-core';

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  short: text('short').notNull(),
  color: text('color').notNull(),
});

export const locations = pgTable('locations', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  catId: text('cat_id')
    .references(() => categories.id)
    .notNull(),
  name: text('name').notNull(),
  subtitle: text('subtitle'),
  address: text('address').notNull(),
  village: text('village'),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  status: text('status', { enum: ['draft', 'published'] })
    .default('published')
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const moduleContent = pgTable('module_content', {
  locationId: integer('location_id')
    .primaryKey()
    .references(() => locations.id, { onDelete: 'cascade' }),
  content: jsonb('content').notNull(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  // email + passwordHash are nullable: guest accounts have neither. Uniqueness
  // on email is enforced via a partial unique index (see migrate.ts) so multiple
  // guests with NULL email don't collide.
  email: text('email'),
  passwordHash: text('password_hash'),
  displayName: text('display_name').notNull(),
  // Kontakt telefon — unosi ga sam korisnik (praktično: majstor). Prikazuje se
  // naručiocu usluge tek kada prihvati ponudu tog majstora.
  phone: text('phone'),
  role: text('role', { enum: ['admin', 'business', 'user', 'guest', 'curator', 'majstor'] })
    .default('user')
    .notNull(),
  // Bumped on role change / ownership revoke / forced logout so previously-issued
  // JWTs (which carry the `tv` claim) are rejected by requireAuth.
  tokenVersion: integer('token_version').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  emailVerifiedAt: timestamp('email_verified_at'),
  // Updated on guest-allowed mutating actions (favorite/comment/checkin). Used
  // by the 7-day inactivity sweep that deletes role='guest' rows.
  lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
  // "Last seen" anchors for the "Moj prostor" notification badge. Bumped when the
  // user opens the matching dashboard tab; the notifications query counts items
  // newer than these. (Unread messages use the per-conversation read marks.)
  reservationsSeenAt: timestamp('reservations_seen_at').defaultNow().notNull(),
  feedSeenAt: timestamp('feed_seen_at').defaultNow().notNull(),
  // "Usluge" broadcast zahtevi: uslugeSeenAt za korisnika-naručioca (nove
  // kontraponude), majstorSeenAt za majstora (novi zahtevi u mojim kategorijama).
  uslugeSeenAt: timestamp('usluge_seen_at').defaultNow().notNull(),
  majstorSeenAt: timestamp('majstor_seen_at').defaultNow().notNull(),
});

export const objectOwners = pgTable(
  'object_owners',
  {
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    locationId: integer('location_id')
      .references(() => locations.id, { onDelete: 'cascade' })
      .notNull(),
    grantedByAdminId: integer('granted_by_admin_id').references(() => users.id),
    grantedAt: timestamp('granted_at').defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.locationId] }) }),
);

export const favorites = pgTable(
  'favorites',
  {
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    locationId: integer('location_id')
      .references(() => locations.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.locationId] }) }),
);

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  locationId: integer('location_id')
    .references(() => locations.id, { onDelete: 'cascade' })
    .notNull(),
  body: text('body').notNull(),
  rating: integer('rating'),
  status: text('status', { enum: ['visible', 'hidden', 'flagged'] })
    .default('visible')
    .notNull(),
  parentId: integer('parent_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const checkins = pgTable('checkins', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  locationId: integer('location_id')
    .references(() => locations.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const objectMaps = pgTable('object_maps', {
  locationId: integer('location_id')
    .primaryKey()
    .references(() => locations.id, { onDelete: 'cascade' }),
  layout: jsonb('layout').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const reservations = pgTable('reservations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  locationId: integer('location_id')
    .references(() => locations.id, { onDelete: 'cascade' })
    .notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'declined', 'cancelled'] })
    .default('pending')
    .notNull(),
  decidedByOwnerId: integer('decided_by_owner_id').references(() => users.id),
  decidedAt: timestamp('decided_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const media = pgTable('media', {
  id: serial('id').primaryKey(),
  ownerUserId: integer('owner_user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  kind: text('kind').notNull(),
  storagePath: text('storage_path').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  locationId: integer('location_id')
    .references(() => locations.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  description: text('description'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  status: text('status', { enum: ['published', 'cancelled'] })
    .default('published')
    .notNull(),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const news = pgTable('news', {
  id: serial('id').primaryKey(),
  locationId: integer('location_id')
    .references(() => locations.id, { onDelete: 'cascade' })
    .notNull(),
  authorId: integer('author_id')
    .references(() => users.id)
    .notNull(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  body: text('body').notNull(),
  status: text('status', { enum: ['draft', 'pending', 'published'] })
    .default('pending')
    .notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  // Double opt-in lifecycle: 'pending' until the confirm link is clicked,
  // 'confirmed' once opted in, 'unsubscribed' after opt-out. Existing pre-consent
  // rows land in 'pending' (see migrate.ts) and receive nothing until they re-opt.
  status: text('status', { enum: ['pending', 'confirmed', 'unsubscribed'] })
    .default('pending')
    .notNull(),
  // Per-category consent. `desavanja` defaults on (the primary reason to subscribe);
  // marketing + poruke are opt-in.
  prefDesavanja: boolean('pref_desavanja').default(true).notNull(),
  prefPoruke: boolean('pref_poruke').default(false).notNull(),
  prefMarketing: boolean('pref_marketing').default(false).notNull(),
  // Opaque capability token embedded in confirm / unsubscribe / manage links.
  // Stored RAW (unlike the hashed login-grade tokens in verification.ts) because
  // it only authorizes subscribing/unsubscribing an already-known address, and
  // must stay stable so every future email can carry the same unsubscribe link.
  token: text('token').unique(),
  confirmedAt: timestamp('confirmed_at'),
  unsubscribedAt: timestamp('unsubscribed_at'),
  // Optional link to a logged-in account that manages this subscription via
  // "Moj prostor". Matched by verified email; SET NULL so deleting the account
  // leaves the email-only subscription intact.
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const alumni = pgTable('alumni', {
  id: serial('id').primaryKey(),
  locationId: integer('location_id')
    .references(() => locations.id, { onDelete: 'cascade' })
    .notNull(),
  fullName: text('full_name').notNull(),
  graduationYear: integer('graduation_year').notNull(),
  homeroomTeacher: text('homeroom_teacher').notNull(),
  motto: text('motto').notNull(),
  email: text('email'),
  photoMediaId: integer('photo_media_id').references(() => media.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Per-naselje statički fakti — popunjeni iz seed-data.ts pri seed-u, ali su deo
// schema-e jer ih kustosi (i kasnije admini) mogu uređivati kroz UI.
export const villages = pgTable('villages', {
  name: text('name').primaryKey(),
  populationCensus2002: integer('population_census_2002'),
  populationCensus2022: integer('population_census_2022'),
  areaKm2: numeric('area_km2', { precision: 6, scale: 2 }),
  distanceKm: numeric('distance_km', { precision: 5, scale: 2 }),
  direction: text('direction'),
  lat: numeric('lat', { precision: 8, scale: 5 }),
  lon: numeric('lon', { precision: 8, scale: 5 }),
  isSeat: boolean('is_seat').default(false).notNull(),
  story: text('story'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Many-to-many: jedan korisnik može biti kustos više sela, jedno selo može imati
// više kustosa. Mirrors `object_owners` po obrascu (granted_by + granted_at audit).
export const villageCurators = pgTable(
  'village_curators',
  {
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    villageName: text('village_name')
      .references(() => villages.name, { onDelete: 'cascade' })
      .notNull(),
    grantedByAdminId: integer('granted_by_admin_id').references(() => users.id),
    grantedAt: timestamp('granted_at').defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.villageName] }) }),
);

export const serviceRequests = pgTable('service_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  locationId: integer('location_id')
    .references(() => locations.id, { onDelete: 'cascade' })
    .notNull(),
  payload: jsonb('payload').notNull(),
  quote: jsonb('quote'),
  status: text('status', {
    enum: ['pending', 'quoted', 'accepted', 'declined', 'cancelled', 'completed'],
  })
    .default('pending')
    .notNull(),
  decidedByOwnerId: integer('decided_by_owner_id').references(() => users.id),
  decidedAt: timestamp('decided_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Many-to-many: majstor (korisnik) dodeljen kategorijama usluga. Mirrors
// `village_curators` obrazac (granted_by + granted_at audit). `categoryId` se
// validira na app sloju protiv SERVICE_CATEGORIES (lib/usluge.ts) — nema FK ka
// `categories` jer 'bela-tehnika' i 'majstor-za-sve' postoje samo kao usluge.
export const majstorCategories = pgTable(
  'majstor_categories',
  {
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    categoryId: text('category_id').notNull(),
    grantedByAdminId: integer('granted_by_admin_id').references(() => users.id),
    grantedAt: timestamp('granted_at').defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.categoryId] }) }),
);

// Broadcast zahtev za uslugu ("Usluge"): jedan zahtev → svi majstori kategorije
// (targetUserIds NULL) ili ručno izabrani podskup. Za razliku od 1-na-1
// `service_requests` (vezan za objekat), cilja majstore-korisnike po kategoriji.
export const serviceJobs = pgTable('service_jobs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  categoryId: text('category_id').notNull(),
  // { description, note?, photoIds } — vidi lib/usluge.ts ServiceJobPayload.
  payload: jsonb('payload').notNull(),
  // NULL = broadcast svim majstorima kategorije; inače niz user ID-eva.
  targetUserIds: jsonb('target_user_ids').$type<number[] | null>(),
  status: text('status', { enum: ['open', 'accepted', 'completed', 'cancelled'] })
    .default('open')
    .notNull(),
  // Bez FK ka service_offers (cirkularna zavisnost) — postavlja se isključivo u
  // accept transakciji koja proverava da ponuda pripada ovom job-u.
  acceptedOfferId: integer('accepted_offer_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  // Završetak posla (accepted → completed) — sme da označi bilo koja strana,
  // pa `completedBy` beleži ko je (naručilac ili majstor).
  completedAt: timestamp('completed_at'),
  completedBy: integer('completed_by').references(() => users.id),
});

// Kontraponuda majstora na service_job. Jedna ponuda po majstoru po job-u
// (UNIQUE) — ponovno slanje menja postojeću (upsert). `quote` je isti oblik kao
// kod 1-na-1 zahteva: { priceRsd, note, availableDate }.
export const serviceOffers = pgTable(
  'service_offers',
  {
    id: serial('id').primaryKey(),
    jobId: integer('job_id')
      .references(() => serviceJobs.id, { onDelete: 'cascade' })
      .notNull(),
    majstorUserId: integer('majstor_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    quote: jsonb('quote').notNull(),
    status: text('status', { enum: ['active', 'accepted', 'archived'] })
      .default('active')
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    // Ocena naručioca — samo na prihvaćenoj ponudi završenog posla (completed).
    // Zvezdice 1–5 (DB CHECK) + kratak komentar ≤160 karaktera (app validacija).
    ratingStars: smallint('rating_stars'),
    ratingComment: text('rating_comment'),
    ratedAt: timestamp('rated_at'),
  },
  (t) => ({ uq: unique('service_offers_job_majstor_uq').on(t.jobId, t.majstorUserId) }),
);

// Oglasna tabla — korisnik-postavljeni oglasi. Efemerni: traju 7 dana od
// poslednjeg `last_refreshed_at`, koji se osvežava kad vlasnik poseti sajt
// (vidi lib/oglasi-activity.ts). Posle 7 dana neaktivnosti sweep (lib/oglasi-
// cleanup.ts) ih prebacuje u status='archived' (soft-delete); samo admin vraća.
export const ads = pgTable('ads', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category', {
    enum: ['prodajem', 'kupujem', 'usluge', 'poslovi', 'ostalo'],
  }).notNull(),
  priceRsd: integer('price_rsd'),
  village: text('village').notNull(),
  photoMediaId: integer('photo_media_id').references(() => media.id, { onDelete: 'set null' }),
  contactMethod: text('contact_method', {
    enum: ['link', 'phone', 'email', 'message'],
  }).notNull(),
  // null when contactMethod='message' (in-site conversations instead).
  contactValue: text('contact_value'),
  status: text('status', { enum: ['active', 'archived'] })
    .default('active')
    .notNull(),
  permanent: boolean('permanent').default(false).notNull(),
  lastRefreshedAt: timestamp('last_refreshed_at').defaultNow().notNull(),
  // Set when the ad enters 'archived' (soft-delete); cleared on restore. Drives
  // the retention purge in lib/oglasi-cleanup.ts that hard-deletes long-archived
  // ads (which CASCADE-deletes their conversations + messages).
  archivedAt: timestamp('archived_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 1-to-1 razgovor, opciono vezan za oglas. Par učesnika čuvamo uređeno
// (low < high) tako da partial-unique indeks spreči duple niti za isti par+oglas.
// `adTitleSnapshot` preživi brisanje oglasa (ad_id -> NULL) da zaglavlje ostane.
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  // CASCADE: hard-deleting an ad row (retention purge) removes its conversations
  // and (via messages FK) their messages. A *soft-deleted* (archived) ad keeps
  // its row, so conversations stay visible while the ad sits in the archive.
  adId: integer('ad_id').references(() => ads.id, { onDelete: 'cascade' }),
  adTitleSnapshot: text('ad_title_snapshot'),
  userLowId: integer('user_low_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  userHighId: integer('user_high_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
  // Po-učesnik oznaka pročitanog: nepročitano = poruke novije od moje oznake
  // koje nije poslao ja. Nema per-poruka flag-ova.
  lastReadLowAt: timestamp('last_read_low_at'),
  lastReadHighAt: timestamp('last_read_high_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id')
    .references(() => conversations.id, { onDelete: 'cascade' })
    .notNull(),
  senderId: integer('sender_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Category = typeof categories.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type ModuleContentRow = typeof moduleContent.$inferSelect;
export type User = typeof users.$inferSelect;
export type ObjectOwner = typeof objectOwners.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Checkin = typeof checkins.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;
export type ReservationStatus = Reservation['status'];
export type ObjectMap = typeof objectMaps.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Event = typeof events.$inferSelect;
export type EventStatus = Event['status'];
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
export type Village = typeof villages.$inferSelect;
export type VillageCurator = typeof villageCurators.$inferSelect;
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type ServiceRequestStatus = ServiceRequest['status'];
export type MajstorCategoryGrant = typeof majstorCategories.$inferSelect;
export type ServiceJob = typeof serviceJobs.$inferSelect;
export type ServiceJobStatus = ServiceJob['status'];
export type ServiceOffer = typeof serviceOffers.$inferSelect;
export type ServiceOfferStatus = ServiceOffer['status'];
export type News = typeof news.$inferSelect;
export type NewsStatus = News['status'];
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type Alumnus = typeof alumni.$inferSelect;
export type Ad = typeof ads.$inferSelect;
export type AdStatus = Ad['status'];
export type AdCategory = Ad['category'];
export type AdContactMethod = Ad['contactMethod'];
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Role = User['role'];
