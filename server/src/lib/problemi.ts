// Kategorije prijava komunalnih problema ("Problemi"). Nemaju veze sa
// `categories` tabelom objekata — postoje samo kao enum prijava. Mora
// odgovarati web/src/lib/problemi.ts — kopirano namerno, dva workspace-a
// (isti obrazac kao SELA_ZABARI i SERVICE_CATEGORIES).
export const PROBLEM_CATEGORIES = [
  'saobracaj',
  'zelenilo',
  'otpad',
  'vodovod',
  'urbana',
  'ostalo',
] as const;

export type ProblemCategory = (typeof PROBLEM_CATEGORIES)[number];

export function isProblemCategory(value: unknown): value is ProblemCategory {
  return typeof value === 'string' && (PROBLEM_CATEGORIES as readonly string[]).includes(value);
}

export const TITLE_MIN = 4;
export const TITLE_MAX = 120;
export const DESCRIPTION_MIN = 5;
export const DESCRIPTION_MAX = 2000;
export const ADDRESS_MAX = 120;
export const COMMENT_MAX = 1000;

// Grubi bounding box opštine Žabari — odbija očigledno besmislene koordinate
// (0/0, druga hemisfera…), a dovoljno širok da ne odbije ništa legitimno.
const LAT_MIN = 44.2;
const LAT_MAX = 44.5;
const LNG_MIN = 21.0;
const LNG_MAX = 21.5;

export interface ProblemInput {
  catId: ProblemCategory;
  title: string;
  description: string;
  village: string;
  address: string | null;
  lat: number;
  lng: number;
  photoMediaId: number | null;
}

// Validira sirovo telo POST /api/problemi. Vraća ili normalizovan input ili
// poruku greške (na srpskom — ide direktno u UI).
export function validateProblemInput(
  raw: unknown,
  isVillage: (v: unknown) => boolean,
): { ok: true; value: ProblemInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Neispravan zahtev.' };
  const b = raw as Record<string, unknown>;

  if (!isProblemCategory(b.catId)) return { ok: false, error: 'Nepoznata kategorija problema.' };

  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    return { ok: false, error: `Naslov mora imati između ${TITLE_MIN} i ${TITLE_MAX} karaktera.` };
  }

  const description = typeof b.description === 'string' ? b.description.trim() : '';
  if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
    return { ok: false, error: 'Unesite opis problema.' };
  }

  if (!isVillage(b.village)) return { ok: false, error: 'Nepoznato naselje.' };

  let address: string | null = null;
  if (typeof b.address === 'string' && b.address.trim()) {
    address = b.address.trim().slice(0, ADDRESS_MAX);
  }

  const lat = typeof b.lat === 'number' ? b.lat : NaN;
  const lng = typeof b.lng === 'number' ? b.lng : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: 'Postavite lokaciju problema (GPS ili mapa).' };
  }
  if (lat < LAT_MIN || lat > LAT_MAX || lng < LNG_MIN || lng > LNG_MAX) {
    return { ok: false, error: 'Lokacija je van područja opštine Žabari.' };
  }

  let photoMediaId: number | null = null;
  if (b.photoMediaId !== undefined && b.photoMediaId !== null) {
    const id = Number(b.photoMediaId);
    if (!Number.isInteger(id) || id < 1) return { ok: false, error: 'Neispravna fotografija.' };
    photoMediaId = id;
  }

  return {
    ok: true,
    value: { catId: b.catId, title, description, village: b.village as string, address, lat, lng, photoMediaId },
  };
}
