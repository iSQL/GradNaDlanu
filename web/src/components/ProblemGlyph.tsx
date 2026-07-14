import { problemCat, type ProblemCategoryId } from '../lib/problemi';

// Glifovi kategorija problema — beli simbol na obojenoj podlozi. Kao i kod
// PinGlyph-a postoje DVA potrošača istog crteža: `problemPinSvgString` (HTML
// string za Leaflet divIcon) i `<ProblemBadge>` (React, za liste/legende) —
// menjaj ih zajedno.
function glyphInner(id: string): string {
  const c = problemCat(id).color;
  switch (id) {
    case 'saobracaj':
      return '<path d="M13 7.2 L18.8 17.6 H7.2 Z" fill="none" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/><line x1="13" y1="10.8" x2="13" y2="14.4" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/><circle cx="13" cy="16.4" r="0.95" fill="#fff"/>';
    case 'zelenilo':
      return `<path d="M13 6.8 C 9 9, 8.6 14, 13 18.2 C 17.4 14, 17 9, 13 6.8 Z" fill="#fff"/><line x1="13" y1="9.6" x2="13" y2="17.2" stroke="${c}" stroke-width="1" stroke-linecap="round"/>`;
    case 'otpad':
      return `<path d="M8.8 10 H17.2 L16.4 18 Q16.3 18.9 15.4 18.9 H10.6 Q9.7 18.9 9.6 18 Z" fill="#fff"/><rect x="7.8" y="8.2" width="10.4" height="1.7" rx="0.7" fill="#fff"/><rect x="11" y="6.6" width="4" height="1.5" rx="0.5" fill="#fff"/><line x1="11.4" y1="11.6" x2="11.7" y2="16.6" stroke="${c}" stroke-width="0.9" stroke-linecap="round"/><line x1="14.6" y1="11.6" x2="14.3" y2="16.6" stroke="${c}" stroke-width="0.9" stroke-linecap="round"/>`;
    case 'vodovod':
      return `<path d="M13 6.6 C 10 10.5, 8.4 13.2, 8.4 15.4 A 4.6 4.6 0 0 0 17.6 15.4 C 17.6 13.2 16 10.5 13 6.6 Z" fill="#fff"/><path d="M11 15.2 A 2.2 2.2 0 0 0 13.2 17.2" fill="none" stroke="${c}" stroke-width="0.9" stroke-linecap="round"/>`;
    case 'urbana':
      return `<rect x="8.6" y="7.8" width="8.8" height="10.4" rx="0.6" fill="#fff"/><rect x="10" y="9.4" width="1.7" height="1.7" fill="${c}"/><rect x="14.3" y="9.4" width="1.7" height="1.7" fill="${c}"/><rect x="10" y="12.2" width="1.7" height="1.7" fill="${c}"/><rect x="14.3" y="12.2" width="1.7" height="1.7" fill="${c}"/><rect x="11.9" y="15" width="2.2" height="3.2" fill="${c}"/>`;
    default:
      return '<circle cx="9.4" cy="13" r="1.15" fill="#fff"/><circle cx="13" cy="13" r="1.15" fill="#fff"/><circle cx="16.6" cy="13" r="1.15" fill="#fff"/>';
  }
}

// HTML string za Leaflet divIcon — pin sa pulsom, kao pinSvgString u PinGlyph.
export function problemPinSvgString(id: ProblemCategoryId | string): string {
  const c = problemCat(id).color;
  return `<div style="width:34px;height:42px;display:grid;place-items:center;"><svg width="34" height="42" viewBox="0 0 26 32" overflow="visible" style="filter:drop-shadow(0 3px 6px rgba(0,0,0,0.5));"><path d="M 13 14 m -10 0 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0" fill="${c}" opacity="0.35" style="transform-box:fill-box;transform-origin:center;animation:pinpulse 2.4s infinite;"/><path d="M 13 2 C 6.5 2 2 6.5 2 13 C 2 19 8 24 13 30 C 18 24 24 19 24 13 C 24 6.5 19.5 2 13 2 Z" fill="${c}" stroke="#0B1B2B" stroke-width="1.5"/>${glyphInner(id)}</svg></div>`;
}

// Kvadratni bedž kategorije za kartice, legendu mape i formu prijave.
export function ProblemBadge({ id, size = 42 }: { id: string; size?: number }) {
  const c = problemCat(id).color;
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><rect width="26" height="26" rx="8" fill="${c}"/>${glyphInner(id)}</svg>`;
  return (
    <span
      style={{ display: 'inline-grid', placeItems: 'center', lineHeight: 0 }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
