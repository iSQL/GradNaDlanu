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
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  role: text('role', { enum: ['admin', 'business', 'user'] })
    .default('user')
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  emailVerifiedAt: timestamp('email_verified_at'),
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
export type Role = User['role'];
