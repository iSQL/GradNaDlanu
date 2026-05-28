import postgres from 'postgres';
import { env } from '../env.js';
import { CATEGORIES } from './seed-data.js';

const statements = [
  `CREATE TABLE IF NOT EXISTS categories (
    id    TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    short TEXT NOT NULL,
    color TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS locations (
    id         SERIAL PRIMARY KEY,
    slug       TEXT NOT NULL UNIQUE,
    cat_id     TEXT NOT NULL REFERENCES categories(id),
    name       TEXT NOT NULL,
    subtitle   TEXT,
    address    TEXT NOT NULL,
    lat        DOUBLE PRECISION NOT NULL,
    lng        DOUBLE PRECISION NOT NULL,
    status     TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS module_content (
    location_id INTEGER PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
    content     JSONB NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id                SERIAL PRIMARY KEY,
    email             TEXT NOT NULL UNIQUE,
    password_hash     TEXT NOT NULL,
    display_name      TEXT NOT NULL,
    role              TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','business','user')),
    token_version     INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    email_verified_at TIMESTAMP
  )`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS object_owners (
    user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_id          INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    granted_by_admin_id  INTEGER REFERENCES users(id),
    granted_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, location_id)
  )`,
  `CREATE TABLE IF NOT EXISTS favorites (
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, location_id)
  )`,
  `CREATE TABLE IF NOT EXISTS comments (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    rating      INTEGER CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
    status      TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','flagged')),
    parent_id   INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS checkins (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS object_maps (
    location_id INTEGER PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
    layout      JSONB NOT NULL,
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS reservations (
    id                   SERIAL PRIMARY KEY,
    user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_id          INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    payload              JSONB NOT NULL,
    status               TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','approved','declined','cancelled')),
    decided_by_owner_id  INTEGER REFERENCES users(id),
    decided_at           TIMESTAMP,
    created_at           TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS media (
    id             SERIAL PRIMARY KEY,
    owner_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mime_type      TEXT NOT NULL,
    size_bytes     INTEGER NOT NULL,
    kind           TEXT NOT NULL,
    storage_path   TEXT NOT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id                   SERIAL PRIMARY KEY,
    location_id          INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    title                TEXT NOT NULL,
    description          TEXT,
    starts_at            TIMESTAMPTZ NOT NULL,
    ends_at              TIMESTAMPTZ,
    status               TEXT NOT NULL DEFAULT 'published'
      CHECK (status IN ('published','cancelled')),
    created_by_user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at           TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS email_verification_tokens_user_idx ON email_verification_tokens(user_id)`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS service_requests (
    id                   SERIAL PRIMARY KEY,
    user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_id          INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    payload              JSONB NOT NULL,
    quote                JSONB,
    status               TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','quoted','accepted','declined','cancelled','completed')),
    decided_by_owner_id  INTEGER REFERENCES users(id),
    decided_at           TIMESTAMP,
    created_at           TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS locations_cat_id_idx ON locations(cat_id)`,
  `CREATE INDEX IF NOT EXISTS locations_status_idx ON locations(status)`,
  `CREATE INDEX IF NOT EXISTS users_role_idx ON users(role)`,
  // --- Guest account support (idempotent) ---
  // Replace the role check to add 'guest'. CHECK constraints on the users.role
  // column may exist under either of two auto-generated names depending on which
  // version of Postgres / Drizzle initially created them, so we drop both.
  `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`,
  `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_role_check`,
  `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','business','user','guest'))`,
  // Allow null email / password_hash for guest rows. ALTER … DROP NOT NULL is
  // a no-op when the column is already nullable.
  `ALTER TABLE users ALTER COLUMN email DROP NOT NULL`,
  `ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`,
  // Switch from a column-level UNIQUE constraint (which would refuse multiple
  // NULL emails on some Postgres configurations and noisily duplicate the work
  // anyway) to a partial unique index that ignores NULLs entirely.
  `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key`,
  `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email) WHERE email IS NOT NULL`,
  // Activity tracking column + partial index for the cleanup query.
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP NOT NULL DEFAULT NOW()`,
  `CREATE INDEX IF NOT EXISTS users_guest_last_active_idx ON users(last_active_at) WHERE role = 'guest'`,
  `CREATE INDEX IF NOT EXISTS object_owners_location_idx ON object_owners(location_id)`,
  `CREATE INDEX IF NOT EXISTS favorites_location_idx ON favorites(location_id)`,
  `CREATE INDEX IF NOT EXISTS comments_loc_status_created_idx ON comments(location_id, status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS comments_status_created_idx ON comments(status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS comments_user_idx ON comments(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS comments_parent_idx ON comments(parent_id)`,
  `CREATE INDEX IF NOT EXISTS checkins_loc_created_idx ON checkins(location_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS checkins_user_idx ON checkins(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS reservations_loc_status_idx ON reservations(location_id, status)`,
  `CREATE INDEX IF NOT EXISTS reservations_user_created_idx ON reservations(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS media_owner_idx ON media(owner_user_id)`,
  `CREATE INDEX IF NOT EXISTS events_loc_starts_idx ON events(location_id, starts_at)`,
  `CREATE INDEX IF NOT EXISTS events_status_starts_idx ON events(status, starts_at)`,
  `CREATE INDEX IF NOT EXISTS service_requests_loc_status_idx ON service_requests(location_id, status)`,
  `CREATE INDEX IF NOT EXISTS service_requests_user_created_idx ON service_requests(user_id, created_at DESC)`,
  // --- Village column on locations + news + newsletter_subscribers ---
  `ALTER TABLE locations ADD COLUMN IF NOT EXISTS village TEXT`,
  `CREATE INDEX IF NOT EXISTS locations_village_idx ON locations(village)`,
  `CREATE TABLE IF NOT EXISTS news (
    id           SERIAL PRIMARY KEY,
    location_id  INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    author_id    INTEGER NOT NULL REFERENCES users(id),
    title        TEXT NOT NULL,
    slug         TEXT NOT NULL UNIQUE,
    body         TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('draft','pending','published')),
    published_at TIMESTAMPTZ,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS news_status_published_idx ON news(status, published_at DESC)`,
  `CREATE INDEX IF NOT EXISTS news_location_idx ON news(location_id)`,
  `CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id         SERIAL PRIMARY KEY,
    email      TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  // One-shot backfill: grandfather every user that existed before email
  // verification shipped. Gated on an app_settings sentinel so subsequent boots
  // don't re-verify users who refused to confirm their email.
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'email_verification_backfilled') THEN
       UPDATE users SET email_verified_at = NOW() WHERE email_verified_at IS NULL;
       INSERT INTO app_settings (key, value) VALUES ('email_verification_backfilled', 'true'::jsonb);
     END IF;
   END $$`,
  // One-shot mirror: copy any v1 admin_users rows into users with role='admin'.
  // Wrapped so it's a no-op once admin_users has been dropped.
  `DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_users') THEN
       INSERT INTO users (email, password_hash, display_name, role)
         SELECT username || '@local', password_hash, username, 'admin'
         FROM admin_users
       ON CONFLICT (email) DO NOTHING;
     END IF;
   END $$`,
  `DROP TABLE IF EXISTS admin_users`,
];

// Reusable migration function — opens its own short-lived connection so callers
// (CLI runner + boot-time hook in index.ts) don't share state.
export async function runMigrations(): Promise<void> {
  const sql = postgres(env.databaseUrl);
  try {
    for (const stmt of statements) {
      await sql.unsafe(stmt);
    }
    // Sync the category table with the canonical list in seed-data.ts. This
    // used to live in seed.ts, but seed only runs when RUN_SEED_ON_BOOT=true
    // (off in prod after first deploy) so newly added categories never made
    // it to production. Migrations run on every boot in prod, so dropping
    // categories here means adding one is a code change away from being live.
    // ON CONFLICT DO NOTHING preserves any manual category edits an operator
    // may have made via DB directly.
    for (const c of CATEGORIES) {
      await sql`
        INSERT INTO categories (id, label, short, color)
        VALUES (${c.id}, ${c.label}, ${c.short}, ${c.color})
        ON CONFLICT (id) DO NOTHING
      `;
    }
  } finally {
    await sql.end();
  }
}

// CLI entry — allows `npm run db:migrate` and `node server/dist/db/migrate.js` to keep working.
const isCli = import.meta.url === `file://${process.argv[1]}`
           || process.argv[1]?.endsWith('migrate.js')
           || process.argv[1]?.endsWith('migrate.ts');
if (isCli) {
  runMigrations()
    .then(() => {
      console.log('Migrations applied.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
