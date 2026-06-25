import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, mediaUrl, type CurrentUser } from '../lib/api';
import { formatDate } from '../lib/format';
import { AD_CATEGORY_LABELS, type Ad } from '../types';

function formatPrice(priceRsd: number | null): string {
  if (priceRsd === null) return 'Po dogovoru';
  return `${priceRsd.toLocaleString('sr-RS')} RSD`;
}

interface Props {
  ad: Ad;
  currentUser: CurrentUser | null;
  onEdit: () => void;
  onArchived: () => void;
}

// Full ad detail content, used on the shareable /oglasi/:id page.
export function AdDetailBody({ ad, currentUser, onEdit, onArchived }: Props) {
  const navigate = useNavigate();
  const isOwner = !!currentUser && currentUser.id === ad.userId;
  const isAdmin = currentUser?.role === 'admin';
  const isGuest = currentUser?.role === 'guest';

  const [msgBody, setMsgBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const archive = async () => {
    if (!window.confirm('Arhivirati ovaj oglas? Možete ga zatim povratiti preko administratora.')) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteOglas(ad.id);
      onArchived();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = msgBody.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      await api.startConversation({ adId: ad.id, body });
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const renderContact = () => {
    if (ad.contactMethod === 'message') {
      if (isOwner) {
        return <p className="oglas-contact-note">Ovo je vaš oglas. Poruke ćete videti u „Moj prostor → Poruke".</p>;
      }
      if (!currentUser) {
        return (
          <p className="oglas-contact-note">
            <Link to="/prijava">Prijavite se</Link> da biste poslali poruku oglašivaču.
          </p>
        );
      }
      if (isGuest) {
        return (
          <p className="oglas-contact-note">
            Za slanje poruka je potreban trajan nalog. Nadogradite ga u{' '}
            <Link to="/dashboard">Moj prostor</Link>.
          </p>
        );
      }
      return (
        <form className="oglas-msg-form" onSubmit={sendMessage}>
          <label className="ms-field">
            <span className="ms-field-label">Poruka oglašivaču</span>
            <textarea
              className="ms-field-input"
              rows={3}
              maxLength={2000}
              value={msgBody}
              onChange={(e) => setMsgBody(e.target.value)}
              placeholder="npr. Poštovanje, da li je oglas još aktuelan?"
            />
          </label>
          <button className="ms-btn ms-btn-primary ms-btn-sm" type="submit" disabled={busy || !msgBody.trim()}>
            {busy ? 'Slanje…' : 'Pošalji poruku'}
          </button>
        </form>
      );
    }
    if (ad.contactMethod === 'link' && ad.contactValue) {
      return (
        <a className="ms-btn ms-btn-primary ms-btn-sm" href={ad.contactValue} target="_blank" rel="noreferrer">
          Otvori link →
        </a>
      );
    }
    if (ad.contactMethod === 'phone' && ad.contactValue) {
      return (
        <a className="ms-btn ms-btn-primary ms-btn-sm" href={`tel:${ad.contactValue}`}>
          Pozovi: {ad.contactValue}
        </a>
      );
    }
    if (ad.contactMethod === 'email' && ad.contactValue) {
      return (
        <a className="ms-btn ms-btn-primary ms-btn-sm" href={`mailto:${ad.contactValue}`}>
          Pošalji mejl: {ad.contactValue}
        </a>
      );
    }
    return null;
  };

  return (
    <article className="oglas-detail-card">
      {ad.photoMediaId && (
        <div className="oglas-detail-photo">
          <img src={mediaUrl(ad.photoMediaId)} alt={ad.title} />
        </div>
      )}

      <div className="oglas-detail-info">
        <div className="oglas-modal-head">
          <span className={`oglas-badge static cat-${ad.category}`}>{AD_CATEGORY_LABELS[ad.category]}</span>
          {ad.status === 'archived' && <span className="oglas-badge static cat-arhiva">arhiviran</span>}
          <span className="oglas-modal-date">{formatDate(ad.createdAt)}</span>
        </div>
        <h1 className="oglas-detail-title">{ad.title}</h1>
        <div className="oglas-modal-price">{formatPrice(ad.priceRsd)}</div>
        <div className="oglas-modal-meta">
          <strong>{ad.village}</strong> · {ad.authorDisplayName}
        </div>

        <p className="oglas-modal-desc">{ad.description}</p>

        <div className="oglas-modal-contact">
          <div className="ms-quote-label">— Kontakt —</div>
          {renderContact()}
        </div>

        {(isOwner || isAdmin) && (
          <div className="oglas-modal-owner-actions">
            <button className="ms-btn ms-btn-sm" onClick={onEdit} disabled={busy}>
              Izmeni
            </button>
            {ad.status === 'active' && (
              <button className="ms-btn ms-btn-danger ms-btn-sm" onClick={archive} disabled={busy}>
                Arhiviraj
              </button>
            )}
          </div>
        )}

        {error && <div className="ms-error">{error}</div>}
      </div>
    </article>
  );
}
