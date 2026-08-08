/* Typa — src/backup.js から つくった 配信用です。手で 直さず src/ を 直して npm run build。*/
(function (global) {
'use strict';
const T = global.Typa;
const SCHEMA = 1;
function keyList() {
const K = T.Store.KEYS;
return [K.settings, K.progress, K.history, K.awards, K.challenge];
}
function buildExport(appVersion) {
const data = {};
keyList().forEach(key => {
let raw = null;
try { raw = localStorage.getItem(key); } catch (e) { raw = null; }
if (raw === null) return;
try { data[key] = JSON.parse(raw); } catch (e) { }
});
return {
app: 'Typa',
schema: SCHEMA,
appVersion: appVersion || '',
exportedAt: new Date().toISOString(),
data
};
}
function toText(obj) { return JSON.stringify(obj, null, 1); }
function fileName() {
return `typa-きろく-${T.Store.localDay()}.json`;
}
function download(text, name) {
try {
const blob = new Blob([text], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = name || fileName();
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { } }, 4000);
return true;
} catch (e) { return false; }
}
function copyText(text) {
if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) {
return navigator.clipboard.writeText(text).then(() => true, () => fallbackCopy(text));
}
return Promise.resolve(fallbackCopy(text));
}
function fallbackCopy(text) {
try {
const ta = document.createElement('textarea');
ta.value = text;
ta.setAttribute('readonly', '');
ta.style.position = 'fixed';
ta.style.left = '-9999px';
document.body.appendChild(ta);
ta.select();
const ok = document.execCommand('copy');
document.body.removeChild(ta);
return !!ok;
} catch (e) { return false; }
}
function isObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }
const SETTING_VALUES = {
assist: v => v === 'auto' || v === 'custom' ||
(typeof v === 'number' && Number.isInteger(v) &&
v >= 0 && v < T.Store.ASSIST_LEVELS.length),
theme: v => v === 'auto' || v === 'light' || v === 'dark',
layout: v => typeof v === 'string' &&
Object.prototype.hasOwnProperty.call(T.Layout.LAYOUTS, v)
};
function settingOk(name, value) {
const rule = SETTING_VALUES[name];
if (rule) return !!rule(value);
return typeof value === typeof T.Store.DEFAULT_SETTINGS[name];
}
function parseImport(text) {
let obj;
try { obj = JSON.parse(text); }
catch (e) { return bad('この ファイルは Typa の きろくでは ないみたい。'); }
if (!isObject(obj)) return bad('この ファイルは Typa の きろくでは ないみたい。');
if (obj.app !== 'Typa') return bad('Typa の きろくでは ないみたい。べつの ファイルを えらんでね。');
if (typeof obj.schema !== 'number') return bad('この ファイルは こわれて いるみたい。');
if (obj.schema > SCHEMA) {
return bad('あたらしい Typa で 作った ファイルみたい。アプリを 新しく してから 読みこんでね。');
}
if (!isObject(obj.data)) return bad('この ファイルには きろくが 入って いないみたい。');
const K = T.Store.KEYS;
const clean = {};
const d = obj.data;
if (isObject(d[K.settings])) {
const src = d[K.settings];
const out = {};
Object.keys(T.Store.DEFAULT_SETTINGS).forEach(name => {
if (!Object.prototype.hasOwnProperty.call(src, name)) return;
if (settingOk(name, src[name])) out[name] = src[name];
});
clean[K.settings] = out;
}
if (isObject(d[K.progress])) {
const src = d[K.progress];
const out = {};
Object.keys(src).forEach(id => {
const p = src[id];
if (!isObject(p)) return;
out[id] = {
clears: num(p.clears),
bestKps: num(p.bestKps),
bestAccuracy: num(p.bestAccuracy),
stars: Math.max(0, Math.min(3, num(p.stars))),
rank: Math.max(0, Math.min(3, num(p.rank))),
lastAt: typeof p.lastAt === 'string' ? p.lastAt : null,
lapItems: num(p.lapItems),
lapCorrect: num(p.lapCorrect),
lapTotal: num(p.lapTotal),
box: Math.max(0, Math.min(T.Store.REVIEW_DAYS.length, num(p.box))),
due: typeof p.due === 'string' ? p.due : null
};
});
clean[K.progress] = out;
}
if (Array.isArray(d[K.history])) {
clean[K.history] = d[K.history]
.filter(h => isObject(h) && typeof h.at === 'string')
.slice(-T.Store.HISTORY_MAX);
}
if (isObject(d[K.awards])) {
const a = d[K.awards];
clean[K.awards] = {
xp: num(a.xp), keys: num(a.keys), sessions: num(a.sessions),
perfect: num(a.perfect), weak: num(a.weak), challenge: num(a.challenge),
unlocked: isObject(a.unlocked) ? a.unlocked : {}
};
}
if (isObject(d[K.challenge])) {
const src = d[K.challenge];
const out = {};
Object.keys(src).forEach(id => {
const c = src[id];
if (!isObject(c)) return;
out[id] = { keys: num(c.keys), kps: num(c.kps), accuracy: num(c.accuracy), at: c.at || null };
});
clean[K.challenge] = out;
}
if (Object.keys(clean).length === 0) {
return bad('この ファイルには きろくが 入って いないみたい。');
}
return { ok: true, clean, summary: describe(clean, obj) };
}
function bad(message) { return { ok: false, message }; }
function describe(clean, raw) {
const K = T.Store.KEYS;
const history = clean[K.history] || [];
const progress = clean[K.progress] || {};
const awards = clean[K.awards] || {};
let stars = 0;
Object.keys(progress).forEach(id => { stars += progress[id].stars || 0; });
let last = '';
history.forEach(h => { if (!last || h.at > last) last = h.at; });
return {
sessions: history.length,
stars,
xp: Math.round(awards.xp || 0),
lastAt: last,
exportedAt: (raw && raw.exportedAt) || ''
};
}
function applyImport(clean) {
let ok = true;
keyList().forEach(key => {
try { localStorage.removeItem(key); } catch (e) { ok = false; }
});
Object.keys(clean).forEach(key => {
try { localStorage.setItem(key, JSON.stringify(clean[key])); }
catch (e) { ok = false; }
});
return ok;
}
global.Typa = global.Typa || {};
global.Typa.Backup = {
SCHEMA, buildExport, toText, fileName, download, copyText,
parseImport, describe, applyImport
};
})(window);
