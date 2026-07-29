/**
 * =====================================================================
 * studylog.js — 学習ログ共通スキーマ study.v1 の 書き出し
 * =====================================================================
 * 「学習ログ共通スキーマ仕様書 study.v1」にしたがって、練習1回ぶんの
 * きろくを localStorage の `study.records.v1` に ためます。
 *
 * ここで ためた きろくは、同じ オリジン（gigayama.github.io）にある
 * **学習ポータル**が よみだして、まなびクエストへ 送ります。
 * Typa 自身は 通信を しません（アプリ層は 匿名・保存のみ。仕様 §0-2 / §1）。
 *
 * ┌ Typa（gigayama.github.io/Typa/）
 * │   └ localStorage: study.records.v1 に append
 * └ 学習ポータル（gigayama.github.io/Gamification/manabi-portal/）
 *     └ まなびクエスト（GAS）へ 送信 → 「タイピング記録」シートへ 自動転記
 *
 * ■ タイピングならではの 中身（ext）
 * まなびクエストの「タイピング記録」シートは
 * 「正しく打てた数 / 打った合計数 / 正答率 / ミス率 / 速さ」で できています。
 * summary.count は お題の数なので、**打鍵数は ext に 入れて** 送ります。
 * さらに「どのキー・どの指で つまずいたか」も ext に 入れるので、
 * 先生は クラス全体の にがてな 指づかいを 見ることが できます。
 */
