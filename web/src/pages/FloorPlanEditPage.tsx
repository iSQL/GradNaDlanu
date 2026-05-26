import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import { FloorPlanEditor } from '../components/floorplan/FloorPlanEditor';
import { defaultLayoutFor } from '../components/floorplan/defaults';
import type { FloorPlanLayout, Location } from '../types';

const EMPTY_LAYOUT: FloorPlanLayout = { width: 600, height: 400, items: [] };

export function FloorPlanEditPage() {
  const ctx = useOutletContext<AppContext>();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [loc, setLoc] = useState<Location | null>(null);
  const [layout, setLayout] = useState<FloorPlanLayout>(EMPTY_LAYOUT);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [conflicts, setConflicts] = useState<Array<{ reservationId: number; missing: string }> | null>(null);

  useEffect(() => {
    if (!slug) return;
    setError(null);
    setSaved(false);
    setConflicts(null);
    api.getLocation(slug)
      .then((data) => setLoc(data))
      .catch((err: Error) => setError(err.message));
    api.getFloorPlan(slug)
      .then((res) => setLayout(res.layout))
      .catch(() => {
        // 404 → no layout yet, keep empty.
      });
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

  const update = (next: FloorPlanLayout) => {
    setLayout(next);
    setDirty(true);
    setSaved(false);
    setConflicts(null);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setConflicts(null);
    setSaved(false);
    try {
      await api.ownerSaveFloorPlan(loc.id, layout);
      setDirty(false);
      setSaved(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Server returns 422 with { conflicts: [...] } when removing items used by active reservations.
      const match = message.match(/422 [^:]*: (.+)/);
      if (match) {
        try {
          const body = JSON.parse(match[1]);
          if (Array.isArray(body.conflicts)) setConflicts(body.conflicts);
          setError(body.error ?? message);
        } catch {
          setError(message);
        }
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (dirty && !window.confirm('Odbaciti nesačuvane izmene?')) return;
    try {
      const res = await api.getFloorPlan(loc.slug);
      setLayout(res.layout);
    } catch {
      setLayout(EMPTY_LAYOUT);
    }
    setDirty(false);
    setSaved(false);
    setConflicts(null);
  };

  const defaultLayout = defaultLayoutFor(loc.catId);

  const loadDefault = () => {
    if (!defaultLayout) return;
    if (!window.confirm('Učitati podrazumevani plan? Trenutni raspored će biti zamenjen (još uvek nije snimljen).')) return;
    setLayout(defaultLayout);
    setDirty(true);
    setSaved(false);
    setConflicts(null);
  };

  return (
    <div className="module-page">
      <div style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '24px 48px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <button
            className="module-back"
            onClick={() => navigate(
              ctx.currentUser?.role === 'admin'
                ? `/admin/objekat/${loc.slug}`
                : `/poslovni/objekti/${loc.slug}`,
            )}
            style={{ marginBottom: 8 }}
          >
            ← Nazad na uređivanje objekta
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'space-between' }}>
            <div>
              <div className="module-cat">Plan prostora</div>
              <h1 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500, fontSize: 26, letterSpacing: '-0.02em', margin: '2px 0 0', color: 'var(--paper)' }}>
                {loc.name}
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {defaultLayout && (
                <button className="nav-btn" disabled={busy} onClick={loadDefault} title="Učitaj podrazumevani raspored za ovu kategoriju">
                  Podrazumevani
                </button>
              )}
              <button className="nav-btn" disabled={!dirty || busy} onClick={reset}>Odbaci</button>
              <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} disabled={!dirty || busy} onClick={save}>
                {busy ? 'Čuvanje…' : 'Sačuvaj plan'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 48px 64px' }}>
        {saved && <div style={{ fontSize: 13, color: 'var(--moss)', marginBottom: 12 }}>✓ Plan sačuvan.</div>}
        {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}
        {conflicts && conflicts.length > 0 && (
          <div className="login-error" style={{ marginBottom: 12 }}>
            Sledeće aktivne rezervacije referenciraju uklonjene stavke — vratite ih u plan ili otkažite rezervacije:
            <ul style={{ margin: '8px 0 0 18px' }}>
              {conflicts.map((c, i) => (
                <li key={i}>Rezervacija #{c.reservationId} — nedostaje {c.missing}</li>
              ))}
            </ul>
          </div>
        )}
        <FloorPlanEditor layout={layout} onChange={update} />
      </div>
    </div>
  );
}
