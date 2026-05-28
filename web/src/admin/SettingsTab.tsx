import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';

export function SettingsTab() {
  const ctx = useOutletContext<AppContext>();
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => setRegistrationEnabled(s.registrationEnabled))
      .catch((e: Error) => setError(e.message));
  }, []);

  const toggle = async () => {
    if (registrationEnabled === null) return;
    setBusy(true);
    setError(null);
    try {
      const next = !registrationEnabled;
      const res = await api.adminUpdateSettings({ registrationEnabled: next });
      setRegistrationEnabled(res.registrationEnabled);
      await ctx.reloadSettings();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-card" style={{ maxWidth: 640 }}>
      <div className="section-label" style={{ margin: 0, marginBottom: 16 }}>
        Registracija novih korisnika
      </div>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 18 }}>
        Kada je isključeno, posetioci ne mogu da otvore nov nalog. Postojeći korisnici se i dalje
        prijavljuju normalno.
      </div>

      {registrationEnabled === null ? (
        <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Učitavanje…</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            className="btn-primary"
            onClick={toggle}
            disabled={busy}
          >
            {busy
              ? 'Čuvanje…'
              : registrationEnabled
              ? 'Onemogući registraciju'
              : 'Omogući registraciju'}
          </button>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            Trenutno:{' '}
            <span style={{ color: registrationEnabled ? 'var(--gold)' : 'var(--ink-2)' }}>
              {registrationEnabled ? 'omogućena' : 'onemogućena'}
            </span>
          </div>
        </div>
      )}

      {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  );
}
