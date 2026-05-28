import { lazy, Suspense } from 'react';

// Lazy: drži Leaflet i react-leaflet izvan inicijalnog bundle-a.
const Hero = lazy(() => import('../components/Hero'));

function MapSkeleton() {
  return (
    <div className="hero">
      <div className="map-canvas map-skeleton">
        <div className="map-skeleton-spinner" aria-hidden="true" />
        <div className="map-skeleton-text">Učitavam mapu…</div>
      </div>
    </div>
  );
}

export function MapPage() {
  return (
    <Suspense fallback={<MapSkeleton />}>
      <Hero />
    </Suspense>
  );
}
