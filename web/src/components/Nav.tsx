import { useNavigate } from 'react-router-dom';
import type { Category, CategoryId } from '../types';
import type { CurrentUser } from '../lib/api';
import { IconAdmin, IconSearch } from './Icons';

interface Props {
  categories: Category[];
  counts: Partial<Record<CategoryId, number>>;
  activeFilter: CategoryId | 'all';
  onFilterChange: (next: CategoryId | 'all') => void;
  search: string;
  onSearchChange: (next: string) => void;
  onHome: () => void;
  currentUser: CurrentUser | null;
}

function homeRouteFor(user: CurrentUser): string {
  if (user.role === 'admin') return '/admin';
  if (user.role === 'business') return '/poslovni';
  return '/nalog';
}

export function Nav({
  categories,
  counts,
  activeFilter,
  onFilterChange,
  search,
  onSearchChange,
  onHome,
  currentUser,
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

      <div className="nav-links">
        <button
          className={`nav-link ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => { onFilterChange('all'); onHome(); }}
        >
          Mapa grada
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`nav-link ${activeFilter === c.id ? 'active' : ''}`}
            onClick={() => { onFilterChange(activeFilter === c.id ? 'all' : c.id); onHome(); }}
          >
            {c.short} <span className="count">{counts[c.id] ?? 0}</span>
          </button>
        ))}
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
        ) : (
          <button className="nav-btn" onClick={() => navigate('/prijava')}>
            Prijava
          </button>
        )}
      </div>
    </nav>
  );
}
