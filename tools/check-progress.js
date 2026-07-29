/**
 * =====================================================================
 * check-progress.js — 「ひとまわり」の つみあげを たしかめる
 * =====================================================================
 * つかいかた:
 *
 *   node tools/check-progress.js
 *
 * ■ なぜ ひつようか
 * Typa は ステージを「さいごまで やった か」では なく
 * **「つみあがった か」** で 数えます。3もん だけ 打って やめても、
 * その 3もんは 消えず、つぎに ひらいた ときは 4もん目から はじまります。
 *
 * この 数えかたが 1つでも ずれると、**画面を 見ても 気づけません**。
 * ★が 出ない・ずっと 同じ お題ばかり 出る・かんたんに ★3が つく、
 * どれも しばらく つかった あとに、授業の まん中で 分かります。
 *
 * ここで 見るのは つぎの 5つです。
 *   1. とちゅうで やめても 打った ぶんが のこるか
 *   2. わけて やっても、1回で やっても おなじに なるか
 *   3. ひとまわりの ★が「正かくさ」で 決まるか
 *   4. みじかすぎる 回が さいこう記録に ならないか
 *   5. ずっと 打ちつづけて 何しゅうも まわった ときに こわれないか
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

function reset() {
  Object.keys(memory).forEach(k => delete memory[k]);
}

/** れんしゅう 1回ぶんを ながしこみます */
function play(stageId, opt) {
  return Store.applyResult(stageId, {
    doneItems: opt.items,
    lapNeed: opt.need,
    correctKeys: opt.correct,
    totalKeys: opt.total,
    kps: opt.kps || 2,
    accuracy: opt.total > 0 ? (opt.correct / opt.total) * 100 : 0,
    finishedAt: new Date().toISOString()
  });
}

// ------------------------------------------------------------------
// 1. とちゅうで やめても のこる
// ------------------------------------------------------------------

reset();
let r = play('hp-1', { items: 3, need: 10, correct: 30, total: 30 });
eq(r.laps, 0, '3もんでは まだ ひとまわりに ならない');
eq(r.lapItems, 3, 'やめても 3もんは のこる');
eq(Store.getProgress()['hp-1'].stars, 0, 'ひとまわり する まで ★は つかない');
eq(Store.getProgress()['hp-1'].clears, 0, 'ひとまわり する まで クリアには しない');

// つづきは 4もん目から。lapState が それを 教えます
eq(Store.lapState('hp-1', 10).items, 3, 'つぎは 3もん すすんだ ところから');
eq(Store.lapState('hp-1', 10).need, 10, 'ひとまわりの ながさ');

// 1打も 打って いない ステージでも 落ちない
eq(Store.lapState('nope', 10).items, 0, 'はじめての ステージは 0 から');

// ------------------------------------------------------------------
// 2. わけて やっても、1回で やっても おなじ
// ------------------------------------------------------------------

reset();
[1, 1, 1, 1, 1, 1, 1, 1, 1, 1].forEach(() => play('hp-1', { items: 1, need: 10, correct: 10, total: 10 }));
const split = Store.getProgress()['hp-1'];

reset();
play('hp-1', { items: 10, need: 10, correct: 100, total: 100 });
const once = Store.getProgress()['hp-1'];

eq(split.clears, once.clears, '10回に わけても 1回でも クリアの 数は おなじ');
eq(split.stars, once.stars, '10回に わけても 1回でも ★は おなじ');
eq(split.lapItems, 0, 'ひとまわり したら すすみは 0 に もどる');

// ------------------------------------------------------------------
// 3. ★は「正かくさ」で 決まる（速さでは ない）
// ------------------------------------------------------------------

reset();
play('hp-2', { items: 10, need: 10, correct: 99, total: 100, kps: 0.4 });   // 99%・とても おそい
eq(Store.getProgress()['hp-2'].stars, 3, '正かくさ 99% なら おそくても ★3');

reset();
play('hp-2', { items: 10, need: 10, correct: 85, total: 100, kps: 9 });     // 85%・とても はやい
eq(Store.getProgress()['hp-2'].stars, 1, '正かくさ 85% なら はやくても ★1');

// ★は 下がりません（一度 とった ものは 消えない）
play('hp-2', { items: 10, need: 10, correct: 50, total: 100 });
eq(Store.getProgress()['hp-2'].stars, 1, '★は あとから 下がらない');

// ------------------------------------------------------------------
// 4. みじかすぎる 回を さいこう記録に しない
// ------------------------------------------------------------------
//
// ここが いちばん だいじです。3打で 100% を「さいこう記録」に すると、
// **すぐ やめる ほうが とくに なる** アプリに なって しまいます。

reset();
r = play('hp-3', { items: 1, need: 10, correct: 3, total: 3, kps: 9 });
eq(Store.getProgress()['hp-3'].bestKps, 0, '3打の 回は さいこう記録に しない');
eq(Store.getProgress()['hp-3'].bestAccuracy, 0, '3打の 正かくさも 記録に しない');
eq(r.lapItems, 1, 'それでも 打った 1もんは のこる');

play('hp-3', { items: 3, need: 10, correct: 40, total: 40, kps: 3 });
ok(Store.getProgress()['hp-3'].bestKps > 0, `${Store.MIN_RECORD_KEYS}打 いじょうなら 記録に する`);

// さかいめ ちょうどは 数えます
reset();
play('hp-3', { items: 2, need: 10, correct: Store.MIN_RECORD_KEYS, total: Store.MIN_RECORD_KEYS, kps: 2.5 });
ok(Store.getProgress()['hp-3'].bestKps > 0, `ちょうど ${Store.MIN_RECORD_KEYS}打は 数える`);

