import { createBrowserRouter, Navigate } from 'react-router-dom';
import { App } from './App';
import { HomePage } from './components/HomePage';
import { ModulePage } from './modules/ModulePage';
import { AdminPanel } from './admin/AdminPanel';
import { EditLocation } from './admin/EditLocation';
import { RequireAuth } from './admin/RequireAuth';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { VerifyEmail } from './pages/VerifyEmail';
import { OwnerDashboard } from './pages/OwnerDashboard';
import { OwnerEditLocation } from './pages/OwnerEditLocation';
import { FloorPlanEditPage } from './pages/FloorPlanEditPage';
import { LegalNotice } from './pages/LegalNotice';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { MapPage } from './pages/MapPage';
import { ObjektiPage } from './pages/ObjektiPage';
import { OglasiPage } from './pages/OglasiPage';
import { OglasDetailPage } from './pages/OglasDetailPage';
import { DesavanjaPage } from './pages/DesavanjaPage';
import { NewsDetailPage } from './pages/NewsDetailPage';
import { EventDetailPage } from './pages/EventDetailPage';
import { DashboardPage } from './pages/DashboardPage';
import { NewsletterPage } from './pages/NewsletterPage';
import { NaseljaPage } from './pages/NaseljaPage';
import { CuratorDashboard } from './pages/CuratorDashboard';
import { CuratorLocationEdit } from './pages/CuratorLocationEdit';
import { UslugePage } from './pages/UslugePage';
import { ProblemiPage } from './pages/ProblemiPage';
import { BiseriPage } from './pages/BiseriPage';
import { PrijaviProblemPage } from './pages/PrijaviProblemPage';
import { ProblemDetailPage } from './pages/ProblemDetailPage';
import { MajstoriPage } from './pages/MajstoriPage';
import { MajstorDashboard } from './pages/MajstorDashboard';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'mapa', element: <MapPage /> },
      { path: 'naselja', element: <NaseljaPage /> },
      { path: 'objekti', element: <ObjektiPage /> },
      { path: 'biseri', element: <BiseriPage /> },
      { path: 'oglasi', element: <OglasiPage /> },
      { path: 'oglasi/:id', element: <OglasDetailPage /> },
      { path: 'usluge', element: <UslugePage /> },
      { path: 'majstori', element: <MajstoriPage /> },
      { path: 'problemi', element: <ProblemiPage view="list" /> },
      { path: 'problemi/mapa', element: <ProblemiPage view="map" /> },
      { path: 'problemi/arhiva', element: <ProblemiPage view="archive" /> },
      { path: 'problemi/prijava', element: <PrijaviProblemPage /> },
      { path: 'problemi/:id', element: <ProblemDetailPage /> },
      { path: 'desavanja', element: <DesavanjaPage /> },
      { path: 'obavestenje/:slug', element: <NewsDetailPage /> },
      { path: 'dogadjaj/:id', element: <EventDetailPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'objekat/:slug', element: <ModulePage /> },
      { path: 'prijava', element: <Login /> },
      { path: 'registracija', element: <Register /> },
      { path: 'verify-email', element: <VerifyEmail /> },
      { path: 'pravna-napomena', element: <LegalNotice /> },
      { path: 'politika-privatnosti', element: <PrivacyPolicy /> },
      { path: 'newsletter/potvrda', element: <NewsletterPage /> },
      { path: 'newsletter/podesavanja', element: <NewsletterPage /> },
      // Legacy alias — sav sadržaj nekadašnjeg /nalog je sad u /dashboard ("Moj prostor").
      { path: 'nalog', element: <Navigate to="/dashboard" replace /> },
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
      {
        path: 'poslovni/objekti/:slug/mapa',
        element: (
          <RequireAuth role="business">
            <FloorPlanEditPage />
          </RequireAuth>
        ),
      },
      {
        path: 'kustos',
        element: (
          <RequireAuth role="curator">
            <CuratorDashboard />
          </RequireAuth>
        ),
      },
      {
        path: 'majstor',
        element: (
          <RequireAuth role="majstor">
            <MajstorDashboard />
          </RequireAuth>
        ),
      },
      {
        path: 'kustos/objekti/:slug',
        element: (
          <RequireAuth role="curator">
            <CuratorLocationEdit />
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
