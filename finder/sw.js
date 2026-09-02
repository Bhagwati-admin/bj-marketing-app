/* Bhagwati Jewels — US Lead Finder offline shell.
   Scope is /finder/ ONLY. It must never cache the India app at the site root. */
const CACHE = 'bj-finder-v2';
const SHELL = [
  './',                       // the directory URL a Home Screen icon may open
  './visits.html', './trips.html', './index.html',
  './manifest.json', './visits-manifest.json', './icon.svg',
  '../styles.css', '../config.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/dist/umd/supabase.min.js'
];

// Cache pages under their URL WITHOUT the query string, so a deep link like
// visits.html?place=…&stop=… still finds the page offline, and so ?cb= probes
// do not fill the cache with near-duplicates.
function bareUrl(url) { const u = new URL(url); u.search = ''; u.hash = ''; return u.href; }

async function precache() {
  const c = await caches.open(CACHE);
  await Promise.allSettled(SHELL.map(async (u) => {
    try {
      const abs = new URL(u, self.location.href);
      const cross = abs.origin !== self.location.origin;
      let res = null;
      if (cross) {
        // CORS first: gives a real, reliably storable response the page can use.
        try { res = await fetch(abs.href, { mode: 'cors', credentials: 'omit' }); } catch (_) { res = null; }
        if (!res || !res.ok) {
          try { res = await fetch(abs.href, { mode: 'no-cors' }); } catch (_) { res = null; }
        }
      } else {
        res = await fetch(abs.href, { cache: 'reload' });
      }
      if (res && (res.ok || res.type === 'opaque')) await c.put(abs.href, res);
    } catch (_) { /* a missing asset must not fail the whole install */ }
  }));
}

self.addEventListener('install', (e) => { e.waitUntil(precache().then(() => self.skipWaiting())); });

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

const OFFLINE_PAGE =
  '<!doctype html><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Offline</title><body style="margin:0;font:15px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;' +
  'background:#f6f3f4;color:#1c1c1c"><div style="max-width:340px;margin:16vh auto;padding:0 24px;text-align:center">' +
  '<h2 style="color:#7b1e3c;font-size:19px">Not saved for offline yet</h2>' +
  '<p>This page has not been opened on this phone while online, so there is no copy stored here.</p>' +
  '<p style="color:#6b6b6b;font-size:13.5px">Open it once with signal, then add it to your Home Screen. ' +
  'After that it opens with no signal at all.</p>' +
  '<button onclick="location.reload()" style="padding:13px 22px;font-size:16px;font-weight:600;border:0;' +
  'border-radius:11px;background:#7b1e3c;color:#fff">Try again</button></div></body>';

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // never touch writes
  const url = new URL(req.url);

  // Never cache Supabase API or auth traffic — stale data and stale tokens both bite.
  if (url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/') ||
      url.pathname.includes('/functions/v1/') || url.pathname.includes('/storage/v1/')) return;

  const isPage = req.mode === 'navigate' || req.destination === 'document' ||
                 url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  if (isPage) {
    // NETWORK FIRST for pages, so a deployed fix reaches the phone on the next load.
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) (await caches.open(CACHE)).put(bareUrl(req.url), res.clone());
        return res;
      } catch (_) {
        const c = await caches.open(CACHE);
        return (await c.match(bareUrl(req.url)))          // this exact page, query string ignored
            || (await c.match(req, { ignoreSearch: true }))
            || (await c.match('./visits.html'))           // last resort: the screen he needs in a shop
            || new Response(OFFLINE_PAGE, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // CACHE FIRST for css/js/icons, refreshed quietly in the background.
  e.respondWith((async () => {
    const hit = (await caches.match(req)) || (await caches.match(req, { ignoreSearch: true }));
    const net = fetch(req).then(async (res) => {
      if (res && (res.ok || res.type === 'opaque')) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    }).catch(() => null);
    return hit || (await net) || new Response('', { status: 504 });
  })());
});
