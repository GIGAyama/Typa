/**
 * =====================================================================
 * play.js — れんしゅうの 画面（打つ ところ）
 * =====================================================================
 * お題を 1つずつ 出し、1打ごとに 正誤を 判定します。
 *
 * ■ 打ちまちがえても 先へは すすみません
 * まちがえた ままで すすむと、まちがった 指づかいの まま 速くなります。
 * 正しい キーを 押すまで まつ かわりに、「どの指で 押すか」を
 * 画面と ことばの 両方で しめして、すぐに やりなおせるように しています。
 * それでも つまずいた ときのために、同じ お題で 4回 まちがえると
 * 「とばす」ボタンが 出ます。1つの キーで 手が 止まりつづけない ためです。
 *
 * ■ 時計は「さいしょの 1打」から うごきます
 * 画面が 出た しゅんかんから 数えると、まだ 手を おいて いない 時間まで
 * 記録に 入って しまいます。ストップウォッチは 最初の 1打で スタートします。
 *
 * ■ 時間の 数えかた
 * elapsedMs は はじめから おわりまで。activeMs は「手が 止まっていた
 * 5秒より 長い あいだ」を のぞいた 時間です。速さ（打/秒）は activeMs で
 * 計算するので、とちゅうで 先生の 話を 聞いて いた 回でも 記録が 下がりません。
 * ただし **チャレンジ（時間ぎめ）だけは のぞきません**。じっさいの
 * 60びょうで どれだけ 打てたかを、そのまま スコアに するためです。
 *
 * ■ まちがえた お題は さいごに もう1回（おまけの 周）
 * まちがえた 直後に もう一度 打つと よく 身に つきます。そこで 本編が
 * おわったあと、つまずいた お題を さいごに もう1回だけ 出します。
 *
 * この おまけの 周の 打鍵は **はやさ・正かくさ・★・けいけんちには
 * 数えません**。数えて しまうと、2回目に 打ち直した 子ほど 正かくさが
 * 上がり、★が「さいしょに どれだけ 正しく 打てたか」を あらわさなく
 * なるためです。いっぽうで「どの キーで つまずいたか」の きろくには
 * ちゃんと 数えます。れんしゅうとしては 本物だからです。
 */
