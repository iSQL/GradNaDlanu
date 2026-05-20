import type { CategoryId } from '../types';

const COLORS: Record<CategoryId, string> = {
  cafe: '#B5532A',
  public: '#1E3A5F',
  landmark: '#C9A961',
  hotel: '#6B8E5A',
  school: '#8B4A88',
  vodoinstalater: '#3B82F6',
  elektricar: '#F59E0B',
  automehanicar: '#EF4444',
};

const CLS: Record<CategoryId, string> = {
  cafe: 'pin-cafe',
  public: 'pin-public',
  landmark: 'pin-landmark',
  hotel: 'pin-hotel',
  school: 'pin-school',
  vodoinstalater: 'pin-vodoinstalater',
  elektricar: 'pin-elektricar',
  automehanicar: 'pin-automehanicar',
};

export function PinGlyph({ cat, size = 32 }: { cat: CategoryId; size?: number }) {
  const w = size * 0.82;
  const h = size;
  const color = COLORS[cat];

  return (
    <svg className={`pin ${CLS[cat]}`} width={w} height={h} viewBox="0 0 26 32" overflow="visible">
      <path className="pin-pulse" d="M 13 14 m -10 0 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0" />
      <path className="pin-shadow" d="M 13 30 m -8 0 a 8 2.5 0 1 0 16 0 a 8 2.5 0 1 0 -16 0" />
      <path className="pin-base" d="M 13 2 C 6.5 2 2 6.5 2 13 C 2 19 8 24 13 30 C 18 24 24 19 24 13 C 24 6.5 19.5 2 13 2 Z" />
      <circle className="pin-glow" cx="13" cy="13" r="9" />
      <Glyph cat={cat} color={color} />
    </svg>
  );
}

