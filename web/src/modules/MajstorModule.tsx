import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import type { Location, MajstorContent } from '../types';
import { api } from '../lib/api';
import { ModuleHero } from './ModuleHero';
import { InfoCard } from './InfoCard';

const MAX_PHOTOS = 4;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp';

interface Props { loc: Location; content: MajstorContent }

interface PreviewFile {
  file: File;
  url: string;
  uploadedId?: number;
  error?: string;
}

export function MajstorModule({ loc, content }: Props) {
  const ctx = useOutletContext<AppContext>();
  const services = content.services ?? [];
  const contact = {
    phone: content.contact?.phone,
    address: content.contact?.address ?? loc.address,
  };
  const hours = content.hours;

  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<number | null>(null);

  useEffect(() => () => {
    files.forEach((f) => URL.revokeObjectURL(f.url));
  }, [files]);

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (description.trim().length < 5) {
      setError('Opišite problem barem u jednoj rečenici (najmanje 5 karaktera).');
      return;
    }
    if (files.some((f) => f.error)) {
      setError('Uklonite slike koje su odbačene pre slanja.');
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
      const created = await api.createServiceRequest(loc.slug, {
        description: description.trim(),
        photoIds,
      });
      setSuccess(created.id);
      setDescription('');
      files.forEach((f) => URL.revokeObjectURL(f.url));
      setFiles([]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('guest_not_allowed')) {
        setError('Za zahtev za uslugu je potreban trajan nalog. Otvorite "Nalog" da nadogradite.');
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="module-page">
      <ModuleHero loc={loc} tagline={content.tagline} />
      <div className="module-body">
        <div>
          <div className="module-section">
            <div className="section-label">Usluge</div>
            <h2 className="section-title">Šta radim</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {services.map((s) => (
                <div
                  key={s}
                  style={{
                    padding: '14px 16px',
                    background: 'var(--paper-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{ width: 4, height: 22, background: 'var(--navy)', borderRadius: 2 }} />
                  {s}
                </div>
              ))}
            </div>
            {content.note && (
              <p style={{ marginTop: 14, color: 'var(--ink-2)', fontSize: 14 }}>{content.note}</p>
            )}
          </div>

          <div className="module-section">
            <div className="section-label">Zahtev za popravku</div>
            <h2 className="section-title">Pošaljite zahtev majstoru</h2>

            {!ctx.currentUser ? (
              <p>
                <Link to="/prijava">Prijavite se</Link> ili{' '}
                <Link to="/registracija">napravite nalog</Link> da biste poslali zahtev za popravku.
              </p>
            ) : success !== null ? (
              <div className="login-error" style={{ background: 'var(--paper-2)', color: 'var(--ink)' }}>
                Zahtev #{success} je poslat. Status: <strong>na čekanju</strong>. Pratite ga u{' '}
                <Link to="/nalog">Moj nalog → Moji zahtevi</Link>.
              </div>
            ) : (
              <form onSubmit={submit} className="majstor-form">
                <label className="majstor-label">
                  <span>Opis problema</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="npr. Pokvario se bojler u kupatilu, ne greje vodu. Star je 6 godina."
                    rows={5}
                    maxLength={2000}
                    required
                  />
                </label>

                <label className="majstor-label">
                  <span>Fotografije (do {MAX_PHOTOS}, max 5 MB po slici)</span>
                  <input
                    type="file"
                    accept={ACCEPT}
                    multiple
                    onChange={onPick}
                    disabled={files.length >= MAX_PHOTOS}
                  />
                </label>

                {files.length > 0 && (
                  <div className="majstor-thumbs">
                    {files.map((f, i) => (
                      <div key={i} className={`majstor-thumb ${f.error ? 'has-error' : ''}`}>
                        <img src={f.url} alt={f.file.name} />
                        <button type="button" className="majstor-thumb-remove" onClick={() => removeAt(i)}>
                          ×
                        </button>
                        {f.error && <div className="majstor-thumb-error">{f.error}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {error && <div className="login-error">{error}</div>}

                <button className="btn-primary" type="submit" disabled={busy}>
                  {busy ? 'Slanje…' : 'Pošalji zahtev'}
                </button>
              </form>
            )}
          </div>
        </div>

        <InfoCard loc={loc} contact={contact} hours={hours} />
      </div>
    </div>
  );
}
