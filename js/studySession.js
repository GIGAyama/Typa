/* Typa — src/studySession.js から つくった 配信用です。手で 直さず src/ を 直して npm run build。*/
(function (global) {
'use strict';
const T = global.Typa;
const APP_ID = 'typa';
const IDLE_LIMIT_MS = 60000;
const ITEMS_MAX = 200;
const COUNT_MAX = 1000;
const DAY_MS = 86400000;
const EXT_MAX = 7800;
const MISS_TOP = 20;
const ACTIVE_EVENTS = ['click', 'keydown', 'touchstart', 'pointerdown'];
const UNIT_ALIASES = {
};
function unitIdOf(courseId, stageId) {
const key = `${courseId}:${stageId}`;
return UNIT_ALIASES[key] || `${courseId}-${stageId}`;
}
const ASCII_ONLY = /^[\x20-\x7e]+$/;
function hashOf(text) {
let h = 5381;
for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
return h.toString(16);
}
function questionId(text) {
const s = String(text == null ? '' : text);
if (!s) return 'q-empty';
if (s.length <= 20 && ASCII_ONLY.test(s)) return s;
return `w-${hashOf(s)}`;
}
const timer = { ms: 0, mark: 0, idle: true, running: false, tickId: 0, idleId: 0 };
function tick() {
const now = Date.now();
const hidden = typeof document !== 'undefined' && document.hidden;
if (!timer.idle && !hidden) timer.ms += now - timer.mark;
timer.mark = now;
}
function wake() { tick(); timer.idle = false; }
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
const int = n => Math.max(0, Math.round(Number(n) || 0));
const round1 = n => Math.round((Number(n) || 0) * 10) / 10;
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
function isoOf(value) {
const d = value ? new Date(value) : new Date();
return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
function topMiss(map) {
const src = map || {};
const out = {};
Object.keys(src)
.sort((a, b) => src[b] - src[a])
.slice(0, MISS_TOP)
.forEach(k => { const n = Math.round(src[k]); if (n > 0) out[k] = n; });
return out;
}
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
function fitExt(ext) {
const drops = ['retry', 'missByKey', 'missByFinger'];
for (let i = 0; i < drops.length; i++) {
if (JSON.stringify(ext).length <= EXT_MAX) return ext;
delete ext[drops[i]];
}
return ext;
}
function buildRecord(result, ctx) {
const c = ctx || {};
const stage = result.stage || {};
const isChallenge = stage.mode === 'challenge';
const isShortcut = stage.mode === 'shortcut';
const isWeak = result.special === 'weak';
const main = (result.items || []).filter(it => it && !it.retry);
const kept = main.slice(0, ITEMS_MAX);
const truncated = main.length > kept.length
? { attempted: main.length, firstTryCorrect: main.filter(it => it.firstTry).length }
: null;
const elapsedMs = Math.min(DAY_MS, int(result.elapsedMs));
const retryMs = int(result.retryMs);
let activeMs = null;
if (isChallenge) {
activeMs = elapsedMs;
} else if (typeof result.activeMs60 === 'number') {
activeMs = Math.min(elapsedMs, Math.max(0, int(result.activeMs60) - retryMs));
}
const correctKeys = int(result.correctKeys);
const totalKeys = int(result.totalKeys);
const keys = totalKeys || correctKeys;
const laps = int(result.laps);
const stars = (stage.noStars || !laps) ? 0
: (c.lapStars != null ? int(c.lapStars) : (T.Store ? T.Store.starsOf(result) : 0));
const retryItems = (result.items || []).filter(it => it && it.retry).length;
const ext = {
activity: isShortcut ? 'shortcut' : 'typing',
keys,
correctKeys,
missKeys: int(result.missKeys),
keyAccuracy: round1(result.accuracy),
kps: round2(result.kps),
typingMs: int(result.activeMs),
bestCombo: int(result.combo),
layout: result.layout || '',
missByKey: topMiss(subtractMiss(result.missByKey, result.retryMissByKey)),
missByFinger: topMiss(subtractMiss(result.missByFinger, result.retryMissByFinger)),
lapNeed: int(result.lapNeed),
lapPos: int(result.lapPos),
laps,
stars,
eligibleForBest: keys >= (T.Store ? T.Store.MIN_RECORD_KEYS : 20)
};
if (result.hintLevel) ext.hintLevel = result.hintLevel;
if (c.rank != null) ext.rank = int(c.rank);
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
multiplayer: false,
grading: 'objective',
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
function save(result, ctx) {
const put = global.StudyLog && global.StudyLog.saveStudyRecord;
if (typeof put !== 'function') return null;
try {
return put(buildRecord(result, ctx));
} catch (e) {
return null;
}
}
global.Typa = global.Typa || {};
global.Typa.Study = {
APP_ID, IDLE_LIMIT_MS, ITEMS_MAX, COUNT_MAX,
beginSession, endSession, buildRecord, save,
questionId, unitIdOf, UNIT_ALIASES
};
})(window);
