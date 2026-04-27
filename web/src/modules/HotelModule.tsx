import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import type {
  AvailabilityRow,
  HotelContent,
  HotelReservationPayload,
  Location,
} from '../types';
import { ModuleHero } from './ModuleHero';
import { IconArea, IconBed, IconPhone, IconPin } from '../components/Icons';

interface Props { loc: Location; content: HotelContent }

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nightsBetween(from: string, to: string): number {
  const ms = Date.parse(to) - Date.parse(from);
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function priceToNumber(s: string): number {
  return parseFloat(s.replace(/\./g, '').replace(/,/g, '.')) || 0;
}

export function HotelModule({ loc, content }: Props) {
  const ctx = useOutletContext<AppContext>();
  const rooms = content.rooms ?? [];
  const facts = content.facts ?? [];
  const contact = content.contact ?? { phone: '', email: '', address: loc.address };

  const today = todayIso();
  const [roomIdx, setRoomIdx] = useState<number | null>(null);
  const [checkin, setCheckin] = useState(today);
  const [checkout, setCheckout] = useState(addDaysIso(today, 2));
  const [guests, setGuests] = useState(2);
  const [confirmed, setConfirmed] = useState<{ id: number; status: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);

  // Look ahead 60 days from check-in for the picker.
  useEffect(() => {
    const to = addDaysIso(checkin, 60);
    api
      .availability(loc.slug, checkin, to)
      .then(setAvailability)
      .catch(() => setAvailability([]));
  }, [checkin, loc.slug, confirmed]);

  // Set of room indices that are unavailable for the selected window.
  const takenRoomKeys = useMemo(() => {
    const wantFrom = Date.parse(checkin);
    const wantTo = Date.parse(checkout);
    const taken = new Set<string>();
    for (const a of availability) {
      const p = a.payload as { roomKey?: string; dateFrom?: string; dateTo?: string };
      if (!p.roomKey || !p.dateFrom || !p.dateTo) continue;
      const f = Date.parse(p.dateFrom);
      const t = Date.parse(p.dateTo);
      if (f < wantTo && t > wantFrom) taken.add(p.roomKey);
    }
    return taken;
  }, [availability, checkin, checkout]);

  useEffect(() => {
    if (roomIdx === null) return;
    if (takenRoomKeys.has(`r-${roomIdx}`)) setRoomIdx(null);
  }, [takenRoomKeys, roomIdx]);

  const nights = nightsBetween(checkin, checkout);
  const loggedIn = !!ctx.currentUser;

  const submit = async () => {
    if (roomIdx === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: HotelReservationPayload = {
        roomKey: `r-${roomIdx}`,
        dateFrom: checkin,
        dateTo: checkout,
        guests,
      };
      const res = await api.createReservation(loc.slug, payload);
      setConfirmed({ id: res.id, status: res.status });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('409')) setError('Soba je već rezervisana u izabranom periodu.');
      else if (message.includes('401')) setError('Prijavite se da biste rezervisali.');
      else setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const datesValid = checkin && checkout && nights > 0;

  return (
    <div className="module-page">
      <ModuleHero loc={loc} tagline={content.tagline} />
      <div className="module-body">
        <div>
          <div className="gallery" style={{ height: 280 }}>
            <div className="gallery-img">[ recepcija ]</div>
            <div className="gallery-img">[ soba ]</div>
            <div className="gallery-img">[ restoran ]</div>
            <div className="gallery-img">[ enterijer ]</div>
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

          <div className="module-section">
            <div className="section-label">Sobe</div>
            <h2 className="section-title">Izaberite smeštaj</h2>
            <div className="rooms-grid">
              {rooms.map((r, i) => {
                const taken = takenRoomKeys.has(`r-${i}`);
                return (
                  <div
                    key={i}
                    className="room-card"
                    style={{
                      borderColor: roomIdx === i ? 'var(--navy)' : '',
                      opacity: taken ? 0.5 : 1,
                      cursor: taken ? 'not-allowed' : 'pointer',
                    }}
                    onClick={() => !taken && !confirmed && setRoomIdx(i)}
                  >
                    <div className="room-img">[ {r.name.toLowerCase()} ]</div>
                    <div className="room-name">
                      {r.name}{taken && ' · zauzeta'}
                    </div>
                    <div className="room-meta">
                      <span><IconBed /> {r.beds}</span>
                      <span><IconArea /> {r.area}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', opacity: 0.7 }}>{r.amen}</div>
                    <div className="room-price">
                      <span className="room-price-num">{r.price}</span>
                      <span className="room-price-unit">din / noć</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="info-card">
          <div className="section-label">Rezervacija</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div className="field-label">Dolazak</div>
              <input className="field-input" type="date" min={today} value={checkin} onChange={(e) => {
                setCheckin(e.target.value);
                if (Date.parse(e.target.value) >= Date.parse(checkout)) {
                  setCheckout(addDaysIso(e.target.value, 1));
                }
              }} />
            </div>
            <div>
              <div className="field-label">Odlazak</div>
              <input className="field-input" type="date" min={addDaysIso(checkin, 1)} value={checkout} onChange={(e) => setCheckout(e.target.value)} />
            </div>
            <div>
              <div className="field-label">Gosti</div>
              <select className="field-select" value={guests} onChange={(e) => setGuests(+e.target.value)}>
                {[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
            {roomIdx !== null && datesValid && (
              <div
                style={{
                  padding: 12,
                  background: 'var(--paper)',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                <strong style={{ color: 'var(--navy)' }}>{rooms[roomIdx].name}</strong>
                <br />
                {nights} {nights === 1 ? 'noć' : 'noći'} × {rooms[roomIdx].price} din
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: '1px dashed var(--line)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 14,
                  }}
                >
                  <span>Ukupno</span>
                  <strong style={{ color: 'var(--gold-2)', fontFamily: 'Fraunces, serif' }}>
                    {(priceToNumber(rooms[roomIdx].price) * nights).toLocaleString('sr-RS')} din
                  </strong>
                </div>
              </div>
            )}
            {!loggedIn ? (
              <Link to="/prijava" className="btn-primary" style={{ textAlign: 'center', textDecoration: 'none' }}>
                Prijavite se za rezervaciju
              </Link>
            ) : (
              <button
                type="button"
                className="btn-primary"
                disabled={roomIdx === null || !datesValid || submitting || !!confirmed}
                onClick={submit}
              >
                {confirmed
                  ? '✓ Zahtev poslat'
                  : submitting
                  ? 'Slanje…'
                  : roomIdx !== null
                  ? 'Rezerviši odabranu sobu'
                  : 'Izaberite sobu →'}
              </button>
            )}
            {confirmed && (
              <div style={{ fontSize: 12, color: 'var(--moss)', textAlign: 'center', lineHeight: 1.5 }}>
                Rezervacija #{confirmed.id} — status: <strong>{confirmed.status}</strong>.
              </div>
            )}
            {error && <div className="login-error">{error}</div>}
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
            <div className="info-row" style={{ padding: 0 }}>
              <div className="info-icon"><IconPhone /></div>
              <div>
                <div className="info-row-label">Recepcija</div>
                <div className="info-row-val">{contact.phone}</div>
              </div>
            </div>
            <div className="info-row">
              <div className="info-icon"><IconPin /></div>
              <div>
                <div className="info-row-label">Adresa</div>
                <div className="info-row-val">{contact.address}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
