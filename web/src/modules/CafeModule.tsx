import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import type {
  AvailabilityRow,
  CafeContent,
  CafeReservationPayload,
  Location,
} from '../types';
import { ModuleHero } from './ModuleHero';
import { InfoCard } from './InfoCard';

const TIMES = ['12:00', '13:00', '14:00', '18:00', '19:00', '20:00', '21:00', '22:00'];
const TABLES = [
  { id: '1',  x: 50,  y: 60  },
  { id: '2',  x: 110, y: 60  },
  { id: '3',  x: 170, y: 60  },
  { id: '4',  x: 230, y: 60  },
  { id: '5',  x: 50,  y: 140 },
  { id: '6',  x: 110, y: 140 },
  { id: '7',  x: 170, y: 140 },
  { id: '8',  x: 230, y: 140 },
  { id: '9',  x: 50,  y: 230 },
  { id: '10', x: 110, y: 230 },
  { id: '11', x: 170, y: 230 },
  { id: '12', x: 230, y: 230 },
];
const SLOT_HOURS = 2;

interface Props { loc: Location; content: CafeContent }

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function slotRange(date: string, time: string): { start: string; end: string } {
  // Local-time wall clock — server stores as timestamptz so it normalises consistently.
  const start = new Date(`${date}T${time}:00`);
  const end = new Date(start.getTime() + SLOT_HOURS * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function CafeModule({ loc, content }: Props) {
  const ctx = useOutletContext<AppContext>();
  const tagline = content.tagline ?? `Mesto u srcu Žabara — sa sigurno najboljom kafom u opštini.`;
  const menu = content.menu ?? [];
  const hours = content.hours ?? [];
  const contact = content.contact ?? {};

  const [seats, setSeats] = useState(2);
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState('19:00');
  const [tableId, setTableId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ id: number; status: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);

  useEffect(() => {
    if (!date) return;
    api
      .availability(loc.slug, date, date)
      .then(setAvailability)
      .catch(() => setAvailability([]));
  }, [date, loc.slug, confirmed]);

  // Tables fully blocked when ANY active reservation overlaps the picked time slot.
  const takenTableIds = useMemo(() => {
    const want = slotRange(date, time);
    const wantStart = Date.parse(want.start);
    const wantEnd = Date.parse(want.end);
    const taken = new Set<string>();
    for (const a of availability) {
      const p = a.payload as { tableId?: string; slotStart?: string; slotEnd?: string };
      if (!p.tableId || !p.slotStart || !p.slotEnd) continue;
      const s = Date.parse(p.slotStart);
      const e = Date.parse(p.slotEnd);
      if (s < wantEnd && e > wantStart) taken.add(p.tableId);
    }
    return taken;
  }, [availability, date, time]);

  // If the current selection becomes taken (e.g. user changed time), clear it.
  useEffect(() => {
    if (tableId && takenTableIds.has(tableId)) setTableId(null);
  }, [takenTableIds, tableId]);

  const submit = async () => {
    if (!tableId) return;
    setSubmitting(true);
    setError(null);
    try {
      const { start, end } = slotRange(date, time);
      const payload: CafeReservationPayload = {
        tableId,
        slotStart: start,
        slotEnd: end,
        guests: seats,
      };
      const res = await api.createReservation(loc.slug, payload);
      setConfirmed({ id: res.id, status: res.status });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('409')) setError('Sto je već zauzet u izabranom periodu.');
      else if (message.includes('401')) setError('Prijavite se da biste rezervisali.');
      else setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const loggedIn = !!ctx.currentUser;

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
                  <input
                    className="field-input"
                    type="date"
                    value={date}
                    min={todayIso()}
                    onChange={(e) => setDate(e.target.value)}
                  />
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
                  <div className="field-label">Vreme (rezervacija traje 2h)</div>
                  <div className="time-grid">
                    {TIMES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`time-chip ${time === t ? 'selected' : ''}`}
                        onClick={() => setTime(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="field-label">Sto {tableId ? `· odabran #${tableId}` : ''}</div>
                  <div style={{ fontSize: 11, color: '#5B6878', marginTop: -4 }}>
                    Kliknite na sto u rasporedu →
                  </div>
                </div>
                {!loggedIn ? (
                  <Link to="/prijava" className="btn-primary" style={{ textAlign: 'center', textDecoration: 'none' }}>
                    Prijavite se za rezervaciju
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!tableId || submitting || !!confirmed}
                    onClick={submit}
                  >
                    {confirmed
                      ? '✓ Zahtev poslat'
                      : submitting
                      ? 'Slanje…'
                      : 'Rezerviši'}
                  </button>
                )}
                {confirmed && (
                  <div style={{ fontSize: 12, color: 'var(--moss)', textAlign: 'center', lineHeight: 1.5 }}>
                    Rezervacija #{confirmed.id} — status: <strong>{confirmed.status}</strong>.
                    <br />
                    Sto #{tableId} · {date} u {time} · {seats} {seats === 1 ? 'osoba' : 'osobe'}
                  </div>
                )}
                {error && <div className="login-error">{error}</div>}
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
                    {TABLES.map((t) => {
                      const taken = takenTableIds.has(t.id);
                      return (
                        <g
                          key={t.id}
                          className={`cafe-table ${taken ? 'taken' : ''} ${tableId === t.id ? 'selected' : ''}`}
                          onClick={() => !taken && !confirmed && setTableId(t.id)}
                        >
                          <circle className="table-circle" cx={t.x} cy={t.y} r="16" />
                          <text className="table-num" x={t.x} y={t.y}>{t.id}</text>
                        </g>
                      );
                    })}
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
              {menu.map((group) => (
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

        <InfoCard loc={loc} hours={hours} contact={contact} />
      </div>
    </div>
  );
}
