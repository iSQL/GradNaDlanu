import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import { clearToken } from '../lib/auth';
import { PinGlyph } from '../components/PinGlyph';
import { IconStar } from '../components/Icons';
import type { FavoriteRow, MyComment } from '../types';

type Tab = 'favorites' | 'comments' | 'reservations';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sr-RS', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function Account() {
  const ctx = useOutletContext<AppContext>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('favorites');
  const [favorites, setFavorites] = useState<FavoriteRow[] | null>(null);
  const [comments, setComments] = useState<MyComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx.currentUser) return;
    api.myFavorites().then(setFavorites).catch((e: Error) => setError(e.message));
    api.myComments().then(setComments).catch((e: Error) => setError(e.message));
  }, [ctx.currentUser]);

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
            <h1>{ctx.currentUser.displayName}</h1>
            <div className="account-meta">{ctx.currentUser.email} · {ctx.currentUser.role}</div>
          </div>
          <button className="nav-btn" onClick={logout}>Odjavi se</button>
        </div>

        <div className="account-tabs">
          <button className={`account-tab ${tab === 'favorites' ? 'active' : ''}`} onClick={() => setTab('favorites')}>
            Omiljeno {favorites && `· ${favorites.length}`}
          </button>
          <button className={`account-tab ${tab === 'comments' ? 'active' : ''}`} onClick={() => setTab('comments')}>
            Komentari {comments && `· ${comments.length}`}
          </button>
          <button className={`account-tab ${tab === 'reservations' ? 'active' : ''}`} onClick={() => setTab('reservations')}>
            Rezervacije
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
          <div className="comments-empty">
            Rezervacije stižu uskoro — moći ćete da pratite status svojih zahteva ovde.
          </div>
        )}
      </div>
    </div>
  );
}
