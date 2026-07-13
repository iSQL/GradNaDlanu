import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import type { AppContext } from '../App';
import { api, mediaUrl } from '../lib/api';
import { problemCat, problemDateLabel, problemStatusLabel } from '../lib/problemi';
import { ProblemBadge } from '../components/ProblemGlyph';
import { RoleBadge } from '../components/RoleBadge';
import { formatDate } from '../lib/format';
import type { ProblemDetail } from '../types';

const ProblemMiniMap = lazy(() =>
  import('../components/ProblemsMap').then((m) => ({ default: m.ProblemMiniMap })),
);

export function ProblemDetailPage() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const { currentUser } = useOutletContext<AppContext>();
  const navigate = useNavigate();

  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = () =>
    api
      .getProblem(id)
      .then(setProblem)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));

  useEffect(() => {
    if (Number.isInteger(id)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) {
    return (
      <div className="page">
        <div className="page-shell">
          <div className="ms-error">{error.startsWith('404') ? 'Prijava nije pronađena.' : error}</div>
        </div>
      </div>
    );
  }
  if (!problem) {
    return (
      <div className="page">
        <div className="page-shell">
          <div className="prb-empty">Učitavanje…</div>
        </div>
      </div>
    );
  }

  const cat = problemCat(problem.catId);
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${problem.lat.toFixed(6)},${problem.lng.toFixed(6)}`;

  const vote = async () => {
    if (!currentUser) return navigate('/prijava');
    try {
      const r = await api.voteProblem(problem.id);
      setProblem({ ...problem, voted: r.voted, votes: r.votes });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = commentDraft.trim();
    if (!body) return;
    setBusy(true);
    try {
      const c = await api.commentProblem(problem.id, body);
      setProblem({
        ...problem,
        commentCount: problem.commentCount + 1,
        comments: [...problem.comments, c],
      });
      setCommentDraft('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: 'solved' | 'open') => {
    setBusy(true);
    try {
      await api.setProblemStatus(problem.id, status);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const commentCountLabel =
    problem.comments.length === 0
      ? 'Bez komentara'
      : `${problem.comments.length} ${problem.comments.length === 1 ? 'komentar' : 'komentara'}`;

  return (
    <div className="page page-problem-detail">
      <div className="page-shell">
        <Link to="/problemi" className="prb-back">
          ← Sve prijave
        </Link>
        <div className="prb-detail">
          <div className="prb-detail-main">
            <span className="prb-card-cat" style={{ color: cat.color }}>
              {cat.label}
            </span>
            <h1 className="prb-detail-title">{problem.title}</h1>
            {problem.photoMediaId !== null && (
              <img
                className="prb-detail-photo"
                src={mediaUrl(problem.photoMediaId)}
                alt={`Fotografija problema: ${problem.title}`}
              />
            )}
            <p className="prb-detail-desc">{problem.description}</p>

            <div className="prb-comments">
              <div className="prb-form-kicker">Komentari građana</div>
              <h2 className="prb-comments-count">{commentCountLabel}</h2>

              {currentUser ? (
                <form className="prb-comment-form" onSubmit={submitComment}>
                  <textarea
                    className="ms-field-input"
                    rows={3}
                    value={commentDraft}
                    maxLength={1000}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    placeholder="Dodajte komentar ili dopunu…"
                  />
                  <button className="btn-primary" disabled={busy || !commentDraft.trim()}>
                    Pošalji komentar
                  </button>
                </form>
              ) : (
                <div className="prb-comment-login">
                  <Link to="/prijava">Prijavite se</Link> da biste komentarisali i glasali.
                </div>
              )}

              {problem.comments.length === 0 && (
                <div className="prb-empty">Još nema komentara — budite prvi.</div>
              )}
              <div className="prb-comment-list">
                {problem.comments.map((c) => (
                  <div key={c.id} className={`prb-comment ${c.official ? 'is-official' : ''}`}>
                    <div className="prb-comment-head">
                      <span className="prb-comment-author">{c.author.displayName}</span>
                      {c.official ? (
                        <span className="prb-official-badge">opština</span>
                      ) : (
                        <RoleBadge role={c.author.role} />
                      )}
                      <span className="prb-comment-date">{problemDateLabel(c.createdAt)}</span>
                    </div>
                    <div className="prb-comment-body">{c.body}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="prb-detail-aside">
            <div className="prb-aside-card">
              <button
                className={`prb-vote-btn prb-vote-wide ${problem.voted ? 'is-voted' : ''}`}
                onClick={vote}
              >
                <span className="prb-vote-tally">
                  <span className="prb-vote-count">{problem.votes}</span>
                  <span className="prb-vote-unit">glasova</span>
                </span>
                <span className="prb-vote-action">
                  <svg className="prb-vote-arrow" width="18" height="18" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M3 9l4-4 4 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="prb-vote-msg">
                    {problem.voted ? 'Glasali ste' : 'Povećajte prioritet'}
                  </span>
                </span>
              </button>
              <div className="prb-aside-divider" />
              <div className="prb-aside-status-row">
                <span className={`prb-status prb-status-${problem.status}`}>
                  {problemStatusLabel(problem.status)}
                </span>
                <ProblemBadge id={problem.catId} size={44} />
              </div>
              <dl className="prb-aside-facts">
                <dt>Kategorija</dt>
                <dd>{cat.label}</dd>
                <dt>Naselje</dt>
                <dd>{problem.village}</dd>
                {problem.address && (
                  <>
                    <dt>Adresa</dt>
                    <dd>{problem.address}</dd>
                  </>
                )}
                <dt>Prijavio</dt>
                <dd>{problem.reporterName ?? 'Anonimno'}</dd>
                <dt>Datum</dt>
                <dd>{problemDateLabel(problem.createdAt)}</dd>
                {problem.solvedAt && (
                  <>
                    <dt>Rešeno</dt>
                    <dd>{formatDate(problem.solvedAt)}</dd>
                  </>
                )}
              </dl>
              <div className="prb-mini-map">
                <Suspense fallback={<div className="prb-map-loading">Mapa…</div>}>
                  <ProblemMiniMap catId={problem.catId} lat={problem.lat} lng={problem.lng} />
                </Suspense>
                {/* Providan overlay iznad neinteraktivne mini-mape — klik vodi na
                    veću mapu u Google Maps (Leaflet paneli gutaju klik ispod). */}
                <a
                  className="prb-mini-map-link"
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Otvori lokaciju u Google mapama"
                  title="Otvori veću mapu"
                />
              </div>
              <div className="prb-coords prb-coords-center">
                {problem.lat.toFixed(5)}, {problem.lng.toFixed(5)}
              </div>
              <div className="prb-map-links">
                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                  Google mape ↗
                </a>
                <Link to="/problemi/mapa">Mapa problema</Link>
              </div>
              {problem.canResolve && (
                <button
                  className={`${problem.status === 'open' ? 'btn-primary' : 'btn-secondary'} prb-resolve-btn`}
                  disabled={busy}
                  onClick={() => setStatus(problem.status === 'open' ? 'solved' : 'open')}
                >
                  {problem.status === 'open' ? '✓ Označi kao rešeno' : 'Ponovo otvori prijavu'}
                </button>
              )}
              {currentUser?.role === 'admin' && (
                <button
                  className="btn-secondary prb-delete-btn"
                  disabled={busy}
                  onClick={async () => {
                    if (!window.confirm('Obrisati ovu prijavu? Ovo je trajno.')) return;
                    await api.adminDeleteProblem(problem.id);
                    navigate('/problemi');
                  }}
                >
                  Obriši prijavu
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
