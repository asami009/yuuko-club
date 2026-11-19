/* 一度開いたら電波がなくても使えるようにする仕組み。ファイルを直したら VERSION の数字を上げる。
   電波があるときは毎回新しい版がないか確かめ、なければ保存しておいた物を使う */
var VERSION = 'yuuhan-v6';
var FILES = ['./', 'index.html', 'style.css', 'js/engine.js', 'js/plate.js', 'js/app.js', 'manifest.webmanifest',
  'data/ingredients.json', 'data/seasonings.json', 'data/sauces.json', 'data/classics.json', 'data/help.json',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
// 同じサイトのファイルは「まずネット、だめなら保存した物」。外のサイト（Geminiなど）には手を出さない
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    // cache: 'no-cache' で、毎回GitHubに「新しい版がないか」を確かめる（古いファイルが10分残るのを防ぐ）
    fetch(e.request, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, copy); }); }
      return res;
    }).catch(function () { return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); }); })
  );
});
