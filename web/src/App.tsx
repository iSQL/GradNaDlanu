import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Nav } from './components/Nav';
import { api, type CurrentUser } from './lib/api';
import { clearToken, getToken } from './lib/auth';
import type { Category, CategoryId, Location } from './types';

export type HomeView = 'map' | 'dashboard';

export interface AppContext {
  categories: Category[];
  locations: Location[];
  reloadLocations: () => Promise<void>;
  activeFilter: CategoryId | 'all';
  setActiveFilter: (next: CategoryId | 'all') => void;
  search: string;
  currentUser: CurrentUser | null;
  reloadCurrentUser: () => Promise<void>;
  homeView: HomeView;
  setHomeView: (next: HomeView) => void;
}

const HOME_VIEW_KEY = 'gnd.homeView';

function readStoredHomeView(): HomeView {
  if (typeof window === 'undefined') return 'map';
  const raw = window.localStorage.getItem(HOME_VIEW_KEY);
  return raw === 'dashboard' ? 'dashboard' : 'map';
}

export function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeFilter, setActiveFilter] = useState<CategoryId | 'all'>('all');
  const [search, setSearch] = useState('');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [homeView, setHomeViewState] = useState<HomeView>(readStoredHomeView);

  const setHomeView = useCallback((next: HomeView) => {
    setHomeViewState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(HOME_VIEW_KEY, next);
    }
  }, []);

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

  const isAdmin = location.pathname.startsWith('/admin');
  const isHome = location.pathname === '/';

  return (
    <>
      <Nav
        search={search}
        onSearchChange={setSearch}
        onHome={() => {
          if (!isHome) navigate('/');
        }}
        currentUser={currentUser}
        homeView={homeView}
        onHomeViewChange={setHomeView}
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
          homeView,
          setHomeView,
        } satisfies AppContext}
      />

      {!isAdmin && (
        <footer className="foot">
          Grad na dlanu · Opština Žabari · {new Date().getFullYear()} ·{' '}
          <Link to="/pravna-napomena">Pravna napomena</Link> ·{' '}
          <Link to="/politika-privatnosti">Politika privatnosti</Link>
        </footer>
      )}
    </>
  );
}
