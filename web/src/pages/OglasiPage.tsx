import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import { SELA_ZABARI } from '../lib/villages';
import { AD_CATEGORY_LABELS, type Ad, type AdCategory } from '../types';
import { AdCard, AdRow } from '../components/AdCard';
import { AdForm } from '../components/AdForm';

type ViewMode = 'grid' | 'compact';
const VIEW_KEY = 'gnd.oglasiView';

function initialView(): ViewMode {
  return localStorage.getItem(VIEW_KEY) === 'compact' ? 'compact' : 'grid';
}

export function OglasiPage() {
  const { currentUser, guestsCanPostAds } = useOutletContext<AppContext>();
  const navigate = useNavigate();

  const [ads, setAds] = useState<Ad[] | null>(null);
  const [myAds, setMyAds] = useState<Ad[] | null>(null);
  const [category, setCategory] = useState<AdCategory | 'all'>('all');
  const [village, setVillage] = useState('');
  const [view, setView] = useState<ViewMode>(initialView);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [showMine, setShowMine] = useState(false);

  const setViewMode = (next: ViewMode) => {
    setView(next);
    localStorage.setItem(VIEW_KEY, next);
  };

  const reload = useCallback(async () => {
    setError(null);
    try {
      setAds(
        await api.listOglasi({
          category: category === 'all' ? undefined : category,
          village: village || undefined,
        }),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [category, village]);

  const reloadMine = useCallback(async () => {
    if (!currentUser) {
      setMyAds(null);
      return;
    }
    try {
      setMyAds(await api.myOglasi());
    } catch {
      setMyAds(null);
    }
  }, [currentUser]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { reloadMine(); }, [reloadMine]);

  // Guests may post only if the admin enabled it (mirrors the server gate).
  const canPost = !!currentUser && (currentUser.role !== 'guest' || guestsCanPostAds);

  const onSaved = async (ad: Ad) => {
    setFormOpen(false);
    await Promise.all([reload(), reloadMine()]);
    navigate(`/oglasi/${ad.id}`);
  };

  const CATS: (AdCategory | 'all')[] = ['all', 'prodajem', 'kupujem', 'usluge', 'poslovi', 'ostalo'];

  return (
    <div className="page page-oglasi">
      <div className="page-shell">
        <header className="page-head">
          <h1>Oglasna tabla</h1>
          <p className="page-sub">Mali oglasi stanovnika opštine Žabari. Oglasi traju 7 dana.</p>
        </header>

        <div className="oglasi-toolbar">
          <div className="oglasi-cats">
            {CATS.map((c) => (
              <button
                key={c}
                className={`oglasi-cat-chip ${category === c ? 'is-active' : ''}`}
                onClick={() => setCategory(c)}
              >
                {c === 'all' ? 'Sve' : AD_CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
          <div className="oglasi-toolbar-right">
            <div className="oglasi-view-switch" role="group" aria-label="Prikaz oglasa">
              <button
                className={`oglasi-view-btn ${view === 'grid' ? 'is-active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Mreža"
                aria-pressed={view === 'grid'}
              >
                ▦ Mreža
              </button>
              <button
                className={`oglasi-view-btn ${view === 'compact' ? 'is-active' : ''}`}
                onClick={() => setViewMode('compact')}
                title="Kompaktno"
                aria-pressed={view === 'compact'}
              >
                ☰ Lista
              </button>
            </div>
            <select className="ms-field-input" value={village} onChange={(e) => setVillage(e.target.value)}>
              <option value="">Sva sela</option>
              {SELA_ZABARI.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            {canPost ? (
              <button className="ms-btn ms-btn-primary ms-btn-sm" onClick={() => setFormOpen(true)}>
                + Dodaj oglas
              </button>
            ) : currentUser ? (
              <span className="oglas-contact-note">Za oglas je potreban trajan nalog.</span>
            ) : (
              <Link to="/prijava" className="ms-btn ms-btn-primary ms-btn-sm">Prijavi se za oglas</Link>
            )}
          </div>
        </div>

        {myAds && myAds.length > 0 && (
          <div className="oglasi-mine">
            <button className="oglasi-mine-toggle" onClick={() => setShowMine((v) => !v)}>
              {showMine ? '▾' : '▸'} Moji oglasi ({myAds.length})
            </button>
            {showMine && (
              <ul className="oglasi-mine-list">
                {myAds.map((a) => (
                  <li key={a.id}>
                    <Link className="oglasi-mine-item" to={`/oglasi/${a.id}`}>
                      <span className="oglasi-mine-title">{a.title}</span>
                      <span className={`oglas-badge static cat-${a.status === 'archived' ? 'arhiva' : a.category}`}>
                        {a.status === 'archived' ? 'arhiviran' : AD_CATEGORY_LABELS[a.category]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && <div className="ms-error">{error}</div>}

        {ads === null ? (
          <div className="empty-state">Učitavanje oglasa…</div>
        ) : ads.length === 0 ? (
          <div className="empty-state">Nema oglasa za izabrane filtere.</div>
        ) : view === 'grid' ? (
          <div className="oglasi-grid">
            {ads.map((ad) => <AdCard key={ad.id} ad={ad} />)}
          </div>
        ) : (
          <div className="oglasi-compact">
            {ads.map((ad) => <AdRow key={ad.id} ad={ad} />)}
          </div>
        )}
      </div>

      {formOpen && (
        <AdForm initial={null} onSaved={onSaved} onCancel={() => setFormOpen(false)} />
      )}
    </div>
  );
}
