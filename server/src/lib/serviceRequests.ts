import type { ServiceRequestStatus } from '../db/schema.js';

export interface ServiceRequestPayload {
  description: string;
  photoIds: number[];
}

export interface ServiceRequestQuote {
  priceRsd: number;
  note: string;
  availableDate: string; // YYYY-MM-DD
}

export const MAJSTOR_CATEGORIES = ['vodoinstalater', 'elektricar', 'automehanicar'] as const;
export type MajstorCategory = (typeof MAJSTOR_CATEGORIES)[number];

export function isMajstorCategory(catId: string): catId is MajstorCategory {
  return (MAJSTOR_CATEGORIES as readonly string[]).includes(catId);
}

export function validateRequestPayload(
  body: unknown,
): { ok: true; payload: ServiceRequestPayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be an object' };
  const b = body as Record<string, unknown>;
  const description = b.description;
  const photoIds = b.photoIds;
  if (typeof description !== 'string' || description.trim().length < 5) {
    return { ok: false, error: 'description: tekst opisa mora imati barem 5 karaktera' };
  }
  if (description.length > 2000) {
    return { ok: false, error: 'description: tekst opisa može imati najviše 2000 karaktera' };
  }
  if (!Array.isArray(photoIds)) {
    return { ok: false, error: 'photoIds: niz brojeva' };
  }
  if (photoIds.length > 4) {
    return { ok: false, error: 'photoIds: najviše 4 slike po zahtevu' };
  }
  for (const p of photoIds) {
    if (typeof p !== 'number' || !Number.isInteger(p) || p <= 0) {
      return { ok: false, error: 'photoIds: svi ID-evi moraju biti pozitivni celi brojevi' };
    }
  }
  return { ok: true, payload: { description: description.trim(), photoIds: photoIds as number[] } };
}

export function validateQuote(
  body: unknown,
): { ok: true; quote: ServiceRequestQuote } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be an object' };
  const b = body as Record<string, unknown>;
  const { priceRsd, note, availableDate } = b;
  if (typeof priceRsd !== 'number' || !Number.isFinite(priceRsd) || priceRsd < 0) {
    return { ok: false, error: 'priceRsd: nenegativan broj' };
  }
  if (priceRsd > 10_000_000) {
    return { ok: false, error: 'priceRsd: previsoka cena' };
  }
  if (typeof note !== 'string' || note.length > 1000) {
    return { ok: false, error: 'note: tekst do 1000 karaktera' };
  }
  if (typeof availableDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(availableDate)) {
    return { ok: false, error: 'availableDate: format YYYY-MM-DD' };
  }
  return { ok: true, quote: { priceRsd, note: note.trim(), availableDate } };
}

// Returns true if a transition is allowed; false otherwise.
export function canTransition(
  from: ServiceRequestStatus,
  to: ServiceRequestStatus,
  actor: 'visitor' | 'owner',
  hasQuote: boolean,
): boolean {
  if (from === to) return false;

  if (actor === 'visitor') {
    // Visitor may cancel from pending/quoted, or accept a quote.
    if (to === 'cancelled') return from === 'pending' || from === 'quoted';
    if (to === 'accepted') return from === 'quoted' && hasQuote;
    return false;
  }

  // owner (or admin)
  if (to === 'quoted') return from === 'pending' && hasQuote;
  if (to === 'declined') return from === 'pending' || from === 'quoted';
  if (to === 'completed') return from === 'accepted';
  return false;
}
