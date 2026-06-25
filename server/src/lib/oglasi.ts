import type { AdCategory, AdContactMethod } from '../db/schema.js';

// Validacija oglasa za "Oglasnu tablu". Granice se ogledaju na klijentu u
// web/src/components/AdForm.tsx — menjaj oba mesta zajedno.

export const AD_CATEGORIES = ['prodajem', 'kupujem', 'usluge', 'poslovi', 'ostalo'] as const;
export const AD_CONTACT_METHODS = ['link', 'phone', 'email', 'message'] as const;

export const TITLE_MIN = 3;
export const TITLE_MAX = 120;
export const DESCRIPTION_MIN = 5;
export const DESCRIPTION_MAX = 4000;
export const PRICE_MAX = 1_000_000_000;
export const MAX_ACTIVE_ADS_PER_USER = 10;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Telefon: cifre, razmaci, +, -, zagrade, kose crte; 6–20 znakova ukupno.
const PHONE_RE = /^[0-9+()\-/\s]{6,20}$/;

export interface AdInput {
  title: string;
  description: string;
  category: AdCategory;
  priceRsd: number | null;
  village: string;
  photoMediaId: number | null;
  contactMethod: AdContactMethod;
  contactValue: string | null;
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// `isVillageFn` injektujemo da lib ostane bez zavisnosti od villages liste
// (poziva ga route iz server/src/lib/villages.ts isVillage).
export function validateAdInput(
  body: unknown,
  isVillageFn: (v: unknown) => boolean,
): { ok: true; value: AdInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Telo mora biti objekat' };
  const b = body as Record<string, unknown>;

  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    return { ok: false, error: `title: naslov mora imati ${TITLE_MIN}–${TITLE_MAX} karaktera` };
  }

  const description = typeof b.description === 'string' ? b.description.trim() : '';
  if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
    return {
      ok: false,
      error: `description: opis mora imati ${DESCRIPTION_MIN}–${DESCRIPTION_MAX} karaktera`,
    };
  }

  if (typeof b.category !== 'string' || !(AD_CATEGORIES as readonly string[]).includes(b.category)) {
    return { ok: false, error: 'category: nepoznata kategorija' };
  }
  const category = b.category as AdCategory;

  let priceRsd: number | null = null;
  if (b.priceRsd !== undefined && b.priceRsd !== null && b.priceRsd !== '') {
    const n = typeof b.priceRsd === 'number' ? b.priceRsd : Number(b.priceRsd);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > PRICE_MAX) {
      return { ok: false, error: 'priceRsd: nenegativan ceo broj' };
    }
    priceRsd = n;
  }

  if (!isVillageFn(b.village)) {
    return { ok: false, error: 'village: nepoznato naselje' };
  }
  const village = b.village as string;

  let photoMediaId: number | null = null;
  if (b.photoMediaId !== undefined && b.photoMediaId !== null && b.photoMediaId !== '') {
    const n = typeof b.photoMediaId === 'number' ? b.photoMediaId : Number(b.photoMediaId);
    if (!Number.isInteger(n) || n <= 0) {
      return { ok: false, error: 'photoMediaId: pozitivan ceo broj' };
    }
    photoMediaId = n;
  }

  if (
    typeof b.contactMethod !== 'string' ||
    !(AD_CONTACT_METHODS as readonly string[]).includes(b.contactMethod)
  ) {
    return { ok: false, error: 'contactMethod: nepoznat način kontakta' };
  }
  const contactMethod = b.contactMethod as AdContactMethod;

  let contactValue: string | null = null;
  if (contactMethod === 'message') {
    contactValue = null; // poruke unutar sajta — nema spoljnog kontakta
  } else {
    const raw = typeof b.contactValue === 'string' ? b.contactValue.trim() : '';
    if (!raw) return { ok: false, error: 'contactValue: obavezno za izabrani način kontakta' };
    if (contactMethod === 'link' && !isHttpUrl(raw)) {
      return { ok: false, error: 'contactValue: unesite ispravan http(s) link' };
    }
    if (contactMethod === 'phone' && !PHONE_RE.test(raw)) {
      return { ok: false, error: 'contactValue: unesite ispravan broj telefona' };
    }
    if (contactMethod === 'email' && (raw.length > 254 || !EMAIL_RE.test(raw))) {
      return { ok: false, error: 'contactValue: unesite ispravan mejl' };
    }
    contactValue = raw;
  }

  return {
    ok: true,
    value: { title, description, category, priceRsd, village, photoMediaId, contactMethod, contactValue },
  };
}

export function validateMessageBody(
  raw: unknown,
): { ok: true; body: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') return { ok: false, error: 'body: tekst poruke je obavezan' };
  const body = raw.trim();
  if (body.length < 1) return { ok: false, error: 'body: poruka ne sme biti prazna' };
  if (body.length > 2000) return { ok: false, error: 'body: poruka može imati najviše 2000 karaktera' };
  return { ok: true, body };
}
