import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type NewsletterPrefs } from '../lib/api';

type Status = 'idle' | 'submitting' | 'ok' | 'error';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CATEGORY_LABELS: { key: keyof NewsletterPrefs; label: string }[] = [
  { key: 'desavanja', label: 'Dešavanja u gradu' },
  { key: 'marketing', label: 'Marketing i ponude' },
];

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [prefs, setPrefs] = useState<NewsletterPrefs>({
    desavanja: true,
    poruke: false,
    marketing: false,
  });
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setStatus('error');
      setMessage('Unesite ispravnu email adresu.');
      return;
    }
    if (!consent) {
      setStatus('error');
      setMessage('Potvrdite saglasnost za prijavu.');
      return;
    }
    setStatus('submitting');
    setMessage('');
    try {
      await api.subscribeNewsletter(value, prefs, consent);
      setStatus('ok');
      setMessage('Proverite mejl i potvrdite prijavu (double opt-in).');
      setEmail('');
      setConsent(false);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage('Greška, pokušajte ponovo kasnije.');
    }
  }

  return (
    <form className="newsletter-form" onSubmit={onSubmit} noValidate>
      <label htmlFor="newsletter-email" className="newsletter-label">
        Prijavi se na bilten
      </label>
      <div className="newsletter-row">
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vasa@adresa.com"
          autoComplete="email"
          disabled={status === 'submitting'}
        />
        <button type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Šalje…' : 'Prijavi se'}
        </button>
      </div>
      <div className="newsletter-cats">
        {CATEGORY_LABELS.map(({ key, label }) => (
          <label key={key} className="newsletter-check">
            <input
              type="checkbox"
              checked={prefs[key]}
              onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
              disabled={status === 'submitting'}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <label className="newsletter-check newsletter-consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={status === 'submitting'}
        />
        <span>
          Saglasan/na sam da primam bilten i prihvatam{' '}
          <Link to="/politika-privatnosti">politiku privatnosti</Link>.
        </span>
      </label>
      {message && (
        <div className={`newsletter-msg ${status === 'ok' ? 'ok' : 'err'}`} role="status">
          {message}
        </div>
      )}
    </form>
  );
}
