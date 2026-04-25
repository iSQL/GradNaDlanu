import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { CATEGORY_LABELS, type CategoryId, type Location } from '../types';
import { CityMap } from './CityMap';
import { PinGlyph } from './PinGlyph';
import { IconArrow, IconEye, IconEyeOff } from './Icons';

export function Hero() {
  const ctx = useOutletContext<AppContext>();
  const navigate = useNavigate();

  const [hovered, setHovered] = useState<Location | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [panelsVisible, setPanelsVisible] = useState(true);

  const { categories, locations, activeFilter, setActiveFilter, search } = ctx;

  const filtered = useMemo(() => {
    return locations.filter((l) => {
      if (search && !l.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [locations, search]);

  const counts = useMemo(() => {
    const c: Partial<Record<CategoryId, number>> = {};
    for (const l of locations) c[l.catId] = (c[l.catId] ?? 0) + 1;
    return c;
  }, [locations]);

  return (
    <div className="hero">
      <button
        className={`panel-toggle ${panelsVisible ? 'active' : ''}`}
        onClick={() => setPanelsVisible((v) => !v)}
        title={panelsVisible ? 'Sakrij panele' : 'Prikaži panele'}
        aria-label={panelsVisible ? 'Sakrij panele' : 'Prikaži panele'}
      >
        {panelsVisible ? <IconEyeOff /> : <IconEye />}
      </button>

      {panelsVisible && (
      <div className="hero-info">
        <div className="hero-title">
          <div className="hero-eyebrow">Opština Žabari · 12374</div>
          <h1 className="hero-h1">Naš grad <em>na dlanu</em></h1>
          <p className="hero-sub">
            Kompletan vodič kroz Žabare — od kafića u centru do škola, službi i znamenitosti.
            Kliknite na bilo koju oznaku na mapi za više informacija.
          </p>
        </div>

        <div className="hero-meta">
          <div className="hero-pill">
            <span className="dot" /> {locations.length} aktivnih objekata
          </div>
          <div className="hero-stat">
            <div className="hero-stat-row">
              <span className="hero-stat-label">Stanovnika</span>
              <span className="hero-stat-val">~ 2 080</span>
            </div>
            <div className="hero-stat-row">
              <span className="hero-stat-label">Površina</span>
              <span className="hero-stat-val">405 km²</span>
            </div>
            <div className="hero-stat-row">
              <span className="hero-stat-label">Naselja</span>
              <span className="hero-stat-val">15</span>
            </div>
          </div>
        </div>
      </div>
      )}

      <div className="map-canvas">
        <CityMap
          locations={filtered}
          activeFilter={activeFilter}
          onPinClick={(loc) => navigate(`/objekat/${loc.slug}`)}
          onPinHover={(loc, pt) => {
            setHovered(loc);
            if (loc && pt) setPos(pt);
          }}
        />

        {hovered && (
          <div className="pin-card" style={{ left: pos.x, top: pos.y }}>
            <div
              className="pin-card-cat"
              style={{ color: categories.find((c) => c.id === hovered.catId)?.color }}
            >
              {CATEGORY_LABELS[hovered.catId]}
            </div>
            <div className="pin-card-name">{hovered.name}</div>
            <div className="pin-card-meta">
              {hovered.subtitle ? `${hovered.subtitle} · ` : ''}{hovered.address}
            </div>
            <div className="pin-card-cta">
              Otvori modul <IconArrow />
            </div>
          </div>
        )}
      </div>

      {panelsVisible && (
      <div className="map-legend">
        <div className="map-legend-title">Slojevi mape</div>
        <div
          className={`legend-row ${activeFilter === 'all' ? '' : 'off'}`}
          onClick={() => setActiveFilter('all')}
        >
          <div
            className="legend-swatch"
            style={{ width: 14, height: 14, borderRadius: 3, background: 'var(--ink-2)' }}
          />
          <div className="legend-label">Svi objekti</div>
          <div className="legend-count">{locations.length}</div>
        </div>
        {categories.map((c) => {
          const off = activeFilter !== 'all' && activeFilter !== c.id;
          return (
            <div
              key={c.id}
              className={`legend-row ${off ? 'off' : ''}`}
              onClick={() => setActiveFilter(activeFilter === c.id ? 'all' : c.id)}
            >
              <div className="legend-swatch">
                <PinGlyph cat={c.id} size={22} />
              </div>
              <div className="legend-label">{c.label}</div>
              <div className="legend-count">{counts[c.id] ?? 0}</div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
