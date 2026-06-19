import { useEffect, useState } from 'react';
import { api, mediaUrl } from '../lib/api';
import { SELA_ZABARI } from '../lib/villages';
import { AD_CATEGORY_LABELS, type Ad, type AdCategory, type AdContactMethod, type AdInput } from '../types';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp';

const CONTACT_LABELS: Record<AdContactMethod, string> = {
  link: 'Link (Instagram, Facebook, sajt…)',
  phone: 'Broj telefona',
  email: 'Mejl',
  message: 'Poruke unutar sajta',
};

const CONTACT_PLACEHOLDER: Record<AdContactMethod, string> = {
  link: 'https://instagram.com/...',
  phone: '+381 60 123 4567',
  email: 'ime@primer.rs',
  message: '',
};

interface Props {
  initial: Ad | null;
  onSaved: (ad: Ad) => void;
  onCancel: () => void;
}

export function AdForm({ initial, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState<AdCategory>(initial?.category ?? 'prodajem');
  const [price, setPrice] = useState(initial?.priceRsd != null ? String(initial.priceRsd) : '');
  const [village, setVillage] = useState(initial?.village ?? SELA_ZABARI[0]);
  const [contactMethod, setContactMethod] = useState<AdContactMethod>(initial?.contactMethod ?? 'phone');
  const [contactValue, setContactValue] = useState(initial?.contactValue ?? '');

  const [photoMediaId, setPhotoMediaId] = useState<number | null>(initial?.photoMediaId ?? null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError('Slika je veća od 5 MB.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPickedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPickedFile(null);
    setPreviewUrl(null);
    setPhotoMediaId(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (title.trim().length < 3) return setError('Naslov mora imati barem 3 karaktera.');
    if (description.trim().length < 5) return setError('Opis mora imati barem 5 karaktera.');
    if (contactMethod !== 'message' && !contactValue.trim()) {
      return setError('Unesite kontakt podatak za izabrani način kontakta.');
    }

    let priceRsd: number | null = null;
    if (price.trim() !== '') {
      const n = Number(price);
      if (!Number.isInteger(n) || n < 0) return setError('Cena mora biti nenegativan ceo broj.');
      priceRsd = n;
    }

    setBusy(true);
    try {
      let mediaId = photoMediaId;
      if (pickedFile) {
        const r = await api.uploadMedia(pickedFile, 'ad_photo');
        mediaId = r.id;
      }
      const body: AdInput = {
        title: title.trim(),
        description: description.trim(),
        category,
        priceRsd,
        village,
        photoMediaId: mediaId,
        contactMethod,
        contactValue: contactMethod === 'message' ? null : contactValue.trim(),
      };
      const saved = initial ? await api.updateOglas(initial.id, body) : await api.createOglas(body);
      onSaved(saved);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('guest_not_allowed')) {
        setError('Za postavljanje oglasa je potreban trajan nalog.');
      } else if (message.includes('ad_limit_reached')) {
        setError('Dostigli ste maksimum od 10 aktivnih oglasa.');
      } else {
        setError(message);
      }
      setBusy(false);
    }
  };

  return (
    <div className="oglas-modal-overlay" onClick={onCancel}>
      <div className="oglas-modal" onClick={(ev) => ev.stopPropagation()} role="dialog" aria-label="Oglas">
        <button className="oglas-modal-close" onClick={onCancel} aria-label="Zatvori">×</button>
        <div className="oglas-modal-body">
          <h2 className="oglas-modal-title">{initial ? 'Izmeni oglas' : 'Novi oglas'}</h2>

          <form className="oglas-form" onSubmit={submit}>
            <label className="ms-field">
              <span className="ms-field-label">Naslov</span>
              <input className="ms-field-input" value={title} maxLength={120}
                onChange={(e) => setTitle(e.target.value)} placeholder="npr. Prodajem bicikl" />
            </label>

            <label className="ms-field">
              <span className="ms-field-label">Opis</span>
              <textarea className="ms-field-input" rows={4} maxLength={4000} value={description}
                onChange={(e) => setDescription(e.target.value)} placeholder="Detaljan opis oglasa…" />
            </label>

            <div className="oglas-form-row">
              <label className="ms-field">
                <span className="ms-field-label">Kategorija</span>
                <select className="ms-field-input" value={category}
                  onChange={(e) => setCategory(e.target.value as AdCategory)}>
                  {(Object.keys(AD_CATEGORY_LABELS) as AdCategory[]).map((c) => (
                    <option key={c} value={c}>{AD_CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </label>

              <label className="ms-field">
                <span className="ms-field-label">Cena (RSD, opciono)</span>
                <input className="ms-field-input" type="number" min={0} value={price}
                  onChange={(e) => setPrice(e.target.value)} placeholder="Po dogovoru" />
              </label>

              <label className="ms-field">
                <span className="ms-field-label">Selo / naselje</span>
                <select className="ms-field-input" value={village} onChange={(e) => setVillage(e.target.value)}>
                  {SELA_ZABARI.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="ms-field">
              <span className="ms-field-label">Slika (opciono, max 5 MB)</span>
              {previewUrl || photoMediaId ? (
                <div className="oglas-form-photo">
                  <img src={previewUrl ?? mediaUrl(photoMediaId!)} alt="pregled" />
                  <button type="button" className="ms-btn ms-btn-danger ms-btn-sm" onClick={removePhoto}>
                    Ukloni sliku
                  </button>
                </div>
              ) : (
                <input type="file" accept={ACCEPT} onChange={onPick} />
              )}
            </div>

            <div className="ms-field">
              <span className="ms-field-label">Način kontakta</span>
              <div className="oglas-contact-radios">
                {(Object.keys(CONTACT_LABELS) as AdContactMethod[]).map((m) => (
                  <label key={m} className="oglas-radio">
                    <input type="radio" name="contactMethod" value={m} checked={contactMethod === m}
                      onChange={() => setContactMethod(m)} />
                    <span>{CONTACT_LABELS[m]}</span>
                  </label>
                ))}
              </div>
            </div>

            {contactMethod !== 'message' && (
              <label className="ms-field">
                <span className="ms-field-label">Kontakt podatak</span>
                <input className="ms-field-input" value={contactValue}
                  onChange={(e) => setContactValue(e.target.value)}
                  placeholder={CONTACT_PLACEHOLDER[contactMethod]} />
              </label>
            )}
            {contactMethod === 'message' && (
              <p className="oglas-contact-note">
                Zainteresovani će vam slati poruke unutar sajta — videćete ih u „Moj prostor → Poruke".
              </p>
            )}

            {error && <div className="ms-error">{error}</div>}

            <div className="oglas-form-actions">
              <button type="button" className="ms-btn ms-btn-sm" onClick={onCancel} disabled={busy}>
                Otkaži
              </button>
              <button type="submit" className="ms-btn ms-btn-primary ms-btn-sm" disabled={busy}>
                {busy ? 'Čuvanje…' : initial ? 'Sačuvaj izmene' : 'Objavi oglas'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
