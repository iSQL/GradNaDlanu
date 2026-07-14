import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import {
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  isServiceCategory,
  type ServiceCategory,
} from '../lib/usluge';
import { MajstorStatLine, Stars } from '../components/MajstorStats';
import { formatDate } from '../lib/format';
import type { MajstorDirectoryEntry } from '../types';

type Filter = 'sve' | ServiceCategory;

// /majstori — javni imenik majstora usluga: kategorije, prosečna ocena, broj
// završenih poslova, brzina odgovora i poslednje ocene sa kratkim komentarima.
// "Zatraži uslugu" vodi na /usluge sa preselektovanim majstorom.
export function MajstoriPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlCat = searchParams.get('cat');
  const [filter, setFilter] = useState<Filter>(isServiceCategory(urlCat) ? urlCat : 'sve');
  const [majstori, setMajstori] = useState<MajstorDirectoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Prošireni prikaz svih ocena po majstoru (default: prve 2).
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    api
      .listMajstori()
      .then(setMajstori)
      .catch((e: Error) => setError(e.message));
  }, []);

  const selectFilter = (next: Filter) => {
    setFilter(next);
    setSearchParams(next === 'sve' ? {} : { cat: next }, { replace: true });
  };

  const shown = useMemo(() => {
    if (majstori === null) return null;
    if (filter === 'sve') return majstori;
    return majstori.filter((m) => m.categories.includes(filter));
  }, [majstori, filter]);

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // CTA: kategorija iz aktivnog filtera ako je majstor pokriva, inače prva
  // majstorova — /usluge preselektuje i kategoriju i samog majstora.
  const requestFrom = (m: MajstorDirectoryEntry) => {
    const cat = filter !== 'sve' && m.categories.includes(filter) ? filter : m.categories[0];
    navigate(`/usluge?cat=${encodeURIComponent(cat)}&majstor=${m.id}`);
  };

  return (
    <div className="page page-majstori">
      <div className="page-shell">
        <header className="page-head">
          <h1>Majstori</h1>
          <p className="page-sub">
            Pregledajte majstore po kategorijama, njihove ocene i utiske sa već završenih
            poslova — pa zatražite uslugu od onog koji vam najviše odgovara.
          </p>
        </header>

        <div className="oglasi-cats" style={{ marginBottom: 24 }}>
          <button
            className={`oglasi-cat-chip ${filter === 'sve' ? 'is-active' : ''}`}
            onClick={() => selectFilter('sve')}
          >
            Sve kategorije
          </button>
          {SERVICE_CATEGORIES.map((c) => (
            <button
              key={c}
              className={`oglasi-cat-chip ${filter === c ? 'is-active' : ''}`}
              onClick={() => selectFilter(c)}
            >
              {SERVICE_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        {error && <div className="login-error">{error}</div>}

        {shown === null ? (
          <div className="comments-empty">Učitavanje…</div>
        ) : shown.length === 0 ? (
          <div className="comments-empty">
            {filter === 'sve'
              ? 'Trenutno nema registrovanih majstora.'
              : 'Trenutno nema majstora za ovu kategoriju.'}
          </div>
        ) : (
          <div className="majstori-grid">
            {shown.map((m) => {
              const isOpen = expanded.has(m.id);
              const visibleReviews = isOpen ? m.reviews : m.reviews.slice(0, 2);
              return (
                <div key={m.id} className="usluge-card majstori-card">
                  <div className="majstori-card-head">
                    <span className="usluge-majstor-avatar" aria-hidden="true">
                      {m.displayName.charAt(0).toUpperCase()}
                    </span>
                    <div className="majstori-card-id">
                      <div className="usluge-majstor-name">{m.displayName}</div>
                      <MajstorStatLine stats={m} />
                    </div>
                  </div>

                  <div className="usluge-chips">
                    {m.categories.map((c) => (
                      <span key={c} className="usluge-chip">
                        {isServiceCategory(c) ? SERVICE_CATEGORY_LABELS[c] : c}
                      </span>
                    ))}
                  </div>

                  {m.reviews.length > 0 && (
                    <div className="majstori-reviews">
                      {visibleReviews.map((r, i) => (
                        <div key={i} className="majstori-review">
                          <div className="majstori-review-head">
                            <Stars value={r.stars} />
                            <span className="majstori-review-meta">
                              {r.reviewerName} · {formatDate(r.ratedAt)}
                            </span>
                          </div>
                          {r.comment && <div className="majstori-review-text">{r.comment}</div>}
                        </div>
                      ))}
                      {m.reviews.length > 2 && (
                        <button
                          type="button"
                          className="row-action"
                          onClick={() => toggleExpanded(m.id)}
                        >
                          {isOpen ? 'Prikaži manje' : `Sve ocene (${m.reviews.length})`}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="majstori-card-actions">
                    <button className="btn-primary" type="button" onClick={() => requestFrom(m)}>
                      Zatraži uslugu
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