function Glyph({ cat, color }: { cat: CategoryId; color: string }) {
  const stroke = '#0B1B2B';
  if (cat === 'cafe') return (
    <g>
      <path d="M 7.5 9.5 L 16 9.5 L 15.5 15 Q 15 17 13 17 L 10.5 17 Q 8.5 17 8 15 Z" fill={color} stroke={stroke} strokeWidth="0.8" strokeLinejoin="round"/>
      <path d="M 16 11 Q 18.5 11 18.5 13 Q 18.5 15 16 15.2" fill="none" stroke={stroke} strokeWidth="0.8"/>
      <path d="M 9 7.5 Q 9.5 6 10 7.5 Q 10.5 9 11 7.5 M 12 7.5 Q 12.5 6 13 7.5 Q 13.5 9 14 7.5" fill="none" stroke={stroke} strokeWidth="0.6" strokeLinecap="round"/>
    </g>
  );
  if (cat === 'public') return (
    <g>
      <path d="M 6 9 L 13 6 L 20 9 L 20 10 L 6 10 Z" fill={color} stroke={stroke} strokeWidth="0.7" strokeLinejoin="round"/>
      <rect x="6.5" y="10.5" width="13" height="6" fill={color} stroke={stroke} strokeWidth="0.7"/>
      <line x1="9" y1="11" x2="9" y2="16" stroke={stroke} strokeWidth="0.5"/>
      <line x1="11.5" y1="11" x2="11.5" y2="16" stroke={stroke} strokeWidth="0.5"/>
      <line x1="14.5" y1="11" x2="14.5" y2="16" stroke={stroke} strokeWidth="0.5"/>
      <line x1="17" y1="11" x2="17" y2="16" stroke={stroke} strokeWidth="0.5"/>
      <rect x="5.5" y="16" width="15" height="1.4" fill={color} stroke={stroke} strokeWidth="0.7"/>
    </g>
  );
  if (cat === 'landmark') return (
    <g>
      <rect x="10" y="16" width="6" height="1.5" fill={color} stroke={stroke} strokeWidth="0.6"/>
      <path d="M 11 16 L 11 9 L 13 5 L 15 9 L 15 16 Z" fill={color} stroke={stroke} strokeWidth="0.7" strokeLinejoin="round"/>
      <line x1="13" y1="5.5" x2="13" y2="15.5" stroke={stroke} strokeWidth="0.4" opacity="0.5"/>
    </g>
  );
  if (cat === 'hotel') return (
    <g>
      <rect x="5" y="13" width="16" height="4" fill={color} stroke={stroke} strokeWidth="0.7" strokeLinejoin="round"/>
      <path d="M 5 13 L 5 10 L 12 10 L 12 13" fill={color} stroke={stroke} strokeWidth="0.7" strokeLinejoin="round"/>
      <rect x="6.5" y="11" width="4.5" height="2" fill="#F5F1E8" stroke={stroke} strokeWidth="0.5"/>
      <line x1="5" y1="17" x2="5" y2="18.5" stroke={stroke} strokeWidth="0.7"/>
      <line x1="21" y1="17" x2="21" y2="18.5" stroke={stroke} strokeWidth="0.7"/>
    </g>
  );
  if (cat === 'school') return (
    <g>
      <path d="M 4 11 L 13 7 L 22 11 L 13 15 Z" fill={color} stroke={stroke} strokeWidth="0.7" strokeLinejoin="round"/>
      <path d="M 8 13 L 8 16.5 Q 13 19 18 16.5 L 18 13" fill={color} stroke={stroke} strokeWidth="0.7" strokeLinejoin="round"/>
      <line x1="22" y1="11" x2="22" y2="14" stroke={stroke} strokeWidth="0.7"/>
      <circle cx="22" cy="14.4" r="0.7" fill={stroke}/>
    </g>
  );
  if (cat === 'vodoinstalater') return (
    <g>
      <path d="M 9 6 L 11 6 L 11 9 L 15 9 L 15 6 L 17 6 L 17 12 L 13.8 12 L 13.8 18 L 12.2 18 L 12.2 12 L 9 12 Z" fill={color} stroke={stroke} strokeWidth="0.7" strokeLinejoin="round"/>
      <circle cx="13" cy="19" r="1.4" fill={color} stroke={stroke} strokeWidth="0.6"/>
    </g>
  );
  if (cat === 'elektricar') return (
    <g>
      <path d="M 14 6 L 9 14 L 12.5 14 L 11.5 19 L 17 11 L 13.5 11 Z" fill={color} stroke={stroke} strokeWidth="0.7" strokeLinejoin="round"/>
    </g>
  );
  if (cat === 'automehanicar') return (
    <g>
      <path d="M 6.5 16 L 6.5 14 Q 6.5 12.5 8 12.2 L 9.2 10 Q 9.7 9 11 9 L 15 9 Q 16.3 9 16.8 10 L 18 12.2 Q 19.5 12.5 19.5 14 L 19.5 16 Z" fill={color} stroke={stroke} strokeWidth="0.7" strokeLinejoin="round"/>
      <circle cx="9.3" cy="16.5" r="1.5" fill="#0B1B2B"/>
      <circle cx="16.7" cy="16.5" r="1.5" fill="#0B1B2B"/>
      <circle cx="9.3" cy="16.5" r="0.5" fill={color}/>
      <circle cx="16.7" cy="16.5" r="0.5" fill={color}/>
    </g>
  );
  return null;
}

