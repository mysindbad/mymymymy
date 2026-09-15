const CACHE_NAME = 'my-sindbad-shell-v6';
const PRECACHE_URLS = [
  '/index.html',
  '/manifest.webmanifest?v=6',
  '/brand/my-sindbad-logo-v6.webp',
  '/icons/my-sindbad-app-icon-v6-192.jpg',
  '/icons/my-sindbad-app-icon-v6-512.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      ))
      .then(() => self.clients.claim()),
  );
});

const cacheSuccessfulResponse = async (request, response) => {
  if (response && response.status === 200 && response.type === 'basic') {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
};

const networkFirstNavigation = async (request) => {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      await cache.put('/index.html', response.clone());
    }
    return response;
  } catch (error) {
    return (await cache.match('/index.html')) || Response.error();
  }
};

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;

  // API requests are live data and must never be served from the app-shell cache.
  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Always check the network first for the SPA shell so deployments cannot be
  // pinned to an old HTML/JavaScript bundle by the service worker.
  if (request.mode === 'navigate' || requestUrl.pathname === '/' || requestUrl.pathname === '/index.html') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Vite asset filenames are content-hashed, so cache-first is safe for them.
  if (requestUrl.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => (
        cachedResponse || fetch(request).then((networkResponse) => cacheSuccessfulResponse(request, networkResponse))
      )),
    );
    return;
  }

  // Fixed URLs such as manifest, logo, and icons prefer the network so future
  // branding changes are visible without requiring users to clear site data.
  event.respondWith(
    fetch(request)
      .then((networkResponse) => cacheSuccessfulResponse(request, networkResponse))
      .catch(() => caches.match(request)),
  );
});
