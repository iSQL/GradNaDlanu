import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import { setToken, type Role } from '../lib/auth';

type Status = 'pending' | 'success' | 'error';

function defaultRouteFor(role: Role): string {
  if (role === 'admin') return '/admin';
  if (role === 'business') return '/poslovni';
  return '/';
}

export function VerifyEmail() {
  const ctx = useOutletContext<AppContext>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');

  const [status, setStatus] = useState<Status>('pending');
  const [message, setMessage] = useState<string>('Potvrđujemo vaš nalog…');
  const ran = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode double-invocation in dev: the token can
    // only be consumed once, so the second call would surface as "invalid link"
    // even when the first one succeeded.
    if (ran.current) return;
    ran.current = true;

    if (!token) {
      setStatus('error');
      setMessage('Link nije ispravan — nedostaje token.');
      return;
    }
    (async () => {
      try {
        const res = await api.verifyEmail(token);
        setToken(res.token);
        await ctx.reloadCurrentUser();
        setStatus('success');
        setMessage('Nalog je potvrđen. Preusmeravamo vas…');
        setTimeout(() => navigate(defaultRouteFor(res.user.role)), 1200);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus('error');
        if (msg.includes('invalid_or_expired') || msg.includes('400')) {
          setMessage('Link je istekao ili više nije važeći. Zatražite novi sa stranice za prijavu.');
        } else {
          setMessage(msg);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1>Potvrda e-pošte</h1>
        <p
          style={{
            fontSize: 14,
            color: status === 'error' ? 'var(--red, #b3261e)' : 'var(--ink-2)',
            marginTop: 8,
            lineHeight: 1.55,
          }}
        >
          {message}
        </p>
        {status === 'error' && (
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 12 }}>
            <Link to="/prijava">Idite na prijavu</Link>
          </div>
        )}
      </div>
    </div>
  );
}
