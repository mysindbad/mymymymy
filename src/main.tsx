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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
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
