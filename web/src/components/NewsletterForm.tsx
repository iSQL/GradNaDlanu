import { useState } from 'react';
import { api } from '../lib/api';

type Status = 'idle' | 'submitting' | 'ok' | 'error';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NewsletterForm() {
  const [email, setEmail] = useState('');
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
    setStatus('submitting');
    setMessage('');
    try {
      await api.subscribeNewsletter(value);
      setStatus('ok');
      setMessage('Hvala što ste se prijavili.');
      setEmail('');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage('Greška, pokušajte ponovo kasnije.');
    }
  }

  return (
    <form className="newsletter-form" onSubmit={onSubmit} noValidate>
      <label htmlFor="newsletter-email" className="newsletter-label">
        Prijavi se na newsletter
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
      {message && (
        <div className={`newsletter-msg ${status === 'ok' ? 'ok' : 'err'}`} role="status">
          {message}
        </div>
      )}
    </form>
  );
}
