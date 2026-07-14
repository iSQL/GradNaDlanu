import { MAJSTOR_CATEGORIES } from './serviceRequests.js';

// Kategorije usluga za broadcast zahteve ("Usluge"). Superset majstorskih
// kategorija objekata: 'bela-tehnika' i 'majstor-za-sve' postoje SAMO kao
// kategorije usluga (nemaju objekte na mapi ni red u `categories` tabeli).
// Mora odgovarati web/src/lib/usluge.ts — kopirano namerno, dva workspace-a.
export const SERVICE_CATEGORIES = [
  ...MAJSTOR_CATEGORIES,
  'bela-tehnika',
  'majstor-za-sve',
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export function isServiceCategory(value: unknown): value is ServiceCategory {
  return typeof value === 'string' && (SERVICE_CATEGORIES as readonly string[]).includes(value);
}

export interface ServiceJobPayload {
  description: string;
  note?: string;
  photoIds: number[];
}

export function validateJobPayload(
  body: unknown,
): { ok: true; payload: ServiceJobPayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be an object' };
  const b = body as Record<string, unknown>;
  const { description, note, photoIds } = b;
  if (typeof description !== 'string' || description.trim().length < 5) {
    return { ok: false, error: 'description: tekst opisa mora imati barem 5 karaktera' };
  }
  if (description.length > 2000) {
    return { ok: false, error: 'description: tekst opisa može imati najviše 2000 karaktera' };
  }
  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 1000)) {
    return { ok: false, error: 'note: tekst do 1000 karaktera' };
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
  const trimmedNote = typeof note === 'string' ? note.trim() : '';
  return {
    ok: true,
    payload: {
      description: description.trim(),
      ...(trimmedNote ? { note: trimmedNote } : {}),
      photoIds: photoIds as number[],
    },
  };
}

// null/undefined = broadcast svim majstorima kategorije; inače neprazan niz
// ID-eva izabranih majstora (dedupe, najviše 50).
export function validateTargetUserIds(
  value: unknown,
): { ok: true; ids: number[] | null } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, ids: null };
  if (!Array.isArray(value)) {
    return { ok: false, error: 'targetUserIds: niz brojeva ili null' };
  }
  for (const v of value) {
    if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) {
      return { ok: false, error: 'targetUserIds: svi ID-evi moraju biti pozitivni celi brojevi' };
    }
  }
  const ids = [...new Set(value as number[])];
  if (ids.length === 0) {
    return { ok: false, error: 'Izaberite bar jednog majstora ili pošaljite svima.' };
  }
  if (ids.length > 50) {
    return { ok: false, error: 'targetUserIds: najviše 50 majstora' };
  }
  return { ok: true, ids };
}
