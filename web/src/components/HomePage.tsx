import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api, mediaUrl } from '../lib/api';
import { biserThumbGradient } from '../lib/biseri';
import { formatDate, formatDateTime } from '../lib/format';
import type { Ad, Biser, CityEvent, Location, NewsItem } from '../types';
import { SELA_ZABARI } from '../lib/villages';
import { PinGlyph } from './PinGlyph';
import { IconStar } from './Icons';
import { AdCard } from './AdCard';
import { ProblemiWidget } from './ProblemiWidget';

const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAJ', 'JUN', 'JUL', 'AVG', 'SEP', 'OKT', 'NOV', 'DEC'];

function calendarBlock(iso: string): { day: string; month: string } {
  const d = new Date(iso);
  return { day: String(d.getDate()), month: MONTHS_SHORT[d.getMonth()] };
}

// Srpska množina za "objekat": 1 objekat, 2–4 objekta, 5+ objekata.
function objekataLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} objekat`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} objekta`;
  return `${n} objekata`;
}

// Ikonice za "Zatražite uslugu" kartice (linijski stil iz mock-a).
function IconWrench() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
function IconBolt() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
function IconCar() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 16 L 3.5 16 A 1.5 1.5 0 0 1 2 14.5 L 2 12 C 2 11 2.7 10.4 3.6 10.2 L 5.5 9.8 L 8 6.6 C 8.4 6.2 8.9 6 9.5 6 L 15 6 C 15.6 6 16.1 6.2 16.4 6.7 L 18.6 9.8 L 20.5 10.2 C 21.4 10.4 22 11.1 22 12 L 22 14.5 A 1.5 1.5 0 0 1 20.5 16 L 19 16" />
      <circle cx="7" cy="16" r="2" />
      <circle cx="17" cy="16" r="2" />
      <line x1="9" y1="16" x2="15" y2="16" />
    </svg>
  );
}
function IconToolbox() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="9" width="18" height="11" rx="2" />
      <path d="M9 9V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3" />
      <path d="M3 14h18" />
      <path d="M10 12v4M14 12v4" />
    </svg>
  );
}
function IconAppliance() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <circle cx="12" cy="14" r="4" />
      <line x1="9" y1="6" x2="11" y2="6" />
    </svg>
  );
}

// Kartice "Zatražite uslugu" — vode na /usluge sa preselektovanom kategorijom.
// `id` mora biti jedan od SERVICE_CATEGORIES (web/src/lib/usluge.ts).
const USLUGE = [
  { id: 'vodoinstalater', label: 'Vodoinstalater', sub: 'Popravka česmi, bojlera, curenja', icon: <IconWrench /> },
  { id: 'elektricar', label: 'Električar', sub: 'Instalacije i hitne popravke', icon: <IconBolt /> },
  { id: 'automehanicar', label: 'Automehaničar', sub: 'Servis i popravka vozila', icon: <IconCar /> },
  { id: 'bela-tehnika', label: 'Servis bele tehnike', sub: 'Veš mašine, bojleri, šporeti', icon: <IconAppliance /> },
  { id: 'majstor-za-sve', label: 'Majstor za sve', sub: 'Sitne popravke u domaćinstvu', icon: <IconToolbox /> },
];

// Statična hero pozadina — placeholder dok ne stigne prava fotografija.
// Kada fotografija bude spremna, zameniti sa `url(/uploads/...)` ili fajlom iz web/public.
const HERO_BG = 'url(https://picsum.photos/1600/600)';

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + '…';
}

// Slajd je ili izdvojeni objekat (kafić / znamenitost) ili "Biser dana" —
// dnevna preporuka iz mape sećanja (/biseri).
type SpotlightSlide =
  | { kind: 'loc'; tag: string; loc: Location }
  | { kind: 'biser'; tag: string; biser: Biser };

