import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Biser } from '../types';
import { mediaUrl } from '../lib/api';
import { biserHue } from '../lib/biseri';
import { ZABARI_CENTER } from './CityMap';

// Obe Leaflet upotrebe za "Zaboravljene bisere" žive u jednom fajlu (isti
// obrazac kao ProblemsMap): pregledna mapa sa foto-pinovima i picker mesta
// snimka u formi "Dodaj biser". Stranica ih uvozi preko React.lazy.

const BISERI_ZOOM = 15;

// Pin u obliku stare fotografije: beli okvir, sepija sadržaj (prava fotka kad
// postoji, gradijent placeholder inače), godina na dnu i pulsirajući krug.
function biserPinHtml(b: Biser): string {
  const hue = biserHue(b);
  const c1 = `hsl(${hue}, 42%, 68%)`;
  const c2 = `hsl(${hue}, 46%, 44%)`;
  const c3 = `hsl(${hue}, 44%, 26%)`;
  const inner = b.photoMediaId
    ? `background:url('${mediaUrl(b.photoMediaId)}') center/cover no-repeat;`
    : `background:linear-gradient(155deg,${c1} 0%,${c2} 62%,${c3} 100%);`;
  return `<div class="biser-pin">
    <span class="biser-pin-pulse" style="background:hsl(${hue},50%,50%);"></span>
    <div class="biser-pin-frame">
      <div class="biser-pin-photo" style="${inner}">
        <span class="biser-pin-year">${b.year}.</span>
      </div>
    </div>
    <div class="biser-pin-tail"></div>
  </div>`;
}

function makeBiserIcon(b: Biser): L.DivIcon {
  return L.divIcon({
    className: 'biser-pin-icon',
    html: biserPinHtml(b),
    iconSize: [54, 62],
    iconAnchor: [27, 62],
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

// ── Pregledna mapa objavljenih bisera ───────────────────────────────────────
export function BiseriOverviewMap({
  biseri,
  onPinClick,
}: {
  biseri: Biser[];
  onPinClick: (b: Biser) => void;
}) {
  return (
    <MapContainer
      center={ZABARI_CENTER}
      zoom={BISERI_ZOOM}
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
      {biseri.map((b) => (
        <Marker
          key={b.id}
          position={[b.lat, b.lng]}
          icon={makeBiserIcon(b)}
          eventHandlers={{ click: () => onPinClick(b) }}
          riseOnHover
        >
          <Tooltip className="biser-tt" direction="top" offset={[0, -56]}>
            <b>{b.title}</b>
            <br />
            {b.year}. · {b.village}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}

// ── Picker mesta snimka u formi "Dodaj biser" ───────────────────────────────
function PickerEvents({ onPick }: { onPick: (latlng: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
}

const pickerIcon = L.divIcon({
  className: 'biser-pin-icon',
  html: `<div class="biser-pin">
    <div class="biser-pin-frame">
      <div class="biser-pin-photo" style="background:linear-gradient(155deg,hsl(30,42%,68%),hsl(30,46%,44%) 62%,hsl(30,44%,26%));">
        <span class="biser-pin-year">📍</span>
      </div>
    </div>
    <div class="biser-pin-tail"></div>
  </div>`,
  iconSize: [54, 62],
  iconAnchor: [27, 62],
});

export function BiserLocationPicker({
  latlng,
  onPick,
}: {
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
        <Marker
          position={[latlng.lat, latlng.lng]}
          icon={pickerIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              onPick({ lat: ll.lat, lng: ll.lng });
            },
          }}
        />
      )}
    </MapContainer>
  );
}
