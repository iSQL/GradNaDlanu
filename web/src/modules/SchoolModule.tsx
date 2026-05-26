import { useEffect, useState } from 'react';
import type { Location, LocationEvent, SchoolContent } from '../types';
import { api } from '../lib/api';
import { ModuleHero } from './ModuleHero';
import { InfoCard } from './InfoCard';

const MONTHS_SR = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}. ${MONTHS_SR[d.getMonth()]}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatRange(start: string, end: string | null): string {
  if (!end) return formatTime(start);
  const a = formatTime(start);
  const b = formatTime(end);
  return a === b ? a : `${a} — ${b}`;
}

interface Props { loc: Location; content: SchoolContent }

export function SchoolModule({ loc, content }: Props) {
  const facts = content.facts ?? [];
  const programs = content.programs ?? [];
  const contact = content.contact ?? { phone: '', email: '', address: loc.address };
  const [events, setEvents] = useState<LocationEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.listLocationEvents(loc.slug)
      .then((rows) => { if (!cancelled) setEvents(rows); })
      .catch(() => { if (!cancelled) setEvents([]); });
    return () => { cancelled = true; };
  }, [loc.slug]);

  return (
    <div className="module-page">
      <ModuleHero loc={loc} tagline={content.tagline} />
      <div className="module-body">
        <div>
          <div className="facts-grid">
            {facts.map((f, i) => (
              <div className="fact" key={i}>
                <div className="fact-num">
                  {f.num}{f.em && <em>{f.em}</em>}
                </div>
                <div className="fact-label">{f.label}</div>
              </div>
            ))}
          </div>

          <div className="module-section">
            <div className="section-label">Program</div>
            <h2 className="section-title">Šta nudimo</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {programs.map((p) => (
                <div
                  key={p}
                  style={{
                    padding: '16px 18px',
                    background: 'var(--paper-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{ width: 4, height: 24, background: 'var(--navy)', borderRadius: 2 }} />
                  {p}
                </div>
              ))}
            </div>
          </div>

          <div className="module-section">
            <div className="section-label">Kalendar</div>
            <h2 className="section-title">Najavljeni događaji</h2>
            {events === null ? (
              <div style={{ fontSize: 13, color: 'var(--ink-2)', padding: '12px 0' }}>Učitavanje…</div>
            ) : events.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ink-2)', padding: '12px 0' }}>
                Trenutno nema najavljenih događaja.
              </div>
            ) : (
              <div style={{ borderTop: '1px solid var(--line)' }}>
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '70px 1fr auto',
                      gap: 16,
                      padding: '16px 0',
                      borderBottom: '1px solid var(--line)',
                      alignItems: 'baseline',
                    }}
                  >
                    <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: 'var(--gold-2)', fontWeight: 500 }}>
                      {formatDate(ev.startsAt)}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--ink)' }}>
                      {ev.title}
                      {ev.description && (
                        <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }}>{ev.description}</div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>
                      {formatRange(ev.startsAt, ev.endsAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <InfoCard loc={loc} contact={contact} />
      </div>
    </div>
  );
}
