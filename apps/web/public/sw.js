/**
 * Keeps Sabaq usable without a connection once it has been opened.
 *
 * - On install, every file of the build (listed in /precache.json) is saved.
 * - Pages are fetched from the network first; offline, the saved app opens instead.
 * - App files come from the saved copy, since their names change with every build.
 * - API requests are never cached here: the app keeps its own copy of the data it needs, and
 *   forgets it when someone signs out.
 */
const PREFIX = 'sabaq-app-';

async function manifest() {
  const response = await fetch('/precache.json', { cache: 'no-store' });
  return response.json();
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const { version, files } = await manifest();
      const cache = await caches.open(PREFIX + version);
      await cache.addAll(['/', ...files.map((file) => `/${file}`)]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const { version } = await manifest();
        const names = await caches.keys();
        await Promise.all(
          names
            .filter((name) => name.startsWith(PREFIX) && name !== PREFIX + version)
            .map((name) => caches.delete(name)),
        );
      } catch {
        // Offline while activating: clean up next time.
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(
        async () => (await caches.match('/', { ignoreVary: true })) ?? Response.error(),
      ),
    );
    return;
  }
  // Saved copies were fetched without an Origin header, so ignore `Vary: Origin` when matching.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((saved) => saved ?? fetch(request)),
  );
});
