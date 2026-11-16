// Guarda o app para abrir sem internet. As notícias sempre tentam a rede primeiro.
const CACHE = "radar-v5";
const CASCA = ["./", "index.html", "styles.css", "app.js", "radar.js", "espn.js", "calendario.js", "stadium3d.js", "vendor/three.module.min.js", "icons/monograma.png", "noticias.json", "dados/jogos.json", "dados/tabela.json", "dados/elenco.json", "dados/times.json", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];

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
  const chave = url.pathname.endsWith(".json") ? url.origin + url.pathname : req;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(chave, copia)); }
        return res;
      })
      .catch(() => caches.match(chave).then((r) => r || caches.match("index.html")))
  );
});
