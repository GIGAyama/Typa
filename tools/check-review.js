/**
 * =====================================================================
 * check-review.js — ふくしゅうの 日づけを たしかめる
 * =====================================================================
 * つかいかた:
 *
 *   node tools/check-review.js
 *
 * ■ なぜ ひつようか
 * 日づけの ずれは **画面を 見ても 気づけません**。1日 ずれた まま
 * 何週間も 動きつづけ、「きょうの ふくしゅう」が 出ない／出っぱなしに なります。
 *
 * とくに あぶないのが つぎの 3つです。
 *   1. ISO の 文字列を そのまま 切る … 日本では あさ9時までが「きのう」に なる
 *   2. 月の おわり・うるう年 … 7月31日 + 1日 が 7月32日 に ならないか
 *   3. 前から つかって いる 人 … box も due も ない きろくで 落ちないか
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
require(path.join(__dirname, '..', 'js', 'store.js'));

const { Store, Lessons } = global.Typa;

const problems = [];
let checked = 0;

function ok(cond, what) {
  checked++;
  if (!cond) problems.push(what);
}

function eq(got, want, what) {
  ok(got === want, `${what} … ${JSON.stringify(want)} の はずが ${JSON.stringify(got)}`);
}

// ------------------------------------------------------------------
// 1. 日づけの けいさん
// ------------------------------------------------------------------

eq(Store.dayAhead(0), Store.localDay(), 'きょうから 0日 あとは きょう');
eq(Store.dayBefore(0), Store.localDay(), 'きょうから 0日 前は きょう');
ok(Store.dayAhead(1) > Store.localDay(), 'あすは きょうより あと');
ok(Store.dayBefore(1) < Store.localDay(), 'きのうは きょうより 前');

// 30日 いったり きたりして もどるか（月を またいでも ずれない）
for (let n = 1; n <= 40; n++) {
  const ahead = Store.dayAhead(n);
  ok(/^\d{4}-\d{2}-\d{2}$/.test(ahead), `${n}日 あとの 形が おかしい: ${ahead}`);
  const [, mm, dd] = ahead.split('-').map(Number);
  ok(mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31, `${n}日 あとが ありえない 日づけ: ${ahead}`);
}

// ------------------------------------------------------------------
// 2. はこの 上げ下げ
// ------------------------------------------------------------------

const DAYS = Store.REVIEW_DAYS;
eq(DAYS.length, 5, 'ふくしゅうの 間は 5だんかい');

// ★3を つづけると 間が のびる
let cur = {};
const grown = [];
for (let i = 0; i < 7; i++) {
  Store.scheduleReview(cur, 3);
  grown.push(cur.box);
}
eq(grown.join(','), '1,2,3,4,5,5,5', '★3を つづけると はこが 5まで 上がって 止まる');
eq(cur.due, Store.dayAhead(30), 'いちばん 上の はこは 30日 あと');

// うまく できなかったら 1に もどる
Store.scheduleReview(cur, 1);
eq(cur.box, 1, '★1だと はこが 1に もどる');
eq(cur.due, Store.dayAhead(1), 'もどったら あすまた 出る');

// ★2（正かくさ 92%）は「できた」あつかい
cur = { box: 2 };
Store.scheduleReview(cur, 2);
eq(cur.box, 3, '★2は つぎの はこへ');

// box が ない ところから はじめても 落ちない
cur = {};
Store.scheduleReview(cur, 2);
eq(cur.box, 1, 'box が なくても 1から はじまる');

// ------------------------------------------------------------------
// 3. applyResult に つながって いるか
// ------------------------------------------------------------------

Store.clearRecords();
Store.applyResult('rm-a', { kps: 2, accuracy: 99, finishedAt: new Date().toISOString() });
const p = Store.getProgress()['rm-a'];
eq(p.box, 1, 'れんしゅうすると はこが つく');
eq(p.due, Store.dayAhead(1), 'つぎの ふくしゅうは あす');
eq(Store.dueStages().length, 0, 'あすの ぶんは きょう 出ない');

// ------------------------------------------------------------------
// 4. きょう 出る ステージ
// ------------------------------------------------------------------

Store.clearRecords();
const now = new Date().toISOString();
const progress = {
  'rm-a':  { clears: 2, stars: 3, lastAt: now, box: 3, due: Store.dayBefore(5) },  // 5日 すぎ
  'rm-ka': { clears: 1, stars: 3, lastAt: now, box: 1, due: Store.localDay() },    // きょう
  'rm-sa': { clears: 1, stars: 3, lastAt: now, box: 2, due: Store.dayAhead(3) },   // まだ 先
  'hp-1':  { clears: 0, stars: 0, lastAt: now, box: 1, due: Store.dayBefore(9) }   // やって いない
};
localStorage.setItem(Store.KEYS.progress, JSON.stringify(progress));

const list = Store.dueStages();
eq(list.length, 2, 'きょう 出るのは 2つ');
eq(list[0].stageId, 'rm-a', 'いちばん 日が すぎた ものが 先');
eq(list[1].stageId, 'rm-ka', 'きょうぶんが つぎ');
ok(list.every(d => d.stageId !== 'rm-sa'), 'まだ 先の ものは 出さない');
ok(list.every(d => d.stageId !== 'hp-1'), 'やって いない ステージは 出さない');
eq(Store.dueStages(1).length, 1, '数を かぎれる');

// ------------------------------------------------------------------
// 5. 前から つかって いる 人（box も due も ない）
// ------------------------------------------------------------------

Store.clearRecords();
localStorage.setItem(Store.KEYS.progress, JSON.stringify({
  'rm-a':  { clears: 3, stars: 3, lastAt: new Date(Date.now() - 20 * 86400000).toISOString() },
  'rm-ka': { clears: 3, stars: 3, lastAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  'rm-sa': { clears: 1, stars: 2 }                                    // lastAt も ない
}));
const old = Store.dueStages();
eq(old.length, 1, 'しばらく さわって いない ステージだけ よびもどす');
eq(old[0].stageId, 'rm-a', '20日 前の ものが 出る');
ok(old.every(d => d.stageId !== 'rm-ka'), '2日 前の ものは まだ 出さない');

// ------------------------------------------------------------------
// 6. 出てきた ステージが ほんとうに ひけるか
// ------------------------------------------------------------------

Store.dueStages().forEach(d => {
  const found = Lessons.findStageById(d.stageId);
  ok(!!found, `ふくしゅうに 出た「${d.stageId}」が コースの 中に ありません`);
});
ok(Lessons.findStageById('rm-a') !== null, 'findStageById が ひける');
ok(Lessons.findStageById('nope') === null, 'ない ID は null');

// ------------------------------------------------------------------

console.log(`しらべた こと: ${checked}`);
if (problems.length === 0) {
  console.log('ふくしゅうの 日づけは 正しく 数えられて います。');
  process.exit(0);
}
problems.forEach(p2 => console.log(' - ' + p2));
console.log(`\n${problems.length} 件 見つかりました。`);
process.exit(1);
