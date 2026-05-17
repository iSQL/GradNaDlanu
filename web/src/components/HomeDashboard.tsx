import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import type { Location, RecentComment } from '../types';
import { IconStar } from './Icons';
import { PinGlyph } from './PinGlyph';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short', year: 'numeric' });
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + '…';
}

function SkeletonRows({ n }: { n: number }) {
  return (
    <div className="home-skeleton-list">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="home-skeleton-row" />
      ))}
    </div>
  );
}

export function HomeDashboard() {
  const { activeFilter } = useOutletContext<AppContext>();
  const cat = activeFilter === 'all' ? undefined : activeFilter;

  const [comments, setComments] = useState<RecentComment[] | null>(null);
  const [recent, setRecent] = useState<Location[] | null>(null);
  const [popular, setPopular] = useState<Location[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setComments(null);
    setRecent(null);
    setPopular(null);
    Promise.all([
      api.recentComments({ limit: 12, cat }),
      api.listLocations({ sort: 'recent', limit: 6, cat }),
      api.listLocations({ sort: 'popular', limit: 6, cat }),
    ])
      .then(([c, r, p]) => {
        if (cancelled) return;
        setComments(c);
        setRecent(r);
        setPopular(p);
      })
      .catch((err) => {
        console.error(err);
        if (cancelled) return;
        setComments([]);
        setRecent([]);
        setPopular([]);
      });
    return () => {
      cancelled = true;
    };
  }, [cat]);

  return (
    <div className="home-dashboard">
      <div className="home-shell">
        <header className="home-head">
          <h1>Pregled dešavanja</h1>
          <p className="home-sub">
            Šta se trenutno dešava u Žabarima
            {cat ? <> · kategorija <strong>{cat}</strong></> : null}
          </p>
        </header>

        <section className="home-section">
          <div className="home-section-head">
            <h2>Najnoviji komentari</h2>
          </div>
          {comments === null ? (
            <SkeletonRows n={3} />
          ) : comments.length === 0 ? (
            <div className="comments-empty">Još nema komentara.</div>
          ) : (
            <div className="comments-list">
              {comments.map((c) => (
                <article key={c.id} className="comment">
                  <div className="comment-head">
                    <span className="comment-author">{c.author.displayName}</span>
                    <span className="home-comment-sep">·</span>
                    <Link to={`/objekat/${c.location.slug}`} className="comment-loc">
                      {c.location.name}
                    </Link>
                    {c.rating !== null && (
                      <div className="comment-rating">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <IconStar key={n} filled={n <= c.rating!} />
                        ))}
                      </div>
                    )}
                    <span className="comment-date">{formatDate(c.createdAt)}</span>
                  </div>
                  <div className="comment-body">{truncate(c.body, 200)}</div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="home-section">
          <div className="home-section-head">
            <h2>Najnovije lokacije</h2>
          </div>
          {recent === null ? (
            <SkeletonRows n={3} />
          ) : recent.length === 0 ? (
            <div className="comments-empty">Još nema dodatih lokacija.</div>
          ) : (
            <div className="account-favorites">
              {recent.map((l) => (
                <div className="favorite-card" key={l.id}>
                  <Link to={`/objekat/${l.slug}`} className="favorite-link">
                    <div className="favorite-glyph">
                      <PinGlyph cat={l.catId} size={28} />
                    </div>
                    <div>
                      <div className="favorite-name">{l.name}</div>
                      <div className="favorite-meta">{l.address}</div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="home-section">
          <div className="home-section-head">
            <h2>Najpopularnije</h2>
          </div>
          {popular === null ? (
            <SkeletonRows n={3} />
          ) : popular.length === 0 ? (
            <div className="comments-empty">Još nema ocenjenih lokacija.</div>
          ) : (
            <div className="account-favorites">
              {popular.map((l) => (
                <div className="favorite-card" key={l.id}>
                  <Link to={`/objekat/${l.slug}`} className="favorite-link">
                    <div className="favorite-glyph">
                      <PinGlyph cat={l.catId} size={28} />
                    </div>
                    <div>
                      <div className="favorite-name">{l.name}</div>
                      <div className="favorite-meta">{l.address}</div>
                    </div>
                  </Link>
                  <div className="home-popular-stats">
                    {l.avgRating !== null && l.avgRating !== undefined && (
                      <span className="home-rating">
                        <IconStar filled /> {l.avgRating.toFixed(1)}
                      </span>
                    )}
                    <span className="home-count">
                      {l.commentCount ?? 0}{' '}
                      {(l.commentCount ?? 0) === 1 ? 'komentar' : 'komentara'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
