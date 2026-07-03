import { useEffect, useState } from 'react';
import { api, type NewsletterPrefs } from '../lib/api';

const CATEGORY_LABELS: { key: keyof NewsletterPrefs; label: string; hint: string }[] = [
  { key: 'desavanja', label: 'Dešavanja u gradu', hint: 'Najnovije vesti i događaji iz opštine.' },
  { key: 'poruke', label: 'Nove poruke', hint: 'Sažetak novih poruka u vašem nalogu.' },
  { key: 'marketing', label: 'Marketing i ponude', hint: 'Promotivni sadržaj i posebne ponude.' },
];

const EMPTY: NewsletterPrefs = { desavanja: true, poruke: false, marketing: false };

// Self-contained newsletter preferences panel for "Moj prostor". The account's
// email is already verified, so toggling on subscribes without a double opt-in
// round trip.
export function NewsletterSettings() {
  const [subscribed, setSubscribed] = useState(false);
  const [prefs, setPrefs] = useState<NewsletterPrefs>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMyNewsletter()
      .then((res) => {
        setSubscribed(res.subscribed);
        setPrefs(res.prefs);
      })
      .catch(() => setMessage('Greška pri učitavanju.'))
      .finally(() => setLoading(false));
  }, []);

  const persist = async (nextSubscribed: boolean, nextPrefs: NewsletterPrefs) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.updateMyNewsletter({ subscribed: nextSubscribed, prefs: nextPrefs });
      setSubscribed(res.subscribed);
      setPrefs(res.prefs);
      setMessage(nextSubscribed ? 'Sačuvano.' : 'Odjavljeni ste sa biltena.');
    } catch {
      setMessage('Greška pri čuvanju.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="ms-empty">Učitavanje…</div>;

  return (
    <div className="ms-newsletter">
      <label className="newsletter-check" style={{ fontSize: 14 }}>
        <input
          type="checkbox"
          checked={subscribed}
          disabled={saving}
          onChange={(e) => persist(e.target.checked, prefs)}
        />
        <span>
          <strong style={{ color: 'var(--ink)' }}>Pretplaćen/na na bilten</strong>
          <br />
          Primajte odabrane novosti na vašu e-poštu.
        </span>
      </label>

      <div
        className="newsletter-cats"
        style={{ flexDirection: 'column', gap: 12, marginTop: 16, opacity: subscribed ? 1 : 0.5 }}
      >
        {CATEGORY_LABELS.map(({ key, label, hint }) => (
          <label key={key} className="newsletter-check">
            <input
              type="checkbox"
              checked={prefs[key]}
              disabled={saving || !subscribed}
              onChange={(e) => {
                const next = { ...prefs, [key]: e.target.checked };
                setPrefs(next);
                void persist(true, next);
              }}
            />
            <span>
              <strong style={{ color: 'var(--ink)' }}>{label}</strong>
              <br />
              {hint}
            </span>
          </label>
        ))}
      </div>

      {message && (
        <div className={`newsletter-msg ${message.includes('Greška') ? 'err' : 'ok'}`} style={{ marginTop: 14 }}>
          {message}
        </div>
      )}
    </div>
  );
}
