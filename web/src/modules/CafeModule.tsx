import { Fragment, useState } from 'react';
import type { CafeContent, Location } from '../types';
import { ModuleHero } from './ModuleHero';
import { InfoCard } from './InfoCard';

const TIMES = ['12:00', '13:00', '14:00', '18:00', '19:00', '20:00', '21:00', '22:00'];
const TABLES = [
  { id: 1,  x: 50,  y: 60,  taken: false },
  { id: 2,  x: 110, y: 60,  taken: true  },
  { id: 3,  x: 170, y: 60,  taken: false },
  { id: 4,  x: 230, y: 60,  taken: false },
  { id: 5,  x: 50,  y: 140, taken: true  },
  { id: 6,  x: 110, y: 140, taken: false },
  { id: 7,  x: 170, y: 140, taken: false },
  { id: 8,  x: 230, y: 140, taken: true  },
  { id: 9,  x: 50,  y: 230, taken: false },
  { id: 10, x: 110, y: 230, taken: false },
  { id: 11, x: 170, y: 230, taken: false },
  { id: 12, x: 230, y: 230, taken: false },
];

interface Props { loc: Location; content: CafeContent }

export function CafeModule({ loc, content }: Props) {
  const tagline = content.tagline ?? `Mesto u srcu Žabara — sa sigurno najboljom kafom u opštini.`;

  const [seats, setSeats] = useState(2);
  const [date, setDate] = useState('2026-04-26');
  const [time, setTime] = useState('19:00');
  const [table, setTable] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="module-page">
      <ModuleHero loc={loc} tagline={tagline} />
      <div className="module-body">
        <div>
          <div className="module-section">
            <div className="section-label">Rezervacija stola</div>
            <div className="cafe-tables">
              <div className="cafe-booking-form">
                <div>
                  <div className="field-label">Datum</div>
                  <input className="field-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div>
                  <div className="field-label">Broj osoba</div>
                  <select className="field-select" value={seats} onChange={(e) => setSeats(+e.target.value)}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'osoba' : n < 5 ? 'osobe' : 'osoba'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="field-label">Vreme</div>
                  <div className="time-grid">
                    {TIMES.map((t) => (
                      <button
                        key={t}
                        className={`time-chip ${time === t ? 'selected' : ''} ${t === '14:00' ? 'disabled' : ''}`}
                        onClick={() => t !== '14:00' && setTime(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="field-label">Sto {table ? `· odabran #${table}` : ''}</div>
                  <div style={{ fontSize: 11, color: '#5B6878', marginTop: -4 }}>
                    Kliknite na sto u rasporedu →
                  </div>
                </div>
                <button
                  className="btn-primary"
                  disabled={!table || confirmed}
                  onClick={() => setConfirmed(true)}
                >
                  {confirmed ? '✓ Rezervacija potvrđena' : 'Rezerviši'}
                </button>
                {confirmed && (
                  <div style={{ fontSize: 12, color: '#6B8E5A', textAlign: 'center', lineHeight: 1.5 }}>
                    Poslat vam je SMS sa potvrdom.
                    <br />
                    Sto #{table} · {date} u {time} · {seats} {seats === 1 ? 'osoba' : 'osobe'}
                  </div>
                )}
              </div>

              <div>
                <div className="field-label" style={{ marginBottom: 8 }}>Raspored sala</div>
                <div className="cafe-floorplan">
                  <svg className="cafe-floorplan-svg" viewBox="0 0 280 280">
                    <rect x="2" y="2" width="276" height="276" fill="none" stroke="#5B6878" strokeWidth="2" rx="4" />
                    <line x1="2" y1="190" x2="180" y2="190" stroke="#5B6878" strokeWidth="1.5" strokeDasharray="4 3" />
                    <text x="90" y="210" fontSize="9" textAnchor="middle" fill="#5B6878" fontFamily="Inter" letterSpacing="1">UNUTRA</text>
                    <text x="220" y="270" fontSize="9" textAnchor="middle" fill="#5B6878" fontFamily="Inter" letterSpacing="1">BAŠTA</text>
                    <rect x="20" y="10" width="240" height="18" fill="#E5D4B5" stroke="#5B6878" strokeWidth="1" />
                    <text x="140" y="22" fontSize="9" textAnchor="middle" fill="#5B6878" fontFamily="Inter" letterSpacing="2">B A R</text>
                    {TABLES.map((t) => (
                      <g
                        key={t.id}
                        className={`cafe-table ${t.taken ? 'taken' : ''} ${table === t.id ? 'selected' : ''}`}
                        onClick={() => !t.taken && setTable(t.id)}
                      >
                        <circle className="table-circle" cx={t.x} cy={t.y} r="16" />
                        <text className="table-num" x={t.x} y={t.y}>{t.id}</text>
                      </g>
                    ))}
                    <g transform="translate(8, 258)" fontSize="8" fontFamily="Inter" fill="#5B6878">
                      <circle cx="6" cy="0" r="5" fill="#E0D6C0" stroke="#5B6878" strokeWidth="1" />
                      <text x="16" y="2.5">slobodan</text>
                      <circle cx="78" cy="0" r="5" fill="#C8B8B0" stroke="#5B6878" strokeWidth="1" opacity="0.6" />
                      <text x="88" y="2.5">zauzet</text>
                      <circle cx="138" cy="0" r="5" fill="#C9A961" stroke="#0B1B2B" strokeWidth="1" />
                      <text x="148" y="2.5">odabran</text>
                    </g>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="module-section">
            <div className="section-label">Meni i ponuda</div>
            <h2 className="section-title">Posebnosti kuće</h2>
            <div className="menu-list">
              {content.menu.map((group) => (
                <Fragment key={group.cat}>
                  <div className="menu-cat-title">{group.cat}</div>
                  {group.items.map((item) => (
                    <div className="menu-item" key={item.name}>
                      <div>
                        <div className="menu-item-name">{item.name}</div>
                        <div className="menu-item-desc">{item.desc}</div>
                      </div>
                      <div className="menu-item-price">{item.price}</div>
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
        </div>

        <InfoCard loc={loc} hours={content.hours} contact={content.contact} />
      </div>
    </div>
  );
}
