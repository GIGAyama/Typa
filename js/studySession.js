/**
 * =====================================================================
 * studySession.js — Typa の れんしゅう1回を study.v1 の かたちに する
 * =====================================================================
 * js/studyLog.js は 8アプリで 同じ ものです。**Typa の 事情は ぜんぶ ここ**に
 * まとめて あります（仕様書 §3.9）。
 *
 * ■ Typa は 区切りを 持たない アプリです
 * 「はじまり」も「おわり」も 決めない つくりなので、この スキーマとは
 * いちばん あいにくい アプリです。そこを どう あわせたかが つぎの 3つです。
 *
 * 1) **count は「お題の 数」**。打鍵数では ありません
 *    1回で 数百打に なるので、count に 入れると ほかの アプリの「問題数」と
 *    けたが 合いません。打鍵の 数は ext に 名前を かえて 入れます。
 *    画面に 出る「正かくさ」（打鍵ベース）と、先生が 見る 初回正答率
 *    （お題ベース）は **べつの 数字**です。どちらも 正しい 数字なので、
 *    まざらない ように 名前を 分けて あります（ext.keyAccuracy）。
 *
 * 2) **aborted が ふつうの つかいかた**
 *    とちゅうで やめても 打った ぶんが のこる ことを 中心に すえた アプリなので、
 *    aborted は「やりとげられなかった」では ありません。ただの 事実です。
 *    取り組みの 量は count の 合計と activeMs の 合計で 見ます（§5.4）。
 *
 * 3) **時間の ものさしを 2本 持ちます**
 *    アプリの 中では「5秒より 長い 手止まり」を のぞいた 時間で 速さを 出して
 *    いますが、その 値を activeMs に 入れては いけません。**Typa だけ 学習時間が
 *    みじかく 出て**、熱心に 練習した子ほど 時間が 少なく 見える ことに なります。
 *
 *      activeMs      … 60秒 基準（8アプリ 共通）。横に ならべる ための 時間
 *      ext.typingMs  … 5秒 基準（Typa の つごう）。速さの 計算に つかった 時間
 *
 * ■ おまけの 周（打ち直し）は 分けて 数えます
 * ひとまわりの さいごに 出す「まちがえた お題を もう1回」は、アプリの 中でも
 * 速さ・正かくさ・★・けいけんちから のぞいて います。学習ログでも 同じに します。
 * ただし **つまずきの きろくは すてません**。ext.retry に 分けて のこします。
 */
