// This scope is the stable entry point for home-screen shortcuts.
const scope = self.registration.scope;
const index = new URL("index.html", scope).href;
const launcherCache = "phlogiston-launcher:" + scope;
const previousCache = "phlogiston-installed:" + scope;
const privateModeKey = new URL("../.phlogiston-incognito", scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    if (await caches.match(privateModeKey, { cacheName: "phlogiston-settings" })) {
      throw new Error("Incognito mode is enabled");
    }
    const cache = await caches.open(launcherCache);
    await cache.add(new Request(index, { cache: "reload" }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(scope)) return;
  if (request.mode === "navigate") {
    event.respondWith(caches.match(index, { cacheName: launcherCache }).then((response) =>
      response ?? caches.match(index, { cacheName: previousCache }),
    ).then((response) => response ?? Response.error()));
    return;
  }
  // A tab that still has the previous installed version open keeps its assets.
  event.respondWith(caches.match(request, { cacheName: previousCache }).then((response) =>
    response ?? fetch(request),
  ));
});
