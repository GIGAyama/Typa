/**
 * =====================================================================
 * check-backup.js — きろくの 書き出し・読みこみを たしかめる
 * =====================================================================
 * つかいかた:
 *
 *   node tools/check-backup.js
 *
 * ■ なぜ ひつようか
 * 読みこみは **いまの きろくを 消して 置きかえます**。まちがった ファイルを
 * そのまま 入れて しまうと、児童の きろくが こわれた まま のこります。
 * しかも 気づくのは、つぎに 開いた 授業の まん中です。
 *
 * ファイルは 手で 書きかえられるので、読みこむ 前に かならず しらべます。
 * とくに **せっていは 知っている 名前だけ** を 取りこみます。
 * まるごと 代入すると、これから ふえる せっていに 何でも 入れられます。
 */
'use strict';

const path = require('path');

// ブラウザむけの ファイルを そのまま よみこむため、window を 用意します
global.window = global;

// localStorage の かわり（この スクリプトの 中だけの ものです）
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
require(path.join(__dirname, '..', 'js', 'backup.js'));

const { Store, Backup } = global.Typa;
const K = Store.KEYS;

const problems = [];
let checked = 0;

function ok(cond, what) {
  checked++;
  if (!cond) problems.push(what);
}

/** 読みこみを ことわる はずの ファイルを ためします */
function reject(text, what) {
  const res = Backup.parseImport(text);
  ok(res.ok === false, `${what} … ことわる はずが 通りました`);
  if (res.ok === false) {
    ok(typeof res.message === 'string' && res.message.length > 0,
      `${what} … 理由の ことばが ありません`);
  }
}

// ------------------------------------------------------------------
// 1. 書き出して 読みこむと、もとに もどるか
// ------------------------------------------------------------------

Store.setSetting('layout', 'us');
Store.setSetting('bigText', true);
Store.applyResult('rm-a', { kps: 2.5, accuracy: 99, finishedAt: '2026-07-20T10:00:00.000Z' });
Store.addHistory({ at: '2026-07-20T10:00:00.000Z', stageId: 'rm-a', correctKeys: 40, kps: 2.5, accuracy: 99 });
Store.saveAwards(Object.assign(Store.getAwards(), { xp: 320, keys: 900, sessions: 4 }));
Store.applyChallenge('ch-word-60', { correctKeys: 120, kps: 2, accuracy: 96, finishedAt: '2026-07-20T10:05:00.000Z' });

const exported = Backup.buildExport('2.1.0');
const text = Backup.toText(exported);

ok(exported.app === 'Typa', 'app が Typa では ありません');
ok(exported.schema === Backup.SCHEMA, 'schema が ちがいます');
ok(!!exported.data[K.progress], 'すすみぐあいが 書き出されて いません');

const before = {
  stars: Store.getProgress()['rm-a'].stars,
  xp: Store.getAwards().xp,
  layout: Store.getSettings().layout,
  history: Store.getHistory().length,
  challenge: Store.getChallenge()['ch-word-60'].keys
};

Store.clearRecords();
Store.setSetting('layout', 'jis');
ok(Store.getProgress()['rm-a'] === undefined, 'きろくが 消えて いません');

const parsed = Backup.parseImport(text);
ok(parsed.ok === true, '書き出した ファイルを 読みこめません');
if (parsed.ok) {
  ok(parsed.summary.sessions === before.history, 'まとめの れんしゅう回数が ちがいます');
  ok(parsed.summary.stars === before.stars, 'まとめの ★の 数が ちがいます');
  Backup.applyImport(parsed.clean);
}

ok(Store.getProgress()['rm-a'].stars === before.stars, '★が もどりません');
ok(Store.getAwards().xp === before.xp, 'けいけんちが もどりません');
ok(Store.getSettings().layout === before.layout, 'せっていが もどりません');
ok(Store.getHistory().length === before.history, 'きろくの 数が もどりません');
ok(Store.getChallenge()['ch-word-60'].keys === before.challenge, 'チャレンジの 記録が もどりません');

// ------------------------------------------------------------------
// 2. おかしな ファイルは ことわるか
// ------------------------------------------------------------------

reject('', 'からの ファイル');
reject('{', 'とちゅうで 切れた JSON');
reject('[]', '配列の ファイル');
reject('"hello"', '文字だけの ファイル');
reject(JSON.stringify({}), '空の オブジェクト');
reject(JSON.stringify({ app: 'Other', schema: 1, data: {} }), 'べつの アプリの ファイル');
reject(JSON.stringify({ app: 'Typa', data: {} }), 'schema が ない ファイル');
reject(JSON.stringify({ app: 'Typa', schema: 99, data: {} }), 'あたらしい schema');
reject(JSON.stringify({ app: 'Typa', schema: 1, data: 'x' }), 'data が 文字');
reject(JSON.stringify({ app: 'Typa', schema: 1, data: {} }), '中身の ない data');

// ------------------------------------------------------------------
// 3. せっていは 知っている 名前だけ 取りこむか
// ------------------------------------------------------------------

const dirty = Backup.parseImport(JSON.stringify({
  app: 'Typa', schema: 1,
  data: {
    [K.settings]: { layout: 'us', evil: 'nope', theme: 'dark', bigText: 'yes', sound: false }
  }
}));
ok(dirty.ok === true, 'せっていだけの ファイルが 読みこめません');
if (dirty.ok) {
  const s = dirty.clean[K.settings];
  ok(s.evil === undefined, '知らない せってい "evil" が 取りこまれました');
  ok(s.layout === 'us', '正しい せっていが 取りこまれて いません');
  ok(s.sound === false, 'false の せっていが おちて います');
  // bigText は boolean の はずなのに 文字だったので おとします
  ok(s.bigText === undefined, '型の ちがう せってい "bigText" が 取りこまれました');
}

// ------------------------------------------------------------------
// 4. きろくの 中の こわれた ものを おとすか
// ------------------------------------------------------------------

const messy = Backup.parseImport(JSON.stringify({
  app: 'Typa', schema: 1,
  data: {
    [K.history]: [
      { at: '2026-07-01T00:00:00.000Z', correctKeys: 10 },
      { correctKeys: 10 },              // at が ない → おとす
      null,                             // → おとす
      'x'                               // → おとす
    ],
    [K.progress]: { 'rm-a': { clears: 2, stars: 9 }, 'bad': null }
  }
}));
ok(messy.ok === true, 'こわれた きろくを ふくむ ファイルが 読みこめません');
if (messy.ok) {
  ok(messy.clean[K.history].length === 1, 'at の ない きろくが おちて いません');
  ok(messy.clean[K.progress]['rm-a'].stars === 3, '★が 3を こえた ままです');
  ok(messy.clean[K.progress].bad === undefined, 'こわれた ステージが のこって います');
}

// ------------------------------------------------------------------

console.log(`しらべた こと: ${checked}`);
if (problems.length === 0) {
  console.log('書き出しと 読みこみは 正しく うごきます。');
  process.exit(0);
}
problems.forEach(p => console.log(' - ' + p));
console.log(`\n${problems.length} 件 見つかりました。`);
process.exit(1);
