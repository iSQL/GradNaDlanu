import { Link, useLocation } from 'react-router-dom';
import type { Role } from '../lib/auth';

// Shown on every authenticated page while the user is on a guest account.
// Sets the expectation that their data disappears after 7 days of inactivity
// and drives upgrade conversion via the link to /nalog.
//
// Mounted in App.tsx above the <Outlet/>, so it can't use useOutletContext —
// the role is passed down as a prop.
//
// Hidden on /verify-email so the verification confirmation screen stays clean.
interface Props {
  role: Role | null | undefined;
}

export function GuestBanner({ role }: Props) {
  const location = useLocation();
  if (role !== 'guest') return null;
  if (location.pathname === '/verify-email') return null;
  return (
    <div className="guest-banner">
      <span>
        <strong>Privremeni nalog</strong> · istice za 7 dana neaktivnosti
      </span>
      <Link to="/nalog">Nadogradite na trajan nalog →</Link>
    </div>
  );
}
