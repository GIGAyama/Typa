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
 * ここで 見るのは つぎの 10こです。
 *   1. とちゅうで やめても 打った ぶんが のこるか
 *   2. わけて やっても、1回で やっても おなじに なるか
 *   3. ひとまわりの ★が「正かくさ」で 決まるか
 *   4. みじかすぎる 回が さいこう記録に ならないか
 *   5. ずっと 打ちつづけて 何しゅうも まわった ときに こわれないか
 *   6. みじかい ステージでも ★3に 手が とどくか
 *   7. 打鍵を 数えない ステージ（ショートカット）にも ★が つくか
 *   8. けっか画面に 出す ★と、ステージに ついた ★が 同じか
 *   9. そのさきの「だん」が、ヒントと はやさの **両方** で 決まるか
 *  10. れんしゅう中に 見せる ★と、あとで つく ★が 同じか
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
// 10. みじかい ステージでも ★3に 手が とどく
// ------------------------------------------------------------------
//
// ★は ひとまわり ぜんぶを 通して 見ます。ところが ひとまわりの ながさは
// ステージで まるで ちがいます。わりざん だけで 98% を もとめると、
// 32打の ステージでは **1文字でも まちがえたら ★3は なし**（＝100%）に
// なって いました。ホームポジション ①から ずっと 出られなく なります。

reset();
// ホームポジション ①（8もん・32打）で ミス 1かい
play('hp-1', { items: 8, need: 8, correct: 31, total: 32 });
eq(Store.getProgress()['hp-1'].stars, 3, '32打の ステージは ミス 1かいまで ★3');

reset();
play('hp-1', { items: 8, need: 8, correct: 30, total: 32 });
eq(Store.getProgress()['hp-1'].stars, 2, '32打で ミス 2かいなら ★2');

reset();
play('hp-1', { items: 8, need: 8, correct: 29, total: 32 });
eq(Store.getProgress()['hp-1'].stars, 1, '32打で ミス 3かいなら ★1');

// いちばん みじかい「あ行」（9もん・13打）でも 同じ です
reset();
play('rm-a', { items: 9, need: 9, correct: 12, total: 13 });
eq(Store.getProgress()['rm-a'].stars, 3, '13打の ステージも ミス 1かいまで ★3');

reset();
play('rm-a', { items: 9, need: 9, correct: 11, total: 13 });
eq(Store.getProgress()['rm-a'].stars, 2, '13打で ミス 2かいなら ★2');

reset();
play('rm-a', { items: 9, need: 9, correct: 10, total: 13 });
eq(Store.getProgress()['rm-a'].stars, 1, '13打で ミス 3かいなら ★1');

reset();
play('rm-a', { items: 9, need: 9, correct: 9, total: 13 });
eq(Store.getProgress()['rm-a'].stars, 0, '13打で ミス 4かいなら ★0');

// ながい ステージは これまでどおり わりざんの ままです（ゆるく しません）
reset();
play('st-4', { items: 3, need: 3, correct: 203, total: 208 });
eq(Store.getProgress()['st-4'].stars, 2, '208打で ミス 5かいは これまでどおり ★2');

reset();
play('st-4', { items: 3, need: 3, correct: 204, total: 208 });
eq(Store.getProgress()['st-4'].stars, 3, '208打で ミス 4かいなら ★3');

// starsOf を じかに 呼んだ ときも 同じ 線です
eq(Store.starsOf({ accuracy: 96.9, correctKeys: 31, totalKeys: 32 }), 3, 'starsOf も ミス 1かいを ★3に する');
eq(Store.starsOf({ accuracy: 96.9 }), 2, '打鍵数が わからない ときは 正かくさ だけで 見る');
eq(Store.starsOf({ accuracy: 0, correctKeys: 0, totalKeys: 0 }), 0, '1打も 打って いない 回は ★0');

