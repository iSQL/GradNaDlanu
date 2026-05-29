import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDate, formatTime } from '../lib/format';
import type { LocationEvent, NewsItem } from '../types';

// Calendar block na karticama događaja — dan posebno, mesec posebno. Format
// kompatibilan sa našim dd/mm/yyyy: dan = numerički, mesec = numerički (01-12).
function calendarBlock(iso: string): { day: string; month: string } {
  const d = new Date(iso);
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: String(d.getMonth() + 1).padStart(2, '0'),
  };
}

function formatTimeRange(start: string, end: string | null): string {
  const a = formatTime(start);
  if (!end) return a;
  const b = formatTime(end);
  return a === b ? a : `${a}—${b}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + '…';
}

interface Props {
  locationId: number;
  locationSlug: string;
}

export function LocationDesavanjaPanel({ locationId, locationSlug }: Props) {
  const [events, setEvents] = useState<LocationEvent[] | null>(null);
  const [news, setNews] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setNews(null);
    Promise.all([
      api.listLocationEvents(locationSlug).catch(() => [] as LocationEvent[]),
      api.listNews({ locationId, limit: 8 }).catch(() => [] as NewsItem[]),
    ]).then(([ev, ns]) => {
      if (cancelled) return;
      setEvents(ev);
      setNews(ns);
    });
    return () => {
      cancelled = true;
    };
  }, [locationId, locationSlug]);

  const eventsEmpty = events !== null && events.length === 0;
  const newsEmpty = news !== null && news.length === 0;

  // Ne renderujemo ništa ako objekat nema ni jedno ni drugo — modul stranice bi
  // inače imale praznu sekciju "Dešavanja" sa dva empty-state-a, što je šum.
  if (eventsEmpty && newsEmpty) return null;

  return (
    <section className="loc-desavanja">
      <div className="loc-desavanja-head">
        <h2>Dešavanja</h2>
        <Link to="/desavanja" className="link-cta">
          Sva dešavanja →
        </Link>
      </div>

      <div className="loc-desavanja-cols">
        {/* === Najavljeni događaji === */}
        <div className="loc-desavanja-col">
          <div className="loc-desavanja-col-head">
            <span className="tile-kind kind-event">Događaji</span>
          </div>
          {events === null ? (
            <div className="loc-desavanja-empty">Učitavanje…</div>
          ) : events.length === 0 ? (
            <div className="loc-desavanja-empty">Trenutno nema najavljenih događaja.</div>
          ) : (
            <ul className="loc-desavanja-list">
              {events.map((e) => {
                const dm = calendarBlock(e.startsAt);
                const time = formatTimeRange(e.startsAt, e.endsAt);
                return (
                  <li key={e.id}>
                    <Link to={`/dogadjaj/${e.id}`} className="loc-desavanja-row">
                      <div className="loc-desavanja-date">
                        <div className="loc-desavanja-day">{dm.day}</div>
                        <div className="loc-desavanja-month">{dm.month}</div>
                      </div>
                      <div className="loc-desavanja-body">
                        <div className="loc-desavanja-title">{e.title}</div>
                        {e.description && (
                          <div className="loc-desavanja-desc">{truncate(e.description, 110)}</div>
                        )}
                      </div>
                      <div className="loc-desavanja-time">{time}</div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* === Obaveštenja === */}
        <div className="loc-desavanja-col">
          <div className="loc-desavanja-col-head">
            <span className="tile-kind kind-news">Obaveštenja</span>
          </div>
          {news === null ? (
            <div className="loc-desavanja-empty">Učitavanje…</div>
          ) : news.length === 0 ? (
            <div className="loc-desavanja-empty">Nema objavljenih obaveštenja.</div>
          ) : (
            <ul className="loc-desavanja-list">
              {news.map((n) => (
                <li key={n.id}>
                  <Link to={`/obavestenje/${n.slug}`} className="loc-desavanja-row loc-desavanja-row-news">
                    <div className="loc-desavanja-body">
                      <div className="loc-desavanja-title">{n.title}</div>
                      <div className="loc-desavanja-desc">{truncate(n.body, 130)}</div>
                    </div>
                    <div className="loc-desavanja-time loc-desavanja-time-news">
                      {formatDate(n.publishedAt ?? n.createdAt)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
