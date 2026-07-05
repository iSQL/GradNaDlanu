import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import { clearToken } from '../lib/auth';
import { formatDateTime as formatDate } from '../lib/format';
import { SERVICE_CATEGORY_LABELS, isServiceCategory } from '../lib/usluge';
import { AuthImage } from '../components/AuthImage';
import { StartChat } from '../components/StartChat';
import type { MajstorJob, ServiceRequestQuote } from '../types';

type Tab = 'novi' | 'ponude' | 'arhiva';

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function catLabel(categoryId: string): string {
  return isServiceCategory(categoryId) ? SERVICE_CATEGORY_LABELS[categoryId] : categoryId;
}

interface OfferFormProps {
  busy: boolean;
  initial?: ServiceRequestQuote;
  onSubmit: (q: ServiceRequestQuote) => void;
}

// Forma za kontraponudu — isti oblik quote-a kao kod 1-na-1 zahteva
// (cena + najraniji termin + napomena). Prefill za izmenu postojeće ponude.
function OfferForm({ busy, initial, onSubmit }: OfferFormProps) {
  const [price, setPrice] = useState(initial ? String(initial.priceRsd) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [date, setDate] = useState(initial?.availableDate ?? todayISO());
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
        <button className="row-action" type="submit" disabled={busy}>
          {initial ? 'Izmeni ponudu' : 'Pošalji ponudu'}
        </button>
      </div>
    </form>
  );
}

function JobCard({
  job,
  busyId,
  onOffer,
  onChatSent,
}: {
  job: MajstorJob;
  busyId: number | null;
  onOffer: (jobId: number, q: ServiceRequestQuote) => void;
  onChatSent: () => void;
}) {
  // Forma za izmenu je sklopljena dok je ne otvorite — aktivna ponuda se
  // prikazuje sažeto sa dugmetom "Izmeni".
  const [editing, setEditing] = useState(false);
  const archived = job.archivedReason !== null;
  const acceptedMine = job.myOffer?.status === 'accepted';

  return (
    <div className={`usluge-job ${archived ? 'is-archived' : ''}`}>
      <div className="usluge-job-head">
        <span className="usluge-job-cat">{catLabel(job.categoryId)}</span>
        <span>· {job.requesterDisplayName}</span>
        {acceptedMine && <span className="usluge-status is-accepted">vaša ponuda je prihvaćena</span>}
        {archived && <span className="usluge-status is-archived">arhivirano</span>}
        <span className="usluge-job-date">{formatDate(job.createdAt)}</span>
      </div>

      <div className="usluge-job-desc">{job.payload.description}</div>
      {job.payload.note && <div className="usluge-job-note">Napomena: {job.payload.note}</div>}

      {job.payload.photoIds.length > 0 && (
        <div className="usluge-job-photos">
          {job.payload.photoIds.map((id) => (
            <AuthImage key={id} mediaId={id} alt={`slika kvara ${id}`} />
          ))}
        </div>
      )}

      {job.myOffer && (
        <div className={`usluge-offer ${acceptedMine ? 'is-accepted' : ''} ${job.myOffer.status === 'archived' ? 'is-archived' : ''}`}>
          <div className="usluge-offer-body">
            <div className="usluge-offer-price">
              {job.myOffer.quote.priceRsd.toLocaleString('sr-RS')} RSD
            </div>
            <div className="usluge-offer-meta">
              Vaša ponuda · termin {job.myOffer.quote.availableDate}
            </div>
            {job.myOffer.quote.note && (
              <div className="usluge-offer-note">{job.myOffer.quote.note}</div>
            )}
          </div>
          {!archived && !acceptedMine && job.status === 'open' && !editing && (
            <button className="row-action" type="button" onClick={() => setEditing(true)}>
              Izmeni
            </button>
          )}
        </div>
      )}

      {acceptedMine && (
        <div className="usluge-contact" style={{ marginTop: 10 }}>
          <span className="usluge-offer-note" style={{ marginTop: 0 }}>
            Kontaktirajte naručioca: <strong>{job.requesterDisplayName}</strong>
            {job.requesterEmail && (
              <>
                {' '}· <a href={`mailto:${job.requesterEmail}`}>{job.requesterEmail}</a>
              </>
            )}
          </span>
          {job.requesterId !== null && (
            <StartChat
              recipientId={job.requesterId}
              recipientName={job.requesterDisplayName}
              onSent={onChatSent}
            />
          )}
        </div>
      )}

      {archived && (
        <div className="usluge-archived-note">
          {job.archivedReason === 'cancelled'
            ? 'Korisnik je otkazao zahtev.'
            : 'Korisnik je već odabrao drugog majstora.'}
        </div>
      )}

      {job.status === 'open' && (!job.myOffer || editing) && (
        <OfferForm
          busy={busyId === job.id}
          initial={editing ? job.myOffer?.quote : undefined}
          onSubmit={(q) => {
            setEditing(false);
            onOffer(job.id, q);
          }}
        />
      )}
    </div>
  );
}

