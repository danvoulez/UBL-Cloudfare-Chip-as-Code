// Tiny offline-first shell for UBL Messenger
const VERSION = 'pwa-p1';
const CORE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/ubl-192.jpg',
  '/icons/ubl-512.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Network-first for dynamic JSON/APIs, cache-first for static assets
  const isGET = req.method === 'GET';
  const isStatic = /\.(?:js|css|jpg|jpeg|png|svg|ico|html|json)$/.test(new URL(req.url).pathname);
  if (!isGET) return; // let non-GET pass-through

  if (isStatic) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const clone = res.clone();
        caches.open(VERSION).then(c => c.put(req, clone));
        return res;
      }))
    );
  } else if (req.headers.get('accept')?.includes('text/html')) {
    // HTML shell: try network, fall back to cached index
    e.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
    );
  }
});
