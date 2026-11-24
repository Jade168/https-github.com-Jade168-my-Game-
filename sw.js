// sw.js — AENO V3 離線快取
// 策略（v7 起修正）：程式碼/頁面用 network-first，永遠攞最新版（有網就唔會食舊版）；
// 大模型檔（.glb/.vrm）同圖片先用 cache-first（大檔唔使次次重下載）。
// 舊版 cache-first 曾經令玩家長期停留喺舊版本（公仔/掣/動物更新睇唔到），所以改咗。
const CACHE = "aeno-v3-24";
const ASSETS = [
  "./", "./index.html", "./style.css",
  "./manifest.json", "./planets.json",
  "./js/main.js", "./js/data.js", "./js/state.js",
  "./js/ui.js", "./js/game.js", "./js/world3d.js", "./js/characters3d.js",
  "./js/player3d.js", "./assets/models/player.glb", "./assets/models/player.vrm", "./assets/models/fox.glb", "./js/pet3d.js", "./js/toon.js", "./js/paint.js"
];
const BIG_FILE = /\.(glb|vrm|png|jpe?g|webp|mp3|ogg|wav)(\?|$)/i;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.map(k => k !== CACHE ? caches.delete(k) : null)))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = e.request.url;
  if (BIG_FILE.test(url)) {
    // 大檔：cache-first
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return resp;
      }))
    );
  } else {
    // 程式碼/頁面/資料：network-first，冇網先用快取
    e.respondWith(
      fetch(e.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return resp;
      }).catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
    );
  }
});