// /majstor — panel za majstore (rola 'majstor'): dolazni broadcast zahtevi po
// mojim kategorijama, moje ponude i arhiva (korisnik odabrao drugog / otkazao).
export function MajstorDashboard() {
  const ctx = useOutletContext<AppContext>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('novi');
  const [jobs, setJobs] = useState<MajstorJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setJobs(await api.majstorJobs());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    reload();
    // Otvaranje panela "čisti" badge novih zahteva.
    api.markSeen('majstor').then(() => ctx.reloadNotifications()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendOffer = async (jobId: number, q: ServiceRequestQuote) => {
    setBusyId(jobId);
    setError(null);
    try {
      await api.submitJobOffer(jobId, q);
      await reload();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message.includes('409') ? 'Zahtev više nije otvoren.' : message);
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const logout = async () => {
    clearToken();
    await ctx.reloadCurrentUser();
    navigate('/');
  };

  const savePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneBusy(true);
    setError(null);
    try {
      await api.updateMe({ phone: phoneDraft.trim() || null });
      await ctx.reloadCurrentUser();
      setPhoneEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPhoneBusy(false);
    }
  };

  const novi = jobs?.filter((j) => j.status === 'open' && !j.myOffer) ?? null;
  const ponude = jobs?.filter((j) => j.myOffer && j.archivedReason === null) ?? null;
  const arhiva = jobs?.filter((j) => j.archivedReason !== null) ?? null;

  const myCats = (ctx.currentUser?.majstorCategories ?? []).map(catLabel).join(', ');

  const renderList = (list: MajstorJob[] | null, empty: string) =>
    list === null ? (
      <div className="comments-empty">Učitavanje…</div>
    ) : list.length === 0 ? (
      <div className="comments-empty">{empty}</div>
    ) : (
      list.map((j) => (
        <JobCard
          key={j.id}
          job={j}
          busyId={busyId}
          onOffer={sendOffer}
          onChatSent={() => navigate('/dashboard')}
        />
      ))
    );

  return (
    <div className="account-page">
      <div className="account-shell">
        <div className="account-header">
          <div>
            <h1>Majstorski panel</h1>
            <div className="account-meta">
              {ctx.currentUser?.displayName}
              {myCats && <> · {myCats}</>}
            </div>
            {/* Kontakt telefon — prikazuje se naručiocu tek kad prihvati vašu ponudu. */}
            {phoneEditing ? (
              <form onSubmit={savePhone} className="majstor-phone-form">
                <input
                  type="tel"
                  value={phoneDraft}
                  onChange={(e) => setPhoneDraft(e.target.value)}
                  placeholder="npr. 060 123 4567"
                  maxLength={30}
                  autoFocus
                />
                <button className="row-action" type="submit" disabled={phoneBusy}>
                  {phoneBusy ? 'Čuvanje…' : 'Sačuvaj'}
                </button>
                <button className="row-action" type="button" onClick={() => setPhoneEditing(false)}>
                  Otkaži
                </button>
              </form>
            ) : (
              <div className="account-meta majstor-phone-row">
                {ctx.currentUser?.phone
                  ? <>☎ {ctx.currentUser.phone}</>
                  : <>Bez kontakt telefona — naručioci ga vide kad prihvate vašu ponudu.</>}
                <button
                  className="row-action"
                  type="button"
                  onClick={() => {
                    setPhoneDraft(ctx.currentUser?.phone ?? '');
                    setPhoneEditing(true);
                  }}
                >
                  {ctx.currentUser?.phone ? 'Izmeni' : 'Dodaj telefon'}
                </button>
              </div>
            )}
          </div>
          <button className="nav-btn" onClick={logout}>Odjavi se</button>
        </div>

        <div className="account-tabs">
          <button className={`account-tab ${tab === 'novi' ? 'active' : ''}`} onClick={() => setTab('novi')}>
            Novi zahtevi {novi && `· ${novi.length}`}
          </button>
          <button className={`account-tab ${tab === 'ponude' ? 'active' : ''}`} onClick={() => setTab('ponude')}>
            Moje ponude {ponude && `· ${ponude.length}`}
          </button>
          <button className={`account-tab ${tab === 'arhiva' ? 'active' : ''}`} onClick={() => setTab('arhiva')}>
            Arhiva {arhiva && `· ${arhiva.length}`}
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        {tab === 'novi' && renderList(novi, 'Nema novih zahteva u vašim kategorijama.')}
        {tab === 'ponude' && renderList(ponude, 'Još niste poslali nijednu ponudu.')}
        {tab === 'arhiva' && renderList(arhiva, 'Arhiva je prazna.')}
      </div>
    </div>
  );
}
