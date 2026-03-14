// Diknaath Service Worker — v1.0
// © Manik Roy

const CACHE_NAME = 'diknaath-v1';
const OFFLINE_URL = './index.html';

const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png',
  './apple-touch-icon.png',
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap'
];

// ── Install: pre-cache shell ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => console.warn('Pre-cache miss:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: purge old caches ────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for assets, network-first for HTML ─────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin (except Google Fonts)
  if (request.method !== 'GET') return;
  const isGoogleFonts = url.hostname.includes('fonts.googleapis.com') ||
                        url.hostname.includes('fonts.gstatic.com');
  if (!isGoogleFonts && url.origin !== self.location.origin) return;

  // HTML: network-first, fall back to cache
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Everything else: cache-first, fall back to network & cache result
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return response;
      }).catch(() => {
        // If it's an image, return a transparent 1×1 PNG
        if (request.destination === 'image') {
          return new Response(
            atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
            { headers: { 'Content-Type': 'image/png' } }
          );
        }
      });
    })
  );
});

// ── Background Sync (future use) ──────────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-vastu-log') {
    // Placeholder for future sync logic
    console.log('[SW] Background sync:', event.tag);
  }
});

// ── Push Notifications (future use) ──────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() ?? { title: 'Diknaath', body: 'Your daily Vastu tip is ready.' };
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Diknaath', {
      body: data.body,
      icon: './icon-192x192.png',
      badge: './icon-96x96.png',
      vibrate: [100, 50, 100],
      data: { url: data.url ?? './index.html' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const client of list) {
        if (client.url.includes('diknaath') && 'focus' in client) return client.focus();
      }
      return clients.openWindow(event.notification.data?.url ?? './index.html');
    })
  );
});
