/**
 * =====================================================================
 * studyStats.js — 学習ログを 読みかえして 児童に 見せる
 * =====================================================================
 * study.records.v1 を **読むだけ** の ファイルです。書きこみも 削除も しません。
 *
 * ■ なぜ 保存と 分けるのか
 * 保存する ほう（studyLog.js）は 8アプリで まったく 同じ ものです。
 * けれど「何を どう 見せるか」は アプリごとに ちがいます。
 * いっしょに すると、見せかたを 直す たびに 共通の ファイルに 手が 入って
 * しまい、アプリの あいだで 中身が ずれて いきます。
 *
 * ■ ここで 出す 数字は、画面の「正かくさ」とは べつ物です
 *
 *   正かくさ（画面）   … 打鍵ベース。正しく 打てた キー ÷ 打った キー
 *   ひとりで 打てた    … お題ベース。**一度も まちがえずに 打ち切った お題** ÷ 打った お題
 *
 * 打鍵ベースは 1文字でも まちがえると すこし 下がるだけですが、お題ベースは
 * その お題ぜんぶが「まちがえた」に なります。だから いつも 低く 出ます。
 * どちらも 正しい 数字です。ならべて 出すと どちらが 本当か 分からなく なるので、
 * **名前と ことばを はっきり 分けて** います。
 *
 * 先生が ほかの アプリと ならべて 見る ときは お題ベースの ほうを つかいます
 * （アプリに よっては 打鍵という 考えかたが ないためです）。
 *
 * ■ まもる こと（仕様書 §5.5）
 *   ・読み出し専用。study.records.v1 に 書かない・消さない
 *   ・自分の appId（typa）だけを 見る。ほかの アプリの きろくは 出さない
 *   ・schema が study.v1 の ものだけ
 *   ・こわれて いたら 空の 配列。画面を こわさない
 */
(function (global) {
  'use strict';

  const T = global.Typa;
  const KEY = 'study.records.v1';
  const APP_ID = 'typa';

  /** @returns {Array} 新しい 回が さき。読めなければ 空 */
  function loadRecords(appId) {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const log = JSON.parse(raw);
      if (!Array.isArray(log)) return [];
      return log
        .filter(r => r && r.schema === 'study.v1' && r.appId === (appId || APP_ID))
        .reverse();
    } catch (e) {
      return [];
    }
  }

  /**
   * 正答率を 出して よい 回か。
   *
   * 自己評価の 回（grading が objective で ない）と、ふたりで つかった 回
   * （multiplayer）は 学力の 目やすに なりません。Typa は いまの ところ
   * どちらも 出しませんが、**児童に 見せる 画面でも 先生の 集計と 同じ 線引き**を
   * して おきます。あとで モードを ふやした ときに、ここだけ ずれる ことを
   * ふせぐ ためです。
   */
  function scorable(r) {
    return !!r && r.grading === 'objective' && !r.multiplayer &&
      !!r.summary && (r.summary.attempted || 0) > 0;
  }

  /** その回の ほんとうの 解答数（200件で 切り詰めた 回は ext に のこして あります） */
  function attemptedOf(r) {
    const t = r.ext && r.ext.itemsTruncated;
    return t ? (t.attempted || 0) : ((r.summary && r.summary.attempted) || 0);
  }

  function firstTryOf(r) {
    const t = r.ext && r.ext.itemsTruncated;
    return t ? (t.firstTryCorrect || 0) : ((r.summary && r.summary.firstTryCorrect) || 0);
  }

  /**
   * 直近 n日の まとめ。
   *
   * **completed の わりあいは 出しません。** Typa は とちゅうで やめても
   * 打った ぶんが のこる ことを ねらいに して いるので、aborted が 多いのは
   * ねらいどおりに つかわれて いる しるしです。取り組みの 量は
   * お題の 合計（count）と 時間の 合計（activeMs）で 見ます。
   *
   * @param {number} days 何日ぶん 見るか
   * @param {Array} [records] 先に 読んだ ものが あれば わたせます
   */
  function summary(days, records) {
    const list = records || loadRecords();
    const from = T.Store.dayBefore(Math.max(0, (days || 7) - 1));
    const out = {
      sessions: 0, items: 0, activeMs: 0, minutes: 0,
      attempted: 0, firstTryCorrect: 0, rate: null
    };
    list.forEach(r => {
      if (T.Store.localDay(r.startedAt) < from) return;
      out.sessions++;
      out.items += (r.summary && r.summary.count) || 0;
      out.activeMs += r.activeMs || 0;
      if (!scorable(r)) return;
      out.attempted += attemptedOf(r);
      out.firstTryCorrect += firstTryOf(r);
    });
    out.minutes = Math.round(out.activeMs / 60000);
    if (out.attempted > 0) out.rate = (out.firstTryCorrect / out.attempted) * 100;
    return out;
  }

  /**
   * 単元（ステージ）ごとの まとめ。
   * @param {number} [minAttempted] これだけ 打って いない 単元は 出しません
   */
  function byUnit(minAttempted, records) {
    const list = records || loadRecords();
    const map = {};
    list.forEach(r => {
      if (!scorable(r) || !r.unit || !r.unit.id) return;
      const cur = map[r.unit.id] ||
        (map[r.unit.id] = { id: r.unit.id, title: r.unit.title || r.unit.id,
                            attempted: 0, firstTryCorrect: 0, sessions: 0, lastAt: '' });
      cur.attempted += attemptedOf(r);
      cur.firstTryCorrect += firstTryOf(r);
      cur.sessions++;
      if (!cur.lastAt || (r.startedAt || '') > cur.lastAt) cur.lastAt = r.startedAt || '';
    });
    const need = Math.max(1, minAttempted || 1);
    return Object.keys(map)
      .map(id => {
        const u = map[id];
        u.rate = (u.firstTryCorrect / u.attempted) * 100;
        return u;
      })
      .filter(u => u.attempted >= need)
      .sort((a, b) => a.rate - b.rate);       // 苦しい ところが さき
  }

  global.Typa = global.Typa || {};
  global.Typa.StudyStats = { loadRecords, summary, byUnit, scorable };
})(window);
