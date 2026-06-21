import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Nav } from './components/Nav';
import { GuestBanner } from './components/GuestBanner';
import { NewsletterForm } from './components/NewsletterForm';
import { api, type CurrentUser } from './lib/api';
import { clearToken, getToken } from './lib/auth';
import type { Category, CategoryId, Location, Notifications } from './types';

const NO_NOTIFICATIONS: Notifications = {
  unreadMessages: 0,
  reservationUpdates: 0,
  followedUpdates: 0,
};

export interface AppContext {
  categories: Category[];
  locations: Location[];
  reloadLocations: () => Promise<void>;
  activeFilter: CategoryId | 'all';
  setActiveFilter: (next: CategoryId | 'all') => void;
  search: string;
  currentUser: CurrentUser | null;
  reloadCurrentUser: () => Promise<void>;
  registrationEnabled: boolean;
  guestsCanBook: boolean;
  guestsCanPostAds: boolean;
  reloadSettings: () => Promise<void>;
  notifications: Notifications;
  reloadNotifications: () => Promise<void>;
}

export function App() {
  const location = useLocation();

  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeFilter, setActiveFilter] = useState<CategoryId | 'all'>('all');
  const [search, setSearch] = useState('');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean>(false);
  const [guestsCanBook, setGuestsCanBook] = useState<boolean>(true);
  const [guestsCanPostAds, setGuestsCanPostAds] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<Notifications>(NO_NOTIFICATIONS);

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

  const reloadSettings = useCallback(async () => {
    try {
      const s = await api.getSettings();
      setRegistrationEnabled(s.registrationEnabled);
      setGuestsCanBook(s.guestsCanBook);
      setGuestsCanPostAds(s.guestsCanPostAds);
    } catch {
      // Fail closed on registration; fail open on guestsCanBook to match the
      // server default (true) — booking UI stays available if the settings
      // endpoint blips. Guest ads default closed (matches server default).
      setRegistrationEnabled(false);
      setGuestsCanBook(true);
      setGuestsCanPostAds(false);
    }
  }, []);

  useEffect(() => {
    reloadSettings().catch(console.error);
  }, [reloadSettings]);

  const reloadNotifications = useCallback(async () => {
    if (!getToken()) {
      setNotifications(NO_NOTIFICATIONS);
      return;
    }
    try {
      setNotifications(await api.getNotifications());
    } catch {
      setNotifications(NO_NOTIFICATIONS);
    }
  }, []);

  // Fetch on login + poll while logged in so a new message/reservation/feed item
  // surfaces on the badge without a manual refresh. Keyed on user id so it resets
  // cleanly across login/logout.
  const userId = currentUser?.id;
  useEffect(() => {
    if (!userId) {
      setNotifications(NO_NOTIFICATIONS);
      return;
    }
    void reloadNotifications();
    const timer = setInterval(() => { void reloadNotifications(); }, 60_000);
    return () => clearInterval(timer);
  }, [userId, reloadNotifications]);

  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <>
      <Nav
        search={search}
        onSearchChange={setSearch}
        currentUser={currentUser}
        notifications={notifications}
      />
      <GuestBanner role={currentUser?.role} />

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
          registrationEnabled,
          guestsCanBook,
          guestsCanPostAds,
          reloadSettings,
          notifications,
          reloadNotifications,
        } satisfies AppContext}
      />

      {!isAdmin && (
        <footer className="foot">
          <div className="foot-grid">
            <div className="foot-col">
              <h4>Grad na dlanu</h4>
              <p>Opština Žabari, Braničevski okrug, 12374.</p>
              <p>
                <Link to="/pravna-napomena">Pravna napomena</Link>
                {' · '}
                <Link to="/politika-privatnosti">Politika privatnosti</Link>
              </p>
            </div>
            <div className="foot-col">
              <h4>Kontakt</h4>
              <p>Žabari team</p>
              <p>Kneza Miloša bb, 12374 Žabari</p>
              <p>
                <a href="https://www.instagram.com/zabarinet">@zabarinet</a>
              </p>
              <p>
                <a href="mailto:info@zabari.net">info@zabari.net</a>
              </p>
            </div>
            <div className="foot-col">
              <h4>Budi u toku</h4>
              <p>Prijavi se da dobijaš najnovija dešavanja iz okoline.</p>
              <NewsletterForm />
            </div>
          </div>
          <div className="foot-copy">© {new Date().getFullYear()} Grad na dlanu · Žabari</div>
        </footer>
      )}
    </>
  );
}
