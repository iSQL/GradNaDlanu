import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api, mediaUrl } from '../lib/api';
import { clearToken } from '../lib/auth';
import { PinGlyph } from '../components/PinGlyph';
import { IconStar } from '../components/Icons';
import { RoleBadge } from '../components/RoleBadge';
import type {
  FavoriteRow,
  MyComment,
  MyReservation,
  MyServiceRequest,
  ServiceRequestStatus,
} from '../types';

type Tab = 'favorites' | 'comments' | 'reservations' | 'service-requests';

const SR_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  pending: 'na čekanju',
  quoted: 'stigla ponuda',
  accepted: 'prihvaćeno',
  declined: 'odbijeno',
  cancelled: 'otkazano',
  completed: 'završeno',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sr-RS', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const STATUS_LABELS: Record<MyReservation['status'], string> = {
  pending: 'na čekanju',
  approved: 'odobreno',
  declined: 'odbijeno',
  cancelled: 'otkazano',
};

function describeReservation(r: MyReservation): string {
  const p = r.payload as unknown as Record<string, string | number>;
  if (r.locationCatId === 'cafe') {
    const start = new Date(String(p.slotStart));
    const end = new Date(String(p.slotEnd));
    return `Sto #${p.tableId} · ${start.toLocaleString('sr-RS', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })} · ${p.guests} gostiju`;
  }
  if (r.locationCatId === 'hotel') {
    return `Soba ${p.roomKey} · ${p.dateFrom} → ${p.dateTo} · ${p.guests} gostiju`;
  }
  return JSON.stringify(p);
}

