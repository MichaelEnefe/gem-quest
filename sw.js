// ═══════════════════════════════════════════
//  GEM QUEST: CRYSTAL KINGDOM — Service Worker
//  Handles offline caching & background sync
// ═══════════════════════════════════════════

const CACHE_NAME = 'gemquest-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Cinzel+Decorative:wght@700;900&family=Crimson+Pro:ital,wght@0,300;0,400;1,300&display=swap',
];

// ── INSTALL: Cache all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS.filter(url => !url.startsWith('https://fonts')));
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: Clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Network first, fallback to cache
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept API calls (Supabase, Groq, Gemini)
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('groq.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('generativelanguage')
  ) {
    return; // Let these go through normally
  }

  // For Google Fonts — cache first
  if (url.hostname.includes('fonts.g') || url.hostname.includes('fonts.gstatic')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // For game files — cache first, update in background
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(networkRes => {
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return networkRes;
      }).catch(() => null);

      return cached || fetchPromise;
    })
  );
});

// ── PUSH NOTIFICATIONS
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const title = data.title || '💎 Gem Quest: Crystal Kingdom';
  const options = {
    body: data.body || 'Your crystal kingdom awaits, Your Majesty!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [
      { action: 'play', title: '⚔️ Play Now' },
      { action: 'dismiss', title: 'Later' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'play' || !event.action) {
    event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
  }
});

// ── BACKGROUND SYNC (score sync when back online)
self.addEventListener('sync', event => {
  if (event.tag === 'score-sync') {
    event.waitUntil(syncScores());
  }
});

async function syncScores() {
  // Scores are synced from the main app when online
  // This is a placeholder for future background sync
  console.log('[SW] Background score sync triggered');
}
