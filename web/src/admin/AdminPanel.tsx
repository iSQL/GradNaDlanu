import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import { clearToken } from '../lib/auth';
import { PinGlyph } from '../components/PinGlyph';
import type { CategoryId, Location } from '../types';
import { UsersTab } from './UsersTab';
import { ReservationsInbox } from './ReservationsInbox';
import { SettingsTab } from './SettingsTab';

type Tab = 'objects' | 'reservations' | 'users' | 'settings';

export function AdminPanel() {
  const ctx = useOutletContext<AppContext>();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('objects');
  const [allObjects, setAllObjects] = useState<Location[]>([]);
  const [selectedCat, setSelectedCat] = useState<CategoryId>('cafe');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const rows = await api.adminListLocations();
    setAllObjects(rows.sort((a, b) => a.name.localeCompare(b.name, 'sr')));
  };

  useEffect(() => {
    reload().catch((err: Error) => setError(err.message));
  }, []);

  const submit = async () => {
    if (!name || !address) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminCreateLocation({ name, address, catId: selectedCat });
      setName('');
      setAddress('');
      await reload();
      await ctx.reloadLocations();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (loc: Location) => {
    const next = loc.status === 'published' ? 'draft' : 'published';
    setError(null);
    try {
      await api.adminUpdateLocation(loc.id, { status: next });
      await reload();
      await ctx.reloadLocations();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const deleteLocation = async (loc: Location) => {
    if (!window.confirm(`Obrisati "${loc.name}"? Ova radnja je trajna.`)) return;
    setError(null);
    try {
      await api.adminDeleteLocation(loc.id);
      await reload();
      await ctx.reloadLocations();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const logout = async () => {
    clearToken();
    await ctx.reloadCurrentUser();
    navigate('/admin/login');
  };

  return (
    <div className="module-page">
      <div
        style={{
          background: 'var(--ink)',
          color: 'var(--paper)',
          padding: '32px 48px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <button className="module-back" onClick={() => navigate('/')} style={{ marginBottom: 12 }}>
            ← Nazad na mapu
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <h1
                style={{
                  fontFamily: 'Fraunces, serif',
                  fontWeight: 500,
                  fontSize: 36,
                  letterSpacing: '-0.02em',
                  margin: 0,
                  color: 'var(--paper)',
                }}
              >
                Administracija
              </h1>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--gold)',
                  padding: '4px 10px',
                  border: '1px solid var(--gold)',
                  borderRadius: 999,
                }}
              >
                privatno
              </span>
            </div>
            <button className="nav-btn" onClick={logout}>Odjavi se</button>
          </div>
          <div className="account-tabs" style={{ marginTop: 18, borderBottom: 'none' }}>
            <button className={`account-tab admin-tab ${tab === 'objects' ? 'active' : ''}`} onClick={() => setTab('objects')}>Objekti</button>
            <button className={`account-tab admin-tab ${tab === 'reservations' ? 'active' : ''}`} onClick={() => setTab('reservations')}>Rezervacije</button>
            <button className={`account-tab admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Korisnici</button>
            <button className={`account-tab admin-tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>Podešavanja</button>
          </div>
        </div>
      </div>

      <div className="admin-container">
        {tab === 'objects' && (
          <div className="admin-grid">
            <div>
              <div className="admin-card">
                <div className="section-label" style={{ margin: 0, marginBottom: 16 }}>Novi objekat</div>

                <div className="field-label">Kategorija</div>
                <div className="cat-picker">
                  {ctx.categories.map((c) => (
                    <button
                      key={c.id}
                      className={`cat-chip ${selectedCat === c.id ? 'selected' : ''}`}
                      onClick={() => setSelectedCat(c.id)}
                    >
                      <PinGlyph cat={c.id} size={22} />
                      {c.short}
                    </button>
                  ))}
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="field-label">Naziv objekta</div>
                  <input
                    className="field-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="npr. Kafić Lipa"
                  />
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="field-label">Adresa</div>
                  <input
                    className="field-input"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="npr. Kralja Petra 7"
                  />
                </div>

                <button
                  className="btn-primary"
                  style={{ marginTop: 18 }}
                  disabled={!name || !address || busy}
                  onClick={submit}
                >
                  {busy ? 'Čuvanje…' : 'Sačuvaj kao nacrt'}
                </button>

                {error && <div className="login-error">{error}</div>}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                <div className="section-label" style={{ margin: 0 }}>
                  Postojeći objekti · {allObjects.length}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', opacity: 0.6 }}>kliknite za uređivanje</div>
              </div>

              <div className="admin-list">
                <div className="admin-row head">
                  <div />
                  <div>Naziv / kategorija</div>
                  <div>Status</div>
                  <div />
                </div>
                {allObjects.map((loc) => (
                  <div
                    className="admin-row"
                    key={loc.id}
                    onClick={() => navigate(`/admin/objekat/${loc.slug}`)}
                  >
                    <div className="swatch"><PinGlyph cat={loc.catId} size={22} /></div>
                    <div>
                      <div className="row-name">{loc.name}</div>
                      <div className="row-cat">
                        {ctx.categories.find((c) => c.id === loc.catId)?.label} · {loc.address}
                      </div>
                    </div>
                    <div className={`row-status ${loc.status === 'draft' ? 'draft' : ''}`}>
                      {loc.status === 'draft' ? 'nacrt' : 'objavljen'}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="row-action"
                        onClick={(e) => { e.stopPropagation(); toggleStatus(loc); }}
                        title={loc.status === 'published' ? 'Vrati u nacrt' : 'Objavi'}
                      >
                        {loc.status === 'published' ? 'Vrati u nacrt' : 'Objavi'}
                      </button>
                      <button
                        className="row-action danger"
                        onClick={(e) => { e.stopPropagation(); deleteLocation(loc); }}
                        title="Obriši"
                        aria-label={`Obriši ${loc.name}`}
                      >
                        Obriši
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'reservations' && <ReservationsInbox />}
        {tab === 'users' && <UsersTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}
