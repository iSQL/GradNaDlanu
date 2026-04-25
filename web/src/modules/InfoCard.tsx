import type { Location } from '../types';
import { IconClock, IconMail, IconPhone, IconPin, IconWeb } from '../components/Icons';

const today = new Date().getDay();
const dayIdx = today === 0 ? 6 : today - 1;

type Hour = { day: string; hours: string } | [string, string];

interface Props {
  loc: Location;
  hours?: Hour[];
  contact?: { phone?: string; email?: string; web?: string; address?: string };
  todayLabel?: string;
}

export function InfoCard({ loc, hours, contact, todayLabel = 'Radno vreme' }: Props) {
  return (
    <div className="info-card">
      <div className="section-label">Informacije</div>

      <div className="info-row">
        <div className="info-icon"><IconPin /></div>
        <div>
          <div className="info-row-label">Adresa</div>
          <div className="info-row-val">{loc.address}<br />12374 Žabari</div>
        </div>
      </div>

      {contact?.phone && (
        <div className="info-row">
          <div className="info-icon"><IconPhone /></div>
          <div>
            <div className="info-row-label">Telefon</div>
            <div className="info-row-val">{contact.phone}</div>
          </div>
        </div>
      )}

      {contact?.email && (
        <div className="info-row">
          <div className="info-icon"><IconMail /></div>
          <div>
            <div className="info-row-label">E-pošta</div>
            <div className="info-row-val">{contact.email}</div>
          </div>
        </div>
      )}

      {contact?.web && (
        <div className="info-row">
          <div className="info-icon"><IconWeb /></div>
          <div>
            <div className="info-row-label">Veb</div>
            <div className="info-row-val">{contact.web}</div>
          </div>
        </div>
      )}

      {hours && (
        <div style={{ paddingTop: 14 }}>
          <div className="info-row-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <IconClock /> {todayLabel}
          </div>
          <table className="hours-table">
            <tbody>
              {hours.map((h, i) => {
                const isObj = !Array.isArray(h);
                const day = isObj ? h.day : h[0];
                const text = isObj ? h.hours : h[1];
                const isToday = isObj && i === dayIdx;
                return (
                  <tr key={i} className={isToday ? 'today' : ''}>
                    <td>{day}</td>
                    <td>{text}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
