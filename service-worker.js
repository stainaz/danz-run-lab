const cacheName = "danz-run-lab-v8";
const appShell = [
  "/",
  "/index.html",
  "/styles.css",
  "/supabase-config.js",
  "/site.js",
  "/app.js",
  "/manifest.webmanifest",
  "/icon.svg",
  "/content/run-weekly.json",
  "/content/building-danz.json",
  "/content/products.json",
  "/content/run-spots.json",
  "/content/site.json",
  "/public/images/products/danz-run-lab-performance-tee.png",
  "/public/images/products/danz-run-lab-2-in-1-running-shorts.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(appShell)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) caches.open(cacheName).then((cache) => cache.put(event.request, response.clone()));
        return response;
      })
      .catch(() => caches.match(event.request).then((response) => response || (event.request.mode === "navigate" ? caches.match("/index.html") : undefined))),
  );
});