export function HomePage() {
  const navigate = useNavigate();
  const { categories, locations, setActiveFilter, currentUser, notifications } =
    useOutletContext<AppContext>();

  // Linkovi u traci dobrodošlice — svaki se pojavljuje SAMO ako postoji nešto
  // novo za korisnika (brojači iz /api/me/notifications, isti kao nav badge).
  const welcomeLinks = [
    { count: notifications.unreadMessages, to: '/dashboard?tab=poruke', label: 'Nove poruke' },
    {
      count: notifications.reservationUpdates,
      to: '/dashboard?tab=rezervacije',
      label: 'Odgovori na rezervacije',
    },
    {
      count: notifications.uslugeUpdates,
      to: '/dashboard?tab=usluge',
      label: 'Novi odgovori na usluge',
    },
    {
      count: notifications.followedUpdates,
      to: '/dashboard?tab=pratim',
      label: 'Novosti na praćenim objektima',
    },
    {
      count: notifications.ownerComments,
      to: '/poslovni?tab=comments',
      label: 'Novi komentari na vašim objektima',
    },
    { count: notifications.majstorJobs, to: '/majstor', label: 'Novi zahtevi za usluge' },
  ].filter((l) => l.count > 0);

  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [featuredCafe, setFeaturedCafe] = useState<Location | null>(null);
  const [landmarks, setLandmarks] = useState<Location[] | null>(null);
  const [upcoming, setUpcoming] = useState<CityEvent[] | null>(null);
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [biseri, setBiseri] = useState<Biser[] | null>(null);
  const [heroQuery, setHeroQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.listNews({ limit: 3 }).catch(() => [] as NewsItem[]),
      api.listLocations({ sort: 'popular', cat: 'cafe', limit: 1 }).catch(() => [] as Location[]),
      api.listLocations({ cat: 'landmark', limit: 10 }).catch(() => [] as Location[]),
      api.listEvents({ limit: 3 }).catch(() => [] as CityEvent[]),
      api.listOglasi({ limit: 4 }).catch(() => [] as Ad[]),
      api.listBiseri().catch(() => [] as Biser[]),
    ]).then(([n, cafes, lms, evs, ad, bis]) => {
      if (cancelled) return;
      setNews(n);
      setFeaturedCafe(cafes[0] ?? null);
      setLandmarks(lms);
      setUpcoming(evs);
      setAds(ad);
      setBiseri(bis);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // "Posetiti" slajd — nasumična znamenitost; stabilna unutar sesije,
  // refresh stranice verovatno daje drugu preporuku (discovery).
  const spotlightLandmark = useMemo<Location | null>(() => {
    if (!landmarks || landmarks.length === 0) return null;
    return landmarks[Math.floor(Math.random() * landmarks.length)];
  }, [landmarks?.length]);

  // "Biser dana" — deterministički po danu (indeks iz broja dana od epohe), pa
  // svi posetioci istog dana vide istu priču, a sutradan se menja sama.
  const biserOfDay = useMemo<Biser | null>(() => {
    if (!biseri || biseri.length === 0) return null;
    const dayIndex = Math.floor(Date.now() / 86_400_000);
    return biseri[dayIndex % biseri.length];
  }, [biseri]);

  const slides = useMemo<SpotlightSlide[]>(() => {
    const out: SpotlightSlide[] = [];
    if (featuredCafe) out.push({ kind: 'loc', tag: 'Kafić nedelje', loc: featuredCafe });
    if (spotlightLandmark) out.push({ kind: 'loc', tag: 'Šta posetiti', loc: spotlightLandmark });
    if (biserOfDay) out.push({ kind: 'biser', tag: 'Biser dana', biser: biserOfDay });
    return out;
  }, [featuredCafe, spotlightLandmark, biserOfDay]);

  // Carousel: scroll-snap + tačkice; aktivni slajd pratimo preko scroll pozicije.
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  // Desni panel uz spotlight: dva taba — predstojeći događaji i novosti o objektima.
  const [feedTab, setFeedTab] = useState<'events' | 'news'>('events');
  function onTrackScroll() {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    setActiveSlide(Math.round(el.scrollLeft / el.clientWidth));
  }
  function scrollToSlide(i: number) {
    const el = trackRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(i, slides.length - 1));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
  }

  // Kategorije: horizontalni carousel (5 vidljivih). Strelice skroluju za ~80%
  // širine trake — dovoljno da otkriju sledeći set, uz mali preklop.
  const catsRef = useRef<HTMLDivElement>(null);
  function scrollCats(dir: -1 | 1) {
    const el = catsRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  }

  const published = useMemo(() => locations.filter((l) => l.status === 'published'), [locations]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of published) counts.set(l.catId, (counts.get(l.catId) ?? 0) + 1);
    return counts;
  }, [published]);

  const villageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of published) {
      if (l.village) counts.set(l.village, (counts.get(l.village) ?? 0) + 1);
    }
    return counts;
  }, [published]);

  function onHeroSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = heroQuery.trim();
    navigate(q ? `/objekti?q=${encodeURIComponent(q)}` : '/objekti');
  }

  return (
    <div className="hp">
      {/* ===== Personalizovana traka za ulogovane ===== */}
      {currentUser && (
        <div className="hp-welcome">
          <div className="hp-welcome-inner">
            <div className="hp-welcome-text">
              <strong>Dobrodošli nazad, {currentUser.displayName}.</strong>
            </div>
            {welcomeLinks.length > 0 && (
              <div className="hp-welcome-links">
                {welcomeLinks.map((l) => (
                  <Link key={l.to} to={l.to}>
                    {l.label} ({l.count})
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Hero ===== */}
      <header className="hp-hero">
        <div className="hp-hero-bg" style={{ backgroundImage: HERO_BG }} aria-hidden="true" />
        <div className="hp-hero-scrim" aria-hidden="true" />
        <div className="hp-hero-inner">
          <div className="hp-eyebrow">Opština Žabari · 12374</div>
          <h1 className="hp-hero-title">Grad na dlanu</h1>
          <p className="hp-hero-lead">
            Sve što se dešava u Žabarima — kafići, događaji, smeštaj, javne službe, oglasi i
            znamenitosti — na jednom mestu.
          </p>
          <form className="hp-hero-search" onSubmit={onHeroSearch}>
            <IconSearchMuted />
            <input
              type="text"
              placeholder="Pretraži objekte, događaje, usluge…"
              value={heroQuery}
              onChange={(e) => setHeroQuery(e.target.value)}
              aria-label="Pretraga objekata"
            />
            <button type="submit">Pretraži</button>
          </form>
        </div>
      </header>

      {/* ===== Kategorije ===== */}
      <section className="hp-section">
        <div className="hp-head">
          <h2>Istraži po kategoriji</h2>
          <Link to="/objekti" className="hp-link" onClick={() => setActiveFilter('all')}>
            Svi objekti →
          </Link>
        </div>
        <div className="hp-carousel">
          <button
            type="button"
            className="hp-arrow hp-arrow-left"
            aria-label="Prethodne kategorije"
            onClick={() => scrollCats(-1)}
          >
            <IconChevron dir="left" />
          </button>
          <div className="hp-cats" ref={catsRef}>
            {categories.map((c) => (
              <Link
                key={c.id}
                to="/objekti"
                className="hp-cat-card"
                onClick={() => setActiveFilter(c.id)}
              >
                <span className="hp-cat-icon">
                  <PinGlyph cat={c.id} size={30} />
                </span>
                <span className="hp-cat-label">{c.label}</span>
                <span className="hp-cat-count">{objekataLabel(categoryCounts.get(c.id) ?? 0)}</span>
              </Link>
            ))}
          </div>
          <button
            type="button"
            className="hp-arrow hp-arrow-right"
            aria-label="Sledeće kategorije"
            onClick={() => scrollCats(1)}
          >
            <IconChevron dir="right" />
          </button>
        </div>
      </section>

      {/* ===== Spotlight carousel + predstojeći događaji ===== */}
      <section className="hp-section hp-duo">
        <div className="hp-spotlight">
          {slides.length === 0 ? (
            <div className="hp-spot-card hp-spot-empty">
              Još nema izdvojenih objekata — dodajte prvi kafić ili znamenitost.
            </div>
          ) : (
            <>
              <div className="hp-spot-viewport">
                {slides.length > 1 && (
                  <button
                    type="button"
                    className="hp-arrow hp-arrow-over hp-arrow-left"
                    aria-label="Prethodni"
                    onClick={() => scrollToSlide(activeSlide - 1)}
                  >
                    <IconChevron dir="left" />
                  </button>
                )}
                <div className="hp-spot-track" ref={trackRef} onScroll={onTrackScroll}>
                {slides.map((s) => (
                  s.kind === 'biser' ? (
                    <div key={s.tag} className="hp-spot-card hp-spot-biser-card">
                      <div className="hp-spot-biser-main">
                        <div className="hp-spot-tag">{s.tag}</div>
                        <h3 className="hp-spot-title">{s.biser.title}</h3>
                        <p className="hp-spot-sub">
                          {truncate(s.biser.story.replace(/\n+/g, ' '), 140)}
                        </p>
                        <div className="hp-spot-meta">
                          <IconPin />
                          {s.biser.village} · {s.biser.year}. godina
                          {s.biser.contributorName ? ` · ${s.biser.contributorName}` : ''}
                        </div>
                        <Link to={`/biseri?biser=${s.biser.id}`} className="hp-spot-cta">
                          Pročitaj priču →
                        </Link>
                      </div>
                      <Link
                        to={`/biseri?biser=${s.biser.id}`}
                        className="hp-spot-biser-thumb"
                        aria-label={`Otvori priču: ${s.biser.title}`}
                        style={
                          s.biser.photoMediaId
                            ? { backgroundImage: `url('${mediaUrl(s.biser.photoMediaId)}')` }
                            : { background: biserThumbGradient(s.biser) }
                        }
                      >
                        <span className="hp-spot-biser-year">{s.biser.year}.</span>
                      </Link>
                    </div>
                  ) : (
                  <div key={s.tag} className="hp-spot-card">
                    <div>
                      <div className="hp-spot-tag">{s.tag}</div>
                      <h3 className="hp-spot-title">{s.loc.name}</h3>
                      {s.loc.subtitle && <p className="hp-spot-sub">{s.loc.subtitle}</p>}
                      <div className="hp-spot-meta">
                        <IconPin />
                        {s.loc.village ? `${s.loc.village} · ` : ''}
                        {s.loc.address}
                      </div>
                      {s.loc.commentCount !== undefined && s.loc.commentCount > 0 && (
                        <div className="hp-spot-stats">
                          <IconStar filled={true} />{' '}
                          {s.loc.avgRating !== null && s.loc.avgRating !== undefined
                            ? s.loc.avgRating.toFixed(1)
                            : '—'}
                          <span className="hp-spot-sep">·</span>
                          {s.loc.commentCount} komentar{s.loc.commentCount === 1 ? '' : 'a'}
                        </div>
                      )}
                    </div>
                    {s.loc.catId === 'cafe' ? (
                      <div className="hp-spot-actions">
                        <Link
                          to={`/objekat/${s.loc.slug}?tab=rezervacije`}
                          className="hp-spot-btn hp-spot-btn-primary"
                        >
                          <IconCalendar />
                          Rezerviši sto
                        </Link>
                        <Link
                          to={`/objekat/${s.loc.slug}?tab=meni`}
                          className="hp-spot-btn hp-spot-btn-ghost"
                        >
                          <IconMenuBook />
                          Pogledaj meni
                        </Link>
                        <Link
                          to={`/mapa?focus=${s.loc.slug}`}
                          className="hp-spot-btn hp-spot-btn-ghost"
                        >
                          <IconMapFold />
                          Prikaži na mapi
                        </Link>
                      </div>
                    ) : (
                      <Link to={`/objekat/${s.loc.slug}`} className="hp-spot-cta">
                        Otvori objekat →
                      </Link>
                    )}
                  </div>
                  )
                ))}
                </div>
                {slides.length > 1 && (
                  <button
                    type="button"
                    className="hp-arrow hp-arrow-over hp-arrow-right"
                    aria-label="Sledeći"
                    onClick={() => scrollToSlide(activeSlide + 1)}
                  >
                    <IconChevron dir="right" />
                  </button>
                )}
              </div>
              {slides.length > 1 && (
                <div className="hp-spot-dots">
                  {slides.map((s, i) => (
                    <button
                      key={s.tag}
                      type="button"
                      className={`hp-spot-dot ${i === activeSlide ? 'active' : ''}`}
                      aria-label={`Slajd ${i + 1}: ${s.tag}`}
                      onClick={() => scrollToSlide(i)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="hp-events">
          <div className="hp-events-head">
            <div className="hp-feed-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={feedTab === 'events'}
                className={`hp-feed-tab ${feedTab === 'events' ? 'is-active' : ''}`}
                onClick={() => setFeedTab('events')}
              >
                Događaji
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={feedTab === 'news'}
                className={`hp-feed-tab ${feedTab === 'news' ? 'is-active' : ''}`}
                onClick={() => setFeedTab('news')}
              >
                Novosti
              </button>
            </div>
            <Link to="/desavanja" className="hp-link">
              Sva dešavanja →
            </Link>
          </div>

          {feedTab === 'events' ? (
            <div className="hp-events-list">
              {upcoming === null ? (
                <>
                  <div className="home-skeleton-card" />
                  <div className="home-skeleton-card" />
                  <div className="home-skeleton-card" />
                </>
              ) : upcoming.length === 0 ? (
                <div className="hp-empty">Trenutno nema najavljenih događaja.</div>
              ) : (
                upcoming.map((e) => {
                  const dm = calendarBlock(e.startsAt);
                  return (
                    <Link key={e.id} to={`/dogadjaj/${e.id}`} className="hp-event-row">
                      <span className="hp-event-date">
                        <span className="hp-event-day">{dm.day}</span>
                        <span className="hp-event-month">{dm.month}</span>
                      </span>
                      <span className="hp-event-body">
                        <span className="hp-event-title">{e.title}</span>
                        <span className="hp-event-place">
                          {formatDateTime(e.startsAt)} · {e.locationName}
                        </span>
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          ) : (
            <div className="hp-news-list hp-news-list-compact">
              {news === null ? (
                <>
                  <div className="home-skeleton-card" />
                  <div className="home-skeleton-card" />
                </>
              ) : news.length === 0 ? (
                <div className="hp-empty">Još nema objavljenih novosti.</div>
              ) : (
                news.map((n) => (
                  <Link key={n.id} to={`/obavestenje/${n.slug}`} className="hp-news-row">
                    <span className="hp-news-pill">{n.locationName}</span>
                    <span className="hp-news-main">
                      <span className="hp-news-title">{truncate(n.title, 90)}</span>
                      <span className="hp-news-date">
                        {formatDate(n.publishedAt ?? n.createdAt)}
                        {n.village ? ` · ${n.village}` : ''}
                      </span>
                    </span>
                    <span className="hp-news-arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      {/* ===== Oglasi ===== */}
      <section className="hp-section">
        <div className="hp-head">
          <div>
            <h2>Oglasi</h2>
            <div className="hp-head-sub">Domaći proizvodi, polovna oprema i lokalni oglasi</div>
          </div>
          <Link to="/oglasi" className="hp-link">
            Otvori oglasnu tablu →
          </Link>
        </div>
        {ads === null ? (
          <div className="oglasi-grid">
            <div className="home-skeleton-card" />
            <div className="home-skeleton-card" />
            <div className="home-skeleton-card" />
            <div className="home-skeleton-card" />
          </div>
        ) : ads.length === 0 ? (
          <div className="hp-empty">Još nema objavljenih oglasa.</div>
        ) : (
          <div className="oglasi-grid">
            {ads.map((a) => (
              <AdCard key={a.id} ad={a} />
            ))}
          </div>
        )}
      </section>

      {/* ===== Zatražite uslugu ===== */}
      <section className="hp-usluge">
        <div className="hp-usluge-inner">
          <div className="hp-head">
            <div>
              <h2>Zatražite uslugu</h2>
              <div className="hp-head-sub">
                Treba vam majstor? Pošaljite zahtev i lokalni izvođači će vam se javiti.
              </div>
            </div>
            <Link to="/usluge" className="hp-link">
              Sve usluge →
            </Link>
          </div>
          <div className="hp-usluge-track">
            {USLUGE.map((u) => (
              <div key={u.id} className="hp-usluga-card">
                <span className="hp-usluga-icon">{u.icon}</span>
                <div>
                  <div className="hp-usluga-label">{u.label}</div>
                  <div className="hp-usluga-sub">{u.sub}</div>
                </div>
                <Link to={`/usluge?cat=${u.id}`} className="hp-usluga-btn">
                  Zatraži uslugu
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Prijave problema ===== */}
      <section className="hp-section">
        <div className="hp-head">
          <div>
            <h2>Problemi u opštini</h2>
            <div className="hp-head-sub">
              Rupa na putu, palo drvo, divlja deponija? Prijavite — opština i kustosi prate prijave.
            </div>
          </div>
          <Link to="/problemi" className="hp-link">
            Sve prijave →
          </Link>
        </div>
        <div className="prb-widget-duo">
          <ProblemiWidget sort="recent" kicker="Grad na dlanu" title="Najnovije prijave građana" />
          <ProblemiWidget
            sort="votes"
            kicker="Po glasovima građana"
            title="Najpopularnije prijave"
            showCta={false}
          />
        </div>
      </section>

      {/* ===== Naselja ===== */}
      <section className="hp-section hp-section-last">
        <div className="hp-head">
          <div>
            <h2>Naselja u opštini</h2>
            <div className="hp-head-sub">Pregledajte objekte i dešavanja po mestu</div>
          </div>
          <Link to="/naselja" className="hp-link">
            Mapa naselja →
          </Link>
        </div>
        <div className="hp-villages">
          {SELA_ZABARI.map((v) => (
            <Link key={v} to={`/objekti?village=${encodeURIComponent(v)}`} className="hp-village-chip">
              <span className="hp-village-name">{v}</span>
              <span className="hp-village-count">{objekataLabel(villageCounts.get(v) ?? 0)}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function IconSearchMuted() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.2" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconChevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir === 'left' ? <polyline points="15 6 9 12 15 18" /> : <polyline points="9 6 15 12 9 18" />}
    </svg>
  );
}

function IconPin() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function IconMenuBook() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconMapFold() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" />
      <path d="M8 2v16M16 6v16" />
    </svg>
  );
}
