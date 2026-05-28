import { useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import { setToken, type Role } from '../lib/auth';

function defaultRouteFor(role: Role): string {
  if (role === 'admin') return '/admin';
  if (role === 'business') return '/poslovni';
  return '/';
}

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = useOutletContext<AppContext>();

  const fromState = (location.state as { from?: string } | null)?.from;
  const registrationEnabled = ctx.registrationEnabled;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { token, user } = await api.login(email, password);
      setToken(token);
      await ctx.reloadCurrentUser();
      navigate(fromState ?? defaultRouteFor(user.role));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message.includes('401') ? 'Pogrešna e-pošta ili lozinka.' : message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <h1>Prijava</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="field-label">E-pošta</div>
            <input
              className="field-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <div className="field-label">Lozinka</div>
            <input
              className="field-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn-primary" type="submit" disabled={submitting || !email || !password}>
            {submitting ? 'Prijava…' : 'Prijavi se'}
          </button>
          {error && <div className="login-error">{error}</div>}
          {registrationEnabled && (
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6 }}>
              Nemate nalog? <Link to="/registracija">Registrujte se</Link>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
