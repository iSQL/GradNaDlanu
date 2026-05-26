import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// Try repo-root .env (dev). In docker the env vars come from compose, so this
// falls through silently when the file doesn't exist.
config({ path: resolve(here, '../../.env') });
config({ override: false });

const isProduction = process.env.NODE_ENV === 'production';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v === 'true' || v === '1';
}

// Placeholders that ship in .env.example — refusing them prevents an operator
// from accidentally booting a public deploy with a publicly-known secret.
const JWT_PLACEHOLDERS = new Set([
  'change-me-to-a-long-random-string',
  'change-me',
  'secret',
  'dev',
  'devsecret',
]);

function validateJwtSecret(value: string): string {
  if (JWT_PLACEHOLDERS.has(value)) {
    throw new Error('JWT_SECRET is set to a known placeholder value. Generate one with `openssl rand -base64 48`.');
  }
  if (value.length < 32) {
    throw new Error(`JWT_SECRET must be at least 32 characters (got ${value.length}).`);
  }
  return value;
}

const WEAK_ADMIN_PASSWORDS = new Set([
  'admin', 'password', '123456', 'changeme', 'change-me', 'root', 'qwerty',
]);

function readAdminPassword(): string {
  const v = process.env.ADMIN_PASSWORD;
  if (isProduction) {
    if (!v) {
      throw new Error('ADMIN_PASSWORD must be set explicitly in production (no default permitted).');
    }
    if (WEAK_ADMIN_PASSWORDS.has(v.toLowerCase())) {
      throw new Error('ADMIN_PASSWORD is set to a well-known weak value. Choose a strong password.');
    }
    if (v.length < 12) {
      throw new Error(`ADMIN_PASSWORD must be at least 12 characters in production (got ${v.length}).`);
    }
  }
  return v ?? 'admin';
}

function readCorsOrigin(): string | false {
  const v = process.env.CORS_ORIGIN;
  if (isProduction) {
    // In production the API also serves the SPA from the same origin, so CORS
    // is unnecessary by default. Operators who want a separate frontend host
    // must opt in with an explicit https:// origin.
    if (!v) return false;
    if (v === '*' || v.includes(',')) {
      throw new Error('CORS_ORIGIN must be a single concrete origin in production (no "*" or comma lists).');
    }
    if (!v.startsWith('https://')) {
      throw new Error('CORS_ORIGIN must use https:// in production.');
    }
    return v;
  }
  return v ?? 'http://localhost:5173';
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  port: Number(process.env.PORT ?? 3000),
  isProduction,
  jwtSecret: validateJwtSecret(required('JWT_SECRET')),
  corsOrigin: readCorsOrigin(),
  adminUsername: process.env.ADMIN_USERNAME ?? 'admin',
  adminPassword: readAdminPassword(),
  // Default true in production (NODE_ENV=production), false in dev so existing
  // workflows (`npm run dev`) keep using the explicit `npm run db:migrate` path.
  runMigrationsOnBoot: bool('RUN_MIGRATIONS_ON_BOOT', isProduction),
  runSeedOnBoot: bool('RUN_SEED_ON_BOOT', false),
  uploadDir: process.env.UPLOAD_DIR
    ?? (isProduction ? '/data/uploads' : './uploads'),
};
