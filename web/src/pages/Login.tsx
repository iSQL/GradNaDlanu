import { useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import { setToken, type Role } from '../lib/auth';

function defaultRouteFor(role: Role): string {
  if (role === 'admin') return '/admin';
  if (role === 'business') return '/poslovni';
  if (role === 'curator') return '/kustos';
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
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestBusy, setGuestBusy] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setResendMessage(null);
    setSubmitting(true);
    try {
      const { token, user } = await api.login(email, password);
      setToken(token);
      await ctx.reloadCurrentUser();
      navigate(fromState ?? defaultRouteFor(user.role));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('email_not_verified')) {
        setNeedsVerification(true);
        setError('E-pošta nije potvrđena. Otvorite poruku koju smo poslali ili tražite novi link.');
      } else if (message.includes('401')) {
        setError('Pogrešna e-pošta ili lozinka.');
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const startGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuestError(null);
    setGuestBusy(true);
    try {
      const { token } = await api.guestSignup(guestName.trim());
      setToken(token);
      await ctx.reloadCurrentUser();
      navigate('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('403')) {
        setGuestError('Registracija je trenutno onemogućena.');
      } else if (message.includes('429')) {
        setGuestError('Trenutno previše gost naloga — pokušajte ponovo kasnije.');
      } else if (message.includes('400')) {
        setGuestError('Ime mora imati 1–60 karaktera.');
      } else {
        setGuestError(message);
      }
    } finally {
      setGuestBusy(false);
    }
  };

  const resend = async () => {
    setResendBusy(true);
    setResendMessage(null);
    try {
      await api.resendVerification(email);
      setResendMessage('Ako nalog postoji, poslali smo novi link na vašu e-poštu.');
    } catch (err: unknown) {
      setResendMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setResendBusy(false);
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
          {needsVerification && (
            <div style={{ marginTop: 4, fontSize: 13, color: 'var(--ink-2)' }}>
              <button
                type="button"
                className="nav-btn"
                onClick={resend}
                disabled={resendBusy || !email}
                style={{ marginRight: 8 }}
              >
                {resendBusy ? 'Slanje…' : 'Pošalji novi link'}
              </button>
              {resendMessage && (
                <span style={{ display: 'block', marginTop: 8 }}>{resendMessage}</span>
              )}
            </div>
          )}
          {registrationEnabled && (
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6 }}>
              Nemate nalog? <Link to="/registracija">Registrujte se</Link>
            </div>
          )}
        </div>
      </form>

      {registrationEnabled && (
        <div className="login-card" style={{ marginTop: 16 }}>
          {!guestOpen ? (
            <>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 10, lineHeight: 1.55 }}>
                Samo želite da pogledate ili sačuvate omiljena mesta? Otvorite{' '}
                <strong>privremeni nalog</strong> jednim klikom — bez e-pošte.
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setGuestOpen(true)}
              >
                Nastavite kao gost
              </button>
            </>
          ) : (
            <form onSubmit={startGuest} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div className="field-label">Ime za prikaz</div>
                <input
                  className="field-input"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="npr. Marko"
                  autoFocus
                  maxLength={60}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={guestBusy || guestName.trim().length === 0}
                >
                  {guestBusy ? 'Pravimo nalog…' : 'Kreiraj gost nalog'}
                </button>
                <button
                  type="button"
                  className="nav-btn"
                  onClick={() => { setGuestOpen(false); setGuestError(null); }}
                  disabled={guestBusy}
                >
                  Otkaži
                </button>
              </div>
              {guestError && <div className="login-error">{guestError}</div>}
              <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                Nalog se briše nakon 7 dana neaktivnosti. Kasnije možete da dodate e-poštu i
                nadogradite ga u trajan nalog (sa rezervacijama i ostalim funkcijama).
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
