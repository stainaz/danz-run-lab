const cacheName = "danz-run-lab-v6";
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
  "/public/images/products/catalogue/danz-performance-tee-run-measure-improve.png",
  "/public/images/products/catalogue/danz-performance-tee-find-your-pace-then-break-it.png",
  "/public/images/products/catalogue/danz-performance-tee-run-better.png",
  "/public/images/products/catalogue/danz-performance-tee-how-fast-can-you-become.png",
  "/public/images/products/catalogue/danz-performance-tee-chase-your-next-pb.png",
  "/public/images/products/catalogue/danz-performance-tee-whats-your-number.png",
  "/public/images/products/catalogue/danz-founding-runner-001.png",
  "/public/images/products/catalogue/danz-tee-all-i-do-is-run.png",
  "/public/images/products/catalogue/danz-tee-run-or-fun-why-not-both.png",
  "/public/images/products/catalogue/danz-tee-the-run-lab.png",
  "/public/images/products/catalogue/danz-tee-run-lab-repeat.png",
  "/public/images/products/catalogue/danz-minimal-tee.png",
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
