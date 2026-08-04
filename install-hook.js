/**
 * =====================================================================
 * install-hook.js — 「ホーム画面に 入れる」の 合図を いちばん 先に 受ける
 * =====================================================================
 *
 * ■ なぜ 独立した ファイルで、<head> の いちばん 上なのか
 * Chrome は 条件が そろうと **すぐに** beforeinstallprompt を 出します。
 * この 合図は 1回きりで、受ける 人が いなければ そのまま 消えます。
 * app.js（19本目の スクリプト）で 受けて いた ころは、校内 Wi-Fi が
 * こんで いる 時間に 合図を 取りこぼし、せってい画面の
 * 「ホーム画面に 入れる」ボタンが **出ない ことが ありました**。
 *
 * ■ なぜ index.html の 中に 直接 書かないのか
 * CSP（Content-Security-Policy）で script-src 'self' に して いるので、
 * index.html の 中に 書いた <script> は 実行されません。
 * 'unsafe-inline' を 足せば 動きますが、それでは CSP を 入れた 意味が
 * ほとんど 無く なります。だから 小さくても 外の ファイルに します。
 *
 * このファイルは 何にも たよりません。app.js より ずっと 先に 走ります。
 */
(function () {
  'use strict';

  window.__pwaInstallPrompt = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    // 既定の おしらせを 止めて、アプリの ボタンから 出せるように しまって おきます
    e.preventDefault();
    window.__pwaInstallPrompt = e;
    // app.js が もう 動いて いる ときは この おしらせで ボタンを 出します。
    // まだの ときは、app.js が 起きた ときに __pwaInstallPrompt を 見ます。
    window.dispatchEvent(new Event('pwa-install-available'));
  });

  window.addEventListener('appinstalled', function () {
    window.__pwaInstallPrompt = null;
    window.dispatchEvent(new Event('pwa-installed'));
  });
})();
