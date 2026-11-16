// Guarda o app para abrir sem internet. As notícias sempre tentam a rede primeiro.
const CACHE = "radar-v1";
const CASCA = ["./", "index.html", "noticias.json", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CASCA)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Rede primeiro; se falhar, a última cópia salva.
  const chave = url.pathname.endsWith("noticias.json") ? url.origin + url.pathname : req;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(chave, copia)); }
        return res;
      })
      .catch(() => caches.match(chave).then((r) => r || caches.match("index.html")))
  );
});
