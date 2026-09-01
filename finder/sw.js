/* Bhagwati Jewels — US Lead Finder offline shell.
   Scope is /finder/ ONLY. It must never cache the India app at the site root. */
const CACHE = 'bj-finder-v1';
const SHELL = [
  './visits.html', './trips.html', './index.html', './manifest.json', './icon.svg',
  '../styles.css', '../config.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/dist/umd/supabase.min.js'
];

async function precache() {
  const c = await caches.open(CACHE);
  await Promise.allSettled(SHELL.map(async (u) => {
    try {
      const abs = new URL(u, self.location.href);
      const cross = abs.origin !== self.location.origin;
      const res = await fetch(abs.href, cross ? { mode: 'no-cors' } : { cache: 'reload' });
      if (res && (res.ok || res.type === 'opaque')) await c.put(abs.href, res);
    } catch (_) { /* a missing asset must not fail the whole install */ }
  }));
}

self.addEventListener('install', (e) => {
  e.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // never touch writes
  const url = new URL(req.url);

  // Never cache Supabase API or auth traffic — stale data and stale tokens both bite.
  if (url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/') ||
      url.pathname.includes('/functions/v1/') || url.pathname.includes('/storage/v1/')) return;

  const isPage = req.mode === 'navigate' || (req.destination === 'document') ||
                 url.pathname.endsWith('.html');

  if (isPage) {
    // NETWORK FIRST for pages, so a deployed fix reaches the phone on the next load.
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) (await caches.open(CACHE)).put(req, res.clone());
        return res;
      } catch (_) {
        return (await caches.match(req)) || (await caches.match('./visits.html')) ||
               new Response('Offline and this page was never cached.', { status: 503 });
      }
    })());
    return;
  }

  // CACHE FIRST for css/js/icons, refreshed quietly in the background.
  e.respondWith((async () => {
    const hit = await caches.match(req);
    const net = fetch(req).then(async (res) => {
      if (res && (res.ok || res.type === 'opaque')) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    }).catch(() => null);
    return hit || (await net) || new Response('', { status: 504 });
  })());
});
