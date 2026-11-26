// UFCinfo service worker.
// - Online, every request goes to the network as usual, and a copy of the site's own files is kept.
// - Offline, the site opens from that copy: the interface plus the last data downloaded.
// - While Render restarts after a deploy (502/503/504), pages show the friendly "updating" screen.
const CACHE = 'ufcinfo-offline-v2';
const IMAGES = 'ufcinfo-images-v1';
const PAGE = '/assets/updating.html';
const RESTARTING = new Set([502, 503, 504]);
const MAX_IMAGES = 250;

// What the site needs to open without a connection. tests/test-offline.mjs checks every file exists.
const PRECACHE = [
  '/', PAGE, '/assets/manifest.webmanifest',
  '/assets/css/fonts.css', '/assets/css/main.css', '/assets/css/mobile.css', '/assets/css/refinement.css',
  '/assets/css/pickem.css', '/assets/css/editorial.css', '/assets/css/adsense.css',
  '/assets/fonts/dm-sans-latin-002a94d0.woff2', '/assets/fonts/barlow-condensed-latin-e7616768.woff2',
  '/assets/fonts/barlow-condensed-latin-00a5e45f.woff2', '/assets/fonts/barlow-condensed-latin-5048d744.woff2',
  '/assets/js/app.bundle.js', '/assets/js/adsense-init.js', '/assets/js/adsense.js',
  '/assets/js/fighter-directory-data.js', '/assets/js/official-events.js', '/assets/js/fighter-stance-data.js',
  '/assets/js/fighter-martial-data.js', '/assets/js/fighter-info-data.js',
  '/assets/js/i18n/dictionaries.js', '/assets/js/i18n/en.js', '/assets/js/i18n/ca.js', '/assets/js/i18n/martial-notes.js',
  '/assets/js/i18n/legend-notes.js', '/assets/js/i18n/legends.js', '/assets/js/i18n/privacy.js',
  '/assets/data/ufc-events.json', '/assets/data/ufc-rankings.json', '/assets/data/fighter-records.json',
  '/assets/data/fighter-photos.json', '/assets/data/sync-health.json', '/assets/data/ufc-rumors.json',
  '/assets/data/ufc-rumor-groups.json', '/assets/data/adsense.json',
  '/assets/images/favicon.svg', '/assets/images/fighter-placeholder.svg', '/assets/images/event-poster-pending.svg',
  '/assets/images/brand/icon-192.png',
];

self.addEventListener('install', event => {
  // Not all-or-nothing: one missing file must not leave the site without its offline copy.
  event.waitUntil(caches.open(CACHE)
    .then(cache => Promise.allSettled(PRECACHE.map(url => cache.add(new Request(url, {cache: 'reload'})))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('ufcinfo-') && ![CACHE, IMAGES].includes(key)).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

async function updatingPage() {
  const page = await caches.match(PAGE);
  return page ? new Response(page.body, {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '10'}}) : null;
}

async function keep(cacheName, request, response) {
  if (!response.ok || response.type !== 'basic') return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  if (cacheName === IMAGES) {
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_IMAGES)).map(key => cache.delete(key)));
  }
}

// Pages: always the network; offline, the saved app (it opens the right profile or card itself).
async function page(event) {
  try {
    const response = await fetch(event.request);
    if (RESTARTING.has(response.status)) return (await updatingPage()) || response;
    if (response.ok && new URL(event.request.url).pathname === '/') event.waitUntil(keep(CACHE, '/', response.clone()));
    return response;
  } catch (error) {
    const saved = await caches.match('/', {ignoreVary: true});
    if (saved) return saved;
    if (self.navigator.onLine === false) throw error;
    return (await updatingPage()) || Promise.reject(error);
  }
}

// Site files and data: the network first (always fresh); the saved copy only without a connection.
async function asset(event, cacheName) {
  try {
    const response = await fetch(event.request);
    if (response.ok) event.waitUntil(keep(cacheName, event.request, response.clone()));
    return response;
  } catch (error) {
    const saved = await caches.match(event.request, {ignoreVary: true, ignoreSearch: cacheName === CACHE});
    if (saved) return saved;
    throw error;
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate') return event.respondWith(page(event));
  const url = new URL(request.url);
  // Only this site's files; accounts, Pick'em and other sites always go straight to the network.
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/assets/') || url.pathname === '/assets/sw.js') return;
  event.respondWith(asset(event, url.pathname.startsWith('/assets/images/') ? IMAGES : CACHE));
});