// ショートカットは 打鍵を 数えないので、打鍵数の 線では はかれません。
// ここで 落とすと、ステージ一覧の「さいこう 正かくさ」が ずっと 0% に なります
reset();
play('sc-1', { items: 0, need: 3, correct: 0, total: 0 });
eq(Store.getProgress()['sc-1'].bestAccuracy, 0, 'とちゅうで やめた ショートカットは 記録に しない');
Store.applyResult('sc-1', {
  doneItems: 3, lapNeed: 3, correctKeys: 0, totalKeys: 0,
  kps: 0, accuracy: 100, finishedAt: new Date().toISOString()
});
eq(Store.getProgress()['sc-1'].bestAccuracy, 100, 'やりきった ショートカットは 記録に する');

// ------------------------------------------------------------------
// 5. ずっと 打ちつづけて 何しゅうも まわった とき
// ------------------------------------------------------------------

reset();
r = play('hp-4', { items: 25, need: 10, correct: 249, total: 250 });
eq(r.laps, 2, '25もん で 2しゅう');
eq(r.lapItems, 5, 'あまりの 5もんは つぎの しゅうへ もちこす');
eq(Store.getProgress()['hp-4'].clears, 2, 'クリアも 2かい ふえる');
// 2しゅう目が いつも ★0 に ならないか（しゅうごとに 0 に もどすと そうなります）
eq(Store.getProgress()['hp-4'].stars, 3, '2しゅう目も 同じ 正かくさで 見る');

// ------------------------------------------------------------------
// 6. lapAdvance そのもの（localStorage を つかわない 形）
// ------------------------------------------------------------------

let cur = { lapItems: 0, lapCorrect: 0, lapTotal: 0 };
eq(Store.lapAdvance(cur, { items: 0, correct: 0, total: 0 }, 10).length, 0, '0もん では 何も 起きない');
eq(cur.lapItems, 0, '0もん なら すすみも 0');

// マイナスや でたらめな 数を 入れられても こわれない（ファイルは 手で 書きかえられます）
cur = { lapItems: 0, lapCorrect: 0, lapTotal: 0 };
Store.lapAdvance(cur, { items: -5, correct: -3, total: NaN }, 10);
eq(cur.lapItems, 0, 'マイナスの もん数は 0 として あつかう');
eq(cur.lapTotal, 0, 'NaN は 0 として あつかう');

// ながさ 0 の ステージでも 止まらない（お題を 消した ときに 起きます）
cur = { lapItems: 0, lapCorrect: 0, lapTotal: 0 };
const many = Store.lapAdvance(cur, { items: 5, correct: 50, total: 50 }, 0);
ok(many.length > 0 && many.length <= 200, 'ながさ 0 でも 止まらず、むげんに まわらない');

// ------------------------------------------------------------------
// 7. ふくしゅうの 日は ひとまわり した ときに 決まる
// ------------------------------------------------------------------

reset();
play('rm-a', { items: 2, need: 10, correct: 20, total: 20 });
ok(!Store.getProgress()['rm-a'].due, 'ひとまわり する まで ふくしゅうの 日は 決まらない');
play('rm-a', { items: 8, need: 10, correct: 80, total: 80 });
ok(!!Store.getProgress()['rm-a'].due, 'ひとまわり したら ふくしゅうの 日が 決まる');
ok(Store.getProgress()['rm-a'].due > Store.localDay(), 'ふくしゅうは あしたより あと');

// ------------------------------------------------------------------
// 8. ほんとうの ステージの ながさで 使えるか
// ------------------------------------------------------------------

reset();
Lessons.COURSES.forEach(course => {
  course.stages.forEach(stage => {
    const need = Lessons.stageCount(stage);
    ok(need > 0, `${stage.id} の お題が 0 もんです`);
    const res = play(stage.id, { items: need, need, correct: need * 8, total: need * 8 });
    eq(res.laps, 1, `${stage.id} を ぜんぶ やると ちょうど 1しゅう`);
    eq(res.lapItems, 0, `${stage.id} は あまりが 出ない`);
  });
});

// ------------------------------------------------------------------
// 9. 「じぶんの さいこう記録」も みじかい 回に つられない
// ------------------------------------------------------------------
//
// ステージごとの 記録を まもっても、ホームの「さいこう記録」が
// 3打の 回を ひろって しまうと、まぐれの 数字が ずっと 画面に のこります。
// はやさの バッジも そこから もらえて しまいます。

reset();
const day = new Date().toISOString();
Store.addHistory({ at: day, correctKeys: 3, totalKeys: 3, kps: 12, accuracy: 100, mode: 'course' });
eq(Store.bestOverall().kps, 0, '3打の 回は「さいこう記録」に しない');
eq(Store.bestOverall().count, 1, 'それでも れんしゅうした 回数には 入れる');

Store.addHistory({ at: day, correctKeys: 40, totalKeys: 40, kps: 2.5, accuracy: 100, mode: 'course' });
eq(Store.bestOverall().kps, 2.5, '40打の 回は「さいこう記録」に する');
eq(Store.bestOverall().count, 2, 'れんしゅうした 回数は 2かい');

// ショートカットは 打鍵を 数えないので、はやさの 記録には 入りません
Store.addHistory({ at: day, correctKeys: 0, totalKeys: 0, kps: 0, accuracy: 100, mode: 'shortcut' });
eq(Store.bestOverall().count, 2, 'ショートカットは はやさの 記録に 入れない');

// ------------------------------------------------------------------

console.log(`しらべた こと: ${checked}`);
if (problems.length === 0) {
  console.log('ひとまわりの つみあげは 正しく 数えられて います。');
  process.exit(0);
}
problems.forEach(p => console.log(' - ' + p));
console.log(`\n${problems.length} 件 見つかりました。`);
process.exit(1);
