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
 *
 * ■ 時間の 数えかた（仕様 §2.8）
 * elapsedMs は はじめから おわりまで。activeMs は「手が 止まっていた
 * 5秒より 長い あいだ」を のぞいた 時間です。速さ（打/秒）は activeMs で
 * 計算するので、とちゅうで 先生の 話を 聞いて いた 回でも 記録が 下がりません。
 */
(function (global) {
  'use strict';

  const T = global.Typa;
  const IDLE_MS = 5000;    // これ以上 手が 止まったら「学習していない 時間」とみなします

  const state = {
    course: null, stage: null, source: 'course',
    items: [], index: 0,
    matcher: null,
    startedAt: null, startTime: 0, lastKeyTime: 0, idleMs: 0,
    itemStart: 0, itemMistakes: 0, itemWrong: [], itemFirstTry: true,
    results: [],
    correctKeys: 0, missKeys: 0,
    missByKey: {}, missByFinger: {},
    running: false,
    imeWarned: false
  };

  const $ = id => document.getElementById(id);

  // ------------------------------------------------------------------
  // 画面
  // ------------------------------------------------------------------

  function screenHtml(course, stage) {
    return `
      <div class="play" id="play-root">
        <div class="play-head">
          <div class="play-title">
            <span class="chip chip-${course.color}">${esc(course.short)}</span>
            <b>${esc(stage.title)}</b>
          </div>
          <div class="play-progress" role="group" aria-label="すすみぐあい">
            <div class="bar"><span id="play-bar"></span></div>
            <span class="num"><b id="play-done">0</b> / <span id="play-total">0</span></span>
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
        </div>

        <div class="ime-warn" id="ime-warn" hidden>
          ${T.icon('info')} <span>かな入力に なって いるみたい。<b>英数キー</b>（スペースの 左）を おしてから 打ってね。</span>
        </div>

        <div class="kb-wrap"><div id="play-kb"></div></div>
      </div>`;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ------------------------------------------------------------------
  // はじめる
  // ------------------------------------------------------------------

  /**
   * @param {Object} p { course, stage, source, mount }
   */
  function start(p) {
    const settings = T.Store.getSettings();
    state.course = p.course;
    state.stage = p.stage;
    state.source = p.source || 'course';
    state.items = pickItems(p.stage, state.source);
    state.index = 0;
    state.results = [];
    state.correctKeys = 0;
    state.missKeys = 0;
    state.missByKey = {};
    state.missByFinger = {};
    state.idleMs = 0;
    state.imeWarned = false;
    state.startedAt = new Date();
    state.startTime = performance.now();
    state.lastKeyTime = state.startTime;
    state.running = true;

    p.mount.innerHTML = screenHtml(p.course, p.stage);
    $('play-total').textContent = String(state.items.length);
    if (!settings.keyboard) $('play-kb').closest('.kb-wrap').hidden = true;
    else {
      T.Keyboard.render($('play-kb'), {
        layoutId: settings.layout,
        fingerGuide: settings.fingerGuide,
        onTap: tap => handleChar(tap.char, tap.code)
      });
    }
    loadItem();
    bindKeys();
  }

  /** ステージの お題を ならべます（「もう1かい」は じゅんばんを かえます） */
  function pickItems(stage, source) {
    const items = stage.items.slice();
    if (source !== 'course') shuffle(items);
    return items;
  }

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }

  function loadItem() {
    const item = state.items[state.index];
    state.matcher = T.Romaji.createMatcher(item.k);
    state.itemStart = performance.now();
    state.itemMistakes = 0;
    state.itemWrong = [];
    state.itemFirstTry = true;
    $('q-label').textContent = item.d || '';
    $('q-label').hidden = !item.d;
    renderQuestion();
    renderProgress();
  }

  /** お題の 表示を 描きなおします（打ち終えた ところは 色が かわります） */
  function renderQuestion() {
    const item = state.items[state.index];
    const done = state.matcher.kanaDone();
    const text = item.k;
    $('q-kana').innerHTML =
      `<span class="done">${esc(text.slice(0, done))}</span>` +
      `<span class="now">${esc(text.slice(done, done + 1))}</span>` +
      `<span class="rest">${esc(text.slice(done + 1))}</span>`;

    const settings = T.Store.getSettings();
    const romaji = $('q-romaji');
    if (item.raw || !settings.romajiHint) {
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
    const settings = T.Store.getSettings();
    const ch = state.matcher.expected();
    const box = $('play-finger');
    if (!ch) { box.innerHTML = ''; T.Keyboard.highlight([]); return; }
    const found = T.Layout.findKey(settings.layout, ch);
    if (!found) { box.innerHTML = ''; T.Keyboard.highlight([]); return; }
    const finger = T.Layout.fingerOf(found.key.code);
    T.Keyboard.highlight([found.key.code], found.shift);
    box.innerHTML = finger
      ? `<span class="finger-dot" style="--finger:${finger.color}"></span>
         <span class="finger-text">つぎは <b>${esc(ch === ' ' ? 'スペース' : ch.toUpperCase())}</b>
         を <b>${esc(finger.label)}</b>で</span>
         ${found.shift ? '<span class="finger-shift">シフトも いっしょに</span>' : ''}`
      : '';
  }

  function renderProgress() {
    const total = state.items.length;
    $('play-done').textContent = String(state.index);
    const pct = total ? Math.round(state.index / total * 100) : 0;
    $('play-bar').style.width = `${pct}%`;
  }

  function renderMeters() {
    const stats = liveStats();
    $('m-kps').textContent = stats.kps.toFixed(1);
    $('m-acc').textContent = String(Math.round(stats.accuracy));
    $('m-miss').textContent = String(state.missKeys);
  }

  function liveStats() {
    const elapsed = performance.now() - state.startTime;
    const active = Math.max(1, elapsed - state.idleMs);
    const total = state.correctKeys + state.missKeys;
    return {
      elapsedMs: elapsed,
      activeMs: active,
      kps: state.correctKeys / (active / 1000),
      accuracy: total > 0 ? (state.correctKeys / total) * 100 : 100
    };
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
   */
  function handleChar(ch, code) {
    if (!state.running || !state.matcher) return;
    const now = performance.now();
    // 5秒より 長い 手止まりは 学習時間から のぞきます（§2.8）
    const gap = now - state.lastKeyTime;
    if (gap > IDLE_MS) state.idleMs += gap - IDLE_MS;
    state.lastKeyTime = now;

    const expectedChar = state.matcher.expected();
    const r = state.matcher.input(String(ch).toLowerCase());

    if (r.ok) {
      state.correctKeys++;
      if (code) T.Keyboard.flash(code, true);
      beep(true);
    } else {
      state.missKeys++;
      state.itemMistakes++;
      state.itemFirstTry = false;
      recordMiss(ch, expectedChar);
      if (code) T.Keyboard.flash(code, false);
      shake();
      beep(false);
    }

    renderQuestion();
    renderMeters();

    if (state.matcher.isFinished()) finishItem();
  }

  /** どの キー・どの指で つまずいたかを 数えます（先生の 画面で つかいます） */
  function recordMiss(pressed, expectedChar) {
    if (state.itemWrong.length < 8 && pressed && !/[<>{}\\]/.test(pressed)) {
      state.itemWrong.push(pressed);
    }
    if (!expectedChar) return;
    const key = expectedChar === ' ' ? 'space' : expectedChar;
    state.missByKey[key] = (state.missByKey[key] || 0) + 1;
    const found = T.Layout.findKey(T.Store.getSettings().layout, expectedChar);
    const finger = found ? T.Layout.fingerOf(found.key.code) : null;
    if (finger) state.missByFinger[finger.id] = (state.missByFinger[finger.id] || 0) + 1;
  }

  function finishItem() {
    const item = state.items[state.index];
    state.results.push({
      q: item.k,
      ok: true,
      firstTry: state.itemFirstTry,
      tries: state.itemMistakes + 1,
      ms: performance.now() - state.itemStart,
      wrong: state.itemWrong.slice()
    });
    state.index++;
    renderProgress();
    if (state.index >= state.items.length) { finish('completed'); return; }
    const stage = $('play-stage');
    if (stage) {
      stage.classList.add('is-clear');
      setTimeout(() => stage.classList.remove('is-clear'), 260);
    }
    loadItem();
  }

  /** ステージを おえます（とちゅうで やめた ときは status = 'aborted'） */
  function finish(status) {
    if (!state.running) return null;
    state.running = false;
    unbindKeys();

    const stats = liveStats();
    const total = state.correctKeys + state.missKeys;
    const result = {
      course: state.course,
      stage: state.stage,
      source: state.source,
      status,
      startedAt: state.startedAt,
      finishedAt: new Date().toISOString(),
      elapsedMs: stats.elapsedMs,
      activeMs: stats.activeMs,
      items: state.results,
      correctKeys: state.correctKeys,
      totalKeys: total,
      missKeys: state.missKeys,
      kps: state.correctKeys / (stats.activeMs / 1000),
      accuracy: total > 0 ? (state.correctKeys / total) * 100 : 0,
      missByKey: state.missByKey,
      missByFinger: state.missByFinger,
      layout: T.Store.getSettings().layout,
      count: state.items.length,
      done: state.index
    };
    if (typeof state.onFinish === 'function') state.onFinish(result);
    return result;
  }

  function shake() {
    const el = $('play-stage');
    if (!el) return;
    el.classList.remove('is-miss');
    void el.offsetWidth;
    el.classList.add('is-miss');
  }

  /** 打ったときの みじかい おと（せっていで 消せます） */
  let audioCtx = null;
  function beep(ok) {
    if (!T.Store.getSettings().sound) return;
    try {
      audioCtx = audioCtx || new (global.AudioContext || global.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = ok ? 880 : 220;
      gain.gain.value = 0.05;
      osc.connect(gain).connect(audioCtx.destination);
      const t = audioCtx.currentTime;
      osc.start(t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (ok ? 0.06 : 0.14));
      osc.stop(t + (ok ? 0.07 : 0.15));
    } catch (e) { /* おとが 出せなくても 練習は つづけられます */ }
  }

  function isRunning() { return state.running; }
  function setOnFinish(fn) { state.onFinish = fn; }
  function abort() { return finish('aborted'); }

  global.Typa = global.Typa || {};
  global.Typa.Play = { start, finish, abort, isRunning, setOnFinish, unbindKeys };
})(window);
