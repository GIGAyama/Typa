/* Typa — src/store.js から つくった 配信用です。手で 直さず src/ を 直して npm run build。*/
(function (global) {
'use strict';
const KEYS = {
settings: 'typa.settings.v1',
progress: 'typa.progress.v1',
history: 'typa.history.v1',
awards: 'typa.awards.v1',
challenge: 'typa.challenge.v1'
};
const HISTORY_MAX = 300;
const DETAIL_MAX = 60;
const DETAIL_FIELDS = ['lat', 'conf', 'rule'];
const cache = Object.create(null);
function read(key, fallback) {
try {
const raw = localStorage.getItem(key);
if (!raw) { delete cache[key]; return fallback; }
const hit = cache[key];
if (hit && hit.raw === raw) return hit.value;
const value = JSON.parse(raw);
if (value === null || value === undefined) { delete cache[key]; return fallback; }
cache[key] = { raw, value };
return value;
} catch (e) { delete cache[key]; return fallback; }
}
function write(key, value) {
let raw;
try { raw = JSON.stringify(value); } catch (e) { return false; }
delete cache[key];
try {
localStorage.setItem(key, raw);
cache[key] = { raw, value };
return true;
} catch (e) { return false; }
}
function localDay(value) {
const d = value ? new Date(value) : new Date();
if (isNaN(d.getTime())) return '';
const p = n => String(n).padStart(2, '0');
return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function dayBefore(n) {
const d = new Date();
d.setHours(12, 0, 0, 0);
d.setDate(d.getDate() - n);
return localDay(d);
}
function dayAhead(n) { return dayBefore(-n); }
const DEFAULT_SETTINGS = {
layout: 'jis',
keyboard: true,
fingerGuide: true,
keyLabels: true,
romajiHint: true,
sound: true,
bigText: false,
strict: true,
retry: true,
hands: true,
buddy: true,
buddyJob: 'random',
assist: 'custom',
theme: 'auto'
};
const ASSIST_LEVELS = [
{ keyboard: true, fingerGuide: true, keyLabels: true, nextGlow: true, romajiHint: true },
{ keyboard: true, fingerGuide: true, keyLabels: true, nextGlow: true, romajiHint: false },
{ keyboard: true, fingerGuide: false, keyLabels: false, nextGlow: true, romajiHint: false },
{ keyboard: false, fingerGuide: false, keyLabels: false, nextGlow: false, romajiHint: false }
];
const ASSIST_LABELS = ['ぜんぶ 見える', 'ゆびの 色だけ', 'ばしょだけ', 'なにも 出ない'];
function autoAssist(ctx) {
const m = ctx && typeof ctx.stageMastery === 'number' ? ctx.stageMastery : null;
if (m === null) return 0;
let level = m < 0.35 ? 0 : (m < 0.60 ? 1 : (m < 0.85 ? 2 : 3));
if (level >= 2 && !(ctx && ctx.everThreeStars)) level = 1;
return level;
}
function resolveAssist(settings, ctx) {
const c = ctx || {};
if (c.blind) {
return {
keyboard: false, fingerGuide: false, keyLabels: false, nextGlow: false,
romajiHint: false, fingerWords: false, level: 'blind'
};
}
let level = settings.assist;
if (level === 'auto') level = autoAssist(c);
if (typeof level !== 'number' || level < 0 || level >= ASSIST_LEVELS.length) {
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
level,
auto: settings.assist === 'auto'
});
}
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
const ASSIST_OWNED = ['keyboard', 'fingerGuide', 'keyLabels', 'romajiHint'];
function setSetting(name, value) {
const s = getSettings();
s[name] = value;
if (ASSIST_OWNED.indexOf(name) >= 0) s.assist = 'custom';
write(KEYS.settings, s);
return s;
}
function getProgress() { return read(KEYS.progress, {}); }
const MIN_RECORD_KEYS = 20;
function lapAdvance(cur, delta, lapNeed) {
const need = Math.max(1, Math.round(lapNeed || 1));
const add = (a, b) => Math.max(0, Math.round(a || 0)) + Math.max(0, Math.round(b || 0));
cur.lapItems = add(cur.lapItems, delta.items);
cur.lapCorrect = add(cur.lapCorrect, delta.correct);
cur.lapTotal = add(cur.lapTotal, delta.total);
const acc = cur.lapTotal > 0 ? (cur.lapCorrect / cur.lapTotal) * 100 : 0;
const lapResult = delta.byItem
? { accuracy: acc }
: { accuracy: acc, correctKeys: cur.lapCorrect, totalKeys: cur.lapTotal };
const laps = [];
let guard = 0;
while (cur.lapItems >= need && guard++ < 200) {
laps.push(starsOf(lapResult));
cur.lapItems -= need;
}
if (laps.length > 0) { cur.lapCorrect = 0; cur.lapTotal = 0; }
return laps;
}
function lapStarsPreview(stageId, delta) {
const p = getProgress()[stageId] || {};
const n = v => Math.max(0, Math.round(v || 0));
const correct = n(p.lapCorrect) + n((delta || {}).correct);
const total = n(p.lapTotal) + n((delta || {}).total);
const accuracy = total > 0 ? (correct / total) * 100 : 0;
return (delta || {}).byItem
? starsOf({ accuracy })
: starsOf({ accuracy, correctKeys: correct, totalKeys: total });
}
const REVIEW_DAYS = [1, 3, 7, 14, 30];
const REVIEW_SEED_DAYS = 7;
function scheduleReview(cur, stars) {
const box = Math.max(0, Math.min(REVIEW_DAYS.length, cur.box || 0));
const next = stars >= 2 ? Math.min(box + 1, REVIEW_DAYS.length) : 1;
cur.box = next;
cur.due = dayAhead(REVIEW_DAYS[next - 1]);
return cur;
}
function dueStages(limit) {
const all = getProgress();
const today = localDay();
const seedBefore = dayBefore(REVIEW_SEED_DAYS);
const out = [];
Object.keys(all).forEach(stageId => {
const p = all[stageId];
if (!p || !(p.clears > 0)) return;
let due = p.due;
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
function applyResult(stageId, result) {
const all = getProgress();
const cur = all[stageId] ||
{ clears: 0, bestKps: 0, bestAccuracy: 0, stars: 0, lastAt: null, lapItems: 0, lapCorrect: 0, lapTotal: 0 };
const before = {
bestKps: cur.bestKps || 0, stars: cur.stars || 0,
clears: cur.clears || 0, rank: cur.rank || 0
};
const lapNeed = Math.max(1, Math.round(result.lapNeed || 1));
const doneItems = Math.max(0, Math.round(result.doneItems || 0));
const byItem = !((result.totalKeys || 0) > 0);
const correctItems = result.correctItems != null
? Math.max(0, Math.min(doneItems, Math.round(result.correctItems)))
: Math.round(doneItems * Math.max(0, Math.min(100, result.accuracy || 0)) / 100);
const delta = byItem
? { items: doneItems, correct: correctItems, total: doneItems, byItem: true }
: { items: doneItems, correct: result.correctKeys, total: result.totalKeys };
const sumCorrect = Math.max(0, Math.round(cur.lapCorrect || 0)) + Math.max(0, Math.round(delta.correct || 0));
const sumTotal = Math.max(0, Math.round(cur.lapTotal || 0)) + Math.max(0, Math.round(delta.total || 0));
const lapAccuracy = sumTotal > 0 ? (sumCorrect / sumTotal) * 100 : 0;
const laps = lapAdvance(cur, delta, lapNeed);
let lapStars = null;
if (laps.length > 0) {
const seen = Math.max(0, Math.min(3, Math.round(result.lapStarsSeen || 0)));
const best = Math.max(laps.reduce((a, b) => Math.max(a, b), 0), seen);
lapStars = best;
cur.clears = before.clears + laps.length;
cur.stars = Math.max(before.stars, best);
scheduleReview(cur, best);
}
const enough = (result.totalKeys || 0) > 0
? (result.totalKeys >= MIN_RECORD_KEYS)
: laps.length > 0;
if (enough) {
cur.bestKps = Math.max(before.bestKps, result.kps || 0);
cur.bestAccuracy = Math.max(cur.bestAccuracy || 0, result.accuracy || 0);
}
const lapRank = (laps.length > 0 && enough)
? rankOf({ stars: lapStars, kps: result.kps, hintStrength: result.hintStrength })
: 0;
if (lapRank > 0) cur.rank = Math.max(before.rank, lapRank);
cur.lastAt = result.finishedAt;
all[stageId] = cur;
write(KEYS.progress, all);
return {
best: cur,
laps: laps.length,
lapStars,
lapAccuracy,
lapItems: cur.lapItems,
lapNeed,
firstClear: before.clears === 0 && laps.length > 0,
newBestKps: enough && before.clears > 0 && (result.kps || 0) > before.bestKps + 0.05,
newStars: Math.max(0, (cur.stars || 0) - before.stars),
lapRank,
newRank: Math.max(0, (cur.rank || 0) - before.rank),
prevBestKps: before.bestKps
};
}
function lapState(stageId, lapNeed) {
const need = Math.max(1, Math.round(lapNeed || 1));
const p = getProgress()[stageId] || {};
const items = Math.max(0, Math.min(need - 1, Math.round(p.lapItems || 0)));
return { items, need, ratio: items / need };
}
const STAR_RULES = [
{ stars: 3, accuracy: 98, allow: 1 },
{ stars: 2, accuracy: 92, allow: 2 },
{ stars: 1, accuracy: 80, allow: 3 }
];
function starsOf(result) {
const acc = result.accuracy || 0;
const total = Math.max(0, Math.round(result.totalKeys || 0));
const correct = Math.max(0, Math.min(total, Math.round(result.correctKeys || 0)));
const miss = total > 0 ? total - correct : -1;
for (let i = 0; i < STAR_RULES.length; i++) {
const rule = STAR_RULES[i];
if (acc >= rule.accuracy) return rule.stars;
if (miss >= 0 && miss <= rule.allow) return rule.stars;
}
return 0;
}
const HINT_STEPS = ['ぜんぶ 見える', 'ゆびの 色だけ', 'ばしょだけ', 'なにも 出ない', 'めかくし'];
function hintStrengthOf(view) {
if (!view) return 0;
if (view.level === 'blind' || view.fingerWords === false) return 4;
if (!view.keyboard) return 3;
if (!view.fingerGuide && !view.keyLabels) return 2;
if (!view.romajiHint) return 1;
return 0;
}
const SPEED_RANKS = [
{ rank: 1, kps: 2.0, hint: 1 },
{ rank: 2, kps: 3.0, hint: 2 },
{ rank: 3, kps: 4.0, hint: 3 }
];
function nextRank(rank) {
return SPEED_RANKS.filter(r => r.rank === Math.max(0, Math.round(rank || 0)) + 1)[0] || null;
}
function rankOf(r) {
if ((r.stars || 0) < 3) return 0;
const kps = r.kps || 0;
const hint = Math.max(0, Math.round(r.hintStrength || 0));
let got = 0;
SPEED_RANKS.forEach(step => {
if (kps >= step.kps && hint >= step.hint) got = Math.max(got, step.rank);
});
return got;
}
function getHistory() { return read(KEYS.history, []); }
function trimDetail(list) {
const keepFrom = list.length - DETAIL_MAX;
for (let i = 0; i < keepFrom; i++) {
const h = list[i];
if (!h) continue;
DETAIL_FIELDS.forEach(f => { if (h[f] !== undefined) delete h[f]; });
}
return list;
}
function addHistory(entry) {
const list = trimDetail(getHistory().concat([entry])).slice(-HISTORY_MAX);
if (write(KEYS.history, list)) return { ok: true, trimmed: false };
const lean = list.map(h => {
const copy = Object.assign({}, h);
DETAIL_FIELDS.forEach(f => delete copy[f]);
return copy;
});
if (write(KEYS.history, lean)) return { ok: true, trimmed: true };
if (write(KEYS.history, lean.slice(-Math.floor(HISTORY_MAX / 2)))) {
return { ok: true, trimmed: true };
}
return { ok: false, trimmed: true };
}
function todaySummary() {
const today = localDay();
const list = getHistory().filter(h => localDay(h.at) === today);
const keys = list.reduce((sum, h) => sum + (h.correctKeys || 0), 0);
const ms = list.reduce((sum, h) => sum + (h.elapsedMs || 0), 0);
return { count: list.length, keys, minutes: Math.round(ms / 60000) };
}
function bestOverall() {
const list = getHistory().filter(h => countsAsTyping(h) && h.correctKeys > 0);
if (list.length === 0) return null;
const solid = list.filter(h => (h.totalKeys || 0) >= MIN_RECORD_KEYS);
const kps = solid.reduce((best, h) => Math.max(best, h.kps || 0), 0);
const acc = solid.reduce((best, h) => Math.max(best, h.accuracy || 0), 0);
return { kps, accuracy: acc, count: list.length };
}
function countsAsTyping(entry) {
return entry && entry.mode !== 'shortcut';
}
function practiceDays() {
const seen = {};
getHistory().forEach(h => { const d = localDay(h.at); if (d) seen[d] = true; });
return Object.keys(seen).sort().reverse();
}
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
function missSummary(span) {
const list = getHistory().slice(-(span || 40));
const byKey = {};
const byFinger = {};
list.forEach((h, i) => {
const weight = 1 + i / Math.max(1, list.length);
Object.keys(h.missByKey || {}).forEach(k => { byKey[k] = (byKey[k] || 0) + h.missByKey[k] * weight; });
Object.keys(h.missByFinger || {}).forEach(k => { byFinger[k] = (byFinger[k] || 0) + h.missByFinger[k] * weight; });
});
const sort = map => Object.keys(map).sort((a, b) => map[b] - map[a]);
return { byKey, byFinger, keys: sort(byKey), fingers: sort(byFinger) };
}
const DEFAULT_AWARDS = {
xp: 0,
keys: 0,
sessions: 0,
perfect: 0,
weak: 0,
challenge: 0,
unlocked: {}
};
function getAwards() {
const a = Object.assign({}, DEFAULT_AWARDS, read(KEYS.awards, {}));
a.unlocked = Object.assign({}, a.unlocked);
return a;
}
function saveAwards(a) { return write(KEYS.awards, a); }
function getChallenge() { return read(KEYS.challenge, {}); }
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
function clearRecords() {
[KEYS.progress, KEYS.history, KEYS.awards, KEYS.challenge].forEach(k => {
try { localStorage.removeItem(k); } catch (e) { }
});
}
global.Typa = global.Typa || {};
global.Typa.Store = {
KEYS, HISTORY_MAX, DEFAULT_SETTINGS, getSettings, setSetting,
ASSIST_LEVELS, ASSIST_LABELS, resolveAssist, setAssist, autoAssist,
getProgress, applyResult, starsOf, STAR_RULES, lapAdvance, lapState, lapStarsPreview,
MIN_RECORD_KEYS,
SPEED_RANKS, HINT_STEPS, hintStrengthOf, rankOf, nextRank,
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
