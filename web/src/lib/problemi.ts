// Kategorije prijava komunalnih problema ("Problemi"). Mora odgovarati
// server/src/lib/problemi.ts — kopirano namerno, dva workspace-a (isti obrazac
// kao SELA_ZABARI i SERVICE_CATEGORIES).
export const PROBLEM_CATEGORIES = [
  { id: 'saobracaj', label: 'Saobraćaj i putevi', short: 'Saobraćaj', color: '#B5532A' },
  { id: 'zelenilo', label: 'Zelenilo i javne površine', short: 'Zelenilo', color: '#6B8E5A' },
  { id: 'otpad', label: 'Otpad i higijena', short: 'Otpad', color: '#8A6D3B' },
  { id: 'vodovod', label: 'Vodovod i kanalizacija', short: 'Vodovod', color: '#3B82F6' },
  { id: 'urbana', label: 'Urbana sredina i komunalni red', short: 'Urbana sredina', color: '#1E3A5F' },
  { id: 'ostalo', label: 'Ostalo', short: 'Ostalo', color: '#8A8072' },
] as const;

export type ProblemCategoryId = (typeof PROBLEM_CATEGORIES)[number]['id'];

export function isProblemCategory(value: unknown): value is ProblemCategoryId {
  return (
    typeof value === 'string' && PROBLEM_CATEGORIES.some((c) => c.id === value)
  );
}

export function problemCat(id: string) {
  return PROBLEM_CATEGORIES.find((c) => c.id === id) ?? PROBLEM_CATEGORIES[5];
}

export function problemStatusLabel(status: 'open' | 'solved'): string {
  return status === 'solved' ? 'Rešeno' : 'Otvoreno';
}

// „danas“ / „juče“ / „pre N dana“ — kao u dizajnu prijava.
export function problemDateLabel(iso: string): string {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'danas';
  if (days === 1) return 'juče';
  return `pre ${days} dana`;
}
