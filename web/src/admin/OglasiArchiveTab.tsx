import { useEffect, useState } from 'react';
import { api, mediaUrl } from '../lib/api';
import { formatDate } from '../lib/format';
import { AD_CATEGORY_LABELS, type Ad } from '../types';

export function OglasiArchiveTab() {
  const [rows, setRows] = useState<Ad[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const reload = async () => {
    setError(null);
    try {
      setRows(await api.adminListArchivedOglasi());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => { reload(); }, []);

  const restore = async (id: number) => {
    setBusyId(id);
    try {
      await api.adminRestoreOglas(id);
      await reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const togglePermanent = async (ad: Ad) => {
    setBusyId(ad.id);
    try {
      await api.adminSetOglasPermanent(ad.id, !ad.permanent);
      await reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="section-label" style={{ marginTop: 0, marginBottom: 14 }}>
        Arhivirani oglasi {rows ? `· ${rows.length}` : ''}
      </div>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', opacity: 0.75, marginTop: 0 }}>
        Oglasi koje korisnik nije osvežio 7 dana (ili su ručno arhivirani). „Vrati" ih
        ponovo objavljuje sa svežih 7 dana. „Trajan" izuzima oglas iz automatskog brisanja.
      </p>

      {error && <div className="login-error">{error}</div>}

      {rows === null ? (
        <div className="empty-state">Učitavanje…</div>
      ) : rows.length === 0 ? (
        <div className="empty-state">Nema arhiviranih oglasa.</div>
      ) : (
        <div className="admin-list">
          <div className="admin-row head">
            <div />
            <div>Naslov / autor</div>
            <div>Kategorija</div>
            <div />
          </div>
          {rows.map((ad) => (
            <div className="admin-row" key={ad.id}>
              <div className="swatch">
                {ad.photoMediaId ? (
                  <img
                    src={mediaUrl(ad.photoMediaId)}
                    alt=""
                    style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }}
                  />
                ) : null}
              </div>
              <div>
                <div className="row-name">{ad.title}</div>
                <div className="row-cat">
                  {ad.authorDisplayName} · {ad.village} · arhiviran {formatDate(ad.updatedAt)}
                  {ad.permanent ? ' · TRAJAN' : ''}
                </div>
              </div>
              <div className="row-cat">{AD_CATEGORY_LABELS[ad.category]}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="row-action" disabled={busyId === ad.id} onClick={() => restore(ad.id)}>
                  Vrati
                </button>
                <button className="row-action" disabled={busyId === ad.id} onClick={() => togglePermanent(ad)}>
                  {ad.permanent ? 'Ukloni trajno' : 'Trajan'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
