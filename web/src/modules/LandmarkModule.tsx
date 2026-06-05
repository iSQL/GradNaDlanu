import { useNavigate } from 'react-router-dom';
import type { LandmarkContent, Location } from '../types';
import { ModuleHero } from './ModuleHero';
import { ModuleTabs, type TabDef } from './ModuleTabs';
import { IconArrow, IconPin } from '../components/Icons';
import {
  LocationEventsList,
  LocationNewsList,
  useLocationDesavanja,
} from './LocationDesavanjaTabs';

interface Props { loc: Location; content: LandmarkContent }

export function LandmarkModule({ loc, content }: Props) {
  const navigate = useNavigate();
  const facts = content.facts ?? [];
  const story = content.story ?? [];
  const tagline = content.tagline ?? 'Znamenitost u opštini Žabari.';

  const desavanja = useLocationDesavanja(loc.id, loc.slug);

  const tabs: TabDef[] = [
    {
      key: 'osnovni',
      label: 'Osnovni podaci',
      render: () => (
        <div className="module-section">
          <div className="section-label">O znamenitosti</div>
          <p className="prose-lead">{tagline}</p>

          {facts.length > 0 && (
            <div className="facts-grid" style={{ marginTop: 24 }}>
              {facts.map((f, i) => (
                <div className="fact" key={i}>
                  <div className="fact-num">
                    {f.num}{f.em && <em>{f.em}</em>}
                  </div>
                  <div className="fact-label">{f.label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="info-grid" style={{ marginTop: 24 }}>
            <div className="info-row">
              <div className="info-icon"><IconPin /></div>
              <div>
                <div className="info-row-label">Lokacija</div>
                <div className="info-row-val">{loc.address}<br />12374 Žabari</div>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 32,
              padding: 24,
              background: 'var(--paper-2)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div>
              <div className="section-label" style={{ margin: 0 }}>Posetite</div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: 'var(--navy)', marginTop: 4 }}>
                {loc.address}, 12374 Žabari
              </div>
            </div>
            <button
              className="btn-primary"
              style={{ width: 'auto', padding: '12px 22px' }}
              onClick={() => navigate('/mapa')}
            >
              Pokaži na mapi <IconArrow />
            </button>
          </div>
        </div>
      ),
    },
    {
      key: 'dogadjaji',
      label: 'Najavljeni događaji',
      isEmpty: !desavanja.loading && desavanja.events.length === 0,
      render: () => (
        <div className="module-section">
          <div className="section-label">Najavljeni događaji</div>
          <LocationEventsList items={desavanja.events} loading={desavanja.loading} />
        </div>
      ),
    },
    {
      key: 'obavestenja',
      label: 'Obaveštenja',
      isEmpty: !desavanja.loading && desavanja.news.length === 0,
      render: () => (
        <div className="module-section">
          <div className="section-label">Obaveštenja</div>
          <LocationNewsList items={desavanja.news} loading={desavanja.loading} />
        </div>
      ),
    },
    {
      key: 'istorijat',
      label: 'Istorijat',
      isEmpty: story.length === 0,
      render: () => (
        <div className="module-section">
          <div className="section-label">Istorijat</div>
          {story.length === 0 ? (
            <div className="loc-desavanja-empty">Istorijat još nije unet.</div>
          ) : (
            <div className="prose">
              <p className="prose-lead">{tagline}</p>
              {story.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="module-page">
      <ModuleHero loc={loc} tagline={tagline} />
      <div className="module-body tabs">
        <ModuleTabs tabs={tabs} />
      </div>
    </div>
  );
}
