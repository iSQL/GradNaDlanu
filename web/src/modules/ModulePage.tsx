import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import type {
  CafeContent,
  HotelContent,
  LandmarkContent,
  LocationWithContent,
  MajstorContent,
  PublicContent,
  SchoolContent,
} from '../types';
import { CafeModule } from './CafeModule';
import { PublicModule } from './PublicModule';
import { LandmarkModule } from './LandmarkModule';
import { HotelModule } from './HotelModule';
import { SchoolModule } from './SchoolModule';
import { MajstorModule } from './MajstorModule';
import { EmptyContent, isEmptyContent } from './EmptyContent';
import { SocialActions } from '../components/SocialActions';
import { CommentsSection } from '../components/CommentsSection';
import { LocationDesavanjaPanel } from '../components/LocationDesavanjaPanel';

export function ModulePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const ctx = useOutletContext<AppContext>();
  const [data, setData] = useState<LocationWithContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!slug) return;
    const loc = await api.getLocation(slug);
    setData(loc);
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    setData(null);
    setError(null);
    reload().catch((err: Error) => setError(err.message));
  }, [slug, reload]);

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

  const isOwner = !!ctx.currentUser?.ownedLocationIds.includes(data.id);
  const isAdmin = ctx.currentUser?.role === 'admin';

  let module: React.ReactNode = null;
  switch (data.catId) {
    case 'cafe':           module = <CafeModule     loc={data} content={data.content as CafeContent} />; break;
    case 'public':         module = <PublicModule   loc={data} content={data.content as PublicContent} />; break;
    case 'landmark':       module = <LandmarkModule loc={data} content={data.content as LandmarkContent} />; break;
    case 'hotel':          module = <HotelModule    loc={data} content={data.content as HotelContent} />; break;
    case 'school':         module = <SchoolModule   loc={data} content={data.content as SchoolContent} />; break;
    case 'vodoinstalater':
    case 'elektricar':
    case 'automehanicar':  module = <MajstorModule  loc={data} content={data.content as MajstorContent} />; break;
  }

  return (
    <>
      {module}
      <div className="module-page-extras">
        <div className="module-page-extras-inner">
          <SocialActions loc={data} onChanged={() => reload().catch(console.error)} />
          <LocationDesavanjaPanel locationId={data.id} locationSlug={data.slug} />
          <CommentsSection slug={data.slug} canReply={isOwner || !!isAdmin} />
        </div>
      </div>
    </>
  );
}
