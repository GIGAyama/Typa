/* Typa — src/shortcut.js から つくった 配信用です。手で 直さず src/ を 直して npm run build。*/
(function (global) {
'use strict';
const T = global.Typa;
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
pausedAt: 0, pausedMs: 0,
copiedText: '', beforeValue: '', running: false,
onFinish: null, attempts: 0
};
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s)
.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
function elapsed() {
const now = state.pausedAt || performance.now();
return Math.max(0, now - state.startTime - state.pausedMs);
}
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
if (!state.running) return;
const task = state.tasks[state.index];
const box = $('sc-task');
if (!task || !box) return;
state.attempts = 0;
box.innerHTML = `
      <p class="sc-name">${T.icon('bolt')} ${esc(task.name)}</p>
      <p class="sc-instruct">${esc(task.instruct)}</p>
      <p class="sc-combo">${comboLabel(task.combo)}</p>
      <p class="sc-hint">${esc(task.hint)}</p>
      <p class="sc-judge" id="sc-judge" aria-live="polite"></p>`;
const pct = Math.round(state.index / state.tasks.length * 100);
const bar = $('sc-bar');
if (bar) bar.style.width = `${pct}%`;
const done = $('sc-done');
if (done) done.textContent = String(state.index);
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
if (['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight',
'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].indexOf(e.code) < 0 &&
(e.ctrlKey || e.metaKey || e.altKey)) {
state.attempts++;
judge(false, 'ちがう キーみたい。もう1かい やってみよう。');
}
return;
}
if (task.type === 'press') { completeTask(true); return; }
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
function verify(task, before) {
if (!state.running) return;
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
function completeTask(ok) {
if (!state.running) return;
const task = state.tasks[state.index];
if (!task) return;
judge(ok, '');
state.results.push({
q: task.name,
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
function resetEditorForNext() {
const next = state.tasks[state.index];
if (!next) return;
if (next.id === 'sc-undo') return;
if (next.id === 'sc-del-word') {
$('sc-src').value = T.Lessons.SHORTCUT_SOURCE;
if (!$('sc-dst').value) $('sc-dst').value = T.Lessons.SHORTCUT_SOURCE;
return;
}
if (next.id === 'sc-paste2') return;
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
clockStartedAt: state.startedAt,
finishedAt: new Date().toISOString(),
elapsedMs: elapsedMs,
activeMs: elapsedMs,
activeMs60: activeMs60,
items: state.results,
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
function stop() { return finish('stopped'); }
function hasWork() { return state.index > 0 || state.results.length > 0; }
global.Typa = global.Typa || {};
global.Typa.Shortcut = { start, finish, stop, abort: stop, isRunning, hasWork, setOnFinish, unbind };
})(window);
