import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { api, type NewsletterPrefs } from '../lib/api';

const CATEGORY_LABELS: { key: keyof NewsletterPrefs; label: string; hint: string }[] = [
  { key: 'desavanja', label: 'Dešavanja u gradu', hint: 'Najnovije vesti i događaji iz opštine.' },
  { key: 'poruke', label: 'Nove poruke', hint: 'Sažetak novih poruka u vašem nalogu.' },
  { key: 'marketing', label: 'Marketing i ponude', hint: 'Promotivni sadržaj i posebne ponude.' },
];

type Mode = 'confirm' | 'manage';
type Status = 'loading' | 'ready' | 'error' | 'unsubscribed';

export function NewsletterPage() {
  const location = useLocation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const wantsUnsubscribe = params.get('odjava') === '1';
  const mode: Mode = location.pathname.includes('potvrda') ? 'confirm' : 'manage';

  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');
  const [prefs, setPrefs] = useState<NewsletterPrefs | null>(null);
  const [saving, setSaving] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!token) {
      setStatus('error');
      setMessage('Link nije ispravan — nedostaje token.');
      return;
    }
    (async () => {
      if (mode === 'confirm') {
        try {
          const res = await api.confirmNewsletter(token);
          setPrefs(res.prefs);
          setStatus('ready');
          setMessage('Prijava je potvrđena. Hvala!');
        } catch {
          setStatus('error');
          setMessage('Link je istekao ili nije važeći.');
        }
        return;
      }
      // manage
      try {
        const res = await api.getNewsletterPrefs(token);
        setPrefs(res.prefs);
        if (res.status === 'unsubscribed') {
          setStatus('unsubscribed');
        } else {
          setStatus('ready');
        }
        // One-click unsubscribe link (?odjava=1) opts out immediately.
        if (wantsUnsubscribe && res.status !== 'unsubscribed') {
          await api.unsubscribeNewsletter(token);
          setStatus('unsubscribed');
          setMessage('Odjavljeni ste sa biltena.');
        }
      } catch {
        setStatus('error');
        setMessage('Link nije važeći.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const save = async () => {
    if (!prefs) return;
    setSaving(true);
    try {
      await api.updateNewsletterPrefs(token, prefs);
      setMessage('Podešavanja su sačuvana.');
    } catch {
      setMessage('Greška pri čuvanju.');
    } finally {
      setSaving(false);
    }
  };

  const unsubscribe = async () => {
    setSaving(true);
    try {
      await api.unsubscribeNewsletter(token);
      setStatus('unsubscribed');
      setMessage('Odjavljeni ste sa biltena.');
    } catch {
      setMessage('Greška pri odjavi.');
    } finally {
      setSaving(false);
    }
  };

  const resubscribe = async () => {
    if (!prefs) return;
    setSaving(true);
    try {
      // Re-enable via prefs endpoint doesn't flip status; use confirm token path
      // by re-saving prefs then confirming is overkill — simply set prefs and
      // let the user re-opt through the footer if fully unsubscribed. Here we
      // just re-activate preferences.
      await api.updateNewsletterPrefs(token, prefs);
      await api.confirmNewsletter(token);
      setStatus('ready');
      setMessage('Ponovo ste pretplaćeni.');
    } catch {
      setMessage('Greška.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card" style={{ maxWidth: 460 }}>
        <h1>Bilten — Grad na dlanu</h1>

        {status === 'loading' && (
          <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 8 }}>Učitavanje…</p>
        )}

        {status === 'error' && (
          <>
            <p style={{ fontSize: 14, color: 'var(--red, #b3261e)', marginTop: 8, lineHeight: 1.55 }}>
              {message}
            </p>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 12 }}>
              <Link to="/">Nazad na početnu</Link>
            </div>
          </>
        )}

        {message && (status === 'ready' || status === 'unsubscribed') && (
          <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.55 }}>
            {message}
          </p>
        )}

        {status === 'ready' && prefs && (
          <>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 12, marginBottom: 8 }}>
              Izaberite šta želite da primate:
            </p>
            <div className="newsletter-cats" style={{ flexDirection: 'column', gap: 10 }}>
              {CATEGORY_LABELS.map(({ key, label, hint }) => (
                <label key={key} className="newsletter-check">
                  <input
                    type="checkbox"
                    checked={prefs[key]}
                    onChange={(e) => setPrefs((p) => (p ? { ...p, [key]: e.target.checked } : p))}
                  />
                  <span>
                    <strong style={{ color: 'var(--ink)' }}>{label}</strong>
                    <br />
                    {hint}
                  </span>
                </label>
              ))}
            </div>
            {mode === 'manage' && (
              <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                <button className="btn" onClick={save} disabled={saving}>
                  {saving ? 'Čuva…' : 'Sačuvaj'}
                </button>
                <button
                  className="btn"
                  onClick={unsubscribe}
                  disabled={saving}
                  style={{ background: 'transparent', color: 'var(--red, #b3261e)' }}
                >
                  Odjavi se sa svega
                </button>
              </div>
            )}
          </>
        )}

        {status === 'unsubscribed' && (
          <div style={{ marginTop: 16 }}>
            <button className="btn" onClick={resubscribe} disabled={saving || !prefs}>
              {saving ? '…' : 'Ponovo se pretplati'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
