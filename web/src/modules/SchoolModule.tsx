import type { Location, SchoolContent } from '../types';
import { ModuleHero } from './ModuleHero';
import { InfoCard } from './InfoCard';

interface Props { loc: Location; content: SchoolContent }

export function SchoolModule({ loc, content }: Props) {
  const facts = content.facts ?? [];
  const programs = content.programs ?? [];
  const contact = content.contact ?? { phone: '', email: '', address: loc.address };

  return (
    <div className="module-page">
      <ModuleHero loc={loc} tagline={content.tagline} />
      <div className="module-body">
        <div>
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

          <div className="module-section">
            <div className="section-label">Program</div>
            <h2 className="section-title">Šta nudimo</h2>
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
          </div>
        </div>

        <InfoCard loc={loc} contact={contact} />
      </div>
    </div>
  );
}
