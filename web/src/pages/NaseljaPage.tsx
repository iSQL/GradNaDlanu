import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { VillageInfo } from '../types';
import {
  MAP_VIEWBOX,
  MUNI_AREA_KM2,
  MUNI_POPULATION_2022,
  OUTER_BORDER_PATH,
  VILLAGE_SVG,
} from '../lib/villageGeometry';

function formatNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('sr-RS');
}

function formatDec(n: number | null | undefined, fractionDigits = 1): string {
  if (n === null || n === undefined) return '—';
  return n.toFixed(fractionDigits).replace('.', ',');
}

function distanceText(v: VillageInfo): string {
  if (v.isSeat) return 'centar opštine';
  const km = formatDec(v.distanceKm, 1);
  return v.direction ? `${km} km ${v.direction}` : `${km} km`;
}

export function NaseljaPage() {
  const [villages, setVillages] = useState<VillageInfo[] | null>(null);
  // `pinned` je trajno odabrano selo (klik). `hovered` je privremeni preview
  // (mouseover) — kad miš ode sa mape vraćamo se na `pinned`.
  const [pinned, setPinned] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = hovered ?? pinned;

  useEffect(() => {
    api.listVillages()
      .then(setVillages)
      .catch((err: Error) => setError(err.message));
  }, []);

  const byName = useMemo(() => {
    const m = new Map<string, VillageInfo>();
    for (const v of villages ?? []) m.set(v.name, v);
    return m;
  }, [villages]);

  const maxPop = useMemo(() => {
    let max = 0;
    for (const v of villages ?? []) {
      if (v.populationCensus2002 && v.populationCensus2002 > max) max = v.populationCensus2002;
    }
    return max || 1;
  }, [villages]);

  const activeInfo = active ? byName.get(active) ?? null : null;

  return (
    <div className="page naselja-page">
      <div className="naselja-shell">
        <header className="naselja-head">
          <div className="naselja-kicker">Opština · 15 naselja</div>
          <h1>Naselja opštine Žabari</h1>
          <p className="naselja-sub">
            Pređite mišem ili dodirnite naselje na mapi za osnovne podatke i listu kustosa
            koji brinu o sadržaju u tom selu.
          </p>
        </header>

        {error && <div className="login-error" style={{ margin: '0 0 16px' }}>{error}</div>}

        <div className="naselja-layout">
          <div className="naselja-mapcard">
            <svg
              className="naselja-map"
              viewBox={`0 0 ${MAP_VIEWBOX.w} ${MAP_VIEWBOX.h}`}
              role="img"
              aria-label="Mapa naselja opštine Žabari"
              onMouseLeave={() => setHovered(null)}
            >
              <g>
                {Object.entries(VILLAGE_SVG).map(([name, g]) => {
                  const isPinned = pinned === name;
                  const isHovered = hovered === name;
                  const cls = isPinned
                    ? 'naselja-region pinned'
                    : isHovered
                      ? 'naselja-region hovered'
                      : 'naselja-region';
                  return (
                    <path
                      key={name}
                      d={g.path}
                      className={cls}
                      onMouseEnter={() => setHovered(name)}
                      onMouseLeave={() => setHovered((cur) => (cur === name ? null : cur))}
                      onClick={() => setPinned(name)}
                    >
                      <title>{name}</title>
                    </path>
                  );
                })}
              </g>
              <g style={{ pointerEvents: 'none' }}>
                <path d={OUTER_BORDER_PATH} className="naselja-outer" />
                {Object.entries(VILLAGE_SVG).map(([name, g]) => {
                  const v = byName.get(name);
                  const isSeat = v?.isSeat ?? false;
                  return (
                    <g key={`dot-${name}`}>
                      <circle
                        cx={g.cx}
                        cy={g.cy}
                        r={isSeat ? 5.5 : 2.4}
                        className={isSeat ? 'naselja-seat' : 'naselja-dot'}
                      />
                      <text
                        x={g.lx}
                        y={g.ly + (isSeat ? 16 : 3.5)}
                        className={`naselja-lbl ${isSeat ? 'seat' : ''}`}
                      >
                        {name}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
            <div className="naselja-foot-note">
              Naselja su prikazana kao Voronoi-oblasti (teritorija najbliža centru naselja).
              Površina je procena dobijena podelom opštine od 264 km², nije katastarska.
            </div>
          </div>

          <aside className="naselja-panel">
            {activeInfo ? (
              <VillagePanel info={activeInfo} maxPop={maxPop} previewing={hovered !== null && hovered !== pinned} />
            ) : (
              <OverviewPanel total={villages?.length ?? 0} />
            )}

            <div className="naselja-chips-label">Brzi izbor:</div>
            <div className="naselja-chips">
              {(villages ?? []).map((v) => (
                <button
                  key={v.name}
                  type="button"
                  className={`naselja-chip ${pinned === v.name ? 'on' : ''}`}
                  onMouseEnter={() => setHovered(v.name)}
                  onMouseLeave={() => setHovered((cur) => (cur === v.name ? null : cur))}
                  onClick={() => setPinned(v.name)}
                >
                  {v.name}
                </button>
              ))}
              {pinned && (
                <button
                  type="button"
                  className="naselja-chip naselja-chip-clear"
                  onClick={() => { setPinned(null); setHovered(null); }}
                >
                  × pregled opštine
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function OverviewPanel({ total }: { total: number }) {
  return (
    <div>
      <div className="naselja-pname">Opština Žabari</div>
      <div className="naselja-ptag">Braničevski okrug · Republika Srbija</div>
      <div className="naselja-stat">
        <span className="k">Broj naselja</span>
        <span className="v">{total || 15}</span>
      </div>
      <div className="naselja-stat">
        <span className="k">Površina</span>
        <span className="v">{MUNI_AREA_KM2} km²</span>
      </div>
      <div className="naselja-stat">
        <span className="k">Stanovništvo (2022)</span>
        <span className="v">{MUNI_POPULATION_2022.toLocaleString('sr-RS')}</span>
      </div>
      <div className="naselja-stat naselja-stat-last">
        <span className="k">Sedište</span>
        <span className="v">Žabari</span>
      </div>
      <div className="naselja-hint">Izaberite naselje na mapi ili u listi ispod.</div>
    </div>
  );
}

function VillagePanel({
  info,
  maxPop,
  previewing,
}: {
  info: VillageInfo;
  maxPop: number;
  previewing: boolean;
}) {
  const seatSuffix = info.isSeat ? ' ⋆' : '';
  const popBar = info.populationCensus2002
    ? Math.min(100, Math.round((info.populationCensus2002 / maxPop) * 100))
    : 0;

  return (
    <div>
      <div className="naselja-pname">
        {info.name}{seatSuffix}
        {previewing && (
          <span className="naselja-preview-tag" title="Pregled — kliknite da fiksirate selo">
            pregled
          </span>
        )}
      </div>
      <div className="naselja-ptag">
        {info.isSeat
          ? 'Sedište opštine Žabari'
          : 'naselje opštine Žabari · Braničevski okrug'}
      </div>

      <div className="naselja-stat">
        <span className="k">Stanovništvo (popis 2002)</span>
        <span className="v">{formatNum(info.populationCensus2002)}</span>
      </div>
      <div className="naselja-bar"><i style={{ width: `${popBar}%` }} /></div>

      <div className="naselja-stat">
        <span className="k">Površina (procena)</span>
        <span className="v">{formatDec(info.areaKm2, 1)} km²</span>
      </div>
      <div className="naselja-stat">
        <span className="k">{info.isSeat ? 'Položaj' : 'Udaljenost od Žabara'}</span>
        <span className="v">{distanceText(info)}</span>
      </div>
      <div className="naselja-stat naselja-stat-last">
        <span className="k">Koordinate</span>
        <span className="v naselja-coord">
          {info.lat !== null ? info.lat.toFixed(4) : '—'}° N,&nbsp;
          {info.lon !== null ? info.lon.toFixed(4) : '—'}° E
        </span>
      </div>

      <div className="naselja-curators">
        <div className="naselja-curators-label">
          Kustosi {info.curators.length > 0 ? `· ${info.curators.length}` : ''}
        </div>
        {info.curators.length > 0 ? (
          <div className="naselja-curators-list">
            {info.curators.map((c) => (
              <span key={c.id} className="naselja-curator-chip">
                {c.displayName}
              </span>
            ))}
          </div>
        ) : (
          <div className="naselja-curators-empty">
            Bez kustosa — kontaktirajte administraciju ako želite da pomognete oko ovog sela.
          </div>
        )}
      </div>

      <div className="naselja-link">
        <Link to={`/objekti?village=${encodeURIComponent(info.name)}`}>
          Objekti u selu {info.name} →
        </Link>
      </div>
    </div>
  );
}
