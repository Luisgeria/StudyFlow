/* ═══════════════════════════════════════
   StudyFlow Service Worker v1.0
   @luisgeria · 2026
═══════════════════════════════════════ */

const CACHE_NAME = 'studyflow-v2';
const OFFLINE_URL = './index.html';

// Assets to cache on install
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── INSTALL ──────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing StudyFlow v1...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Could not cache:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating StudyFlow v1...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip Firebase, Google Fonts API calls — always network
  if (
    url.hostname.includes('firebasedatabase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    request.method !== 'GET'
  ) {
    return; // Let browser handle it
  }

  // For navigation requests: network-first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('/')))
    );
    return;
  }

  // For static assets: cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for HTML
        if (request.headers.get('Accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ── BACKGROUND SYNC (future use) ─────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-tasks') {
    console.log('[SW] Background sync: tasks');
  }
});

// ── PUSH NOTIFICATIONS (future use) ──────
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  self.registration.showNotification(data.title || 'StudyFlow', {
    body: data.body || 'Tienes tareas pendientes',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: 'studyflow-reminder',
    data: { url: data.url || '/' }
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
