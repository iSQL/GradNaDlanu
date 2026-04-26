import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Nav } from './components/Nav';
import { api, type CurrentUser } from './lib/api';
import { clearToken, getToken } from './lib/auth';
import type { Category, CategoryId, Location } from './types';

export interface AppContext {
  categories: Category[];
  locations: Location[];
  reloadLocations: () => Promise<void>;
  activeFilter: CategoryId | 'all';
  setActiveFilter: (next: CategoryId | 'all') => void;
  search: string;
  currentUser: CurrentUser | null;
  reloadCurrentUser: () => Promise<void>;
}

export function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeFilter, setActiveFilter] = useState<CategoryId | 'all'>('all');
  const [search, setSearch] = useState('');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    api.listCategories().then(setCategories).catch(console.error);
  }, []);

  const reloadLocations = async () => {
    const rows = await api.listLocations();
    setLocations(rows);
  };

  const reloadCurrentUser = useCallback(async () => {
    if (!getToken()) {
      setCurrentUser(null);
      return;
    }
    try {
      const me = await api.getMe();
      setCurrentUser(me);
    } catch {
      // Token rejected (expired, secret rotated, etc.) — clear it and treat as anonymous.
      clearToken();
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    reloadLocations().catch(console.error);
  }, []);

  useEffect(() => {
    reloadCurrentUser().catch(console.error);
  }, [reloadCurrentUser]);

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
        currentUser={currentUser}
      />

      <Outlet
        context={{
          categories,
          locations,
          reloadLocations,
          activeFilter,
          setActiveFilter,
          search,
          currentUser,
          reloadCurrentUser,
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
