import postgres from 'postgres';
import { env } from '../env.js';

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
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    email_verified_at TIMESTAMP
  )`,
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
  `CREATE INDEX IF NOT EXISTS service_requests_loc_status_idx ON service_requests(location_id, status)`,
  `CREATE INDEX IF NOT EXISTS service_requests_user_created_idx ON service_requests(user_id, created_at DESC)`,
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
