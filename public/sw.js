// Deliberately minimal — this app's data (orders, ad rotation, payments) is
// live and changes constantly, so aggressively caching pages or API
// responses risks showing stale/wrong data offline. The only job here is
// (1) satisfy the "registered service worker" installability requirement
// PWA install prompts check for, and (2) show a real offline page instead
// of the browser's default connection-error screen when navigation fails
// with no network. Static assets are intentionally left uncached — Next.js
// build chunks are content-hashed and already get long-lived HTTP caching
// from the server; hand-rolling a second cache layer here would just add a
// second place those can go stale after a deploy.
const CACHE_NAME = "salonke-shell-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL).then((res) => res ?? Response.error()))
  );
});
