import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import type { NewsItem, NewsStatus } from '../types';

export function NewsDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { currentUser } = useOutletContext<AppContext>();

  const [item, setItem] = useState<NewsItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ title: string; body: string; status: NewsStatus } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setItem(null);
    setError(null);
    api
      .getNews(slug)
      .then(setItem)
      .catch((err: Error) => {
        if (err.message.startsWith('404')) setError('Obaveštenje nije pronađeno ili je uklonjeno.');
        else setError(err.message);
      });
  }, [slug]);

  const canManage =
    item !== null &&
    !!currentUser &&
    (currentUser.role === 'admin' || currentUser.ownedLocationIds.includes(item.locationId));

  const startEdit = () => {
    if (!item) return;
    setEditing({ title: item.title, body: item.body, status: 'published' });
  };

  const handleSave = async () => {
    if (!item || !editing) return;
    if (!editing.title.trim() || !editing.body.trim()) {
      setError('Naslov i tekst su obavezni.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await api.ownerUpdateNews(item.id, {
        title: editing.title,
        body: editing.body,
        status: editing.status,
      });
      // ownerUpdateNews vraća OwnerNewsItem (extends NewsItem). Mapiramo na NewsItem
      // šape direktno — sva polja koja prikazujemo postoje u oba tipa.
      setItem({
        ...item,
        title: updated.title,
        body: updated.body,
        publishedAt: updated.publishedAt,
      });
      setEditing(null);
      // Ako je novi status nije 'published' javno se ne vidi — vrati korisnika na feed.
      if (editing.status !== 'published') {
        navigate('/desavanja');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    if (!confirm(`Obrisati obaveštenje "${item.title}"? Ova radnja je trajna.`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.ownerDeleteNews(item.id);
      navigate('/desavanja');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  if (error && !item) {
    return (
      <div className="page page-detail">
        <div className="page-shell page-shell-narrow">
          <Link to="/desavanja" className="detail-back">← Sva dešavanja</Link>
          <div className="empty-state">{error}</div>
        </div>
      </div>
    );
  }
  if (!item) {
    return (
      <div className="page page-detail">
        <div className="page-shell page-shell-narrow">
          <div className="empty-state">Učitavam…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-detail">
      <div className="page-shell page-shell-narrow">
        <Link to="/desavanja" className="detail-back">← Sva dešavanja</Link>

        <div className="detail-eyebrow">
          <span className="tile-kind kind-news">Obaveštenje</span>
          <span className="detail-date">{formatDateTime(item.publishedAt ?? item.createdAt)}</span>
        </div>

        {editing ? (
          <div className="detail-edit">
            <input
              className="field-input detail-edit-title"
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              placeholder="Naslov"
            />
            <textarea
              className="field-input"
              value={editing.body}
              onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              placeholder="Tekst obaveštenja"
              rows={10}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div className="detail-edit-actions">
              <label className="detail-edit-status">
                Status:
                <select
                  className="field-input"
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value as NewsStatus })}
                  style={{ padding: '6px 10px' }}
                >
                  <option value="published">Objavljeno</option>
                  <option value="draft">Nacrt (skriveno)</option>
                </select>
              </label>
              <div className="detail-edit-buttons">
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => setEditing(null)}>
                  Otkaži
                </button>
                <button type="button" className="btn-primary" disabled={busy} onClick={handleSave}>
                  {busy ? 'Čuvam…' : 'Sačuvaj'}
                </button>
              </div>
            </div>
            {error && <div className="login-error">{error}</div>}
          </div>
        ) : (
          <>
            <h1 className="detail-title">{item.title}</h1>
            <div className="detail-meta">
              <Link to={`/objekat/${item.locationSlug}`} className="detail-loc">
                {item.locationName}
              </Link>
              {item.village ? <span> · {item.village}</span> : null}
            </div>
            <div className="detail-body">{item.body}</div>

            {canManage && (
              <div className="detail-actions">
                <button type="button" className="btn-secondary" onClick={startEdit} disabled={busy}>
                  Uredi
                </button>
                <button type="button" className="row-action danger" onClick={handleDelete} disabled={busy}>
                  Obriši
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
