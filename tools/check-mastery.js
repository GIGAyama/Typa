/**
 * =====================================================================
 * check-mastery.js — おぼえぐあいの 数えかたを たしかめる
 * =====================================================================
 * つかいかた:
 *
 *   node tools/check-mastery.js
 *
 * ■ なぜ ひつようか
 * ここが まちがって いても **画面は ふつうに 出ます**。ただ、出て くる
 * にがての 一覧が しずかに でたらめに なり、児童は 関係の ない キーを
 * ずっと 練習しつづけます。数の 話なので 目で 見て 気づけません。
 *
 * とくに 気を つけたい ところ:
 *   1. 数が 少ない キーを「にがて」と 言い切らない
 *   2. 入れものから 出す まん中の 時間が、ほんとうの まん中に 近い
 *   3. あたらしい 回ほど おもく 見る（missSummary と 同じ 重み）
 *   4. きろくが 大きく なりすぎない
 */
'use strict';

const path = require('path');

global.window = global;

const memory = {};
global.localStorage = {
  getItem: k => (Object.prototype.hasOwnProperty.call(memory, k) ? memory[k] : null),
  setItem: (k, v) => { memory[k] = String(v); },
  removeItem: k => { delete memory[k]; }
};

require(path.join(__dirname, '..', 'js', 'romaji.js'));
require(path.join(__dirname, '..', 'js', 'layout.js'));
require(path.join(__dirname, '..', 'js', 'lessons.js'));
require(path.join(__dirname, '..', 'js', 'mastery.js'));
require(path.join(__dirname, '..', 'js', 'store.js'));

const { Mastery, Romaji, Lessons, Layout, Store } = global.Typa;

const problems = [];
let checked = 0;

function ok(cond, what) {
  checked++;
  if (!cond) problems.push(what);
}
function eq(got, want, what) {
  ok(got === want, `${what} … ${JSON.stringify(want)} の はずが ${JSON.stringify(got)}`);
}
function near(got, want, tol, what) {
  ok(Math.abs(got - want) <= tol, `${what} … ${want}±${tol} の はずが ${got}`);
}

/** 打つまでの 時間の 一覧から 入れものの 数を つくります */
function lat(list) {
  const counts = new Array(Mastery.BUCKETS).fill(0);
  list.forEach(ms => counts[Mastery.bucketOf(ms)]++);
  return counts;
}

// ------------------------------------------------------------------
// 1. 入れものと まん中の 時間
// ------------------------------------------------------------------

eq(Mastery.bucketOf(0), 0, '0ms は いちばん 速い 入れもの');
eq(Mastery.bucketOf(149), 0, '149ms は 0番');
eq(Mastery.bucketOf(150), 1, '150ms は 1番');
eq(Mastery.bucketOf(9999), Mastery.BUCKETS - 1, 'とても おそいと いちばん うしろ');
eq(Mastery.medianFrom(new Array(Mastery.BUCKETS).fill(0)), 0, '何も なければ 0');

