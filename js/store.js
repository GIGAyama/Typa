/**
 * =====================================================================
 * store.js — 端末に のこす データ
 * =====================================================================
 * Typa は アカウントを もちません。名前も 出席番号も もたず、通信も しません。
 * れんしゅうの きろくは、すべて **この 端末の localStorage の 中だけ** に
 * のこります。ほかの サイトへ おくる しくみは アプリの 中に ありません。
 *
 * のこす もの
 *   typa.settings.v1  … せってい
 *   typa.progress.v1  … ステージごとの さいこう記録と ★
 *   typa.history.v1   … れんしゅう 1回ぶんの きろく（新しい 300件）
 *   typa.awards.v1    … けいけんち・レベル・バッジ・つみあげた 合計
 *   typa.challenge.v1 … チャレンジ（時間ないに どれだけ 打てるか）の さいこう記録
 *
 * ■ 「きょう」は 端末の 時計で 数えます
 * ISO の 文字列を そのまま 切ると 世界標準時に なり、日本では
 * あさ 9時までが「きのう」に なって しまいます。日づけは かならず
 * localDay() を とおして、端末の 時計で 数えます。
 */
(function (global) {
  'use strict';

  const KEYS = {
    settings: 'typa.settings.v1',
    progress: 'typa.progress.v1',
    history: 'typa.history.v1',
    awards: 'typa.awards.v1',
    challenge: 'typa.challenge.v1'
  };

  const HISTORY_MAX = 300;   // 古いものから すてます（端末の 保存領域を あふれさせない）

  /**
   * こまかい きろく（打つまでの 時間・とりちがえ・ローマ字の きまり）を
   * のこす 回数。
   *
   * この 3つは 1回ぶんで きろく全体の 3ばいくらいの 大きさに なります。
   * ぜんぶの 回に つけると 300回で 600KB を こえ、いつか 保存できなく なります。
   * にがての 集計は もともと 直近 40回 しか 見ないので、
   * それより 少し 多い ぶんだけ のこせば じゅうぶんです。
   */
  const DETAIL_MAX = 60;
  const DETAIL_FIELDS = ['lat', 'conf', 'rule'];

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

  /** 端末の 時計で「YYYY-MM-DD」。日づけの 数えかたは いつも これに そろえます */
  function localDay(value) {
    const d = value ? new Date(value) : new Date();
    if (isNaN(d.getTime())) return '';
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /** きょうから n日 前の 日づけ */
  function dayBefore(n) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);          // 夏時間や うるう秒で 日が ずれないように 昼で 計算します
    d.setDate(d.getDate() - n);
    return localDay(d);
  }

  /** きょうから n日 あとの 日づけ（ふくしゅうの 日を 決めるのに つかいます） */
  function dayAhead(n) { return dayBefore(-n); }

  // ------------------------------------------------------------------
  // せってい
  // ------------------------------------------------------------------

  const DEFAULT_SETTINGS = {
    layout: 'jis',        // キーボードの配列（日本語配列を きほんに します）
    keyboard: true,       // 画面に キーボードを 出す
    fingerGuide: true,    // 指の 色分けを 出す
    keyLabels: true,      // 画面の キーに 文字を 書く
    romajiHint: true,     // ローマ字の ヒントを 出す
    sound: true,          // 打ったときの おと
    bigText: false,       // 文字を 大きく
    strict: true,         // まちがえたら 正しい キーを 押すまで すすまない
    retry: true,          // まちがえた お題を さいごに もう1回 出す
    assist: 'custom',     // ヒントの つよさ（0〜3 / 'auto' / 'custom'）
    theme: 'auto'         // auto / light / dark
  };

  // ------------------------------------------------------------------
  // ヒントの つよさ
  // ------------------------------------------------------------------
  //
  // 画面の キーボードを ずっと 出して いると、「画面を 見て 打つ」癖が
  // かたまります。手もとを 見ない ように するには、なれるに つれて
  // ヒントを **すこしずつ** 消して いくのが いちばんの ちかみちです。
  //
  // ■ つまみを 4つ 目に 足さない
  // keyboard / fingerGuide / romajiHint の 3つは たがいに 別ものなので、
  // ここに もう1つ 足すと 言うことが 食いちがいます。そこで assist を
  // **えらぶ ところ** に して、えらんだら 3つの ほうを 書きかえます。
  // 読む 道は 1つだけに なり、ぜったいに くいちがいません。
  // 手で スイッチを さわった ときは assist を 'custom' に もどします。
  //
  // ■ ことばの 案内は どの つよさでも 消しません
  // 「つぎは D を みぎの ひとさしゆびで」は のこします。消えるのは 絵だけです。
  // 「色だけに たよらない」という きまりを ここでも まもります。
  // （めかくしだけは べつです。そこでは 色でも 何も 言って いないので、
  //   ことばを 消しても きまりは やぶれません）

  const ASSIST_LEVELS = [
    // 0 ぜんぶ 見える
    { keyboard: true, fingerGuide: true, keyLabels: true, nextGlow: true, romajiHint: true },
    // 1 ゆびの 色だけ（ローマ字の ヒントを 消す）
    { keyboard: true, fingerGuide: true, keyLabels: true, nextGlow: true, romajiHint: false },
    // 2 ばしょだけ（キーの 文字も 指の 色も 消す。ひかりと でっぱりは のこす）
    { keyboard: true, fingerGuide: false, keyLabels: false, nextGlow: true, romajiHint: false },
    // 3 なにも 出ない（ことばの 案内だけ）
    { keyboard: false, fingerGuide: false, keyLabels: false, nextGlow: false, romajiHint: false }
  ];

  const ASSIST_LABELS = ['ぜんぶ 見える', 'ゆびの 色だけ', 'ばしょだけ', 'なにも 出ない'];

  /**
   * おぼえぐあいから ちょうどよい つよさを えらびます。
   *
   * まもり: **★3つを 1回も とって いない ステージでは 2いじょうに しません**。
   * まだ できて いない ところで 画面を 消すと、ただ こまるだけです。
   */
  function autoAssist(ctx) {
    const m = ctx && typeof ctx.stageMastery === 'number' ? ctx.stageMastery : null;
    if (m === null) return 0;
    let level = m < 0.35 ? 0 : (m < 0.60 ? 1 : (m < 0.85 ? 2 : 3));
    if (level >= 2 && !(ctx && ctx.everThreeStars)) level = 1;
    return level;
  }

  /**
   * いま 何を 見せるかを 決めます。play.js は これを 1回だけ よび、
   * あとは 返って きた ものだけを 見ます（せっていを 直接 読みません）。
   *
   * @param {Object} settings getSettings() の 中身
   * @param {Object} [ctx] { stageMastery, everThreeStars, blind }
   */
  function resolveAssist(settings, ctx) {
    const c = ctx || {};
    // めかくし … その回 だけの おためし。ことばの 案内も 出しません
    if (c.blind) {
      return {
        keyboard: false, fingerGuide: false, keyLabels: false, nextGlow: false,
        romajiHint: false, fingerWords: false, level: 'blind'
      };
    }
    let level = settings.assist;
    if (level === 'auto') level = autoAssist(c);
    if (typeof level !== 'number' || level < 0 || level >= ASSIST_LEVELS.length) {
      // 'custom' … スイッチを そのまま つかいます
      return {
        keyboard: settings.keyboard !== false,
        fingerGuide: settings.fingerGuide !== false,
        keyLabels: settings.keyLabels !== false,
        nextGlow: settings.keyboard !== false,
        romajiHint: settings.romajiHint !== false,
        fingerWords: true,
        level: 'custom'
      };
    }
    return Object.assign({}, ASSIST_LEVELS[level], {
      fingerWords: true,
      level: settings.assist === 'auto' ? level : level,
      auto: settings.assist === 'auto'
    });
  }

  /** ヒントの つよさを えらびます。3つの スイッチも いっしょに 書きかえます */
  function setAssist(level) {
    const s = getSettings();
    s.assist = level;
    if (typeof level === 'number' && ASSIST_LEVELS[level]) {
      const L = ASSIST_LEVELS[level];
      s.keyboard = L.keyboard;
      s.fingerGuide = L.fingerGuide;
      s.keyLabels = L.keyLabels;
      s.romajiHint = L.romajiHint;
    }
    write(KEYS.settings, s);
    return s;
  }

  function getSettings() {
    return Object.assign({}, DEFAULT_SETTINGS, read(KEYS.settings, {}));
  }

  /** スイッチを 手で さわった ら、ヒントの つよさは「じぶんで」に もどします */
  const ASSIST_OWNED = ['keyboard', 'fingerGuide', 'keyLabels', 'romajiHint'];

  function setSetting(name, value) {
    const s = getSettings();
    s[name] = value;
    if (ASSIST_OWNED.indexOf(name) >= 0) s.assist = 'custom';
    write(KEYS.settings, s);
    return s;
  }

  // ------------------------------------------------------------------
  // すすみぐあい（ステージごとの さいこう記録）
  // ------------------------------------------------------------------

  /** @returns {Object} { [stageId]: { clears, bestKps, bestAccuracy, stars, lastAt, box, due } } */
  function getProgress() { return read(KEYS.progress, {}); }

  // ------------------------------------------------------------------
  // ふくしゅう（間を あけて もう1回）
  // ------------------------------------------------------------------
  //
  // ★3に した ステージは、そのままだと 二度と 出て きません。
  // けれど 打ちかたは 使わないと わすれます。そこで、うまく できた ステージほど
  // **間を のばしながら** もう一度 よびもどします。
  //
  //   1日 → 3日 → 7日 → 14日 → 30日
  //
  // うまく できなかった 回は はこを 1に もどして、あすまた 出します。
  // 日づけは かならず localDay() を とおします（ISO を 切ると 世界標準時に なり、
  // 日本では あさ9時までが「きのう」に なって しまうためです）。

  const REVIEW_DAYS = [1, 3, 7, 14, 30];

  /** きろくが 古い ステージを ふくしゅうに よぶまでの 日数（前からの ユーザーむけ） */
  const REVIEW_SEED_DAYS = 7;

  /**
   * ふくしゅうの 日を 決めます。progress の 中に box と due を 足すだけなので、
   * 前から つかって いる 人の きろくは そのまま つかえます（どちらも なければ box=0）。
   */
  function scheduleReview(cur, stars) {
    const box = Math.max(0, Math.min(REVIEW_DAYS.length, cur.box || 0));
    // ★2つ（正かくさ 92%）いじょうで つぎの はこへ。それ未満は 1に もどします
    const next = stars >= 2 ? Math.min(box + 1, REVIEW_DAYS.length) : 1;
    cur.box = next;
    cur.due = dayAhead(REVIEW_DAYS[next - 1]);
    return cur;
  }

  /**
   * きょう ふくしゅうすると よい ステージ。
   * @param {number} [limit] いくつまで 返すか
   * @returns {Array<{stageId, due, box, lastAt, overdue}>} 日が すぎて いる ものから
   */
  function dueStages(limit) {
    const all = getProgress();
    const today = localDay();
    const seedBefore = dayBefore(REVIEW_SEED_DAYS);
    const out = [];
    Object.keys(all).forEach(stageId => {
      const p = all[stageId];
      if (!p || !(p.clears > 0)) return;
      let due = p.due;
      // 前から つかって いる 人には due が ありません。
      // しばらく さわって いない ステージを ふくしゅうに よびます
      if (!due) {
        const last = localDay(p.lastAt);
        if (!last || last > seedBefore) return;
        due = last;
      }
      if (due > today) return;
      out.push({ stageId, due, box: p.box || 0, lastAt: p.lastAt, overdue: due < today });
    });
    out.sort((a, b) => (a.due < b.due ? -1 : (a.due > b.due ? 1 : 0)));
    return limit ? out.slice(0, limit) : out;
  }

  /**
   * ステージの けっかを すすみぐあいに 反映します。
   * ★は「正かくさ」で 決めます。速さで 決めると、
   * まちがえても はやく 打つほど よい、という まちがった 練習に なるためです。
   *
   * @returns {{best: Object, newBestKps: boolean, newStars: number}}
   *   さいこう記録を こえたかどうかは、けっか画面の「新記録！」に つかいます。
   */
  function applyResult(stageId, result) {
    const all = getProgress();
    const cur = all[stageId] || { clears: 0, bestKps: 0, bestAccuracy: 0, stars: 0, lastAt: null };
    const before = { bestKps: cur.bestKps, stars: cur.stars, clears: cur.clears };
    const stars = starsOf(result);
    cur.clears += 1;
    cur.bestKps = Math.max(cur.bestKps, result.kps || 0);
    cur.bestAccuracy = Math.max(cur.bestAccuracy, result.accuracy || 0);
    cur.stars = Math.max(cur.stars, stars);
    cur.lastAt = result.finishedAt;
    scheduleReview(cur, stars);
    all[stageId] = cur;
    write(KEYS.progress, all);
    return {
      best: cur,
      firstClear: before.clears === 0,
      newBestKps: before.clears > 0 && (result.kps || 0) > before.bestKps + 0.05,
      newStars: Math.max(0, stars - before.stars),
      prevBestKps: before.bestKps
    };
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

  /** 古い 回から こまかい きろくを おとします（新しい DETAIL_MAX 回だけ のこす） */
  function trimDetail(list) {
    const keepFrom = list.length - DETAIL_MAX;
    for (let i = 0; i < keepFrom; i++) {
      const h = list[i];
      if (!h) continue;
      DETAIL_FIELDS.forEach(f => { if (h[f] !== undefined) delete h[f]; });
    }
    return list;
  }

  /**
   * れんしゅう1回ぶんを のこします。
   *
   * ■ 入りきらなかった ときに だまって 消さない
   * localStorage が いっぱいだと setItem は 失敗します。前は その 戻り値を
   * 見て いなかったので、**きろくが 静かに 消えて いました**。気づくのは
   * つぎの 授業です。入らなかったら 中身を へらして やり直します。
   *
   * @returns {{ok: boolean, trimmed: boolean}} trimmed は 古い ぶんを けずったか
   */
  function addHistory(entry) {
    const list = trimDetail(getHistory().concat([entry])).slice(-HISTORY_MAX);
    if (write(KEYS.history, list)) return { ok: true, trimmed: false };

    // 1回目の やり直し … こまかい きろくを ぜんぶ すてる
    const lean = list.map(h => {
      const copy = Object.assign({}, h);
      DETAIL_FIELDS.forEach(f => delete copy[f]);
      return copy;
    });
    if (write(KEYS.history, lean)) return { ok: true, trimmed: true };

    // 2回目の やり直し … 数を 半分に する
    if (write(KEYS.history, lean.slice(-Math.floor(HISTORY_MAX / 2)))) {
      return { ok: true, trimmed: true };
    }
    return { ok: false, trimmed: true };
  }

  /** きょうの ぶんだけを 集めます（ホームの「きょうの ようす」に つかいます） */
  function todaySummary() {
    const today = localDay();
    const list = getHistory().filter(h => localDay(h.at) === today);
    const keys = list.reduce((sum, h) => sum + (h.correctKeys || 0), 0);
    const ms = list.reduce((sum, h) => sum + (h.elapsedMs || 0), 0);
    return { count: list.length, keys, minutes: Math.round(ms / 60000) };
  }

  /** これまでの いちばん よい 記録 */
  function bestOverall() {
    const list = getHistory().filter(h => countsAsTyping(h) && h.correctKeys > 0);
    if (list.length === 0) return null;
    const kps = list.reduce((best, h) => Math.max(best, h.kps || 0), 0);
    const acc = list.reduce((best, h) => Math.max(best, h.accuracy || 0), 0);
    return { kps, accuracy: acc, count: list.length };
  }

  /** 打鍵の 記録として かぞえる 回か（ショートカットは 打鍵を 数えません） */
  function countsAsTyping(entry) {
    return entry && entry.mode !== 'shortcut';
  }

  /** れんしゅうした 日の 一覧（新しい じゅん・重なりなし） */
  function practiceDays() {
    const seen = {};
    getHistory().forEach(h => { const d = localDay(h.at); if (d) seen[d] = true; });
    return Object.keys(seen).sort().reverse();
  }

  /**
   * れんぞく日数。きょう れんしゅうして いなくても、きのうまで つづいて いれば
   * その 日数を 返します（「きょう やれば つづく」と 見せるため）。
   */
  function streak() {
    const days = practiceDays();
    if (days.length === 0) return { days: 0, todayDone: false };
    const today = localDay();
    const todayDone = days[0] === today;
    if (!todayDone && days[0] !== dayBefore(1)) return { days: 0, todayDone: false };
    let n = 0;
    let cursor = todayDone ? 0 : 1;
    for (let i = 0; i < days.length; i++) {
      if (days[i] === dayBefore(cursor)) { n++; cursor++; }
      else if (days[i] < dayBefore(cursor)) break;
    }
    return { days: n, todayDone };
  }

  /** 直近 n日の れんしゅう量（カレンダーの 見た目に つかいます） */
  function recentDays(n) {
    const byDay = {};
    getHistory().forEach(h => {
      const d = localDay(h.at);
      if (d) byDay[d] = (byDay[d] || 0) + (h.correctKeys || 0);
    });
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const day = dayBefore(i);
      out.push({ day, keys: byDay[day] || 0 });
    }
    return out;
  }

  /**
   * にがてな キーを 数えます（新しい 回ほど おもく 見ます）。
   * ここで 出た キーから「にがて とっくん」の お題を つくります。
   * @param {number} [span] 見にいく 回数
   */
  function missSummary(span) {
    const list = getHistory().slice(-(span || 40));
    const byKey = {};
    const byFinger = {};
    list.forEach((h, i) => {
      const weight = 1 + i / Math.max(1, list.length);     // 新しい 回を すこし おもく
      Object.keys(h.missByKey || {}).forEach(k => { byKey[k] = (byKey[k] || 0) + h.missByKey[k] * weight; });
      Object.keys(h.missByFinger || {}).forEach(k => { byFinger[k] = (byFinger[k] || 0) + h.missByFinger[k] * weight; });
    });
    const sort = map => Object.keys(map).sort((a, b) => map[b] - map[a]);
    return { byKey, byFinger, keys: sort(byKey), fingers: sort(byFinger) };
  }

  // ------------------------------------------------------------------
  // けいけんち・レベル・バッジ
  // ------------------------------------------------------------------

  const DEFAULT_AWARDS = {
    xp: 0,
    keys: 0,          // これまでに 正しく 打った 数（きろくを けずっても へりません）
    sessions: 0,      // れんしゅうした 回数
    perfect: 0,       // ミス 0 で おわった 回数
    weak: 0,          // にがて とっくんを した 回数
    challenge: 0,     // チャレンジを した 回数
    unlocked: {}      // バッジID → もらった 日
  };

  function getAwards() {
    const a = Object.assign({}, DEFAULT_AWARDS, read(KEYS.awards, {}));
    a.unlocked = Object.assign({}, a.unlocked);
    return a;
  }

  function saveAwards(a) { return write(KEYS.awards, a); }

  // ------------------------------------------------------------------
  // チャレンジの さいこう記録
  // ------------------------------------------------------------------

  function getChallenge() { return read(KEYS.challenge, {}); }

  /**
   * チャレンジの けっかを のこします。
   * @returns {{best: Object, isBest: boolean, prev: Object|null}}
   */
  function applyChallenge(id, result) {
    const all = getChallenge();
    const prev = all[id] || null;
    const score = Math.round(result.correctKeys || 0);
    const isBest = !prev || score > prev.keys;
    all[id] = {
      keys: Math.max(score, prev ? prev.keys : 0),
      kps: Math.max(result.kps || 0, prev ? prev.kps : 0),
      accuracy: Math.max(result.accuracy || 0, prev ? prev.accuracy : 0),
      at: result.finishedAt
    };
    write(KEYS.challenge, all);
    return { best: all[id], isBest, prev };
  }

  // ------------------------------------------------------------------
  // きろくを けす
  // ------------------------------------------------------------------

  /** せっていは のこして、れんしゅうの きろくだけを ぜんぶ けします */
  function clearRecords() {
    [KEYS.progress, KEYS.history, KEYS.awards, KEYS.challenge].forEach(k => {
      try { localStorage.removeItem(k); } catch (e) { /* けせなくても つづけます */ }
    });
  }

  global.Typa = global.Typa || {};
  global.Typa.Store = {
    KEYS, HISTORY_MAX, DEFAULT_SETTINGS, getSettings, setSetting,
    ASSIST_LEVELS, ASSIST_LABELS, resolveAssist, setAssist, autoAssist,
    getProgress, applyResult, starsOf,
    REVIEW_DAYS, scheduleReview, dueStages,
    HISTORY_DETAIL_MAX: DETAIL_MAX,
    getHistory, addHistory, todaySummary, bestOverall, countsAsTyping,
    keySummary: span => global.Typa.Mastery.keySummary(getHistory(), span),
    ruleSummary: span => global.Typa.Mastery.ruleSummary(getHistory(), span),
    weakRules: span => global.Typa.Mastery.weakRules(getHistory(), span),
    weakTargets: span => global.Typa.Mastery.weakTargets(getHistory(), span),
    practiceDays, streak, recentDays, missSummary,
    getAwards, saveAwards,
    getChallenge, applyChallenge,
    clearRecords, localDay, dayBefore, dayAhead
  };
})(window);
