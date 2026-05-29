import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatDateTime, formatTime } from '../lib/format';
import type { OwnerReservation } from '../types';

const STATUS_LABELS: Record<OwnerReservation['status'], string> = {
  pending: 'na čekanju',
  approved: 'odobreno',
  declined: 'odbijeno',
  cancelled: 'otkazano',
};

const STATUS_FILTERS: Array<{ key: OwnerReservation['status'] | 'all'; label: string }> = [
  { key: 'pending',   label: 'Na čekanju' },
  { key: 'approved',  label: 'Odobrene' },
  { key: 'declined',  label: 'Odbijene' },
  { key: 'cancelled', label: 'Otkazane' },
  { key: 'all',       label: 'Sve' },
];

const formatDate = formatDateTime;

function describePayload(r: OwnerReservation): string {
  const p = r.payload as unknown as Record<string, string | number>;
  if (r.locationCatId === 'cafe') {
    return `Sto #${p.tableId} · ${formatDateTime(String(p.slotStart))}–${formatTime(String(p.slotEnd))} · ${p.guests} gostiju`;
  }
  if (r.locationCatId === 'hotel') {
    return `Soba ${p.roomKey} · ${p.dateFrom} → ${p.dateTo} · ${p.guests} gostiju`;
  }
  return JSON.stringify(p);
}

interface Props {
  // When set, scopes the inbox to a single location (used from per-object edit pages).
  locationId?: number;
}

export function ReservationsInbox({ locationId }: Props = {}) {
  const [filter, setFilter] = useState<OwnerReservation['status'] | 'all'>('pending');
  const [rows, setRows] = useState<OwnerReservation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setError(null);
    try {
      const params: { status?: OwnerReservation['status']; locationId?: number } = {};
      if (filter !== 'all') params.status = filter;
      if (locationId !== undefined) params.locationId = locationId;
      const next = await api.ownerReservations(params);
      setRows(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, locationId]);

  const decide = async (id: number, status: 'approved' | 'declined') => {
    setBusy(true);
    setError(null);
    try {
      await api.ownerDecideReservation(id, status);
      await reload();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('409')) setError('Termin više nije dostupan — neko je već rezervisao.');
      else setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="inbox-filter">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`time-chip ${filter === f.key ? 'selected' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="login-error">{error}</div>}

      <div className="account-comments">
        {rows === null ? (
          <div className="comments-empty">Učitavanje…</div>
        ) : rows.length === 0 ? (
          <div className="comments-empty">Nema rezervacija u ovoj kategoriji.</div>
        ) : (
          rows.map((r) => (
            <div className={`reservation-row status-${r.status}`} key={r.id}>
              <div className="reservation-main">
                <div className="favorite-name">{r.locationName}</div>
                <div className="favorite-meta">{describePayload(r)}</div>
                <div className="favorite-meta">
                  {r.userDisplayName} ({r.userEmail}) · poslato {formatDate(r.createdAt)}
                </div>
              </div>
              <div className={`reservation-status status-${r.status}`}>{STATUS_LABELS[r.status]}</div>
              {r.status === 'pending' && (
                <div className="reservation-actions">
                  <button className="row-action" disabled={busy} onClick={() => decide(r.id, 'approved')}>Odobri</button>
                  <button className="row-action danger" disabled={busy} onClick={() => decide(r.id, 'declined')}>Odbij</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
