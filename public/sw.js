/* Nieuws van de Dag service worker: app shell offline, newest data first, thumbnails from cache. */
const VERSION = "nvdd-v1";
const SHELL = ["./", "index.html", "app.js", "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== "nvdd-img").map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.endsWith("/data.json")) {           // network first, fall back to last copy when offline
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put("data.json", c)); return r; })
      .catch(() => caches.match("data.json")));
    return;
  }
  if (url.pathname.includes("/img/")) {                // thumbnails never change: cache first
    e.respondWith(caches.open("nvdd-img").then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }))));
    return;
  }
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request)));
});
