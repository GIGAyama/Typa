/* Typa — src/play.js から つくった 配信用です。手で 直さず src/ を 直して npm run build。*/
(function (global) {
'use strict';
const T = global.Typa;
const IDLE_MS = 5000;
const SKIP_AFTER = 4;
const COMBO_STEP = 10;
const RETRY_MAX = 5;
const LAP_FLASH_MS = 1600;
const FULL_FLASH_MS = 2400;
const AWAY_SPLIT_MS = 300000;
const state = {
course: null, stage: null, source: 'course', special: '',
pool: [], queue: [], current: null, index: 0,
endless: false, limitMs: 0,
lapNeed: 1, lapPos: 0, lapStart: 0, doneItems: 0, laps: 0,
lapStarsSeen: 0,
hadFullStars: false,
lapFlashTimer: 0,
goalKps: 0,
matcher: null,
startedAt: null, clockStartedAt: null, startTime: 0, lastKeyTime: 0,
idleMs: 0, pausedAt: 0, pausedMs: 0, leftAt: 0,
itemStart: 0, itemMistakes: 0, itemWrong: [], itemFirstTry: true,
results: [],
correctKeys: 0, missKeys: 0, combo: 0, bestCombo: 0,
missByKey: {}, missByFinger: {},
retryMissByKey: {}, retryMissByFinger: {},
phase: 'main', retryPool: [], retryTotal: 0, retryUse: true, retryNotice: false,
retryMs: 0, retryEnter: 0, retryIdleMs: 0, idleEnter: 0,
lat: {}, conf: {}, rule: {}, keystrokes: [],
itemKeyCount: 0, lastOk: true, skipLatency: false,
running: false, imeWarned: false,
settings: null, view: null, showKeyboard: true, showHands: false, showBuddy: false,
timerId: 0, onFinish: null, onStop: null, onPick: null, onAway: null
};
const $ = id => document.getElementById(id);
function esc(s) {
return String(s == null ? '' : s)
.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function screenHtml(course, stage) {
const limited = !!stage.limitMs;
return `
      <div class="play" id="play-root">
        <div class="play-head">
          <!-- ステージ名は そのまま 階層への 入口です。「これじゃ ない」と
               思った ときに、下のバーまで 目を うつさずに 変えられます -->
          ${stage.noStars
? `<div class="play-title">
                 <span class="chip chip-${course.color}">${esc(course.short)}</span>
                 <b>${esc(stage.title)}</b>
               </div>`
: `<button class="play-title is-link" id="play-pick-btn" type="button">
                 <span class="chip chip-${course.color}">${esc(course.short)}</span>
                 <b>${esc(stage.title)}</b>
                 <span class="play-title-hint">かえる</span>
               </button>`}
          <div class="play-progress" role="group" aria-label="すすみぐあい">
            <div class="bar${limited ? ' bar-time' : ''}"><span id="play-bar"></span></div>
            <span class="num">${limited
? `のこり <b id="play-left">${Math.round(stage.limitMs / 1000)}</b> びょう`
: '<span id="play-phase" hidden>もういちど </span>ひとまわりまで あと <b id="play-left-items">0</b>'}</span>
          </div>
        </div>

        <!-- ひろい 画面では お題と キャラクターを よこに ならべます。
             お題は いちばん 大きい ままで、たての ながさを へらせます -->
        <div class="play-main">
          <div class="play-col">
            <div class="play-stage" id="play-stage">
              <p class="q-label" id="q-label"></p>
              <p class="q-kana" id="q-kana"></p>
              <p class="q-romaji" id="q-romaji"></p>
              <!-- ひとまわり できた ときの おしらせ。打つのは 止めません -->
              <p class="lap-flash" id="play-lap-flash" hidden aria-hidden="true"></p>
            </div>

            <!-- 「つぎの 指」と きろくの 数字。たてが みじかい 画面では
                 この 2つを よこに ならべて、あいた ぶんを キーボードに
                 まわします（style.css の .play-status）-->
            <div class="play-status">
              <div class="play-finger" id="play-finger" aria-live="polite"></div>

              <div class="play-meter">
                <div class="meter" id="m-kps-box"><span class="meter-label">はやさ</span><b id="m-kps">0.0</b><span class="meter-unit">打/びょう</span><span class="meter-goal" id="m-kps-goal" hidden></span></div>
                <div class="meter"><span class="meter-label">正かくさ</span><b id="m-acc">100</b><span class="meter-unit">%</span></div>
                <div class="meter"><span class="meter-label">ミス</span><b id="m-miss">0</b><span class="meter-unit">かい</span></div>
                <div class="meter meter-combo" id="m-combo-box"><span class="meter-label">れんぞく</span><b id="m-combo">0</b><span class="meter-unit">だ</span></div>
              </div>
            </div>
          </div>

          <div class="play-side" id="play-side">
            <div id="play-buddy"></div>
          </div>
        </div>

        <div class="ime-warn" id="ime-warn" hidden>
          ${T.icon('info')} <span>かな入力に なって いるみたい。<b>かな英数キー</b>（1の 左）か
            <b>英数キー</b>（スペースの 左）を おしてから 打ってね。</span>
        </div>

        <p class="play-ready" id="play-ready">${T.icon('play')} さいしょの 1打で スタートします。10びょうでも きろくは のこります。</p>

        <!-- キーボードと 手の 絵は ひとくみ です。かならず **上下**に かさねます。
             よこに ならべると、キーの ばしょと 指を 見くらべる たびに 目が
             左右に いききして、どの 指が どの キーの 下に あるのかも
             分かりません。上下なら 指先が ホームポジションの キーの
             まっすぐ 下に 来るので、目は すこし 下を 見るだけ です。

             はばは この かたまり だけ 画面いっぱいに ひろげます（style.css）。
             ひとつの わく（kb-scroll）の 中に 入れて あるので、せまい 画面で
             よこに スクロールしても キーボードと 指が いっしょに うごきます -->
        <div class="play-lower">
          <div class="kb-scroll">
            <div class="kb-fit">
              <div class="kb-wrap"><div id="play-kb"></div></div>
              <div class="play-visual"><div id="play-hands"></div></div>
            </div>
          </div>
        </div>

        <div class="play-foot">
          <button class="btn btn-ghost" id="play-skip-btn" type="button" hidden>この お題を とばす</button>
          <button class="btn btn-outline btn-stop" id="play-stop-btn" type="button">
            ${T.icon('check')} やめる<span class="btn-note">ここまでの きろくは のこります</span>
          </button>
        </div>
      </div>`;
}
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
state.onStop = typeof p.onStop === 'function' ? p.onStop : null;
state.onPick = typeof p.onPick === 'function' ? p.onPick : null;
state.onAway = typeof p.onAway === 'function' ? p.onAway : null;
state.pool = p.stage.items.slice();
state.lapNeed = Math.max(1, state.pool.length);
state.lapStart = (p.stage.noStars || state.limitMs)
? 0
: T.Store.lapState(p.stage.id, state.lapNeed).items;
state.lapPos = state.lapStart;
state.doneItems = 0;
state.laps = 0;
state.lapStarsSeen = 0;
state.hadFullStars = ((T.Store.getProgress()[p.stage.id] || {}).stars || 0) >= 3;
if (state.lapFlashTimer) { clearTimeout(state.lapFlashTimer); state.lapFlashTimer = 0; }
state.queue = firstQueue(state.pool, state.source, state.endless, state.lapPos);
state.index = 0;
state.results = [];
state.correctKeys = 0;
state.missKeys = 0;
state.combo = 0;
state.bestCombo = 0;
state.missByKey = {};
state.missByFinger = {};
state.retryMissByKey = {};
state.retryMissByFinger = {};
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
state.retryMs = 0;
state.retryEnter = 0;
state.retryIdleMs = 0;
state.idleEnter = 0;
state.retryUse = settings.retry !== false && !state.endless && !state.limitMs;
state.idleMs = 0;
state.pausedAt = 0;
state.pausedMs = 0;
state.imeWarned = false;
state.startedAt = new Date();
state.clockStartedAt = null;
state.startTime = 0;
state.lastKeyTime = 0;
state.leftAt = 0;
state.running = true;
if (T.Study) T.Study.beginSession();
const viewSettings = typeof p.assistLevel === 'number'
? Object.assign({}, settings, { assist: p.assistLevel })
: settings;
state.view = T.Store.resolveAssist(viewSettings, {
stageMastery: T.Mastery.stageMastery(T.Store.keySummary().byKey, p.stage),
everThreeStars: ((T.Store.getProgress()[p.stage.id] || {}).stars || 0) >= 3,
blind: !!p.blind || !!p.stage.blind
});
state.showKeyboard = state.view.keyboard;
state.showHands = settings.hands !== false && state.view.fingerGuide;
state.showBuddy = settings.buddy !== false;
p.mount.innerHTML = screenHtml(p.course, p.stage);
if (!state.showKeyboard) $('play-kb').closest('.kb-wrap').hidden = true;
else {
T.Keyboard.render($('play-kb'), {
layoutId: settings.layout,
fingerGuide: state.view.fingerGuide,
labels: state.view.keyLabels,
onTap: tap => handleChar(tap.char, tap.code, 'tap')
});
}
if (state.showHands) T.Hands.render($('play-hands'));
else { const visual = document.querySelector('.play-visual'); if (visual) visual.hidden = true; }
if (state.showBuddy) T.Buddy.render($('play-buddy'), { job: settings.buddyJob });
else { const side = $('play-side'); if (side) side.hidden = true; }
state.goalKps = p.goalKps || 0;
const goalEl = $('m-kps-goal');
if (goalEl && state.goalKps > 0) {
goalEl.textContent = `めやす ${state.goalKps.toFixed(1)}`;
goalEl.hidden = false;
}
$('play-skip-btn').addEventListener('click', skipItem);
$('play-stop-btn').addEventListener('click', () => { if (state.onStop) state.onStop(); });
const pick = $('play-pick-btn');
if (pick) pick.addEventListener('click', () => { if (state.onPick) state.onPick(); });
loadItem();
renderMeters();
fitKeyboard();
bindKeys();
bindFit();
bindLeaveGuard();
bindVisibility();
if (state.limitMs) startTimer();
}
const EM_MIN = 8;
const EM_MAX = 22;
function fitKeyboard() {
const root = $('play-root');
const lower = document.querySelector('.play-lower');
if (!root || !lower) return;
const scroll = lower.querySelector('.kb-scroll');
if (!scroll || !lower.offsetHeight) return;
let saved = null;
try {
saved = fillLongest();
const setEm = em => lower.style.setProperty('--kb-em', `${Math.round(em * 100) / 100}px`);
const scrollW = scroll.clientWidth;
const nav = document.querySelector('.navbar');
const navH = nav ? nav.getBoundingClientRect().height : 62;
const view = root.parentElement;
const pad = view ? parseFloat(getComputedStyle(view).paddingBottom) || 0 : 0;
const top = root.getBoundingClientRect().top + global.scrollY;
const room = global.innerHeight - navH - top - pad - 4;
const emHi = Math.max(EM_MIN + 2, Math.min(EM_MAX, scrollW / 88));
setEm(EM_MIN);
const low = lower.getBoundingClientRect().height;
setEm(emHi);
const high = lower.getBoundingClientRect().height;
const slope = (high - low) / (emHi - EM_MIN);
const rootH = root.getBoundingClientRect().height;
const em = Math.max(EM_MIN, Math.min(emHi, slope > 0 ? emHi + (room - rootH) / slope : emHi));
setEm(em);
stretchRows(root, lower, room);
} finally {
restoreQuestion(saved);
}
}
function stretchRows(root, lower, room) {
lower.style.removeProperty('--kb-row');
const spare = room - root.getBoundingClientRect().height;
if (spare < 6) return;
const kb = lower.querySelector('.kb');
const key = kb && kb.querySelector('.kb-key:not(.is-top)');
if (!key) return;
const now = key.getBoundingClientRect().height;
const square = kb.getBoundingClientRect().width / 15 - 4;
const row = Math.min(square, now + spare / 5.73);
if (row > now + 1) lower.style.setProperty('--kb-row', `${Math.round(row * 10) / 10}px`);
}
function fillLongest() {
const kana = $('q-kana'), label = $('q-label'), romaji = $('q-romaji');
if (!kana || !label || !romaji) return null;
let item = null, score = -1;
state.pool.forEach(it => {
const s = (it.k || '').length * 2 + (it.d || '').length;
if (s > score) { score = s; item = it; }
});
if (!item) return null;
let hint = '';
if (!item.raw && state.view.romajiHint) {
try { hint = T.Romaji.createMatcher(item.k).hint().rest; } catch (e) { hint = ''; }
}
const saved = {
kana: kana.innerHTML, label: label.textContent, labelHidden: label.hidden,
romaji: romaji.innerHTML, romajiHidden: romaji.hidden
};
kana.textContent = item.k;
label.textContent = item.d || '';
label.hidden = !item.d;
if (hint) {
romaji.hidden = false;
romaji.textContent = hint;
}
return saved;
}
function restoreQuestion(saved) {
if (!saved) return;
$('q-kana').innerHTML = saved.kana;
$('q-label').textContent = saved.label;
$('q-label').hidden = saved.labelHidden;
$('q-romaji').innerHTML = saved.romaji;
$('q-romaji').hidden = saved.romajiHidden;
}
let fitHandler = null;
function bindFit() {
unbindFit();
let waiting = false;
fitHandler = () => {
if (waiting) return;
waiting = true;
global.requestAnimationFrame(() => { waiting = false; if (state.running) fitKeyboard(); });
};
global.addEventListener('resize', fitHandler);
}
function unbindFit() {
if (fitHandler) global.removeEventListener('resize', fitHandler);
fitHandler = null;
}
function firstQueue(pool, source, endless, lapPos) {
const need = Math.max(1, pool.length);
const left = Math.max(1, need - Math.max(0, lapPos || 0));
if (endless) return shuffle(pool.slice());
if (source !== 'course') return shuffle(pool.slice()).slice(0, left);
return pool.slice(need - left);
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
state.queue = shuffle(state.pool.slice());
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
function renderNextKey() {
const ch = state.matcher.expected();
const box = $('play-finger');
if (!box) return;
const clear = () => {
box.innerHTML = '';
if (state.view.nextGlow) T.Keyboard.highlight([]);
if (state.showHands) T.Hands.highlight([]);
};
if (!ch) { clear(); return; }
const found = T.Layout.findKey(state.settings.layout, ch);
if (!found) { clear(); return; }
const finger = T.Layout.fingerOf(found.key.code);
if (state.view.nextGlow) T.Keyboard.highlight([found.key.code], found.shift);
if (state.showHands) {
const ids = finger ? [finger.id] : [];
if (found.shift) ids.push(T.Hands.shiftFingerFor(finger ? finger.id : ''));
T.Hands.highlight(ids);
}
if (!state.view.fingerWords) { box.innerHTML = ''; return; }
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
if (state.phase === 'retry') {
const total = Math.max(1, state.retryTotal);
bar.style.width = `${Math.round(Math.min(1, state.index / total) * 100)}%`;
const left = $('play-left-items');
if (left) left.textContent = String(Math.max(0, total - state.index));
return;
}
const left = Math.max(0, state.lapNeed - state.lapPos);
const leftEl = $('play-left-items');
if (leftEl) leftEl.textContent = String(left);
bar.style.width = `${Math.round(Math.min(1, state.lapPos / state.lapNeed) * 100)}%`;
}
function renderMeters() {
const stats = liveStats();
$('m-kps').textContent = stats.kps.toFixed(1);
if (state.goalKps > 0) {
const box = $('m-kps-box');
if (box) box.classList.toggle('is-reached', stats.kps >= state.goalKps);
}
$('m-acc').textContent = String(Math.round(stats.accuracy));
$('m-miss').textContent = String(state.missKeys);
$('m-combo').textContent = String(state.combo);
}
function elapsed() {
if (!state.startTime) return 0;
const now = state.pausedAt || performance.now();
return Math.max(0, now - state.startTime - state.pausedMs);
}
function retryElapsed() {
return state.retryMs + (state.phase === 'retry' ? Math.max(0, elapsed() - state.retryEnter) : 0);
}
function retryIdle() {
return state.retryIdleMs + (state.phase === 'retry' ? Math.max(0, state.idleMs - state.idleEnter) : 0);
}
function liveStats() {
const ms = Math.max(0, elapsed() - retryElapsed());
const idle = Math.max(0, state.idleMs - retryIdle());
const active = state.limitMs ? Math.max(1, ms) : Math.max(1, ms - idle);
const total = state.correctKeys + state.missKeys;
return {
elapsedMs: ms,
activeMs: active,
kps: ms > 0 ? state.correctKeys / (active / 1000) : 0,
accuracy: total > 0 ? (state.correctKeys / total) * 100 : 100
};
}
function startTimer() {
stopTimer();
state.timerId = setInterval(() => {
if (!state.running) return;
renderProgress();
if (state.startTime && elapsed() >= state.limitMs) finish('completed');
}, 100);
}
function stopTimer() {
if (state.timerId) clearInterval(state.timerId);
state.timerId = 0;
}
let visibilityHandler = null;
function bindVisibility() {
unbindVisibility();
visibilityHandler = onVisibility;
document.addEventListener('visibilitychange', visibilityHandler);
}
function unbindVisibility() {
if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
visibilityHandler = null;
}
function onVisibility() {
if (!state.running) return;
if (document.hidden) {
state.leftAt = Date.now();
if (state.startTime) state.pausedAt = performance.now();
return;
}
const away = state.leftAt ? Math.max(0, Date.now() - state.leftAt) : 0;
state.leftAt = 0;
if (state.pausedAt) {
state.pausedMs += performance.now() - state.pausedAt;
state.pausedAt = 0;
state.lastKeyTime = performance.now();
state.skipLatency = true;
}
if (away < AWAY_SPLIT_MS || !hasWork() || !state.onAway) return;
const resume = state.onAway;
finish('left', new Date(Date.now() - away).toISOString());
resume();
}
let keyHandler = null;
function bindKeys() {
unbindKeys();
keyHandler = e => {
if (!state.running) return;
if (e.isComposing || e.keyCode === 229) { warnIme(); return; }
if (e.ctrlKey || e.altKey || e.metaKey) return;
if (e.key === 'Escape') return;
if (e.key === 'Backspace') { e.preventDefault(); return; }
if (e.key.length !== 1) return;
e.preventDefault();
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
function handleChar(ch, code, src) {
if (!state.running || !state.matcher) return;
const now = performance.now();
const gapBefore = state.startTime ? now - state.lastKeyTime : 0;
if (state.retryNotice) {
state.retryNotice = false;
const notice = $('play-ready');
if (notice) notice.classList.add('is-gone');
}
if (!state.startTime) {
state.startTime = now;
state.clockStartedAt = new Date();
state.lastKeyTime = now;
const ready = $('play-ready');
if (ready) ready.classList.add('is-gone');
} else {
const gap = now - state.lastKeyTime;
if (gap > IDLE_MS) state.idleMs += gap - IDLE_MS;
state.lastKeyTime = now;
}
const info = state.matcher.expectedInfo();
const expectedChar = info.ch;
const r = state.matcher.input(String(ch).toLowerCase());
recordTiming(ch, r.ok, gapBefore, src);
recordRule(info.rule, r.ok);
const counts = state.phase === 'main';
const wantFinger = fingerOfChar(expectedChar);
if (r.ok) {
if (counts) state.correctKeys++;
state.combo++;
if (state.combo > state.bestCombo) state.bestCombo = state.combo;
if (code && state.showKeyboard) T.Keyboard.flash(code, true);
if (state.showHands && wantFinger) T.Hands.press(wantFinger.id, true);
if (state.showBuddy) T.Buddy.tap();
if (state.combo > 0 && state.combo % COMBO_STEP === 0) celebrateCombo();
beep(true);
} else {
if (counts) state.missKeys++;
state.itemMistakes++;
state.itemFirstTry = false;
state.combo = 0;
recordMiss(ch, expectedChar);
if (code && state.showKeyboard) T.Keyboard.flash(code, false);
if (state.showHands && wantFinger) T.Hands.press(wantFinger.id, false);
if (state.showBuddy) T.Buddy.miss();
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
function recordTiming(pressed, ok, gap, src) {
const M = T.Mastery;
const key = String(pressed).toLowerCase();
if (state.keystrokes.length < 2000) {
state.keystrokes.push({ ms: Math.round(gap), ok: !!ok, ch: key, retry: state.phase === 'retry' });
}
const skip = state.skipLatency;
state.skipLatency = false;
const wasOk = state.lastOk;
state.lastOk = !!ok;
if (!ok) return;
if (src === 'tap') return;
if (skip) return;
if (state.itemKeyCount === 0) return;
if (!wasOk) return;
if (gap <= 0 || gap > M.MAX_SAMPLE) return;
if (!state.lat[key]) state.lat[key] = new Array(M.BUCKETS).fill(0);
state.lat[key][M.bucketOf(gap)]++;
}
function recordRule(rule, ok) {
if (!rule || rule === 'raw' || rule === 'kigou') return;
if (!state.rule[rule]) state.rule[rule] = [0, 0];
state.rule[rule][0]++;
if (!ok) state.rule[rule][1]++;
}
function recordMiss(pressed, expectedChar) {
if (state.itemWrong.length < 8 && pressed && !/[<>{}\\]/.test(pressed)) {
state.itemWrong.push(pressed);
}
if (!expectedChar) return;
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
if (state.phase === 'retry') {
state.retryMissByKey[key] = (state.retryMissByKey[key] || 0) + 1;
if (finger) state.retryMissByFinger[finger.id] = (state.retryMissByFinger[finger.id] || 0) + 1;
}
}
function fingerOfChar(ch) {
if (!ch) return null;
const found = T.Layout.findKey(state.settings.layout, ch);
return found ? T.Layout.fingerOf(found.key.code) : null;
}
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
if (state.phase === 'main' && state.retryUse && !state.itemFirstTry &&
state.retryPool.length < RETRY_MAX) {
state.retryPool.push(item);
}
state.index++;
if (state.phase === 'main') {
state.doneItems++;
state.lapPos++;
}
renderProgress();
const stage = $('play-stage');
if (stage && ok) {
stage.classList.add('is-clear');
setTimeout(() => stage.classList.remove('is-clear'), 260);
if (state.showBuddy) T.Buddy.done();
}
if (!state.limitMs && !state.endless && state.queue.length === 0) {
if (!startRetry()) lapDone();
}
loadItem();
}
function startRetry() {
if (state.phase !== 'main' || !state.retryUse || state.retryPool.length === 0) return false;
state.phase = 'retry';
state.retryEnter = elapsed();
state.idleEnter = state.idleMs;
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
notice.classList.remove('is-gone');
state.retryNotice = true;
}
return true;
}
function lapDone() {
if (state.phase === 'retry') {
state.retryMs += Math.max(0, elapsed() - state.retryEnter);
state.retryIdleMs += Math.max(0, state.idleMs - state.idleEnter);
const root = $('play-root');
if (root) root.classList.remove('is-retry');
const phase = $('play-phase');
if (phase) phase.hidden = true;
const notice = $('play-ready');
if (notice && state.retryNotice) { notice.classList.add('is-gone'); state.retryNotice = false; }
}
state.laps++;
state.phase = 'main';
state.retryPool = [];
state.retryTotal = 0;
state.index = 0;
state.lapPos = 0;
state.queue = shuffle(state.pool.slice());
renderProgress();
const stars = lapStarsNow();
if (stars > state.lapStarsSeen) state.lapStarsSeen = stars;
celebrateLap(stars);
}
function lapStarsNow() {
if (state.stage.noStars || state.limitMs) return 0;
const total = state.correctKeys + state.missKeys;
const delta = total > 0
? { correct: state.correctKeys, total: total }
: {
correct: state.results.filter(it => it.ok && !it.retry).length,
total: state.doneItems, byItem: true
};
return T.Store.lapStarsPreview(state.stage.id, delta);
}
function celebrateLap(stars) {
const full = stars >= 3;
const first = full && !state.hadFullStars;
if (full) state.hadFullStars = true;
const flash = $('play-lap-flash');
if (flash) {
const lap = `（${state.laps}しゅう目）`;
flash.innerHTML = full
? `<span class="stars">${`<span class="star on">${T.icon('star')}</span>`.repeat(3)}</span>`
+ `${first ? 'はじめての ★3つ！' : '★3つ！'}${lap}`
: `ひとまわり できた！${lap}`;
flash.classList.toggle('is-full', full);
flash.hidden = false;
flash.classList.remove('is-on');
void flash.getBoundingClientRect();
flash.classList.add('is-on');
if (state.lapFlashTimer) clearTimeout(state.lapFlashTimer);
state.lapFlashTimer = setTimeout(() => {
state.lapFlashTimer = 0;
flash.hidden = true;
flash.classList.remove('is-on');
}, full ? FULL_FLASH_MS : LAP_FLASH_MS);
if (T.FX) T.FX.confettiAt(flash, full ? { count: 54, power: .8 } : { count: 26, power: .55 });
}
if (state.showBuddy) {
T.Buddy.cheer();
T.Buddy.reroll();
}
if (full) chimeFull(); else chime();
}
const HINT_NAMES = ['all', 'finger-color', 'position-only', 'none'];
function hintLevelName(view) {
if (!view) return '';
const level = view.level;
if (typeof level === 'number' && HINT_NAMES[level]) {
return view.auto ? `auto-${HINT_NAMES[level]}` : HINT_NAMES[level];
}
return String(level || '');
}
function finish(status, endedAt) {
if (!state.running) return null;
state.running = false;
stopTimer();
unbindKeys();
unbindFit();
unbindLeaveGuard();
unbindVisibility();
T.Buddy.stop();
const stats = liveStats();
const activeMs60 = T.Study ? T.Study.endSession() : null;
const total = state.correctKeys + state.missKeys;
const result = {
course: state.course,
stage: state.stage,
source: state.source,
special: state.special,
status,
startedAt: state.startedAt,
clockStartedAt: state.clockStartedAt || state.startedAt,
finishedAt: endedAt || new Date().toISOString(),
elapsedMs: stats.elapsedMs,
activeMs: stats.activeMs,
activeMs60: activeMs60,
items: state.results,
correctKeys: state.correctKeys,
totalKeys: total,
missKeys: state.missKeys,
kps: stats.kps,
accuracy: total > 0 ? (state.correctKeys / total) * 100 : 0,
combo: state.bestCombo,
missByKey: state.missByKey,
missByFinger: state.missByFinger,
retryMissByKey: state.retryMissByKey,
retryMissByFinger: state.retryMissByFinger,
retryMs: Math.round(retryElapsed()),
hintLevel: hintLevelName(state.view),
hintStrength: T.Store.hintStrengthOf(state.view),
lat: state.lat,
conf: state.conf,
rule: state.rule,
keystrokes: state.keystrokes,
layout: state.settings.layout,
doneItems: state.doneItems,
lapNeed: state.lapNeed,
lapPos: state.lapPos,
laps: state.laps,
lapStarsSeen: state.lapStarsSeen,
count: state.doneItems,
done: state.index,
retried: state.retryTotal
};
if (typeof state.onFinish === 'function') state.onFinish(result);
return result;
}
let leaveHandler = null;
function bindLeaveGuard() {
unbindLeaveGuard();
leaveHandler = () => {
if (!state.running) return;
if (state.correctKeys + state.missKeys === 0 && state.doneItems === 0) return;
finish('left');
};
global.addEventListener('pagehide', leaveHandler);
}
function unbindLeaveGuard() {
if (leaveHandler) global.removeEventListener('pagehide', leaveHandler);
leaveHandler = null;
}
function shake() {
const el = $('play-stage');
if (!el) return;
el.classList.remove('is-miss');
void el.offsetWidth;
el.classList.add('is-miss');
}
function celebrateCombo() {
const box = $('m-combo-box');
if (box) {
box.classList.remove('is-up');
void box.offsetWidth;
box.classList.add('is-up');
}
if (state.showBuddy) T.Buddy.combo();
chime();
}
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
} catch (e) { }
}
function beep(ok) { tone(ok ? 880 : 220, ok ? 60 : 140, 0.05); }
function chime() {
[0, 90, 180].forEach((delay, i) => {
setTimeout(() => tone([784, 988, 1319][i], 180, 0.045), delay);
});
}
function chimeFull() {
[784, 988, 1319, 1568].forEach((freq, i) => {
setTimeout(() => tone(freq, i === 3 ? 300 : 180, 0.045), i * 90);
});
}
function isRunning() { return state.running; }
function setOnFinish(fn) { state.onFinish = fn; }
function stop() { return finish('stopped'); }
function hasWork() { return state.correctKeys + state.missKeys > 0 || state.doneItems > 0; }
global.Typa = global.Typa || {};
global.Typa.Play = { start, finish, stop, abort: stop, isRunning, hasWork, setOnFinish, unbindKeys };
})(window);
