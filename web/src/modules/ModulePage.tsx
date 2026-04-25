import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type {
  CafeContent,
  HotelContent,
  LandmarkContent,
  LocationWithContent,
  PublicContent,
  SchoolContent,
} from '../types';
import { CafeModule } from './CafeModule';
import { PublicModule } from './PublicModule';
import { LandmarkModule } from './LandmarkModule';
import { HotelModule } from './HotelModule';
import { SchoolModule } from './SchoolModule';
import { EmptyContent, isEmptyContent } from './EmptyContent';

export function ModulePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<LocationWithContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setData(null);
    setError(null);
    api
      .getLocation(slug)
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [slug]);

  if (error) {
    return (
      <div className="module-page">
        <div className="module-body single">
          <div>
            <h2 className="section-title">Objekat nije pronađen</h2>
            <p>{error}</p>
            <button className="btn-primary" style={{ width: 'auto', padding: '12px 22px' }} onClick={() => navigate('/')}>
              Nazad na mapu
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return <div className="module-page" />;

  if (isEmptyContent(data.content)) return <EmptyContent loc={data} />;

  switch (data.catId) {
    case 'cafe':     return <CafeModule     loc={data} content={data.content as CafeContent} />;
    case 'public':   return <PublicModule   loc={data} content={data.content as PublicContent} />;
    case 'landmark': return <LandmarkModule loc={data} content={data.content as LandmarkContent} />;
    case 'hotel':    return <HotelModule    loc={data} content={data.content as HotelContent} />;
    case 'school':   return <SchoolModule   loc={data} content={data.content as SchoolContent} />;
    default:         return null;
  }
}