export function pinSvgString(cat: CategoryId): string {
  const color = COLORS[cat];
  const stroke = '#0B1B2B';
  const glyph =
    cat === 'cafe' ? `
      <path d="M 7.5 9.5 L 16 9.5 L 15.5 15 Q 15 17 13 17 L 10.5 17 Q 8.5 17 8 15 Z" fill="${color}" stroke="${stroke}" stroke-width="0.8" stroke-linejoin="round"/>
      <path d="M 16 11 Q 18.5 11 18.5 13 Q 18.5 15 16 15.2" fill="none" stroke="${stroke}" stroke-width="0.8"/>
      <path d="M 9 7.5 Q 9.5 6 10 7.5 Q 10.5 9 11 7.5 M 12 7.5 Q 12.5 6 13 7.5 Q 13.5 9 14 7.5" fill="none" stroke="${stroke}" stroke-width="0.6" stroke-linecap="round"/>` :
    cat === 'public' ? `
      <path d="M 6 9 L 13 6 L 20 9 L 20 10 L 6 10 Z" fill="${color}" stroke="${stroke}" stroke-width="0.7"/>
      <rect x="6.5" y="10.5" width="13" height="6" fill="${color}" stroke="${stroke}" stroke-width="0.7"/>
      <line x1="9" y1="11" x2="9" y2="16" stroke="${stroke}" stroke-width="0.5"/>
      <line x1="11.5" y1="11" x2="11.5" y2="16" stroke="${stroke}" stroke-width="0.5"/>
      <line x1="14.5" y1="11" x2="14.5" y2="16" stroke="${stroke}" stroke-width="0.5"/>
      <line x1="17" y1="11" x2="17" y2="16" stroke="${stroke}" stroke-width="0.5"/>
      <rect x="5.5" y="16" width="15" height="1.4" fill="${color}" stroke="${stroke}" stroke-width="0.7"/>` :
    cat === 'landmark' ? `
      <rect x="10" y="16" width="6" height="1.5" fill="${color}" stroke="${stroke}" stroke-width="0.6"/>
      <path d="M 11 16 L 11 9 L 13 5 L 15 9 L 15 16 Z" fill="${color}" stroke="${stroke}" stroke-width="0.7"/>` :
    cat === 'hotel' ? `
      <rect x="5" y="13" width="16" height="4" fill="${color}" stroke="${stroke}" stroke-width="0.7"/>
      <path d="M 5 13 L 5 10 L 12 10 L 12 13" fill="${color}" stroke="${stroke}" stroke-width="0.7"/>
      <rect x="6.5" y="11" width="4.5" height="2" fill="#F5F1E8" stroke="${stroke}" stroke-width="0.5"/>
      <line x1="5" y1="17" x2="5" y2="18.5" stroke="${stroke}" stroke-width="0.7"/>
      <line x1="21" y1="17" x2="21" y2="18.5" stroke="${stroke}" stroke-width="0.7"/>` :
    cat === 'school' ? `
      <path d="M 4 11 L 13 7 L 22 11 L 13 15 Z" fill="${color}" stroke="${stroke}" stroke-width="0.7"/>
      <path d="M 8 13 L 8 16.5 Q 13 19 18 16.5 L 18 13" fill="${color}" stroke="${stroke}" stroke-width="0.7"/>
      <line x1="22" y1="11" x2="22" y2="14" stroke="${stroke}" stroke-width="0.7"/>
      <circle cx="22" cy="14.4" r="0.7" fill="${stroke}"/>` :
    cat === 'vodoinstalater' ? `
      <path d="M 9 6 L 11 6 L 11 9 L 15 9 L 15 6 L 17 6 L 17 12 L 13.8 12 L 13.8 18 L 12.2 18 L 12.2 12 L 9 12 Z" fill="${color}" stroke="${stroke}" stroke-width="0.7"/>
      <circle cx="13" cy="19" r="1.4" fill="${color}" stroke="${stroke}" stroke-width="0.6"/>` :
    cat === 'elektricar' ? `
      <path d="M 14 6 L 9 14 L 12.5 14 L 11.5 19 L 17 11 L 13.5 11 Z" fill="${color}" stroke="${stroke}" stroke-width="0.7"/>` :
    cat === 'automehanicar' ? `
      <path d="M 6.5 16 L 6.5 14 Q 6.5 12.5 8 12.2 L 9.2 10 Q 9.7 9 11 9 L 15 9 Q 16.3 9 16.8 10 L 18 12.2 Q 19.5 12.5 19.5 14 L 19.5 16 Z" fill="${color}" stroke="${stroke}" stroke-width="0.7"/>
      <circle cx="9.3" cy="16.5" r="1.5" fill="#0B1B2B"/>
      <circle cx="16.7" cy="16.5" r="1.5" fill="#0B1B2B"/>
      <circle cx="9.3" cy="16.5" r="0.5" fill="${color}"/>
      <circle cx="16.7" cy="16.5" r="0.5" fill="${color}"/>` :
    '';

  return `
    <div class="leaflet-pin">
      <svg width="34" height="42" viewBox="0 0 26 32" overflow="visible" class="pin ${CLS[cat]}">
        <path class="pin-pulse" d="M 13 14 m -10 0 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0"></path>
        <path class="pin-base" d="M 13 2 C 6.5 2 2 6.5 2 13 C 2 19 8 24 13 30 C 18 24 24 19 24 13 C 24 6.5 19.5 2 13 2 Z"></path>
        ${glyph}
      </svg>
    </div>`;
}
