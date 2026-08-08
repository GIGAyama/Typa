/* Typa — src/studyStats.js から つくった 配信用です。手で 直さず src/ を 直して npm run build。*/
(function (global) {
'use strict';
const T = global.Typa;
const KEY = 'study.records.v1';
const APP_ID = 'typa';
function loadRecords(appId) {
try {
const raw = localStorage.getItem(KEY);
if (!raw) return [];
const log = JSON.parse(raw);
if (!Array.isArray(log)) return [];
return log
.filter(r => r && r.schema === 'study.v1' && r.appId === (appId || APP_ID))
.reverse();
} catch (e) {
return [];
}
}
function scorable(r) {
return !!r && r.grading === 'objective' && !r.multiplayer &&
!!r.summary && (r.summary.attempted || 0) > 0;
}
function attemptedOf(r) {
const t = r.ext && r.ext.itemsTruncated;
return t ? (t.attempted || 0) : ((r.summary && r.summary.attempted) || 0);
}
function firstTryOf(r) {
const t = r.ext && r.ext.itemsTruncated;
return t ? (t.firstTryCorrect || 0) : ((r.summary && r.summary.firstTryCorrect) || 0);
}
function summary(days, records) {
const list = records || loadRecords();
const from = T.Store.dayBefore(Math.max(0, (days || 7) - 1));
const out = {
sessions: 0, items: 0, activeMs: 0, minutes: 0,
attempted: 0, firstTryCorrect: 0, rate: null
};
list.forEach(r => {
if (T.Store.localDay(r.startedAt) < from) return;
out.sessions++;
out.items += (r.summary && r.summary.count) || 0;
out.activeMs += r.activeMs || 0;
if (!scorable(r)) return;
out.attempted += attemptedOf(r);
out.firstTryCorrect += firstTryOf(r);
});
out.minutes = Math.round(out.activeMs / 60000);
if (out.attempted > 0) out.rate = (out.firstTryCorrect / out.attempted) * 100;
return out;
}
function byUnit(minAttempted, records) {
const list = records || loadRecords();
const map = {};
list.forEach(r => {
if (!scorable(r) || !r.unit || !r.unit.id) return;
const cur = map[r.unit.id] ||
(map[r.unit.id] = { id: r.unit.id, title: r.unit.title || r.unit.id,
attempted: 0, firstTryCorrect: 0, sessions: 0, lastAt: '' });
cur.attempted += attemptedOf(r);
cur.firstTryCorrect += firstTryOf(r);
cur.sessions++;
if (!cur.lastAt || (r.startedAt || '') > cur.lastAt) cur.lastAt = r.startedAt || '';
});
const need = Math.max(1, minAttempted || 1);
return Object.keys(map)
.map(id => {
const u = map[id];
u.rate = (u.firstTryCorrect / u.attempted) * 100;
return u;
})
.filter(u => u.attempted >= need)
.sort((a, b) => a.rate - b.rate);
}
global.Typa = global.Typa || {};
global.Typa.StudyStats = { loadRecords, summary, byUnit, scorable };
})(window);
