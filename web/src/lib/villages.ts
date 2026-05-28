// Lista sela opštine Žabari (Braničevski okrug, 12374).
// Mora odgovarati server/src/lib/villages.ts — kopirano namerno, dva workspace-a.
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
