import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isAuthed } from '../lib/auth';

export function RequireAuth({ children }: { children: ReactNode }) {
  const loc = useLocation();
  if (!isAuthed()) {
    return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;
  }
  return <>{children}</>;
}
