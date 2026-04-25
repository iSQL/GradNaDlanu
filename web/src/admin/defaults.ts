import type { CategoryId } from '../types';

export function defaultContentFor(catId: CategoryId): Record<string, unknown> {
  switch (catId) {
    case 'cafe':
      return {
        tagline: '',
        hours: [
          { day: 'Ponedeljak', hours: '08 — 22' },
          { day: 'Utorak',     hours: '08 — 22' },
          { day: 'Sreda',      hours: '08 — 22' },
          { day: 'Četvrtak',   hours: '08 — 22' },
          { day: 'Petak',      hours: '08 — 23' },
          { day: 'Subota',     hours: '09 — 23' },
          { day: 'Nedelja',    hours: '09 — 22' },
        ],
        menu: [
          { cat: 'topli napici', items: [{ name: '', desc: '', price: '' }] },
        ],
        contact: { phone: '', web: '' },
      };
    case 'public':
      return {
        tagline: '',
        hours: [['pon — pet', '08 — 16']],
        contact: { phone: '', email: '', address: '' },
        services: [''],
      };
    case 'hotel':
      return {
        tagline: '',
        contact: { phone: '', email: '', address: '' },
        rooms: [{ name: '', beds: '', area: '', price: '', amen: '' }],
        facts: [{ num: '', label: '' }],
      };
    case 'landmark':
      return {
        tagline: '',
        facts: [{ num: '', label: '' }],
        story: [''],
      };
    case 'school':
      return {
        tagline: '',
        contact: { phone: '', email: '', address: '' },
        facts: [{ num: '', label: '' }],
        programs: [''],
      };
  }
}
