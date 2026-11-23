// sw.js — AENO V3 離線快取
const CACHE = "aeno-v3-5";
const ASSETS = [
  "./", "./index.html", "./style.css",
  "./manifest.json", "./planets.json",
  "./js/main.js", "./js/data.js", "./js/state.js",
  "./js/ui.js", "./js/game.js", "./js/world3d.js", "./js/characters3d.js",
  "./js/player3d.js", "./assets/models/player.glb", "./assets/models/player.vrm"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => k !== CACHE ? caches.delete(k) : null))));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return resp;
    }).catch(() => caches.match("./index.html")))
  );
});
