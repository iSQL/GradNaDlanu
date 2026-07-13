import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api, type CuratorCommentRow } from '../lib/api';
import { clearToken } from '../lib/auth';
import { formatDateTime } from '../lib/format';
import { PinGlyph } from '../components/PinGlyph';
import { AuthImage } from '../components/AuthImage';
import { decadeLabel, decadeOf, storyParagraphs } from '../lib/biseri';
import type { Biser, CategoryId, Location } from '../types';

type Tab = 'objects' | 'comments' | 'biseri' | 'create';

export function CuratorDashboard() {
  const ctx = useOutletContext<AppContext>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('objects');
  const [objects, setObjects] = useState<Location[] | null>(null);
  const [comments, setComments] = useState<CuratorCommentRow[] | null>(null);
  const [pendingBiseri, setPendingBiseri] = useState<Biser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setError(null);
    try {
      setObjects(await api.curatorLocations());
      setComments(await api.curatorComments());
      setPendingBiseri(await api.pendingBiseri());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    clearToken();
    await ctx.reloadCurrentUser();
    navigate('/');
  };

  return (
    <div className="account-page">
      <div className="account-shell">
        <div className="account-header">
          <div>
            <h1>Kustos panel</h1>
            <div className="account-meta">
              {ctx.currentUser?.displayName}
              {ctx.currentUser?.email ? ` · ${ctx.currentUser.email}` : ''}
              {' · '}
              {ctx.currentUser?.curatedVillages && ctx.currentUser.curatedVillages.length > 0
                ? `kustos sela: ${ctx.currentUser.curatedVillages.join(', ')}`
                : 'rola: kustos'}
            </div>
          </div>
          <button className="nav-btn" onClick={logout}>Odjavi se</button>
        </div>

        <div className="account-tabs">
          <button className={`account-tab ${tab === 'objects' ? 'active' : ''}`} onClick={() => setTab('objects')}>
            Objekti {objects && `· ${objects.length}`}
          </button>
          <button className={`account-tab ${tab === 'comments' ? 'active' : ''}`} onClick={() => setTab('comments')}>
            Komentari {comments && `· ${comments.length}`}
          </button>
          <button className={`account-tab ${tab === 'biseri' ? 'active' : ''}`} onClick={() => setTab('biseri')}>
            Biseri {pendingBiseri && pendingBiseri.length > 0 && `· ${pendingBiseri.length}`}
          </button>
          <button className={`account-tab ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>
            Novi objekat
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        {tab === 'objects' && (
          <ObjectsTab objects={objects} categories={ctx.categories} />
        )}

        {tab === 'comments' && (
          <CommentsTab comments={comments} onChanged={reload} />
        )}

        {tab === 'biseri' && (
          <BiseriTab pending={pendingBiseri} onChanged={reload} />
        )}

        {tab === 'create' && (
          <CreateTab
            curatedVillages={ctx.currentUser?.curatedVillages ?? []}
            categories={ctx.categories}
            onCreated={async () => {
              await reload();
              setTab('objects');
            }}
          />
        )}
      </div>
    </div>
  );
}

function ObjectsTab({
  objects,
  categories,
}: { objects: Location[] | null; categories: AppContext['categories'] }) {
  if (objects === null) return <div className="comments-empty">Učitavanje…</div>;
  if (objects.length === 0) {
    return (
      <div className="comments-empty">
        Još nema objekata u vašim selima. Otvorite tab „Novi objekat“ da dodate prvi.
      </div>
    );
  }
  return (
    <div className="account-favorites">
      {objects.map((o) => (
        <div className="favorite-card" key={o.id}>
          <Link to={`/kustos/objekti/${o.slug}`} className="favorite-link">
            <div className="favorite-glyph"><PinGlyph cat={o.catId} size={28} /></div>
            <div>
              <div className="favorite-name">
                {o.name}{' '}
                {o.status === 'draft' && (
                  <span className="curator-status-draft" title="Nacrt — admin tek treba da objavi">
                    nacrt
                  </span>
                )}
              </div>
              <div className="favorite-meta">
                {categories.find((c) => c.id === o.catId)?.label} · {o.village ?? 'bez sela'} · {o.address}
              </div>
            </div>
          </Link>
          {o.status === 'published' && (
            <Link to={`/objekat/${o.slug}`} className="row-action" target="_blank">Pregled</Link>
          )}
        </div>
      ))}
    </div>
  );
}

function CommentsTab({
  comments,
  onChanged,
}: { comments: CuratorCommentRow[] | null; onChanged: () => Promise<void> }) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (comments === null) return <div className="comments-empty">Učitavanje…</div>;
  if (comments.length === 0) return <div className="comments-empty">Još nema komentara u vašim selima.</div>;

  const toggle = async (c: CuratorCommentRow) => {
    setBusyId(c.id);
    setError(null);
    try {
      const next = c.status === 'visible' ? 'hidden' : 'visible';
      await api.curatorSetCommentStatus(c.id, next);
      await onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="account-comments">
      {error && <div className="login-error">{error}</div>}
      {comments.map((c) => (
        <div
          className="comment"
          key={c.id}
          style={{ opacity: c.status === 'hidden' ? 0.55 : 1 }}
        >
          <div className="comment-head">
            <Link to={`/objekat/${c.locationSlug}`} className="comment-loc">{c.locationName}</Link>
            <div className="comment-author">· {c.authorName}</div>
            <div className="comment-date">{formatDateTime(c.createdAt)}</div>
            {c.village && <div className="comment-author">· {c.village}</div>}
          </div>
          <div className="comment-body">{c.body}</div>
          <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
            <button
              className="row-action"
              disabled={busyId === c.id}
              onClick={() => toggle(c)}
            >
              {c.status === 'visible' ? 'Sakrij' : 'Vrati u vidljivo'}
            </button>
            {c.status === 'hidden' && <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>(sakriveno)</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// Predlozi "Zaboravljenih bisera" na čekanju — kustos vidi samo svoja sela
// (server filtrira), odobrava ili odbija. Fotke na čekanju nisu javne, pa idu
// kroz AuthImage (Bearer fetch).
function BiseriTab({
  pending,
  onChanged,
}: { pending: Biser[] | null; onChanged: () => Promise<void> }) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (pending === null) return <div className="comments-empty">Učitavanje…</div>;
  if (pending.length === 0) {
    return <div className="comments-empty">Nema predloga na čekanju — sve je pregledano.</div>;
  }

  const moderate = async (id: number, status: 'published' | 'rejected') => {
    setBusyId(id);
    setError(null);
    try {
      await api.moderateBiser(id, status);
      await onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error && <div className="login-error">{error}</div>}
      {pending.map((b) => (
        <div className="biseri-pending-row" key={b.id}>
          {b.photoMediaId && (
            <AuthImage mediaId={b.photoMediaId} alt={b.title} className="biseri-pending-photo" />
          )}
          <div className="biseri-pending-main">
            <div className="biseri-pending-title">{b.title}</div>
            <div className="biseri-pending-meta">
              {b.year}. ({decadeLabel(decadeOf(b.year))}) · {b.village}
              {b.contributorName ? ` · predložio/la ${b.contributorName}` : ''} ·{' '}
              {formatDateTime(b.createdAt)}
              {b.nowPhotoMediaId ? ' · ima i današnji snimak' : ''}
            </div>
            <div className="biseri-pending-story">
              {storyParagraphs(b.story).map((p, i) => (
                <p key={i} style={{ margin: i === 0 ? 0 : '6px 0 0' }}>{p}</p>
              ))}
            </div>
          </div>
          <div className="biseri-pending-actions">
            <button
              className="btn-primary"
              disabled={busyId === b.id}
              onClick={() => moderate(b.id, 'published')}
            >
              Odobri
            </button>
            <button
              className="btn-secondary"
              disabled={busyId === b.id}
              onClick={() => moderate(b.id, 'rejected')}
            >
              Odbij
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CreateTab({
  curatedVillages,
  categories,
  onCreated,
}: {
  curatedVillages: string[];
  categories: AppContext['categories'];
  onCreated: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const eligibleCategories = useMemo(
    () => categories.filter((c) => c.id !== 'admin' as CategoryId),
    [categories],
  );

  const [catId, setCatId] = useState<CategoryId>('landmark');
  const [village, setVillage] = useState<string>(curatedVillages[0] ?? '');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (curatedVillages.length === 0) {
    return (
      <div className="admin-card">
        Nemate dodeljena sela kao kustos. Admin mora prvo da vam dodeli barem jedno selo.
      </div>
    );
  }

  const submit = async () => {
    if (!name || !address || !village) return;
    setBusy(true);
    setError(null);
    try {
      const row = await api.curatorCreateLocation({
        catId,
        village,
        name,
        address,
        subtitle: subtitle || null,
      });
      await onCreated();
      navigate(`/kustos/objekti/${row.slug}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-card">
      <div className="section-label" style={{ margin: 0, marginBottom: 16 }}>
        Novi objekat (status: nacrt — admin pregled pre objave)
      </div>

      <div className="field-label">Kategorija</div>
      <div className="cat-picker">
        {eligibleCategories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`cat-chip ${catId === c.id ? 'selected' : ''}`}
            onClick={() => setCatId(c.id)}
          >
            <PinGlyph cat={c.id} size={22} />
            {c.short}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="field-label">Selo</div>
        <select
          className="field-input"
          value={village}
          onChange={(e) => setVillage(e.target.value)}
        >
          {curatedVillages.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="field-label">Naziv objekta</div>
        <input
          className="field-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="npr. Manastir Sveta Petka"
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="field-label">Podnaslov (opciono)</div>
        <input
          className="field-input"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="npr. Kulturni spomenik, XIX vek"
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="field-label">Adresa</div>
        <input
          className="field-input"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="npr. Kralja Petra 17"
        />
      </div>

      <button
        className="btn-primary"
        style={{ marginTop: 18 }}
        disabled={!name || !address || !village || busy}
        onClick={submit}
      >
        {busy ? 'Čuvanje…' : 'Sačuvaj kao nacrt'}
      </button>
      {error && <div className="login-error">{error}</div>}
    </div>
  );
}
