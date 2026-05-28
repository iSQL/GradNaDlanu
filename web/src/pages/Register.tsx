import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';

export function Register() {
  const ctx = useOutletContext<AppContext>();
  const registrationEnabled = ctx.registrationEnabled;

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.register(email, password, displayName);
      setSentTo(res.email);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('409')) setError('Ova e-pošta je već registrovana.');
      else if (message.includes('403')) setError('Registracija je trenutno onemogućena.');
      else if (message.includes('400')) setError('Proverite unos: e-pošta i lozinka (min. 6 karaktera).');
      else setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!registrationEnabled) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <h1>Registracija</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 8 }}>
            Registracija novih korisnika je trenutno onemogućena.
          </p>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 12 }}>
            Već imate nalog? <Link to="/prijava">Prijavite se</Link>
          </div>
        </div>
      </div>
    );
  }

  if (sentTo) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <h1>Potvrdite e-poštu</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.55 }}>
            Poslali smo link za potvrdu na <strong>{sentTo}</strong>. Otvorite poruku i kliknite na
            link da aktivirate nalog. Link važi 24 sata.
          </p>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 12, lineHeight: 1.55 }}>
            Ne vidite poruku? Proverite folder „neželjena pošta" ili{' '}
            <Link to="/prijava">prijavite se</Link> kada potvrdite mejl.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <h1>Registracija</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="field-label">Ime</div>
            <input
              className="field-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="npr. Marko"
              autoFocus
            />
          </div>
          <div>
            <div className="field-label">E-pošta</div>
            <input
              className="field-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <div className="field-label">Lozinka</div>
            <input
              className="field-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="najmanje 6 karaktera"
            />
          </div>
          <button
            className="btn-primary"
            type="submit"
            disabled={submitting || !email || !password || !displayName}
          >
            {submitting ? 'Registracija…' : 'Registruj se'}
          </button>
          {error && <div className="login-error">{error}</div>}
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6 }}>
            Već imate nalog? <Link to="/prijava">Prijavite se</Link>
          </div>
        </div>
      </form>
    </div>
  );
}
