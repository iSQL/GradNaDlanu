import { Link } from 'react-router-dom';
import type { LocationEvent, NewsItem } from '../types';
import { IconClock, IconMail, IconPhone, IconPin, IconWeb } from '../components/Icons';
import { LocationEventsList, LocationNewsList } from './LocationDesavanjaTabs';

type HourRow = { day: string; hours: string } | [string, string];

interface Fact {
  num: string;
  em?: string;
  label: string;
}

interface Contact {
  phone?: string;
  email?: string;
  web?: string;
  address?: string;
}

interface Props {
  loc: { slug: string; address: string };
  infoLabel: string;
  tagline: string;
  contact?: Contact;
  facts?: Fact[];
  hours?: HourRow[];
  hoursLabel?: string;
  desavanja: { events: LocationEvent[]; news: NewsItem[]; loading: boolean };
  extraSidebar?: React.ReactNode;
}

const TODAY_DOW = (() => {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
})();

export function OpsteTab({
  loc,
  infoLabel,
  tagline,
  contact,
  facts,
  hours,
  hoursLabel = 'Radno vreme',
  desavanja,
  extraSidebar,
}: Props) {
  const news3 = desavanja.news.slice(0, 3);
  const events3 = desavanja.events.slice(0, 3);

  return (
    <div className="module-opste">
      <div className="module-opste-main">
        <section className="module-opste-section">
          <div className="module-opste-head">
            <div className="section-label">Obaveštenja</div>
            <Link to={{ search: '?tab=obavestenja' }} replace className="module-opste-more">
              Sva obaveštenja →
            </Link>
          </div>
          <LocationNewsList items={news3} loading={desavanja.loading} />
        </section>

        <section className="module-opste-section">
          <div className="module-opste-head">
            <div className="section-label">Najavljeni događaji</div>
            <Link to={{ search: '?tab=dogadjaji' }} replace className="module-opste-more">
              Svi događaji →
            </Link>
          </div>
          <LocationEventsList items={events3} loading={desavanja.loading} />
        </section>
      </div>

      <aside className="module-opste-side">
        <div className="info-card module-opste-card">
          <div className="section-label">{infoLabel}</div>
          <p className="module-opste-tagline">{tagline}</p>

          {facts && facts.length > 0 && (
            <div className="module-opste-facts">
              {facts.map((f, i) => (
                <div key={i}>
                  <div className="module-opste-fact-num">
                    {f.num}
                    {f.em && <em>{f.em}</em>}
                  </div>
                  <div className="module-opste-fact-label">{f.label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="info-row">
            <div className="info-icon"><IconPin /></div>
            <div>
              <div className="info-row-label">Adresa</div>
              <div className="info-row-val">
                {contact?.address || loc.address}
                <br />12374 Žabari
              </div>
              <Link to={`/mapa?focus=${loc.slug}`} className="info-row-map-link">
                Prikaži na mapi →
              </Link>
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

          {hours && hours.length > 0 && (
            <div className="module-opste-hours">
              <div className="info-row-label module-opste-hours-label">
                <IconClock /> {hoursLabel}
              </div>
              <table className="hours-table">
                <tbody>
                  {hours.map((h, i) => {
                    const isObj = !Array.isArray(h);
                    const day = isObj ? h.day : h[0];
                    const text = isObj ? h.hours : h[1];
                    const isToday = isObj && i === TODAY_DOW;
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

          {extraSidebar}
        </div>
      </aside>
    </div>
  );
}
