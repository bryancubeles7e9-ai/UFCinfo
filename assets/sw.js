// Shows a friendly "updating" page while Render restarts the server after a deploy.
// It caches only that page: every other request goes to the network unchanged.
const CACHE = 'ufcinfo-updating-v1';
const PAGE = '/assets/updating.html';
const RESTARTING = new Set([502, 503, 504]);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(new Request(PAGE, {cache: 'reload'}))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('ufcinfo-') && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

async function updatingPage() {
  const page = await caches.match(PAGE);
  return page ? new Response(page.body, {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '10'}}) : null;
}

self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      return RESTARTING.has(response.status) ? (await updatingPage()) || response : response;
    } catch (error) {
      // Offline visitors keep the browser's own offline page; only an unreachable server is "updating".
      if (self.navigator.onLine === false) throw error;
      const page = await updatingPage();
      if (page) return page;
      throw error;
    }
  })());
});
