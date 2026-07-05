import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import { clearToken } from '../lib/auth';
import { formatDate, formatDateTime, formatDateTimeRange, formatTime } from '../lib/format';
import { PinGlyph } from '../components/PinGlyph';
import { IconStar } from '../components/Icons';
import { RoleBadge } from '../components/RoleBadge';
import { PorukeInbox } from '../components/PorukeInbox';
import { NewsletterSettings } from '../components/NewsletterSettings';
import { AuthImage } from '../components/AuthImage';
import { StartChat } from '../components/StartChat';
import { SERVICE_CATEGORY_LABELS, isServiceCategory } from '../lib/usluge';
import type {
  CityEvent,
  ConversationSummary,
  FavoriteRow,
  MyComment,
  MyReservation,
  MyServiceJob,
  MyServiceRequest,
  NewsItem,
} from '../types';

const RES_STATUS_LABELS: Record<MyReservation['status'], string> = {
  pending: 'na čekanju',
  approved: 'odobreno',
  declined: 'odbijeno',
  cancelled: 'otkazano',
};

function describeReservation(r: MyReservation): string {
  const p = r.payload as unknown as Record<string, string | number>;
  if (r.locationCatId === 'cafe') {
    return `Sto #${p.tableId} · ${formatDateTime(String(p.slotStart))} – ${formatTime(String(p.slotEnd))} · ${p.guests} gostiju`;
  }
  if (r.locationCatId === 'hotel') {
    return `Soba ${p.roomKey} · ${p.dateFrom} → ${p.dateTo} · ${p.guests} gostiju`;
  }
  return JSON.stringify(p);
}

type FollowedCard =
  | { kind: 'news'; id: number; date: string; data: NewsItem }
  | { kind: 'event'; id: number; date: string; data: CityEvent };

type Tab = 'pratim' | 'komentari' | 'rezervacije' | 'usluge' | 'poruke' | 'bilten';

const BASE_TABS: { key: Tab; label: string }[] = [
  { key: 'pratim', label: 'Pratim' },
  { key: 'komentari', label: 'Komentari' },
  { key: 'rezervacije', label: 'Rezervacije' },
  { key: 'usluge', label: 'Usluge' },
  { key: 'poruke', label: 'Poruke' },
];

const JOB_STATUS_LABELS: Record<MyServiceJob['status'], string> = {
  open: 'otvoren',
  accepted: 'majstor izabran',
  cancelled: 'otkazan',
};

