import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { CityEvent } from '../types';
import { PinGlyph } from './PinGlyph';

const MONTHS_SR = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];

function formatDayMonth(iso: string): { day: string; month: string } {
  const d = new Date(iso);
  return { day: String(d.getDate()), month: MONTHS_SR[d.getMonth()] };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatTimeRange(start: string, end: string | null): string {
  if (!end) return formatTime(start);
  const a = formatTime(start);
  const b = formatTime(end);
  if (a === b) return a;
  return `${a} — ${b}`;
}

interface Props {
  cat?: string;
  limit?: number;
}

export function EventsPanel({ cat, limit = 10 }: Props) {
  const [events, setEvents] = useState<CityEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    api.listEvents({ cat, limit })
      .then((rows) => { if (!cancelled) setEvents(rows); })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setEvents([]);
      });
    return () => { cancelled = true; };
  }, [cat, limit]);

  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2>Najavljeni događaji</h2>
      </div>
      {events === null ? (
        <div className="home-skeleton-list">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="home-skeleton-row" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="comments-empty">Trenutno nema najavljenih događaja.</div>
      ) : (
        <ul className="events-list">
          {events.map((e) => {
            const { day, month } = formatDayMonth(e.startsAt);
            const time = formatTimeRange(e.startsAt, e.endsAt);
            return (
              <li key={e.id} className="events-row">
                <div className="events-date">
                  <div className="events-date-day">{day}</div>
                  <div className="events-date-month">{month}</div>
                </div>
                <div className="events-body">
                  <div className="events-title">{e.title}</div>
                  <Link to={`/objekat/${e.locationSlug}`} className="events-loc">
                    <span className="events-loc-glyph">
                      <PinGlyph cat={e.locationCatId} size={14} />
                    </span>
                    {e.locationName}
                  </Link>
                  {e.description && <div className="events-desc">{e.description}</div>}
                </div>
                <div className="events-time">{time}</div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
