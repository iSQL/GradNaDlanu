import { useEffect, useState } from 'react';
import { api, type NewsletterCategory, type NewsletterCounts } from '../lib/api';

const CATEGORY_OPTIONS: { value: NewsletterCategory; label: string }[] = [
  { value: 'desavanja', label: 'Dešavanja u gradu' },
  { value: 'poruke', label: 'Nove poruke' },
  { value: 'marketing', label: 'Marketing i ponude' },
];

export function NewsletterTab() {
  const [counts, setCounts] = useState<NewsletterCounts | null>(null);
  const [category, setCategory] = useState<NewsletterCategory>('desavanja');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const loadCounts = () =>
    api
      .adminNewsletterCounts()
      .then((r) => setCounts(r.counts))
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    loadCounts();
  }, []);

  const segmentCount = counts ? counts[category] : null;

  const send = async () => {
    if (!subject.trim() || !bodyText.trim()) {
      setError('Naslov i telo poruke su obavezni.');
      return;
    }
    const label = CATEGORY_OPTIONS.find((c) => c.value === category)?.label ?? category;
    if (!window.confirm(`Poslati bilten segmentu „${label}"${segmentCount !== null ? ` (${segmentCount} pretplatnika)` : ''}?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.adminSendNewsletter({ category, subject: subject.trim(), bodyText: bodyText.trim() });
      setResult(`Poslato: ${res.sent} / ${res.total}${res.failed ? ` · neuspešno: ${res.failed}` : ''}`);
      setSubject('');
      setBodyText('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="admin-card" style={{ maxWidth: 640 }}>
        <div className="section-label" style={{ margin: 0, marginBottom: 16 }}>
          Pretplatnici
        </div>
        {counts === null ? (
          <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Učitavanje…</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, fontSize: 14 }}>
            <Stat label="Potvrđeni" value={counts.confirmed} accent />
            <Stat label="Na čekanju" value={counts.pending} />
            <Stat label="Odjavljeni" value={counts.unsubscribed} />
            <Stat label="Dešavanja" value={counts.desavanja} />
            <Stat label="Poruke" value={counts.poruke} />
            <Stat label="Marketing" value={counts.marketing} />
          </div>
        )}
      </div>

      <div className="admin-card" style={{ maxWidth: 640 }}>
        <div className="section-label" style={{ margin: 0, marginBottom: 16 }}>
          Pošalji bilten
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 18 }}>
          Poruka ide potvrđenim pretplatnicima koji su uključili odabranu kategoriju. Svaki mejl
          nosi link za odjavu.
        </div>

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Kategorija</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as NewsletterCategory)}
          disabled={busy}
          style={{ width: '100%', padding: '9px 12px', marginBottom: 4 }}
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        {segmentCount !== null && (
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 14 }}>
            Segment: <strong>{segmentCount}</strong> pretplatnika
          </div>
        )}

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Naslov</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={busy}
          placeholder="Naslov mejla"
          style={{ width: '100%', padding: '9px 12px', marginBottom: 14 }}
        />

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Telo poruke</label>
        <textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          disabled={busy}
          rows={8}
          placeholder="Tekst biltena…"
          style={{ width: '100%', padding: '9px 12px', marginBottom: 16, resize: 'vertical' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn-primary" onClick={send} disabled={busy}>
            {busy ? 'Slanje…' : 'Pošalji'}
          </button>
          {result && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>{result}</div>}
        </div>

        {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ? 'var(--gold)' : 'var(--ink)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{label}</div>
    </div>
  );
}
