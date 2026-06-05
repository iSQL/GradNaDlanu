import type { Location, SchoolContent } from '../types';
import { ModuleHero } from './ModuleHero';
import { ModuleTabs, type TabDef } from './ModuleTabs';
import { IconMail, IconPhone, IconPin } from '../components/Icons';
import {
  LocationEventsList,
  LocationNewsList,
  useLocationDesavanja,
} from './LocationDesavanjaTabs';

interface Props { loc: Location; content: SchoolContent }

export function SchoolModule({ loc, content }: Props) {
  const facts = content.facts ?? [];
  const programs = content.programs ?? [];
  const contact = content.contact ?? { phone: '', email: '', address: loc.address };
  const tagline = content.tagline ?? 'Obrazovna ustanova u opštini Žabari.';

  const desavanja = useLocationDesavanja(loc.id, loc.slug);

  const tabs: TabDef[] = [
    {
      key: 'osnovni',
      label: 'Osnovni podaci',
      render: () => (
        <div className="module-section">
          <div className="section-label">O ustanovi</div>
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

          <div className="info-grid">
            <div className="info-row">
              <div className="info-icon"><IconPin /></div>
              <div>
                <div className="info-row-label">Adresa</div>
                <div className="info-row-val">{contact.address || loc.address}<br />12374 Žabari</div>
              </div>
            </div>
            {contact.phone && (
              <div className="info-row">
                <div className="info-icon"><IconPhone /></div>
                <div>
                  <div className="info-row-label">Telefon</div>
                  <div className="info-row-val">{contact.phone}</div>
                </div>
              </div>
            )}
            {contact.email && (
              <div className="info-row">
                <div className="info-icon"><IconMail /></div>
                <div>
                  <div className="info-row-label">E-pošta</div>
                  <div className="info-row-val">{contact.email}</div>
                </div>
              </div>
            )}
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
      key: 'program',
      label: 'Program',
      isEmpty: programs.length === 0,
      render: () => (
        <div className="module-section">
          <div className="section-label">Program</div>
          <h2 className="section-title">Šta nudimo</h2>
          {programs.length === 0 ? (
            <div className="loc-desavanja-empty">Program još nije unet.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {programs.map((p) => (
                <div
                  key={p}
                  style={{
                    padding: '16px 18px',
                    background: 'var(--paper-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{ width: 4, height: 24, background: 'var(--navy)', borderRadius: 2 }} />
                  {p}
                </div>
              ))}
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
