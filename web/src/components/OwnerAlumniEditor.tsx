import { useEffect, useRef, useState } from 'react';
import { api, mediaUrl } from '../lib/api';
import type { OwnerAlumnus } from '../types';

interface DraftAlumnus {
  id?: number;
  fullName: string;
  graduationYear: string;
  homeroomTeacher: string;
  motto: string;
  email: string;
  photoMediaId: number | null;
}

const EMPTY: DraftAlumnus = {
  fullName: '',
  graduationYear: '',
  homeroomTeacher: '',
  motto: '',
  email: '',
  photoMediaId: null,
};

interface Props {
  locationId: number;
}

function toPayload(d: DraftAlumnus) {
  const year = Number.parseInt(d.graduationYear, 10);
  return {
    fullName: d.fullName.trim(),
    graduationYear: Number.isFinite(year) ? year : NaN,
    homeroomTeacher: d.homeroomTeacher.trim(),
    motto: d.motto.trim(),
    email: d.email.trim() ? d.email.trim() : null,
    photoMediaId: d.photoMediaId,
  };
}

function isDraftValid(d: DraftAlumnus): boolean {
  if (!d.fullName.trim() || !d.homeroomTeacher.trim() || !d.motto.trim()) return false;
  const y = Number.parseInt(d.graduationYear, 10);
  if (!Number.isFinite(y)) return false;
  return true;
}

