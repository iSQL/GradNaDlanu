import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import { SELA_ZABARI } from '../lib/villages';
import { AD_CATEGORY_LABELS, type Ad, type AdCategory } from '../types';
import { AdCard } from '../components/AdCard';
import { AdDetail } from '../components/AdDetail';
import { AdForm } from '../components/AdForm';

export function OglasiPage() {
  const { currentUser } = useOutletContext<AppContext>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [ads, setAds] = useState<Ad[] | null>(null);
  const [myAds, setMyAds] = useState<Ad[] | null>(null);
  const [category, setCategory] = useState<AdCategory | 'all'>('all');
  const [village, setVillage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [detailAd, setDetailAd] = useState<Ad | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editAd, setEditAd] = useState<Ad | null>(null);
  const [showMine, setShowMine] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const rows = await api.listOglasi({
        category: category === 'all' ? undefined : category,
        village: village || undefined,
      });
      setAds(rows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [category, village]);

  const reloadMine = useCallback(async () => {
    if (!currentUser || currentUser.role === 'guest') {
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

  // Deep link: /oglasi?id=<n> opens that ad (works for owners' archived ads too).
  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) return;
    const n = Number(id);
    if (!Number.isFinite(n)) return;
    api.getOglas(n).then(setDetailAd).catch(() => {});
    const params = new URLSearchParams(searchParams);
    params.delete('id');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const canPost = currentUser && currentUser.role !== 'guest';

  const onSaved = async (ad: Ad) => {
    setFormOpen(false);
    setEditAd(null);
    await Promise.all([reload(), reloadMine()]);
    if (ad.status === 'active') setDetailAd(ad);
  };

  const onArchived = async () => {
    setDetailAd(null);
    await Promise.all([reload(), reloadMine()]);
  };

  const openCreate = () => { setEditAd(null); setFormOpen(true); };
  const openEdit = (ad: Ad) => { setDetailAd(null); setEditAd(ad); setFormOpen(true); };

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
            <select className="ms-field-input" value={village} onChange={(e) => setVillage(e.target.value)}>
              <option value="">Sva sela</option>
              {SELA_ZABARI.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            {canPost ? (
              <button className="ms-btn ms-btn-primary ms-btn-sm" onClick={openCreate}>+ Dodaj oglas</button>
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
                    <button className="oglasi-mine-item" onClick={() => setDetailAd(a)}>
                      <span className="oglasi-mine-title">{a.title}</span>
                      <span className={`oglas-badge cat-${a.status === 'archived' ? 'arhiva' : a.category}`}>
                        {a.status === 'archived' ? 'arhiviran' : AD_CATEGORY_LABELS[a.category]}
                      </span>
                    </button>
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
        ) : (
          <div className="oglasi-grid">
            {ads.map((ad) => (
              <AdCard key={ad.id} ad={ad} onOpen={setDetailAd} />
            ))}
          </div>
        )}
      </div>

      {detailAd && (
        <AdDetail
          ad={detailAd}
          currentUser={currentUser}
          onClose={() => setDetailAd(null)}
          onEdit={openEdit}
          onArchived={onArchived}
        />
      )}
      {formOpen && (
        <AdForm initial={editAd} onSaved={onSaved} onCancel={() => { setFormOpen(false); setEditAd(null); }} />
      )}
    </div>
  );
}
