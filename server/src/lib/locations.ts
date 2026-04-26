import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { locations } from '../db/schema.js';

const DIACRITIC_MAP: Record<string, string> = {
  č: 'c', ć: 'c', š: 's', ž: 'z', đ: 'dj',
  Č: 'c', Ć: 'c', Š: 's', Ž: 'z', Đ: 'dj',
};

export function slugify(s: string): string {
  return s
    .split('')
    .map((ch) => DIACRITIC_MAP[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function getLocationBySlug(slug: string) {
  const [row] = await db.select().from(locations).where(eq(locations.slug, slug)).limit(1);
  return row ?? null;
}
