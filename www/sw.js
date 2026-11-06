/* Service worker: makes the app work fully offline and keeps Manjari once it has been downloaded. */
var VERSION = 'finnish-v3';
var SHELL = ['./', 'index.html', 'style.css', 'app.js', 'export.js', 'import.js', 'translit.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/favicon-64.png', 'icons/apple-touch-icon.png', 'icons/finnish-wordmark.png',
  'fonts/Meera.ttf', 'fonts/Rachana-Regular.ttf', 'fonts/Rachana-Bold.ttf', 'fonts/Dyuthi.ttf',
  'fonts/Manjari-Regular.ttf', 'fonts/Manjari-Bold.ttf', 'fonts/Chilanka-Regular.ttf', 'fonts/Gayathri-Regular.ttf', 'fonts/Gayathri-Bold.ttf'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    // add each file separately so a missing optional font file does not break installation
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () { }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var isFont = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !isFont) return;
  e.respondWith(caches.open(VERSION).then(function (cache) {
    return cache.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(function () { return hit; });
      // fonts never change: cache-first. App files: stale-while-revalidate.
      if (hit) { if (!isFont) net.catch(function () { }); return hit; }
      return net.then(function (r) { return r || (req.mode === 'navigate' ? cache.match('index.html') : r); });
    });
  }));
});
