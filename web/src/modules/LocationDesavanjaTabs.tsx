import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDate, formatTime } from '../lib/format';
import type { LocationEvent, NewsItem } from '../types';

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

interface State {
  events: LocationEvent[];
  news: NewsItem[];
  loading: boolean;
}

// Shared fetch — parent module mounts once, tab switches don't re-trigger.
export function useLocationDesavanja(locationId: number, locationSlug: string): State {
  const [state, setState] = useState<State>({ events: [], news: [], loading: true });
  useEffect(() => {
    let cancelled = false;
    setState({ events: [], news: [], loading: true });
    Promise.all([
      api.listLocationEvents(locationSlug).catch(() => [] as LocationEvent[]),
      api.listNews({ locationId, limit: 20 }).catch(() => [] as NewsItem[]),
    ]).then(([events, news]) => {
      if (cancelled) return;
      setState({ events, news, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [locationId, locationSlug]);
  return state;
}

export function LocationEventsList({ items, loading }: { items: LocationEvent[]; loading: boolean }) {
  if (loading) return <div className="loc-desavanja-empty">Učitavanje…</div>;
  if (items.length === 0) return <div className="loc-desavanja-empty">Trenutno nema najavljenih događaja.</div>;
  return (
    <ul className="loc-desavanja-list">
      {items.map((e) => {
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
                  <div className="loc-desavanja-desc">{truncate(e.description, 180)}</div>
                )}
              </div>
              <div className="loc-desavanja-time">{time}</div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function LocationNewsList({ items, loading }: { items: NewsItem[]; loading: boolean }) {
  if (loading) return <div className="loc-desavanja-empty">Učitavanje…</div>;
  if (items.length === 0) return <div className="loc-desavanja-empty">Nema objavljenih obaveštenja.</div>;
  return (
    <ul className="loc-desavanja-list">
      {items.map((n) => (
        <li key={n.id}>
          <Link to={`/obavestenje/${n.slug}`} className="loc-desavanja-row loc-desavanja-row-news">
            <div className="loc-desavanja-body">
              <div className="loc-desavanja-title">{n.title}</div>
              <div className="loc-desavanja-desc">{truncate(n.body, 220)}</div>
            </div>
            <div className="loc-desavanja-time loc-desavanja-time-news">
              {formatDate(n.publishedAt ?? n.createdAt)}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
