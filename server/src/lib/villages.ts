// Lista sela opštine Žabari (Braničevski okrug, 12374). Kanonskih 15 naselja
// po klasifikaciji RZS, redosled prati Voronoi-mapu u zabari-naselja.html.
// Mora odgovarati web/src/lib/villages.ts — kopirano namerno, dva workspace-a.
export const SELA_ZABARI = [
  'Žabari',
  'Aleksandrovac',
  'Brzohode',
  'Viteževo',
  'Vlaški Do',
  'Kočetin',
  'Mirijevo',
  'Oreovica',
  'Polatna',
  'Porodin',
  'Svinjarevo',
  'Sibnica',
  'Simićevo',
  'Tićevac',
  'Četereže',
] as const;

export type Village = typeof SELA_ZABARI[number];

export function isVillage(value: unknown): value is Village {
  return typeof value === 'string' && (SELA_ZABARI as readonly string[]).includes(value);
}
