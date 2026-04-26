import { useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import { setToken } from '../lib/auth';

export function Register() {
  const navigate = useNavigate();
  const ctx = useOutletContext<AppContext>();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { token } = await api.register(email, password, displayName);
      setToken(token);
      await ctx.reloadCurrentUser();
      navigate('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('409')) setError('Ova e-pošta je već registrovana.');
      else if (message.includes('400')) setError('Proverite unos: e-pošta i lozinka (min. 6 karaktera).');
      else setError(message);
    } finally {
      setSubmitting(false);
    }
  };

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
