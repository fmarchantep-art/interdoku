/* The export step inserts the integrity hashes of the release served by Pages. */
const files = {"index.html":"sha256-GdpwbQT/afxPDVAI+YzdIWmZo2Kf3twayvbafeBeMtU=","manifest.webmanifest":"sha256-bTZnNZwttyhecAzJ3fIK0rXixoQcad0+DHPQNKAPz+A=","icon-180.png":"sha256-hPt2L9+yi6Yq6bNNpNh5XIcOtjeCDykR2DclbGoug3s=","icon-192.png":"sha256-BdY4LzWL5k4GXPcvgekW4WMpQ1JnYG1080FmAChSOzY=","icon-512.png":"sha256-klDUaoJPvQOWKeI4hgJIsx6vRbvhmck4k14fU0EfYYI=","musica/teatro.mp3":"sha256-Mym3NqKiBdup3kIai5u54a05xB5JWoudfMCANBm9cUA=","musica/museo.mp3":"sha256-pz1Hr2RchbuqNdOLiykMd1CR3tW3g4y3hfa/YGfjkoA=","musica/hotel.mp3":"sha256-jFPQfi1BYvnI8mthsLqREEDwuAgIt5oz0X/JoYtoTpo=","musica/estacion-espacial.mp3":"sha256-QZqLcqHpK5WnewueGmaod3vNM760fw3UD69YLJ6HXdo=","musica/excavacion.mp3":"sha256-76IvrY6zxCkEvBJMoOabTYA4o4iE/zYcy8omIyBZPCA="};
const prefix = "interdoku-pwa:" + self.registration.scope + ":";
const cacheName = prefix + "69dad61b8626458b20685849";
const assets = new Map(Object.entries(files).map(([name, integrity]) =>
  [new URL(name, self.registration.scope).href, integrity]));
const home = new URL("index.html", self.registration.scope).href;
const demo = new URL("demo-historial.html", self.registration.scope).href;
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

// Media players request byte ranges, including when seeking back to the start of a loop.
async function audioRange(stored, header) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return stored;
  const blob = await stored.blob();
  const size = blob.size;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (start > end) return new Response(null, {status:416, headers:{"Content-Range":"bytes */" + size}});
  return new Response(blob.slice(start, end + 1), {status:206, headers:{
    "Accept-Ranges":"bytes", "Content-Type":"audio/mpeg", "Content-Length":String(end - start + 1),
    "Content-Range":`bytes ${start}-${end}/${size}`,
  }});
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  url.search = "";
  const opensGame = event.request.mode === "navigate" && (url.href === self.registration.scope || url.href === demo);
  const target = opensGame ? home : url.href;
  if (!assets.has(target)) return;
  event.respondWith((async () => {
    const stored = await caches.match(target, {cacheName});
    const range = event.request.headers.get("range");
    if (stored && range && url.pathname.endsWith(".mp3")) return audioRange(stored, range);
    return stored || fetch(event.request);
  })());
});

