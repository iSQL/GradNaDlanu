import { createBrowserRouter } from 'react-router-dom';
import { App } from './App';
import { Hero } from './components/Hero';
import { ModulePage } from './modules/ModulePage';
import { AdminPanel } from './admin/AdminPanel';
import { EditLocation } from './admin/EditLocation';
import { RequireAuth } from './admin/RequireAuth';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Account } from './pages/Account';
import { OwnerDashboard } from './pages/OwnerDashboard';
import { OwnerEditLocation } from './pages/OwnerEditLocation';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Hero /> },
      { path: 'objekat/:slug', element: <ModulePage /> },
      { path: 'prijava', element: <Login /> },
      { path: 'registracija', element: <Register /> },
      {
        path: 'nalog',
        element: (
          <RequireAuth>
            <Account />
          </RequireAuth>
        ),
      },
      {
        path: 'poslovni',
        element: (
          <RequireAuth role="business">
            <OwnerDashboard />
          </RequireAuth>
        ),
      },
      {
        path: 'poslovni/objekti/:slug',
        element: (
          <RequireAuth role="business">
            <OwnerEditLocation />
          </RequireAuth>
        ),
      },
      // Legacy alias — same flow, role-aware redirect after login.
      { path: 'admin/login', element: <Login /> },
      {
        path: 'admin',
        element: (
          <RequireAuth role="admin">
            <AdminPanel />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/objekat/:slug',
        element: (
          <RequireAuth role="admin">
            <EditLocation />
          </RequireAuth>
        ),
      },
    ],
  },
]);
