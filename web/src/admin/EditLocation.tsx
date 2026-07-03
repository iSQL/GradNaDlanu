import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import { SELA_ZABARI } from '../lib/villages';
import type { Location, LocationWithContent } from '../types';
import { LocationContentEditor } from './LocationContentEditor';
import { defaultContentFor } from './defaults';
import { FieldRow, TextInput } from './forms/widgets';
import { ReservationsInbox } from './ReservationsInbox';
import { OwnerEventsEditor } from '../components/OwnerEventsEditor';
import { OwnerNewsEditor } from '../components/OwnerNewsEditor';
import { OwnerAlumniEditor } from '../components/OwnerAlumniEditor';
import { ModuleTabs, type TabDef } from '../modules/ModuleTabs';

export function EditLocation() {
  const ctx = useOutletContext<AppContext>();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [loc, setLoc] = useState<Location | null>(null);
  const [content, setContent] = useState<Record<string, unknown>>({});
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [address, setAddress] = useState('');
  const [village, setVillage] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
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
        setLat(String(data.lat));
        setLng(String(data.lng));
        setStatus(data.status);
        const c = (data.content && Object.keys(data.content).length > 0)
          ? (data.content as Record<string, unknown>)
          : defaultContentFor(data.catId);
        setContent(c);
      })
      .catch((err: Error) => setError(err.message));
  }, [slug]);

  const catLabel = useMemo(
    () => loc ? ctx.categories.find((c) => c.id === loc.catId)?.label ?? loc.catId : '',
    [loc, ctx.categories],
  );

  if (error && !loc) {
    return (
      <div className="module-page">
        <div className="admin-container"><p className="login-error">{error}</p></div>
      </div>
    );
  }
  if (!loc) return <div className="module-page" />;

  const submit = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.adminUpdateLocation(loc.id, {
        name,
        subtitle,
        address,
        village: village || null,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        status,
        content,
      });
      await ctx.reloadLocations();
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!loc) return;
    if (!window.confirm(`Obrisati "${loc.name}"? Ova radnja je trajna.`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminDeleteLocation(loc.id);
      await ctx.reloadLocations();
      navigate('/admin');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const saveBar = (
    <>
      <button
        className="btn-primary"
        style={{ marginTop: 18 }}
        onClick={submit}
        disabled={busy || !name || !address}
      >
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FieldRow label="Lat"><TextInput value={lat} onChange={setLat} /></FieldRow>
            <FieldRow label="Lng"><TextInput value={lng} onChange={setLng} /></FieldRow>
          </div>

          <div className="field-label" style={{ marginTop: 4 }}>Status</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`time-chip ${status === 'draft' ? 'selected' : ''}`}
              onClick={() => setStatus('draft')}
              style={{ flex: 1 }}
            >
              nacrt
            </button>
            <button
              type="button"
              className={`time-chip ${status === 'published' ? 'selected' : ''}`}
              onClick={() => setStatus('published')}
              style={{ flex: 1 }}
            >
              objavljen
            </button>
          </div>

          {saveBar}

          <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px dashed var(--line)' }}>
            <div className="field-label" style={{ color: 'var(--rust)' }}>Opasna zona</div>
            <button
              type="button"
              className="row-action danger"
              style={{ width: '100%', padding: '10px 14px', fontSize: 13 }}
              onClick={remove}
              disabled={busy}
            >
              Obriši objekat
            </button>
          </div>
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
          <button className="module-back" onClick={() => navigate('/admin')} style={{ marginBottom: 12 }}>
            ← Nazad u administraciju
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, justifyContent: 'space-between' }}>
            <div>
              <div className="module-cat">{catLabel}</div>
              <h1 style={{
                fontFamily: 'Marcellus, serif', fontWeight: 500,
                fontSize: 32, letterSpacing: '-0.02em', margin: '4px 0 0',
                color: 'var(--paper)',
              }}>
                Uredi: {loc.name}
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(loc.catId === 'cafe' || loc.catId === 'hotel') && (
                <button className="nav-btn" onClick={() => navigate(`/poslovni/objekti/${loc.slug}/mapa`)}>
                  Plan prostora →
                </button>
              )}
              <button
                className="nav-btn"
                onClick={() => window.open(`/objekat/${loc.slug}`, '_blank')}
              >
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
