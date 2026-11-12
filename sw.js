/* The export step inserts the integrity hashes of the release served by Pages. */
const files = {"index.html":"sha256-GoAayNBGcYKoG+gkKvo4atmcjLbu7DEmqayiClai7ZA=","manifest.webmanifest":"sha256-bTZnNZwttyhecAzJ3fIK0rXixoQcad0+DHPQNKAPz+A=","icon-180.png":"sha256-hPt2L9+yi6Yq6bNNpNh5XIcOtjeCDykR2DclbGoug3s=","icon-192.png":"sha256-BdY4LzWL5k4GXPcvgekW4WMpQ1JnYG1080FmAChSOzY=","icon-512.png":"sha256-klDUaoJPvQOWKeI4hgJIsx6vRbvhmck4k14fU0EfYYI="};
const prefix = "interdoku-pwa:" + self.registration.scope + ":";
const cacheName = prefix + "c5a6228aa993ce175a8ed082";
const assets = new Map(Object.entries(files).map(([name, integrity]) =>
  [new URL(name, self.registration.scope).href, integrity]));
const home = new URL("index.html", self.registration.scope).href;
let preparation;

function prepare() {
  if (!preparation) {
    preparation = (async () => {
      const cache = await caches.open(cacheName);
      const requests = [...assets].map(([url, integrity]) => new Request(url, {integrity, cache:"reload"}));
      await cache.addAll(requests);
    })().finally(() => { preparation = null; });
  }
  return preparation;
}

self.addEventListener("install", event => {
  event.waitUntil(prepare().then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const obsolete = (await caches.keys()).filter(key => key.startsWith(prefix) && key !== cacheName);
    await Promise.all(obsolete.map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data !== "check-offline" || !event.ports[0]) return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(cacheName);
      const stored = await cache.keys();
      const urls = new Set(stored.map(req => req.url));
      if (![...assets.keys()].every(url => urls.has(url))) await prepare();
      event.ports[0].postMessage(true);
    } catch {
      event.ports[0].postMessage(false);
    }
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  url.search = "";
  const target = url.href === self.registration.scope && event.request.mode === "navigate" ? home : url.href;
  if (!assets.has(target)) return;
  event.respondWith((async () => {
    const stored = await caches.match(target, {cacheName});
    return stored || fetch(event.request);
  })());
});

