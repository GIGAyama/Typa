/* Typa — src/studyLog.js から つくった 配信用です。手で 直さず src/ を 直して npm run build。*/
(function (global) {
'use strict';
const LOGIC_VERSION = '1.1';
const STUDY_LOG_KEY = 'study.records.v1';
const STUDY_LOG_MAX = 500;
const STUDY_ITEMS_MAX = 200;
const uuid = () =>
(global.crypto && global.crypto.randomUUID
? global.crypto.randomUUID()
: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
const r = (Math.random() * 16) | 0;
return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
}));
const sanitizeWrong = (v) =>
typeof v === 'string' && v.length <= 12 && !/[<>{}\\]/.test(v) ? v : null;
function saveStudyRecord(rec) {
try {
if (!rec || !rec.appId || !rec.unit || !rec.unit.id) return null;
if (typeof rec.elapsedMs !== 'number' || rec.elapsedMs < 0) return null;
if (!rec.summary || typeof rec.summary.count !== 'number') return null;
const items = Array.isArray(rec.items)
? rec.items.slice(0, STUDY_ITEMS_MAX).map((it) => Object.assign({}, it, {
wrong: Array.isArray(it.wrong)
? it.wrong.map(sanitizeWrong).filter(Boolean)
: undefined
}))
: undefined;
const entry = Object.assign({
schema: 'study.v1',
id: uuid(),
kind: 'session',
source: 'course',
multiplayer: false,
grading: 'objective',
status: 'completed',
timeBasis: 'app'
}, rec, {
items: items,
elapsedMs: Math.round(rec.elapsedMs)
});
const raw = localStorage.getItem(STUDY_LOG_KEY);
let log = [];
if (raw) {
try {
const parsed = JSON.parse(raw);
if (Array.isArray(parsed)) log = parsed;
} catch (e) { }
}
log.push(entry);
if (log.length > STUDY_LOG_MAX) log.splice(0, log.length - STUDY_LOG_MAX);
localStorage.setItem(STUDY_LOG_KEY, JSON.stringify(log));
return entry.id;
} catch (e) {
console.warn('[studyLog] save failed', e);
return null;
}
}
global.StudyLog = {
LOGIC_VERSION, STUDY_LOG_KEY, STUDY_LOG_MAX, STUDY_ITEMS_MAX, saveStudyRecord
};
})(typeof globalThis !== 'undefined' ? globalThis : window);
