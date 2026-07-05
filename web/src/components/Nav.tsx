import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { CurrentUser } from '../lib/api';
import { getToken } from '../lib/auth';
import { IconSearch } from './Icons';
import { RoleBadge } from './RoleBadge';
import type { Notifications } from '../types';

interface Props {
  search: string;
  onSearchChange: (next: string) => void;
  currentUser: CurrentUser | null;
  notifications?: Notifications;
}

// Administrativni meni u submeniju korisničkog dugmeta — stavke zavise od uloge.
// Običan posetilac nema administrativnih stavki, pa ni submeni.
function adminMenuFor(user: CurrentUser): { to: string; label: string }[] {
  if (user.role === 'admin') return [{ to: '/admin', label: 'Admin panel' }];
  if (user.role === 'business') return [{ to: '/poslovni', label: 'Poslovni panel' }];
  if (user.role === 'curator') return [{ to: '/kustos', label: 'Kustoski panel' }];
  if (user.role === 'majstor') return [{ to: '/majstor', label: 'Majstorski panel' }];
  return [];
}

interface MenuItem {
  to: string;
  label: string;
  end?: boolean;
  submenu?: { to: string; label: string; end?: boolean }[];
}

const MENU: MenuItem[] = [
  { to: '/', label: 'Početna', end: true },
  {
    to: '/objekti',
    label: 'Objekti',
    submenu: [
      { to: '/objekti', label: 'Lista objekata', end: true },
      { to: '/mapa', label: 'Mapa' },
    ],
  },
  { to: '/oglasi', label: 'Oglasi' },
  { to: '/usluge', label: 'Usluge' },
  { to: '/desavanja', label: 'Dešavanja' },
  { to: '/naselja', label: 'Naselja' },
];

function IconCaret() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" style={{ marginLeft: 4 }}>
      <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

export function Nav({ search, onSearchChange, currentUser, notifications }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const onHome = location.pathname === '/';
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Aggregate badge for "Moj prostor": unread messages + reservation updates +
  // followed-object updates + usluge offers + (majstor) new jobs. Only shown to
  // logged-in users.
  const notifyCount = currentUser && notifications
    ? notifications.unreadMessages +
      notifications.reservationUpdates +
      notifications.followedUpdates +
      notifications.uslugeUpdates +
      notifications.majstorJobs
    : 0;
  const badgeText = notifyCount > 9 ? '9+' : String(notifyCount);

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
          <img src="/zabari-mark-color.svg" alt="" className="brand-logo" />
          <div className="brand-stack">
            <div>
              zabari<span className="brand-net">.net</span>
            </div>
            <div className="brand-sub">Opština Žabari</div>
          </div>
        </NavLink>

        <ul className="nav-links" role="menubar">
          {MENU.map((item) => (
            <li
              key={item.to}
              role="none"
              className={item.submenu ? 'nav-link-group' : undefined}
            >
              <NavLink
                to={item.to}
                end={item.end}
                role="menuitem"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                {item.label}
                {item.submenu && <IconCaret />}
              </NavLink>
              {item.submenu && (
                <ul className="nav-submenu" role="menu">
                  {item.submenu.map((sub) => (
                    <li key={sub.to} role="none">
                      <NavLink
                        to={sub.to}
                        end={sub.end}
                        role="menuitem"
                        className={({ isActive }) => `nav-submenu-link ${isActive ? 'active' : ''}`}
                      >
                        {sub.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>

        <div className="nav-right">
          {/* Na početnoj je pretraga već u hero-u, pa je ovde ne dupliramo. */}
          {!onHome && (
            <label className="nav-search">
              <IconSearch />
              <input
                placeholder="Pretraga objekata…"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={onSearchKey}
              />
            </label>
          )}
          {currentUser ? (
            <div className={adminMenuFor(currentUser).length > 0 ? 'nav-user-group' : undefined}>
              <button className="nav-user" onClick={() => navigate('/dashboard')}>
                <span className="nav-user-avatar" aria-hidden="true">
                  {currentUser.displayName.charAt(0).toUpperCase()}
                </span>
                Moj prostor
                {notifyCount > 0 && (
                  <span className="nav-badge" aria-label={`${notifyCount} novih obaveštenja`}>
                    {badgeText}
                  </span>
                )}
                {adminMenuFor(currentUser).length > 0 && <IconCaret />}
              </button>
              {adminMenuFor(currentUser).length > 0 && (
                <ul className="nav-submenu nav-user-submenu" role="menu">
                  <li className="nav-user-submenu-head" role="none">
                    {currentUser.displayName}
                    <RoleBadge role={currentUser.role} />
                  </li>
                  {adminMenuFor(currentUser).map((m) => (
                    <li key={m.to} role="none">
                      <NavLink
                        to={m.to}
                        role="menuitem"
                        className={({ isActive }) => `nav-submenu-link ${isActive ? 'active' : ''}`}
                      >
                        {m.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
            {!onHome && (
              <label className="nav-search nav-search-drawer">
                <IconSearch />
                <input
                  placeholder="Pretraga objekata…"
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onKeyDown={onSearchKey}
                />
              </label>
            )}
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
                  {item.submenu && (
                    <ul className="nav-drawer-sublist">
                      {item.submenu.map((sub) => (
                        <li key={sub.to}>
                          <NavLink
                            to={sub.to}
                            end={sub.end}
                            className={({ isActive }) =>
                              `nav-drawer-sublink ${isActive ? 'active' : ''}`
                            }
                          >
                            {sub.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            <div className="nav-drawer-foot">
              {currentUser ? (
                <>
                  <button
                    className="nav-user nav-btn-block"
                    onClick={() => navigate('/dashboard')}
                  >
                    <span className="nav-user-avatar" aria-hidden="true">
                      {currentUser.displayName.charAt(0).toUpperCase()}
                    </span>
                    Moj prostor
                    {notifyCount > 0 && <span className="nav-badge">{badgeText}</span>}
                    <RoleBadge role={currentUser.role} />
                  </button>
                  {adminMenuFor(currentUser).map((m) => (
                    <NavLink
                      key={m.to}
                      to={m.to}
                      className={({ isActive }) =>
                        `nav-drawer-sublink ${isActive ? 'active' : ''}`
                      }
                    >
                      {m.label}
                    </NavLink>
                  ))}
                </>
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
