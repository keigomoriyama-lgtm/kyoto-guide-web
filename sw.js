// Kyoto Workshop Guide - service worker (offline shell + image cache)
const VER = 'kwg-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'img/header.jpg', 'img/art_noh.jpg', 'img/art_masks.jpg', 'img/art_maiko.jpg', 'img/art_geiko.jpg',
  'img/art_ochaya.jpg', 'img/art_butoh.jpg', 'img/art_shinto.jpg', 'img/art_photo.jpg', 'img/art_benrido.jpg'];
const IMG = 'kwg-img-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER && k !== IMG).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Sheets: never intercepted (the page handles its own data cache)
  if (url.hostname.endsWith('google.com')) return;

  // Same origin: network first (so updates arrive), cache as fallback
  if (url.origin === location.origin) {
    if (url.pathname.includes('/img/') || url.pathname.includes('/icons/')) {
      e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const cp = res.clone(); caches.open(VER).then(c => c.put(req, cp)); return res; })));
      return;
    }
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(VER).then(c => c.put(req, cp)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
    return;
  }

  // Cross-origin images (photos on GitHub Pages / Drive): show cached copy, refresh in background
  if (req.destination === 'image') {
    e.respondWith((async () => {
      const cache = await caches.open(IMG);
      const hit = await cache.match(req.url);
      const net = fetch(req.url, { mode: 'cors' }).then(res => { if (res.ok) cache.put(req.url, res.clone()); return res; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      const res = await net;
      return res || fetch(req).catch(() => Response.error());
    })());
  }
});
