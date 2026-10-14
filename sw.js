/* Service worker KetoAsystenta – aplikacja ma działać bez internetu.
   Przy każdej zmianie plików w APP_SHELL podbij CACHE_VERSION. */
const CACHE_VERSION = 'keto-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/vue.global.prod.js',
  './vendor/chart.umd.js',
  './vendor/tailwind.js',
  './vendor/phosphor.css',
  './vendor/Phosphor.woff2',
  './vendor/Phosphor-Bold.woff2',
  './vendor/Phosphor-Fill.woff2',
  './vendor/Phosphor-Duotone.woff2',
  './vendor/zxing.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // reload omija cache przeglądarki, żeby nie zapisać nieaktualnych plików
    await cache.addAll(APP_SHELL.map(url => new Request(url, { cache: 'reload' })));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Zapytania do Open Food Facts zawsze idą do sieci – nie cachujemy wyników API
  if (url.origin !== self.location.origin) return;

  // Dokument HTML: najpierw sieć (świeża wersja), offline – kopia z cache
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE_VERSION);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (err) {
        const cache = await caches.open(CACHE_VERSION);
        return (await cache.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Zasoby statyczne: najpierw cache, w tle odświeżenie
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    const network = fetch(request)
      .then(response => {
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      })
      .catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
