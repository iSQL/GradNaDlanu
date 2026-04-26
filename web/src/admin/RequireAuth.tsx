import { type ReactNode } from 'react';
import { Navigate, useLocation, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { isAuthed, type Role } from '../lib/auth';

interface Props {
  children: ReactNode;
  // When set, the logged-in user must have this role (or be an admin).
  // When omitted, any logged-in user passes.
  role?: Exclude<Role, 'user'>;
}

export function RequireAuth({ children, role }: Props) {
  const loc = useLocation();
  const ctx = useOutletContext<AppContext>();

  if (!isAuthed()) {
    const target = role === 'admin' ? '/admin/login' : '/prijava';
    return <Navigate to={target} replace state={{ from: loc.pathname }} />;
  }

  // Wait for /api/me to resolve before deciding on role — avoids a flash-redirect.
  if (role) {
    if (ctx.currentUser === null) return null;
    if (ctx.currentUser.role !== 'admin' && ctx.currentUser.role !== role) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
