/**
 * =====================================================================
 * backup.js — きろくの 書き出しと 読みこみ
 * =====================================================================
 * Typa の きろくは その 端末の localStorage の 中だけに あります。
 * べんりな 反面、**端末を 入れかえると ぜんぶ 消えます**。
 * 学校の Chromebook は 学年が かわると 別の 端末に なることが あるので、
 * 手で 持ち出せる みちを 1つ 用意します。
 *
 * ■ ここでも 通信は しません
 * 書き出しは ブラウザの 中で ファイルを 作って ダウンロードするだけです。
 * どこかの サーバーへ おくる しくみは この ファイルの 中に ありません。
 * できた ファイルは その 端末の「ダウンロード」に 入ります。
 *
 * ■ 読みこみは「置きかえ」だけ
 * 2つの きろくを まぜると、けいけんちが 二重に 数えられたり、
 * どちらが 本当か 分からなく なったり します。子どもに 説明できない
 * ふるまいは 入れません。読みこむと **いまの きろくは 消えます**。
 *
 * ■ 読みこんだ ものを そのまま 信じない
 * ファイルは 手で 書きかえられます。とくに せっていは
 * **知っている 名前だけ** を 取りこみます（まるごと 代入しない）。
 * そうしないと、これから ふえる せっていに 何でも 入れられて しまいます。
 */
