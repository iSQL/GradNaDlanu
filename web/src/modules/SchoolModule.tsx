import type { Location, SchoolContent } from '../types';
import { ModuleHero } from './ModuleHero';
import { InfoCard } from './InfoCard';

const EVENTS: [string, string, string][] = [
  ['28. apr', 'Otvoreni dan za buduće đake', '10:00 — 13:00'],
  ['12. maj', 'Roditeljski sastanak (5—8 razred)', '18:00'],
  ['28. maj', 'Završna priredba i izložba', '17:30'],
  ['10. jun', 'Svečana predaja svedočanstava', '11:00'],
];

interface Props { loc: Location; content: SchoolContent }

export function SchoolModule({ loc, content }: Props) {
  return (
    <div className="module-page">
      <ModuleHero loc={loc} tagline={content.tagline} />
      <div className="module-body">
        <div>
          <div className="facts-grid">
            {content.facts.map((f, i) => (
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
              {content.programs.map((p) => (
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

          <div className="module-section">
            <div className="section-label">Kalendar</div>
            <h2 className="section-title">Najavljeni događaji</h2>
            <div style={{ borderTop: '1px solid var(--line)' }}>
              {EVENTS.map(([d, t, h], i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '70px 1fr auto',
                    gap: 16,
                    padding: '16px 0',
                    borderBottom: '1px solid var(--line)',
                    alignItems: 'baseline',
                  }}
                >
                  <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: 'var(--gold-2)', fontWeight: 500 }}>{d}</div>
                  <div style={{ fontSize: 14, color: 'var(--ink)' }}>{t}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{h}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <InfoCard loc={loc} contact={content.contact} />
      </div>
    </div>
  );
}