// ------------------------------------------------------------------
// 11. 打鍵を 数えない ステージ（ショートカット）にも ★が つく
// ------------------------------------------------------------------
//
// ショートカットは correctKeys / totalKeys が 0 です。そのまま 足すと
// ひとまわりの 正かくさが ずっと 0% に なり、ぜんぶの 課題が できても
// ★が 1つも つきませんでした（けっか画面には ★3が 出るので、
// 「★3が とれない」が いちばん 分かりにくい 形で 起きます）。

reset();
let sc = Store.applyResult('sc-1', {
  doneItems: 4, correctItems: 4, lapNeed: 4,
  correctKeys: 0, totalKeys: 0, kps: 0, accuracy: 100, finishedAt: new Date().toISOString()
});
eq(sc.laps, 1, 'ショートカットも ひとまわり する');
eq(sc.lapStars, 3, 'ぜんぶ できた ショートカットは ★3');
eq(Store.getProgress()['sc-1'].stars, 3, 'ステージにも ★3が つく');

// とばした 課題は 正かいに しません
reset();
sc = Store.applyResult('sc-1', {
  doneItems: 4, correctItems: 3, lapNeed: 4,
  correctKeys: 0, totalKeys: 0, kps: 0, accuracy: 75, finishedAt: new Date().toISOString()
});
ok(sc.lapStars < 3, '1つ とばしたら ★3には ならない');

// わけて やっても 同じ です（2つ やって やめ、あとで のこり 2つ）
reset();
Store.applyResult('sc-2', {
  doneItems: 2, correctItems: 2, lapNeed: 4,
  correctKeys: 0, totalKeys: 0, kps: 0, accuracy: 100, finishedAt: new Date().toISOString()
});
eq(Store.getProgress()['sc-2'].stars, 0, 'とちゅうでは まだ ★は つかない');
sc = Store.applyResult('sc-2', {
  doneItems: 2, correctItems: 2, lapNeed: 4,
  correctKeys: 0, totalKeys: 0, kps: 0, accuracy: 100, finishedAt: new Date().toISOString()
});
eq(Store.getProgress()['sc-2'].stars, 3, 'わけて やっても ★3に なる');

// correctItems を わたさない 古い 呼びかたでも 正かくさから 数えます
reset();
sc = Store.applyResult('sc-3', {
  doneItems: 5, lapNeed: 5,
  correctKeys: 0, totalKeys: 0, kps: 0, accuracy: 100, finishedAt: new Date().toISOString()
});
eq(sc.lapStars, 3, 'correctItems が なくても 正かくさから 数える');

// ------------------------------------------------------------------
// 12. けっか画面の ★と、ステージに ついた ★は 同じ
// ------------------------------------------------------------------
//
// ★は「その回」では なく「ひとまわり ぜんぶ」で 決まります。
// けっか画面が その回の 正かくさから ★を 出しなおすと、
// **画面は ★3、ステージ一覧は ★2** が 起きます。
// 子どもから 見ると「★3を とったのに 消えた」です。

reset();
play('hp-1', { items: 4, need: 8, correct: 14, total: 16 });   // 月よう … ミス 2かい
r = play('hp-1', { items: 4, need: 8, correct: 16, total: 16 }); // 火よう … ミス なし

eq(r.laps, 1, '2日 あわせて ひとまわり');
eq(r.lapStars, 2, 'けっか画面の ★は ひとまわり ぜんぶ（32打で ミス 2かい）で 見る');
eq(Store.getProgress()['hp-1'].stars, 2, 'ステージに ついた ★と 同じ');
ok(Math.abs(r.lapAccuracy - 93.75) < 0.01, 'けっか画面に 出す ひとまわりの 正かくさ');
eq(Store.starsOf({ accuracy: 100, correctKeys: 16, totalKeys: 16 }), 3,
  'その回 だけを 見ると ★3 … ここが くいちがって いました');

// ------------------------------------------------------------------
// 13. そのさき（だん）… ぜんぶ ★3の あとの はしご
// ------------------------------------------------------------------
//
// だんは「ヒントを 消した じょうけん」と「はやさ」の 両方で 決まります。
// かたほうだけ では 上がりません。画面の キーボードを 見たまま 速い 子が
// いちばん 上に 立つ はしごに して しまうと、この アプリの めあてと
// 逆の ことを おしえる ことに なります。

