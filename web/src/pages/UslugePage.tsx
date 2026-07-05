import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import {
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_EXAMPLES,
  SERVICE_CATEGORY_LABELS,
  SERVICE_CATEGORY_SUBS,
  isServiceCategory,
  type ServiceCategory,
} from '../lib/usluge';
import type { MajstorPublic, UslugeStat } from '../types';

const MAX_PHOTOS = 4;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp';

interface PreviewFile {
  file: File;
  url: string;
  uploadedId?: number;
  error?: string;
}

// /usluge — broadcast zahtev za uslugu: izbor kategorije, opis kvara + slike,
// slanje svim majstorima kategorije ili ručno izabranima. Majstori odgovaraju
// kontraponudama koje korisnik prati u Moj prostor → Usluge.
export function UslugePage() {
  const ctx = useOutletContext<AppContext>();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlCat = searchParams.get('cat');
  const [cat, setCat] = useState<ServiceCategory>(
    isServiceCategory(urlCat) ? urlCat : 'vodoinstalater',
  );

  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [mode, setMode] = useState<'all' | 'selected'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [majstori, setMajstori] = useState<MajstorPublic[] | null>(null);
  const [stats, setStats] = useState<UslugeStat[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<number | null>(null);

  useEffect(() => () => {
    files.forEach((f) => URL.revokeObjectURL(f.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.uslugeStats().then(setStats).catch(() => setStats(null));
  }, []);

  // Lista majstora za "Izaberi majstore" — zahteva prijavu (endpoint je gated).
  useEffect(() => {
    if (!ctx.currentUser) {
      setMajstori(null);
      return;
    }
    let cancelled = false;
    setMajstori(null);
    api
      .uslugeMajstori(cat)
      .then((rows) => { if (!cancelled) setMajstori(rows); })
      .catch(() => { if (!cancelled) setMajstori([]); });
    return () => { cancelled = true; };
  }, [cat, ctx.currentUser]);

  const selectCat = (next: ServiceCategory) => {
    setCat(next);
    setMode('all');
    setSelectedIds(new Set());
    setSuccess(null);
    setError(null);
    setSearchParams({ cat: next }, { replace: true });
  };

  const toggleMajstor = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const picked = Array.from(e.target.files ?? []);
    const remaining = MAX_PHOTOS - files.length;
    if (picked.length > remaining) {
      setError(`Možete dodati najviše ${MAX_PHOTOS} slika ukupno.`);
      e.target.value = '';
      return;
    }
    const next: PreviewFile[] = [];
    for (const file of picked) {
      if (file.size > MAX_BYTES) {
        next.push({ file, url: URL.createObjectURL(file), error: 'Slika je veća od 5 MB' });
        continue;
      }
      next.push({ file, url: URL.createObjectURL(file) });
    }
    setFiles((prev) => [...prev, ...next]);
    e.target.value = '';
  };

  const removeAt = (i: number) => {
    setFiles((prev) => {
      const dropped = prev[i];
      if (dropped) URL.revokeObjectURL(dropped.url);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const majstorCount = useMemo(
    () => stats?.find((s) => s.categoryId === cat)?.majstorCount ?? null,
    [stats, cat],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (description.trim().length < 5) {
      setError('Opišite kvar barem u jednoj rečenici (najmanje 5 karaktera).');
      return;
    }
    if (files.some((f) => f.error)) {
      setError('Uklonite slike koje su odbačene pre slanja.');
      return;
    }
    if (mode === 'selected' && selectedIds.size === 0) {
      setError('Izaberite bar jednog majstora ili pošaljite svima.');
      return;
    }
    setBusy(true);
    try {
      const photoIds: number[] = [];
      const next = files.slice();
      for (let i = 0; i < next.length; i++) {
        const entry = next[i];
        if (entry.uploadedId) {
          photoIds.push(entry.uploadedId);
          continue;
        }
        try {
          const r = await api.uploadMedia(entry.file);
          next[i] = { ...entry, uploadedId: r.id };
          photoIds.push(r.id);
        } catch (err: unknown) {
          next[i] = { ...entry, error: err instanceof Error ? err.message : String(err) };
          setFiles(next);
          throw new Error(`Slika ${entry.file.name} nije mogla da se otpremi`);
        }
      }
      setFiles(next);
      const created = await api.createServiceJob({
        categoryId: cat,
        description: description.trim(),
        photoIds,
        targetUserIds: mode === 'selected' ? [...selectedIds] : null,
      });
      setSuccess(created.id);
      setDescription('');
      files.forEach((f) => URL.revokeObjectURL(f.url));
      setFiles([]);
      setMode('all');
      setSelectedIds(new Set());
      ctx.reloadNotifications();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('guest_not_allowed')) {
        setError('Za zahtev za uslugu je potreban trajan nalog. Otvorite "Moj prostor" da nadogradite.');
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const submitSuffix =
    mode === 'all'
      ? majstorCount !== null
        ? ` — svim majstorima (${majstorCount})`
        : ' — svim majstorima'
      : selectedIds.size > 0
        ? ` — ${selectedIds.size} ${selectedIds.size === 1 ? 'izabranom' : 'izabranih'}`
        : '';

  return (
    <div className="page page-usluge">
      <div className="page-shell">
        <header className="page-head">
          <h1>Zatražite uslugu</h1>
          <p className="page-sub">
            Izaberite vrstu usluge, opišite kvar i pošaljite zahtev — svim dostupnim majstorima ili
            samo onima koje sami izaberete.
          </p>
        </header>

        <div className="oglasi-cats" style={{ marginBottom: 24 }}>
          {SERVICE_CATEGORIES.map((c) => (
            <button
              key={c}
              className={`oglasi-cat-chip ${cat === c ? 'is-active' : ''}`}
              onClick={() => selectCat(c)}
            >
              {SERVICE_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        <div className="usluge-layout">
          {/* ------- glavna forma ------- */}
          <div className="usluge-card">
            <div className="usluge-cat-head">
              <div>
                <div className="usluge-cat-title">{SERVICE_CATEGORY_LABELS[cat]}</div>
                <div className="usluge-cat-sub">{SERVICE_CATEGORY_SUBS[cat]}</div>
              </div>
            </div>

            <div className="usluge-block">
              <div className="usluge-block-title">Šta ovaj majstor radi</div>
              <div className="usluge-block-sub">Primeri poslova koje možete zatražiti</div>
              <div className="usluge-chips">
                {SERVICE_CATEGORY_EXAMPLES[cat].map((ex) => (
                  <span key={ex} className="usluge-chip">{ex}</span>
                ))}
              </div>
            </div>

            {success !== null ? (
              <div className="usluge-success">
                <strong>Zahtev #{success} je poslat.</strong> Majstori će vam odgovoriti
                kontraponudama — pratite ih u{' '}
                <Link to="/dashboard">Moj prostor → Usluge</Link>.
                <div style={{ marginTop: 12 }}>
                  <button className="btn-secondary" type="button" onClick={() => setSuccess(null)}>
                    Pošalji novi zahtev
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="majstor-form">
                <div className="usluge-block">
                  <div className="usluge-block-title">Fotografije kvara</div>
                  <input
                    type="file"
                    accept={ACCEPT}
                    multiple
                    onChange={onPick}
                    disabled={files.length >= MAX_PHOTOS}
                  />
                  {files.length > 0 && (
                    <div className="majstor-thumbs">
                      {files.map((f, i) => (
                        <div key={i} className={`majstor-thumb ${f.error ? 'has-error' : ''}`}>
                          <img src={f.url} alt={f.file.name} />
                          <button
                            type="button"
                            className="majstor-thumb-remove"
                            onClick={() => removeAt(i)}
                          >
                            ×
                          </button>
                          {f.error && <div className="majstor-thumb-error">{f.error}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <label className="majstor-label">
                  <span>Opis kvara</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Opišite šta je pokvareno i gde se nalazi, kao i sve dodatne napomene (npr. najbolje vreme za posetu, pristup dvorištu)..."
                    rows={6}
                    maxLength={2000}
                    required
                  />
                </label>

                <div className="usluge-block">
                  <div className="usluge-block-title">Kome šaljete zahtev</div>
                  <div className="usluge-block-sub">
                    Odaberite da li zahtev ide svim majstorima ili samo onima koje izaberete
                  </div>
                  <div className="usluge-mode-grid">
                    <div
                      className={`usluge-mode-card ${mode === 'all' ? 'is-active' : ''}`}
                      onClick={() => setMode('all')}
                      role="radio"
                      aria-checked={mode === 'all'}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setMode('all'); }}
                    >
                      <div className="usluge-mode-head">
                        <span className={`usluge-radio ${mode === 'all' ? 'is-on' : ''}`} />
                        <strong>Svi raspoloživi majstori</strong>
                      </div>
                      <div className="usluge-mode-sub">
                        {majstorCount !== null
                          ? `Zahtev vidi ${majstorCount} ${majstorCount === 1 ? 'majstor' : 'majstora'} za ovu uslugu — brži odgovor`
                          : 'Zahtev vide svi majstori za ovu uslugu — brži odgovor'}
                      </div>
                    </div>
                    <div
                      className={`usluge-mode-card ${mode === 'selected' ? 'is-active' : ''}`}
                      onClick={() => setMode('selected')}
                      role="radio"
                      aria-checked={mode === 'selected'}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setMode('selected'); }}
                    >
                      <div className="usluge-mode-head">
                        <span className={`usluge-radio ${mode === 'selected' ? 'is-on' : ''}`} />
                        <strong>Izaberi majstore</strong>
                      </div>
                      <div className="usluge-mode-sub">Ručno odaberite kome šaljete zahtev</div>
                    </div>
                  </div>

                  {mode === 'selected' && (
                    <div className="usluge-majstori">
                      {!ctx.currentUser ? (
                        <p className="usluge-block-sub" style={{ margin: 0 }}>
                          <Link to="/prijava" state={{ from: '/usluge' }}>Prijavite se</Link> da biste
                          videli listu majstora.
                        </p>
                      ) : majstori === null ? (
                        <p className="usluge-block-sub" style={{ margin: 0 }}>Učitavanje…</p>
                      ) : majstori.length === 0 ? (
                        <p className="usluge-block-sub" style={{ margin: 0 }}>
                          Trenutno nema registrovanih majstora za ovu kategoriju.
                        </p>
                      ) : (
                        majstori.map((m) => {
                          const on = selectedIds.has(m.id);
                          return (
                            <div
                              key={m.id}
                              className={`usluge-majstor-card ${on ? 'is-selected' : ''}`}
                              onClick={() => toggleMajstor(m.id)}
                              role="checkbox"
                              aria-checked={on}
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') toggleMajstor(m.id);
                              }}
                            >
                              <span className="usluge-majstor-avatar" aria-hidden="true">
                                {m.displayName.charAt(0).toUpperCase()}
                              </span>
                              <span className="usluge-majstor-name">{m.displayName}</span>
                              <span className={`usluge-check ${on ? 'is-on' : ''}`}>
                                {on ? '✓' : ''}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {error && <div className="login-error">{error}</div>}

                {!ctx.currentUser ? (
                  <p style={{ margin: 0 }}>
                    <Link to="/prijava" state={{ from: '/usluge' }}>Prijavite se</Link> ili{' '}
                    <Link to="/registracija">napravite nalog</Link> da biste poslali zahtev.
                  </p>
                ) : (
                  <button className="btn-primary" type="submit" disabled={busy}>
                    {busy ? 'Slanje…' : `Pošalji zahtev${submitSuffix}`}
                  </button>
                )}
              </form>
            )}
          </div>

          {/* ------- sidebar ------- */}
          <aside className="usluge-side">
            <div className="usluge-card">
              <div className="usluge-side-title">Kako funkcioniše</div>
              <ol className="usluge-steps">
                <li>
                  <span className="usluge-step-num">1</span>
                  Opišite kvar i dodajte fotografije ako možete.
                </li>
                <li>
                  <span className="usluge-step-num">2</span>
                  Pošaljite svima ili izaberite majstore sami.
                </li>
                <li>
                  <span className="usluge-step-num">3</span>
                  Majstori vam šalju ponude sa cenom — prihvatite jednu u Moj prostor → Usluge.
                </li>
              </ol>
            </div>

            <div className="usluge-stats-card">
              <div className="usluge-side-title" style={{ color: 'var(--paper)' }}>
                {SERVICE_CATEGORY_LABELS[cat]}
              </div>
              <div className="usluge-stat-row">
                <span>Dostupno majstora</span>
                <strong>{majstorCount ?? '—'}</strong>
              </div>
              <div className="usluge-stat-row">
                <span>Ponude stižu</span>
                <strong>direktno vama</strong>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
