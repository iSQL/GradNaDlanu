import { sql } from './client.js';

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
  `CREATE TABLE IF NOT EXISTS admin_users (
    id            SERIAL PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS locations_cat_id_idx ON locations(cat_id)`,
  `CREATE INDEX IF NOT EXISTS locations_status_idx ON locations(status)`,
];

async function main() {
  for (const stmt of statements) {
    await sql.unsafe(stmt);
  }
  console.log('Migrations applied.');
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
