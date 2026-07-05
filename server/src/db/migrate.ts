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
  `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','business','user','guest','curator','majstor'))`,
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
  // "Moj prostor" notification badge anchors. DEFAULT NOW() means existing users
  // start "caught up" (no flood of historical items), only new activity counts.
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS reservations_seen_at TIMESTAMP NOT NULL DEFAULT NOW()`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS feed_seen_at TIMESTAMP NOT NULL DEFAULT NOW()`,
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
  // Newsletter v2: double opt-in status, per-category consent, capability token,
  // optional account link. ADD COLUMN IF NOT EXISTS so existing pre-consent rows
  // gain the columns (defaulting to status='pending', token NULL) without a rewrite.
  `ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'`,
  `ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS pref_desavanja BOOLEAN NOT NULL DEFAULT TRUE`,
  `ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS pref_poruke BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS pref_marketing BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS token TEXT`,
  `ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP`,
  `ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMP`,
  `ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_token_idx ON newsletter_subscribers(token)`,
  `CREATE TABLE IF NOT EXISTS alumni (
    id                SERIAL PRIMARY KEY,
    location_id       INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    full_name         TEXT NOT NULL,
    graduation_year   INTEGER NOT NULL,
    homeroom_teacher  TEXT NOT NULL,
    motto             TEXT NOT NULL,
    email             TEXT,
    photo_media_id    INTEGER REFERENCES media(id) ON DELETE SET NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS alumni_loc_year_idx ON alumni(location_id, graduation_year)`,
  `CREATE INDEX IF NOT EXISTS alumni_loc_name_idx ON alumni(location_id, full_name)`,
  // --- Naselja + village_curators ---
  // `villages.name` je PK i mora odgovarati SELA_ZABARI listi u lib/villages.ts —
  // ali ne stavljamo FK constraint na locations.village ovde, da bismo zadržali
  // postojeću application-layer validaciju (isVillage).
  `CREATE TABLE IF NOT EXISTS villages (
    name                    TEXT PRIMARY KEY,
    population_census_2002  INTEGER,
    population_census_2022  INTEGER,
    area_km2                NUMERIC(6,2),
    distance_km             NUMERIC(5,2),
    direction               TEXT,
    lat                     NUMERIC(8,5),
    lon                     NUMERIC(8,5),
    is_seat                 BOOLEAN NOT NULL DEFAULT FALSE,
    story                   TEXT,
    updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS village_curators (
    user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    village_name         TEXT NOT NULL REFERENCES villages(name) ON DELETE CASCADE,
    granted_by_admin_id  INTEGER REFERENCES users(id),
    granted_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, village_name)
  )`,
  `CREATE INDEX IF NOT EXISTS village_curators_village_idx ON village_curators(village_name)`,
  // --- Oglasna tabla (ads) + in-site messaging (conversations + messages) ---
  `CREATE TABLE IF NOT EXISTS ads (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title             TEXT NOT NULL,
    description       TEXT NOT NULL,
    category          TEXT NOT NULL
      CHECK (category IN ('prodajem','kupujem','usluge','poslovi','ostalo')),
    price_rsd         INTEGER CHECK (price_rsd IS NULL OR price_rsd >= 0),
    village           TEXT NOT NULL,
    photo_media_id    INTEGER REFERENCES media(id) ON DELETE SET NULL,
    contact_method    TEXT NOT NULL
      CHECK (contact_method IN ('link','phone','email','message')),
    contact_value     TEXT,
    status            TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active','archived')),
    permanent         BOOLEAN NOT NULL DEFAULT FALSE,
    last_refreshed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    archived_at       TIMESTAMP,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE ads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`,
  // Backfill archived_at for any rows archived before this column existed so the
  // retention purge has a reference date (otherwise they'd never be purged).
  `UPDATE ads SET archived_at = COALESCE(updated_at, created_at) WHERE status = 'archived' AND archived_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS ads_status_created_idx ON ads(status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS ads_status_cat_village_idx ON ads(status, category, village)`,
  `CREATE INDEX IF NOT EXISTS ads_user_idx ON ads(user_id, status)`,
  `CREATE INDEX IF NOT EXISTS ads_sweep_idx ON ads(last_refreshed_at) WHERE status = 'active' AND NOT permanent`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id                 SERIAL PRIMARY KEY,
    ad_id              INTEGER REFERENCES ads(id) ON DELETE CASCADE,
    ad_title_snapshot  TEXT,
    user_low_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_high_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    last_read_low_at   TIMESTAMP,
    last_read_high_at  TIMESTAMP,
    created_at         TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  // Upgrade ad_id FK from the original SET NULL to CASCADE on existing DBs so a
  // purged ad takes its conversations + messages with it. Idempotent: drop both
  // possible auto-generated names, then re-add the CASCADE constraint.
  `ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_ad_id_fkey`,
  `ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_ad_id_ads_id_fk`,
  `ALTER TABLE conversations ADD CONSTRAINT conversations_ad_id_fkey FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE`,
  `CREATE UNIQUE INDEX IF NOT EXISTS conversations_pair_ad_uniq ON conversations(user_low_id, user_high_id, COALESCE(ad_id, 0))`,
  `CREATE INDEX IF NOT EXISTS conversations_low_idx ON conversations(user_low_id, last_message_at DESC)`,
  `CREATE INDEX IF NOT EXISTS conversations_high_idx ON conversations(user_high_id, last_message_at DESC)`,
  `CREATE TABLE IF NOT EXISTS messages (
    id               SERIAL PRIMARY KEY,
    conversation_id  INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body             TEXT NOT NULL,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS messages_conv_created_idx ON messages(conversation_id, created_at)`,
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
  // --- Usluge: majstori po kategorijama + broadcast zahtevi + kontraponude ---
  // category_id nema FK ka categories: 'bela-tehnika' i 'majstor-za-sve' postoje
  // samo kao kategorije usluga (SERVICE_CATEGORIES u lib/usluge.ts).
  `CREATE TABLE IF NOT EXISTS majstor_categories (
    user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id          TEXT NOT NULL,
    granted_by_admin_id  INTEGER REFERENCES users(id),
    granted_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, category_id)
  )`,
  `CREATE INDEX IF NOT EXISTS majstor_categories_category_idx ON majstor_categories(category_id)`,
  `CREATE TABLE IF NOT EXISTS service_jobs (
    id                 SERIAL PRIMARY KEY,
    user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id        TEXT NOT NULL,
    payload            JSONB NOT NULL,
    target_user_ids    JSONB,
    status             TEXT NOT NULL DEFAULT 'open'
      CHECK (status IN ('open','accepted','completed','cancelled')),
    accepted_offer_id  INTEGER,
    created_at         TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS service_jobs_cat_status_idx ON service_jobs(category_id, status)`,
  `CREATE INDEX IF NOT EXISTS service_jobs_user_created_idx ON service_jobs(user_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS service_offers (
    id               SERIAL PRIMARY KEY,
    job_id           INTEGER NOT NULL REFERENCES service_jobs(id) ON DELETE CASCADE,
    majstor_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quote            JSONB NOT NULL,
    status           TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active','accepted','archived')),
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT service_offers_job_majstor_uq UNIQUE (job_id, majstor_user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS service_offers_job_idx ON service_offers(job_id)`,
  `CREATE INDEX IF NOT EXISTS service_offers_majstor_idx ON service_offers(majstor_user_id)`,
  // Badge sidra za usluge (naručilac) i majstorski panel (majstor).
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS usluge_seen_at TIMESTAMP NOT NULL DEFAULT NOW()`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS majstor_seen_at TIMESTAMP NOT NULL DEFAULT NOW()`,
  // Kontakt telefon (majstori) — otkriva se naručiocu tek posle prihvatanja ponude.
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`,
  // --- Usluge: završetak posla + ocenjivanje majstora ---
  // Status 'completed' (accepted → completed, označava bilo koja strana). CHECK
  // se menja drop+add obrascem (kao users_role_check) da uhvati postojeće baze.
  `ALTER TABLE service_jobs DROP CONSTRAINT IF EXISTS service_jobs_status_check`,
  `ALTER TABLE service_jobs ADD CONSTRAINT service_jobs_status_check
     CHECK (status IN ('open','accepted','completed','cancelled'))`,
  `ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP`,
  `ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS completed_by INTEGER REFERENCES users(id)`,
  // Ocena visi o PRIHVAĆENOJ ponudi (1 prihvaćena ↔ 1 završen posao ↔ ≤1 ocena).
  // Dužina komentara (≤160) se validira na app sloju, kao i kategorije.
  `ALTER TABLE service_offers ADD COLUMN IF NOT EXISTS rating_stars SMALLINT`,
  `ALTER TABLE service_offers ADD COLUMN IF NOT EXISTS rating_comment TEXT`,
  `ALTER TABLE service_offers ADD COLUMN IF NOT EXISTS rated_at TIMESTAMP`,
  `ALTER TABLE service_offers DROP CONSTRAINT IF EXISTS service_offers_rating_stars_check`,
  `ALTER TABLE service_offers ADD CONSTRAINT service_offers_rating_stars_check
     CHECK (rating_stars IS NULL OR rating_stars BETWEEN 1 AND 5)`,
  // Badge sidro za vlasnike: novi komentari na objektima u vlasništvu.
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_comments_seen_at TIMESTAMP NOT NULL DEFAULT NOW()`,
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
