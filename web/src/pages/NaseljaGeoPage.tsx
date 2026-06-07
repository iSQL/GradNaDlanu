import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GeoJSON, MapContainer, Marker, TileLayer } from 'react-leaflet';
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../lib/api';
import type { VillageInfo } from '../types';

// Placeholder GeoJSON sloj. Kada bude pravih granica iz OSM-a / RZS-a, zamenićemo
// ovo statičkim importom GeoJSON fajla. Za sada FeatureCollection je prazan
// (samo pinovi se renderuju na mapi).
const VILLAGE_BOUNDARIES_PLACEHOLDER: FeatureCollection<Geometry, GeoJsonProperties> = {
  type: 'FeatureCollection',
  features: [],
};

const MAP_CENTER: [number, number] = [44.385, 21.235];
const DEFAULT_ZOOM = 11;

function formatNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('sr-RS');
}

function formatDec(n: number | null | undefined, fractionDigits = 1): string {
  if (n === null || n === undefined) return '—';
  return n.toFixed(fractionDigits).replace('.', ',');
}

function villageIcon(isSeat: boolean): L.DivIcon {
  const color = isSeat ? '#C9A961' : '#1E3A5F';
  return L.divIcon({
    className: 'naselja-geo-pin',
    html: `<svg width="34" height="42" viewBox="0 0 34 42" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 1 C 8 1 1 8 1 17 C 1 27 17 41 17 41 C 17 41 33 27 33 17 C 33 8 26 1 17 1 Z"
            fill="${color}" stroke="#F5F1E8" stroke-width="2"/>
      <circle cx="17" cy="17" r="6" fill="#F5F1E8"/>
    </svg>`,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
  });
}

export function NaseljaGeoPage() {
  const [villages, setVillages] = useState<VillageInfo[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const boundaries = VILLAGE_BOUNDARIES_PLACEHOLDER.features.length > 0
    ? VILLAGE_BOUNDARIES_PLACEHOLDER
    : null;

  const selectedInfo = selected ? byName.get(selected) ?? null : null;

  return (
    <div className="page naselja-page">
      <div className="naselja-shell">
        <header className="naselja-head">
          <div className="naselja-kicker">Mapa naselja · eksperimentalno</div>
          <h1>Naselja na satelitskoj mapi</h1>
          <p className="naselja-sub">
            Hibridni prikaz na pravoj geografskoj mapi. Granice naselja (poligoni) su
            placeholder — biće dopunjeni stvarnim GeoJSON-om u sledećoj iteraciji.
          </p>
        </header>

        {error && <div className="login-error" style={{ margin: '0 0 16px' }}>{error}</div>}

        <div className="naselja-layout">
          <div className="naselja-mapcard naselja-mapcard-geo">
            <MapContainer
              center={MAP_CENTER}
              zoom={DEFAULT_ZOOM}
              zoomControl={true}
              scrollWheelZoom={true}
              style={{ width: '100%', height: 560 }}
            >
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Tiles © Esri"
                maxZoom={19}
              />
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
                opacity={0.9}
              />
              {boundaries && (
                <GeoJSON
                  data={boundaries}
                  style={() => ({
                    color: '#1E3A5F',
                    weight: 1,
                    fillColor: '#C9A961',
                    fillOpacity: 0.15,
                  })}
                  onEachFeature={(f: Feature<Geometry, GeoJsonProperties>, layer) => {
                    const name = (f.properties?.name as string | undefined) ?? '';
                    if (name) {
                      layer.on('click', () => setSelected(name));
                      layer.on('mouseover', () => setSelected(name));
                    }
                  }}
                />
              )}
              {(villages ?? []).map((v) => {
                if (v.lat === null || v.lon === null) return null;
                return (
                  <Marker
                    key={v.name}
                    position={[v.lat, v.lon]}
                    icon={villageIcon(v.isSeat)}
                    eventHandlers={{
                      click: () => setSelected(v.name),
                      mouseover: () => setSelected(v.name),
                    }}
                  />
                );
              })}
            </MapContainer>
            <div className="naselja-foot-note">
              Centri naselja su koordinate iz baze; poligoni granica su placeholder.
              Slojevi: Esri satelit + Esri labele.
            </div>
          </div>

          <aside className="naselja-panel">
            {selectedInfo ? (
              <GeoVillagePanel info={selectedInfo} />
            ) : (
              <div>
                <div className="naselja-pname">Opština Žabari</div>
                <div className="naselja-ptag">Hibridni prikaz · klikni pin za detalje</div>
                <div className="naselja-hint">
                  Pinovi sa zlatnim središtem (Žabari) označavaju sedište opštine; tamno-plavi
                  označavaju ostala naselja.
                </div>
              </div>
            )}
            <div className="naselja-chips-label">Brzi izbor:</div>
            <div className="naselja-chips">
              {(villages ?? []).map((v) => (
                <button
                  key={v.name}
                  type="button"
                  className={`naselja-chip ${selected === v.name ? 'on' : ''}`}
                  onClick={() => setSelected(v.name)}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function GeoVillagePanel({ info }: { info: VillageInfo }) {
  return (
    <div>
      <div className="naselja-pname">{info.name}{info.isSeat ? ' ⋆' : ''}</div>
      <div className="naselja-ptag">
        {info.isSeat ? 'Sedište opštine Žabari' : 'naselje opštine Žabari'}
      </div>
      <div className="naselja-stat">
        <span className="k">Stanovništvo 2002</span>
        <span className="v">{formatNum(info.populationCensus2002)}</span>
      </div>
      <div className="naselja-stat">
        <span className="k">Površina</span>
        <span className="v">{formatDec(info.areaKm2, 1)} km²</span>
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
              <span key={c.id} className="naselja-curator-chip">{c.displayName}</span>
            ))}
          </div>
        ) : (
          <div className="naselja-curators-empty">Bez kustosa.</div>
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
