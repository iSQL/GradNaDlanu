import { useNavigate } from 'react-router-dom';
import type { LandmarkContent, Location } from '../types';
import { ModuleHero } from './ModuleHero';
import { IconArrow } from '../components/Icons';

interface Props { loc: Location; content: LandmarkContent }

export function LandmarkModule({ loc, content }: Props) {
  const navigate = useNavigate();
  const facts = content.facts ?? [];
  const story = content.story ?? [];
  return (
    <div className="module-page">
      <ModuleHero loc={loc} tagline={content.tagline} />
      <div className="module-body single">
        <div>
          <div className="gallery">
            <div className="gallery-img">[ glavna fotografija ]</div>
            <div className="gallery-img">[ detalj 1 ]</div>
            <div className="gallery-img">[ detalj 2 ]</div>
            <div className="gallery-img">[ detalj 3 ]</div>
          </div>

          <div className="facts-grid">
            {facts.map((f, i) => (
              <div className="fact" key={i}>
                <div className="fact-num">
                  {f.num}{f.em && <em>{f.em}</em>}
                </div>
                <div className="fact-label">{f.label}</div>
              </div>
            ))}
          </div>

          <div className="prose" style={{ marginTop: 32 }}>
            <div className="section-label">Istorijat</div>
            <p className="prose-lead">{content.tagline}</p>
            {story.map((p, i) => <p key={i}>{p}</p>)}
          </div>

          <div
            style={{
              marginTop: 40,
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
              onClick={() => navigate('/')}
            >
              Pokaži na mapi <IconArrow />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
