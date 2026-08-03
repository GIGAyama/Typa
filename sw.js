/**
 * =====================================================================
 * sw.js — オフラインでも つかえるようにする サービスワーカー
 * =====================================================================
 * Typa は インターネットに つながって いなくても れんしゅうできます。
 * 学校の Wi-Fi が こんでいる 時間でも、授業が 止まらないようにするためです。
 *
 * ■ スコープ
 * このファイルは アプリと 同じ フォルダに 置くので、サービスワーカーが
 * 面倒を みるのは **その フォルダの 下だけ** です。
 * 同じ ドメインに ほかの ページが あっても、そこには 何も しません。
 *
 * （注意: コメントの 中に 半角の アスタリスクと スラッシュを ならべて 書くと、
 *  そこで コメントが おわって しまい、ファイル 全体が こわれます）
 *
 * ■ きろくには さわりません
 * れんしゅうの きろくは localStorage に あり、サービスワーカーの
 * キャッシュとは べつの ものです。バージョンを 上げて 古い キャッシュを
 * 消しても、児童の きろくは 消えません。
 */
/*
 * 【最重要】activate では自アプリ以外のキャッシュを削除しない。
 *   gigayama.github.io は数十個のアプリが同一オリジンを共有しているため、
 *   CACHE_PREFIX で始まるキャッシュだけを掃除する。
 *   以前はここで caches.keys() の結果を全部消していた。そのため
 *   このアプリを開くたびに、同じ端末に入っている他の GIGA アプリの
 *   キャッシュまで巻き添えで消え、それらがオフラインで起動しなくなっていた。
 */
const CACHE_PREFIX = 'typa-';
const APP_VERSION = 'v18';   // ← リリースごとに必ず上げる
const VERSION = CACHE_PREFIX + APP_VERSION;
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './css/fx.css',
  './js/icons.js',
  './js/fx.js',
  './js/layout.js',
  './js/romaji.js',
  './js/lessons.js',
  './js/mastery.js',
  './js/store.js',
  './js/studyLog.js',
  './js/studySession.js',
  './js/studyStats.js',
  './js/backup.js',
  './js/awards.js',
  './js/keyboard.js',
  './js/hands.js',
  './js/buddy.js',
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
      .then(keys => Promise.all(keys
        // ← 自アプリ接頭辞のものだけを削除する。ここを外すと
        //    同一オリジンの他アプリを巻き添えにする。
        .filter(k => k.startsWith(CACHE_PREFIX) && k !== VERSION)
        .map(k => caches.delete(k))))
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