(function (global) {
  'use strict';

  const T = global.Typa;

  /** 仕様書 §3.1 の 予約値。受信側の 許可リストにも この 名前で 入れます */
  const APP_ID = 'typa';

  /**
   * 手を 止めたと 見なす まで の 時間。**60秒から かえては いけません**（§2.8）。
   * ここを みじかく すると Typa の activeMs だけが 系統的に 小さく 出て、
   * 全アプリを 合計した 学習時間が 実際より 少なく なります。
   * 画面に 出す 速さの 計算は 5秒 基準の ままで よく、そちらは play.js に あります。
   */
  const IDLE_LIMIT_MS = 60000;

  const ITEMS_MAX = 200;      // 1レコードの 設問の かず（§2.10）
  const COUNT_MAX = 1000;     // 受信側が うけとる count の 上限（§9.2）
  const DAY_MS = 86400000;    // elapsedMs の 上限（§9.2）
  const EXT_MAX = 7800;       // ext は 8KB まで（§2.11）。すこし よゆうを 見ます
  const MISS_TOP = 20;        // ミスの 一覧に のこす キーの かず

  const ACTIVE_EVENTS = ['click', 'keydown', 'touchstart', 'pointerdown'];

  // ------------------------------------------------------------------
  // 単元ID（§2.5・§3.9.1）
  // ------------------------------------------------------------------
  //
  // ステージの id は コースの 中でだけ 一意なので（hp-1 は ほかの コースにも
  // ありえます）、**コースIDと つないで** 単元ID に します。
  //
  // 表示名（stage.title）からは 作りません。表示名は 言いまわしを 直す たびに
  // かわり、そのたびに 過去の きろくと つながらなく なるからです。
  //
  // ステージの id を かえた ときは、下の 表に **旧 id を 足して 同じ 単元ID に
  // 向けます**。そうすれば 名前を かえる 前と あとの きろくが つながります。
  const UNIT_ALIASES = {
    // 'コースID:ふるい ステージID': 'あたらしい 単元ID'
    // れい: 'home-position:hp-0': 'home-position-hp-1'
  };

  function unitIdOf(courseId, stageId) {
    const key = `${courseId}:${stageId}`;
    return UNIT_ALIASES[key] || `${courseId}-${stageId}`;
  }

  // ------------------------------------------------------------------
  // 設問ID（§2.10）
  // ------------------------------------------------------------------

  const ASCII_ONLY = /^[\x20-\x7e]+$/;

  /** djb2。**乱数や 時刻を まぜません**。同じ お題は いつも 同じ ID に なります */
  function hashOf(text) {
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }

  /**
   * お題を 設問ID に します。
   *
   *   ・アルファベットだけ（20文字いない） … そのまま（ffff / abc）
   *   ・かなや 長い 文               … ハッシュに して みじかく（w-1a2b3c4d）
   *   ・空                            … q-empty
   *
   * かなの お題を そのまま 入れないのは、問題文を ID に すると 容量を おされ、
   * お題を 書きかえた ときに 過去の きろくと つながらなく なるためです。
   */
  function questionId(text) {
    const s = String(text == null ? '' : text);
    if (!s) return 'q-empty';
    if (s.length <= 20 && ASCII_ONLY.test(s)) return s;
    return `w-${hashOf(s)}`;
  }

  // ------------------------------------------------------------------
  // 学習時間（60秒 基準・8アプリ 共通）
  // ------------------------------------------------------------------
  //
  // 仕様書 §2.8 の 参照実装と 同じ うごきに して あります。
  // 1秒ごとに たし、タブが 見えて いない あいだは たさず、
  // 60秒 何も しなければ 止めます。何か 打てば また うごきだします。

  const timer = { ms: 0, mark: 0, idle: true, running: false, tickId: 0, idleId: 0 };

  function tick() {
    const now = Date.now();
    const hidden = typeof document !== 'undefined' && document.hidden;
    if (!timer.idle && !hidden) timer.ms += now - timer.mark;
    timer.mark = now;
  }

  function wake() { tick(); timer.idle = false; }

  /**
   * 時計を 0 から うごかしはじめます（れんしゅう画面を ひらいた とき）。
   * **さいしょは 止まった ところから** はじめます。画面を 出しただけで
   * まだ 手を おいて いない 時間は、学習時間では ないからです。
   */
  function beginSession() {
    endSession();
    timer.ms = 0;
    timer.mark = Date.now();
    timer.idle = true;
    timer.running = true;
    if (typeof document === 'undefined') return;
    timer.tickId = setInterval(tick, 1000);
    timer.idleId = setInterval(() => { tick(); timer.idle = true; }, IDLE_LIMIT_MS);
    document.addEventListener('visibilitychange', tick);
    ACTIVE_EVENTS.forEach(ev => document.addEventListener(ev, wake));
  }

  /** @returns {number} その回の 学習時間（ミリびょう） */
  function endSession() {
    if (timer.running) {
      tick();
      timer.running = false;
      clearInterval(timer.tickId);
      clearInterval(timer.idleId);
      timer.tickId = 0;
      timer.idleId = 0;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', tick);
        ACTIVE_EVENTS.forEach(ev => document.removeEventListener(ev, wake));
      }
    }
    return Math.max(0, Math.round(timer.ms));
  }

  // ------------------------------------------------------------------
  // 組み立て
  // ------------------------------------------------------------------

  const int = n => Math.max(0, Math.round(Number(n) || 0));
  const round1 = n => Math.round((Number(n) || 0) * 10) / 10;
  const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

  function isoOf(value) {
    const d = value ? new Date(value) : new Date();
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  /** ミスの 一覧は おおい ものから MISS_TOP 個まで。ext を 太らせない ためです */
  function topMiss(map) {
    const src = map || {};
    const out = {};
    Object.keys(src)
      .sort((a, b) => src[b] - src[a])
      .slice(0, MISS_TOP)
      .forEach(k => { const n = Math.round(src[k]); if (n > 0) out[k] = n; });
    return out;
  }

  /** 本編の ミス ＝ ぜんぶの ミス － おまけの 周の ミス */
  function subtractMiss(all, sub) {
    const out = {};
    Object.keys(all || {}).forEach(k => {
      const n = Math.round((all[k] || 0) - ((sub || {})[k] || 0));
      if (n > 0) out[k] = n;
    });
    return out;
  }

  function toItem(it) {
    const item = {
      q: questionId(it.qid || it.q),
      ok: !!it.ok,
      firstTry: !!it.firstTry,
      tries: int(it.tries) || 1,
      ms: int(it.ms)
    };
    if (Array.isArray(it.wrong) && it.wrong.length) item.wrong = it.wrong.slice(0, 4);
    return item;
  }

  /**
   * status。
   *
   * ・チャレンジ … 時間で おわったら completed
   * ・ショートカット … 課題を ぜんぶ やったら completed
   * ・ふつうの ステージ … **ひとまわり できた ところで やめたら** completed
   *
   * ひとまわりの とちゅうで やめた 回は aborted です（§5.4）。
   * ただし Typa では aborted が ふつうの つかいかたなので、
   * これを「未完了」として 児童に 出しては いけません。
   */
  function statusOf(result) {
    if (result.status === 'completed') return 'completed';
    const stage = result.stage || {};
    if (stage.mode === 'challenge' || stage.mode === 'shortcut') return 'aborted';
    return ((result.laps || 0) > 0 && int(result.lapPos) === 0) ? 'completed' : 'aborted';
  }

  function unitOf(result) {
    const stage = result.stage || {};
    const course = result.course || {};
    if (stage.mode === 'challenge') {
      // 秒数ごとに べつの 単元に します。20びょうと 60びょうの スコアは くらべられません。
      // 何を 打ったか（ことば／文／キー）は ext.pool に 入れます
      const sec = Math.round((stage.limitMs || 0) / 1000) || int(stage.seconds);
      return { id: `challenge-${sec}s`, title: `チャレンジ ${sec}びょう`, preset: true };
    }
    if (result.special === 'weak') {
      return { id: 'weak-review', title: 'にがて とっくん', preset: true };
    }
    const unit = {
      id: unitIdOf(course.id, stage.id),
      title: `${course.short || course.id}／${stage.title || stage.id}`,
      preset: true
    };
    const grade = int(stage.grade);
    if (grade >= 1 && grade <= 6) unit.grade = grade;
    return unit;
  }

  /** ext が 8KB を こえたら、大きい ものから おとします（§2.11） */
  function fitExt(ext) {
    const drops = ['retry', 'missByKey', 'missByFinger'];
    for (let i = 0; i < drops.length; i++) {
      if (JSON.stringify(ext).length <= EXT_MAX) return ext;
      delete ext[drops[i]];
    }
    return ext;
  }

  /**
   * れんしゅう 1回ぶんの けっかを study.v1 の レコードに します。
   * **localStorage にも DOM にも さわりません**（node から 呼べます。tools/check-study.js）。
   *
   * @param {Object} result play.js / shortcut.js の finish() が 返す もの
   * @param {Object} [ctx] { appVersion }
   */
  function buildRecord(result, ctx) {
    const c = ctx || {};
    const stage = result.stage || {};
    const isChallenge = stage.mode === 'challenge';
    const isShortcut = stage.mode === 'shortcut';
    const isWeak = result.special === 'weak';

    // 設問層は **本編の お題だけ**。おまけの 周（打ち直し）は 入れません。
    // 入れると「まちがえて 打ち直した子ほど 正答率が 上がる」ことに なります
    const main = (result.items || []).filter(it => it && !it.retry);
    const kept = main.slice(0, ITEMS_MAX);

    // 200件を こえたら 切り詰めます。summary は **切り詰めた あとの items から**
    // 出し、ほんとうの 数は ext.itemsTruncated に のこします（§2.7）
    const truncated = main.length > kept.length
      ? { attempted: main.length, firstTryCorrect: main.filter(it => it.firstTry).length }
      : null;

    const elapsedMs = Math.min(DAY_MS, int(result.elapsedMs));
    const retryMs = int(result.retryMs);
    let activeMs = null;
    if (isChallenge) {
      // 時間ぎめは 制限時間 そのものが スコアの まえ提なので 手止まりを のぞきません
      activeMs = elapsedMs;
    } else if (typeof result.activeMs60 === 'number') {
      // 打ち直しに いた 時間は 学習時間から ひきます（§3.9.3）。
      // 時計が ちがう（Date.now と performance.now）ので、さいごに かならず おさえます
      activeMs = Math.min(elapsedMs, Math.max(0, int(result.activeMs60) - retryMs));
    }

    const correctKeys = int(result.correctKeys);
    const totalKeys = int(result.totalKeys);
    const keys = totalKeys || correctKeys;
    const laps = int(result.laps);
    const stars = (stage.noStars || !laps || !T.Store) ? 0 : T.Store.starsOf(result);
    const retryItems = (result.items || []).filter(it => it && it.retry).length;

    const ext = {
      activity: isShortcut ? 'shortcut' : 'typing',
      keys,
      correctKeys,
      missKeys: int(result.missKeys),
      keyAccuracy: round1(result.accuracy),
      kps: round2(result.kps),
      // 5秒 基準の 時間。速さは この 時間で 出して います（activeMs とは べつ物）
      typingMs: int(result.activeMs),
      bestCombo: int(result.combo),
      layout: result.layout || '',
      // 「右の こゆびの ミスが おおい」は「ひとさしゆび2本で 打つ くせ」の しるしです。
      // キー別の ミスだけでは 見えない、この アプリならではの データです
      missByKey: topMiss(subtractMiss(result.missByKey, result.retryMissByKey)),
      missByFinger: topMiss(subtractMiss(result.missByFinger, result.retryMissByFinger)),
      lapNeed: int(result.lapNeed),
      lapPos: int(result.lapPos),
      laps,
      stars,
      // 20打より 少ない 回を さいこう記録に しない、という アプリの 中の 線引きを
      // 先生の 集計でも つかえる ように します
      eligibleForBest: keys >= (T.Store ? T.Store.MIN_RECORD_KEYS : 20)
    };
    if (result.hintLevel) ext.hintLevel = result.hintLevel;
    if (isChallenge && stage.pool) ext.pool = stage.pool;
    if (retryItems > 0) {
      ext.retry = {
        items: retryItems,
        missByKey: topMiss(result.retryMissByKey),
        missByFinger: topMiss(result.retryMissByFinger)
      };
    }
    if (truncated) ext.itemsTruncated = truncated;

    const record = {
      schema: 'study.v1',
      appId: APP_ID,
      appVersion: c.appVersion || '',
      kind: 'session',
      mode: isChallenge ? 'challenge' : (isWeak ? 'weak' : 'practice'),
      unit: unitOf(result),
      source: isWeak ? 'weak' : (result.source === 'review' ? 'review' : 'course'),
      multiplayer: false,          // Typa に ふたりで つかう モードは ありません
      grading: 'objective',        // 打鍵の 正誤は 見た とおりに 決まります
      startedAt: isoOf(result.clockStartedAt || result.startedAt),
      endedAt: isoOf(result.finishedAt),
      elapsedMs,
      timeBasis: 'app',
      status: statusOf(result),
      summary: {
        count: Math.min(COUNT_MAX, main.length),
        attempted: kept.length,
        firstTryCorrect: kept.filter(it => it.firstTry).length,
        correct: kept.filter(it => it.ok).length
      },
      items: kept.map(toItem),
      ext: fitExt(ext)
    };
    if (activeMs !== null) record.activeMs = activeMs;
    return record;
  }

  /**
   * 組み立てて 端末に のこします。
   * 学習ログの モジュールが なくても アプリは そのまま 動きます。
   */
  function save(result, ctx) {
    const put = global.StudyLog && global.StudyLog.saveStudyRecord;
    if (typeof put !== 'function') return null;
    try {
      return put(buildRecord(result, ctx));
    } catch (e) {
      return null;                     // 学習ログの つごうで れんしゅうを 止めません
    }
  }

  global.Typa = global.Typa || {};
  global.Typa.Study = {
    APP_ID, IDLE_LIMIT_MS, ITEMS_MAX, COUNT_MAX,
    beginSession, endSession, buildRecord, save,
    questionId, unitIdOf, UNIT_ALIASES
  };
})(window);
