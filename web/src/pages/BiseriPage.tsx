import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api, mediaUrl } from '../lib/api';
import { SELA_ZABARI } from '../lib/villages';
import {
  biserThumbGradient,
  decadeLabel,
  decadeOf,
  fotografijaSuffix,
  storyParagraphs,
} from '../lib/biseri';
import { formatDate } from '../lib/format';
import type { Biser, BiserDetail } from '../types';

const BiseriOverviewMap = lazy(() =>
  import('../components/BiseriMap').then((m) => ({ default: m.BiseriOverviewMap })),
);
const BiserLocationPicker = lazy(() =>
  import('../components/BiseriMap').then((m) => ({ default: m.BiserLocationPicker })),
);

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function IconCamera({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M8 5l1.5-2h5L16 5" />
    </svg>
  );
}

function IconHeart({ size = 14, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2 5 5.2 5c2 0 3.3 1.1 4.1 2.3h1.4C11.5 6.1 12.8 5 14.8 5 18 5 19.6 8.4 22 11.7 19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

function IconComment({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function BiseriPage() {
  const ctx = useOutletContext<AppContext>();
  const navigate = useNavigate();

  const [biseri, setBiseri] = useState<Biser[] | null>(null);
  const [decade, setDecade] = useState<string>('all');
  const [village, setVillage] = useState<string>('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const reload = async () => {
    try {
      setBiseri(await api.listBiseri());
    } catch {
      setBiseri([]);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  // Čipovi decenija — dinamički iz učitanih bisera, hronološki.
  const decades = useMemo(() => {
    const set = new Set<string>();
    for (const b of biseri ?? []) set.add(decadeOf(b.year));
    return [...set].sort();
  }, [biseri]);

  const filtered = useMemo(
    () =>
      (biseri ?? []).filter(
        (b) =>
          (decade === 'all' || decadeOf(b.year) === decade) &&
          (!village || b.village === village),
      ),
    [biseri, decade, village],
  );

  const openAdd = () => {
    if (!ctx.currentUser) {
      navigate('/prijava');
      return;
    }
    setAddOpen(true);
  };

  return (
    <div className="page biseri-page">
      <div className="page-shell">
        <header className="biseri-header">
          <div className="biseri-kicker">Objekti · Mapa sećanja</div>
          <h1 className="biseri-title">Zaboravljeni biseri</h1>
          <p className="biseri-lead">
            Mapa sećanja opštine Žabari. Stariji sugrađani i lokalni entuzijasti postavljaju stare
            fotografije na tačna mesta gde su snimljene — uz kratku priču ili anegdotu. Kliknite na
            fotografiju da vidite priču i uporedite „nekad i sad“.
          </p>
        </header>

        <div className="biseri-filters">
          <div className="biseri-filter-group">
            <span className="biseri-filter-label">Doba</span>
            <div className="biseri-chips">
              <button
                className={`biseri-chip ${decade === 'all' ? 'is-active' : ''}`}
                onClick={() => setDecade('all')}
              >
                Sve
              </button>
              {decades.map((d) => (
                <button
                  key={d}
                  className={`biseri-chip ${decade === d ? 'is-active' : ''}`}
                  onClick={() => setDecade(d)}
                >
                  {decadeLabel(d)}
                </button>
              ))}
            </div>
          </div>
          <label className="biseri-filter-group">
            <span className="biseri-filter-label">Selo</span>
            <select
              className="ms-field-input"
              value={village}
              onChange={(e) => setVillage(e.target.value)}
            >
              <option value="">Sva sela</option>
              {SELA_ZABARI.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-primary biseri-add-btn" onClick={openAdd}>
            + Dodaj staru fotografiju
          </button>
        </div>

        <div className="biseri-map-wrap">
          <Suspense fallback={<div className="prb-map-loading">Učitavanje mape…</div>}>
            <BiseriOverviewMap biseri={filtered} onPinClick={(b) => setSelectedId(b.id)} />
          </Suspense>
          <div className="biseri-map-panel">
            <div className="biseri-panel-kicker">Biseri na mapi</div>
            <div className="biseri-panel-count">
              <span className="biseri-panel-num">{filtered.length}</span>
              <span>fotografij{fotografijaSuffix(filtered.length)}</span>
            </div>
            <div className="biseri-panel-sep" />
            <div className="biseri-panel-legend">
              <span className="biseri-panel-swatch" />
              Označava staru fotografiju
            </div>
          </div>
          <div className="biseri-map-hint">Kliknite na fotografiju da otvorite priču</div>
        </div>

        <section className="biseri-recent">
          <div className="biseri-recent-head">
            Nedavno dodato
            <span className="biseri-recent-rule" />
          </div>
          {biseri === null ? (
            <div className="comments-empty">Učitavanje…</div>
          ) : filtered.length === 0 ? (
            <div className="comments-empty">
              Još nema bisera za izabrane filtere. Budite prvi — dodajte staru fotografiju.
            </div>
          ) : (
            <ul className="biseri-grid">
              {filtered.map((b) => (
                <li key={b.id} className="biseri-card">
                  <button className="biseri-card-btn" onClick={() => setSelectedId(b.id)}>
                    <div
                      className="biseri-card-thumb"
                      style={
                        b.photoMediaId
                          ? { backgroundImage: `url('${mediaUrl(b.photoMediaId)}')` }
                          : { background: biserThumbGradient(b) }
                      }
                    >
                      {!b.photoMediaId && (
                        <span className="biseri-card-glyph">
                          <IconCamera size={34} />
                        </span>
                      )}
                      <span className="biseri-card-year">{b.year}.</span>
                    </div>
                    <div className="biseri-card-body">
                      <div className="biseri-card-title">{b.title}</div>
                      <div className="biseri-card-meta">
                        {b.village}
                        {b.contributorName ? ` · ${b.contributorName}` : ''}
                      </div>
                      <div className="biseri-card-stats">
                        <span className="biseri-card-likes">
                          <IconHeart filled /> {b.likes}
                        </span>
                        <span>
                          <IconComment /> {b.commentCount}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {selectedId !== null && (
        <BiserDetailModal
          id={selectedId}
          currentUser={ctx.currentUser}
          onClose={() => setSelectedId(null)}
          onChanged={reload}
        />
      )}

      {addOpen && (
        <AddBiserModal
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            setAddOpen(false);
            setToast('Hvala! Predlog je poslat kustosu sela na odobrenje.');
          }}
        />
      )}

      {toast && (
        <div className="biseri-toast" role="status" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Detaljni prikaz (modal) ──────────────────────────────────────────────────

function BiserDetailModal({
  id,
  currentUser,
  onClose,
  onChanged,
}: {
  id: number;
  currentUser: AppContext['currentUser'];
  onClose: () => void;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [biser, setBiser] = useState<BiserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thenNow, setThenNow] = useState<'then' | 'now'>('then');
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [nowBusy, setNowBusy] = useState(false);
  const nowFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBiser(null);
    setThenNow('then');
    api
      .getBiser(id)
      .then(setBiser)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [id]);

  const toggleLike = async () => {
    if (!currentUser) {
      navigate('/prijava');
      return;
    }
    if (!biser) return;
    const r = await api.likeBiser(biser.id);
    setBiser({ ...biser, liked: r.liked, likes: r.likes });
    onChanged();
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!biser || !comment.trim()) return;
    setSending(true);
    try {
      const c = await api.commentBiser(biser.id, comment.trim());
      setBiser({ ...biser, comments: [...biser.comments, c], commentCount: biser.commentCount + 1 });
      setComment('');
      onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  // Naknadni "Danas" snimak — dozvoljeno autoru i moderatoru (canEdit sa servera).
  const onPickNowPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !biser) return;
    if (file.size > MAX_PHOTO_BYTES) {
      setError('Slika je veća od 5 MB.');
      return;
    }
    setError(null);
    setNowBusy(true);
    try {
      const up = await api.uploadBiserPhoto(file);
      await api.setBiserNowPhoto(biser.id, up.id);
      setBiser({ ...biser, nowPhotoMediaId: up.id });
      setThenNow('now');
      onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setNowBusy(false);
    }
  };

  const removeNowPhoto = async () => {
    if (!biser) return;
    setError(null);
    setNowBusy(true);
    try {
      await api.setBiserNowPhoto(biser.id, null);
      setBiser({ ...biser, nowPhotoMediaId: null });
      setThenNow('then');
      onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setNowBusy(false);
    }
  };

  const hasNow = !!biser?.nowPhotoMediaId;
  const initial = biser?.contributorName?.charAt(0).toUpperCase() ?? '?';

  return (
    <div className="biseri-overlay" onClick={onClose}>
      <div className="biseri-detail" onClick={(e) => e.stopPropagation()}>
        {!biser ? (
          <div className="biseri-detail-loading">{error ?? 'Učitavanje…'}</div>
        ) : (
          <>
            <div className="biseri-detail-photo">
              <div
                className="biseri-detail-layer"
                style={{
                  opacity: thenNow === 'then' ? 1 : 0,
                  ...(biser.photoMediaId
                    ? { backgroundImage: `url('${mediaUrl(biser.photoMediaId)}')` }
                    : { background: biserThumbGradient(biser) }),
                }}
              />
              {hasNow && (
                <div
                  className="biseri-detail-layer"
                  style={{
                    opacity: thenNow === 'now' ? 1 : 0,
                    backgroundImage: `url('${mediaUrl(biser.nowPhotoMediaId!)}')`,
                  }}
                />
              )}
              {hasNow && (
                <div className="biseri-thennow">
                  <button
                    className={`biseri-thennow-btn ${thenNow === 'then' ? 'is-active' : ''}`}
                    onClick={() => setThenNow('then')}
                  >
                    Nekad
                  </button>
                  <button
                    className={`biseri-thennow-btn ${thenNow === 'now' ? 'is-active' : ''}`}
                    onClick={() => setThenNow('now')}
                  >
                    Danas
                  </button>
                </div>
              )}
              {biser.canEdit && (
                <>
                  <input
                    ref={nowFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={onPickNowPhoto}
                    style={{ display: 'none' }}
                  />
                  {!hasNow ? (
                    <button
                      className="biseri-now-edit"
                      disabled={nowBusy}
                      onClick={() => nowFileRef.current?.click()}
                      title="Dodajte fotografiju istog kadra iz današnjeg vremena"
                    >
                      <IconCamera /> {nowBusy ? 'Otpremanje…' : 'Dodaj današnji snimak'}
                    </button>
                  ) : (
                    <button
                      className="biseri-now-edit"
                      disabled={nowBusy}
                      onClick={removeNowPhoto}
                      title="Ukloni današnji snimak"
                    >
                      {nowBusy ? 'Uklanjanje…' : 'Ukloni današnji'}
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="biseri-detail-body">
              <div className="biseri-detail-top">
                <span className="biseri-detail-kicker">
                  {decadeLabel(decadeOf(biser.year))} · {biser.village}
                </span>
                <button className="biseri-close" onClick={onClose} aria-label="Zatvori">
                  ×
                </button>
              </div>
              <h2 className="biseri-detail-title">{biser.title}</h2>
              <div className="biseri-detail-year">{biser.year}. godina</div>
              <div className="biseri-detail-story">
                {storyParagraphs(biser.story).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <div className="biseri-detail-foot">
                <span className="biseri-avatar">{initial}</span>
                <div className="biseri-detail-contributor">
                  <div className="biseri-contributor-name">
                    {biser.contributorName ?? 'Nepoznat autor'}
                  </div>
                  <div className="biseri-contributor-sub">
                    Postavio/la · {formatDate(biser.createdAt)}
                  </div>
                </div>
                <button
                  className={`biseri-like-btn ${biser.liked ? 'is-liked' : ''}`}
                  onClick={toggleLike}
                  title={currentUser ? 'Sviđa mi se' : 'Prijavite se da biste lajkovali'}
                >
                  <IconHeart size={15} filled={biser.liked} /> {biser.likes}
                </button>
              </div>

              <div className="biseri-comments">
                <div className="biseri-comments-head">
                  Komentari {biser.comments.length > 0 && `· ${biser.comments.length}`}
                </div>
                {biser.comments.length === 0 && (
                  <div className="biseri-comments-empty">Još nema komentara.</div>
                )}
                {biser.comments.map((c) => (
                  <div key={c.id} className="biseri-comment">
                    <div className="biseri-comment-meta">
                      <strong>{c.author.displayName}</strong> · {formatDate(c.createdAt)}
                    </div>
                    <div className="biseri-comment-body">{c.body}</div>
                  </div>
                ))}
                {currentUser ? (
                  <form className="biseri-comment-form" onSubmit={submitComment}>
                    <input
                      className="ms-field-input"
                      value={comment}
                      maxLength={1000}
                      placeholder="Podelite sećanje ili dopunu…"
                      onChange={(e) => setComment(e.target.value)}
                    />
                    <button className="btn-primary" disabled={sending || !comment.trim()}>
                      Pošalji
                    </button>
                  </form>
                ) : (
                  <div className="biseri-comments-empty">
                    <a href="/prijava">Prijavite se</a> da biste komentarisali.
                  </div>
                )}
              </div>
              {error && <div className="ms-error">{error}</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Forma "Dodaj biser" (modal) ──────────────────────────────────────────────

function AddBiserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const currentYear = new Date().getFullYear();
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [village, setVillage] = useState<string>(SELA_ZABARI[0]);
  const [story, setStory] = useState('');
  const [latlng, setLatlng] = useState<{ lat: number; lng: number } | null>(null);
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [nowPhoto, setNowPhoto] = useState<{ file: File; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const nowRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.url);
      if (nowPhoto) URL.revokeObjectURL(nowPhoto.url);
    };
    // Revoke tek na unmount — objectURL-ovi žive dok je modal otvoren.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickFile =
    (setter: (v: { file: File; url: string } | null) => void, prev: { url: string } | null) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (file.size > MAX_PHOTO_BYTES) {
        setError('Slika je veća od 5 MB.');
        return;
      }
      if (prev) URL.revokeObjectURL(prev.url);
      setter({ file, url: URL.createObjectURL(file) });
    };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const y = Number(year);
    if (!photo) return setError('Otpremite skeniranu staru fotografiju.');
    if (title.trim().length < 4) return setError('Unesite naslov (najmanje 4 karaktera).');
    if (!Number.isInteger(y) || y < 1850 || y > currentYear) {
      return setError(`Godina mora biti između 1850. i ${currentYear}.`);
    }
    if (story.trim().length < 10) return setError('Unesite priču ili anegdotu uz fotografiju.');
    if (!latlng) return setError('Kliknite na mapu da postavite tačno mesto snimka.');

    setSubmitting(true);
    try {
      const up = await api.uploadBiserPhoto(photo.file);
      let nowPhotoMediaId: number | null = null;
      if (nowPhoto) {
        const nowUp = await api.uploadBiserPhoto(nowPhoto.file);
        nowPhotoMediaId = nowUp.id;
      }
      await api.createBiser({
        title: title.trim(),
        year: y,
        village,
        story: story.trim(),
        lat: latlng.lat,
        lng: latlng.lng,
        photoMediaId: up.id,
        nowPhotoMediaId,
      });
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.startsWith('429') ? 'Previše predloga — pokušajte ponovo za sat vremena.' : msg,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="biseri-overlay" onClick={onClose}>
      <form className="biseri-add" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="biseri-detail-top">
          <div>
            <h2 className="biseri-add-title">Dodaj biser</h2>
            <p className="biseri-add-sub">
              Podeli staru fotografiju sa pričom. Predlog ide kustosu sela na odobrenje.
            </p>
          </div>
          <button type="button" className="biseri-close" onClick={onClose} aria-label="Zatvori">
            ×
          </button>
        </div>

        <input
          ref={photoRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={pickFile(setPhoto, photo)}
          style={{ display: 'none' }}
        />
        <input
          ref={nowRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={pickFile(setNowPhoto, nowPhoto)}
          style={{ display: 'none' }}
        />

        <div className="biseri-add-photos">
          <button
            type="button"
            className="biseri-photo-drop"
            style={photo ? { backgroundImage: `url('${photo.url}')` } : undefined}
            onClick={() => photoRef.current?.click()}
          >
            {!photo && (
              <span>
                <IconCamera size={22} />
                <br />
                Skenirana stara fotografija *
              </span>
            )}
          </button>
          <button
            type="button"
            className="biseri-photo-drop"
            style={nowPhoto ? { backgroundImage: `url('${nowPhoto.url}')` } : undefined}
            onClick={() => nowRef.current?.click()}
          >
            {!nowPhoto && (
              <span>
                <IconCamera size={22} />
                <br />
                Današnji snimak istog kadra (opciono)
              </span>
            )}
          </button>
        </div>

        <label className="biseri-add-field">
          <span className="biseri-filter-label">Naslov</span>
          <input
            className="ms-field-input"
            value={title}
            maxLength={120}
            placeholder="npr. Pijaca na Trgu"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div className="biseri-add-row">
          <label className="biseri-add-field biseri-add-year">
            <span className="biseri-filter-label">Godina</span>
            <input
              className="ms-field-input"
              value={year}
              inputMode="numeric"
              maxLength={4}
              placeholder="1963"
              onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))}
            />
          </label>
          <label className="biseri-add-field" style={{ flex: 1 }}>
            <span className="biseri-filter-label">Selo</span>
            <select
              className="ms-field-input"
              value={village}
              onChange={(e) => setVillage(e.target.value)}
            >
              {SELA_ZABARI.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="biseri-add-field">
          <span className="biseri-filter-label">Priča / anegdota</span>
          <textarea
            className="ms-field-input"
            rows={4}
            value={story}
            maxLength={4000}
            placeholder="Šta se dešavalo na ovom mestu? Ko je na fotografiji?"
            onChange={(e) => setStory(e.target.value)}
          />
        </label>

        <div className="biseri-add-field">
          <span className="biseri-filter-label">Mesto snimka — kliknite na mapu</span>
          <div className="biseri-picker-map">
            <Suspense fallback={<div className="prb-map-loading">Učitavanje mape…</div>}>
              <BiserLocationPicker latlng={latlng} onPick={setLatlng} />
            </Suspense>
          </div>
          <span className="biseri-coords">
            📍{' '}
            {latlng
              ? `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`
              : 'mesto snimka nije postavljeno'}
          </span>
        </div>

        {error && <div className="ms-error">{error}</div>}

        <div className="biseri-add-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Otkaži
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Slanje…' : 'Pošalji na odobrenje'}
          </button>
        </div>
      </form>
    </div>
  );
}
