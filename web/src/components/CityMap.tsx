import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { CategoryId, Location } from '../types';
import { pinSvgString } from './PinGlyph';

export const ZABARI_CENTER: [number, number] = [44.3567, 21.2161];
export const DEFAULT_ZOOM = 17;

interface Props {
  locations: Location[];
  activeFilter: CategoryId | 'all';
  onPinClick: (loc: Location) => void;
  onPinHover: (loc: Location | null, point?: { x: number; y: number }) => void;
}

export function CityMap({ locations, activeFilter, onPinClick, onPinHover }: Props) {
  const visible = useMemo(
    () => locations.filter((l) => activeFilter === 'all' || l.catId === activeFilter),
    [locations, activeFilter],
  );

  return (
    <MapContainer
      center={ZABARI_CENTER}
      zoom={DEFAULT_ZOOM}
      zoomControl={false}
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
      {visible.map((loc) => (
        <Marker
          key={loc.id}
          position={[loc.lat, loc.lng]}
          icon={makeIcon(loc.catId)}
          eventHandlers={{
            click: () => onPinClick(loc),
            mouseover: (e) =>
              onPinHover(loc, { x: e.containerPoint.x, y: e.containerPoint.y }),
            mouseout: () => onPinHover(null),
          }}
          riseOnHover
        />
      ))}
    </MapContainer>
  );
}

function makeIcon(cat: CategoryId): L.DivIcon {
  return L.divIcon({
    className: 'leaflet-pin-icon',
    html: pinSvgString(cat),
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
