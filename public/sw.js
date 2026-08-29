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
 */
const CACHE = "balance-race-v1";
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
        const fresh = await fetch(req);
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
