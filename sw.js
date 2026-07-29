/**
 * =====================================================================
 * sw.js — オフラインでも つかえるようにする サービスワーカー
 * =====================================================================
 * Typa は インターネットに つながって いなくても れんしゅうできます。
 * 学校の Wi-Fi が こんでいる 時間でも、授業が 止まらないようにするためです。
 *
 * ■ スコープ
 * このファイルは /Typa/ に 置くので、サービスワーカーが 面倒を みるのは
 * **/Typa/ の 下だけ** です。同じ gigayama.github.io にある ほかの 学習アプリや
 * まなびクエストの 学習ポータル（/Gamification/）には 何も しません。
 *
 * ■ 学習ログには さわりません
 * 学習ログ（study.records.v1）は localStorage に あり、
 * サービスワーカーの キャッシュとは べつの ものです。
 * バージョンを 上げて 古い キャッシュを 消しても、児童の きろくは 消えません。
 */
const VERSION = 'typa-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/icons.js',
  './js/layout.js',
  './js/romaji.js',
  './js/lessons.js',
  './js/store.js',
  './js/studylog.js',
  './js/keyboard.js',
  './js/nav.js',
  './js/play.js',
  './js/shortcut.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      // 1つでも 取れないと 全部 失敗して しまうので、1件ずつ 入れます
      .then(cache => Promise.all(ASSETS.map(url => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;              // ほかの サイトには さわりません
  if (!url.pathname.startsWith(new URL('./', self.location).pathname)) return;   // /Typa/ の 外は そのまま

  // 画面を ひらく ときは、まず ネットワーク。だめなら キャッシュの index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(cache => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  // それ以外は キャッシュを 先に 返し、うしろで 新しい ものを とっておきます
  event.respondWith(
    caches.match(request).then(hit => {
      const network = fetch(request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then(cache => cache.put(request, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || network;
    })
  );
});
