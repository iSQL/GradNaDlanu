import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// Try repo-root .env (dev). In docker the env vars come from compose, so this
// falls through silently when the file doesn't exist.
config({ path: resolve(here, '../../.env') });
config({ override: false });

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

export const env = {
  databaseUrl: required('DATABASE_URL'),
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: required('JWT_SECRET'),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  adminUsername: process.env.ADMIN_USERNAME ?? 'admin',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin',
  // Default true in production (NODE_ENV=production), false in dev so existing
  // workflows (`npm run dev`) keep using the explicit `npm run db:migrate` path.
  runMigrationsOnBoot: bool('RUN_MIGRATIONS_ON_BOOT', process.env.NODE_ENV === 'production'),
  runSeedOnBoot: bool('RUN_SEED_ON_BOOT', false),
  uploadDir: process.env.UPLOAD_DIR
    ?? (process.env.NODE_ENV === 'production' ? '/data/uploads' : './uploads'),
};
