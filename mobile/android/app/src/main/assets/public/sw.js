const CACHE_NAME = 'fila-app-v7';
const APP_SHELL = [
  './',
  'index.html',
  'cliente.html',
  'telao.html',
  'landing.html',
  'cadastro.html',
  'planos.html',
  'privacidade.html',
  'termos.html',
  'cartaz.html',
  'manifest.webmanifest',
  'ads.js',
  'analytics.js',
  'assets/mark-bird.svg',
  'assets/mutum-design-system.css',
  'assets/fila-cliente-qr.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => undefined)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/ws') return;
  if (url.pathname.endsWith('/config.js')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }
  const isHtml = event.request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('/');

  // HTML vai na rede primeiro: cache-first entregava telas antigas depois de
  // cada deploy. Assets versionados continuam saindo do cache.
  if (isHtml) {
    event.respondWith(
      fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => undefined);
        return response;
      }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => undefined);
      return response;
    }))
  );
});