(function (global) {
  'use strict';

  const T = global.Typa;

  /** この 形式の ばんごう。中身を かえたら 1つ 上げます */
  const SCHEMA = 1;

  /**
   * 書き出す localStorage の キー。Store.KEYS と そろえます。
   *
   * 学習ログ（`study.records.v1`）は **わざと 入れて いません**。
   * ほかの アプリと 共有して いる キーなので、読みこみ（置きかえ）の ときに
   * ほかの アプリの きろくまで 消えて しまいます。学習ログを 先生に わたす 道は
   * 送信ページの ほうに あり、この ファイルの しごとでは ありません。
   */
  function keyList() {
    const K = T.Store.KEYS;
    return [K.settings, K.progress, K.history, K.awards, K.challenge];
  }

  // ------------------------------------------------------------------
  // 書き出す
  // ------------------------------------------------------------------

  /**
   * いまの きろくを まとめた オブジェクトを 作ります。
   * @param {string} [appVersion] アプリの ばんごう（あとで 見わけが つくように）
   */
  function buildExport(appVersion) {
    const data = {};
    keyList().forEach(key => {
      let raw = null;
      try { raw = localStorage.getItem(key); } catch (e) { raw = null; }
      if (raw === null) return;
      try { data[key] = JSON.parse(raw); } catch (e) { /* こわれた ものは 出しません */ }
    });
    return {
      app: 'Typa',
      schema: SCHEMA,
      appVersion: appVersion || '',
      exportedAt: new Date().toISOString(),
      data
    };
  }

  function toText(obj) { return JSON.stringify(obj, null, 1); }

  /** ファイル名。日づけは 端末の 時計で 数えます（Store.localDay と 同じ） */
  function fileName() {
    return `typa-きろく-${T.Store.localDay()}.json`;
  }

  /**
   * ブラウザに ファイルを 作らせて ダウンロードします。
   * @returns {boolean} 作れたか（管理された 端末では 止められる ことが あります）
   */
  function download(text, name) {
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name || fileName();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // すぐに 消すと ダウンロードが 始まらない ことが あるので すこし まちます
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* noop */ } }, 4000);
      return true;
    } catch (e) { return false; }
  }

  /**
   * クリップボードに うつします（ダウンロードが 止められて いる ときの にげみち）。
   * ここも 端末の 中だけの 動きです。
   */
  function copyText(text) {
    if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true, () => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch (e) { return false; }
  }

  // ------------------------------------------------------------------
  // 読みこむ
  // ------------------------------------------------------------------

  function isObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }

  /**
   * ファイルの 中身を しらべます。**ここでは まだ 保存しません**。
   * @param {string} text ファイルの 中身
   * @returns {{ok: true, clean: Object, summary: Object} | {ok: false, message: string}}
   *   message は そのまま 画面に 出せる やさしい ことばに します
   */
  function parseImport(text) {
    let obj;
    try { obj = JSON.parse(text); }
    catch (e) { return bad('この ファイルは Typa の きろくでは ないみたい。'); }

    if (!isObject(obj)) return bad('この ファイルは Typa の きろくでは ないみたい。');
    if (obj.app !== 'Typa') return bad('Typa の きろくでは ないみたい。べつの ファイルを えらんでね。');
    if (typeof obj.schema !== 'number') return bad('この ファイルは こわれて いるみたい。');
    if (obj.schema > SCHEMA) {
      return bad('あたらしい Typa で 作った ファイルみたい。アプリを 新しく してから 読みこんでね。');
    }
    if (!isObject(obj.data)) return bad('この ファイルには きろくが 入って いないみたい。');

    const K = T.Store.KEYS;
    const clean = {};
    const d = obj.data;

    // せってい … 知っている 名前だけ 取りこみます（まるごと 代入しない）
    if (isObject(d[K.settings])) {
      const src = d[K.settings];
      const out = {};
      Object.keys(T.Store.DEFAULT_SETTINGS).forEach(name => {
        if (!Object.prototype.hasOwnProperty.call(src, name)) return;
        const want = typeof T.Store.DEFAULT_SETTINGS[name];
        if (typeof src[name] === want) out[name] = src[name];
      });
      clean[K.settings] = out;
    }

    // すすみぐあい … ステージID → 数の かたまり
    if (isObject(d[K.progress])) {
      const src = d[K.progress];
      const out = {};
      Object.keys(src).forEach(id => {
        const p = src[id];
        if (!isObject(p)) return;
        out[id] = {
          clears: num(p.clears),
          bestKps: num(p.bestKps),
          bestAccuracy: num(p.bestAccuracy),
          stars: Math.max(0, Math.min(3, num(p.stars))),
          lastAt: typeof p.lastAt === 'string' ? p.lastAt : null,
          // ひとまわりの とちゅう。ここを 落とすと、うつした とたんに
          // 「あと 3もんで ひとまわり」が 0 に もどって しまいます
          lapItems: num(p.lapItems),
          lapCorrect: num(p.lapCorrect),
          lapTotal: num(p.lapTotal)
        };
      });
      clean[K.progress] = out;
    }

    // きろく … 配列。at の ない ものは 日づけが 数えられないので すてます
    if (Array.isArray(d[K.history])) {
      clean[K.history] = d[K.history]
        .filter(h => isObject(h) && typeof h.at === 'string')
        .slice(-T.Store.HISTORY_MAX);
    }

    // けいけんち・バッジ
    if (isObject(d[K.awards])) {
      const a = d[K.awards];
      clean[K.awards] = {
        xp: num(a.xp), keys: num(a.keys), sessions: num(a.sessions),
        perfect: num(a.perfect), weak: num(a.weak), challenge: num(a.challenge),
        unlocked: isObject(a.unlocked) ? a.unlocked : {}
      };
    }

    // チャレンジの さいこう記録
    if (isObject(d[K.challenge])) {
      const src = d[K.challenge];
      const out = {};
      Object.keys(src).forEach(id => {
        const c = src[id];
        if (!isObject(c)) return;
        out[id] = { keys: num(c.keys), kps: num(c.kps), accuracy: num(c.accuracy), at: c.at || null };
      });
      clean[K.challenge] = out;
    }

    if (Object.keys(clean).length === 0) {
      return bad('この ファイルには きろくが 入って いないみたい。');
    }
    return { ok: true, clean, summary: describe(clean, obj) };
  }

  function bad(message) { return { ok: false, message }; }

  /** 読みこむ 前に「何が 入って いるか」を 見せる ための まとめ */
  function describe(clean, raw) {
    const K = T.Store.KEYS;
    const history = clean[K.history] || [];
    const progress = clean[K.progress] || {};
    const awards = clean[K.awards] || {};
    let stars = 0;
    Object.keys(progress).forEach(id => { stars += progress[id].stars || 0; });
    let last = '';
    history.forEach(h => { if (!last || h.at > last) last = h.at; });
    return {
      sessions: history.length,
      stars,
      xp: Math.round(awards.xp || 0),
      lastAt: last,
      exportedAt: (raw && raw.exportedAt) || ''
    };
  }

  /**
   * しらべ おわった きろくを 保存します。**いまの きろくは 消えます**。
   * @param {Object} clean parseImport が 返した clean
   * @returns {boolean} 保存できたか
   */
  function applyImport(clean) {
    let ok = true;
    // 先に ぜんぶ 消してから 入れます。古い きろくが 混ざらないように します
    keyList().forEach(key => {
      try { localStorage.removeItem(key); } catch (e) { ok = false; }
    });
    Object.keys(clean).forEach(key => {
      try { localStorage.setItem(key, JSON.stringify(clean[key])); }
      catch (e) { ok = false; }
    });
    return ok;
  }

  global.Typa = global.Typa || {};
  global.Typa.Backup = {
    SCHEMA, buildExport, toText, fileName, download, copyText,
    parseImport, describe, applyImport
  };
})(window);
