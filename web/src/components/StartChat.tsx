import { useState } from 'react';
import { api } from '../lib/api';

interface Props {
  recipientId: number;
  recipientName: string;
  // Poziva se posle uspešnog slanja — pozivalac odlučuje kuda dalje
  // (Dashboard prebacuje na tab Poruke, majstorski panel vodi na /dashboard).
  onSent: () => void;
}

// Sklopljeno dugme "Pošalji poruku" koje se širi u mini formu i pokreće (ili
// nastavlja) 1-na-1 razgovor kroz postojeći conversations sistem. Server
// reuse-uje postojeću nit za isti par korisnika, pa je bezbedno zvati više puta.
export function StartChat({ recipientId, recipientName, onSent }: Props) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      await api.startConversation({ recipientId, body: text });
      setBody('');
      setOpen(false);
      onSent();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('guest_not_allowed')) {
        setError('Za slanje poruka je potreban trajan nalog.');
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="row-action" onClick={() => setOpen(true)}>
        Pošalji poruku
      </button>
    );
  }

  return (
    <form onSubmit={send} className="start-chat">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder={`Poruka za ${recipientName}…`}
        autoFocus
      />
      {error && <div className="login-error">{error}</div>}
      <div className="reservation-actions">
        <button className="row-action" type="submit" disabled={busy || !body.trim()}>
          {busy ? 'Slanje…' : 'Pošalji'}
        </button>
        <button className="row-action" type="button" onClick={() => setOpen(false)}>
          Otkaži
        </button>
      </div>
    </form>
  );
}
