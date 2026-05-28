import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api, type AppSettings } from '../lib/api';

export function SettingsTab() {
  const ctx = useOutletContext<AppContext>();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [busyKey, setBusyKey] = useState<keyof AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSettings()
      .then(setSettings)
      .catch((e: Error) => setError(e.message));
  }, []);

  const toggle = async (key: keyof AppSettings) => {
    if (!settings) return;
    setBusyKey(key);
    setError(null);
    try {
      const patch = { [key]: !settings[key] } as Partial<AppSettings>;
      const res = await api.adminUpdateSettings(patch);
      setSettings(res);
      await ctx.reloadSettings();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKey(null);
    }
  };

  if (!settings) {
    return (
      <div className="admin-card" style={{ maxWidth: 640 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Učitavanje…</div>
        {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="admin-card" style={{ maxWidth: 640 }}>
        <div className="section-label" style={{ margin: 0, marginBottom: 16 }}>
          Registracija novih korisnika
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 18 }}>
          Kada je isključeno, posetioci ne mogu da otvore nov nalog (ni trajan ni gost). Postojeći
          korisnici se i dalje prijavljuju normalno.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            className="btn-primary"
            onClick={() => toggle('registrationEnabled')}
            disabled={busyKey !== null}
          >
            {busyKey === 'registrationEnabled'
              ? 'Čuvanje…'
              : settings.registrationEnabled
              ? 'Onemogući registraciju'
              : 'Omogući registraciju'}
          </button>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            Trenutno:{' '}
            <span style={{ color: settings.registrationEnabled ? 'var(--gold)' : 'var(--ink-2)' }}>
              {settings.registrationEnabled ? 'omogućena' : 'onemogućena'}
            </span>
          </div>
        </div>
      </div>

      <div className="admin-card" style={{ maxWidth: 640 }}>
        <div className="section-label" style={{ margin: 0, marginBottom: 16 }}>
          Rezervacije i zahtevi za uslugu za goste
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 18 }}>
          Kada je isključeno, gost nalozi (privremeni nalozi bez e-pošte) ne mogu da prave rezervacije
          ni zahteve za uslugu. Trajni nalozi nisu pogođeni.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            className="btn-primary"
            onClick={() => toggle('guestsCanBook')}
            disabled={busyKey !== null}
          >
            {busyKey === 'guestsCanBook'
              ? 'Čuvanje…'
              : settings.guestsCanBook
              ? 'Onemogući za goste'
              : 'Omogući za goste'}
          </button>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            Trenutno:{' '}
            <span style={{ color: settings.guestsCanBook ? 'var(--gold)' : 'var(--ink-2)' }}>
              {settings.guestsCanBook ? 'dozvoljeno' : 'zabranjeno'}
            </span>
          </div>
        </div>
      </div>

      {error && <div className="login-error">{error}</div>}
    </div>
  );
}
