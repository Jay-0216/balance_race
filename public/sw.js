/*
 * Enough of a service worker to install the game to a home screen and to let
 * the solo half work with no network at all - which is the case this is
 * actually for: a phone on a bus, or a school wifi that has given up.
 *
 * Two strategies, and the split matters:
 *   - the page itself is NETWORK FIRST, so a deploy is picked up on the next
 *     load rather than being pinned by whatever was cached;
 *   - the built assets are CACHE FIRST, which is safe because Vite puts a
 *     content hash in their names - a changed file is a different URL.
 *
 * Nothing cross-origin is touched at all. Caching Supabase would serve a stale
 * room, and caching the font would be someone else's bytes to manage.
 *
 * "Network first" for the page used a bare fetch(req), which only ever
 * bypasses OUR Cache Storage - it says nothing about the browser's ordinary
 * HTTP disk cache underneath it, which still gets to hand back a cached
 * response of its own without a real round trip. In practice that meant a
 * page loaded once could keep re-serving that same snapshot on every later
 * visit, deploy after deploy - a build from before a fix looking rendered
 * with the fix's own code, on a device this environment cannot reach to
 * reproduce, is exactly that shape of bug. cache: "no-store" on the request
 * is what actually forces a real fetch. Bumped to v2 so anyone already stuck
 * on an old snapshot gets unstuck the moment this file itself is fetched.
 */
const CACHE = "balance-race-v2";
const PAGE = "page";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(new Request(req, { cache: "no-store" }));
        (await caches.open(CACHE)).put(PAGE, fresh.clone());
        return fresh;
      } catch {
        return (await caches.match(PAGE)) ?? Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const fresh = await fetch(req);
    // opaque and error responses are not worth keeping
    if (fresh.ok && fresh.type === "basic") (await caches.open(CACHE)).put(req, fresh.clone());
    return fresh;
  })());
});
