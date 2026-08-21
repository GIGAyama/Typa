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
 *   旧配信元の gigayama.github.io は数十個のアプリが同一オリジンを共有していた。
 *   同居する配置に戻したときに他アプリを巻き込まないよう、
 *   CACHE_PREFIX で始まるキャッシュだけを掃除する。
 *   以前はここで caches.keys() の結果を全部消していた。そのため
 *   このアプリを開くたびに、同じ端末に入っている他の GIGA アプリの
 *   キャッシュまで巻き添えで消え、それらがオフラインで起動しなくなっていた。
 */
const CACHE_PREFIX = 'typa-';
// APP_VERSION は手で上げない。node tools/build-sw.mjs が先読み対象の中身から自動で決める
const APP_VERSION = 'v1785a635'; /* __APP_VERSION__ */
const VERSION = CACHE_PREFIX + APP_VERSION;
const ASSETS = [
  './',
  './index.html',
  './offline.html',
  './install-hook.js',
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
  './records-export.html',
  './js/records-export.js',
  './js/records-hub-client.js',
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
      // 1つでも 取れないと 全部 失敗して しまうので、1件ずつ 入れます。
      // cache: 'reload' で、ブラウザの 古い ひかえでは なく
      // ネットワークから 取り直します（版を 上げたのに 中身が 古い、を ふせぎます）
      .then(cache => Promise.all(ASSETS.map(
        url => cache.add(new Request(url, { cache: 'reload' })).catch(() => null))))
  );
  // ■ ここで skipWaiting() は しません
  //   まえは していました。そのため 版を 上げると、児童が 打って いる
  //   まっさい中でも 断りなく 新しい 版に 入れかわって いました。
  //   実測でも、版を 上げて 3秒 待つ あいだに 勝手に 切りかわりました。
  //   打ちかけの お題や、出した ばかりの けっかが 消えます。
  //   新しい 版は「待つ」だけに して、画面の おしらせを 押して もらってから
  //   切りかえます（js/app.js の 更新おしらせ を 見て ください）。
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
        // 圏外の ときは 手もとの ひかえ。それも 無い ときは
        // 「こわれた」と 思わせない ための offline.html を 出します
        .catch(async () => (await caches.match('./index.html'))
          || (await caches.match('./'))
          || (await caches.match('./offline.html'))
          || new Response('<!doctype html><meta charset="utf-8"><p>いま インターネットに つながって いません。</p>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
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

/*
 * 画面から「さいしんに する」を 押された ときだけ、待って いる 版に 切りかえます。
 * 押されない かぎり、いま 動いて いる 版の まま です。
 */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
