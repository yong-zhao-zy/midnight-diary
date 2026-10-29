/**
 * Midnight Diary — Service Worker
 * Runtime caching: StaleWhileRevalidate (static) + NetworkFirst (API)
 *
 * 重要：**不缓存 HTML 导航请求**。
 * 本项目是登录态应用，页面内容与 JS chunk 强绑定：
 * 一旦缓存了旧版 HTML，它会引用旧 chunk，导致新功能「看不到」，
 * 而 iOS Safari 的 SW 存活时间很长，旧页面可能长期驻留。
 */

const CACHE_VERSION = "v4";
const STATIC_CACHE = `midnight-static-${CACHE_VERSION}`;
const API_CACHE = `midnight-api-${CACHE_VERSION}`;
// activate 时只保留这两个缓存，其余（含历史 midnight-page-v1/v2）全部删除
const KEEP_CACHES = [STATIC_CACHE, API_CACHE];

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
            .filter((key) => !KEEP_CACHES.includes(key))
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

  // 2. Navigation requests (HTML) → 一律走网络，不写缓存。
  //    返回即交给浏览器默认处理；离线时浏览器自带错误页，好过展示一份过期界面。
  if (request.mode === "navigate") return;

  // 2.5 JS/CSS → NetworkFirst。
  //    Turbopack 的部分 chunk 名（如 turbopack-*.js）跨构建复用但内容会变：
  //    若用 StaleWhileRevalidate，部署后会拿旧 chunk 配新 HTML，水合失败 → 白屏。
  //    正常访问不受影响：/_next/static 带 immutable，浏览器 HTTP 缓存直接命中。
  const isCode = request.destination === "script" || request.destination === "style";
  if (isCode) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 3. Fonts/images → StaleWhileRevalidate（文件名内容哈希，跨构建不会变）
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

// --- Manual update trigger ---
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
