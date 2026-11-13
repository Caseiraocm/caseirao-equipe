'use strict';

const CACHE = 'caseirao-equipe-vibrante-alinhado-20261113';
const APP_SHELL = [
  './css/premium-modelo2.css', './js/premium-modelo2.js', './assets/logo-caseirao.svg', './css/login-option2-fix.css', './css/central-pedidos-primeiro-v11.css', './css/pedido-selecionado-v13.css', './js/central-pedidos-primeiro-v11.js', './js/printing-auto-final-fix.js', './', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './css/base.css', './css/admin.css', './css/premium-v52.css', './css/professional.css', './css/central-compacta.css', './css/owner-header.css', './css/caseirao-signature-60.css', './css/order-items-v7.css', './css/alertas-sonoros-v8.css',
  './js/config.js', './js/foundation.js', './js/admin.js', './js/tables.js', './js/team.js', './js/delivery.js',
  './js/operations.js', './js/management.js', './js/runtime-bridge.js', './js/printing.js', './js/admin-ui.js',
  './js/whatsapp-coexistence.js', './js/professional-shell.js', './js/central-compacta.js', './js/owner-header.js', './js/order-items-v7.js', './js/alertas-sonoros-v8.js'
];

function normalizedCacheKey(request) {
  const url = new URL(typeof request === 'string' ? request : request.url, self.location.href);
  url.search = '';
  url.hash = '';
  return url.toString();
}

async function freshFetch(request) {
  const freshRequest = new Request(request, { cache: 'no-store' });
  return fetch(freshRequest);
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(APP_SHELL.map(async path => {
      const request = new Request(new URL(path, self.location.href).toString(), { cache: 'no-store' });
      const response = await fetch(request);
      if (response.ok) await cache.put(normalizedCacheKey(request), response.clone());
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE && key.startsWith('caseirao-')).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = normalizedCacheKey(event.request);
    try {
      const response = await freshFetch(event.request);
      if (response.ok) await cache.put(key, response.clone());
      return response;
    } catch {
      const cached = await cache.match(key);
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        const fallback = await cache.match(normalizedCacheKey('./index.html'));
        if (fallback) return fallback;
      }
      return Response.error();
    }
  })());
});
