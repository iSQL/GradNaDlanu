// Lista sela opštine Žabari (Braničevski okrug, 12374).
// Mora odgovarati web/src/lib/villages.ts — kopirano namerno, dva workspace-a.
export const SELA_ZABARI = [
  'Žabari',
  'Aleksandrovac',
  'Brzohode',
  'Vlaški Do',
  'Polatna',
  'Sibnica',
  'Tićevac',
  'Točka',
  'Kočetin',
  'Porodin',
  'Svinjarevo',
  'Oreovica',
  'Mišljenovac',
  'Simićevo',
  'Četereže',
] as const;

export type Village = typeof SELA_ZABARI[number];

export function isVillage(value: unknown): value is Village {
  return typeof value === 'string' && (SELA_ZABARI as readonly string[]).includes(value);
}
