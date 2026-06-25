import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import type { Ad } from '../types';
import { AdDetailBody } from '../components/AdDetailBody';
import { AdForm } from '../components/AdForm';

export function OglasDetailPage() {
  const { id } = useParams();
  const { currentUser } = useOutletContext<AppContext>();
  const navigate = useNavigate();

  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAd(await api.getOglas(Number(id)));
    } catch {
      setAd(null);
      setError('Oglas nije pronađen ili je uklonjen.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  return (
    <div className="page page-oglasi">
      <div className="page-shell oglas-detail-shell">
        <div className="oglas-detail-top">
          <Link to="/oglasi" className="oglas-detail-back">← Nazad na oglase</Link>
          {ad && (
            <button className="ms-btn ms-btn-sm" onClick={copyLink} type="button">
              {copied ? 'Link kopiran ✓' : 'Kopiraj link'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="empty-state">Učitavanje…</div>
        ) : error || !ad ? (
          <div className="empty-state">{error ?? 'Oglas nije pronađen.'}</div>
        ) : (
          <AdDetailBody
            ad={ad}
            currentUser={currentUser}
            onEdit={() => setFormOpen(true)}
            onArchived={() => navigate('/oglasi')}
          />
        )}
      </div>

      {formOpen && ad && (
        <AdForm
          initial={ad}
          onSaved={() => {
            setFormOpen(false);
            void load();
          }}
          onCancel={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}
