import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { SELA_ZABARI } from '../lib/villages';
import { PROBLEM_CATEGORIES, type ProblemCategoryId } from '../lib/problemi';
import { ProblemBadge } from '../components/ProblemGlyph';

const ProblemLocationPicker = lazy(() =>
  import('../components/ProblemsMap').then((m) => ({ default: m.ProblemLocationPicker })),
);

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
// Centar Žabara — fallback kada GPS nije dostupan; korisnik pomera tačku ručno.
const FALLBACK_LATLNG = { lat: 44.3567, lng: 21.2161 };

export function PrijaviProblemPage() {
  const navigate = useNavigate();

  const [catId, setCatId] = useState<ProblemCategoryId>('saobracaj');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [village, setVillage] = useState<string>(SELA_ZABARI[0]);
  const [latlng, setLatlng] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsMsg, setGpsMsg] = useState('');
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.url);
    };
  }, [photo]);

  const useGps = () => {
    setGpsMsg('');
    if (!navigator.geolocation) {
      setLatlng(FALLBACK_LATLNG);
      setGpsMsg('GPS nije podržan — izaberite tačku na mapi.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLatlng({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setLatlng(FALLBACK_LATLNG);
        setGpsMsg('GPS nije dostupan — postavljena približna lokacija, pomerite tačku na mapi.');
      },
      { timeout: 6000 },
    );
  };

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError('Slika je veća od 5 MB.');
      return;
    }
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto({ file, url: URL.createObjectURL(file) });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (title.trim().length < 4) return setError('Unesite naslov (najmanje 4 karaktera).');
    if (description.trim().length < 5) return setError('Unesite opis problema.');
    if (!latlng) return setError('Postavite lokaciju problema (GPS ili mapa).');

    setSubmitting(true);
    try {
      let photoMediaId: number | null = null;
      if (photo) {
        const r = await api.uploadProblemPhoto(photo.file);
        photoMediaId = r.id;
      }
      await api.createProblem({
        catId,
        title: title.trim(),
        description: description.trim(),
        village,
        address: address.trim() || null,
        lat: latlng.lat,
        lng: latlng.lng,
        photoMediaId,
      });
      navigate('/problemi', {
        state: { toast: 'Prijava je poslata — hvala! Vidljiva je na listi prijava.' },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.startsWith('429')
          ? 'Previše prijava sa vaše adrese — pokušajte ponovo za sat vremena.'
          : msg,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page page-prijavi-problem">
      <div className="page-shell prb-form-shell">
        <Link to="/problemi" className="prb-back">
          ← Nazad na listu
        </Link>
        <form className="prb-form" onSubmit={submit}>
          <div className="prb-form-kicker">Nova prijava · anonimno</div>
          <h1 className="prb-form-title">Prijavite komunalni problem</h1>

          <div className="prb-form-label">Kategorija</div>
          <div className="prb-form-cats">
            {PROBLEM_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`prb-form-cat ${catId === c.id ? 'is-active' : ''}`}
                style={catId === c.id ? { background: c.color, borderColor: c.color } : undefined}
                onClick={() => setCatId(c.id)}
              >
                <ProblemBadge id={c.id} size={26} />
                {c.short}
              </button>
            ))}
          </div>

          <label className="prb-form-field">
            <span className="prb-form-label">Naslov problema</span>
            <input
              className="ms-field-input"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="npr. Velika rupa na kolovozu"
            />
          </label>

          <label className="prb-form-field">
            <span className="prb-form-label">Opis</span>
            <textarea
              className="ms-field-input"
              rows={4}
              value={description}
              maxLength={2000}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opišite problem, tačnu lokaciju i zašto je hitan…"
            />
          </label>

          <div className="prb-form-label">Lokacija</div>
          <div className="prb-form-gps-row">
            <button type="button" className="btn-primary prb-gps-btn" onClick={useGps}>
              Koristi moju lokaciju (GPS)
            </button>
            <span className="prb-form-hint">ili prevucite tačku / kliknite na mapu ispod</span>
          </div>
          <div className="prb-picker-map">
            <Suspense fallback={<div className="prb-map-loading">Učitavanje mape…</div>}>
              <ProblemLocationPicker catId={catId} latlng={latlng} onPick={setLatlng} />
            </Suspense>
          </div>
          <div className="prb-coord-row">
            <span className="prb-coords">
              📍{' '}
              {latlng
                ? `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`
                : 'lokacija nije postavljena'}
            </span>
            {gpsMsg && <span className="prb-gps-msg">{gpsMsg}</span>}
          </div>

          <div className="prb-form-grid">
            <label className="prb-form-field">
              <span className="prb-form-label">Naselje</span>
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
            <label className="prb-form-field">
              <span className="prb-form-label">Adresa / orijentir (opciono)</span>
              <input
                className="ms-field-input"
                value={address}
                maxLength={120}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="npr. Kneza Miloša 24"
              />
            </label>
          </div>

          <div className="prb-form-field">
            <span className="prb-form-label">Fotografija (opciono, do 5 MB)</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onPickPhoto}
              style={{ display: 'none' }}
            />
            {photo ? (
              <div className="prb-photo-preview">
                <img src={photo.url} alt="Izabrana fotografija" />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    URL.revokeObjectURL(photo.url);
                    setPhoto(null);
                  }}
                >
                  Ukloni
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="prb-photo-drop"
                onClick={() => fileRef.current?.click()}
              >
                Otpremite fotografiju problema
              </button>
            )}
            {photoError && <div className="ms-error">{photoError}</div>}
          </div>

          {error && <div className="ms-error">{error}</div>}

          <button type="submit" className="btn-primary prb-submit" disabled={submitting}>
            {submitting ? 'Slanje…' : 'Pošalji prijavu'}
          </button>
          <p className="prb-form-foot">
            Prijava je anonimna. Za glasanje i komentare potrebna je prijava naloga.
          </p>
        </form>
      </div>
    </div>
  );
}
