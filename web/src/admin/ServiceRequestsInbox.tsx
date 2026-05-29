import { useEffect, useState } from 'react';
import { api, mediaUrl } from '../lib/api';
import { formatDateTime as formatDate } from '../lib/format';
import type { OwnerServiceRequest, ServiceRequestQuote, ServiceRequestStatus } from '../types';

const STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  pending: 'na čekanju',
  quoted: 'poslata ponuda',
  accepted: 'prihvaćeno',
  declined: 'odbijeno',
  cancelled: 'otkazano',
  completed: 'završeno',
};

const STATUS_FILTERS: Array<{ key: ServiceRequestStatus | 'all'; label: string }> = [
  { key: 'pending',   label: 'Na čekanju' },
  { key: 'quoted',    label: 'Poslata ponuda' },
  { key: 'accepted',  label: 'Prihvaćeno' },
  { key: 'completed', label: 'Završeno' },
  { key: 'declined',  label: 'Odbijeno' },
  { key: 'cancelled', label: 'Otkazano' },
  { key: 'all',       label: 'Sve' },
];

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

interface QuoteFormProps {
  busy: boolean;
  onSubmit: (q: ServiceRequestQuote) => void;
  onDecline: () => void;
}

function QuoteForm({ busy, onSubmit, onDecline }: QuoteFormProps) {
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = Number(price);
    if (!Number.isFinite(p) || p < 0) return;
    onSubmit({ priceRsd: p, note: note.trim(), availableDate: date });
  };
  return (
    <form onSubmit={submit} className="quote-form">
      <div className="quote-form-row">
        <label className="majstor-label">
          <span>Cena (RSD)</span>
          <input
            type="number"
            min={0}
            step={100}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </label>
        <label className="majstor-label">
          <span>Najraniji termin</span>
          <input
            type="date"
            value={date}
            min={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
      </div>
      <label className="majstor-label">
        <span>Napomena za korisnika</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="npr. Cena uključuje dolazak i delove. Potrebno je oko 2 sata rada."
        />
      </label>
      <div className="reservation-actions">
        <button className="row-action" type="submit" disabled={busy}>Pošalji ponudu</button>
        <button className="row-action danger" type="button" disabled={busy} onClick={onDecline}>Odbij</button>
      </div>
    </form>
  );
}

export function ServiceRequestsInbox() {
  const [filter, setFilter] = useState<ServiceRequestStatus | 'all'>('pending');
  const [rows, setRows] = useState<OwnerServiceRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const reload = async () => {
    setError(null);
    try {
      const next = await api.ownerServiceRequests(filter === 'all' ? {} : { status: filter });
      setRows(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const sendQuote = async (id: number, q: ServiceRequestQuote) => {
    setBusyId(id);
    setError(null);
    try {
      await api.ownerQuoteServiceRequest(id, q);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const decline = async (id: number) => {
    if (!window.confirm('Odbiti ovaj zahtev?')) return;
    setBusyId(id);
    setError(null);
    try {
      await api.ownerDeclineServiceRequest(id);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const complete = async (id: number) => {
    setBusyId(id);
    setError(null);
    try {
      await api.ownerCompleteServiceRequest(id);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
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
          <div className="comments-empty">Nema zahteva u ovoj kategoriji.</div>
        ) : (
          rows.map((r) => (
            <div className={`service-request-card status-${r.status}`} key={r.id}>
              <div className="service-request-head">
                <div>
                  <div className="favorite-name">{r.locationName} · zahtev #{r.id}</div>
                  <div className="favorite-meta">
                    {r.userDisplayName} ({r.userEmail}) · poslato {formatDate(r.createdAt)}
                  </div>
                </div>
                <div className={`reservation-status status-${r.status}`}>{STATUS_LABELS[r.status]}</div>
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
                  <div className="favorite-meta">Vaša ponuda:</div>
                  <div><strong>{r.quote.priceRsd.toLocaleString('sr-RS')} RSD</strong> · termin {r.quote.availableDate}</div>
                  {r.quote.note && <div className="favorite-meta">{r.quote.note}</div>}
                </div>
              )}

              {r.status === 'pending' && (
                <QuoteForm
                  busy={busyId === r.id}
                  onSubmit={(q) => sendQuote(r.id, q)}
                  onDecline={() => decline(r.id)}
                />
              )}
              {r.status === 'quoted' && (
                <div className="favorite-meta">Čeka se odluka korisnika.</div>
              )}
              {r.status === 'accepted' && (
                <div className="reservation-actions">
                  <button className="row-action" disabled={busyId === r.id} onClick={() => complete(r.id)}>
                    Označi kao završeno
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
