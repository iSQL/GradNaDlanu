import type { Location, PublicContent } from '../types';
import { ModuleHero } from './ModuleHero';
import { ModuleTabs, type TabDef } from './ModuleTabs';
import { IconCheck, IconClock, IconMail, IconPhone, IconPin } from '../components/Icons';
import {
  LocationEventsList,
  LocationNewsList,
  useLocationDesavanja,
} from './LocationDesavanjaTabs';

interface Props { loc: Location; content: PublicContent }

const FALLBACK_FORMS: [string, string][] = [
  ['Zahtev za izdavanje izvoda iz matične knjige rođenih', 'PDF · 64 kB'],
  ['Prijava prebivališta', 'PDF · 48 kB'],
  ['Zahtev za parcelaciju zemljišta', 'PDF · 88 kB'],
  ['Obrazac za lokalni komunalni porez', 'PDF · 56 kB'],
];

export function PublicModule({ loc, content }: Props) {
  const services = content.services ?? [];
  const hours = content.hours ?? [];
  const contact = content.contact ?? { phone: '', email: '', address: loc.address };
  const tagline = content.tagline ?? 'Javna služba u opštini Žabari.';

  const desavanja = useLocationDesavanja(loc.id, loc.slug);

  const tabs: TabDef[] = [
    {
      key: 'osnovni',
      label: 'Osnovni podaci',
      render: () => (
        <div className="module-section">
          <div className="section-label">O ustanovi</div>
          <div className="prose">
            <p className="prose-lead">{tagline}</p>
            <p>
              Ustanova obavlja svoju delatnost u skladu sa važećim zakonskim okvirima i odlukama
              Skupštine opštine Žabari. Šalter za građane je otvoren u radno vreme navedeno u
              kartici „Radno vreme”.
            </p>
            <p>
              Za hitne slučajeve van radnog vremena pozovite glavnu liniju opštine:{' '}
              <strong>+381 12 250 130</strong>, ili pišite na <strong>info@zabari.rs</strong>.
            </p>
          </div>

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
      key: 'usluge',
      label: 'Usluge i dokumenti',
      isEmpty: services.length === 0,
      render: () => (
        <>
          {services.length > 0 && (
            <div className="module-section" style={{ marginTop: 0 }}>
              <div className="section-label">Usluge i nadležnosti</div>
              <h2 className="section-title">Šta možete obaviti ovde</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                {services.map((s) => (
                  <div
                    key={s}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '14px 16px',
                      background: 'var(--paper-2)',
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                      fontSize: 14,
                      lineHeight: 1.4,
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'var(--navy)',
                        color: 'var(--paper)',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <IconCheck />
                    </div>
                    <div>{s}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="module-section">
            <div className="section-label">Obrasci i dokumenti</div>
            <h2 className="section-title">Najčešće preuzimano</h2>
            <div style={{ border: '1px solid var(--line)', borderRadius: 8 }}>
              {FALLBACK_FORMS.map(([n, s], i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 18px',
                    borderBottom: i < 3 ? '1px solid var(--line)' : 'none',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 10,
                        padding: '3px 6px',
                        background: 'var(--paper-2)',
                        border: '1px solid var(--line)',
                        borderRadius: 3,
                        color: 'var(--ink-2)',
                        letterSpacing: 1,
                      }}
                    >
                      PDF
                    </span>
                    {n}
                  </div>
                  <span style={{ color: 'var(--ink-2)', opacity: 0.6, fontSize: 12 }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ),
    },
    {
      key: 'radno-vreme',
      label: 'Radno vreme',
      isEmpty: hours.length === 0,
      render: () => (
        <div className="module-section">
          <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconClock /> Radno vreme
          </div>
          {hours.length === 0 ? (
            <div className="loc-desavanja-empty">Radno vreme još nije uneto.</div>
          ) : (
            <table className="hours-table hours-table-wide">
              <tbody>
                {hours.map(([day, text], i) => (
                  <tr key={i}>
                    <td>{day}</td>
                    <td>{text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
