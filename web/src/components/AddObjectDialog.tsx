import { useEffect, useState } from 'react';
import { api, type CurrentUser } from '../lib/api';
import { SELA_ZABARI } from '../lib/villages';
import type { Category, CategoryId } from '../types';
import { PinGlyph } from './PinGlyph';

interface Props {
  categories: Category[];
  lat: number;
  lng: number;
  currentUser: CurrentUser;
  onClose: () => void;
  onCreated: () => void;
}

export function AddObjectDialog({ categories, lat, lng, currentUser, onClose, onCreated }: Props) {
  // Kustos sme da dodaje objekte samo u svojim selima i uvek u draft statusu;
  // admin sme svuda i može da bira publish/draft. Selo izbor i `status` toggle
  // se prema tome menjaju.
  const isCurator = currentUser.role === 'curator';
  const villageOptions = isCurator ? currentUser.curatedVillages : [...SELA_ZABARI];

  const [catId, setCatId] = useState<CategoryId>('cafe');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [village, setVillage] = useState<string>(
    // Pre-selektuj prvo sopstveno selo kustosa da je obavezno polje već popunjeno.
    isCurator && currentUser.curatedVillages.length > 0 ? currentUser.curatedVillages[0] : '',
  );
  const [publishNow, setPublishNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address || busy) return;
    if (isCurator && !village) {
      setError('Selo je obavezno za kustosa.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isCurator) {
        await api.curatorCreateLocation({
          name,
          address,
          catId,
          village,
          lat,
          lng,
        });
      } else {
        await api.adminCreateLocation({
          name,
          address,
          catId,
          village: village || null,
          lat,
          lng,
          status: publishNow ? 'published' : 'draft',
        });
      }
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes('401') ? 'Sesija je istekla — prijavite se ponovo.' : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <form className="dialog-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="dialog-head">
          <div>
            <div className="section-label" style={{ margin: 0 }}>Novi objekat</div>
            <div className="dialog-coords">{lat.toFixed(5)}, {lng.toFixed(5)}</div>
          </div>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Zatvori">×</button>
        </div>

        <div className="field-label">Kategorija</div>
        <div className="cat-picker">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`cat-chip ${catId === c.id ? 'selected' : ''}`}
              onClick={() => setCatId(c.id)}
            >
              <PinGlyph cat={c.id} size={22} />
              {c.short}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="field-label">Naziv objekta</div>
          <input
            className="field-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="npr. Kafić Lipa"
            autoFocus
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="field-label">Adresa</div>
          <input
            className="field-input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="npr. Kralja Petra 7"
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="field-label">
            Selo{isCurator ? ' (vaše kuratorsko)' : ''}
          </div>
          <select
            className="field-input"
            value={village}
            onChange={(e) => setVillage(e.target.value)}
            disabled={isCurator && villageOptions.length <= 1}
          >
            {!isCurator && <option value="">— nije izabrano —</option>}
            {villageOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {!isCurator && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 16,
              fontSize: 13,
              color: 'var(--ink-2)',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={publishNow}
              onChange={(e) => setPublishNow(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--navy)' }}
            />
            Objavi odmah (ne kao nacrt)
          </label>
        )}
        {isCurator && (
          <div
            style={{
              marginTop: 14,
              fontSize: 12,
              color: 'var(--ink-2)',
              lineHeight: 1.5,
            }}
          >
            Objekat se čuva kao nacrt — admin ga pregledava i objavljuje.
          </div>
        )}

        <button className="btn-primary" style={{ marginTop: 14 }} disabled={!name || !address || (isCurator && !village) || busy} type="submit">
          {busy ? 'Čuvanje…' : isCurator ? 'Sačuvaj kao nacrt' : publishNow ? 'Sačuvaj i objavi' : 'Sačuvaj kao nacrt'}
        </button>

        {error && <div className="login-error">{error}</div>}
      </form>
    </div>
  );
}
