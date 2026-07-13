import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Problem } from '../types';
import { problemPinSvgString } from './ProblemGlyph';
import { ZABARI_CENTER } from './CityMap';

// Sve tri Leaflet upotrebe za "Probleme" žive u jednom fajlu da lazy-import
// povuče jedan chunk: pregledna mapa (tab Mapa), picker u formi prijave i
// mini-mapa u detalju. Stranice ih uvoze preko React.lazy — otud default export
// wrapper na dnu i named exporti za .then() pattern.

const PROBLEM_ZOOM = 15;

function makeIcon(catId: string): L.DivIcon {
  return L.divIcon({
    className: 'leaflet-pin-icon',
    html: problemPinSvgString(catId),
    iconSize: [34, 42],
    iconAnchor: [17, 42],
  });
}

function ZoomBottomRight() {
  const map = useMap();
  useEffect(() => {
    const ctrl = L.control.zoom({ position: 'bottomright' });
    ctrl.addTo(map);
    return () => {
      ctrl.remove();
    };
  }, [map]);
  return null;
}

// ── Pregledna mapa svih prijava ─────────────────────────────────────────────
export function ProblemsOverviewMap({
  problems,
  onPinClick,
}: {
  problems: Problem[];
  onPinClick: (p: Problem) => void;
}) {
  return (
    <MapContainer
      center={ZABARI_CENTER}
      zoom={PROBLEM_ZOOM}
      zoomControl={false}
      scrollWheelZoom={false}
      className="leaflet-canvas"
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
        maxZoom={19}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
        opacity={0.9}
      />
      <ZoomBottomRight />
      {problems.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={makeIcon(p.catId)}
          eventHandlers={{ click: () => onPinClick(p) }}
          riseOnHover
        >
          <Tooltip direction="top" offset={[0, -38]}>
            {p.title}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}

// ── Picker lokacije u formi prijave ─────────────────────────────────────────
function PickerEvents({ onPick }: { onPick: (latlng: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
}

function FlyTo({ latlng }: { latlng: { lat: number; lng: number } }) {
  const map = useMap();
  const key = `${latlng.lat.toFixed(5)},${latlng.lng.toFixed(5)}`;
  useEffect(() => {
    map.flyTo([latlng.lat, latlng.lng], Math.max(map.getZoom(), 17), { duration: 0.7 });
    // Reagujemo samo na suštinsku promenu koordinata, ne na svaki render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export function ProblemLocationPicker({
  catId,
  latlng,
  onPick,
}: {
  catId: string;
  latlng: { lat: number; lng: number } | null;
  onPick: (latlng: { lat: number; lng: number }) => void;
}) {
  return (
    <MapContainer
      center={latlng ? [latlng.lat, latlng.lng] : ZABARI_CENTER}
      zoom={16}
      zoomControl={false}
      scrollWheelZoom={false}
      className="leaflet-canvas"
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
        opacity={0.9}
      />
      <ZoomBottomRight />
      <PickerEvents onPick={onPick} />
      {latlng && (
        <>
          <FlyTo latlng={latlng} />
          <Marker
            position={[latlng.lat, latlng.lng]}
            icon={makeIcon(catId)}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const ll = (e.target as L.Marker).getLatLng();
                onPick({ lat: ll.lat, lng: ll.lng });
              },
            }}
          />
        </>
      )}
    </MapContainer>
  );
}

// ── Mini-mapa u detalju prijave (neinteraktivna) ────────────────────────────
export function ProblemMiniMap({ catId, lat, lng }: { catId: string; lat: number; lng: number }) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={17}
      zoomControl={false}
      scrollWheelZoom={false}
      dragging={false}
      doubleClickZoom={false}
      className="leaflet-canvas"
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
        opacity={0.9}
      />
      <Marker position={[lat, lng]} icon={makeIcon(catId)} />
    </MapContainer>
  );
}
