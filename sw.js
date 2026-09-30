// Service worker: makes the site installable and loads it fast on repeat visits.
// Pages load from the network first (so updates show right away) and fall back to the cached copy offline.
// Calls to the Google Apps Script backend are never cached.
var VERSION = 'aur-v1';
var CORE = [
  '/', '/index.html', '/refer.html', '/partner.html', '/upload.html', '/referral-terms.html',
  '/styles.css', '/main.js', '/referral.js', '/referral-config.js', '/upload.js', '/qrcode.min.js',
  '/logo.png', '/favicon-32.png', '/icon-192.png', '/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  var url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // backend, fonts etc. go straight to the network

  e.respondWith(
    fetch(req).then(function (res) {
      if (res.ok) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(function (hit) {
        return hit || (req.mode === 'navigate' ? caches.match('/index.html') : undefined);
      });
    })
  );
});