export function DashboardPage() {
  const ctx = useOutletContext<AppContext>();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('pratim');
  const [favorites, setFavorites] = useState<FavoriteRow[] | null>(null);
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [events, setEvents] = useState<CityEvent[] | null>(null);
  const [comments, setComments] = useState<MyComment[] | null>(null);
  const [reservations, setReservations] = useState<MyReservation[] | null>(null);
  const [serviceRequests, setServiceRequests] = useState<MyServiceRequest[] | null>(null);
  const [serviceJobs, setServiceJobs] = useState<MyServiceJob[] | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [upgradeEmail, setUpgradeEmail] = useState('');
  const [upgradePassword, setUpgradePassword] = useState('');
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgradeSentTo, setUpgradeSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx.currentUser) return;
    api.myFavorites().then(setFavorites).catch((e: Error) => setError(e.message));
    api.myComments().then(setComments).catch((e: Error) => setError(e.message));
    api.myReservations().then(setReservations).catch((e: Error) => setError(e.message));
    api.myServiceRequests().then(setServiceRequests).catch((e: Error) => setError(e.message));
    api.myServiceJobs().then(setServiceJobs).catch((e: Error) => setError(e.message));
    api.myConversations().then(setConversations).catch((e: Error) => setError(e.message));
    api.listNews({ limit: 100 }).then(setNews).catch((e: Error) => setError(e.message));
    api
      .listEvents({ limit: 100, includePast: true })
      .then(setEvents)
      .catch((e: Error) => setError(e.message));
  }, [ctx.currentUser]);

  const followedCards = useMemo<FollowedCard[] | null>(() => {
    if (favorites === null || news === null || events === null) return null;
    const ids = new Set(favorites.map((f) => f.id));
    if (ids.size === 0) return [];
    const list: FollowedCard[] = [];
    for (const n of news) {
      if (!ids.has(n.locationId)) continue;
      list.push({ kind: 'news', id: n.id, date: n.publishedAt ?? n.createdAt, data: n });
    }
    for (const e of events) {
      if (!ids.has(e.locationId)) continue;
      list.push({ kind: 'event', id: e.id, date: e.startsAt, data: e });
    }
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }, [favorites, news, events]);

  // Clear the matching notification anchor when the user opens a section, then
  // refresh the nav badge. (Default tab is 'pratim', so the feed clears on open.)
  const reloadNotifications = ctx.reloadNotifications;
  useEffect(() => {
    if (!ctx.currentUser) return;
    if (tab === 'rezervacije') {
      api.markSeen('reservations').then(() => reloadNotifications()).catch(() => {});
    } else if (tab === 'pratim') {
      api.markSeen('feed').then(() => reloadNotifications()).catch(() => {});
    } else if (tab === 'usluge') {
      api.markSeen('usluge').then(() => reloadNotifications()).catch(() => {});
    }
  }, [tab, ctx.currentUser, reloadNotifications]);

  // Reading/sending messages mutates `conversations`; recompute the unread badge.
  useEffect(() => {
    if (conversations !== null) void reloadNotifications();
  }, [conversations, reloadNotifications]);

  const submitUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpgradeError(null);
    setUpgradeBusy(true);
    try {
      const res = await api.upgradeGuest(upgradeEmail, upgradePassword);
      setUpgradeSentTo(res.email);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('409')) setUpgradeError('Ova e-pošta je već registrovana.');
      else if (message.includes('400'))
        setUpgradeError('Proverite unos: validna e-pošta i lozinka (min. 6 karaktera).');
      else setUpgradeError(message);
    } finally {
      setUpgradeBusy(false);
    }
  };

  const logout = async () => {
    clearToken();
    await ctx.reloadCurrentUser();
    navigate('/');
  };

  const unfollow = async (slug: string) => {
    await api.unfavorite(slug);
    setFavorites((rows) => rows?.filter((r) => r.slug !== slug) ?? null);
  };

  const cancelReservation = async (id: number) => {
    if (!window.confirm('Otkazati ovu rezervaciju?')) return;
    await api.cancelReservation(id);
    setReservations(await api.myReservations());
  };

  const acceptOffer = async (jobId: number, offerId: number) => {
    if (!window.confirm('Prihvatiti ovu ponudu? Ostale ponude za ovaj zahtev biće arhivirane.')) return;
    try {
      await api.acceptJobOffer(jobId, offerId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setServiceJobs(await api.myServiceJobs());
  };

  const cancelJob = async (jobId: number) => {
    if (!window.confirm('Otkazati ovaj zahtev za uslugu?')) return;
    try {
      await api.cancelServiceJob(jobId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setServiceJobs(await api.myServiceJobs());
  };

  // Stable refs: PorukeInbox passes these into a useEffect dependency array, so a
  // fresh reference each render would re-fire the effect (markRead → reload →
  // re-render → loop) and flood the server with read requests.
  const reloadServiceRequests = useCallback(async () => {
    setServiceRequests(await api.myServiceRequests());
  }, []);

  const reloadConversations = useCallback(async () => {
    setConversations(await api.myConversations());
  }, []);

  // ── Logged-out splash ──────────────────────────────────────────────────────
  if (!ctx.currentUser) {
    return (
      <div className="ms-page">
        <div className="ms-paper">
          <div className="ms-splash">
            <div className="ms-eyebrow ms-eyebrow-flanked"><span>Lični bilten</span></div>
            <h1 className="ms-masthead-title">Moj prostor</h1>
            <p className="ms-splash-body">
              Pratite objekte, dobijate dešavanja iz vaših sela, vodite svoje rezervacije
              i poruke. Otvorite nalog ili se prijavite.
            </p>
            <div className="ms-splash-actions">
              <Link to="/prijava" className="ms-btn ms-btn-primary">Prijava</Link>
              <Link to="/registracija" className="ms-btn">Otvori nalog</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const user = ctx.currentUser;
  const today = formatDate(new Date().toISOString());
  // Newsletter needs a verified email — guests have none, so hide the tab.
  const tabs: { key: Tab; label: string }[] =
    user.role === 'guest' ? BASE_TABS : [...BASE_TABS, { key: 'bilten', label: 'Bilten' }];

  return (
    <div className="ms-page">
      <div className="ms-paper">
        {/* ── MASTHEAD ─────────────────────────────────────────────────── */}
        <header className="ms-masthead">
          <div className="ms-masthead-main">
            <div className="ms-eyebrow ms-eyebrow-flanked">
              <span>Lični bilten · {today}</span>
            </div>
            <h1 className="ms-masthead-title">Moj prostor</h1>
            <div className="ms-masthead-id">
              <span className="ms-masthead-name">{user.displayName}</span>
              <RoleBadge role={user.role} />
              <span className="ms-dot" aria-hidden />
              <span className="ms-masthead-email">
                {user.role === 'guest' ? 'Privremeni nalog' : user.email}
              </span>
            </div>
          </div>
          <div className="ms-masthead-actions">
            <button className="ms-btn ms-btn-ghost" onClick={logout}>Odjavi se</button>
          </div>
        </header>

        {/* ── GUEST UPGRADE ────────────────────────────────────────────── */}
        {user.role === 'guest' &&
          (upgradeSentTo ? (
            <aside className="ms-notice">
              <div className="ms-notice-label">— Bilten gosta —</div>
              <h2 className="ms-notice-title">Potvrdite e-poštu</h2>
              <p className="ms-notice-body">
                Poslali smo link na <strong>{upgradeSentTo}</strong>. Otvorite poruku i kliknite
                na link da nadogradite nalog u trajan. Link važi 24 sata.
              </p>
            </aside>
          ) : (
            <form className="ms-notice" onSubmit={submitUpgrade}>
              <div className="ms-notice-label">— Bilten gosta —</div>
              <h2 className="ms-notice-title">Nadogradite na trajan nalog</h2>
              <p className="ms-notice-body">
                Dodajte e-poštu i lozinku da zadržite praćene objekte, komentare i istoriju,
                i otključate rezervacije nakon potvrde.
              </p>
              <div className="ms-upgrade-grid">
                <label className="ms-field">
                  <span className="ms-field-label">E-pošta</span>
                  <input
                    className="ms-field-input"
                    type="email"
                    value={upgradeEmail}
                    onChange={(e) => setUpgradeEmail(e.target.value)}
                  />
                </label>
                <label className="ms-field">
                  <span className="ms-field-label">Lozinka</span>
                  <input
                    className="ms-field-input"
                    type="password"
                    value={upgradePassword}
                    onChange={(e) => setUpgradePassword(e.target.value)}
                    placeholder="min. 6 karaktera"
                  />
                </label>
                <button
                  type="submit"
                  className="ms-btn ms-btn-primary"
                  disabled={upgradeBusy || !upgradeEmail || !upgradePassword}
                >
                  {upgradeBusy ? 'Slanje…' : 'Nadogradi'}
                </button>
              </div>
              {upgradeError && <div className="ms-error">{upgradeError}</div>}
            </form>
          ))}

        {error && <div className="ms-error">{error}</div>}

        {/* ── TABS (newspaper section index) ───────────────────────────── */}
        <nav className="ms-tabs" role="tablist" aria-label="Odeljci">
          {tabs.map((t) => {
            const count =
              t.key === 'pratim' ? favorites?.length
              : t.key === 'komentari' ? comments?.length
              : t.key === 'rezervacije' ? reservations?.length
              : t.key === 'usluge' ? serviceJobs?.length
              : t.key === 'bilten' ? undefined
              : conversations === null && serviceRequests === null
                ? undefined
                : (conversations?.length ?? 0) + (serviceRequests?.length ?? 0);
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={`ms-tab ${tab === t.key ? 'is-active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                <span className="ms-tab-label">{t.label}</span>
                {count !== undefined && count !== null && (
                  <span className="ms-tab-count">{count}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ── I. PRATIM ────────────────────────────────────────────────── */}
        {tab === 'pratim' && (
        <section className="ms-section">
          <div className="ms-section-body">
            <div className="ms-section-head">
              <span className="ms-eyebrow">— odeljak —</span>
              <h2 className="ms-section-title">Pratim</h2>
              <span className="ms-section-meta">
                {favorites ? `${favorites.length} objekata` : '—'}
              </span>
            </div>

            {favorites === null ? (
              <div className="ms-empty">Učitavanje pretplata…</div>
            ) : favorites.length === 0 ? (
              <div className="ms-empty">
                Još ne pratite nijedan objekat. Otvorite stranicu objekta i kliknite{' '}
                <strong>„Zaprati"</strong> da biste ga dodali u svoj bilten.
              </div>
            ) : (
              <div className="ms-pratim-grid">
                <aside className="ms-register">
                  <div className="ms-register-label">— Registar —</div>
                  <ul className="ms-register-list">
                    {favorites.map((f) => (
                      <li className="ms-register-row" key={f.id}>
                        <Link to={`/objekat/${f.slug}`} className="ms-register-link">
                          <span className="ms-register-glyph">
                            <PinGlyph cat={f.catId} size={18} />
                          </span>
                          <span className="ms-register-text">
                            <span className="ms-register-name">{f.name}</span>
                            {f.address && (
                              <span className="ms-register-addr">{f.address}</span>
                            )}
                          </span>
                        </Link>
                        <button
                          className="ms-unfollow"
                          onClick={() => unfollow(f.slug)}
                          title="Otprati"
                        >
                          Otprati
                        </button>
                      </li>
                    ))}
                  </ul>
                </aside>

                <div className="ms-feed-col">
                  {followedCards === null ? (
                    <div className="ms-empty">Učitavanje dešavanja…</div>
                  ) : followedCards.length === 0 ? (
                    <div className="ms-empty">
                      Nema novih dešavanja iz objekata koje pratite. Naslovne strane se
                      osvežavaju — navratite ponovo.
                    </div>
                  ) : (
                    <div className="ms-feed">
                      {followedCards.map((c) =>
                        c.kind === 'news' ? (
                          <Link
                            key={`news-${c.id}`}
                            to={`/obavestenje/${c.data.slug}`}
                            className="ms-feed-card"
                          >
                            <div className="ms-feed-card-head">
                              <span className="ms-kind-stamp kind-news">Obaveštenje</span>
                              <span className="ms-feed-card-date">
                                {formatDate(c.data.publishedAt ?? c.data.createdAt)}
                              </span>
                            </div>
                            <h3 className="ms-feed-card-title">{c.data.title}</h3>
                            <div className="ms-feed-card-loc">
                              iz <strong>{c.data.locationName}</strong>
                              {c.data.village ? ` · ${c.data.village}` : ''}
                            </div>
                          </Link>
                        ) : (
                          <Link
                            key={`event-${c.id}`}
                            to={`/dogadjaj/${c.data.id}`}
                            className="ms-feed-card"
                          >
                            <div className="ms-feed-card-head">
                              <span className="ms-kind-stamp kind-event">Događaj</span>
                              <span className="ms-feed-card-date">
                                {formatDate(c.data.startsAt)}
                              </span>
                            </div>
                            <h3 className="ms-feed-card-title">{c.data.title}</h3>
                            <div className="ms-feed-card-when">
                              {formatDateTimeRange(c.data.startsAt, c.data.endsAt)}
                            </div>
                            <div className="ms-feed-card-loc">
                              iz <strong>{c.data.locationName}</strong>
                              {c.data.village ? ` · ${c.data.village}` : ''}
                            </div>
                          </Link>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
        )}

        {/* ── II. KOMENTARI ────────────────────────────────────────────── */}
        {tab === 'komentari' && (
        <section className="ms-section">
          <div className="ms-section-body">
            <div className="ms-section-head">
              <span className="ms-eyebrow">— odeljak —</span>
              <h2 className="ms-section-title">Moji komentari</h2>
              <span className="ms-section-meta">
                {comments ? `${comments.length} ukupno` : '—'}
              </span>
            </div>

            {comments === null ? (
              <div className="ms-empty">Učitavanje…</div>
            ) : comments.length === 0 ? (
              <div className="ms-empty">Niste još ostavili nijedan komentar.</div>
            ) : (
              <div className="ms-comments">
                {comments.map((c) => (
                  <article className="ms-comment" key={c.id}>
                    <span className="ms-comment-mark" aria-hidden>„</span>
                    <div className="ms-comment-body">
                      <p className="ms-comment-text">{c.body}</p>
                      <div className="ms-comment-meta">
                        uz objekat{' '}
                        <Link to={`/objekat/${c.locationSlug}`} className="ms-comment-loc">
                          {c.locationName}
                        </Link>
                        {c.rating !== null && (
                          <>
                            <span className="ms-comment-sep">·</span>
                            <span className="ms-comment-rating">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <IconStar key={n} filled={n <= c.rating!} />
                              ))}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="ms-comment-date">{formatDate(c.createdAt)}</div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
        )}

        {/* ── III. REZERVACIJE ─────────────────────────────────────────── */}
        {tab === 'rezervacije' && (
        <section className="ms-section">
          <div className="ms-section-body">
            <div className="ms-section-head">
              <span className="ms-eyebrow">— odeljak —</span>
              <h2 className="ms-section-title">Rezervacije</h2>
              <span className="ms-section-meta">
                {reservations ? `${reservations.length} zahteva` : '—'}
              </span>
            </div>

            {reservations === null ? (
              <div className="ms-empty">Učitavanje…</div>
            ) : reservations.length === 0 ? (
              <div className="ms-empty">
                Niste još poslali nijedan zahtev za rezervaciju.
              </div>
            ) : (
              <div className="ms-tickets">
                {reservations.map((r) => (
                  <div className={`ms-ticket status-${r.status}`} key={r.id}>
                    <div className="ms-ticket-body">
                      <div className="ms-ticket-head">
                        <Link to={`/objekat/${r.locationSlug}`} className="ms-ticket-loc">
                          {r.locationName}
                        </Link>
                      </div>
                      <div className="ms-ticket-summary">{describeReservation(r)}</div>
                      <div className="ms-ticket-date">poslato {formatDate(r.createdAt)}</div>
                    </div>
                    <div className={`ms-stamp s-${r.status}`}>
                      {RES_STATUS_LABELS[r.status]}
                    </div>
                    {(r.status === 'pending' || r.status === 'approved') && (
                      <div className="ms-ticket-actions">
                        <button
                          className="ms-btn ms-btn-danger ms-btn-sm"
                          onClick={() => cancelReservation(r.id)}
                        >
                          Otkaži
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        )}

        {/* ── III-b. USLUGE (broadcast zahtevi + kontraponude majstora) ── */}
        {tab === 'usluge' && (
        <section className="ms-section">
          <div className="ms-section-body">
            <div className="ms-section-head">
              <span className="ms-eyebrow">— odeljak —</span>
              <h2 className="ms-section-title">Usluge</h2>
              <span className="ms-section-meta">
                {serviceJobs ? `${serviceJobs.length} zahteva` : '—'}
              </span>
            </div>

            {serviceJobs === null ? (
              <div className="ms-empty">Učitavanje…</div>
            ) : serviceJobs.length === 0 ? (
              <div className="ms-empty">
                Niste još poslali nijedan zahtev za uslugu.{' '}
                <Link to="/usluge"><strong>Zatražite uslugu</strong></Link> — majstori vam
                odgovaraju ponudama sa cenom.
              </div>
            ) : (
              <div>
                {serviceJobs.map((j) => (
                  <div className={`usluge-job ${j.status === 'cancelled' ? 'is-archived' : ''}`} key={j.id}>
                    <div className="usluge-job-head">
                      <span className="usluge-job-cat">
                        {isServiceCategory(j.categoryId) ? SERVICE_CATEGORY_LABELS[j.categoryId] : j.categoryId}
                      </span>
                      <span className={`usluge-status is-${j.status}`}>
                        {JOB_STATUS_LABELS[j.status]}
                      </span>
                      <span className="usluge-job-date">poslato {formatDate(j.createdAt)}</span>
                    </div>
                    <div className="usluge-job-desc">{j.payload.description}</div>
                    {j.payload.note && (
                      <div className="usluge-job-note">Napomena: {j.payload.note}</div>
                    )}
                    {j.payload.photoIds.length > 0 && (
                      <div className="usluge-job-photos">
                        {j.payload.photoIds.map((id) => (
                          <AuthImage key={id} mediaId={id} alt={`slika kvara ${id}`} />
                        ))}
                      </div>
                    )}

                    {j.offers.length === 0 ? (
                      j.status === 'open' && (
                        <div className="usluge-archived-note">Još nema ponuda — majstori su obavešteni.</div>
                      )
                    ) : (
                      j.offers.map((o) => (
                        <div
                          key={o.id}
                          className={`usluge-offer ${o.status === 'accepted' ? 'is-accepted' : ''} ${o.status === 'archived' ? 'is-archived' : ''}`}
                        >
                          <div className="usluge-offer-body">
                            <div className="usluge-offer-price">
                              {o.quote.priceRsd.toLocaleString('sr-RS')} RSD
                            </div>
                            <div className="usluge-offer-meta">
                              {o.majstorDisplayName} · termin {o.quote.availableDate}
                              {o.status === 'accepted' && ' · prihvaćeno'}
                              {o.status === 'archived' && ' · arhivirano'}
                            </div>
                            {o.quote.note && <div className="usluge-offer-note">{o.quote.note}</div>}
                            {o.status === 'accepted' && (
                              <div className="usluge-contact">
                                <span className="usluge-offer-meta">
                                  Dogovorite se sa majstorom {o.majstorDisplayName}:
                                </span>
                                {o.majstorPhone && (
                                  <a className="row-action" href={`tel:${o.majstorPhone}`}>
                                    ☎ {o.majstorPhone}
                                  </a>
                                )}
                                <StartChat
                                  recipientId={o.majstorUserId}
                                  recipientName={o.majstorDisplayName}
                                  onSent={async () => {
                                    await reloadConversations();
                                    setTab('poruke');
                                  }}
                                />
                              </div>
                            )}
                          </div>
                          {j.status === 'open' && o.status === 'active' && (
                            <button
                              className="ms-btn ms-btn-primary ms-btn-sm"
                              onClick={() => acceptOffer(j.id, o.id)}
                            >
                              Prihvati
                            </button>
                          )}
                        </div>
                      ))
                    )}

                    {j.status === 'open' && (
                      <div className="ms-ticket-actions" style={{ marginTop: 12 }}>
                        <button className="ms-btn ms-btn-danger ms-btn-sm" onClick={() => cancelJob(j.id)}>
                          Otkaži zahtev
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        )}

        {/* ── IV. PORUKE (objedinjen inbox: razgovori o oglasima + zahtevi majstoru) ── */}
        {tab === 'poruke' && (
        <section className="ms-section">
          <div className="ms-section-body">
            <div className="ms-section-head">
              <span className="ms-eyebrow">— odeljak —</span>
              <h2 className="ms-section-title">Poruke</h2>
              <span className="ms-section-meta">
                {conversations && serviceRequests
                  ? `${conversations.length + serviceRequests.length} ukupno`
                  : '—'}
              </span>
            </div>

            <PorukeInbox
              currentUserId={user.id}
              conversations={conversations}
              serviceRequests={serviceRequests}
              reloadConversations={reloadConversations}
              reloadServiceRequests={reloadServiceRequests}
            />
          </div>
        </section>
        )}

        {/* ── V. BILTEN (newsletter preferencije) ──────────────────────── */}
        {tab === 'bilten' && (
        <section className="ms-section">
          <div className="ms-section-body">
            <div className="ms-section-head">
              <span className="ms-eyebrow">— odeljak —</span>
              <h2 className="ms-section-title">Bilten</h2>
              <span className="ms-section-meta">e-pošta</span>
            </div>
            <NewsletterSettings />
          </div>
        </section>
        )}
      </div>
    </div>
  );
}
