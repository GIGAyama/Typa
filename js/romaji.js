/* Typa — src/romaji.js から つくった 配信用です。手で 直さず src/ を 直して npm run build。*/
(function (global) {
'use strict';
const KANA = {
'あ': ['a'], 'い': ['i', 'yi'], 'う': ['u', 'wu'], 'え': ['e'], 'お': ['o'],
'か': ['ka', 'ca'], 'き': ['ki'], 'く': ['ku', 'cu', 'qu'], 'け': ['ke'], 'こ': ['ko', 'co'],
'が': ['ga'], 'ぎ': ['gi'], 'ぐ': ['gu'], 'げ': ['ge'], 'ご': ['go'],
'さ': ['sa'], 'し': ['si', 'shi', 'ci'], 'す': ['su'], 'せ': ['se', 'ce'], 'そ': ['so'],
'ざ': ['za'], 'じ': ['zi', 'ji'], 'ず': ['zu'], 'ぜ': ['ze'], 'ぞ': ['zo'],
'た': ['ta'], 'ち': ['ti', 'chi'], 'つ': ['tu', 'tsu'], 'て': ['te'], 'と': ['to'],
'だ': ['da'], 'ぢ': ['di'], 'づ': ['du'], 'で': ['de'], 'ど': ['do'],
'な': ['na'], 'に': ['ni'], 'ぬ': ['nu'], 'ね': ['ne'], 'の': ['no'],
'は': ['ha'], 'ひ': ['hi'], 'ふ': ['hu', 'fu'], 'へ': ['he'], 'ほ': ['ho'],
'ば': ['ba'], 'び': ['bi'], 'ぶ': ['bu'], 'べ': ['be'], 'ぼ': ['bo'],
'ぱ': ['pa'], 'ぴ': ['pi'], 'ぷ': ['pu'], 'ぺ': ['pe'], 'ぽ': ['po'],
'ま': ['ma'], 'み': ['mi'], 'む': ['mu'], 'め': ['me'], 'も': ['mo'],
'や': ['ya'], 'ゆ': ['yu'], 'よ': ['yo'],
'ら': ['ra'], 'り': ['ri'], 'る': ['ru'], 'れ': ['re'], 'ろ': ['ro'],
'わ': ['wa'], 'ゐ': ['wi'], 'ゑ': ['we'], 'を': ['wo'],
'ゔ': ['vu'],
'ぁ': ['xa', 'la'], 'ぃ': ['xi', 'li'], 'ぅ': ['xu', 'lu'], 'ぇ': ['xe', 'le'], 'ぉ': ['xo', 'lo'],
'ゃ': ['xya', 'lya'], 'ゅ': ['xyu', 'lyu'], 'ょ': ['xyo', 'lyo'], 'ゎ': ['xwa', 'lwa'],
'ー': ['-'], '、': [','], '。': ['.'], '・': ['/'], '「': ['['], '」': [']'],
'　': [' '], ' ': [' ']
};
const KANA2 = {
'きゃ': ['kya'], 'きぃ': ['kyi'], 'きゅ': ['kyu'], 'きぇ': ['kye'], 'きょ': ['kyo'],
'ぎゃ': ['gya'], 'ぎぃ': ['gyi'], 'ぎゅ': ['gyu'], 'ぎぇ': ['gye'], 'ぎょ': ['gyo'],
'しゃ': ['sya', 'sha'], 'しゅ': ['syu', 'shu'], 'しぇ': ['sye', 'she'], 'しょ': ['syo', 'sho'],
'じゃ': ['zya', 'ja', 'jya'], 'じゅ': ['zyu', 'ju', 'jyu'],
'じぇ': ['zye', 'je', 'jye'], 'じょ': ['zyo', 'jo', 'jyo'],
'ちゃ': ['tya', 'cha', 'cya'], 'ちゅ': ['tyu', 'chu', 'cyu'],
'ちぇ': ['tye', 'che', 'cye'], 'ちょ': ['tyo', 'cho', 'cyo'],
'ぢゃ': ['dya'], 'ぢゅ': ['dyu'], 'ぢょ': ['dyo'],
'にゃ': ['nya'], 'にぃ': ['nyi'], 'にゅ': ['nyu'], 'にぇ': ['nye'], 'にょ': ['nyo'],
'ひゃ': ['hya'], 'ひゅ': ['hyu'], 'ひぇ': ['hye'], 'ひょ': ['hyo'],
'びゃ': ['bya'], 'びゅ': ['byu'], 'びょ': ['byo'],
'ぴゃ': ['pya'], 'ぴゅ': ['pyu'], 'ぴょ': ['pyo'],
'みゃ': ['mya'], 'みゅ': ['myu'], 'みょ': ['myo'],
'りゃ': ['rya'], 'りゅ': ['ryu'], 'りぇ': ['rye'], 'りょ': ['ryo'],
'ふぁ': ['fa'], 'ふぃ': ['fi'], 'ふぇ': ['fe'], 'ふぉ': ['fo'], 'ふゅ': ['fyu'],
'ゔぁ': ['va'], 'ゔぃ': ['vi'], 'ゔぇ': ['ve'], 'ゔぉ': ['vo'],
'てぃ': ['thi'], 'でぃ': ['dhi'], 'とぅ': ['twu'], 'どぅ': ['dwu'],
'うぃ': ['wi', 'whi'], 'うぇ': ['we', 'whe'], 'うぉ': ['who'],
'つぁ': ['tsa'], 'つぃ': ['tsi'], 'つぇ': ['tse'], 'つぉ': ['tso']
};
const SOKUON = ['xtu', 'ltu', 'xtsu', 'ltsu'];
const SMALL_Y = 'ゃゅょ';
const SMALL_V = 'ぁぃぅぇぉ';
const DAKUTEN = 'がぎぐげござじずぜぞだぢづでどばびぶべぼゔぱぴぷぺぽ';
const ROW_OF_HEAD = {
a: 'row-a', i: 'row-a', u: 'row-a', e: 'row-a', o: 'row-a',
k: 'row-ka', g: 'row-ka', c: 'row-ka', q: 'row-ka',
s: 'row-sa', z: 'row-sa', j: 'row-sa',
t: 'row-ta', d: 'row-ta',
n: 'row-na',
h: 'row-ha', b: 'row-ha', p: 'row-ha', f: 'row-ha',
m: 'row-ma', y: 'row-ya', r: 'row-ra', w: 'row-wa', v: 'row-wa'
};
function ruleOf(kana, cand) {
if (!kana) return 'raw';
if (kana.indexOf('っ') >= 0) return 'sokuon';
if (kana === 'ん') return 'hatsuon';
if (kana.length === 2 && SMALL_Y.indexOf(kana[1]) >= 0) return 'youon';
if (kana.length === 2 && SMALL_V.indexOf(kana[1]) >= 0) return 'gaion';
if (kana.length === 1 && DAKUTEN.indexOf(kana) >= 0) return 'dakuten';
if (kana.length === 1 && KANA[kana]) {
const row = ROW_OF_HEAD[(cand || '').charAt(0)];
return row || 'kigou';
}
return 'raw';
}
function toHiragana(text) {
return String(text).replace(/[ァ-ヶ]/g, ch =>
String.fromCharCode(ch.charCodeAt(0) - 0x60));
}
const VOWELS = 'aiueo';
function buildChunks(text) {
const src = toHiragana(text);
const raw = [];
for (let i = 0; i < src.length;) {
const pair = src.substr(i, 2);
if (KANA2[pair]) { raw.push({ kana: pair, cands: KANA2[pair].slice() }); i += 2; continue; }
const ch = src[i];
if (ch === 'っ') { raw.push({ kana: 'っ', cands: null, sokuon: true }); i += 1; continue; }
if (KANA[ch]) { raw.push({ kana: ch, cands: KANA[ch].slice() }); i += 1; continue; }
raw.push({ kana: ch, cands: [ch] });
i += 1;
}
const chunks = [];
for (let i = raw.length - 1; i >= 0; i--) {
const cur = raw[i];
const next = chunks[0] || null;
if (cur.sokuon) {
if (!next) { chunks.unshift({ kana: 'っ', cands: SOKUON.slice() }); continue; }
const doubled = next.cands
.filter(c => c.length > 0 && VOWELS.indexOf(c[0]) < 0 && c[0] !== 'n' && /[a-z]/.test(c[0]))
.map(c => c[0] + c);
const alone = SOKUON.map(s => s + next.cands[0]);
const cands = doubled.concat(alone);
chunks.shift();
chunks.unshift({ kana: 'っ' + next.kana, cands: cands.length ? cands : alone });
continue;
}
if (cur.kana === 'ん') {
const cands = ['nn', "n'", 'xn'];
const head = next && next.cands[0] ? next.cands[0][0] : '';
if (head && VOWELS.indexOf(head) < 0 && head !== 'n' && head !== 'y') cands.unshift('n');
chunks.unshift({ kana: 'ん', cands });
continue;
}
chunks.unshift({ kana: cur.kana, cands: cur.cands });
}
chunks.forEach(c => { c.rule = ruleOf(c.kana, c.cands[0]); });
return chunks;
}
function createMatcher(text) {
const chunks = buildChunks(text);
let index = 0;
let buffer = '';
let typed = '';
function alive(buf) {
const c = chunks[index];
return c ? c.cands.filter(cand => cand.indexOf(buf) === 0) : [];
}
function completable() {
const c = chunks[index];
return !!c && buffer !== '' && c.cands.indexOf(buffer) >= 0;
}
function finished() { return index >= chunks.length; }
function expectedInfo() {
if (finished()) return { ch: '', rule: '', kana: '' };
const cur = chunks[index];
const list = alive(buffer);
const cand = list[0] || cur.cands[0];
const ch = cand.charAt(buffer.length);
if (ch) return { ch, rule: cur.rule, kana: cur.kana };
const next = chunks[index + 1];
if (!next || !next.cands[0]) return { ch: '', rule: '', kana: '' };
return { ch: next.cands[0].charAt(0), rule: next.rule, kana: next.kana };
}
function expected() { return expectedInfo().ch; }
function hint() {
let rest = '';
if (!finished()) {
const list = alive(buffer);
const cand = list[0] || chunks[index].cands[0];
rest += cand.slice(buffer.length);
}
for (let i = index + 1; i < chunks.length; i++) rest += chunks[i].cands[0];
return { done: typed + buffer, rest };
}
function commit() {
typed += buffer;
buffer = '';
index++;
}
function input(key) {
if (finished()) return { ok: false, chunkDone: false, finished: true };
const list = alive(buffer + key);
if (list.length > 0) {
buffer += key;
let chunkDone = false;
if (list.indexOf(buffer) >= 0 && list.every(c => c.length === buffer.length)) {
commit();
chunkDone = true;
}
return { ok: true, chunkDone, finished: finished() };
}
if (completable() && index + 1 < chunks.length) {
const nextChunk = chunks[index + 1];
if (nextChunk.cands.some(cand => cand.indexOf(key) === 0)) {
commit();
return input(key);
}
}
return { ok: false, chunkDone: false, finished: false };
}
function kanaDone() {
let n = 0;
for (let i = 0; i < index && i < chunks.length; i++) n += chunks[i].kana.length;
return n;
}
return {
chunks,
input,
hint,
expected,
expectedInfo,
kanaDone,
isFinished: finished,
canFinishHere: () => finished() || (index === chunks.length - 1 && completable()),
length: () => chunks.reduce((sum, c) => sum + c.cands[0].length, 0)
};
}
const TABLE = [
{ title: 'あ行', kana: ['あ', 'い', 'う', 'え', 'お'] },
{ title: 'か行', kana: ['か', 'き', 'く', 'け', 'こ'] },
{ title: 'さ行', kana: ['さ', 'し', 'す', 'せ', 'そ'] },
{ title: 'た行', kana: ['た', 'ち', 'つ', 'て', 'と'] },
{ title: 'な行', kana: ['な', 'に', 'ぬ', 'ね', 'の'] },
{ title: 'は行', kana: ['は', 'ひ', 'ふ', 'へ', 'ほ'] },
{ title: 'ま行', kana: ['ま', 'み', 'む', 'め', 'も'] },
{ title: 'や行', kana: ['や', 'ゆ', 'よ'] },
{ title: 'ら行', kana: ['ら', 'り', 'る', 'れ', 'ろ'] },
{ title: 'わ行・ん', kana: ['わ', 'を', 'ん'],
note: '「ん」は n を 2かい 打つと かならず 出ます。' },
{ title: 'が行', kana: ['が', 'ぎ', 'ぐ', 'げ', 'ご'] },
{ title: 'ざ行', kana: ['ざ', 'じ', 'ず', 'ぜ', 'ぞ'] },
{ title: 'だ行', kana: ['だ', 'ぢ', 'づ', 'で', 'ど'] },
{ title: 'ば行', kana: ['ば', 'び', 'ぶ', 'べ', 'ぼ'] },
{ title: 'ぱ行', kana: ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'] },
{ title: 'きゃ・ぎゃ', kana: ['きゃ', 'きゅ', 'きょ', 'ぎゃ', 'ぎゅ', 'ぎょ'] },
{ title: 'しゃ・じゃ', kana: ['しゃ', 'しゅ', 'しょ', 'じゃ', 'じゅ', 'じょ'] },
{ title: 'ちゃ・にゃ', kana: ['ちゃ', 'ちゅ', 'ちょ', 'にゃ', 'にゅ', 'にょ'] },
{ title: 'ひゃ・びゃ・ぴゃ', kana: ['ひゃ', 'ひゅ', 'ひょ', 'びゃ', 'びゅ', 'びょ', 'ぴゃ', 'ぴゅ', 'ぴょ'] },
{ title: 'みゃ・りゃ', kana: ['みゃ', 'みゅ', 'みょ', 'りゃ', 'りゅ', 'りょ'] },
{ title: 'ちいさい 字', kana: ['ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゃ', 'ゅ', 'ょ', 'っ'],
note: '「っ」は、つぎの 字の さいしょを 2かい 打つのが かんたんです（きって → kitte）。' },
{ title: 'きごう', kana: ['ー', '、', '。', '・'] }
];
function candidatesOf(kana) {
if (kana === 'ん') return ['nn', "n'"];
if (kana === 'っ') return SOKUON.slice(0, 2);
return (KANA2[kana] || KANA[kana] || []).slice();
}
global.Typa = global.Typa || {};
global.Typa.Romaji = { buildChunks, createMatcher, toHiragana, candidatesOf, ruleOf, KANA, KANA2, SOKUON, TABLE };
})(window);
