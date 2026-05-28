import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { SELA_ZABARI } from '../lib/villages';
import type { CityEvent, NewsItem } from '../types';

type Tab = 'all' | 'events' | 'news';

interface NewsCard {
  kind: 'news';
  id: number;
  date: string; // ISO za sortiranje
  data: NewsItem;
}
interface EventCard {
  kind: 'event';
  id: number;
  date: string;
  data: CityEvent;
}
type Card = NewsCard | EventCard;

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('sr-Latn-RS', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatEventTime(start: string, end: string | null): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('sr-Latn-RS', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  if (!end) return fmt(start);
  const sameDay = new Date(start).toDateString() === new Date(end).toDateString();
  if (sameDay) {
    const endTime = new Date(end).toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit' });
    return `${fmt(start)} → ${endTime}`;
  }
  return `${fmt(start)} → ${fmt(end)}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + '…';
}

const RECENT_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export function DesavanjaPage() {
  const [village, setVillage] = useState<string>('');
  const [tab, setTab] = useState<Tab>('all');
  const [showOld, setShowOld] = useState(false);
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [events, setEvents] = useState<CityEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setNews(null);
    setEvents(null);
    setError(null);
    Promise.all([
      api.listNews({ village: village || undefined, limit: 50 }),
      api.listEvents({ village: village || undefined, limit: 50, includePast: true }),
    ])
      .then(([n, e]) => {
        if (!cancelled) {
          setNews(n);
          setEvents(e);
        }
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) {
          setError('Greška prilikom učitavanja dešavanja.');
          setNews([]);
          setEvents([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [village]);

  const cards = useMemo<Card[]>(() => {
    const now = Date.now();
    const sevenDaysAgo = now - RECENT_THRESHOLD_MS;
    const list: Card[] = [];
    if (tab === 'all' || tab === 'news') {
      for (const n of news ?? []) {
        const dateIso = n.publishedAt ?? n.createdAt;
        // Obaveštenja: skrivamo starija od 7 dana ako korisnik ne traži stara.
        if (!showOld && new Date(dateIso).getTime() < sevenDaysAgo) continue;
        list.push({ kind: 'news', id: n.id, date: dateIso, data: n });
      }
    }
    if (tab === 'all' || tab === 'events') {
      for (const e of events ?? []) {
        if (!showOld) {
          // Aktivan događaj: endsAt u budućnosti, ili (ako nema endsAt) startsAt nije
          // stariji od 7 dana. Tako višednevni festival ne nestaje pre kraja,
          // a jednokratan događaj se prikazuje još 7 dana posle.
          const endMs = e.endsAt ? new Date(e.endsAt).getTime() : null;
          const startMs = new Date(e.startsAt).getTime();
          const stillActive = endMs !== null ? endMs >= now : startMs >= sevenDaysAgo;
          if (!stillActive) continue;
        }
        list.push({ kind: 'event', id: e.id, date: e.startsAt, data: e });
      }
    }
    // Najnovije/najskorije prvo. Za events sa budućim startsAt-om to ih gura na vrh,
    // što je intuitivno za korisnika koji traži šta dolazi.
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }, [news, events, tab, showOld]);

  const loading = news === null || events === null;

  return (
    <div className="page page-desavanja">
      <div className="page-shell">
        <header className="page-head">
          <h1>Dešavanja</h1>
          <p className="page-sub">
            Sva obaveštenja i događaji koje objavljuju vlasnici objekata u opštini Žabari.
          </p>
        </header>

        <div className="desavanja-tabs" role="tablist" aria-label="Tip dešavanja">
          {(
            [
              { key: 'all', label: 'Sva dešavanja' },
              { key: 'events', label: 'Događaji' },
              { key: 'news', label: 'Obaveštenja' },
            ] as { key: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`desavanja-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="objekti-filters">
          <label className="filter-field">
            <span>Selo</span>
            <select value={village} onChange={(e) => setVillage(e.target.value)}>
              <option value="">Sva sela</option>
              {SELA_ZABARI.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={showOld}
              onChange={(e) => setShowOld(e.target.checked)}
            />
            <span>Prikaži stara obaveštenja</span>
          </label>
        </div>

        {error && <div className="empty-state">{error}</div>}
        {loading ? (
          <div className="empty-state">Učitavam dešavanja…</div>
        ) : cards.length === 0 ? (
          <div className="empty-state">
            Trenutno nema {tab === 'events' ? 'događaja' : tab === 'news' ? 'obaveštenja' : 'dešavanja'}
            {village ? ` za selo ${village}` : ''}.
          </div>
        ) : (
          <ul className="desavanja-list">
            {cards.map((c) =>
              c.kind === 'news' ? (
                <li key={`news-${c.id}`} className="desavanja-card desavanja-card-news">
                  <div className="desavanja-card-kind">Obaveštenje</div>
                  <div className="desavanja-card-meta">
                    <Link to={`/objekat/${c.data.locationSlug}`} className="desavanja-card-loc">
                      {c.data.locationName}
                    </Link>
                    {c.data.village ? <span> · {c.data.village}</span> : null}
                    <span className="desavanja-card-date"> · {formatDate(c.data.publishedAt ?? c.data.createdAt)}</span>
                  </div>
                  <h2 className="desavanja-card-title">{c.data.title}</h2>
                  <p className="desavanja-card-body">{truncate(c.data.body, 280)}</p>
                </li>
              ) : (
                <li key={`event-${c.id}`} className="desavanja-card desavanja-card-event">
                  <div className="desavanja-card-kind">Događaj</div>
                  <div className="desavanja-card-meta">
                    <Link to={`/objekat/${c.data.locationSlug}`} className="desavanja-card-loc">
                      {c.data.locationName}
                    </Link>
                    {c.data.village ? <span> · {c.data.village}</span> : null}
                  </div>
                  <h2 className="desavanja-card-title">{c.data.title}</h2>
                  <div className="desavanja-card-when">{formatEventTime(c.data.startsAt, c.data.endsAt)}</div>
                  {c.data.description && (
                    <p className="desavanja-card-body">{truncate(c.data.description, 280)}</p>
                  )}
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