export function OwnerAlumniEditor({ locationId }: Props) {
  const [items, setItems] = useState<OwnerAlumnus[] | null>(null);
  const [draft, setDraft] = useState<DraftAlumnus>(EMPTY);
  const [editing, setEditing] = useState<DraftAlumnus | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<'draft' | 'edit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const draftFileRef = useRef<HTMLInputElement | null>(null);
  const editFileRef = useRef<HTMLInputElement | null>(null);

  const reload = () => {
    setError(null);
    api
      .ownerListAlumni({ locationId })
      .then(setItems)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    setItems(null);
    api
      .ownerListAlumni({ locationId })
      .then(setItems)
      .catch((err: Error) => setError(err.message));
  }, [locationId]);

  const handleUpload = async (file: File, target: 'draft' | 'edit') => {
    setUploading(target);
    setError(null);
    try {
      const { id } = await api.uploadMedia(file, 'alumni_photo');
      if (target === 'draft') {
        setDraft((d) => ({ ...d, photoMediaId: id }));
      } else if (editing) {
        setEditing({ ...editing, photoMediaId: id });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(null);
    }
  };

  const handleCreate = async () => {
    if (!isDraftValid(draft)) {
      setError('Ime, godina završetka, razredni starešina i moto su obavezni.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const p = toPayload(draft);
      await api.ownerCreateAlumnus({ locationId, ...p });
      setDraft(EMPTY);
      if (draftFileRef.current) draftFileRef.current.value = '';
      reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!editing || editing.id === undefined) return;
    if (!isDraftValid(editing)) {
      setError('Ime, godina završetka, razredni starešina i moto su obavezni.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const p = toPayload(editing);
      await api.ownerUpdateAlumnus(editing.id, p);
      setEditing(null);
      if (editFileRef.current) editFileRef.current.value = '';
      reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Obrisati ovaj unos?')) return;
    setBusy(true);
    setError(null);
    try {
      await api.ownerDeleteAlumnus(id);
      reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const renderPhotoControls = (
    photoMediaId: number | null,
    onClear: () => void,
    target: 'draft' | 'edit',
    fileRef: React.MutableRefObject<HTMLInputElement | null>,
  ) => (
    <div className="events-form-full" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {photoMediaId ? (
        <>
          <img
            src={mediaUrl(photoMediaId)}
            alt="Fotografija"
            style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }}
          />
          <button type="button" className="nav-btn" disabled={busy} onClick={onClear}>
            Ukloni fotografiju
          </button>
        </>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>Bez fotografije</span>
      )}
      <label className="nav-btn" style={{ cursor: 'pointer' }}>
        {uploading === target ? 'Otpremanje…' : photoMediaId ? 'Zameni' : 'Dodaj fotografiju'}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={(ev) => {
            const f = ev.target.files?.[0];
            if (f) void handleUpload(f, target);
          }}
        />
      </label>
    </div>
  );

  return (
    <div className="events-editor">
      <div className="field-label" style={{ margin: 0 }}>Postojeći alumni</div>

      {error && <div className="login-error">{error}</div>}

      {items === null ? (
        <div className="home-skeleton-list">
          <div className="home-skeleton-row" />
          <div className="home-skeleton-row" />
        </div>
      ) : items.length === 0 ? (
        <div className="comments-empty" style={{ padding: 16, fontSize: 13 }}>Nema još unosa.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((a) => {
            const isEditing = editing?.id === a.id;
            if (isEditing && editing) {
              return (
                <div key={a.id} className="events-form">
                  <input
                    className="field-input events-form-full"
                    value={editing.fullName}
                    onChange={(ev) => setEditing({ ...editing, fullName: ev.target.value })}
                    placeholder="Ime i prezime"
                  />
                  <input
                    className="field-input"
                    type="number"
                    value={editing.graduationYear}
                    onChange={(ev) => setEditing({ ...editing, graduationYear: ev.target.value })}
                    placeholder="Godina završetka"
                  />
                  <input
                    className="field-input"
                    value={editing.homeroomTeacher}
                    onChange={(ev) => setEditing({ ...editing, homeroomTeacher: ev.target.value })}
                    placeholder="Razredni starešina"
                  />
                  <input
                    className="field-input events-form-full"
                    value={editing.motto}
                    onChange={(ev) => setEditing({ ...editing, motto: ev.target.value })}
                    placeholder="Moto učenika"
                  />
                  <input
                    className="field-input events-form-full"
                    type="email"
                    value={editing.email}
                    onChange={(ev) => setEditing({ ...editing, email: ev.target.value })}
                    placeholder="Kontakt email (opciono)"
                  />
                  {renderPhotoControls(
                    editing.photoMediaId,
                    () => setEditing({ ...editing, photoMediaId: null }),
                    'edit',
                    editFileRef,
                  )}
                  <div className="events-form-full" style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button type="button" className="nav-btn" disabled={busy} onClick={() => setEditing(null)}>Otkaži</button>
                    <button type="button" className="btn-primary" disabled={busy} onClick={handleSave}>Sačuvaj</button>
                  </div>
                </div>
              );
            }
            return (
              <div key={a.id} className="events-editor-row">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {a.photoMediaId ? (
                    <img
                      src={mediaUrl(a.photoMediaId)}
                      alt={a.fullName}
                      style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        background: 'var(--bg-2)',
                        border: '1px solid var(--line)',
                      }}
                    />
                  )}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
                      {a.fullName} <span style={{ color: 'var(--ink-2)', fontWeight: 400 }}>· {a.graduationYear}.</span>
                    </div>
                    <div className="events-editor-meta">
                      Razr. star.: {a.homeroomTeacher}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4, fontStyle: 'italic' }}>
                      „{a.motto}”
                    </div>
                    {a.email && (
                      <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{a.email}</div>
                    )}
                  </div>
                </div>
                <div className="events-editor-actions">
                  <button
                    type="button"
                    className="nav-btn"
                    disabled={busy}
                    onClick={() =>
                      setEditing({
                        id: a.id,
                        fullName: a.fullName,
                        graduationYear: String(a.graduationYear),
                        homeroomTeacher: a.homeroomTeacher,
                        motto: a.motto,
                        email: a.email ?? '',
                        photoMediaId: a.photoMediaId,
                      })
                    }
                  >
                    Uredi
                  </button>
                  <button type="button" className="nav-btn" disabled={busy} onClick={() => handleDelete(a.id)}>
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
          value={draft.fullName}
          onChange={(ev) => setDraft({ ...draft, fullName: ev.target.value })}
          placeholder="Ime i prezime"
        />
        <input
          className="field-input"
          type="number"
          value={draft.graduationYear}
          onChange={(ev) => setDraft({ ...draft, graduationYear: ev.target.value })}
          placeholder="Godina završetka"
        />
        <input
          className="field-input"
          value={draft.homeroomTeacher}
          onChange={(ev) => setDraft({ ...draft, homeroomTeacher: ev.target.value })}
          placeholder="Razredni starešina"
        />
        <input
          className="field-input events-form-full"
          value={draft.motto}
          onChange={(ev) => setDraft({ ...draft, motto: ev.target.value })}
          placeholder="Moto učenika"
        />
        <input
          className="field-input events-form-full"
          type="email"
          value={draft.email}
          onChange={(ev) => setDraft({ ...draft, email: ev.target.value })}
          placeholder="Kontakt email (opciono)"
        />
        {renderPhotoControls(
          draft.photoMediaId,
          () => setDraft({ ...draft, photoMediaId: null }),
          'draft',
          draftFileRef,
        )}
        <div className="events-form-full" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn-primary"
            style={{ marginLeft: 'auto' }}
            disabled={busy || uploading !== null || !isDraftValid(draft)}
            onClick={handleCreate}
          >
            {busy ? 'Dodavanje…' : 'Dodaj alumnusa'}
          </button>
        </div>
      </div>
    </div>
  );
}
