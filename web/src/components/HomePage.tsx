import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/format';
import type { Ad, CityEvent, Location, NewsItem, RecentComment } from '../types';
import { CATEGORY_LABELS } from '../types';
import { PinGlyph } from './PinGlyph';
import { IconStar } from './Icons';
import { RoleBadge } from './RoleBadge';
import { AdRow } from './AdCard';

// Calendar block u "Predstojeći događaji" karticama — dvocifren dan/mesec.
function calendarBlock(iso: string): { day: string; month: string } {
  const d = new Date(iso);
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: String(d.getMonth() + 1).padStart(2, '0'),
  };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + '…';
}

export function HomePage() {
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [featuredCafe, setFeaturedCafe] = useState<Location | null>(null);
  const [landmarks, setLandmarks] = useState<Location[] | null>(null);
  const [upcoming, setUpcoming] = useState<CityEvent[] | null>(null);
  const [recentComments, setRecentComments] = useState<RecentComment[] | null>(null);
  const [ads, setAds] = useState<Ad[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.listNews({ limit: 2 }).catch(() => [] as NewsItem[]),
      api.listLocations({ sort: 'popular', cat: 'cafe', limit: 1 }).catch(() => [] as Location[]),
      api.listLocations({ cat: 'landmark', limit: 10 }).catch(() => [] as Location[]),
      api.listEvents({ limit: 4 }).catch(() => [] as CityEvent[]),
      api.recentComments({ limit: 2 }).catch(() => [] as RecentComment[]),
      api.listOglasi({ limit: 6 }).catch(() => [] as Ad[]),
    ]).then(([n, cafes, lms, evs, cmts, ad]) => {
      if (cancelled) return;
      setNews(n);
      setFeaturedCafe(cafes[0] ?? null);
      setLandmarks(lms);
      setUpcoming(evs);
      setRecentComments(cmts);
      setAds(ad);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // "Posetiti" — biramo nasumičnu znamenitost iz dovučenih landmark-ova.
  // useMemo na length-u: izbor je stabilan unutar iste sesije, refresh stranice
  // verovatno daje drugu preporuku — što je upravo svrha "discovery" sekcije.
  const spotlight = useMemo<Location | null>(() => {
    if (!landmarks || landmarks.length === 0) return null;
    const idx = Math.floor(Math.random() * landmarks.length);
    return landmarks[idx];
  }, [landmarks?.length]);

  return (
    <div className="home">
      <header className="home-hero">
        <div className="home-hero-inner">
          <div className="home-hero-eyebrow">Opština Žabari · 12374</div>
          <h1 className="home-hero-title">Grad na dlanu</h1>
          <p className="home-hero-lead">
            Sve što se dešava u Žabarima — kafići, događaji, smeštaj, javne službe i znamenitosti — na
            jednom mestu.
          </p>
          <div className="home-hero-ctas">
            <Link to="/mapa" className="btn-primary">
              Pregled mape
            </Link>
            <Link to="/objekti" className="btn-secondary">
              Pretraži objekte
            </Link>
          </div>
        </div>
      </header>

      <div className="home-body">
        <div className="home-split">
          {/* === Leva kolona (~70%): Kafić nedelje → „Šta posetiti" → Najnoviji oglasi === */}
          <div className="home-split-main">
            <div className="feature-card feature-card-primary">
              <div className="feature-card-tag">Kafić nedelje</div>
              {featuredCafe === null ? (
                <div className="feature-card-empty">Još nema kafića sa komentarima.</div>
              ) : (
                <>
                  <h3 className="feature-card-title">{featuredCafe.name}</h3>
                  {featuredCafe.subtitle && (
                    <div className="feature-card-subtitle">{featuredCafe.subtitle}</div>
                  )}
                  <div className="feature-card-meta">
                    {featuredCafe.village ? <span>{featuredCafe.village} · </span> : null}
                    {featuredCafe.address}
                  </div>
                  {featuredCafe.commentCount !== undefined && featuredCafe.commentCount > 0 && (
                    <div className="feature-card-stats">
                      <span className="feature-stat">
                        <IconStar filled={true} />{' '}
                        {featuredCafe.avgRating !== null && featuredCafe.avgRating !== undefined
                          ? featuredCafe.avgRating.toFixed(1)
                          : '—'}
                      </span>
                      <span className="feature-stat-sep">·</span>
                      <span className="feature-stat">
                        {featuredCafe.commentCount} komentar{featuredCafe.commentCount === 1 ? '' : 'a'}
                      </span>
                    </div>
                  )}
                  <Link to={`/objekat/${featuredCafe.slug}`} className="feature-card-cta">
                    Otvori objekat →
                  </Link>
                </>
              )}
            </div>

            <div className="feature-card feature-card-spotlight">
              <div className="feature-card-tag">Posetiti</div>
              {spotlight === null ? (
                <div className="feature-card-empty">Nema znamenitosti u bazi.</div>
              ) : (
                <>
                  <div className="spotlight-glyph">
                    <PinGlyph cat={spotlight.catId} size={42} />
                  </div>
                  <h3 className="feature-card-title">{spotlight.name}</h3>
                  {spotlight.subtitle && (
                    <div className="feature-card-subtitle">{spotlight.subtitle}</div>
                  )}
                  <div className="feature-card-meta">
                    {spotlight.village ? <span>{spotlight.village} · </span> : null}
                    {spotlight.address}
                  </div>
                  <Link to={`/objekat/${spotlight.slug}`} className="feature-card-cta">
                    Otvori →
                  </Link>
                </>
              )}
            </div>

            {/* Najnoviji oglasi (3. red u levoj koloni) */}
            <section className="home-section">
              <div className="home-section-head">
                <h2>Najnoviji oglasi</h2>
                <Link to="/oglasi" className="link-cta">Otvori sve →</Link>
              </div>
              {ads === null ? (
                <div className="home-card-grid">
                  <div className="home-skeleton-card" />
                  <div className="home-skeleton-card" />
                  <div className="home-skeleton-card" />
                </div>
              ) : ads.length === 0 ? (
                <div className="empty-state">Još nema objavljenih oglasa.</div>
              ) : (
                <div className="oglasi-compact">
                  {ads.map((a) => (
                    <AdRow key={a.id} ad={a} />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* === Desna kolona (~30%): događaji → dešavanja → utisci === */}
          <div className="home-split-rail">
            {/* Predstojeći događaji */}
            <section className="home-section">
              <div className="home-section-head">
                <h2>Predstojeći događaji</h2>
                <Link to="/desavanja" className="link-cta">Sva dešavanja →</Link>
              </div>
              {upcoming === null ? (
                <div className="home-card-grid">
                  <div className="home-skeleton-card" />
                  <div className="home-skeleton-card" />
                  <div className="home-skeleton-card" />
                  <div className="home-skeleton-card" />
                </div>
              ) : upcoming.length === 0 ? (
                <div className="empty-state">Trenutno nema najavljenih događaja.</div>
              ) : (
                <div className="home-card-grid">
                  {upcoming.map((e) => {
                    const dm = calendarBlock(e.startsAt);
                    return (
                      <Link key={e.id} to={`/objekat/${e.locationSlug}`} className="event-tile">
                        <div className="event-tile-date">
                          <div className="event-tile-day">{dm.day}</div>
                          <div className="event-tile-month">{dm.month}</div>
                        </div>
                        <div className="event-tile-body">
                          <h3 className="event-tile-title">{e.title}</h3>
                          <div className="event-tile-when">{formatDateTime(e.startsAt)}</div>
                          <div className="event-tile-loc">
                            {CATEGORY_LABELS[e.locationCatId]} · {e.locationName}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Najnovija dešavanja */}
            <section className="home-section">
              <div className="home-section-head">
                <h2>Najnovija dešavanja</h2>
                <Link to="/desavanja" className="link-cta">Otvori sve →</Link>
              </div>
              {news === null ? (
                <div className="home-card-grid">
                  <div className="home-skeleton-card" />
                  <div className="home-skeleton-card" />
                </div>
              ) : news.length === 0 ? (
                <div className="empty-state">
                  Još nema objavljenih dešavanja. Vlasnici objekata mogu da objave prvo obaveštenje.
                </div>
              ) : (
                <div className="home-card-grid">
                  {news.map((n) => (
                    <Link key={n.id} to="/desavanja" className="news-tile">
                      <div className="news-tile-date">
                        {formatDate(n.publishedAt ?? n.createdAt)}
                      </div>
                      <h3 className="news-tile-title">{n.title}</h3>
                      <p className="news-tile-body">{truncate(n.body, 110)}</p>
                      <div className="news-tile-loc">{n.locationName}</div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Najnoviji utisci */}
            <section className="home-section">
              <div className="home-section-head">
                <h2>Najnoviji utisci</h2>
              </div>
              {recentComments === null ? (
                <div className="home-card-grid">
                  <div className="home-skeleton-card" />
                  <div className="home-skeleton-card" />
                </div>
              ) : recentComments.length === 0 ? (
                <div className="empty-state">Posetioci još nisu ostavili komentare.</div>
              ) : (
                <div className="home-card-grid">
                  {recentComments.map((c) => (
                    <article key={c.id} className="comment-tile">
                      <div className="comment-tile-head">
                        <span className="comment-tile-author">{c.author.displayName}</span>
                        <RoleBadge role={c.author.role} />
                        {c.rating !== null && (
                          <div className="comment-tile-rating">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <IconStar key={n} filled={n <= c.rating!} />
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="comment-tile-body">{truncate(c.body, 160)}</p>
                      <Link to={`/objekat/${c.location.slug}`} className="comment-tile-loc">
                        {c.location.name}
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
