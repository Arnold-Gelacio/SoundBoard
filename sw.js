/* Padboard service worker — makes the page itself open with no connection.
   Your sounds already live in the browser (IndexedDB); this caches the app shell.
   Bump CACHE when you want every device to drop old cached files. */
const CACHE = 'padboard-shell-v1';
const SHELL = ['./', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
const CDN = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin && !CDN.includes(url.hostname)) return;   // Supabase (sync) always goes straight to the network
  if (req.mode === 'navigate') return e.respondWith(openPage(req));
  e.respondWith(staleWhileRevalidate(e, req));
});

async function openPage(req) {                 // online: newest page (and keep a copy). offline or very slow: the saved copy.
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(no, 4000))]);
    if (res.ok) cache.put('./', res.clone());
    return res;
  } catch { return (await cache.match('./')) || Response.error(); }
}
async function staleWhileRevalidate(e, req) {
  const cache = await caches.open(CACHE), hit = await cache.match(req);
  const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') cache.put(req, r.clone()); return r; }).catch(() => null);
  e.waitUntil(net);
  return hit || (await net) || Response.error();
}
