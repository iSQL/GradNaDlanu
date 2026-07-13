// Validacija "Zaboravljenih bisera" — stara fotografija + priča na tačnom
// mestu snimka. Nema kategorija: filtrira se po deceniji (izvedena iz godine)
// i selu. Bounding box i obrazac validacije prate lib/problemi.ts.

export const TITLE_MIN = 4;
export const TITLE_MAX = 120;
export const STORY_MIN = 10;
export const STORY_MAX = 4000;
export const COMMENT_MAX = 1000;

// Fotografija starija od fotografije ne postoji — a "stara" prestaje da bude
// stara negde oko juče. Gornju granicu držimo na tekućoj godini: kustos
// odobrava sadržaj, pa preterano sveže fotke ionako ne prolaze.
export const YEAR_MIN = 1850;

// Grubi bounding box opštine Žabari — isti kao za prijave problema.
const LAT_MIN = 44.2;
const LAT_MAX = 44.5;
const LNG_MIN = 21.0;
const LNG_MAX = 21.5;

export interface BiserInput {
  title: string;
  year: number;
  village: string;
  story: string;
  lat: number;
  lng: number;
  photoMediaId: number;
  nowPhotoMediaId: number | null;
}

// Validira sirovo telo POST /api/biseri. Vraća normalizovan input ili poruku
// greške (na srpskom — ide direktno u UI).
export function validateBiserInput(
  raw: unknown,
  isVillage: (v: unknown) => boolean,
): { ok: true; value: BiserInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Neispravan zahtev.' };
  const b = raw as Record<string, unknown>;

  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    return { ok: false, error: `Naslov mora imati između ${TITLE_MIN} i ${TITLE_MAX} karaktera.` };
  }

  const year = typeof b.year === 'number' ? Math.floor(b.year) : NaN;
  const yearMax = new Date().getUTCFullYear();
  if (!Number.isInteger(year) || year < YEAR_MIN || year > yearMax) {
    return { ok: false, error: `Godina mora biti između ${YEAR_MIN}. i ${yearMax}.` };
  }

  if (!isVillage(b.village)) return { ok: false, error: 'Nepoznato naselje.' };

  const story = typeof b.story === 'string' ? b.story.trim() : '';
  if (story.length < STORY_MIN || story.length > STORY_MAX) {
    return { ok: false, error: 'Unesite priču ili anegdotu uz fotografiju.' };
  }

  const lat = typeof b.lat === 'number' ? b.lat : NaN;
  const lng = typeof b.lng === 'number' ? b.lng : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: 'Postavite mesto snimka na mapi.' };
  }
  if (lat < LAT_MIN || lat > LAT_MAX || lng < LNG_MIN || lng > LNG_MAX) {
    return { ok: false, error: 'Mesto snimka je van područja opštine Žabari.' };
  }

  const photoMediaId = Number(b.photoMediaId);
  if (!Number.isInteger(photoMediaId) || photoMediaId < 1) {
    return { ok: false, error: 'Otpremite skeniranu staru fotografiju.' };
  }

  let nowPhotoMediaId: number | null = null;
  if (b.nowPhotoMediaId !== undefined && b.nowPhotoMediaId !== null) {
    const id = Number(b.nowPhotoMediaId);
    if (!Number.isInteger(id) || id < 1) return { ok: false, error: 'Neispravna današnja fotografija.' };
    if (id === photoMediaId) return { ok: false, error: 'Nekad i danas ne mogu biti ista fotografija.' };
    nowPhotoMediaId = id;
  }

  return {
    ok: true,
    value: { title, year, village: b.village as string, story, lat, lng, photoMediaId, nowPhotoMediaId },
  };
}
