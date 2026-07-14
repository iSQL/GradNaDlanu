import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { problemCat, problemStatusLabel } from '../lib/problemi';
import { ProblemBadge } from './ProblemGlyph';
import type { Problem } from '../types';

interface Props {
  // 'recent' → najnovije prijave; 'votes' → najpopularnije (po glasovima).
  sort?: 'recent' | 'votes';
  kicker?: string;
  title?: string;
  // CTA "Prijavi novi problem" — prikazuje se samo na jednom widgetu kad ih ima
  // dva jedan pored drugog, da se dugme ne duplira.
  showCta?: boolean;
}

// Kompaktni widget za naslovnu — 3 prijave građana (najnovije ili najpopularnije)
// sa linkom na punu listu (vidi doc/design/prijava-problema.html).
export function ProblemiWidget({
  sort = 'recent',
  kicker = 'Grad na dlanu',
  title = 'Najnovije prijave građana',
  showCta = true,
}: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Problem[] | null>(null);

  useEffect(() => {
    api
      .listProblemi({ sort, limit: 3 })
      .then(setItems)
      .catch(() => setItems([]));
  }, [sort]);

  if (items !== null && items.length === 0) return null;

  return (
    <div className="prb-widget">
      <div className="prb-widget-head">
        <div>
          <div className="prb-widget-kicker">{kicker}</div>
          <div className="prb-widget-title">{title}</div>
        </div>
        <Link to="/problemi" className="hp-link">
          Vidi sve →
        </Link>
      </div>
      <div>
        {(items ?? []).map((p) => (
          <button key={p.id} className="prb-widget-row" onClick={() => navigate(`/problemi/${p.id}`)}>
            <ProblemBadge id={p.catId} size={36} />
            <span className="prb-widget-text">
              <span className="prb-widget-item-title">{p.title}</span>
              <span className="prb-widget-item-meta">
                {problemCat(p.catId).short} · {p.village}
              </span>
            </span>
            <span className="prb-widget-side">
              <span className="prb-widget-votes">▲ {p.votes}</span>
              <span className={`prb-dot-status prb-dot-${p.status}`}>{problemStatusLabel(p.status)}</span>
            </span>
          </button>
        ))}
        {items === null && <div className="home-skeleton-card" />}
      </div>
      {showCta && (
        <Link to="/problemi/prijava" className="prb-widget-cta">
          ＋ Prijavi novi problem
        </Link>
      )}
    </div>
  );
}
