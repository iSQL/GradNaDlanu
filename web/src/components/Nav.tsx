import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { CurrentUser } from '../lib/api';
import { getToken } from '../lib/auth';
import { IconAdmin, IconSearch } from './Icons';
import { RoleBadge } from './RoleBadge';

interface Props {
  search: string;
  onSearchChange: (next: string) => void;
  currentUser: CurrentUser | null;
}

function homeRouteFor(user: CurrentUser): string {
  if (user.role === 'admin') return '/admin';
  if (user.role === 'business') return '/poslovni';
  return '/dashboard';
}

const MENU = [
  { to: '/', label: 'Početna', end: true },
  { to: '/desavanja', label: 'Dešavanja' },
  { to: '/mapa', label: 'Mapa' },
  { to: '/objekti', label: 'Objekti' },
  { to: '/dashboard', label: 'Moj prostor' },
];

function IconMenu() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M5 5l12 12M17 5L5 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Nav({ search, onSearchChange, currentUser }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Zatvori drawer na svaku promenu rute.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Telo ne sme skrolovati kad je drawer otvoren.
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  // ENTER u search-u: ako nismo na /objekti, prebaci tamo.
  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && location.pathname !== '/objekti') {
      navigate('/objekti');
    }
  }

  return (
    <>
      <nav className="topnav">
        <NavLink to="/" className="brand">
          <div className="brand-mark">Ž</div>
          <div className="brand-stack">
            <div>Grad na dlanu</div>
            <div className="brand-sub">Žabari · 12374</div>
          </div>
        </NavLink>

        <ul className="nav-links" role="menubar">
          {MENU.map((item) => (
            <li key={item.to} role="none">
              <NavLink
                to={item.to}
                end={item.end}
                role="menuitem"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="nav-right">
          <label className="nav-search">
            <IconSearch />
            <input
              placeholder="Pretraga objekata…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={onSearchKey}
            />
          </label>
          {currentUser ? (
            <button className="nav-btn" onClick={() => navigate(homeRouteFor(currentUser))}>
              <IconAdmin /> {currentUser.displayName}
              <RoleBadge role={currentUser.role} />
            </button>
          ) : getToken() ? (
            <span className="nav-btn nav-btn-placeholder" aria-hidden="true" />
          ) : (
            <button className="nav-btn" onClick={() => navigate('/prijava')}>
              Prijava
            </button>
          )}

          <button
            type="button"
            className="nav-hamburger"
            aria-label="Otvori meni"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            {drawerOpen ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </nav>

      {drawerOpen && (
        <>
          <div
            className="nav-drawer-overlay"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="nav-drawer" role="dialog" aria-label="Glavni meni">
            <label className="nav-search nav-search-drawer">
              <IconSearch />
              <input
                placeholder="Pretraga objekata…"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={onSearchKey}
              />
            </label>
            <ul className="nav-drawer-links">
              {MENU.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `nav-drawer-link ${isActive ? 'active' : ''}`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <div className="nav-drawer-foot">
              {currentUser ? (
                <button
                  className="nav-btn nav-btn-block"
                  onClick={() => navigate(homeRouteFor(currentUser))}
                >
                  <IconAdmin /> {currentUser.displayName}
                  <RoleBadge role={currentUser.role} />
                </button>
              ) : (
                <button
                  className="nav-btn nav-btn-block"
                  onClick={() => navigate('/prijava')}
                >
                  Prijava
                </button>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
