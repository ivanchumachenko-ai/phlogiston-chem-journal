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
      const root = new URL("../", scope);
      const rootPrecache = (await caches.keys()).find((name) =>
        name.startsWith("workbox-precache-") && name.endsWith(root.href),
      );
      const cachedAssets = rootPrecache ? await caches.open(rootPrecache) : null;
      const results = await Promise.allSettled(files.filter((path) => path !== "index.html").map(async (path) => {
        const target = new URL(path, scope);
        // Vite includes a content hash in these filenames. Reuse the exact asset
        // if the regular app has already downloaded it into its own cache.
        const reusable = /^assets\/[^/]+-[\w-]{8}\.[\w.]+$/.test(path)
          ? await cachedAssets?.match(new URL(path, root))
          : undefined;
        let asset;
        if (reusable?.ok) {
          const headers = new Headers(reusable.headers);
          headers.delete("Content-Encoding");
          headers.delete("Content-Length");
          // Keep relative imports in the pinned directory even when the bytes
          // came from a cached response whose URL points at the regular app.
          asset = new Response(reusable.body, { headers });
        } else {
          asset = await fetch(target, { cache: "reload" });
        }
        if (!asset.ok) throw new Error("Cannot download app asset");
        await cache.put(target, asset);
      }));
      if (results.some((result) => result.status === "rejected")) {
        await caches.delete(cacheName);
        throw new Error("Cannot download app shell");
      }
      // Write the index last: its presence marks a complete snapshot.
      try {
        await cache.add(new Request(index, { cache: "reload" }));
      } catch (error) {
        await caches.delete(cacheName);
        throw error;
      }
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
