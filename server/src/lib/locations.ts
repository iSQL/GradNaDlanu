import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { locations } from '../db/schema.js';

const DIACRITIC_MAP: Record<string, string> = {
  č: 'c', ć: 'c', š: 's', ž: 'z', đ: 'dj',
  Č: 'c', Ć: 'c', Š: 's', Ž: 'z', Đ: 'dj',
};

const MAX_SLUG_LENGTH = 100;

export class InvalidSlugError extends Error {
  constructor(input: string) {
    super(`slugify produced an empty result for input: ${JSON.stringify(input)}`);
    this.name = 'InvalidSlugError';
  }
}

export function slugify(s: string): string {
  // NFKD decomposes combining-character variants (e.g. č as c + U+030C) so
  // they get stripped by the ASCII filter below instead of slipping through.
  const normalized = s.normalize('NFKD');
  const out = normalized
    .split('')
    .map((ch) => DIACRITIC_MAP[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
  if (out.length === 0) throw new InvalidSlugError(s);
  return out;
}

export async function getLocationBySlug(slug: string) {
  const [row] = await db.select().from(locations).where(eq(locations.slug, slug)).limit(1);
  return row ?? null;
}

// Escapes LIKE/ILIKE metacharacters (% and _) and backslashes so a user-supplied
// search term can't widen a query. Pair with `ESCAPE '\'` if you need
// backslash-escape semantics — drizzle's ilike() uses default escape rules.
export function escapeLikePattern(s: string): string {
  return s.replace(/[\\%_]/g, '\\$&');
}

const MAX_CONTENT_BYTES = 50 * 1024;

// Bounds-check arbitrary jsonb content payloads (module_content.content).
// Per-category schema validation could go on top of this later; for now this
// just prevents DoS via storage exhaustion.
export function validateContent(content: unknown): { ok: true } | { ok: false; error: string } {
  if (content === null || content === undefined) return { ok: true };
  if (typeof content !== 'object') return { ok: false, error: 'content must be an object' };
  let size = 0;
  try { size = JSON.stringify(content).length; } catch { return { ok: false, error: 'content not serialisable' }; }
  if (size > MAX_CONTENT_BYTES) return { ok: false, error: `content too large (max ${MAX_CONTENT_BYTES} bytes)` };
  return { ok: true };
}
