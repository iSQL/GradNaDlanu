import { useNavigate } from 'react-router-dom';
import type { Location } from '../types';
import { CATEGORY_LABELS } from '../types';
import { IconBack } from '../components/Icons';

const COLORS: Record<string, string> = {
  cafe: '#B5532A',
  public: '#1E3A5F',
  landmark: '#C9A961',
  hotel: '#6B8E5A',
  school: '#8B4A88',
  vodoinstalater: '#3B82F6',
  elektricar: '#F59E0B',
  automehanicar: '#EF4444',
};

interface Props {
  loc: Location;
  tagline?: string;
}

export function ModuleHero({ loc, tagline }: Props) {
  const navigate = useNavigate();
  const color = COLORS[loc.catId];
  return (
    <div className="module-hero" style={{ background: color, filter: 'saturate(0.85)' }}>
      <div className="module-hero-bg" />
      <div className="module-hero-content">
        <button className="module-back" onClick={() => navigate('/')}>
          <IconBack /> Nazad na mapu
        </button>
        <div className="module-cat">{CATEGORY_LABELS[loc.catId]}</div>
        <h1 className="module-title">{loc.name}</h1>
        {tagline && <p className="module-tagline">{tagline}</p>}
      </div>
    </div>
  );
}
