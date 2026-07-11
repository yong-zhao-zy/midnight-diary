/**
 * Midnight Diary — Service Worker
 * Runtime caching: StaleWhileRevalidate (static) + NetworkFirst (API/HTML)
 * No precaching — avoids install-time blocking. All assets cached on-demand.
 */

const STATIC_CACHE = "midnight-static-v1";
const API_CACHE = "midnight-api-v1";
const PAGE_CACHE = "midnight-page-v1";

// --- Install: activate immediately, no precache ---
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// --- Activate: claim clients + clean old caches ---
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key !== STATIC_CACHE &&
                key !== API_CACHE &&
                key !== PAGE_CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// --- Fetch: route-based caching strategies ---
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Skip Next.js HMR / dev-only paths
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  // 1. API requests → NetworkFirst (always fetch fresh, fallback to cache offline)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 2. Navigation requests (HTML) → NetworkFirst with offline fallback
  if (request.mode === "navigate") {
    if (event.preloadResponse) {
      event.respondWith(
        event.preloadResponse.then((preloadResponse) => {
          if (preloadResponse) {
            const copy = preloadResponse.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
            return preloadResponse;
          }
          return fetch(request)
            .then((response) => {
              const copy = response.clone();
              caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
              return response;
            })
            .catch(() => caches.match(request));
        })
      );
      return;
    }
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 3. Static assets (JS/CSS/fonts/images) → StaleWhileRevalidate
  const isStatic =
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font" ||
    request.destination === "image" ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-");

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches
                .open(STATIC_CACHE)
                .then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }
});

// --- Navigation Preload ---
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
