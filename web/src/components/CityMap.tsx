import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CategoryId, Location } from '../types';
import { pinSvgString } from './PinGlyph';

export const ZABARI_CENTER: [number, number] = [44.3567, 21.2161];
export const DEFAULT_ZOOM = 17;

interface Props {
  locations: Location[];
  activeFilter: CategoryId | 'all';
  onPinClick: (loc: Location) => void;
  onPinHover: (loc: Location | null, point?: { x: number; y: number }) => void;
  onLongPress?: (latlng: { lat: number; lng: number }) => void;
  // Called when the user wheels over the map without a modifier key. The page
  // scroll proceeds naturally — this is just for the parent to show a hint.
  onModifierlessWheel?: () => void;
}

export function CityMap({
  locations,
  activeFilter,
  onPinClick,
  onPinHover,
  onLongPress,
  onModifierlessWheel,
}: Props) {
  const visible = useMemo(
    () => locations.filter((l) => activeFilter === 'all' || l.catId === activeFilter),
    [locations, activeFilter],
  );

  return (
    <MapContainer
      center={ZABARI_CENTER}
      zoom={DEFAULT_ZOOM}
      zoomControl={false}
      scrollWheelZoom={false}
      zoomSnap={0.5}
      zoomDelta={0.5}
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
      <ModifierWheelZoom onModifierlessWheel={onModifierlessWheel} />
      {onLongPress && <LongPress onLongPress={onLongPress} />}
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

// Replaces Leaflet's default scroll-wheel-zoom with a modifier-gated version:
// - Ctrl/Cmd + wheel  → zoom map (page does not scroll)
// - plain wheel       → page scrolls; parent gets a callback to show a hint
function ModifierWheelZoom({ onModifierlessWheel }: { onModifierlessWheel?: () => void }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Browsers fire Ctrl+wheel as pinch-zoom (which we want), but they
        // would also zoom the page itself unless we stop it.
        e.preventDefault();
        // Half-step per tick feels closer to native Leaflet smoothness than full step.
        if (e.deltaY < 0) map.zoomIn(0.5, { animate: true });
        else map.zoomOut(0.5, { animate: true });
      } else {
        onModifierlessWheel?.();
      }
    };
    // passive: false because we may call preventDefault for the Ctrl branch.
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onWheel);
    };
  }, [map, onModifierlessWheel]);
  return null;
}

const LONG_PRESS_MS = 550;
const MOVE_TOLERANCE_PX = 6;

function LongPress({ onLongPress }: { onLongPress: (latlng: { lat: number; lng: number }) => void }) {
  const map = useMap();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let downLatLng: L.LatLng | null = null;
    let downPoint: L.Point | null = null;
    let fired = false;

    const cancel = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      downLatLng = null;
      downPoint = null;
    };

    const onDown = (e: L.LeafletMouseEvent) => {
      // Right-click (button 2) immediately fires — desktop shortcut
      const orig = e.originalEvent as MouseEvent;
      if (orig.button === 2) {
        fired = true;
        onLongPress({ lat: e.latlng.lat, lng: e.latlng.lng });
        return;
      }
      fired = false;
      downLatLng = e.latlng;
      downPoint = e.containerPoint;
      timer = setTimeout(() => {
        if (downLatLng) {
          fired = true;
          onLongPress({ lat: downLatLng.lat, lng: downLatLng.lng });
        }
        cancel();
      }, LONG_PRESS_MS);
    };

    const onMove = (e: L.LeafletMouseEvent) => {
      if (!downPoint) return;
      if (e.containerPoint.distanceTo(downPoint) > MOVE_TOLERANCE_PX) cancel();
    };

    const onUp = () => cancel();

    // Suppress the synthetic click that follows a fired long-press
    const onClick = (e: L.LeafletMouseEvent) => {
      if (fired) {
        L.DomEvent.stop(e.originalEvent);
        fired = false;
      }
    };

    // Suppress browser context menu so right-click feels intentional
    const onContextMenu = (e: L.LeafletMouseEvent) => {
      L.DomEvent.preventDefault(e.originalEvent);
    };

    map.on('mousedown', onDown);
    map.on('mousemove', onMove);
    map.on('mouseup', onUp);
    map.on('dragstart', cancel);
    map.on('click', onClick);
    map.on('contextmenu', onContextMenu);

    return () => {
      cancel();
      map.off('mousedown', onDown);
      map.off('mousemove', onMove);
      map.off('mouseup', onUp);
      map.off('dragstart', cancel);
      map.off('click', onClick);
      map.off('contextmenu', onContextMenu);
    };
  }, [map, onLongPress]);
  return null;
}
