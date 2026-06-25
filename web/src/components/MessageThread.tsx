import { useEffect, useRef, useState } from 'react';
import { formatDateTime } from '../lib/format';
import type { Message } from '../types';

interface Props {
  messages: Message[];
  currentUserId: number;
  onSend: (body: string) => Promise<void>;
  disabled?: boolean;
}

export function MessageThread({ messages, currentUserId, onSend, disabled }: Props) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Keep the latest message in view by scrolling *only the list container* — not
  // via scrollIntoView, which would also scroll the page and yank the viewport.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      await onSend(body);
      setDraft('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="msg-thread">
      <div className="msg-list" ref={listRef}>
        {messages.length === 0 ? (
          <div className="ms-empty">Još nema poruka u ovom razgovoru.</div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`msg-bubble ${m.senderId === currentUserId ? 'is-mine' : 'is-theirs'}`}
            >
              <div className="msg-bubble-body">{m.body}</div>
              <div className="msg-bubble-time">{formatDateTime(m.createdAt)}</div>
            </div>
          ))
        )}
      </div>

      {disabled ? (
        <div className="ms-empty msg-disabled">Razgovor nije moguć.</div>
      ) : (
        <form className="msg-composer" onSubmit={submit}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Napišite poruku…"
            rows={2}
            maxLength={2000}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e);
            }}
          />
          <button className="ms-btn ms-btn-primary ms-btn-sm" type="submit" disabled={busy || !draft.trim()}>
            {busy ? 'Slanje…' : 'Pošalji'}
          </button>
        </form>
      )}
      {error && <div className="ms-error">{error}</div>}
    </div>
  );
}
