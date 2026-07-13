// Pomoćnici za "Zaboravljene bisere". Decenije se izvode iz godine snimka —
// čipovi na stranici se grade dinamički iz učitanih bisera.

import type { Biser } from '../types';

export function decadeOf(year: number): string {
  return String(Math.floor(year / 10) * 10);
}

export function decadeLabel(decade: string): string {
  return `${decade}-e`;
}

// Sepija nijansa za placeholder kada biser nema fotografiju (seed primeri) —
// determinističko po id-u da kartice/pinovi ne trepere između rendera.
export function biserHue(b: Pick<Biser, 'id'>): number {
  return 22 + ((b.id * 7) % 18);
}

export function biserThumbGradient(b: Pick<Biser, 'id'>): string {
  const hue = biserHue(b);
  return `linear-gradient(155deg, hsl(${hue}, 42%, 66%) 0%, hsl(${hue}, 46%, 42%) 62%, hsl(${hue}, 44%, 25%) 100%)`;
}

// Priča se čuva kao jedan tekst; pasusi su razdvojeni praznim redom.
export function storyParagraphs(story: string): string[] {
  return story
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// "fotografija" / "fotografije" — srpska množina za brojač na mapi.
export function fotografijaSuffix(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 'e';
  return 'a';
}
