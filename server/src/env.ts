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

function readAppUrl(): string {
  const v = process.env.APP_URL?.trim();
  if (v && /^https?:\/\//i.test(v)) {
    return v.replace(/\/+$/, '');
  }
  // Sensible defaults: prod must have it explicitly set if the verification link
  // should point at a real domain. Falling back to localhost in dev keeps the
  // happy path painless.
  if (isProduction) {
    // Try to derive from APP_DOMAIN if APP_URL isn't set.
    const dom = process.env.APP_DOMAIN?.trim();
    if (dom) return `https://${dom.replace(/\/+$/, '')}`;
  }
  return 'http://localhost:5173';
}

function readEmailFrom(): string {
  const v = process.env.EMAIL_FROM?.trim();
  if (v) return v;
  if (isProduction) {
    // Not fatal — registration still works, but emails will fail. We surface a
    // clear console warning instead of refusing to boot so other features keep
    // working. Operators see the warning in logs on first boot.
    console.warn('[env] EMAIL_FROM is not set — verification emails will fail.');
  }
  return 'noreply@example.com';
}

function readLogDir(): string {
  const v = process.env.LOG_DIR?.trim();
  if (v) return v;
  if (isProduction) return '/storage/logs';
  // Dev: resolve to <repo-root>/storage/logs regardless of which workspace cwd
  // the script was invoked from (npm workspaces shift cwd; an unstable default
  // path would scatter logs across two dirs depending on the invocation).
  return resolve(here, '../../storage/logs');
}

function readLogRetentionDays(): number {
  const v = process.env.LOG_RETENTION_DAYS;
  if (!v) return 7;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return 7;
  return Math.floor(n);
}

function readCorsOrigin(): string | string[] | false {
  const v = process.env.CORS_ORIGIN;
  if (isProduction) {
    // In production the API also serves the SPA from the same origin, so CORS
    // is unnecessary by default. Operators who want a separate frontend host
    // must opt in with one or more explicit https:// origins.
    if (!v) return false;
    const origins = v.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    if (origins.length === 0) return false;
    for (const o of origins) {
      if (o === '*') {
        throw new Error('CORS_ORIGIN must not include "*" in production.');
      }
      if (!o.startsWith('https://')) {
        throw new Error(`CORS_ORIGIN entries must use https:// in production (got "${o}").`);
      }
    }
    return origins.length === 1 ? origins[0] : origins;
  }
  if (!v) return 'http://localhost:5173';
  const origins = v.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (origins.length === 0) return 'http://localhost:5173';
  return origins.length === 1 ? origins[0] : origins;
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
  // Email / verification. RESEND_API_KEY is optional in dev — when missing we
  // log verification links to the console instead of sending. EMAIL_FROM and
  // APP_URL are used to compose the message and the verification link.
  resendApiKey: process.env.RESEND_API_KEY?.trim() || null,
  emailFrom: readEmailFrom(),
  appUrl: readAppUrl(),
  // Rolling daily log files. Default `/storage/logs` in prod (mount a Coolify
  // Persistent Storage volume here), `./storage/logs` in dev (gitignored).
  logDir: readLogDir(),
  logRetentionDays: readLogRetentionDays(),
};
