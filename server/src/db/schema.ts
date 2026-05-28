import {
  pgTable,
  text,
  serial,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  primaryKey,
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
  role: text('role', { enum: ['admin', 'business', 'user', 'guest'] })
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
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type ServiceRequestStatus = ServiceRequest['status'];
export type Role = User['role'];
