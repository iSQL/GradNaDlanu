import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { SELA_ZABARI } from '../lib/villages';
import {
  PROBLEM_CATEGORIES,
  problemCat,
  problemDateLabel,
  problemStatusLabel,
} from '../lib/problemi';
import { ProblemBadge } from '../components/ProblemGlyph';
import type { Problem } from '../types';

function IconComment() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 3.5h11v7h-6l-3 2.2V10.5h-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

const ProblemsOverviewMap = lazy(() =>
  import('../components/ProblemsMap').then((m) => ({ default: m.ProblemsOverviewMap })),
);

export type ProblemiView = 'list' | 'map' | 'archive';

const TABS: { view: ProblemiView; to: string; label: string }[] = [
  { view: 'list', to: '/problemi', label: 'Prijave' },
  { view: 'map', to: '/problemi/mapa', label: 'Mapa' },
  { view: 'archive', to: '/problemi/arhiva', label: 'Arhiva rešenih' },
];

function IconVoteUp() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 9l4-4 4 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ProblemiPage({ view }: { view: ProblemiView }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'solved'>('all');
  const [villageFilter, setVillageFilter] = useState('');
  const [sort, setSort] = useState<'votes' | 'recent'>('votes');

  // Toast posle uspešne prijave — PrijaviProblemPage navigira ovde sa state-om.
  const [toast, setToast] = useState<string | null>(
    (location.state as { toast?: string } | null)?.toast ?? null,
  );
  useEffect(() => {
    if (!toast) return;
    // Očisti router state da refresh ne ponovi toast.
    window.history.replaceState({}, '');
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    api
      .listProblemi({ limit: 200 })
      .then(setProblems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const visible = useMemo(() => {
    if (!problems) return [];
    let arr = problems.slice();
    if (view === 'archive') arr = arr.filter((p) => p.status === 'solved');
    else if (statusFilter !== 'all') arr = arr.filter((p) => p.status === statusFilter);
    if (catFilter !== 'all') arr = arr.filter((p) => p.catId === catFilter);
    if (view !== 'map' && villageFilter) arr = arr.filter((p) => p.village === villageFilter);
    arr.sort(
      sort === 'votes'
        ? (a, b) => b.votes - a.votes || +new Date(b.createdAt) - +new Date(a.createdAt)
        : (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    );
    return arr;
  }, [problems, view, catFilter, statusFilter, villageFilter, sort]);

  const vote = async (p: Problem) => {
    try {
      const r = await api.voteProblem(p.id);
      setProblems((prev) =>
        prev ? prev.map((x) => (x.id === p.id ? { ...x, voted: r.voted, votes: r.votes } : x)) : prev,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // 401 → nije ulogovan: glasanje traži nalog.
      if (msg.startsWith('401')) navigate('/prijava');
      else setError(msg);
    }
  };

  return (
    <div className="page page-problemi">
      <div className="page-shell">
        <div className="prb-tabs" role="tablist">
          {TABS.map((t) => (
            <Link
              key={t.view}
              to={t.to}
              role="tab"
              aria-selected={view === t.view}
              className={`prb-tab ${view === t.view ? 'is-active' : ''}`}
            >
              {t.label}
            </Link>
          ))}
          <Link to="/problemi/prijava" className="prb-tab prb-tab-cta">
            ＋ Prijavi problem
          </Link>
        </div>

        <header className="page-head">
          <h1>
            {view === 'archive'
              ? 'Arhiva rešenih problema'
              : view === 'map'
                ? 'Mapa problema'
                : 'Prijavljeni problemi'}
          </h1>
          <p className="page-sub">
            {view === 'archive'
              ? 'Problemi koje je opština rešila — zahvaljujući prijavama i glasovima građana.'
              : view === 'map'
                ? 'Prijavljeni problemi na satelitskoj mapi opštine. Kliknite na pin da otvorite prijavu.'
                : 'Prijavite komunalni problem i glasajte za tuđe prijave — najpodržaniji problemi su na vrhu i imaju prioritet.'}
          </p>
        </header>

        <div className="prb-cat-chips">
          <button
            className={`prb-chip ${catFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => setCatFilter('all')}
          >
            Sve
          </button>
          {PROBLEM_CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`prb-chip ${catFilter === c.id ? 'is-active' : ''}`}
              style={catFilter === c.id ? { background: c.color, borderColor: c.color } : undefined}
              onClick={() => setCatFilter(c.id)}
            >
              {c.short}
            </button>
          ))}
        </div>

        {view !== 'map' && (
          <div className="prb-filter-bar">
            <div className="prb-filter-group">
              <label className="prb-filter">
                Naselje
                <select
                  className="ms-field-input"
                  value={villageFilter}
                  onChange={(e) => setVillageFilter(e.target.value)}
                >
                  <option value="">Sva naselja</option>
                  {SELA_ZABARI.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              {view === 'list' && (
                <label className="prb-filter">
                  Status
                  <select
                    className="ms-field-input"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'open' | 'solved')}
                  >
                    <option value="all">Svi</option>
                    <option value="open">Otvoreni</option>
                    <option value="solved">Rešeni</option>
                  </select>
                </label>
              )}
            </div>
            <label className="prb-filter">
              Poređaj
              <select
                className="ms-field-input"
                value={sort}
                onChange={(e) => setSort(e.target.value as 'votes' | 'recent')}
              >
                <option value="votes">Najviše glasova</option>
                <option value="recent">Najnovije</option>
              </select>
            </label>
          </div>
        )}

        {error && <div className="ms-error">{error}</div>}

        {view === 'map' ? (
          <div className="prb-map-wrap">
            <Suspense fallback={<div className="prb-map-loading">Učitavanje mape…</div>}>
              <ProblemsOverviewMap
                problems={visible}
                onPinClick={(p) => navigate(`/problemi/${p.id}`)}
              />
            </Suspense>
            <div className="prb-map-legend">
              <div className="prb-map-legend-title">Kategorije</div>
              {PROBLEM_CATEGORIES.map((c) => (
                <div key={c.id} className="prb-map-legend-row">
                  <ProblemBadge id={c.id} size={22} />
                  <span>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : problems === null ? (
          <div className="prb-empty">Učitavanje…</div>
        ) : visible.length === 0 ? (
          <div className="prb-empty">Nema prijava koje odgovaraju filteru.</div>
        ) : (
          <div className="prb-list">
            {visible.map((p) => (
              <article key={p.id} className="prb-card">
                <button
                  className={`prb-vote-btn ${p.voted ? 'is-voted' : ''}`}
                  title="Podrži prioritet glasom"
                  onClick={() => vote(p)}
                >
                  <IconVoteUp />
                  <span className="prb-vote-count">{p.votes}</span>
                  <span className="prb-vote-label">glasova</span>
                </button>
                <button className="prb-card-main" onClick={() => navigate(`/problemi/${p.id}`)}>
                  <ProblemBadge id={p.catId} size={42} />
                  <span className="prb-card-text">
                    <span className="prb-card-cat" style={{ color: problemCat(p.catId).color }}>
                      {problemCat(p.catId).label}
                    </span>
                    <span className="prb-card-title">{p.title}</span>
                    <span className="prb-card-meta">
                      {p.village}
                      {p.address ? ` · ${p.address}` : ''}
                    </span>
                  </span>
                </button>
                <div className="prb-card-side">
                  <span className={`prb-status prb-status-${p.status}`}>
                    {problemStatusLabel(p.status)}
                  </span>
                  <span className="prb-card-comments">
                    <IconComment /> {p.commentCount}
                  </span>
                  <span className="prb-card-date">{problemDateLabel(p.createdAt)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {toast && <div className="prb-toast">{toast}</div>}
    </div>
  );
}
