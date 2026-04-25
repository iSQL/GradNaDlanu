import { useState } from 'react';
import type { HotelContent, Location } from '../types';
import { ModuleHero } from './ModuleHero';
import { IconArea, IconBed, IconPhone, IconPin } from '../components/Icons';

interface Props { loc: Location; content: HotelContent }

export function HotelModule({ loc, content }: Props) {
  const [room, setRoom] = useState<number | null>(null);
  const [checkin, setCheckin] = useState('2026-05-10');
  const [checkout, setCheckout] = useState('2026-05-12');
  const [guests, setGuests] = useState(2);

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
            <div className="section-label">Sobe</div>
            <h2 className="section-title">Izaberite smeštaj</h2>
            <div className="rooms-grid">
              {content.rooms.map((r, i) => (
                <div
                  key={i}
                  className="room-card"
                  style={{ borderColor: room === i ? 'var(--navy)' : '' }}
                  onClick={() => setRoom(i)}
                >
                  <div className="room-img">[ {r.name.toLowerCase()} ]</div>
                  <div className="room-name">{r.name}</div>
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
              ))}
            </div>
          </div>
        </div>

        <div className="info-card">
          <div className="section-label">Rezervacija</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div className="field-label">Dolazak</div>
              <input className="field-input" type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} />
            </div>
            <div>
              <div className="field-label">Odlazak</div>
              <input className="field-input" type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)} />
            </div>
            <div>
              <div className="field-label">Gosti</div>
              <select className="field-select" value={guests} onChange={(e) => setGuests(+e.target.value)}>
                {[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
            {room !== null && (
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
                <strong style={{ color: 'var(--navy)' }}>{content.rooms[room].name}</strong>
                <br />
                2 noćenja × {content.rooms[room].price} din
                <br />
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
                    {(parseFloat(content.rooms[room].price.replace('.', '')) * 2).toLocaleString('sr-RS')} din
                  </strong>
                </div>
              </div>
            )}
            <button className="btn-primary" disabled={room === null}>
              {room !== null ? 'Rezerviši odabranu sobu' : 'Izaberite sobu →'}
            </button>
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
            <div className="info-row" style={{ padding: 0 }}>
              <div className="info-icon"><IconPhone /></div>
              <div>
                <div className="info-row-label">Recepcija</div>
                <div className="info-row-val">{content.contact.phone}</div>
              </div>
            </div>
            <div className="info-row">
              <div className="info-icon"><IconPin /></div>
              <div>
                <div className="info-row-label">Adresa</div>
                <div className="info-row-val">{content.contact.address}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
