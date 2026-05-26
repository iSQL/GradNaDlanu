import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { CityEvent } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

function splitIso(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function combine(date: string, time: string): string | null {
  if (!date || !time) return null;
  const merged = new Date(`${date}T${time}`);
  if (Number.isNaN(merged.getTime())) return null;
  return merged.toISOString();
}

function formatRange(start: string, end: string | null): string {
  const fmt = (iso: string) => new Date(iso).toLocaleString('sr-Latn-RS', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  if (!end) return fmt(start);
  return `${fmt(start)} → ${new Date(end).toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit' })}`;
}

interface DraftEvent {
  id?: number;
  title: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

const EMPTY: DraftEvent = {
  title: '', description: '',
  startDate: '', startTime: '',
  endDate: '', endTime: '',
};

interface Props {
  locationId: number;
}

function DateTimeFields({
  label, date, time, onDate, onTime,
}: {
  label: string;
  date: string;
  time: string;
  onDate: (v: string) => void;
  onTime: (v: string) => void;
}) {
  return (
    <div>
      <div className="field-label" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 6 }}>
        <input
          className="field-input"
          type="date"
          value={date}
          onChange={(e) => onDate(e.target.value)}
        />
        <input
          className="field-input"
          type="time"
          step={300}
          value={time}
          onChange={(e) => onTime(e.target.value)}
        />
      </div>
    </div>
  );
}

export function OwnerEventsEditor({ locationId }: Props) {
  const [events, setEvents] = useState<CityEvent[] | null>(null);
  const [includePast, setIncludePast] = useState(false);
  const [draft, setDraft] = useState<DraftEvent>(EMPTY);
  const [editing, setEditing] = useState<DraftEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setError(null);
    api.ownerListEvents({ locationId, includePast })
      .then(setEvents)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    setEvents(null);
    api.ownerListEvents({ locationId, includePast })
      .then(setEvents)
      .catch((err: Error) => setError(err.message));
  }, [locationId, includePast]);

  const handleCreate = async () => {
    const startsAt = combine(draft.startDate, draft.startTime);
    if (!draft.title.trim() || !startsAt) {
      setError('Naslov, datum i vreme početka su obavezni.');
      return;
    }
    const endsAt = draft.endDate || draft.endTime
      ? combine(draft.endDate || draft.startDate, draft.endTime || draft.startTime)
      : null;
    setBusy(true);
    setError(null);
    try {
      await api.ownerCreateEvent({
        locationId,
        title: draft.title,
        description: draft.description || null,
        startsAt,
        endsAt,
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
    const startsAt = combine(editing.startDate, editing.startTime);
    if (!editing.title.trim() || !startsAt) {
      setError('Naslov, datum i vreme početka su obavezni.');
      return;
    }
    const endsAt = editing.endDate || editing.endTime
      ? combine(editing.endDate || editing.startDate, editing.endTime || editing.startTime)
      : null;
    setBusy(true);
    setError(null);
    try {
      await api.ownerUpdateEvent(editing.id, {
        title: editing.title,
        description: editing.description || null,
        startsAt,
        endsAt,
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
    if (!confirm('Obrisati ovaj događaj?')) return;
    setBusy(true);
    setError(null);
    try {
      await api.ownerDeleteEvent(id);
      reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="events-editor">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="field-label" style={{ margin: 0 }}>Predstojeći događaji</div>
        <label style={{ fontSize: 12, color: 'var(--ink-2)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={includePast} onChange={(e) => setIncludePast(e.target.checked)} />
          Prikaži i prošle
        </label>
      </div>

      {error && <div className="login-error">{error}</div>}

      {events === null ? (
        <div className="home-skeleton-list">
          <div className="home-skeleton-row" />
          <div className="home-skeleton-row" />
        </div>
      ) : events.length === 0 ? (
        <div className="comments-empty" style={{ padding: 16, fontSize: 13 }}>Nema još događaja.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map((e) => {
            const isEditing = editing?.id === e.id;
            if (isEditing && editing) {
              return (
                <div key={e.id} className="events-form">
                  <input
                    className="field-input events-form-full"
                    value={editing.title}
                    onChange={(ev) => setEditing({ ...editing, title: ev.target.value })}
                    placeholder="Naslov"
                  />
                  <DateTimeFields
                    label="Početak"
                    date={editing.startDate}
                    time={editing.startTime}
                    onDate={(v) => setEditing({ ...editing, startDate: v })}
                    onTime={(v) => setEditing({ ...editing, startTime: v })}
                  />
                  <DateTimeFields
                    label="Kraj (opciono)"
                    date={editing.endDate}
                    time={editing.endTime}
                    onDate={(v) => setEditing({ ...editing, endDate: v })}
                    onTime={(v) => setEditing({ ...editing, endTime: v })}
                  />
                  <textarea
                    className="field-input events-form-full"
                    value={editing.description}
                    onChange={(ev) => setEditing({ ...editing, description: ev.target.value })}
                    placeholder="Opis (opciono)"
                    rows={2}
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                  <div className="events-form-full" style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button type="button" className="nav-btn" disabled={busy} onClick={() => setEditing(null)}>Otkaži</button>
                    <button type="button" className="btn-primary" disabled={busy} onClick={handleSave}>Sačuvaj</button>
                  </div>
                </div>
              );
            }
            return (
              <div key={e.id} className="events-editor-row">
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{e.title}</div>
                  <div className="events-editor-meta">{formatRange(e.startsAt, e.endsAt)}</div>
                  {e.description && (
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 6 }}>{e.description}</div>
                  )}
                </div>
                <div className="events-editor-actions">
                  <button
                    type="button"
                    className="nav-btn"
                    disabled={busy}
                    onClick={() => {
                      const s = splitIso(e.startsAt);
                      const en = e.endsAt ? splitIso(e.endsAt) : { date: '', time: '' };
                      setEditing({
                        id: e.id,
                        title: e.title,
                        description: e.description ?? '',
                        startDate: s.date,
                        startTime: s.time,
                        endDate: en.date,
                        endTime: en.time,
                      });
                    }}
                  >
                    Uredi
                  </button>
                  <button type="button" className="nav-btn" disabled={busy} onClick={() => handleDelete(e.id)}>Obriši</button>
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
          placeholder="Naslov novog događaja"
        />
        <DateTimeFields
          label="Početak"
          date={draft.startDate}
          time={draft.startTime}
          onDate={(v) => setDraft({ ...draft, startDate: v })}
          onTime={(v) => setDraft({ ...draft, startTime: v })}
        />
        <DateTimeFields
          label="Kraj (opciono)"
          date={draft.endDate}
          time={draft.endTime}
          onDate={(v) => setDraft({ ...draft, endDate: v })}
          onTime={(v) => setDraft({ ...draft, endTime: v })}
        />
        <textarea
          className="field-input events-form-full"
          value={draft.description}
          onChange={(ev) => setDraft({ ...draft, description: ev.target.value })}
          placeholder="Opis (opciono)"
          rows={2}
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
        />
        <div className="events-form-full" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !draft.title.trim() || !draft.startDate || !draft.startTime}
            onClick={handleCreate}
          >
            {busy ? 'Dodavanje…' : 'Dodaj događaj'}
          </button>
        </div>
      </div>
    </div>
  );
}
