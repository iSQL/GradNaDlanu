import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import type { CommentNode } from '../types';
import { IconStar } from './Icons';
import { RoleBadge } from './RoleBadge';

interface Props {
  slug: string;
  canReply: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('sr-RS', { day: 'numeric', month: 'long', year: 'numeric' });
}

function StarPicker({ value, onChange }: { value: number | null; onChange: (n: number | null) => void }) {
  return (
    <div className="star-picker">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-btn ${value !== null && n <= value ? 'on' : ''}`}
          onClick={() => onChange(value === n ? null : n)}
          aria-label={`${n} zvezdica`}
        >
          <IconStar filled={value !== null && n <= value} />
        </button>
      ))}
      {value !== null && (
        <button type="button" className="star-clear" onClick={() => onChange(null)}>
          ukloni ocenu
        </button>
      )}
    </div>
  );
}

export function CommentsSection({ slug, canReply }: Props) {
  const ctx = useOutletContext<AppContext>();
  const loggedIn = !!ctx.currentUser;

  const [items, setItems] = useState<CommentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: number; authorName: string } | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const rows = await api.listComments(slug);
      setItems(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload().catch((err: Error) => setError(err.message));
  }, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.postComment(slug, { body: body.trim(), rating: rating ?? undefined });
      setBody('');
      setRating(null);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const submitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyTo || !replyBody.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.postComment(slug, { body: replyBody.trim(), parentId: replyTo.id });
      setReplyBody('');
      setReplyTo(null);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="comments-section">
      <div className="section-label">Komentari i ocene</div>
      <h2 className="section-title">Šta drugi misle</h2>

      {loggedIn ? (
        <form className="comment-form" onSubmit={submit}>
          <StarPicker value={rating} onChange={setRating} />
          <textarea
            className="field-input"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Podelite svoje iskustvo…"
            maxLength={2000}
          />
          <button className="btn-primary" type="submit" disabled={submitting || !body.trim()}>
            {submitting ? 'Slanje…' : 'Pošalji komentar'}
          </button>
          {error && <div className="login-error">{error}</div>}
        </form>
      ) : (
        <div className="comment-login-prompt">
          <Link to="/prijava">Prijavite se</Link> da biste ostavili komentar.
        </div>
      )}

      {loading ? (
        <div className="comments-empty">Učitavanje…</div>
      ) : items.length === 0 ? (
        <div className="comments-empty">Još nema komentara — budite prvi.</div>
      ) : (
        <div className="comments-list">
          {items.map((c) => (
            <div className="comment" key={c.id}>
              <div className="comment-head">
                <div className="comment-author">
                  {c.author.displayName}
                  <RoleBadge role={c.author.role} />
                </div>
                {c.rating !== null && (
                  <div className="comment-rating">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <IconStar key={n} filled={n <= c.rating!} />
                    ))}
                  </div>
                )}
                <div className="comment-date">{formatDate(c.createdAt)}</div>
              </div>
              <div className="comment-body">{c.body}</div>

              {canReply && (
                <button
                  type="button"
                  className="comment-reply-btn"
                  onClick={() =>
                    setReplyTo(replyTo?.id === c.id ? null : { id: c.id, authorName: c.author.displayName })
                  }
                >
                  {replyTo?.id === c.id ? 'Otkaži odgovor' : 'Odgovori'}
                </button>
              )}

              {replyTo?.id === c.id && (
                <form className="comment-reply-form" onSubmit={submitReply}>
                  <textarea
                    className="field-input"
                    rows={2}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder={`Odgovor na komentar — ${replyTo.authorName}`}
                    autoFocus
                  />
                  <button className="btn-primary" type="submit" disabled={submitting || !replyBody.trim()}>
                    {submitting ? 'Slanje…' : 'Pošalji odgovor'}
                  </button>
                </form>
              )}

              {c.replies.length > 0 && (
                <div className="comment-replies">
                  {c.replies.map((r) => (
                    <div className="comment reply" key={r.id}>
                      <div className="comment-head">
                        <div className="comment-author">
                          {r.author.displayName}
                          <RoleBadge role={r.author.role} />
                        </div>
                        <span className="comment-owner-tag">vlasnik</span>
                        <div className="comment-date">{formatDate(r.createdAt)}</div>
                      </div>
                      <div className="comment-body">{r.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
