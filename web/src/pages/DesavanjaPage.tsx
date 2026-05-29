import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { SELA_ZABARI } from '../lib/villages';
import { formatDate, formatDateTimeRange } from '../lib/format';
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

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + '…';
}

const RECENT_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE_STEP = 10;

// Selekcija objekata: prazan Set = nema aktivnog filtera = prikaži sve.
// Korisnik dodaje objekte u Set klikom na chip. "Poništi filtere" prazni Set.
interface LocOption {
  id: number;
  name: string;
  cards: number; // za badge "× 3" kad ima više dešavanja istog objekta
}

export function DesavanjaPage() {
  const [village, setVillage] = useState<string>('');
  const [tab, setTab] = useState<Tab>('all');
  const [showOld, setShowOld] = useState(false);
  const [locSel, setLocSel] = useState<Set<number>>(() => new Set());
  const [limit, setLimit] = useState(PAGE_STEP);
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [events, setEvents] = useState<CityEvent[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const isInitial = limit === PAGE_STEP;
    if (isInitial) {
      // Prvi fetch (ili promena village-a) — pokaži skelet, sakri staru listu.
      setNews(null);
      setEvents(null);
    } else {
      // "Učitaj još" — zadrži postojeću listu na ekranu, samo dugme prelazi u loading.
      setLoadingMore(true);
    }
    setError(null);
    Promise.all([
      api.listNews({ village: village || undefined, limit }),
      api.listEvents({ village: village || undefined, limit, includePast: true }),
    ])
      .then(([n, e]) => {
        if (cancelled) return;
        setNews(n);
        setEvents(e);
        // Server vrati tačno `limit` redova kad ima više = znak da treba još.
        // Ako vrati manje, dospeli smo do kraja za taj tip.
        setHasMore(n.length === limit || e.length === limit);
        setLoadingMore(false);
      })
      .catch((err) => {
        console.error(err);
        if (cancelled) return;
        setError('Greška prilikom učitavanja dešavanja.');
        setNews([]);
        setEvents([]);
        setHasMore(false);
        setLoadingMore(false);
      });
    return () => {
      cancelled = true;
    };
  }, [village, limit]);

  // Promena sela resetuje paginaciju na prvih PAGE_STEP. Atomski sa `setVillage`
  // u handleru — React batchuje oba setState-a u jedan re-render i jedan fetch.
  const handleVillageChange = (v: string) => {
    setVillage(v);
    setLimit(PAGE_STEP);
  };

  const loadMore = () => {
    setLimit((l) => l + PAGE_STEP);
  };

  // Prefiltered: tab + showOld + village (server-side village je već urađen, ali
  // ovo je lista koja odlučuje koji objekti su "trenutno aktivni" za chip filter.
  // Zato računamo PRE primene location filtera).
  const prefilteredCards = useMemo<Card[]>(() => {
    const now = Date.now();
    const sevenDaysAgo = now - RECENT_THRESHOLD_MS;
    const list: Card[] = [];
    if (tab === 'all' || tab === 'news') {
      for (const n of news ?? []) {
        const dateIso = n.publishedAt ?? n.createdAt;
        if (!showOld && new Date(dateIso).getTime() < sevenDaysAgo) continue;
        list.push({ kind: 'news', id: n.id, date: dateIso, data: n });
      }
    }
    if (tab === 'all' || tab === 'events') {
      for (const e of events ?? []) {
        if (!showOld) {
          const endMs = e.endsAt ? new Date(e.endsAt).getTime() : null;
          const startMs = new Date(e.startsAt).getTime();
          const stillActive = endMs !== null ? endMs >= now : startMs >= sevenDaysAgo;
          if (!stillActive) continue;
        }
        list.push({ kind: 'event', id: e.id, date: e.startsAt, data: e });
      }
    }
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }, [news, events, tab, showOld]);

  // Lista objekata koji TRENUTNO imaju vidljiva dešavanja. Dinamička — menja se
  // kad korisnik prebaci tab, toggle-uje "Prikaži stara", ili menja selo.
  const availableLocations = useMemo<LocOption[]>(() => {
    const byId = new Map<number, LocOption>();
    for (const c of prefilteredCards) {
      const locId = c.kind === 'news' ? c.data.locationId : c.data.locationId;
      const locName = c.kind === 'news' ? c.data.locationName : c.data.locationName;
      const existing = byId.get(locId);
      if (existing) {
        existing.cards += 1;
      } else {
        byId.set(locId, { id: locId, name: locName, cards: 1 });
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'sr'));
  }, [prefilteredCards]);

  // Finalna lista posle location filtera. Prazan Set = nema filtera → prikazuje
  // sve. Inače propušta samo kartice čiji je locationId eksplicitno izabran.
  const cards = useMemo<Card[]>(() => {
    if (locSel.size === 0) return prefilteredCards;
    return prefilteredCards.filter((c) => locSel.has(c.data.locationId));
  }, [prefilteredCards, locSel]);

  // Toggle: dodaj/oduzmi objekat iz seta. Prazno-na-prazno znači "obrisao sam
  // poslednji izbor", što vraća feed na default (sve vidljivo).
  const toggleLocation = (id: number) => {
    setLocSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // "Poništi filtere" — vrati u default (prazan Set = sve vidljivo).
  const clearFilters = () => {
    setLocSel(new Set());
  };

  const hasActiveFilter = locSel.size > 0;

  const isSelected = (id: number): boolean => locSel.has(id);

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
            <select value={village} onChange={(e) => handleVillageChange(e.target.value)}>
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

        {availableLocations.length > 0 && (
          <div className="loc-filter">
            <div className="loc-filter-head">
              <span className="loc-filter-label">Objekti</span>
              <button
                type="button"
                className="loc-filter-toggle"
                onClick={clearFilters}
                disabled={!hasActiveFilter}
              >
                Poništi filtere
              </button>
            </div>
            <div className="loc-filter-chips" role="group" aria-label="Filter po objektima">
              {availableLocations.map((l) => {
                const on = isSelected(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    className={`loc-chip ${on ? 'on' : ''}`}
                    onClick={() => toggleLocation(l.id)}
                    aria-pressed={on}
                  >
                    <span className="loc-chip-check" aria-hidden="true">
                      {on ? '✓' : ''}
                    </span>
                    <span className="loc-chip-name">{l.name}</span>
                    <span className="loc-chip-count">{l.cards}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && <div className="empty-state">{error}</div>}
        {loading ? (
          <div className="empty-state">Učitavam dešavanja…</div>
        ) : cards.length === 0 ? (
          <div className="empty-state">
            {hasActiveFilter
              ? 'Nema dešavanja za izabrane objekte. Probaj druge filtere ili klikni "Poništi filtere".'
              : `Trenutno nema ${tab === 'events' ? 'događaja' : tab === 'news' ? 'obaveštenja' : 'dešavanja'}${village ? ` za selo ${village}` : ''}.`}
          </div>
        ) : (
          <ul className="desavanja-grid">
            {cards.map((c) =>
              c.kind === 'news' ? (
                <li key={`news-${c.id}`} className="desavanja-tile-wrap">
                  <Link to={`/obavestenje/${c.data.slug}`} className="news-tile news-tile-d">
                    <div className="news-tile-eyebrow">
                      <span className="tile-kind kind-news">Obaveštenje</span>
                      <span className="news-tile-date">
                        {formatDate(c.data.publishedAt ?? c.data.createdAt)}
                      </span>
                    </div>
                    <h3 className="news-tile-title">{c.data.title}</h3>
                    <p className="news-tile-body">{truncate(c.data.body, 160)}</p>
                    <div className="news-tile-loc">
                      {c.data.locationName}
                      {c.data.village ? ` · ${c.data.village}` : ''}
                    </div>
                  </Link>
                </li>
              ) : (
                <li key={`event-${c.id}`} className="desavanja-tile-wrap">
                  <Link to={`/dogadjaj/${c.data.id}`} className="news-tile news-tile-d news-tile-event">
                    <div className="news-tile-eyebrow">
                      <span className="tile-kind kind-event">Događaj</span>
                      <span className="news-tile-date">{formatDate(c.data.startsAt)}</span>
                    </div>
                    <h3 className="news-tile-title">{c.data.title}</h3>
                    <div className="news-tile-when">
                      {formatDateTimeRange(c.data.startsAt, c.data.endsAt)}
                    </div>
                    {c.data.description && (
                      <p className="news-tile-body">{truncate(c.data.description, 130)}</p>
                    )}
                    <div className="news-tile-loc">
                      {c.data.locationName}
                      {c.data.village ? ` · ${c.data.village}` : ''}
                    </div>
                  </Link>
                </li>
              ),
            )}
          </ul>
        )}

        {!loading && !error && hasMore && (
          <div className="desavanja-loadmore">
            <button
              type="button"
              className="btn-secondary"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Učitavam…' : 'Učitaj još'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
