import {
  pgTable,
  text,
  serial,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
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

export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
});

export type Category = typeof categories.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type ModuleContentRow = typeof moduleContent.$inferSelect;
