import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import { SELA_ZABARI } from '../lib/villages';
import { LocationContentEditor } from '../admin/LocationContentEditor';
import { defaultContentFor } from '../admin/defaults';
import { FieldRow, TextInput } from '../admin/forms/widgets';
import { OwnerEventsEditor } from '../components/OwnerEventsEditor';
import { OwnerNewsEditor } from '../components/OwnerNewsEditor';
import { OwnerAlumniEditor } from '../components/OwnerAlumniEditor';
import { ReservationsInbox } from '../admin/ReservationsInbox';
import { ModuleTabs, type TabDef } from '../modules/ModuleTabs';
import type { Location, LocationWithContent } from '../types';

export function OwnerEditLocation() {
  const ctx = useOutletContext<AppContext>();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [loc, setLoc] = useState<Location | null>(null);
  const [content, setContent] = useState<Record<string, unknown>>({});
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [address, setAddress] = useState('');
  const [village, setVillage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setError(null);
    setSaved(false);
    api.getLocation(slug)
      .then((data: LocationWithContent) => {
        setLoc(data);
        setName(data.name);
        setSubtitle(data.subtitle ?? '');
        setAddress(data.address);
        setVillage(data.village ?? '');
        const c = (data.content && Object.keys(data.content).length > 0)
          ? (data.content as Record<string, unknown>)
          : defaultContentFor(data.catId);
        setContent(c);
      })
      .catch((err: Error) => setError(err.message));
  }, [slug]);

  const ownsThis = !!loc && (
    ctx.currentUser?.role === 'admin' ||
    !!ctx.currentUser?.ownedLocationIds.includes(loc.id)
  );

  if (error && !loc) {
    return (
      <div className="account-page"><div className="account-shell"><p className="login-error">{error}</p></div></div>
    );
  }
  if (!loc) return <div className="account-page" />;
  if (!ownsThis) {
    return (
      <div className="account-page">
        <div className="account-shell">
          <h1>Nemate dozvolu</h1>
          <p>Ovaj objekat nije pod vašim vlasništvom.</p>
        </div>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.ownerUpdateLocation(loc.id, { name, subtitle, address, village: village || null, content });
      await ctx.reloadLocations();
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const catLabel = ctx.categories.find((c) => c.id === loc.catId)?.label ?? loc.catId;

  const saveBar = (
    <>
      <button className="btn-primary" style={{ marginTop: 18 }} disabled={busy || !name || !address} onClick={submit}>
        {busy ? 'Čuvanje…' : 'Sačuvaj izmene'}
      </button>
      {saved && <div style={{ fontSize: 12, color: 'var(--moss)', marginTop: 8, textAlign: 'center' }}>✓ Sačuvano</div>}
      {error && <div className="login-error">{error}</div>}
    </>
  );

  const tabs: TabDef[] = [
    {
      key: 'osnovni',
      label: 'Osnovni podaci',
      render: () => (
        <div className="admin-card">
          <FieldRow label="Naziv"><TextInput value={name} onChange={setName} /></FieldRow>
          <FieldRow label="Podnaslov"><TextInput value={subtitle} onChange={setSubtitle} /></FieldRow>
          <FieldRow label="Adresa"><TextInput value={address} onChange={setAddress} /></FieldRow>
          <FieldRow label="Selo">
            <select
              className="field-input"
              value={village}
              onChange={(e) => setVillage(e.target.value)}
            >
              <option value="">— nije izabrano —</option>
              {SELA_ZABARI.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </FieldRow>
          <div style={{ fontSize: 11, color: 'var(--ink-2)', opacity: 0.7, lineHeight: 1.5, marginTop: 4 }}>
            Položaj na mapi i kategorija se ne mogu menjati ovde — kontaktirajte administraciju.
          </div>
          {saveBar}
        </div>
      ),
    },
    {
      key: 'sadrzaj',
      label: 'Sadržaj',
      render: () => (
        <div className="admin-card">
          <LocationContentEditor catId={loc.catId} value={content} onChange={setContent} />
          {saveBar}
        </div>
      ),
    },
    {
      key: 'dogadjaji',
      label: 'Najavljeni događaji',
      render: () => (
        <div className="admin-card">
          <OwnerEventsEditor locationId={loc.id} />
        </div>
      ),
    },
    {
      key: 'obavestenja',
      label: 'Obaveštenja',
      render: () => (
        <div className="admin-card">
          <OwnerNewsEditor locationId={loc.id} />
        </div>
      ),
    },
    {
      key: 'rezervacije',
      label: 'Rezervacije',
      isEmpty: loc.catId !== 'cafe' && loc.catId !== 'hotel',
      render: () => (
        <div className="admin-card">
          <ReservationsInbox locationId={loc.id} />
        </div>
      ),
    },
    ...(loc.catId === 'school'
      ? [{
          key: 'alumni',
          label: 'Alumni',
          render: () => (
            <div className="admin-card">
              <OwnerAlumniEditor locationId={loc.id} />
            </div>
          ),
        }]
      : []),
  ];

  return (
    <div className="module-page">
      <div style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '32px 48px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <button className="module-back" onClick={() => navigate('/poslovni')} style={{ marginBottom: 12 }}>
            ← Nazad u poslovni panel
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, justifyContent: 'space-between' }}>
            <div>
              <div className="module-cat">{catLabel}</div>
              <h1 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500, fontSize: 32, letterSpacing: '-0.02em', margin: '4px 0 0', color: 'var(--paper)' }}>
                Uredi: {loc.name}
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(loc.catId === 'cafe' || loc.catId === 'hotel') && (
                <button className="nav-btn" onClick={() => navigate(`/poslovni/objekti/${loc.slug}/mapa`)}>
                  Plan prostora →
                </button>
              )}
              <button className="nav-btn" onClick={() => window.open(`/objekat/${loc.slug}`, '_blank')}>
                Pregled →
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="module-body tabs">
        <ModuleTabs tabs={tabs} />
      </div>
    </div>
  );
}
