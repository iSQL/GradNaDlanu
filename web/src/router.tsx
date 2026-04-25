import { createBrowserRouter } from 'react-router-dom';
import { App } from './App';
import { Hero } from './components/Hero';
import { ModulePage } from './modules/ModulePage';
import { AdminLogin } from './admin/AdminLogin';
import { AdminPanel } from './admin/AdminPanel';
import { RequireAuth } from './admin/RequireAuth';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Hero /> },
      { path: 'objekat/:slug', element: <ModulePage /> },
      { path: 'admin/login', element: <AdminLogin /> },
      {
        path: 'admin',
        element: (
          <RequireAuth>
            <AdminPanel />
          </RequireAuth>
        ),
      },
    ],
  },
]);