export function Account() {
  const ctx = useOutletContext<AppContext>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('favorites');
  const [favorites, setFavorites] = useState<FavoriteRow[] | null>(null);
  const [comments, setComments] = useState<MyComment[] | null>(null);
  const [reservations, setReservations] = useState<MyReservation[] | null>(null);
  const [serviceRequests, setServiceRequests] = useState<MyServiceRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Guest → user upgrade form state. Token is NOT cleared on success — the
  // guest stays logged in until they click the verify link (or abandon it,
  // in which case the cleanup job sweeps the row after 7 days of inactivity).
  const [upgradeEmail, setUpgradeEmail] = useState('');
  const [upgradePassword, setUpgradePassword] = useState('');
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgradeSentTo, setUpgradeSentTo] = useState<string | null>(null);

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
      else if (message.includes('400')) setUpgradeError('Proverite unos: validna e-pošta i lozinka (min. 6 karaktera).');
      else setUpgradeError(message);
    } finally {
      setUpgradeBusy(false);
    }
  };

  useEffect(() => {
    if (!ctx.currentUser) return;
    api.myFavorites().then(setFavorites).catch((e: Error) => setError(e.message));
    api.myComments().then(setComments).catch((e: Error) => setError(e.message));
    api.myReservations().then(setReservations).catch((e: Error) => setError(e.message));
    api.myServiceRequests().then(setServiceRequests).catch((e: Error) => setError(e.message));
  }, [ctx.currentUser]);

  const cancelReservation = async (id: number) => {
    if (!window.confirm('Otkazati ovu rezervaciju?')) return;
    await api.cancelReservation(id);
    const next = await api.myReservations();
    setReservations(next);
  };

  const acceptServiceRequest = async (id: number) => {
    if (!window.confirm('Prihvatiti ovu ponudu?')) return;
    try {
      await api.acceptServiceRequest(id);
      setServiceRequests(await api.myServiceRequests());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const cancelServiceRequest = async (id: number) => {
    if (!window.confirm('Otkazati ovaj zahtev?')) return;
    try {
      await api.cancelServiceRequest(id);
      setServiceRequests(await api.myServiceRequests());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!ctx.currentUser) {
    return (
      <div className="account-page">
        <div className="account-shell">
          <h1>Nalog</h1>
          <p>
            <Link to="/prijava">Prijavite se</Link> ili{' '}
            <Link to="/registracija">napravite nalog</Link> za pristup ličnom prostoru.
          </p>
        </div>
      </div>
    );
  }

  const logout = async () => {
    clearToken();
    await ctx.reloadCurrentUser();
    navigate('/');
  };

  const removeFavorite = async (slug: string) => {
    await api.unfavorite(slug);
    setFavorites((rows) => rows?.filter((r) => r.slug !== slug) ?? null);
  };

  return (
    <div className="account-page">
      <div className="account-shell">
        <div className="account-header">
          <div>
            <h1>
              {ctx.currentUser.displayName}
              <RoleBadge role={ctx.currentUser.role} />
            </h1>
            <div className="account-meta">
              {ctx.currentUser.role === 'guest'
                ? 'Privremeni nalog'
                : `${ctx.currentUser.email ?? ''} · ${ctx.currentUser.role}`}
            </div>
          </div>
          <button className="nav-btn" onClick={logout}>Odjavi se</button>
        </div>

        {ctx.currentUser.role === 'guest' && (
          upgradeSentTo ? (
            <div className="admin-card" style={{ marginTop: 16 }}>
              <div className="section-label" style={{ margin: 0, marginBottom: 10 }}>Potvrdite e-poštu</div>
              <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55, margin: 0 }}>
                Poslali smo link na <strong>{upgradeSentTo}</strong>. Otvorite poruku i kliknite na link
                da nadogradite nalog u trajan. Link važi 24 sata. Do tada ostajete prijavljeni kao gost.
              </p>
            </div>
          ) : (
            <form className="admin-card" style={{ marginTop: 16 }} onSubmit={submitUpgrade}>
              <div className="section-label" style={{ margin: 0, marginBottom: 10 }}>Nadogradite na trajan nalog</div>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 14px' }}>
                Dodajte e-poštu i lozinku da zadržite omiljena mesta, komentare i istoriju, i otključate
                rezervacije i ostale funkcije nakon potvrde e-pošte.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div className="field-label">E-pošta</div>
                  <input
                    className="field-input"
                    type="email"
                    value={upgradeEmail}
                    onChange={(e) => setUpgradeEmail(e.target.value)}
                  />
                </div>
                <div>
                  <div className="field-label">Lozinka</div>
                  <input
                    className="field-input"
                    type="password"
                    value={upgradePassword}
                    onChange={(e) => setUpgradePassword(e.target.value)}
                    placeholder="najmanje 6 karaktera"
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={upgradeBusy || !upgradeEmail || !upgradePassword}
                >
                  {upgradeBusy ? 'Slanje…' : 'Nadogradite nalog'}
                </button>
                {upgradeError && <div className="login-error">{upgradeError}</div>}
              </div>
            </form>
          )
        )}

        <div className="account-tabs">
          <button className={`account-tab ${tab === 'favorites' ? 'active' : ''}`} onClick={() => setTab('favorites')}>
            Omiljeno {favorites && `· ${favorites.length}`}
          </button>
          <button className={`account-tab ${tab === 'comments' ? 'active' : ''}`} onClick={() => setTab('comments')}>
            Komentari {comments && `· ${comments.length}`}
          </button>
          <button className={`account-tab ${tab === 'reservations' ? 'active' : ''}`} onClick={() => setTab('reservations')}>
            Rezervacije {reservations && `· ${reservations.length}`}
          </button>
          <button className={`account-tab ${tab === 'service-requests' ? 'active' : ''}`} onClick={() => setTab('service-requests')}>
            Moji zahtevi {serviceRequests && `· ${serviceRequests.length}`}
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        {tab === 'favorites' && (
          <div className="account-favorites">
            {favorites === null ? (
              <div className="comments-empty">Učitavanje…</div>
            ) : favorites.length === 0 ? (
              <div className="comments-empty">
                Još nema sačuvanih objekata. Kliknite na srce na stranici objekta da ih dodate.
              </div>
            ) : (
              favorites.map((f) => (
                <div className="favorite-card" key={f.id}>
                  <Link to={`/objekat/${f.slug}`} className="favorite-link">
                    <div className="favorite-glyph"><PinGlyph cat={f.catId} size={28} /></div>
                    <div>
                      <div className="favorite-name">{f.name}</div>
                      <div className="favorite-meta">{f.address}</div>
                    </div>
                  </Link>
                  <button className="row-action" onClick={() => removeFavorite(f.slug)}>Ukloni</button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'comments' && (
          <div className="account-comments">
            {comments === null ? (
              <div className="comments-empty">Učitavanje…</div>
            ) : comments.length === 0 ? (
              <div className="comments-empty">Niste još ostavili nijedan komentar.</div>
            ) : (
              comments.map((c) => (
                <div className="comment" key={c.id}>
                  <div className="comment-head">
                    <Link to={`/objekat/${c.locationSlug}`} className="comment-loc">{c.locationName}</Link>
                    {c.rating !== null && (
                      <div className="comment-rating">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <IconStar key={n} filled={n <= c.rating!} />
                        ))}
                      </div>
                    )}
                    <div className="comment-date">{formatDate(c.createdAt)}</div>
                  </div>
                  <div className="comment-body">{c.body}</div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'reservations' && (
          <div className="account-comments">
            {reservations === null ? (
              <div className="comments-empty">Učitavanje…</div>
            ) : reservations.length === 0 ? (
              <div className="comments-empty">Niste još poslali nijedan zahtev za rezervaciju.</div>
            ) : (
              reservations.map((r) => (
                <div className={`reservation-row status-${r.status}`} key={r.id}>
                  <div className="reservation-main">
                    <Link to={`/objekat/${r.locationSlug}`} className="comment-loc">{r.locationName}</Link>
                    <div className="favorite-meta">{describeReservation(r)}</div>
                    <div className="favorite-meta">poslato {formatDate(r.createdAt)}</div>
                  </div>
                  <div className={`reservation-status status-${r.status}`}>{STATUS_LABELS[r.status]}</div>
                  {(r.status === 'pending' || r.status === 'approved') && (
                    <div className="reservation-actions">
                      <button className="row-action danger" onClick={() => cancelReservation(r.id)}>Otkaži</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'service-requests' && (
          <div className="account-comments">
            {serviceRequests === null ? (
              <div className="comments-empty">Učitavanje…</div>
            ) : serviceRequests.length === 0 ? (
              <div className="comments-empty">Niste još poslali nijedan zahtev majstoru.</div>
            ) : (
              serviceRequests.map((r) => (
                <div className={`service-request-card status-${r.status}`} key={r.id}>
                  <div className="service-request-head">
                    <div>
                      <Link to={`/objekat/${r.locationSlug}`} className="comment-loc">{r.locationName}</Link>
                      <div className="favorite-meta">zahtev #{r.id} · poslato {formatDate(r.createdAt)}</div>
                    </div>
                    <div className={`reservation-status status-${r.status}`}>{SR_STATUS_LABELS[r.status]}</div>
                  </div>

                  <div className="service-request-body">{r.payload.description}</div>

                  {r.payload.photoIds.length > 0 && (
                    <div className="service-request-thumbs">
                      {r.payload.photoIds.map((id) => (
                        <a key={id} href={mediaUrl(id)} target="_blank" rel="noreferrer">
                          <img src={mediaUrl(id)} alt={`photo-${id}`} />
                        </a>
                      ))}
                    </div>
                  )}

                  {r.quote && (
                    <div className="service-request-quote">
                      <div className="favorite-meta">Ponuda majstora:</div>
                      <div><strong>{r.quote.priceRsd.toLocaleString('sr-RS')} RSD</strong> · termin {r.quote.availableDate}</div>
                      {r.quote.note && <div className="favorite-meta">{r.quote.note}</div>}
                    </div>
                  )}

                  {r.status === 'pending' && (
                    <div className="reservation-actions">
                      <button className="row-action danger" onClick={() => cancelServiceRequest(r.id)}>Otkaži zahtev</button>
                    </div>
                  )}
                  {r.status === 'quoted' && (
                    <div className="reservation-actions">
                      <button className="row-action" onClick={() => acceptServiceRequest(r.id)}>Prihvati ponudu</button>
                      <button className="row-action danger" onClick={() => cancelServiceRequest(r.id)}>Otkaži zahtev</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