// 生の 一覧から 出した ほんとうの まん中と くらべます
function trueMedian(list) {
  const s = list.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
[
  [120, 130, 140, 160, 170, 180, 190, 200],
  [200, 210, 220, 230, 300, 310, 320, 900],
  [80, 90, 100, 110, 120, 130, 1400, 2000],
  [500, 510, 520, 530, 540, 550]
].forEach((list, i) => {
  const got = Mastery.medianFrom(lat(list));
  const want = trueMedian(list);
  // 入れものの はばの ぶんだけ ずれます。同じ 入れものの はば いないなら 良しとします
  ok(Math.abs(got - want) <= 160, `まん中の 時間 ${i} … ほんとうは ${want}、出たのは ${got}`);
});

near(Mastery.slowRateFrom(lat([100, 100, 100, 100])), 0, 0.01, '速い だけなら おそい わりあいは 0');
near(Mastery.slowRateFrom(lat([1500, 1500, 100, 100])), 0.5, 0.01, '半分 おそければ 0.5');

// ------------------------------------------------------------------
// 2. 数が 少ない うちは「わからない」
// ------------------------------------------------------------------

eq(Mastery.masteryOf({ n: 3, misses: 3, medianMs: 2000 }), null, '3回では おぼえぐあいを 出さない');
eq(Mastery.masteryOf(null), null, 'からっぽでも 落ちない');
eq(Mastery.labelOf(null), 'まだ わからない', '数が 足りない ときの ことば');
eq(Mastery.idOf(null), 'unknown', '数が 足りない ときの id');

const good = Mastery.masteryOf({ n: 50, misses: 0, medianMs: 200 });
const bad = Mastery.masteryOf({ n: 50, misses: 15, medianMs: 1500 });
const slowOnly = Mastery.masteryOf({ n: 50, misses: 0, medianMs: 1500 });
ok(good > 0.95, `ミス0・速い なら ほぼ 満点 (got ${good})`);
ok(bad < 0.1, `ミスだらけ・おそい なら ほぼ 0 (got ${bad})`);
ok(slowOnly > bad && slowOnly < good, `まちがえないが おそい は その あいだ (got ${slowOnly})`);
ok(slowOnly < 0.7, `まちがえないが おそい を「だいじょうぶ」に しない (got ${slowOnly})`);
eq(Mastery.labelOf(good), 'だいじょうぶ', '高い ときの ことば');
eq(Mastery.labelOf(bad), 'まだまだ', '低い ときの ことば');

// おぼえぐあいは かならず 0〜1
[0, 1, 5, 50, 200].forEach(n => {
  [0, 1, 10, 50].forEach(misses => {
    [0, 100, 900, 3000].forEach(ms => {
      const m = Mastery.masteryOf({ n, misses: Math.min(misses, n), medianMs: ms });
      ok(m === null || (m >= 0 && m <= 1 && !isNaN(m)),
        `おぼえぐあいが はんいの 外 (n=${n} miss=${misses} ms=${ms}) → ${m}`);
    });
  });
});

// ------------------------------------------------------------------
// 3. あたらしい 回ほど おもい
// ------------------------------------------------------------------

function session(missByKey, latMap, conf, rule) {
  return { at: '2026-07-01T00:00:00.000Z', missByKey: missByKey || {}, lat: latMap || {}, conf: conf || {}, rule: rule || {} };
}

// **中身は まったく 同じ**で じゅんばんだけ かえます。
// そうしないと「ミスの 合計が ちがうから」で 差が ついて しまい、
// 重みを ためした ことに なりません。
const missSess = () => session({ d: 10 }, { d: lat([200]) });
const cleanSess = () => session({}, { d: lat([200, 200, 200, 200]) });

const missFirst = [];
for (let i = 0; i < 5; i++) missFirst.push(missSess());
for (let i = 0; i < 5; i++) missFirst.push(cleanSess());

const missLast = [];
for (let i = 0; i < 5; i++) missLast.push(cleanSess());
for (let i = 0; i < 5; i++) missLast.push(missSess());

const oldRate = Mastery.keySummary(missFirst).byKey.d.errRate;
const newRate = Mastery.keySummary(missLast).byKey.d.errRate;
ok(newRate > oldRate,
  `おなじ 中身でも、あたらしい 回の ミスの ほうが おもい (${newRate.toFixed(3)} > ${oldRate.toFixed(3)})`);

// ------------------------------------------------------------------
// 4. 「まちがえないが 手が とまる キー」が 見つかるか
// ------------------------------------------------------------------

const hist = [];
for (let i = 0; i < 12; i++) {
  hist.push(session(
    { q: 2 },
    {
      f: lat([120, 130, 140]),               // 速くて 正しい
      p: lat([1400, 1500, 900]),             // まちがえないが おそい ← これを 見つけたい
      q: lat([300, 300])                     // まちがえる
    },
    { 'd>f': 3 },
    { sokuon: [30, 9], 'row-a': [100, 1] }
  ));
}
const sum = Mastery.keySummary(hist);
ok(sum.slow.indexOf('p') >= 0, 'まちがえないのに おそい キー p が 見つかる');
ok(sum.slow.indexOf('f') < 0, '速い キー f は おそい 一覧に 入れない');
ok(sum.byKey.f.mastery > sum.byKey.p.mastery, 'p より f の ほうが おぼえて いる');
eq(sum.pairs[0].from, 'd', 'とりちがえの もとが d');
eq(sum.pairs[0].to, 'f', 'とりちがえた さきが f');

// ------------------------------------------------------------------
// 5. ローマ字の きまり
// ------------------------------------------------------------------

const rules = Mastery.ruleSummary(hist);
const sokuon = rules.filter(r => r.rule === 'sokuon')[0];
ok(!!sokuon, 'ちいさい つ が 出て くる');
near(sokuon.errRate, 0.3, 0.01, 'ちいさい つ の まちがえる わりあい');
eq(sokuon.label, 'ちいさい つ', 'きまりに ことばの 名前が つく');
const weak = Mastery.weakRules(hist);
ok(weak.some(r => r.rule === 'sokuon'), 'にがてな きまりに 出る');
ok(!weak.some(r => r.rule === 'row-a'), 'よく できて いる きまりは 出さない');

// ふだが かなに 正しく つくか（実際の お題で ためします）
const RULE_CASES = [
  ['きって', 'sokuon'], ['がっこう', 'sokuon'],
  ['ほん', 'hatsuon'], ['かんじ', 'hatsuon'],
  ['きょうしつ', 'youon'], ['しゅくだい', 'youon'],
  ['がっき', 'sokuon'],
  ['ばなな', 'dakuten'], ['ぱんだ', 'dakuten'],
  ['ふぁいる', 'gaion'],
  ['あお', 'row-a'], ['かき', 'row-ka'], ['さしす', 'row-sa'], ['たちつ', 'row-ta'],
  ['なに', 'row-na'], ['はひ', 'row-ha'], ['まみ', 'row-ma'], ['やゆ', 'row-ya'],
  ['らり', 'row-ra'], ['わを', 'row-wa']
];
RULE_CASES.forEach(([text, want]) => {
  const chunks = Romaji.buildChunks(text);
  ok(chunks.some(c => c.rule === want),
    `「${text}」に ${want} の ふだが つかない（${chunks.map(c => c.rule).join(',')}）`);
});

// っ は うしろの かなと ひとかたまりに なり、っ の ふだが かちます
eq(Romaji.buildChunks('きって')[1].rule, 'sokuon', 'っこ の かたまりは sokuon');

// 記号と 英数字は 数えません
eq(Romaji.buildChunks('。')[0].rule, 'kigou', '句点は kigou');
eq(Romaji.buildChunks('a')[0].rule, 'raw', 'アルファベットは raw');

// ------------------------------------------------------------------
// 6. expectedInfo と expected が いつも 同じ キーを 指すか
// ------------------------------------------------------------------
//
// この 2つは べつの 道を とおると いつか かならず 食いちがいます。
// ぜんぶの お題を 打ちとおして、1打ずつ たしかめます。

let steps = 0;
const seenRules = {};
function drive(text) {
  const m = Romaji.createMatcher(text);
  for (let guard = 0; guard < 1000 && !m.isFinished(); guard++) {
    const info = m.expectedInfo();
    const ch = m.expected();
    if (info.ch !== ch) {
      problems.push(`「${text}」… expectedInfo("${info.ch}") と expected("${ch}") が ちがう`);
      return;
    }
    if (!ch) return;
    if (info.rule) seenRules[info.rule] = true;
    steps++;
    if (!m.input(ch).ok) return;
  }
}
Lessons.COURSES.forEach(c => c.stages.forEach(s => (s.items || []).forEach(i => drive(i.k))));
checked += steps;
ok(steps > 1500, `ぜんぶの お題を 打ちとおした (${steps} 打)`);

// 出て きた ふだは ぜんぶ 知って いる ものか
const KNOWN = Object.keys(Mastery.RULE_LABELS).concat(['kigou', 'raw']);
Object.keys(seenRules).forEach(r => {
  ok(KNOWN.indexOf(r) >= 0, `知らない ふだ「${r}」が 出ました`);
});

// にがてな きまりから ふくしゅうする ステージが 引けるか
Object.keys(Mastery.RULE_TO_SKILL).forEach(rule => {
  const skill = Mastery.RULE_TO_SKILL[rule];
  const found = Lessons.COURSES.some(c => c.stages.some(s => s.skill === skill));
  ok(found, `きまり「${rule}」の ふくしゅうさき skill="${skill}" が ステージに ありません`);
});

// ------------------------------------------------------------------
// 7. にがて とっくんの お題が ほんとうに 打てるか
// ------------------------------------------------------------------

const SAFE = Mastery.SAFE_KEY;

function checkDrill(weakArg, what) {
  const built = Lessons.buildWeakStage(weakArg);
  ok(!!built, `${what} … 組み立てられません`);
  if (!built) return;
  ok(built.stage.items.length > 0, `${what} … お題が からです`);
  ok(built.stage.items.length <= 16, `${what} … お題が 多すぎます`);
  ok(built.stage.note.length > 0, `${what} … 何を あつめたかの ことばが ありません`);
  built.stage.items.forEach(item => {
    for (const ch of item.k) {
      if (!SAFE.test(ch)) { problems.push(`${what} … "${ch}" は つかえない キーです`); checked++; return; }
      ['jis', 'us'].forEach(id => {
        const f = Layout.findKey(id, ch);
        if (!f) problems.push(`${what} … "${ch}" が ${id} に ありません`);
        else if (!Layout.fingerOf(f.key.code)) problems.push(`${what} … "${ch}" に 指が ありません`);
      });
    }
    // 実際の matcher で さいごまで 打ちとおせるか
    const m = Romaji.createMatcher(item.k);
    for (let g = 0; g < 200 && !m.isFinished(); g++) {
      const ch = m.expected();
      if (!ch || !m.input(ch).ok) { problems.push(`${what} … 「${item.k}」が 打てません`); break; }
    }
    checked++;
  });
}

// これまでどおりの 配列（tools/check-lessons.js が この 形で よびます）
checkDrill(['p', 'q', 'z', ';', '.', '8'], 'にがて とっくん（配列）');
// あたらしい 形
checkDrill({ keys: ['p', 'q'], slow: ['z'], pairs: [{ from: 'd', to: 'f', n: 9 }] }, 'にがて とっくん（とりちがえつき）');
// とりちがえ だけでも 組み立てられる
checkDrill({ keys: [], slow: [], pairs: [{ from: 'd', to: 'f', n: 9 }] }, 'にがて とっくん（とりちがえだけ）');

// 足りない ときは null
eq(Lessons.buildWeakStage([]), null, 'からっぽなら 組み立てない');
eq(Lessons.buildWeakStage(['p']), null, 'キーが 1つだけなら 組み立てない');
eq(Lessons.buildWeakStage(null), null, 'null でも 落ちない');

// とりちがえの お題が ほんとうに 交ごに なって いるか
const pairDrill = Lessons.buildWeakStage({ pairs: [{ from: 'd', to: 'f', n: 9 }] });
ok(pairDrill.stage.items.some(i => i.k === 'dfdf'), 'とりちがえの 交ご打ち dfdf が 入る');
ok(pairDrill.stage.items.some(i => i.k === 'fdfd'), 'ぎゃくの 交ご打ち fdfd も 入る');

// ------------------------------------------------------------------
// 8. きろくが 大きく なりすぎないか
// ------------------------------------------------------------------

Store.clearRecords();
const oneLat = {};
'abcdefghijklmnopqrstuvwxyz.,;-'.split('').forEach(ch => { oneLat[ch] = lat([120, 300, 800, 1500]); });
const oneConf = {};
for (let i = 0; i < 12; i++) oneConf[`${'abcdefghijkl'[i]}>${'mnopqrstuvwx'[i]}`] = 3;
const oneRule = { sokuon: [40, 9], hatsuon: [60, 4], youon: [30, 6], dakuten: [50, 2], 'row-a': [90, 1] };

for (let i = 0; i < Store.HISTORY_MAX + 20; i++) {
  Store.addHistory({
    at: new Date(Date.now() - i * 1000).toISOString(),
    stageId: 'rm-a', title: 'ローマ字／あ行', mode: 'romaji', status: 'completed',
    kps: 2.31, accuracy: 96.4, correctKeys: 120, totalKeys: 125, elapsedMs: 52000,
    combo: 40, stars: 2, missByKey: { d: 3, f: 1 }, missByFinger: { 'l-index': 4 },
    lat: oneLat, conf: oneConf, rule: oneRule
  });
}

const stored = Store.getHistory();
eq(stored.length, Store.HISTORY_MAX, 'きろくは 上かぎりで 止まる');
const withDetail = stored.filter(h => h.lat).length;
eq(withDetail, Store.HISTORY_DETAIL_MAX, 'こまかい きろくは 新しい ぶんだけ のこる');
ok(!stored[0].lat, 'いちばん 古い 回からは こまかい きろくが 消えて いる');
ok(!!stored[stored.length - 1].lat, 'いちばん あたらしい 回には のこって いる');

// localStorage は UTF-16 で 数えるので 2ばいします
const bytes = JSON.stringify(stored).length * 2;
ok(bytes < 400000, `きろくの 大きさ ${Math.round(bytes / 1024)}KB < 400KB`);
console.log(`  （きろく 300回ぶんの 大きさ: ${Math.round(bytes / 1024)}KB）`);

// 数えなおしても 落ちないか（古い 回に lat が ない じょうたい）
const mixed = Mastery.keySummary(stored);
ok(!!mixed.byKey.d, 'こまかい きろくが ない 回が まざっても 数えられる');
ok(Mastery.weakTargets(stored).ready !== undefined, 'にがての ねらいが 出せる');

// ------------------------------------------------------------------

console.log(`しらべた こと: ${checked}`);
if (problems.length === 0) {
  console.log('おぼえぐあいの 数えかたは 正しく うごきます。');
  process.exit(0);
}
[...new Set(problems)].slice(0, 40).forEach(p => console.log(' - ' + p));
console.log(`\n${problems.length} 件 見つかりました。`);
process.exit(1);
