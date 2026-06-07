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

// Whitelist ključeva koje kustos sme da edituje u `module_content.content` po
// kategoriji. Sve van whitelist-a se zadržava iz `oldContent` (npr. menu/services/
// rooms/programs ostaju netaknuti čak i ako klijent pokuša da ih pošalje).
// Landmark dobija pun pristup.
const CURATOR_ALLOWED_CONTENT_KEYS: Record<string, ReadonlySet<string> | 'ALL'> = {
  cafe:           new Set(['tagline', 'hours', 'contact']),
  public:         new Set(['tagline', 'hours', 'contact']),
  landmark:       'ALL',
  hotel:          new Set(['tagline', 'contact', 'facts']),
  school:         new Set(['tagline', 'contact', 'facts']),
  vodoinstalater: new Set(['tagline', 'contact', 'note']),
  elektricar:     new Set(['tagline', 'contact', 'note']),
  automehanicar:  new Set(['tagline', 'contact', 'note']),
};

/**
 * Spaja patch sa starim sadržajem za kustos PATCH put. Pravi rezultat sa:
 *   - svim ključevima koje kustos NE sme da edituje preslikanim iz oldContent
 *   - ključevima iz patch-a koji jesu na whitelist-i
 * Ako klijent pošalje ključ van whitelist-a koji bi modifikovao postojeću
 * vrednost, vraćamo grešku — tiho ignorisanje bi sakrilo silentne greške u UI.
 */
export function mergeCuratorContent(
  catId: string,
  oldContent: unknown,
  patch: unknown,
): { ok: true; merged: Record<string, unknown> } | { ok: false; error: string } {
  if (patch === null || patch === undefined) return { ok: true, merged: (oldContent as Record<string, unknown>) ?? {} };
  if (typeof patch !== 'object' || Array.isArray(patch)) {
    return { ok: false, error: 'content must be an object' };
  }
  const allowed = CURATOR_ALLOWED_CONTENT_KEYS[catId];
  if (allowed === undefined) {
    return { ok: false, error: `kustos ne sme da edituje sadržaj kategorije '${catId}'` };
  }
  const oldObj = (oldContent && typeof oldContent === 'object' && !Array.isArray(oldContent))
    ? (oldContent as Record<string, unknown>)
    : {};
  if (allowed === 'ALL') {
    return { ok: true, merged: { ...oldObj, ...(patch as Record<string, unknown>) } };
  }
  const patchObj = patch as Record<string, unknown>;
  // Refuse the request if it touches a forbidden key — explicit failure beats
  // silently dropping a field the curator clearly intended to save.
  for (const key of Object.keys(patchObj)) {
    if (!allowed.has(key)) {
      return { ok: false, error: `kustos ne sme da edituje '${key}' u kategoriji '${catId}'` };
    }
  }
  return { ok: true, merged: { ...oldObj, ...patchObj } };
}
