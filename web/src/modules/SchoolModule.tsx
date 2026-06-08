import { useEffect, useMemo, useState } from 'react';
import type { Alumnus, Location, SchoolContent } from '../types';
import { ModuleHero } from './ModuleHero';
import { ModuleTabs, type TabDef } from './ModuleTabs';
import { OpsteTab } from './OpsteTab';
import { api, mediaUrl } from '../lib/api';
import {
  LocationEventsList,
  LocationNewsList,
  useLocationDesavanja,
} from './LocationDesavanjaTabs';

interface Props { loc: Location; content: SchoolContent }

export function SchoolModule({ loc, content }: Props) {
  const facts = content.facts ?? [];
  const programs = content.programs ?? [];
  const contact = content.contact ?? { phone: '', email: '', address: loc.address };
  const tagline = content.tagline ?? 'Obrazovna ustanova u opštini Žabari.';

  const desavanja = useLocationDesavanja(loc.id, loc.slug);

  const tabs: TabDef[] = [
    {
      key: 'osnovni',
      label: 'Opšte',
      render: () => (
        <OpsteTab
          loc={loc}
          infoLabel="O ustanovi"
          tagline={tagline}
          contact={contact}
          facts={facts}
          desavanja={desavanja}
        />
      ),
    },
    {
      key: 'dogadjaji',
      label: 'Najavljeni događaji',
      isEmpty: !desavanja.loading && desavanja.events.length === 0,
      render: () => (
        <div className="module-section">
          <div className="section-label">Najavljeni događaji</div>
          <LocationEventsList items={desavanja.events} loading={desavanja.loading} />
        </div>
      ),
    },
    {
      key: 'obavestenja',
      label: 'Obaveštenja',
      isEmpty: !desavanja.loading && desavanja.news.length === 0,
      render: () => (
        <div className="module-section">
          <div className="section-label">Obaveštenja</div>
          <LocationNewsList items={desavanja.news} loading={desavanja.loading} />
        </div>
      ),
    },
    {
      key: 'alumni',
      label: 'Alumni',
      render: () => <AlumniTab slug={loc.slug} />,
    },
    {
      key: 'program',
      label: 'Program',
      isEmpty: programs.length === 0,
      render: () => (
        <div className="module-section">
          <div className="section-label">Program</div>
          <h2 className="section-title">Šta nudimo</h2>
          {programs.length === 0 ? (
            <div className="loc-desavanja-empty">Program još nije unet.</div>
          ) : (
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
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="module-page">
      <ModuleHero loc={loc} tagline={tagline} />
      <div className="module-body tabs">
        <ModuleTabs tabs={tabs} />
      </div>
    </div>
  );
}

function AlumniTab({ slug }: { slug: string }) {
  // Full unfiltered list — used to populate the year dropdown so years are stable
  // across server-side q/year filters. Loaded once per slug change.
  const [all, setAll] = useState<Alumnus[] | null>(null);
  const [items, setItems] = useState<Alumnus[] | null>(null);
  const [year, setYear] = useState<number | ''>('');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAll(null);
    api
      .listAlumni(slug, { limit: 200 })
      .then((rows) => setAll(rows))
      .catch((err: Error) => setError(err.message));
  }, [slug]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setError(null);
    setItems(null);
    const params: { year?: number; q?: string; limit: number } = { limit: 200 };
    if (year !== '') params.year = year;
    if (debouncedQ) params.q = debouncedQ;
    api
      .listAlumni(slug, params)
      .then(setItems)
      .catch((err: Error) => setError(err.message));
  }, [slug, year, debouncedQ]);

  const years = useMemo(() => {
    if (!all) return [];
    const set = new Set<number>();
    for (const a of all) set.add(a.graduationYear);
    return [...set].sort((a, b) => b - a);
  }, [all]);

  return (
    <div className="module-section">
      <div className="section-label">Alumni</div>
      <h2 className="section-title">Naši bivši đaci</h2>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--ink-2)' }}>
          Godina:
          <select
            className="field-input"
            value={year === '' ? '' : String(year)}
            onChange={(ev) => setYear(ev.target.value === '' ? '' : Number(ev.target.value))}
            style={{ padding: '6px 8px' }}
          >
            <option value="">Sve</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}.</option>
            ))}
          </select>
        </label>
        <input
          className="field-input"
          type="search"
          value={q}
          onChange={(ev) => setQ(ev.target.value)}
          placeholder="Pretraži po imenu"
          style={{ flex: 1, minWidth: 200 }}
        />
      </div>

      {error && <div className="login-error">{error}</div>}

      {items === null ? (
        <div className="home-skeleton-list">
          <div className="home-skeleton-row" />
          <div className="home-skeleton-row" />
        </div>
      ) : items.length === 0 ? (
        <div className="loc-desavanja-empty">
          {all && all.length === 0 ? 'Nema unetih alumni.' : 'Nema rezultata za zadati filter.'}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 12,
          }}
        >
          {items.map((a) => (
            <div
              key={a.id}
              style={{
                padding: 16,
                background: 'var(--paper-2)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {a.photoMediaId ? (
                  <img
                    src={mediaUrl(a.photoMediaId)}
                    alt={a.fullName}
                    style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 999, border: '1px solid var(--line)' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 999,
                      background: 'var(--paper)',
                      border: '1px solid var(--line)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      color: 'var(--ink-2)',
                    }}
                  >
                    {a.fullName.charAt(0)}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{a.fullName}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Generacija {a.graduationYear}.</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                Razredni starešina: <span style={{ color: 'var(--ink)' }}>{a.homeroomTeacher}</span>
              </div>
              <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--ink)' }}>„{a.motto}”</div>
              {a.email && (
                <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                  <a href={`mailto:${a.email}`} style={{ color: 'var(--navy)' }}>{a.email}</a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
