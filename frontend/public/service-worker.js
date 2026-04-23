// TAKO service worker.
//
// Three fetch strategies, picked by request shape:
//
//   1. API / cross-origin → pass through (never cache, never intercept).
//   2. Navigation requests → network-first, fall back to cached `/` on
//      network failure so the SPA shell renders offline.
//   3. Same-origin static assets (scripts, styles, images, fonts, icons,
//      manifest) → stale-while-revalidate: serve from cache immediately if
//      present, refresh the entry in the background.
//
// Invariant: every path through `handleFetch` must resolve to a Response.
// The previous SW returned `undefined` when neither network nor cache had
// a hit, which made `event.respondWith(undefined)` throw
// "Failed to convert value to 'Response'" and killed the navigation —
// that was the bug that sent users clicking /campaigns to /login.
//
// Bump CACHE_NAME on every change so clients drop the old cache on
// activate and pick up the new strategy. (The old `earnrm-v1` name is
// legacy — we scrub every non-current cache below regardless.)

const CACHE_NAME = 'tako-sw-v2';
const OFFLINE_SHELL_URL = '/';
const STATIC_PRECACHE = [
  OFFLINE_SHELL_URL,
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
      )
      .then(() => self.clients.claim())
  );
});

// Skip-waiting trigger so the page can tell a freshly-installed SW to take
// over immediately (useful after a deploy, without forcing a full reload).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const isNavigationRequest = (request) =>
  request.mode === 'navigate' ||
  (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));

const isApiRequest = (url) => url.pathname.startsWith('/api/');

// Static assets we're willing to cache. Matches the classes CRA builds
// into /static/ plus common top-level assets; anything else falls through
// to network-only and is never cached.
const isStaticAsset = (url) =>
  url.pathname.startsWith('/static/') ||
  /\.(?:js|css|png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|eot|json)$/i.test(url.pathname);

const networkFirst = async (request) => {
  try {
    const response = await fetch(request);
    // Only cache successful, basic (same-origin) responses. Opaque and
    // error responses are not useful offline fallbacks and pollute the
    // cache.
    if (response && response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {
        // Ignore quota / unsupported-request errors — caching is a
        // best-effort optimisation, not a correctness requirement.
      });
    }
    return response;
  } catch (err) {
    // Offline (or fetch rejected for any other reason). For navigations
    // we serve the SPA shell so React Router can still render something.
    const shell = await caches.match(OFFLINE_SHELL_URL);
    if (shell) return shell;
    // Last-ditch fallback — something must be returned.
    return new Response('You appear to be offline.', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
};

const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === 'basic') {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);
  if (cached) {
    // Return cached immediately; update cache in background.
    networkFetch.catch(() => {});
    return cached;
  }
  const fresh = await networkFetch;
  if (fresh) return fresh;
  return new Response('', { status: 504, statusText: 'Gateway Timeout' });
};

const handleFetch = async (event) => {
  const request = event.request;
  // Never touch non-GETs — they are never safely replayable.
  if (request.method !== 'GET') return fetch(request);

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return fetch(request);
  }

  // Leave cross-origin requests alone entirely.
  if (url.origin !== self.location.origin) return fetch(request);

  // API calls must always go to the network — we never want to serve a
  // cached 401 or cached user data to the wrong session.
  if (isApiRequest(url)) return fetch(request);

  if (isNavigationRequest(request)) return networkFirst(request);

  if (isStaticAsset(url)) return staleWhileRevalidate(request);

  // Anything else (e.g. POST-redirect-GET to an unknown path) — just fetch.
  // Still wrapped so event.respondWith() never sees a rejected promise.
  try {
    return await fetch(request);
  } catch {
    return new Response('', { status: 504, statusText: 'Gateway Timeout' });
  }
};

self.addEventListener('fetch', (event) => {
  // Only hijack requests we actually want to handle. For everything else
  // the browser's default request pipeline runs untouched.
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (isApiRequest(url)) return;
  if (!isNavigationRequest(request) && !isStaticAsset(url)) return;

  event.respondWith(handleFetch(event));
});
