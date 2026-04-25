import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import type {
  CafeContent, HotelContent, LandmarkContent, Location, LocationWithContent,
  PublicContent, SchoolContent,
} from '../types';
import { CafeForm } from './forms/CafeForm';
import { PublicForm } from './forms/PublicForm';
import { HotelForm } from './forms/HotelForm';
import { LandmarkForm } from './forms/LandmarkForm';
import { SchoolForm } from './forms/SchoolForm';
import { defaultContentFor } from './defaults';
import { FieldRow, TextInput } from './forms/widgets';

export function EditLocation() {
  const ctx = useOutletContext<AppContext>();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [loc, setLoc] = useState<Location | null>(null);
  const [content, setContent] = useState<Record<string, unknown>>({});
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [address, setAddress] = useState('');
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

  const renderForm = () => {
    const c = content as unknown;
    const update = (v: unknown) => setContent(v as Record<string, unknown>);
    switch (loc.catId) {
      case 'cafe':     return <CafeForm     value={c as CafeContent}     onChange={update} />;
      case 'public':   return <PublicForm   value={c as PublicContent}   onChange={update} />;
      case 'hotel':    return <HotelForm    value={c as HotelContent}    onChange={update} />;
      case 'landmark': return <LandmarkForm value={c as LandmarkContent} onChange={update} />;
      case 'school':   return <SchoolForm   value={c as SchoolContent}   onChange={update} />;
    }
  };

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
                fontFamily: 'Fraunces, serif', fontWeight: 500,
                fontSize: 32, letterSpacing: '-0.02em', margin: '4px 0 0',
                color: 'var(--paper)',
              }}>
                Uredi: {loc.name}
              </h1>
            </div>
            <button
              className="nav-btn"
              onClick={() => window.open(`/objekat/${loc.slug}`, '_blank')}
            >
              Pregled →
            </button>
          </div>
        </div>
      </div>

      <div className="admin-container">
        <div className="edit-grid">
          <div className="admin-card">
            <div className="section-label" style={{ margin: 0, marginBottom: 16 }}>Osnovni podaci</div>
            <FieldRow label="Naziv"><TextInput value={name} onChange={setName} /></FieldRow>
            <FieldRow label="Podnaslov"><TextInput value={subtitle} onChange={setSubtitle} /></FieldRow>
            <FieldRow label="Adresa"><TextInput value={address} onChange={setAddress} /></FieldRow>
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

            <button
              className="btn-primary"
              style={{ marginTop: 18, position: 'sticky', bottom: 16 }}
              onClick={submit}
              disabled={busy || !name || !address}
            >
              {busy ? 'Čuvanje…' : 'Sačuvaj izmene'}
            </button>
            {saved && <div style={{ fontSize: 12, color: 'var(--moss)', marginTop: 8, textAlign: 'center' }}>✓ Sačuvano</div>}
            {error && <div className="login-error">{error}</div>}

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

          <div className="admin-card">
            <div className="section-label" style={{ margin: 0, marginBottom: 16 }}>Sadržaj modula</div>
            {renderForm()}
          </div>
        </div>
      </div>
    </div>
  );
}
