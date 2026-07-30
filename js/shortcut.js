/**
 * =====================================================================
 * shortcut.js — ショートカットキーの れんしゅう画面
 * =====================================================================
 * キーの 名前を おぼえるだけでは つかえるように なりません。
 * この画面には ほんものの 文字入力らんが 2つ あり、児童は
 * **じっさいに コピーして、はりつけて、もとに もどします**。
 * 「やった けっかが 正しいか」で 合かくを 決めるので、
 * おぼえた ことが そのまま ふだんの そうさに つながります。
 *
 * ブラウザの きのうを 先に よび出して しまう キー
 * （ほぞん Ctrl+S・さがす Ctrl+F など）だけは、ページの ほうで
 * 止めて キーの くみあわせが 合っているかを みます。
 */
(function (global) {
  'use strict';

  const T = global.Typa;

  /** ブラウザの きのうが 出て しまうので、ページで 止める くみあわせ */
  const STOP_COMBOS = [
    { ctrl: true, code: 'KeyS' },
    { ctrl: true, code: 'KeyF' },
    { ctrl: true, code: 'KeyP' },
    { ctrl: true, shift: true, code: 'KeyV' },
    { ctrl: true, code: 'KeyY' }
  ];

  const state = {
    course: null, stage: null, tasks: [], index: 0,
    results: [], startedAt: null, startTime: 0,
    // ほかの タブへ うつって いた あいだは 時計を 止めます。止めないと、
    // 画面を ひらいた まま わすれた 時間まで「れんしゅうした 時間」に なります
    pausedAt: 0, pausedMs: 0,
    copiedText: '', beforeValue: '', running: false,
    onFinish: null, attempts: 0
  };

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /** くみあわせを 見た目に します（Ctrl + C のように） */
  function comboLabel(combo) {
    const parts = [];
    if (combo.ctrl) parts.push('Ctrl');
    if (combo.shift) parts.push('Shift');
    if (combo.alt) parts.push('Alt');
    if (combo.meta) parts.push('けんさく');
    parts.push(keyLabel(combo.code));
    return parts.map(p => `<kbd>${esc(p)}</kbd>`).join('<span class="plus">＋</span>');
  }

  function keyLabel(code) {
    const map = {
      ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
      Backspace: 'けす', Home: 'Home', End: 'End', Space: 'スペース'
    };
    if (map[code]) return map[code];
    return code.replace(/^Key/, '').replace(/^Digit/, '');
  }

  function matches(e, combo) {
    return e.code === combo.code &&
      !!combo.ctrl === (e.ctrlKey || false) &&
      !!combo.shift === (e.shiftKey || false) &&
      !!combo.alt === (e.altKey || false) &&
      !!combo.meta === (e.metaKey || false);
  }

  function shouldStop(e) {
    return STOP_COMBOS.some(c => matches(e, c));
  }

  // ------------------------------------------------------------------

  function screenHtml(course, stage) {
    return `
      <div class="play sc" id="sc-root">
        <div class="play-head">
          <div class="play-title">
            <span class="chip chip-${course.color}">${esc(course.short)}</span>
            <b>${esc(stage.title)}</b>
          </div>
          <div class="play-progress">
            <div class="bar"><span id="sc-bar"></span></div>
            <span class="num"><b id="sc-done">0</b> / <span id="sc-total">0</span></span>
          </div>
        </div>

        <div class="sc-task" id="sc-task"></div>

        <div class="sc-editor">
          <label class="sc-field">
            <span class="sc-label">もとの文</span>
            <textarea id="sc-src" rows="3" spellcheck="false"></textarea>
          </label>
          <label class="sc-field">
            <span class="sc-label">じぶんの文</span>
            <textarea id="sc-dst" rows="3" spellcheck="false" placeholder="ここに はりつけます"></textarea>
          </label>
        </div>

        <p class="sc-note">${T.icon('info')} 文字を 打つ ところを 一度 クリック（タップ）してから キーを おしてね。</p>
        <div class="sc-skip"><button class="btn btn-ghost" id="sc-skip" type="button">この 課題は とばす</button></div>
      </div>`;
  }

  function start(p) {
    state.course = p.course;
    state.stage = p.stage;
    state.tasks = (T.Lessons.SHORTCUT_TASKS[p.stage.tasks] || []).slice();
    state.index = 0;
    state.results = [];
    state.startedAt = new Date();
    state.startTime = performance.now();
    state.pausedAt = 0;
    state.pausedMs = 0;
    state.running = true;
    // 学習ログの 時計（60秒 基準・8アプリ 共通）
    if (T.Study) T.Study.beginSession();

    p.mount.innerHTML = screenHtml(p.course, p.stage);
    $('sc-total').textContent = String(state.tasks.length);
    $('sc-skip').addEventListener('click', () => completeTask(false));
    resetEditor();
    renderTask();
    bind();
    bindLeaveGuard();
    bindVisibility();
  }

  /** はじめから いままでの 時間。ほかの タブに いた あいだは 入れません */
  function elapsed() {
    const now = state.pausedAt || performance.now();
    return Math.max(0, now - state.startTime - state.pausedMs);
  }

  // ------------------------------------------------------------------
  // 画面を はなれた ときに とりこぼさない
  // ------------------------------------------------------------------
  //
  // ここは 打つ 画面（play.js）と 同じ 考えかたです。タブを とじられた ときに
  // 何も よばれないと、やった 課題が まるごと 消えます。Chromebook では
  // メモリ不足で タブが すてられる ことも あるので、pagehide で かならず 締めます。
  //
  // 打つ 画面と ちがい、**もどって きた ときに 区切り直しは しません**。
  // ショートカットは 課題の じゅんばんに 意味が あり（コピー → はりつけ）、
  // 入れなおすと さいしょの 課題まで もどって しまうからです。
  // 時計を 止めるだけに して、はなれて いた 時間を きろくに 入れません。

  let leaveHandler = null;
  let visibilityHandler = null;

  function bindLeaveGuard() {
    unbindLeaveGuard();
    leaveHandler = () => { if (state.running && hasWork()) finish('left'); };
    global.addEventListener('pagehide', leaveHandler);
  }

  function unbindLeaveGuard() {
    if (leaveHandler) global.removeEventListener('pagehide', leaveHandler);
    leaveHandler = null;
  }

  function bindVisibility() {
    unbindVisibility();
    visibilityHandler = () => {
      if (!state.running) return;
      if (document.hidden) { state.pausedAt = performance.now(); return; }
      if (state.pausedAt) {
        state.pausedMs += performance.now() - state.pausedAt;
        state.pausedAt = 0;
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
  }

  function unbindVisibility() {
    if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }

  function resetEditor() {
    $('sc-src').value = T.Lessons.SHORTCUT_SOURCE;
    $('sc-dst').value = '';
  }

  function renderTask() {
    const task = state.tasks[state.index];
    if (!task) return;
    state.attempts = 0;
    $('sc-task').innerHTML = `
      <p class="sc-name">${T.icon('bolt')} ${esc(task.name)}</p>
      <p class="sc-instruct">${esc(task.instruct)}</p>
      <p class="sc-combo">${comboLabel(task.combo)}</p>
      <p class="sc-hint">${esc(task.hint)}</p>
      <p class="sc-judge" id="sc-judge" aria-live="polite"></p>`;
    const pct = Math.round(state.index / state.tasks.length * 100);
    $('sc-bar').style.width = `${pct}%`;
    $('sc-done').textContent = String(state.index);
    // 課題によって、どちらの らんで やるかが かわります
    const focusDst = ['sc-paste', 'sc-paste2', 'sc-del-word'].indexOf(task.id) >= 0;
    const target = focusDst ? $('sc-dst') : $('sc-src');
    if (target && target.focus) target.focus();
  }

  let handler = null;

  function bind() {
    unbind();
    handler = e => {
      if (!state.running) return;
      const task = state.tasks[state.index];
      if (!task) return;
      if (shouldStop(e)) e.preventDefault();

      const combos = [task.combo].concat(task.alt || []);
      const hit = combos.some(c => matches(e, c));
      if (!hit) {
        // 修飾キーだけを 押した ときは まちがいに しません
        if (['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight',
             'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].indexOf(e.code) < 0 &&
            (e.ctrlKey || e.metaKey || e.altKey)) {
          state.attempts++;
          judge(false, 'ちがう キーみたい。もう1かい やってみよう。');
        }
        return;
      }

      if (task.type === 'press') { completeTask(true); return; }
      // やった けっかを 見てから 決めます（ブラウザの そうさが おわるのを まちます）
      const before = { src: $('sc-src').value, dst: $('sc-dst').value };
      state.beforeValue = before;
      setTimeout(() => verify(task, before), 30);
    };
    document.addEventListener('keydown', handler, true);
  }

  function unbind() {
    if (handler) document.removeEventListener('keydown', handler, true);
    handler = null;
  }

  /** 「じっさいに できたか」を たしかめます */
  function verify(task, before) {
    const src = $('sc-src'), dst = $('sc-dst');
    if (!src || !dst) return;
    const source = T.Lessons.SHORTCUT_SOURCE;
    let ok = false, message = '';

    switch (task.check) {
      case 'selectAll':
        ok = document.activeElement === src && src.selectionStart === 0 &&
             src.selectionEnd === src.value.length && src.value.length > 0;
        message = ok ? '' : '「もとの文」の 中を クリックしてから やってみてね。';
        break;
      case 'copied':
        ok = document.activeElement === src && src.selectionEnd > src.selectionStart;
        if (ok) state.copiedText = src.value.slice(src.selectionStart, src.selectionEnd);
        message = ok ? '' : 'さきに 文を えらんでから コピーしよう。';
        break;
      case 'pasted':
        ok = dst.value.length > before.dst.length && dst.value.indexOf(source.slice(0, 6)) >= 0;
        message = ok ? '' : '「じぶんの文」の 中を クリックしてから はりつけよう。';
        break;
      case 'pastedTwice':
        ok = countOccurrences(dst.value, source.slice(0, 6)) >= 2;
        message = ok ? '' : 'もう1かい はりつけると、2つ ならびます。';
        break;
      case 'cut':
        ok = src.value.length === 0 && before.src.length > 0;
        message = ok ? '' : 'Ctrl+A で ぜんぶ えらんでから Ctrl+X だよ。';
        break;
      case 'undone':
        ok = src.value.length > 0 && before.src.length === 0;
        message = ok ? '' : '「もとの文」の 中で もう1かい やってみよう。';
        break;
      case 'deletedWord':
        ok = dst.value.length < before.dst.length;
        message = ok ? '' : '「じぶんの文」に 文字が ないよ。まず 何か 打ってみよう。';
        break;
      default:
        ok = true;
    }

    if (ok) completeTask(true);
    else { state.attempts++; judge(false, message); }
  }

  function countOccurrences(text, needle) {
    if (!needle) return 0;
    let n = 0, i = 0;
    while ((i = text.indexOf(needle, i)) >= 0) { n++; i += needle.length; }
    return n;
  }

  function judge(ok, message) {
    const el = $('sc-judge');
    if (!el) return;
    el.className = `sc-judge ${ok ? 'ok' : 'ng'}`;
    el.textContent = ok ? 'できました！' : message;
  }

  /** 課題を 1つ おえます。ok=false は「とばした」ので 正かいには しません */
  function completeTask(ok) {
    const task = state.tasks[state.index];
    if (!task) return;
    judge(ok, '');
    state.results.push({
      q: task.name,
      // 学習ログの 設問IDは 課題の id を つかいます。名前（表示用）は
      // 言いまわしを 直す たびに かわり、過去の きろくと つながらなく なります
      qid: task.id,
      ok: !!ok,
      firstTry: !!ok && state.attempts === 0,
      tries: state.attempts + 1,
      ms: 0,
      wrong: []
    });
    state.index++;
    if (state.index >= state.tasks.length) { finish('completed'); return; }
    resetEditorForNext();
    setTimeout(renderTask, 260);
  }

  /** つぎの 課題が やりやすいように、らんの 中身を ととのえます */
  function resetEditorForNext() {
    const next = state.tasks[state.index];
    if (!next) return;
    if (next.id === 'sc-undo') return;                    // 切りとった 直後の 状態を つかいます
    if (next.id === 'sc-del-word') {
      $('sc-src').value = T.Lessons.SHORTCUT_SOURCE;
      if (!$('sc-dst').value) $('sc-dst').value = T.Lessons.SHORTCUT_SOURCE;
      return;
    }
    if (next.id === 'sc-paste2') return;                  // 1回目の はりつけを のこします
    if (next.id === 'sc-paste') return;
    resetEditor();
  }

  function finish(status) {
    if (!state.running) return null;
    state.running = false;
    unbind();
    unbindLeaveGuard();
    unbindVisibility();
    const elapsedMs = elapsed();
    const activeMs60 = T.Study ? T.Study.endSession() : null;
    const result = {
      course: state.course,
      stage: state.stage,
      source: 'course',
      status,
      startedAt: state.startedAt,
      // ショートカットは 画面を ひらいた ところから 時計を うごかします。
      // 打つ 練習と ちがい、読んで 考える 時間も れんしゅうの うちだからです
      clockStartedAt: state.startedAt,
      finishedAt: new Date().toISOString(),
      elapsedMs: elapsedMs,
      activeMs: elapsedMs,
      activeMs60: activeMs60,
      items: state.results,
      // ショートカットは 打鍵数を 数えません。「はやさ」の きろくには 入れず、
      // できた 課題の 数だけを のこします
      correctKeys: 0, totalKeys: 0, missKeys: 0, kps: 0, combo: 0, special: '',
      accuracy: state.results.length
        ? (state.results.filter(r => r.ok).length / state.results.length) * 100 : 0,
      missByKey: {}, missByFinger: {},
      layout: T.Store.getSettings().layout,
      count: state.tasks.length,
      done: state.index
    };
    if (typeof state.onFinish === 'function') state.onFinish(result);
    return result;
  }

  function isRunning() { return state.running; }
  function setOnFinish(fn) { state.onFinish = fn; }

  /** 子どもが「やめる」や「もどる」で おえた とき。やった ぶんは のこります */
  function stop() { return finish('stopped'); }

  /** この 回で 何か やったか（1つも やって いなければ きろくに のこしません） */
  function hasWork() { return state.index > 0 || state.results.length > 0; }

  global.Typa = global.Typa || {};
  global.Typa.Shortcut = { start, finish, stop, abort: stop, isRunning, hasWork, setOnFinish, unbind };
})(window);
