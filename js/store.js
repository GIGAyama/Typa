/**
 * =====================================================================
 * store.js — 端末に のこす データ（せってい・きろく・すすみぐあい）
 * =====================================================================
 * Typa は アカウントを もちません（学習ログ共通スキーマ §0-2「アプリ層は匿名」）。
 * 名前も 出席番号も もたず、この端末の localStorage にだけ 記録します。
 *
 * まなびクエストへ 送る 学習ログ（study.records.v1）は、送ったあと
 * ポータルが 端末から けします。それだけだと 児童の 手もとに
 * 「これまで どれだけ できるように なったか」が のこらないので、
 * **Typa 自身の きろく（typa.history.v1）は べつに もちます**。
 */
(function (global) {
  'use strict';

  const KEYS = {
    settings: 'typa.settings.v1',
    progress: 'typa.progress.v1',
    history: 'typa.history.v1'
  };

  const HISTORY_MAX = 300;   // 古いものから すてます（端末の 保存領域を あふれさせない）

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const value = JSON.parse(raw);
      return (value === null || value === undefined) ? fallback : value;
    } catch (e) { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  // ------------------------------------------------------------------
  // せってい
  // ------------------------------------------------------------------

  const DEFAULT_SETTINGS = {
    layout: 'jis',        // キーボードの配列（日本語配列を きほんに します）
    keyboard: true,       // 画面に キーボードを 出す
    fingerGuide: true,    // 指の 色分けを 出す
    romajiHint: true,     // ローマ字の ヒントを 出す
    sound: true,          // 打ったときの おと
    bigText: false,       // 文字を 大きく
    theme: 'auto'         // auto / light / dark
  };

  function getSettings() {
    return Object.assign({}, DEFAULT_SETTINGS, read(KEYS.settings, {}));
  }

  function setSetting(name, value) {
    const s = getSettings();
    s[name] = value;
    write(KEYS.settings, s);
    return s;
  }

  // ------------------------------------------------------------------
  // すすみぐあい（ステージごとの さいこう記録）
  // ------------------------------------------------------------------

  /** @returns {Object} { [stageId]: { clears, bestKps, bestAccuracy, stars, lastAt } } */
  function getProgress() { return read(KEYS.progress, {}); }

  /**
   * ステージの けっかを すすみぐあいに 反映します。
   * ★は「正かくさ」で 決めます。速さで 決めると、
   * まちがえても はやく 打つほど よい、という まちがった 練習に なるためです。
   */
  function applyResult(stageId, result) {
    const all = getProgress();
    const cur = all[stageId] || { clears: 0, bestKps: 0, bestAccuracy: 0, stars: 0, lastAt: null };
    cur.clears += 1;
    cur.bestKps = Math.max(cur.bestKps, result.kps);
    cur.bestAccuracy = Math.max(cur.bestAccuracy, result.accuracy);
    cur.stars = Math.max(cur.stars, starsOf(result));
    cur.lastAt = result.finishedAt;
    all[stageId] = cur;
    write(KEYS.progress, all);
    return cur;
  }

  /** ★の 数（0〜3）。まちがいが 少ないほど 高くなります */
  function starsOf(result) {
    if (result.accuracy >= 98) return 3;
    if (result.accuracy >= 92) return 2;
    if (result.accuracy >= 80) return 1;
    return 0;
  }

  // ------------------------------------------------------------------
  // きろく（じぶんの あゆみ）
  // ------------------------------------------------------------------

  function getHistory() { return read(KEYS.history, []); }

  function addHistory(entry) {
    const list = getHistory();
    list.push(entry);
    write(KEYS.history, list.slice(-HISTORY_MAX));
    return list;
  }

  /** きょうの ぶんだけを 集めます（ホームの「きょうの れんしゅう」に つかいます） */
  function todaySummary() {
    const today = new Date().toISOString().slice(0, 10);
    const list = getHistory().filter(h => String(h.at || '').slice(0, 10) === today);
    const keys = list.reduce((sum, h) => sum + (h.correctKeys || 0), 0);
    const ms = list.reduce((sum, h) => sum + (h.elapsedMs || 0), 0);
    return { count: list.length, keys, minutes: Math.round(ms / 60000) };
  }

  /** これまでの いちばん よい 記録 */
  function bestOverall() {
    const list = getHistory().filter(h => h.mode !== 'shortcut' && h.correctKeys > 0);
    if (list.length === 0) return null;
    const kps = list.reduce((best, h) => Math.max(best, h.kps || 0), 0);
    const acc = list.reduce((best, h) => Math.max(best, h.accuracy || 0), 0);
    return { kps, accuracy: acc, count: list.length };
  }

  global.Typa = global.Typa || {};
  global.Typa.Store = {
    KEYS, DEFAULT_SETTINGS, getSettings, setSetting,
    getProgress, applyResult, starsOf,
    getHistory, addHistory, todaySummary, bestOverall
  };
})(window);
