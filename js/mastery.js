/* Typa — src/mastery.js から つくった 配信用です。手で 直さず src/ を 直して npm run build。*/
(function (global) {
'use strict';
const EDGES = [150, 250, 400, 700, 1200];
const BUCKETS = EDGES.length + 1;
const MAX_SAMPLE = 3000;
const MIN_SAMPLES = 8;
const FAST_MS = 250;
const SLOW_MS = 900;
const SLOW_BUCKET = 4;
const BUCKET_EDGES = [
{ min: 0.66, id: 'good', label: 'だいじょうぶ' },
{ min: 0.36, id: 'soso', label: 'もうすこし' },
{ min: 0, id: 'weak', label: 'まだまだ' }
];
const RULE_LABELS = {
sokuon: 'ちいさい つ',
hatsuon: 'ん',
youon: 'ちいさい や ゆ よ',
dakuten: 'てんてん・まる',
gaion: 'ふぁ・てぃ など',
'row-a': 'あ行', 'row-ka': 'か行', 'row-sa': 'さ行', 'row-ta': 'た行',
'row-na': 'な行', 'row-ha': 'は行', 'row-ma': 'ま行', 'row-ya': 'や行',
'row-ra': 'ら行', 'row-wa': 'わ行'
};
const RULE_TO_SKILL = {
sokuon: 'sokuon',
hatsuon: 'hatsuon-n',
youon: 'youon',
dakuten: 'dakuten',
gaion: 'romaji-mixed',
'row-a': 'row-a', 'row-ka': 'row-ka', 'row-sa': 'row-sa', 'row-ta': 'row-ta',
'row-na': 'row-na-ha', 'row-ha': 'row-na-ha',
'row-ma': 'row-ma-wa', 'row-ya': 'row-ma-wa',
'row-ra': 'row-ma-wa', 'row-wa': 'row-ma-wa'
};
function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
function bucketOf(ms) {
for (let i = 0; i < EDGES.length; i++) if (ms < EDGES[i]) return i;
return EDGES.length;
}
function medianFrom(counts) {
let total = 0;
for (let i = 0; i < counts.length; i++) total += counts[i] || 0;
if (total <= 0) return 0;
const half = total / 2;
let seen = 0;
for (let i = 0; i < counts.length; i++) {
const n = counts[i] || 0;
if (seen + n >= half) {
const lo = i === 0 ? 0 : EDGES[i - 1];
const hi = i < EDGES.length ? EDGES[i] : EDGES[EDGES.length - 1] * 2;
if (n <= 0) return lo;
return Math.round(lo + (hi - lo) * ((half - seen) / n));
}
seen += n;
}
return EDGES[EDGES.length - 1];
}
function slowRateFrom(counts) {
let total = 0;
let slow = 0;
for (let i = 0; i < counts.length; i++) {
const n = counts[i] || 0;
total += n;
if (i >= SLOW_BUCKET) slow += n;
}
return total > 0 ? slow / total : 0;
}
function masteryOf(stat) {
if (!stat || stat.n < MIN_SAMPLES) return null;
const errRate = stat.n > 0 ? stat.misses / stat.n : 0;
const accScore = clamp01(1 - errRate / 0.15);
const speedScore = stat.medianMs > 0
? clamp01((SLOW_MS - stat.medianMs) / (SLOW_MS - FAST_MS))
: 0;
return clamp01(0.6 * accScore + 0.4 * speedScore);
}
function labelOf(mastery) {
if (mastery === null || mastery === undefined) return 'まだ わからない';
for (const b of BUCKET_EDGES) if (mastery >= b.min) return b.label;
return BUCKET_EDGES[BUCKET_EDGES.length - 1].label;
}
function idOf(mastery) {
if (mastery === null || mastery === undefined) return 'unknown';
for (const b of BUCKET_EDGES) if (mastery >= b.min) return b.id;
return 'weak';
}
function weightAt(i, len) { return 1 + i / Math.max(1, len); }
function keySummary(history, span) {
const list = (history || []).slice(-(span || 40));
const byKey = {};
const pairCount = {};
function slot(ch) {
if (!byKey[ch]) byKey[ch] = { n: 0, misses: 0, counts: new Array(BUCKETS).fill(0) };
return byKey[ch];
}
list.forEach((h, i) => {
const w = weightAt(i, list.length);
const lat = h.lat || {};
Object.keys(lat).forEach(ch => {
const arr = lat[ch];
if (!Array.isArray(arr)) return;
const s = slot(ch);
for (let b = 0; b < BUCKETS && b < arr.length; b++) {
const n = arr[b] || 0;
s.counts[b] += n * w;
s.n += n * w;
}
});
Object.keys(h.missByKey || {}).forEach(ch => {
const s = slot(ch);
s.misses += h.missByKey[ch] * w;
s.n += h.missByKey[ch] * w;
});
Object.keys(h.conf || {}).forEach(pair => {
pairCount[pair] = (pairCount[pair] || 0) + h.conf[pair] * w;
});
});
const weak = [];
const slow = [];
Object.keys(byKey).forEach(ch => {
const s = byKey[ch];
s.errRate = s.n > 0 ? s.misses / s.n : 0;
s.medianMs = medianFrom(s.counts);
s.slowRate = slowRateFrom(s.counts);
s.mastery = masteryOf(s);
s.label = labelOf(s.mastery);
if (s.mastery !== null && s.mastery < BUCKET_EDGES[1].min) weak.push(ch);
if (s.n >= 12 && s.errRate < 0.05 && s.slowRate > 0.35) slow.push(ch);
});
weak.sort((a, b) => byKey[a].mastery - byKey[b].mastery);
slow.sort((a, b) => byKey[b].medianMs - byKey[a].medianMs);
const pairs = Object.keys(pairCount)
.map(p => {
const [from, to] = p.split('>');
return { from, to, n: pairCount[p] };
})
.filter(p => p.from && p.to && p.from !== p.to)
.sort((a, b) => b.n - a.n);
return { byKey, weak, slow, pairs };
}
function ruleSummary(history, span) {
const list = (history || []).slice(-(span || 40));
const acc = {};
list.forEach((h, i) => {
const w = weightAt(i, list.length);
const r = h.rule || {};
Object.keys(r).forEach(rule => {
const pair = r[rule];
if (!Array.isArray(pair)) return;
if (!acc[rule]) acc[rule] = { total: 0, miss: 0 };
acc[rule].total += (pair[0] || 0) * w;
acc[rule].miss += (pair[1] || 0) * w;
});
});
return Object.keys(acc)
.map(rule => {
const a = acc[rule];
return {
rule,
label: RULE_LABELS[rule] || rule,
total: a.total,
miss: a.miss,
errRate: a.total > 0 ? a.miss / a.total : 0
};
})
.sort((a, b) => b.errRate - a.errRate);
}
function weakRules(history, span) {
return ruleSummary(history, span).filter(r => r.total >= 20 && r.errRate >= 0.15);
}
const SAFE_KEY = /^[a-z0-9;,./-]$/;
function weakTargets(history, span) {
const keys = keySummary(history, span);
const weak = keys.weak.filter(k => SAFE_KEY.test(k));
const slow = keys.slow.filter(k => SAFE_KEY.test(k) && weak.indexOf(k) < 0);
const pairs = keys.pairs.filter(p => SAFE_KEY.test(p.from) && SAFE_KEY.test(p.to));
return { keys: weak, slow, pairs, ready: weak.length >= 2 || pairs.length >= 1 };
}
function keysOfStage(stage) {
const seen = {};
(stage && stage.items ? stage.items : []).forEach(item => {
global.Typa.Romaji.buildChunks(item.k).forEach(c => {
const cand = c.cands && c.cands[0] ? c.cands[0] : '';
for (const ch of cand) if (SAFE_KEY.test(ch)) seen[ch] = true;
});
});
return Object.keys(seen);
}
function stageMastery(byKey, stage) {
const keys = keysOfStage(stage);
let sum = 0;
let n = 0;
keys.forEach(ch => {
const s = byKey[ch];
if (!s || s.mastery === null || s.mastery === undefined) return;
sum += s.mastery;
n++;
});
if (n === 0 || n < keys.length / 2) return null;
return sum / n;
}
global.Typa = global.Typa || {};
global.Typa.Mastery = {
keysOfStage, stageMastery,
EDGES, BUCKETS, MAX_SAMPLE, MIN_SAMPLES, BUCKET_EDGES, RULE_LABELS, RULE_TO_SKILL, SAFE_KEY,
bucketOf, medianFrom, slowRateFrom, masteryOf, labelOf, idOf,
keySummary, ruleSummary, weakRules, weakTargets
};
})(window);
