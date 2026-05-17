import { useNavigate } from 'react-router-dom';
import type { HomeView } from '../App';
import type { CurrentUser } from '../lib/api';
import { getToken } from '../lib/auth';
import { IconAdmin, IconSearch } from './Icons';

interface Props {
  search: string;
  onSearchChange: (next: string) => void;
  onHome: () => void;
  currentUser: CurrentUser | null;
  homeView: HomeView;
  onHomeViewChange: (next: HomeView) => void;
}

function homeRouteFor(user: CurrentUser): string {
  if (user.role === 'admin') return '/admin';
  if (user.role === 'business') return '/poslovni';
  return '/nalog';
}

export function Nav({
  search,
  onSearchChange,
  onHome,
  currentUser,
  homeView,
  onHomeViewChange,
}: Props) {
  const navigate = useNavigate();

  return (
    <nav className="topnav">
      <div className="brand" onClick={onHome} style={{ cursor: 'pointer' }}>
        <div className="brand-mark">Ž</div>
        <div className="brand-stack">
          <div>Grad na dlanu</div>
          <div className="brand-sub">Žabari · 12374</div>
        </div>
      </div>

      <div className="nav-view-toggle" role="tablist" aria-label="Prikaz">
        <button
          type="button"
          role="tab"
          aria-selected={homeView === 'map'}
          className={`nav-view-btn ${homeView === 'map' ? 'active' : ''}`}
          onClick={() => { onHomeViewChange('map'); onHome(); }}
        >
          Mapa
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={homeView === 'dashboard'}
          className={`nav-view-btn ${homeView === 'dashboard' ? 'active' : ''}`}
          onClick={() => { onHomeViewChange('dashboard'); onHome(); }}
        >
          Pregled
        </button>
      </div>

      <div className="nav-right">
        <label className="nav-search">
          <IconSearch />
          <input
            placeholder="Pretraga objekata…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </label>
        {currentUser ? (
          <button className="nav-btn" onClick={() => navigate(homeRouteFor(currentUser))}>
            <IconAdmin /> {currentUser.displayName}
          </button>
        ) : getToken() ? (
          // Token exists in localStorage but /api/me hasn't resolved yet.
          // Render an invisible placeholder of the same width so the nav
          // doesn't reflow (or flash "Prijava") once auth resolves.
          <span className="nav-btn nav-btn-placeholder" aria-hidden="true" />
        ) : (
          <button className="nav-btn" onClick={() => navigate('/prijava')}>
            Prijava
          </button>
        )}
      </div>
    </nav>
  );
}
