import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Nav } from './components/Nav';
import { api } from './lib/api';
import type { Category, CategoryId, Location } from './types';

export interface AppContext {
  categories: Category[];
  locations: Location[];
  reloadLocations: () => Promise<void>;
  activeFilter: CategoryId | 'all';
  setActiveFilter: (next: CategoryId | 'all') => void;
  search: string;
}

export function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeFilter, setActiveFilter] = useState<CategoryId | 'all'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.listCategories().then(setCategories).catch(console.error);
  }, []);

  const reloadLocations = async () => {
    const rows = await api.listLocations();
    setLocations(rows);
  };

  useEffect(() => {
    reloadLocations().catch(console.error);
  }, []);

  const counts = useMemo(() => {
    const c: Partial<Record<CategoryId, number>> = {};
    for (const l of locations) c[l.catId] = (c[l.catId] ?? 0) + 1;
    return c;
  }, [locations]);

  const isAdmin = location.pathname.startsWith('/admin');
  const isHome = location.pathname === '/';

  return (
    <>
      <Nav
        categories={categories}
        counts={counts}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        search={search}
        onSearchChange={setSearch}
        onHome={() => {
          if (!isHome) navigate('/');
        }}
      />

      <Outlet
        context={{
          categories,
          locations,
          reloadLocations,
          activeFilter,
          setActiveFilter,
          search,
        } satisfies AppContext}
      />

      {!isAdmin && (
        <footer className="foot">
          Grad na dlanu · Opština Žabari · {new Date().getFullYear()} ·  Pravna napomena · Politika privatnosti
        </footer>
      )}
    </>
  );
}