(function (global) {
  'use strict';

  const T = global.Typa;
  const IDLE_MS = 5000;        // これ以上 手が 止まったら「学習していない 時間」とみなします
  const SKIP_AFTER = 4;        // 同じ お題で これだけ まちがえたら「とばす」を 出します
  const COMBO_STEP = 10;       // れんぞくが これの ばいすうに なると ほめます
  const RETRY_MAX = 5;         // さいごに もう1回 出す お題の 数の かぎり

  const state = {
    course: null, stage: null, source: 'course', special: '',
    pool: [], queue: [], current: null, total: 0, index: 0,
    endless: false, limitMs: 0,
    matcher: null,
    startedAt: null, startTime: 0, lastKeyTime: 0, idleMs: 0, pausedAt: 0, pausedMs: 0,
    itemStart: 0, itemMistakes: 0, itemWrong: [], itemFirstTry: true,
    results: [],
    correctKeys: 0, missKeys: 0, combo: 0, bestCombo: 0,
    missByKey: {}, missByFinger: {},
    phase: 'main', retryPool: [], retryTotal: 0, retryUse: true, retryNotice: false,
    mainMs: 0, mainIdleMs: 0,
    lat: {}, conf: {}, rule: {}, keystrokes: [],
    itemKeyCount: 0, lastOk: true, skipLatency: false,
    running: false, imeWarned: false,
    settings: null, view: null, showKeyboard: true, timerId: 0, onFinish: null
  };

  const $ = id => document.getElementById(id);

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ------------------------------------------------------------------
  // 画面
  // ------------------------------------------------------------------

  function screenHtml(course, stage) {
    const limited = !!stage.limitMs;
    return `
      <div class="play" id="play-root">
        <div class="play-head">
          <div class="play-title">
            <span class="chip chip-${course.color}">${esc(course.short)}</span>
            <b>${esc(stage.title)}</b>
          </div>
          <div class="play-progress" role="group" aria-label="すすみぐあい">
            <div class="bar${limited ? ' bar-time' : ''}"><span id="play-bar"></span></div>
            <span class="num">${limited
              ? `のこり <b id="play-left">${Math.round(stage.limitMs / 1000)}</b> びょう`
              : '<span id="play-phase" hidden>もういちど </span><b id="play-done">0</b> / <span id="play-total">0</span>'}</span>
          </div>
        </div>

        <div class="play-stage" id="play-stage">
          <p class="q-label" id="q-label"></p>
          <p class="q-kana" id="q-kana"></p>
          <p class="q-romaji" id="q-romaji"></p>
        </div>

        <div class="play-finger" id="play-finger" aria-live="polite"></div>

        <div class="play-meter">
          <div class="meter"><span class="meter-label">はやさ</span><b id="m-kps">0.0</b><span class="meter-unit">打/びょう</span></div>
          <div class="meter"><span class="meter-label">正かくさ</span><b id="m-acc">100</b><span class="meter-unit">%</span></div>
          <div class="meter"><span class="meter-label">ミス</span><b id="m-miss">0</b><span class="meter-unit">かい</span></div>
          <div class="meter meter-combo" id="m-combo-box"><span class="meter-label">れんぞく</span><b id="m-combo">0</b><span class="meter-unit">だ</span></div>
        </div>

        <div class="ime-warn" id="ime-warn" hidden>
          ${T.icon('info')} <span>かな入力に なって いるみたい。<b>英数キー</b>（スペースの 左）を おしてから 打ってね。</span>
        </div>

        <p class="play-ready" id="play-ready">${T.icon('play')} さいしょの 1打で スタートします。ゆっくりで だいじょうぶ。</p>

        <div class="kb-wrap"><div id="play-kb"></div></div>

        <div class="play-skip"><button class="btn btn-ghost" id="play-skip-btn" type="button" hidden>この お題を とばす</button></div>
      </div>`;
  }

  // ------------------------------------------------------------------
  // はじめる
  // ------------------------------------------------------------------

  /**
   * @param {Object} p { course, stage, source, mount, special }
   *   stage.endless … お題が つきても じゅんばんを かえて つづけます
   *   stage.limitMs … 時間ぎめ（チャレンジ）
   */
  function start(p) {
    const settings = T.Store.getSettings();
    stopTimer();

    state.course = p.course;
    state.stage = p.stage;
    state.source = p.source || 'course';
    state.special = p.special || '';
    state.settings = settings;
    state.endless = !!p.stage.endless;
    state.limitMs = p.stage.limitMs || 0;
    state.pool = p.stage.items.slice();
    state.queue = firstQueue(state.pool, state.source, state.endless);
    state.total = state.endless ? 0 : state.queue.length;
    state.index = 0;
    state.results = [];
    state.correctKeys = 0;
    state.missKeys = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.missByKey = {};
    state.missByFinger = {};
    state.lat = {};
    state.conf = {};
    state.rule = {};
    state.keystrokes = [];
    state.itemKeyCount = 0;
    state.lastOk = true;
    state.skipLatency = false;
    state.phase = 'main';
    state.retryPool = [];
    state.retryTotal = 0;
    // 時間ぎめ（チャレンジ）と おわりの ない れんしゅうでは やりません。
    // 「60びょうで どれだけ 打てたか」に おまけの 周を 足せないためです
    state.retryUse = settings.retry !== false && !state.endless && !state.limitMs;
    state.idleMs = 0;
    state.pausedAt = 0;
    state.pausedMs = 0;
    state.imeWarned = false;
    state.startedAt = new Date();
    state.startTime = 0;                    // 0 = まだ 1打も 打って いない
    state.lastKeyTime = 0;
    state.running = true;
    // ヒントの つよさは ここで 1回だけ 決めます。あとは state.view だけを
    // 見るので、せっていの スイッチと 言うことが 食いちがう ことが ありません。
    // 1回の 中で 見え方が かわると 子どもが まようので、とちゅうでは かえません
    state.view = T.Store.resolveAssist(settings, {
      stageMastery: T.Mastery.stageMastery(T.Store.keySummary().byKey, p.stage),
      everThreeStars: ((T.Store.getProgress()[p.stage.id] || {}).stars || 0) >= 3,
      blind: !!p.blind || !!p.stage.blind
    });
    state.showKeyboard = state.view.keyboard;

    p.mount.innerHTML = screenHtml(p.course, p.stage);
    if (!state.limitMs) $('play-total').textContent = String(state.total);
    if (!state.showKeyboard) $('play-kb').closest('.kb-wrap').hidden = true;
    else {
      T.Keyboard.render($('play-kb'), {
        layoutId: settings.layout,
        fingerGuide: state.view.fingerGuide,
        labels: state.view.keyLabels,
        onTap: tap => handleChar(tap.char, tap.code, 'tap')
      });
    }
    $('play-skip-btn').addEventListener('click', skipItem);
    loadItem();
    renderMeters();
    bindKeys();
    if (state.limitMs) startTimer();
  }

  /** さいしょの お題の ならび（「もう1かい」と チャレンジは じゅんばんを かえます） */
  function firstQueue(pool, source, endless) {
    const list = pool.slice();
    if (endless || source !== 'course') shuffle(list);
    return list;
  }

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }

  function loadItem() {
    if (state.queue.length === 0) {
      if (!state.endless) return;
      state.queue = shuffle(state.pool.slice());   // チャレンジは くりかえします
    }
    const item = state.queue.shift();
    state.current = item;
    state.matcher = T.Romaji.createMatcher(item.k);
    state.itemStart = performance.now();
    state.itemKeyCount = 0;
    state.itemMistakes = 0;
    state.itemWrong = [];
    state.itemFirstTry = true;
    $('q-label').textContent = item.d || '';
    $('q-label').hidden = !item.d;
    $('play-skip-btn').hidden = true;
    renderQuestion();
    renderProgress();
  }

  /** お題の 表示を 描きなおします（打ち終えた ところは 色が かわります） */
  function renderQuestion() {
    const item = state.current;
    const done = state.matcher.kanaDone();
    const text = item.k;
    $('q-kana').innerHTML =
      `<span class="done">${esc(text.slice(0, done))}</span>` +
      `<span class="now">${esc(text.slice(done, done + 1))}</span>` +
      `<span class="rest">${esc(text.slice(done + 1))}</span>`;

    const romaji = $('q-romaji');
    if (item.raw || !state.view.romajiHint) {
      romaji.hidden = true;
    } else {
      const h = state.matcher.hint();
      romaji.hidden = false;
      romaji.innerHTML = `<span class="done">${esc(h.done)}</span><span class="rest">${esc(h.rest)}</span>`;
    }
    renderNextKey();
  }

  /** つぎに 押す キーと、その 指を しめします */
  function renderNextKey() {
    const ch = state.matcher.expected();
    const box = $('play-finger');
    if (!box) return;
    const clear = () => { box.innerHTML = ''; if (state.view.nextGlow) T.Keyboard.highlight([]); };
    if (!ch) { clear(); return; }
    const found = T.Layout.findKey(state.settings.layout, ch);
    if (!found) { clear(); return; }
    const finger = T.Layout.fingerOf(found.key.code);
    if (state.view.nextGlow) T.Keyboard.highlight([found.key.code], found.shift);
    // めかくしの ときだけ、ことばの 案内も 出しません。
    // ほかの つよさでは のこします — 絵を 消しても、
    // 「どの指か」は かならず ことばで つたわるように するためです
    if (!state.view.fingerWords) { box.innerHTML = ''; return; }
    // 指が 決まっていない キー（やじるしなど）でも、
    // 「つぎに 何を 押すか」だけは かならず 出します
    const label = esc(ch === ' ' ? 'スペース' : ch.toUpperCase());
    box.innerHTML =
      (finger && state.view.fingerGuide ? `<span class="finger-dot" style="--finger:${finger.color}"></span>` : '') +
      `<span class="finger-text">つぎは <b>${label}</b>` +
      (finger ? ` を <b>${esc(finger.label)}</b>で` : '') + '</span>' +
      (found.shift ? '<span class="finger-shift">シフトも いっしょに</span>' : '');
  }

  function renderProgress() {
    const bar = $('play-bar');
    if (!bar) return;
    if (state.limitMs) {
      const left = Math.max(0, state.limitMs - elapsed());
      bar.style.width = `${Math.round(left / state.limitMs * 100)}%`;
      const num = $('play-left');
      if (num) num.textContent = String(Math.ceil(left / 1000));
      const box = $('play-root');
      if (box) box.classList.toggle('is-hurry', left <= 10000);
      return;
    }
    // おまけの 周に 入ったら 数を 数えなおします。本編の 数に 足しつづけると
    // バーが 100%を こえて しまうためです
    const total = state.phase === 'retry' ? state.retryTotal : state.total;
    const totalEl = $('play-total');
    if (totalEl) totalEl.textContent = String(total);
    $('play-done').textContent = String(state.index);
    bar.style.width = `${total ? Math.round(state.index / total * 100) : 0}%`;
  }

  function renderMeters() {
    const stats = liveStats();
    $('m-kps').textContent = stats.kps.toFixed(1);
    $('m-acc').textContent = String(Math.round(stats.accuracy));
    $('m-miss').textContent = String(state.missKeys);
    $('m-combo').textContent = String(state.combo);
  }

  /** はじめの 1打からの 時間。まだ 打って いなければ 0 */
  function elapsed() {
    if (!state.startTime) return 0;
    const now = state.pausedAt || performance.now();
    return Math.max(0, now - state.startTime - state.pausedMs);
  }

  function liveStats() {
    // おまけの 周に 入ったら 時計も 止めます。おまけの ぶんは 打鍵を 数えないので、
    // 時間だけ のびると はやさが 実際より 低く 出て しまうためです
    const ms = state.phase === 'retry' ? state.mainMs : elapsed();
    const idle = state.phase === 'retry' ? state.mainIdleMs : state.idleMs;
    // 時間ぎめの チャレンジは、手を 止めた ぶんも そのまま スコアに ひびきます
    const active = state.limitMs ? Math.max(1, ms) : Math.max(1, ms - idle);
    const total = state.correctKeys + state.missKeys;
    return {
      elapsedMs: ms,
      activeMs: active,
      kps: ms > 0 ? state.correctKeys / (active / 1000) : 0,
      accuracy: total > 0 ? (state.correctKeys / total) * 100 : 100
    };
  }

  // ------------------------------------------------------------------
  // 時間ぎめ（チャレンジ）
  // ------------------------------------------------------------------

  function startTimer() {
    stopTimer();
    state.timerId = setInterval(() => {
      if (!state.running) return;
      renderProgress();
      if (state.startTime && elapsed() >= state.limitMs) finish('completed');
    }, 100);
    document.addEventListener('visibilitychange', onVisibility);
  }

  function stopTimer() {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = 0;
    document.removeEventListener('visibilitychange', onVisibility);
  }

  /** ほかの 画面に うつって いる あいだは 時計を 止めます（ずるにも ならず、そんにも なりません） */
  function onVisibility() {
    if (!state.running || !state.startTime) return;
    if (document.hidden) { state.pausedAt = performance.now(); return; }
    if (state.pausedAt) {
      state.pausedMs += performance.now() - state.pausedAt;
      state.pausedAt = 0;
      state.lastKeyTime = performance.now();
      // 時計を つけ直したので、つぎの 1打の「かかった 時間」は にせものです。
      // これを 数えると、ありもしない「速い キー」が できて しまいます
      state.skipLatency = true;
    }
  }

  // ------------------------------------------------------------------
  // 入力
  // ------------------------------------------------------------------

  let keyHandler = null;

  function bindKeys() {
    unbindKeys();
    keyHandler = e => {
      if (!state.running) return;
      // かな入力（IME）が オンだと、キーが アプリまで 届きません
      if (e.isComposing || e.keyCode === 229) { warnIme(); return; }
      // Ctrl や Alt との くみあわせは ブラウザに ゆずります（ショートカットの ため）
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === 'Escape') return;                    // 「もどる」は ナビにまかせます
      if (e.key === 'Backspace') { e.preventDefault(); return; }
      if (e.key.length !== 1) return;
      e.preventDefault();                                 // スペースで 画面が 下がるのを 止めます
      handleChar(e.key, e.code);
    };
    document.addEventListener('keydown', keyHandler, true);
  }

  function unbindKeys() {
    if (keyHandler) document.removeEventListener('keydown', keyHandler, true);
    keyHandler = null;
  }

  function warnIme() {
    if (state.imeWarned) return;
    state.imeWarned = true;
    const el = $('ime-warn');
    if (el) el.hidden = false;
  }

  /**
   * 1打を うけとります（キーボードからも、画面の タップからも ここに 来ます）。
   * @param {string} ch 打たれた 文字
   * @param {string} [code] キーの 位置
   * @param {string} [src] 'tap' なら 画面を さわって 打った ぶん
   */
  function handleChar(ch, code, src) {
    if (!state.running || !state.matcher) return;
    const now = performance.now();
    const gapBefore = state.startTime ? now - state.lastKeyTime : 0;

    if (state.retryNotice) {
      // おまけの 周の あんないは、打ちはじめたら 消します
      state.retryNotice = false;
      const notice = $('play-ready');
      if (notice) notice.hidden = true;
    }

    if (!state.startTime) {
      // さいしょの 1打。ここから 時計が うごきはじめます
      state.startTime = now;
      state.lastKeyTime = now;
      const ready = $('play-ready');
      if (ready) ready.hidden = true;
    } else {
      // 5秒より 長い 手止まりは 学習時間から のぞきます（チャレンジは のぞきません）
      const gap = now - state.lastKeyTime;
      if (gap > IDLE_MS) state.idleMs += gap - IDLE_MS;
      state.lastKeyTime = now;
    }

    const info = state.matcher.expectedInfo();
    const expectedChar = info.ch;
    const r = state.matcher.input(String(ch).toLowerCase());

    recordTiming(ch, r.ok, gapBefore, src);
    recordRule(info.rule, r.ok);

    // おまけの 周の 打鍵は、はやさ・正かくさ・★の もとには 数えません。
    // 数えると「まちがえて 打ち直した 子ほど 正かくさが 上がる」ことに なり、
    // ★が「さいしょに どれだけ 正しく 打てたか」を あらわさなく なります
    const counts = state.phase === 'main';

    if (r.ok) {
      if (counts) state.correctKeys++;
      state.combo++;
      if (state.combo > state.bestCombo) state.bestCombo = state.combo;
      if (state.combo > 0 && state.combo % COMBO_STEP === 0) celebrateCombo();
      if (code && state.showKeyboard) T.Keyboard.flash(code, true);
      beep(true);
    } else {
      if (counts) state.missKeys++;
      state.itemMistakes++;
      state.itemFirstTry = false;
      state.combo = 0;
      recordMiss(ch, expectedChar);
      if (code && state.showKeyboard) T.Keyboard.flash(code, false);
      shake();
      beep(false);
      if (state.itemMistakes >= SKIP_AFTER) {
        const btn = $('play-skip-btn');
        if (btn) btn.hidden = false;
      }
    }

    state.itemKeyCount++;
    renderQuestion();
    renderMeters();

    if (state.matcher.isFinished()) finishItem(true);
  }

  /**
   * 打つまでに かかった 時間を 数えます。
   *
   * ■ 数えて よい 1打か
   * 「押すのに かかった 時間」に なって いない ものを まぜると、
   * にがての 一覧が でたらめに なります。つぎの ときは 数えません。
   *
   *   1. お題の 1文字目 … 前の 時間は お題を 読んで いた 時間です
   *   2. まちがえた すぐ あと … 打ち直しは「さがす 時間」では ありません
   *   3. 画面を さわって 打った ぶん … 指を はこぶ 時間で、タイピングでは ありません
   *   4. ほかの 画面から もどった すぐ あと … onVisibility が 時計を つけ直すので
   *      にせの みじかい 時間に なります
   *   5. 3びょうより 長い とき … キーボードから 手を はなして いました
   *
   * ■ 実際に 押した キーで 数えます
   * 「し」は si でも shi でも 正かいなので、出す はずだった キーでは なく
   * **手が 見つけた キー** で 数えないと 意味が ありません。
   */
  function recordTiming(pressed, ok, gap, src) {
    const M = T.Mastery;
    const key = String(pressed).toLowerCase();
    // 生の 1打は けっか画面の グラフに つかうだけで、保存は しません
    if (state.keystrokes.length < 2000) {
      state.keystrokes.push({ ms: Math.round(gap), ok: !!ok, ch: key, retry: state.phase === 'retry' });
    }

    const skip = state.skipLatency;
    state.skipLatency = false;
    const wasOk = state.lastOk;
    state.lastOk = !!ok;

    if (!ok) return;                                  // ミスは はやさに 数えません
    if (src === 'tap') return;                        // 3
    if (skip) return;                                 // 4
    if (state.itemKeyCount === 0) return;             // 1
    if (!wasOk) return;                               // 2
    if (gap <= 0 || gap > M.MAX_SAMPLE) return;       // 5

    if (!state.lat[key]) state.lat[key] = new Array(M.BUCKETS).fill(0);
    state.lat[key][M.bucketOf(gap)]++;
  }

  /**
   * ローマ字の どの きまりで つまずいたかを 数えます。
   * **正しく 打てた ぶんも 数えます**。回数では なく わりあいで 見ないと、
   * よく 出て くる きまりほど にがてに 見えて しまうためです。
   */
  function recordRule(rule, ok) {
    if (!rule || rule === 'raw' || rule === 'kigou') return;
    if (!state.rule[rule]) state.rule[rule] = [0, 0];
    state.rule[rule][0]++;
    if (!ok) state.rule[rule][1]++;
  }

  /** どの キー・どの指で つまずいたかを 数えます（にがて とっくんの もとに なります） */
  function recordMiss(pressed, expectedChar) {
    if (state.itemWrong.length < 8 && pressed && !/[<>{}\\]/.test(pressed)) {
      state.itemWrong.push(pressed);
    }
    if (!expectedChar) return;
    // 「何と 何を とりちがえたか」。
    // 「d が にがて」より「d と f の 区べつが ついて いない」の ほうが、
    // つぎに 何を すれば よいかが はっきり します
    const want = String(expectedChar).toLowerCase();
    const got = String(pressed).toLowerCase();
    if (want !== got && T.Mastery.SAFE_KEY.test(want) && T.Mastery.SAFE_KEY.test(got)) {
      const pair = `${want}>${got}`;
      state.conf[pair] = (state.conf[pair] || 0) + 1;
    }
    const key = expectedChar === ' ' ? 'space' : expectedChar;
    state.missByKey[key] = (state.missByKey[key] || 0) + 1;
    const found = T.Layout.findKey(state.settings.layout, expectedChar);
    const finger = found ? T.Layout.fingerOf(found.key.code) : null;
    if (finger) state.missByFinger[finger.id] = (state.missByFinger[finger.id] || 0) + 1;
  }

  /** つまずいた ときの にげみち。とばした お題は 正かいには しません */
  function skipItem() {
    if (!state.running) return;
    state.combo = 0;
    renderMeters();
    finishItem(false);
  }

  function finishItem(ok) {
    const item = state.current;
    state.results.push({
      q: item.k,
      ok: !!ok,
      firstTry: ok && state.itemFirstTry,
      tries: state.itemMistakes + 1,
      ms: state.startTime ? performance.now() - state.itemStart : 0,
      wrong: state.itemWrong.slice(),
      retry: state.phase === 'retry'
    });
    // 本編で つまずいた お題は、さいごに もう1回 出すために とっておきます
    if (state.phase === 'main' && state.retryUse && !state.itemFirstTry &&
        state.retryPool.length < RETRY_MAX) {
      state.retryPool.push(item);
    }
    state.index++;
    renderProgress();

    if (!state.endless && state.queue.length === 0 && !startRetry()) {
      finish('completed');
      return;
    }
    const stage = $('play-stage');
    if (stage && ok) {
      stage.classList.add('is-clear');
      setTimeout(() => stage.classList.remove('is-clear'), 260);
    }
    loadItem();
  }

  /**
   * 本編が おわったら、まちがえた お題を さいごに もう1回だけ 出します。
   * 「まちがえた 直後に もう一度 打つ」のが いちばん 身に つくためです。
   * ここから 先の 打鍵は 記録には のこりますが、はやさ・正かくさ・★には
   * 数えません（handleChar の counts を 見てください）。
   *
   * @returns {boolean} おまけの 周に 入ったか
   */
  function startRetry() {
    if (state.phase !== 'main' || !state.retryUse || state.retryPool.length === 0) return false;
    state.phase = 'retry';
    // 本編ぶんの 時間を ここで 止めて とっておきます
    state.mainMs = elapsed();
    state.mainIdleMs = state.idleMs;
    state.queue = state.retryPool.slice();
    state.retryTotal = state.queue.length;
    state.index = 0;

    const root = $('play-root');
    if (root) root.classList.add('is-retry');
    const phase = $('play-phase');
    if (phase) phase.hidden = false;
    const notice = $('play-ready');
    if (notice) {
      notice.innerHTML = `${T.icon('retry')} もう1かいだけ、さっき まちがえた ことばを やってみよう。`;
      notice.hidden = false;
      state.retryNotice = true;
    }
    return true;
  }

  /** ステージを おえます（とちゅうで やめた ときは status = 'aborted'） */
  function finish(status) {
    if (!state.running) return null;
    state.running = false;
    stopTimer();
    unbindKeys();

    const stats = liveStats();
    const total = state.correctKeys + state.missKeys;
    const result = {
      course: state.course,
      stage: state.stage,
      source: state.source,
      special: state.special,
      status,
      startedAt: state.startedAt,
      finishedAt: new Date().toISOString(),
      elapsedMs: stats.elapsedMs,
      activeMs: stats.activeMs,
      items: state.results,
      correctKeys: state.correctKeys,
      totalKeys: total,
      missKeys: state.missKeys,
      kps: stats.kps,
      accuracy: total > 0 ? (state.correctKeys / total) * 100 : 0,
      combo: state.bestCombo,
      missByKey: state.missByKey,
      missByFinger: state.missByFinger,
      lat: state.lat,
      conf: state.conf,
      rule: state.rule,
      // 1打ずつの 生の きろく。けっか画面の グラフに つかうだけで、
      // 保存は しません（saveResult の 一覧に 入れて いません）
      keystrokes: state.keystrokes,
      layout: state.settings.layout,
      count: state.endless ? state.index : state.total,
      done: state.index,
      retried: state.retryTotal
    };
    if (typeof state.onFinish === 'function') state.onFinish(result);
    return result;
  }

  // ------------------------------------------------------------------
  // 手ごたえ（見た目と おと）
  // ------------------------------------------------------------------

  function shake() {
    const el = $('play-stage');
    if (!el) return;
    el.classList.remove('is-miss');
    void el.offsetWidth;
    el.classList.add('is-miss');
  }

  /** れんぞくが 10・20・30…に なった ときだけ、みじかく ほめます */
  function celebrateCombo() {
    const box = $('m-combo-box');
    if (box) {
      box.classList.remove('is-up');
      void box.offsetWidth;
      box.classList.add('is-up');
    }
    chime();
  }

  /** 打ったときの みじかい おと（せっていで 消せます） */
  let audioCtx = null;

  function tone(freq, ms, volume) {
    if (!state.settings || !state.settings.sound) return;
    try {
      audioCtx = audioCtx || new (global.AudioContext || global.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = volume;
      osc.connect(gain).connect(audioCtx.destination);
      const t = audioCtx.currentTime;
      osc.start(t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
      osc.stop(t + ms / 1000 + 0.01);
    } catch (e) { /* おとが 出せなくても 練習は つづけられます */ }
  }

  function beep(ok) { tone(ok ? 880 : 220, ok ? 60 : 140, 0.05); }

  /** れんぞくの おいわい。3つの 音を かさねて 明るく します */
  function chime() {
    [0, 90, 180].forEach((delay, i) => {
      setTimeout(() => tone([784, 988, 1319][i], 180, 0.045), delay);
    });
  }

  function isRunning() { return state.running; }
  function setOnFinish(fn) { state.onFinish = fn; }
  function abort() { return finish('aborted'); }

  global.Typa = global.Typa || {};
  global.Typa.Play = { start, finish, abort, isRunning, setOnFinish, unbindKeys };
})(window);