/** だんを ねらう 1回ぶん（ぜんぶ 正かい・20打いじょう） */
function playRank(stageId, opt) {
  return Store.applyResult(stageId, {
    doneItems: opt.items, lapNeed: opt.need,
    correctKeys: opt.keys, totalKeys: opt.keys + (opt.miss || 0),
    kps: opt.kps, hintStrength: opt.hint,
    accuracy: (opt.keys / (opt.keys + (opt.miss || 0))) * 100,
    finishedAt: new Date().toISOString()
  });
}

reset();
let rk = playRank('hp-1', { items: 8, need: 8, keys: 40, kps: 4.5, hint: 0 });
eq(rk.lapRank, 0, 'ヒントを ぜんぶ 出した まま なら、いくら はやくても だんは つかない');
eq(Store.getProgress()['hp-1'].rank || 0, 0, 'ステージにも だんは つかない');

reset();
rk = playRank('hp-1', { items: 8, need: 8, keys: 40, kps: 1.2, hint: 3 });
eq(rk.lapRank, 0, 'ヒントを 消しても おそければ だんは つかない');

reset();
rk = playRank('hp-1', { items: 8, need: 8, keys: 40, kps: 2.4, hint: 1 });
eq(rk.lapRank, 1, 'ゆびの色だけ ＋ 2.0打/びょう で 1だん');

reset();
rk = playRank('hp-1', { items: 8, need: 8, keys: 40, kps: 3.4, hint: 2 });
eq(rk.lapRank, 2, 'ばしょだけ ＋ 3.0打/びょう で 2だん');

reset();
rk = playRank('hp-1', { items: 8, need: 8, keys: 40, kps: 4.4, hint: 3 });
eq(rk.lapRank, 3, 'なにも出ない ＋ 4.0打/びょう で 3だん');

// はやさが 2だん ぶん あっても、ヒントが 1だんの ままなら 1だん
reset();
rk = playRank('hp-1', { items: 8, need: 8, keys: 40, kps: 9, hint: 1 });
eq(rk.lapRank, 1, 'はやさだけ さきに 行っても、ヒントの ぶんまでしか 上がらない');

// ★3で ない ひとまわりでは だんは 上がりません（正かくさが さき）
reset();
rk = playRank('hp-1', { items: 8, need: 8, keys: 38, miss: 2, kps: 5, hint: 3 });
eq(rk.lapStars, 2, 'ミス 2かいの ひとまわりは ★2');
eq(rk.lapRank, 0, '★3で ない ひとまわりでは だんは 上がらない');

// だんも 下がりません
reset();
playRank('hp-1', { items: 8, need: 8, keys: 40, kps: 4.4, hint: 3 });
playRank('hp-1', { items: 8, need: 8, keys: 40, kps: 1.0, hint: 0 });
eq(Store.getProgress()['hp-1'].rank, 3, 'だんは あとから 下がらない');

// みじかい 回（20打みまん）は だんに しません。3打の まぐれを
// 「3だん」に しない ため（さいこう記録と 同じ 線です）
reset();
rk = playRank('rm-a', { items: 9, need: 9, keys: 13, kps: 9, hint: 3 });
eq(rk.lapStars, 3, 'みじかくても ★は つく');
eq(rk.lapRank, 0, `${Store.MIN_RECORD_KEYS}打 みまんの 回は だんに しない`);
// 2しゅう まわれば とどきます
reset();
rk = playRank('rm-a', { items: 18, need: 9, keys: 26, kps: 4.4, hint: 3 });
eq(rk.lapRank, 3, 'みじかい ステージも 2しゅう すれば だんに とどく');

// ヒントの つよさは「その回に ほんとうに 見えて いた もの」から 数えます。
// せっていが 'custom'（スイッチを 手で さわった）でも 同じ ものさしです
eq(Store.hintStrengthOf({ keyboard: true, fingerGuide: true, keyLabels: true, romajiHint: true }), 0,
  'ぜんぶ 見えて いれば 0');
