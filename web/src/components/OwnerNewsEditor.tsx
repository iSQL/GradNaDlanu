import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { NewsStatus, OwnerNewsItem } from '../types';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('sr-Latn-RS', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(s: NewsStatus): string {
  if (s === 'published') return 'Objavljeno';
  if (s === 'draft') return 'Nacrt';
  return 'Na čekanju';
}

interface DraftNews {
  id?: number;
  title: string;
  body: string;
  status: NewsStatus;
}

const EMPTY: DraftNews = { title: '', body: '', status: 'published' };

interface Props {
  locationId: number;
}

export function OwnerNewsEditor({ locationId }: Props) {
  const [items, setItems] = useState<OwnerNewsItem[] | null>(null);
  const [draft, setDraft] = useState<DraftNews>(EMPTY);
  const [editing, setEditing] = useState<DraftNews | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setError(null);
    api
      .ownerListNews({ locationId })
      .then(setItems)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    setItems(null);
    api
      .ownerListNews({ locationId })
      .then(setItems)
      .catch((err: Error) => setError(err.message));
  }, [locationId]);

  const handleCreate = async () => {
    if (!draft.title.trim() || !draft.body.trim()) {
      setError('Naslov i tekst su obavezni.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.ownerCreateNews({
        locationId,
        title: draft.title,
        body: draft.body,
        status: draft.status,
      });
      setDraft(EMPTY);
      reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!editing || editing.id === undefined) return;
    if (!editing.title.trim() || !editing.body.trim()) {
      setError('Naslov i tekst su obavezni.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.ownerUpdateNews(editing.id, {
        title: editing.title,
        body: editing.body,
        status: editing.status,
      });
      setEditing(null);
      reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Obrisati ovo obaveštenje?')) return;
    setBusy(true);
    setError(null);
    try {
      await api.ownerDeleteNews(id);
      reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="events-editor">
      <div className="field-label" style={{ margin: 0 }}>Postojeća obaveštenja</div>

      {error && <div className="login-error">{error}</div>}

      {items === null ? (
        <div className="home-skeleton-list">
          <div className="home-skeleton-row" />
          <div className="home-skeleton-row" />
        </div>
      ) : items.length === 0 ? (
        <div className="comments-empty" style={{ padding: 16, fontSize: 13 }}>Nema još obaveštenja.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((n) => {
            const isEditing = editing?.id === n.id;
            if (isEditing && editing) {
              return (
                <div key={n.id} className="events-form">
                  <input
                    className="field-input events-form-full"
                    value={editing.title}
                    onChange={(ev) => setEditing({ ...editing, title: ev.target.value })}
                    placeholder="Naslov"
                  />
                  <textarea
                    className="field-input events-form-full"
                    value={editing.body}
                    onChange={(ev) => setEditing({ ...editing, body: ev.target.value })}
                    placeholder="Tekst obaveštenja"
                    rows={5}
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                  <div className="events-form-full" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ fontSize: 12, color: 'var(--ink-2)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      Status:
                      <select
                        className="field-input"
                        value={editing.status}
                        onChange={(ev) => setEditing({ ...editing, status: ev.target.value as NewsStatus })}
                        style={{ padding: '6px 8px' }}
                      >
                        <option value="published">Objavljeno</option>
                        <option value="draft">Nacrt</option>
                      </select>
                    </label>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <button type="button" className="nav-btn" disabled={busy} onClick={() => setEditing(null)}>Otkaži</button>
                      <button type="button" className="btn-primary" disabled={busy} onClick={handleSave}>Sačuvaj</button>
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div key={n.id} className="events-editor-row">
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{n.title}</div>
                  <div className="events-editor-meta">
                    {statusLabel(n.status)} · {formatDate(n.publishedAt ?? n.createdAt)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 6, whiteSpace: 'pre-wrap' }}>
                    {n.body.length > 200 ? n.body.slice(0, 200) + '…' : n.body}
                  </div>
                </div>
                <div className="events-editor-actions">
                  <button
                    type="button"
                    className="nav-btn"
                    disabled={busy}
                    onClick={() =>
                      setEditing({
                        id: n.id,
                        title: n.title,
                        body: n.body,
                        status: n.status,
                      })
                    }
                  >
                    Uredi
                  </button>
                  <button type="button" className="nav-btn" disabled={busy} onClick={() => handleDelete(n.id)}>
                    Obriši
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="events-form">
        <input
          className="field-input events-form-full"
          value={draft.title}
          onChange={(ev) => setDraft({ ...draft, title: ev.target.value })}
          placeholder="Naslov novog obaveštenja"
        />
        <textarea
          className="field-input events-form-full"
          value={draft.body}
          onChange={(ev) => setDraft({ ...draft, body: ev.target.value })}
          placeholder="Tekst obaveštenja"
          rows={4}
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
        />
        <div className="events-form-full" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: 'var(--ink-2)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            Status:
            <select
              className="field-input"
              value={draft.status}
              onChange={(ev) => setDraft({ ...draft, status: ev.target.value as NewsStatus })}
              style={{ padding: '6px 8px' }}
            >
              <option value="published">Objavi odmah</option>
              <option value="draft">Sačuvaj kao nacrt</option>
            </select>
          </label>
          <button
            type="button"
            className="btn-primary"
            style={{ marginLeft: 'auto' }}
            disabled={busy || !draft.title.trim() || !draft.body.trim()}
            onClick={handleCreate}
          >
            {busy ? 'Dodavanje…' : 'Dodaj obaveštenje'}
          </button>
        </div>
      </div>
    </div>
  );
}
