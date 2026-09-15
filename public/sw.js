const CACHE_NAME = 'my-sindbad-shell-v8';
const PRECACHE_URLS = [
  '/index.html',
  '/manifest.webmanifest?v=8',
  '/brand/my-sindbad-logo-v7.png',
  '/icons/my-sindbad-app-icon-v8-192.jpg',
  '/icons/my-sindbad-app-icon-v8-512.jpg',
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

  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate' || requestUrl.pathname === '/' || requestUrl.pathname === '/index.html') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (requestUrl.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => (
        cachedResponse || fetch(request).then((networkResponse) => cacheSuccessfulResponse(request, networkResponse))
      )),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => cacheSuccessfulResponse(request, networkResponse))
      .catch(() => caches.match(request)),
  );
});
