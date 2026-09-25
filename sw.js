const CACHE = 'caseirao-equipe-print-80mm-v35';
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './css/base.css', './css/admin.css', './js/config.js', './js/foundation.js',
  './js/admin.js', './js/tables.js', './js/team.js', './js/delivery.js',
  './js/operations.js', './js/management.js', './js/runtime-bridge.js',
  './js/printing.js', './js/admin-ui.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request).then(hit => {
    if (hit) return hit;
    if (event.request.mode === 'navigate') return caches.match('./index.html');
    return Response.error();
  })));
});
