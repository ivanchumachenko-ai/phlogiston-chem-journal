// Keep this worker stable. Each registration retains the first complete app shell.
const scope = self.registration.scope;
const cacheName = "phlogiston-installed:" + scope;
const index = new URL("index.html", scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    if (!await cache.match(index)) {
      const response = await fetch(new URL("shell.json", scope), { cache: "no-store" });
      if (!response.ok) throw new Error("Cannot download app shell");
      const files = await response.json();
      await cache.addAll(files.map((path) => new Request(new URL(path, scope), { cache: "reload" })));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  event.respondWith((async () => {
    const request = event.request;
    const url = new URL(request.url);
    const settingsKey = new URL("../.phlogiston-incognito", scope).href;
    const privateMode = await caches.match(settingsKey, { cacheName: "phlogiston-settings" });
    if (request.method === "GET" && request.url.startsWith(scope)) {
      const cache = await caches.open(cacheName);
      const key = request.mode === "navigate" && url.pathname === new URL(scope).pathname ? index : request;
      return await cache.match(key) ?? new Response("Unavailable in the installed version", { status: 404 });
    }
    return privateMode ? Response.error() : fetch(request);
  })());
});