eq(Store.hintStrengthOf({ keyboard: true, fingerGuide: true, keyLabels: true, romajiHint: false }), 1,
  'ローマ字の ヒントだけ 消せば 1');
eq(Store.hintStrengthOf({ keyboard: true, fingerGuide: false, keyLabels: false, romajiHint: false }), 2,
  'キーの 文字も 指の 色も 消せば 2');
eq(Store.hintStrengthOf({ keyboard: false, fingerGuide: false, keyLabels: false, romajiHint: false }), 3,
  'キーボードを 出さなければ 3');
eq(Store.hintStrengthOf({ level: 'blind' }), 4, 'めかくしは 4');

// つぎに ねらう だん
eq(Store.nextRank(0).rank, 1, 'だんなしの つぎは 1だん');
eq(Store.nextRank(2).kps, 4, '2だんの つぎ（3だん）は 4.0 打/びょう');
eq(Store.nextRank(3), null, '3だんの さきは ない');

// ------------------------------------------------------------------
// 14. れんしゅう中に 見せる ★（「★3つ！」の おしらせ）
// ------------------------------------------------------------------
//
// ひとまわり できた しゅんかんに、れんしゅう画面が その ばで ★を 出します
// （js/play.js の celebrateLap）。ここで 見せた ★が あとの けっか画面や
// ステージ一覧と ちがうと、子どもから 見れば「★3つを とったのに 消えた」です。
// 2つが かならず 合う ことを ここで つき合わせます。

// (1) 前の れんしゅうの つづきぶんも 入れて 数える
reset();
play('hp-1', { items: 5, need: 10, correct: 46, total: 50 });   // きのう … ミス 4かい
eq(Store.lapStarsPreview('hp-1', { correct: 50, total: 50 }), 2,
  'きょう ノーミスでも、きのうの ミスを 入れた 正かくさ（96%）で 見る');
r = play('hp-1', { items: 5, need: 10, correct: 50, total: 50 });
eq(r.lapStars, 2, 'ほんとうに ついた ★と 同じ');
eq(Store.getProgress()['hp-1'].stars, 2, 'ステージに ついた ★とも 同じ');

// (2) はじめての ステージ（つづきぶんなし）
reset();
eq(Store.lapStarsPreview('hp-1', { correct: 32, total: 32 }), 3, 'ノーミスなら ★3つ');
eq(Store.lapStarsPreview('hp-1', { correct: 31, total: 32 }), 3, '32打で ミス 1かいまでは ★3つ');
eq(Store.lapStarsPreview('hp-1', { correct: 30, total: 32 }), 2, '32打で ミス 2かいなら ★2つ');
eq(Store.lapStarsPreview('hp-1', { correct: 0, total: 0 }), 0, '1打も 打って いなければ ★0');
eq(Store.lapStarsPreview('nope', { correct: 10, total: 10 }), 3, '知らない ステージでも 落ちない');

// 打鍵を 数えない ステージ（ショートカット）は お題の 数で 見ます
reset();
eq(Store.lapStarsPreview('sc-1', { correct: 4, total: 4, byItem: true }), 3,
  'ショートカットは できた 課題の 数で 見る');
eq(Store.lapStarsPreview('sc-1', { correct: 3, total: 4, byItem: true }), 0,
  '4つで 1つ とばしたら（75%）★は つかない … 打鍵むけの 下ささえは つかわない');

// (3) 見せた ★は あとから 下がりません
//
// 1回で 何しゅうも まわると、どの しゅうも 同じ 正かくさで 見ます。
// 1しゅう目を ノーミスで まわって「★3つ！」と 見せた あと 2しゅう目で
// くずれると、合計の 正かくさが さがって けっか画面が ★2つに なります。
reset();
eq(Store.lapStarsPreview('hp-1', { correct: 100, total: 100 }), 3,
  '1しゅう目の おわりに「★3つ」と 見せた');