(function (global) {
  'use strict';

  const LOG_KEY = 'study.records.v1';   // 仕様 §1: 全アプリ共通の 学習ログキー
  const SCHEMA = 'study.v1';
  const APP_ID = 'typa';                // まなびクエスト側 STUDY_APPS の キーと そろえます
  const APP_VERSION = '1.0.0';

  const MAX_RECORDS = 500;              // 端末に ためておく 上限（あふれる前に 古いものから すてます）
  const MAX_ITEMS = 200;                // 仕様 §2.10: 設問層の 上限
  const MAX_EXT_BYTES = 8192;           // 仕様 §2.11: 拡張層の 上限

  /** UUID v4（仕様 §2.1 の id）。古い端末むけに 手作りの ものも 用意します */
  function uuid() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    const buf = new Uint8Array(16);
    if (global.crypto && global.crypto.getRandomValues) global.crypto.getRandomValues(buf);
    else for (let i = 0; i < 16; i++) buf[i] = Math.floor(Math.random() * 256);
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    const hex = Array.prototype.map.call(buf, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function loadAll() {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  /**
   * きろくを 1件 ためます。
   * 保存できないとき（プライベートモードなど）は false を返し、
   * よび出し側が 児童に「せんせいに つたえてね」と 知らせます。
   */
  function append(record) {
    const list = loadAll();
    list.push(record);
    const trimmed = list.slice(-MAX_RECORDS);
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(trimmed));
      return true;
    } catch (e) {
      // 保存領域が いっぱいの ときは、古い ものを もう少し すてて 1回だけ やりなおします
      try {
        localStorage.setItem(LOG_KEY, JSON.stringify(trimmed.slice(-Math.floor(MAX_RECORDS / 2))));
        return true;
      } catch (e2) { return false; }
    }
  }

  /** まだ 送っていない きろくの 数（ホーム画面の 案内に つかいます） */
  function pendingCount() {
    return loadAll().filter(r => r && r.schema === SCHEMA).length;
  }

  /** 誤答の 中身（wrong）は 仕様 §9 の 受け入れ条件に あわせて そうじします */
  function sanitizeWrong(list) {
    const out = [];
    (list || []).forEach(v => {
      const s = String(v);
      if (s.length > 0 && s.length <= 12 && !/[<>{}\\]/.test(s) && out.indexOf(s) < 0) out.push(s);
    });
    return out.slice(0, 8);
  }

  /**
   * 練習1回ぶんを study.v1 の レコードに 組み立てて 保存します。
   *
   * @param {Object} r セッションの けっか
   *   - stage / course: どの ステージか
   *   - startedAt(Date), elapsedMs, activeMs
   *   - status: 'completed' | 'aborted'
   *   - source: 'course'（じゅんばん）/ 'review'（もう1かい）/ 'weak'（にがてだけ）
   *   - items: [{ q, ok, firstTry, tries, ms, wrong: [] }]
   *   - correctKeys / totalKeys / missKeys / kps / accuracy
   *   - missByKey / missByFinger
   * @returns {{saved: boolean, id: string}}
   */
  function saveSession(r) {
    const stage = r.stage;
    const course = r.course;
    const started = r.startedAt instanceof Date ? r.startedAt : new Date(r.startedAt);

    // --- 設問層（§2.10）: お題1つ＝1件。200件を こえたら 切り詰め、
    //     ほんとうの 解答数は ext.itemsTruncated に のがします（§2.7）
    const allItems = (r.items || []).map(it => {
      const o = {
        q: String(it.q).slice(0, 64),
        ok: !!it.ok,
        firstTry: !!it.firstTry
      };
      if (typeof it.tries === 'number') o.tries = Math.round(it.tries);
      if (typeof it.ms === 'number') o.ms = Math.round(it.ms);
      if (stage.skill) o.skill = String(stage.skill).slice(0, 20);
      const wrong = sanitizeWrong(it.wrong);
      if (wrong.length) o.wrong = wrong;
      return o;
    });
    const items = allItems.slice(0, MAX_ITEMS);

    const attempted = allItems.length;
    const correct = allItems.filter(i => i.ok).length;
    const firstTryCorrect = allItems.filter(i => i.firstTry).length;

    const count = Math.min(1000, Math.max(attempted, items.length));

    // --- 拡張層（§2.11）: タイピングならではの 数字
    const ext = {
      correctKeys: Math.round(r.correctKeys || 0),
      totalKeys: Math.round(r.totalKeys || 0),
      missKeys: Math.round(r.missKeys || 0),
      kps: Math.round((r.kps || 0) * 100) / 100,
      accuracy: Math.round((r.accuracy || 0) * 10) / 10,
      layout: r.layout || 'jis',
      courseId: course ? course.id : '',
      stageId: stage.id
    };
    if (r.missByKey && Object.keys(r.missByKey).length) ext.missByKey = topN(r.missByKey, 10);
    if (r.missByFinger && Object.keys(r.missByFinger).length) ext.missByFinger = topN(r.missByFinger, 10);
    if (allItems.length > items.length) {
      // 切り詰めた ぶんの 本当の 実績（§2.7）。これが ないと
      // 長く がんばった 回ほど「やっていない」と 見えてしまいます
      ext.itemsTruncated = { attempted, firstTryCorrect };
    }
    trimExt(ext);

    const record = {
      schema: SCHEMA,
      id: uuid(),
      appId: APP_ID,
      appVersion: APP_VERSION,
      kind: 'set',                       // お題が 決まっている ひとまとまり（§2.2）
      mode: stage.mode,
      unit: {
        id: String(stage.id).slice(0, 80),
        title: String(`${course ? course.short + '／' : ''}${stage.title}`).slice(0, 120)
      },
      startedAt: started.toISOString(),
      elapsedMs: Math.max(0, Math.min(86400000, Math.round(r.elapsedMs || 0))),
      status: r.status === 'aborted' ? 'aborted' : 'completed',
      source: r.source || 'course',
      grading: 'objective',              // 正誤は アプリが 判定します（§2.9）
      timeBasis: 'app',
      multiplayer: false,
      summary: {
        count,
        attempted: Math.min(count, attempted),
        correct: Math.min(count, correct),
        firstTryCorrect: Math.min(count, firstTryCorrect)
      },
      ext
    };
    if (stage.grade) record.unit.grade = stage.grade;
    if (typeof r.activeMs === 'number') {
      record.activeMs = Math.max(0, Math.min(record.elapsedMs, Math.round(r.activeMs)));
    }
    if (items.length) record.items = items;

    return { saved: append(record), id: record.id };
  }

  /** ミスの おおい じゅんに N件だけ のこします（ext を 小さく たもつため） */
  function topN(map, n) {
    return Object.keys(map)
      .sort((a, b) => map[b] - map[a])
      .slice(0, n)
      .reduce((o, k) => { o[k] = map[k]; return o; }, {});
  }

  /** ext が 8KB を こえないように、こまかい 統計から けずります（§2.11） */
  function trimExt(ext) {
    const size = () => JSON.stringify(ext).length;
    if (size() <= MAX_EXT_BYTES) return;
    delete ext.missByKey;
    if (size() <= MAX_EXT_BYTES) return;
    delete ext.missByFinger;
  }

  global.Typa = global.Typa || {};
  global.Typa.StudyLog = { LOG_KEY, SCHEMA, APP_ID, APP_VERSION, saveSession, pendingCount, uuid };
})(window);
