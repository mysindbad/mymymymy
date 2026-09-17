import {lazy, Suspense} from 'react';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
// Leaflet's stylesheet is bundled and imported before the app's own overrides, so
// map styling never depends on a third-party CDN being reachable.
import 'leaflet/dist/leaflet.css';
import './index.css';
import {startAutomaticDayNightTheme} from './lib/dayNightTheme';
import {cleanOAuthErrorFromCurrentUrl} from './lib/authUrlRecovery';

cleanOAuthErrorFromCurrentUrl();
startAutomaticDayNightTheme();

// The Admin Control Center is a separate surface on /admin, not another screen inside the
// traveller app: it is a separate chunk, its own stylesheet, and it never mounts the consumer
// tree. Authorisation is enforced by the API on every request - this branch only decides
// which interface to draw, and reveals nothing to an unauthorised visitor (the gate shows the
// refusal it received).
const isAdminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');
const AdminRoot = lazy(() => import('./admin/AdminRoot.tsx'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? (
      <Suspense
        fallback={
          <div style={{minHeight: '100dvh', background: '#0d1016', color: '#e7ebf2', fontFamily: 'system-ui', display: 'grid', placeItems: 'center', fontSize: '0.875rem'}}>
            <span>Loading the control room…</span>
          </div>
        }
      >
        <AdminRoot/>
      </Suspense>
    ) : (
      <App/>
    )}
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js', {updateViaCache: 'none'})
      .then((registration) => registration.update())
      .catch((error) => {
        console.warn('Service worker registration failed:', error);
      });
  });
}
