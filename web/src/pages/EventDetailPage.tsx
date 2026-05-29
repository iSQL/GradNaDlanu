import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import { TimeSelect } from '../components/TimeSelect';
import { DateInput } from '../components/DateInput';
import { formatDateTimeRange } from '../lib/format';
import type { CityEvent } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

function splitIso(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

const DEFAULT_TIME = '08:00';
function combine(date: string, time: string): string | null {
  if (!date) return null;
  const t = time || DEFAULT_TIME;
  const merged = new Date(`${date}T${t}`);
  if (Number.isNaN(merged.getTime())) return null;
  return merged.toISOString();
}

interface DraftEvent {
  title: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

export function EventDetailPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useOutletContext<AppContext>();

  const [item, setItem] = useState<CityEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DraftEvent | null>(null);
  const [busy, setBusy] = useState(false);

  const id = Number(idParam);

  useEffect(() => {
    if (!Number.isFinite(id)) {
      setError('Neispravan id događaja.');
      return;
    }
    setItem(null);
    setError(null);
    api
      .getEvent(id)
      .then(setItem)
      .catch((err: Error) => {
        if (err.message.startsWith('404')) setError('Događaj nije pronađen ili je uklonjen.');
        else setError(err.message);
      });
  }, [id]);

  const canManage =
    item !== null &&
    !!currentUser &&
    (currentUser.role === 'admin' || currentUser.ownedLocationIds.includes(item.locationId));

  const startEdit = () => {
    if (!item) return;
    const s = splitIso(item.startsAt);
    const e = item.endsAt ? splitIso(item.endsAt) : { date: '', time: '' };
    setEditing({
      title: item.title,
      description: item.description ?? '',
      startDate: s.date,
      startTime: s.time,
      endDate: e.date,
      endTime: e.time,
    });
  };

  const handleSave = async () => {
    if (!item || !editing) return;
    const startsAt = combine(editing.startDate, editing.startTime);
    if (!editing.title.trim() || !startsAt) {
      setError('Naslov i datum početka su obavezni.');
      return;
    }
    const endsAt = editing.endDate || editing.endTime
      ? combine(editing.endDate || editing.startDate, editing.endTime || editing.startTime)
      : null;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.ownerUpdateEvent(item.id, {
        title: editing.title,
        description: editing.description || null,
        startsAt,
        endsAt,
      });
      setItem({
        ...item,
        title: updated.title,
        description: updated.description,
        startsAt: updated.startsAt,
        endsAt: updated.endsAt,
      });
      setEditing(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    if (!confirm(`Obrisati događaj "${item.title}"? Ova radnja je trajna.`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.ownerDeleteEvent(item.id);
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
          <span className="tile-kind kind-event">Događaj</span>
          <span className="detail-date">{formatDateTimeRange(item.startsAt, item.endsAt)}</span>
        </div>

        {editing ? (
          <div className="detail-edit">
            <input
              className="field-input detail-edit-title"
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              placeholder="Naslov"
            />
            <div className="detail-edit-grid">
              <label>
                <span className="field-label">Početak</span>
                <div className="detail-edit-dt">
                  <DateInput
                    value={editing.startDate}
                    onChange={(v) => setEditing({ ...editing, startDate: v })}
                  />
                  <TimeSelect
                    value={editing.startTime}
                    onChange={(v) => setEditing({ ...editing, startTime: v })}
                  />
                </div>
              </label>
              <label>
                <span className="field-label">Kraj (opciono)</span>
                <div className="detail-edit-dt">
                  <DateInput
                    value={editing.endDate}
                    onChange={(v) => setEditing({ ...editing, endDate: v })}
                  />
                  <TimeSelect
                    value={editing.endTime}
                    onChange={(v) => setEditing({ ...editing, endTime: v })}
                  />
                </div>
              </label>
            </div>
            <textarea
              className="field-input"
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              placeholder="Opis (opciono)"
              rows={6}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div className="detail-edit-actions">
              <div className="detail-edit-buttons" style={{ marginLeft: 'auto' }}>
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
            {item.description && <div className="detail-body">{item.description}</div>}

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
