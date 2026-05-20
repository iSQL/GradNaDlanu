import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import { clearToken } from '../lib/auth';
import { PinGlyph } from '../components/PinGlyph';
import type { Location } from '../types';
import { ReservationsInbox } from '../admin/ReservationsInbox';
import { ServiceRequestsInbox } from '../admin/ServiceRequestsInbox';

type OwnerComment = Awaited<ReturnType<typeof api.ownerComments>>[number];
type Tab = 'objects' | 'reservations' | 'service-requests' | 'comments';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('sr-RS', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OwnerDashboard() {
  const ctx = useOutletContext<AppContext>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('reservations');
  const [objects, setObjects] = useState<Location[] | null>(null);
  const [comments, setComments] = useState<OwnerComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.ownerLocations().then(setObjects).catch((e: Error) => setError(e.message));
    api.ownerComments().then(setComments).catch((e: Error) => setError(e.message));
  }, []);

  const logout = async () => {
    clearToken();
    await ctx.reloadCurrentUser();
    navigate('/');
  };

  return (
    <div className="account-page">
      <div className="account-shell">
        <div className="account-header">
          <div>
            <h1>Poslovni panel</h1>
            <div className="account-meta">
              {ctx.currentUser?.displayName} · {ctx.currentUser?.email} · {ctx.currentUser?.role}
            </div>
          </div>
          <button className="nav-btn" onClick={logout}>Odjavi se</button>
        </div>

        <div className="account-tabs">
          <button className={`account-tab ${tab === 'objects' ? 'active' : ''}`} onClick={() => setTab('objects')}>
            Moji objekti {objects && `· ${objects.length}`}
          </button>
          <button className={`account-tab ${tab === 'reservations' ? 'active' : ''}`} onClick={() => setTab('reservations')}>
            Rezervacije
          </button>
          <button className={`account-tab ${tab === 'service-requests' ? 'active' : ''}`} onClick={() => setTab('service-requests')}>
            Zahtevi za uslugu
          </button>
          <button className={`account-tab ${tab === 'comments' ? 'active' : ''}`} onClick={() => setTab('comments')}>
            Komentari {comments && `· ${comments.length}`}
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        {tab === 'objects' && (
          <div className="account-favorites">
            {objects === null ? (
              <div className="comments-empty">Učitavanje…</div>
            ) : objects.length === 0 ? (
              <div className="comments-empty">
                Još nemate dodeljenih objekata. Kontaktirajte administraciju da bi vam dodelili objekat.
              </div>
            ) : (
              objects.map((o) => (
                <div className="favorite-card" key={o.id}>
                  <Link to={`/poslovni/objekti/${o.slug}`} className="favorite-link">
                    <div className="favorite-glyph"><PinGlyph cat={o.catId} size={28} /></div>
                    <div>
                      <div className="favorite-name">{o.name}</div>
                      <div className="favorite-meta">{o.address}</div>
                    </div>
                  </Link>
                  <Link to={`/objekat/${o.slug}`} className="row-action" target="_blank">Pregled</Link>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'reservations' && <ReservationsInbox />}

        {tab === 'service-requests' && <ServiceRequestsInbox />}

        {tab === 'comments' && (
          <div className="account-comments">
            {comments === null ? (
              <div className="comments-empty">Učitavanje…</div>
            ) : comments.length === 0 ? (
              <div className="comments-empty">Još nema komentara na vašim objektima.</div>
            ) : (
              comments.map((c) => (
                <div className="comment" key={c.id}>
                  <div className="comment-head">
                    <Link to={`/objekat/${c.locationSlug}`} className="comment-loc">{c.locationName}</Link>
                    <div className="comment-author">· {c.authorName}</div>
                    <div className="comment-date">{formatDate(c.createdAt)}</div>
                  </div>
                  <div className="comment-body">{c.body}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