r = Store.applyResult('hp-1', {
  doneItems: 16, lapNeed: 8, correctKeys: 170, totalKeys: 200,
  kps: 2, accuracy: 85, lapStarsSeen: 3, finishedAt: new Date().toISOString()
});
eq(r.laps, 2, '2しゅう まわった');
eq(r.lapStars, 3, 'あとで くずれても、見せた ★3つは 下がらない');
eq(Store.getProgress()['hp-1'].stars, 3, 'ステージにも ★3つが つく');

// 見せて いなければ これまでどおり（合計の 正かくさ 85% → ★1）
reset();
r = Store.applyResult('hp-1', {
  doneItems: 16, lapNeed: 8, correctKeys: 170, totalKeys: 200,
  kps: 2, accuracy: 85, finishedAt: new Date().toISOString()
});
eq(r.lapStars, 1, 'lapStarsSeen が なければ これまでどおり 合計の 正かくさで 見る');

// ひとまわり して いない 回に ★は つきません（見せた ★でも 作れません）
reset();
r = Store.applyResult('hp-1', {
  doneItems: 3, lapNeed: 8, correctKeys: 30, totalKeys: 30,
  kps: 2, accuracy: 100, lapStarsSeen: 3, finishedAt: new Date().toISOString()
});
eq(r.laps, 0, 'ひとまわり して いない');
eq(Store.getProgress()['hp-1'].stars, 0, 'ひとまわり しない かぎり ★は つかない');

// ------------------------------------------------------------------
// 11. 1回 読んだ ものを おぼえて いても、古い ものを 返さない
// ------------------------------------------------------------------
//
// store.js は JSON.parse の 結果を おぼえて おきます。きろくの ならびは
// 170KB を こえるのに、1つの 画面を 出すだけで 何度も 読みなおして いて、
// **打ちはじめるまでの 待ち時間**に そのまま つみ上がって いたためです。
//
// はやく なる かわりに「古い ものを つかんだ まま」に なっては いけません。
// backup.js は localStorage に じかに 書き、べつの タブが 書きかえる ことも
// あります。おぼえて いるのは「その ときの 文字列と その 結果」の 2つ 一組で、
// 読むたびに 文字列を 見くらべます。ここが こわれると、きろくを 読みこんだ
// あとも 前の きろくが 出つづける ことに なります。

reset();
Store.applyResult('hp-1', {
  doneItems: 8, lapNeed: 8, correctKeys: 32, totalKeys: 32,
  kps: 2, accuracy: 100, finishedAt: new Date().toISOString()
});
eq(Store.getProgress()['hp-1'].stars, 3, 'まず ★3つ を つけて おく');

// (1) store.js を とおさずに 書きかえた ばあい（backup.js の 読みこみ・べつの タブ）
memory['typa.progress.v1'] = JSON.stringify({ 'hp-1': { clears: 1, stars: 1 } });
eq(Store.getProgress()['hp-1'].stars, 1, '外から 書きかえたら すぐ 新しい ほうを 読む');

// (2) store.js を とおさずに 消した ばあい
delete memory['typa.progress.v1'];
eq(Store.getProgress()['hp-1'], undefined, '外から 消したら もう 返さない');

// (3) 同じ 中身を 2回 読んでも 同じ こたえ
memory['typa.history.v1'] = JSON.stringify([{ at: '2026-07-20T10:00:00.000Z', correctKeys: 40 }]);
eq(Store.getHistory().length, 1, '1回目');
eq(Store.getHistory().length, 1, '2回目（おぼえた ものを つかう）');
memory['typa.history.v1'] = JSON.stringify([]);
eq(Store.getHistory().length, 0, '中身が かわれば こたえも かわる');

// (4) こわれた 文字列は そのまま すてる（おぼえた 前の ものを 返さない）
memory['typa.history.v1'] = '{こわれて います';
eq(Store.getHistory().length, 0, 'こわれた ものは 空として あつかう');

// ------------------------------------------------------------------

console.log(`しらべた こと: ${checked}`);
if (problems.length === 0) {
  console.log('ひとまわりの つみあげは 正しく 数えられて います。');
  process.exit(0);
}
problems.forEach(p => console.log(' - ' + p));
console.log(`\n${problems.length} 件 見つかりました。`);
process.exit(1);
