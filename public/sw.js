/**
 * PromptVault Service Worker
 * Universal PWA & Offline Support with Realtime Cloud Sync Protection
 */

const CACHE_VERSION = 'promptvault-v2.2.0';
const STATIC_CACHE = `promptvault-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `promptvault-dynamic-${CACHE_VERSION}`;

// Core application shell assets to pre-cache
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon.svg',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png'
];

// Domains and endpoints that MUST NEVER be served from stale service worker cache
const REALTIME_EXCLUSIONS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'firebaseio.com',
  'apis.google.com',
  'securetoken.googleapis.com',
  'googleapis.com',
  '/api/',
  '__vite_hmr',
  'ws://',
  'wss://'
];

/**
 * Check if a request is for dynamic cloud data, APIs, or Firestore
 */
function isRealtimeOrApiRequest(url) {
  return REALTIME_EXCLUSIONS.some((excluded) => url.includes(excluded));
}

// 1. Install Event — Pre-cache App Shell Resiliently
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then(async (cache) => {
        // Cache core assets safely with individual fetches
        const cachePromises = PRECACHE_ASSETS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (response && response.ok) {
              await cache.put(url, response);
            }
          } catch (err) {
            console.warn('[PWA-SW] Precache skipped for:', url, err);
          }
        });
        await Promise.allSettled(cachePromises);
      })
      .then(() => self.skipWaiting())
  );
});

// 2. Activate Event — Clean Old Caches & Claim Clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName.startsWith('promptvault-') &&
              cacheName !== STATIC_CACHE &&
              cacheName !== DYNAMIC_CACHE
            ) {
              console.log('[PWA-SW] Removing legacy cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. Fetch Event — Safe Stale-While-Revalidate for Static Assets, Network-Only for Cloud/APIs
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests; never cache POST, PUT, DELETE
  if (req.method !== 'GET') {
    return;
  }

  const url = req.url;

  // Realtime & Cloud Data Protection — Bypass Service Worker Cache
  if (isRealtimeOrApiRequest(url)) {
    return; // Let native browser network & Firebase SDK handle it directly
  }

  // Handle HTML navigation requests (SPA Fallback)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(req, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Fallback to cached index.html or root when offline
          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) return cachedIndex;
          const cachedRoot = await caches.match('/');
          if (cachedRoot) return cachedRoot;
          return new Response(
            '<!doctype html><html><head><meta charset="utf-8"><title>PromptVault Offline</title></head><body style="background:#020617;color:#f8fafc;font-family:sans-serif;padding:2rem;text-align:center;"><h2>PromptVault Offline</h2><p>Aplikasi belum memiliki cache lengkap untuk halaman ini. Silakan hubungkan kembali perangkat ke internet.</p></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // Handle Static Assets (JS, CSS, Images, Fonts, Icons)
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      // If cached, return immediately and revalidate in background
      if (cachedResponse) {
        fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(DYNAMIC_CACHE).then((cache) => {
                cache.put(req, responseClone);
              });
            }
          })
          .catch(() => {
            // Network failure during background revalidation is ignored
          });
        return cachedResponse;
      }

      // If not in cache, fetch from network and dynamically cache
      return fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(req, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback if neither cache nor network is available
          return new Response('Asset not available offline', { status: 503, statusText: 'Service Unavailable' });
        });
    })
  );
});

// 4. Message Event — Support manual SKIP_WAITING from App UI
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
