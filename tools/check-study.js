/**
 * =====================================================================
 * check-study.js — 学習ログ（study.v1）の かたちを たしかめる
 * =====================================================================
 * つかいかた:
 *
 *   node tools/check-study.js
 *
 * ■ なぜ ひつようか
 * 学習ログは **画面に 出ません**。かたちが くずれても アプリは
 * ふつうに 動き、児童も 先生も 気づきません。気づくのは、学期の おわりに
 * まとめて 出そうと した ときです。そこで こわれて いても、もう
 * その学期の きろくは 帰って きません。
 *
 * 受信側（送信ページ・サーバー）は、かたちの あわない レコードを **すてます**。
 * すてられた ことも 児童には 見えません。だから ここで 見ます。
 *
 * ここで 見るのは つぎの 8つです。
 *   1. 必須項目（§2.2）が そろって いるか
 *   2. 受け入れ条件（§9.2）を どの レコードも みたすか
 *   3. attempted と items の 数が いつも 合うか（切り詰めた ときも）
 *   4. おまけの 周（打ち直し）が 正答率の 分母に 入って いないか
 *   5. count が お題の 数で、打鍵数に なって いないか
 *   6. activeMs（60秒 基準）に 5秒 基準の 値が まぎれて いないか
 *   7. 単元IDが 表示名から 作られて いないか（名前を かえても かわらないか）
 *   8. 設問IDが 決まった 値に なるか（同じ お題は いつも 同じ ID）
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

require(path.join(__dirname, '..', 'src', 'romaji.js'));
require(path.join(__dirname, '..', 'src', 'layout.js'));
require(path.join(__dirname, '..', 'src', 'lessons.js'));
require(path.join(__dirname, '..', 'src', 'mastery.js'));
require(path.join(__dirname, '..', 'src', 'store.js'));
require(path.join(__dirname, '..', 'src', 'studyLog.js'));
require(path.join(__dirname, '..', 'src', 'studySession.js'));
require(path.join(__dirname, '..', 'src', 'studyStats.js'));

const T = global.Typa;
const Study = T.Study;
const StudyLog = global.StudyLog;

let failed = 0;

function ok(label, cond, extra) {
  if (cond) { console.log(`  ok   ${label}`); return; }
  failed++;
  console.log(`  NG   ${label}${extra ? `  → ${extra}` : ''}`);
}

function group(name) { console.log(`\n${name}`); }

// ------------------------------------------------------------------
// けっかの ひな型（play.js の finish() が 返す かたち）
// ------------------------------------------------------------------

const found = T.Lessons.findStage('home-position', 'hp-1');

function item(q, opt) {
  const o = opt || {};
  return {
    q, ok: o.ok !== false, firstTry: o.firstTry !== false,
    tries: o.tries || 1, ms: o.ms || 1200, wrong: o.wrong || [],
    retry: !!o.retry
  };
}

function result(over) {
  const base = {
    course: found.course,
    stage: found.stage,
    source: 'course',
    special: '',
    status: 'stopped',
    startedAt: new Date('2026-07-30T09:00:00+09:00'),
    clockStartedAt: new Date('2026-07-30T09:00:05+09:00'),
    finishedAt: '2026-07-30T09:02:05+09:00',
    elapsedMs: 120000,
    activeMs: 110000,      // 5秒 基準（アプリの 中の 値）
    activeMs60: 118000,    // 60秒 基準（8アプリ 共通）
    retryMs: 0,
    items: [item('ffff'), item('jjjj', { firstTry: false, tries: 3, wrong: ['k'] })],
    correctKeys: 30, totalKeys: 33, missKeys: 3,
    kps: 2.4, accuracy: 90.9, combo: 12,
    missByKey: { j: 3 }, missByFinger: { 'r-index': 3 },
    retryMissByKey: {}, retryMissByFinger: {},
    hintLevel: 'finger-color',
    layout: 'jis',
    doneItems: 2, lapNeed: 8, lapPos: 2, laps: 0, count: 2, done: 2
  };
  return Object.assign(base, over || {});
}

const build = over => Study.buildRecord(result(over), { appVersion: '9.9.9' });

// ------------------------------------------------------------------
// 1. 必須項目（§2.2）
// ------------------------------------------------------------------

group('1. 必須項目が そろって いるか（§2.2）');
{
  const r = build();
  ok('schema が study.v1', r.schema === 'study.v1', r.schema);
  ok('appId が typa', r.appId === 'typa', r.appId);
  ok('appVersion が 入って いる', r.appVersion === '9.9.9', r.appVersion);
  ok('kind が session', r.kind === 'session', r.kind);
  ok('mode は 英数小文字と ハイフンだけ', /^[a-z0-9-]+$/.test(r.mode), r.mode);
  ok('unit.id が ある', !!(r.unit && r.unit.id), JSON.stringify(r.unit));
  ok('startedAt が ISO 8601', !isNaN(new Date(r.startedAt).getTime()), r.startedAt);
  ok('elapsedMs が 整数', Number.isInteger(r.elapsedMs), r.elapsedMs);
  ok('status は completed か aborted', ['completed', 'aborted'].indexOf(r.status) >= 0, r.status);
  ok('summary.count が 数', typeof r.summary.count === 'number', r.summary.count);
  ok('summary.firstTryCorrect が 数', typeof r.summary.firstTryCorrect === 'number');
  ok('grading は objective', r.grading === 'objective', r.grading);
  ok('multiplayer は false', r.multiplayer === false);
  ok('timeBasis は app', r.timeBasis === 'app');
  // §4 記録しては いけない もの
  const text = JSON.stringify(r);
  ok('端末や 児童を 見わける ものが 入って いない',
    !/userAgent|navigator|email|studentId|name"/.test(text));
}

// ------------------------------------------------------------------
// 2. 受け入れ条件（§9.2）
// ------------------------------------------------------------------

group('2. 受信側の 受け入れ条件を みたすか（§9.2）');

function accepts(r) {
  const s = r.summary || {};
  const problems = [];
  if (r.schema !== 'study.v1') problems.push('schema');
  if (['qalc', 'kanji-town', 'keisan-card', 'keisan-block', 'square100',
       'kuku-card', 'reading-books', 'typa'].indexOf(r.appId) < 0) problems.push('appId');
  if (isNaN(new Date(r.startedAt).getTime())) problems.push('startedAt');
  if (new Date(r.startedAt).getTime() > Date.now() + 60000) problems.push('startedAt(未来)');
  if (!(r.elapsedMs >= 0 && r.elapsedMs <= 86400000)) problems.push('elapsedMs');
  if (r.activeMs !== undefined && !(r.activeMs >= 0 && r.activeMs <= r.elapsedMs)) problems.push('activeMs');
  if (s.attempted !== undefined && !(s.attempted >= 0 && s.attempted <= s.count)) problems.push('attempted');
  if (!(s.count >= 0 && s.count <= 1000)) problems.push('count');
  if (!(s.firstTryCorrect >= 0 && s.firstTryCorrect <= s.count)) problems.push('firstTryCorrect');
  if (r.items && r.items.length > 200) problems.push('items');
  if (JSON.stringify(r.ext || {}).length > 8192) problems.push('ext');
  if (JSON.stringify(r).length > 65536) problems.push('全体');
  return problems;
}

{
  const cases = {
    'ふつうの 回': build(),
    'とちゅうで やめた 回': build({ status: 'stopped', items: [item('ffff')], doneItems: 1 }),
    'ひとまわり できた 回': build({ laps: 1, lapPos: 0 }),
    'チャレンジ': build({
      stage: T.Lessons.buildChallengeStage('word', 60).stage,
      course: T.Lessons.CHALLENGE_COURSE,
      status: 'completed', elapsedMs: 60000, activeMs: 60000, activeMs60: 52000
    }),
    'にがて とっくん': build({ special: 'weak', source: 'course' }),
    'ふくしゅう': build({ source: 'review' }),
    '長い セッション（切り詰め）': build({
      items: Array.from({ length: 260 }, (_, i) => item(`w${i}`, { firstTry: i % 2 === 0 })),
      elapsedMs: 1800000
    }),
    '時間が とんでも ない 回': build({ elapsedMs: 99 * 3600000, activeMs60: 99 * 3600000 })
  };
  Object.keys(cases).forEach(name => {
    const problems = accepts(cases[name]);
    ok(`うけとって もらえる: ${name}`, problems.length === 0, problems.join(','));
  });
}

// ------------------------------------------------------------------
// 3. attempted と items（§2.7）
// ------------------------------------------------------------------

group('3. attempted と items の 数が 合うか（§2.7）');
{
  const r = build();
  ok('attempted === items.length', r.summary.attempted === r.items.length,
    `${r.summary.attempted} / ${r.items.length}`);

  const many = build({
    items: Array.from({ length: 260 }, (_, i) => item(`w${i}`, { firstTry: i < 100 }))
  });
  ok('200件を こえたら 切り詰める', many.items.length === 200, many.items.length);
  ok('切り詰めても attempted === items.length',
    many.summary.attempted === many.items.length);
  ok('count は 切り詰めの えいきょうを うけない', many.summary.count === 260, many.summary.count);
  ok('ほんとうの 解答数が ext に のこる',
    !!many.ext.itemsTruncated && many.ext.itemsTruncated.attempted === 260,
    JSON.stringify(many.ext.itemsTruncated));
  ok('ほんとうの 初回正答も ext に のこる',
    many.ext.itemsTruncated.firstTryCorrect === 100,
    JSON.stringify(many.ext.itemsTruncated));
  ok('summary は 切り詰めた あとの items から 出す',
    many.summary.firstTryCorrect === many.items.filter(it => it.firstTry).length);
  ok('切り詰めが ない 回に itemsTruncated を つけない', r.ext.itemsTruncated === undefined);

  // count は 1000 まで（§9.2）。それを こえても ほんとうの 数は ext に のこる
  const huge = build({
    items: Array.from({ length: 1200 }, (_, i) => item(`w${i}`))
  });
  ok('count は 1000 を こえない', huge.summary.count === 1000, huge.summary.count);
  ok('1000を こえた ぶんも ext に のこる', huge.ext.itemsTruncated.attempted === 1200);
}

// ------------------------------------------------------------------
// 4. おまけの 周（§3.9.3）
// ------------------------------------------------------------------

group('4. 打ち直しが 正答率の 分母に 入って いないか（§3.9.3）');
{
  const r = build({
    items: [
      item('ffff'),
      item('jjjj', { firstTry: false, tries: 2 }),
      item('jjjj', { retry: true }),          // おまけの 周
      item('kkkk', { retry: true })
    ],
    retryMs: 8000,
    retryMissByKey: { j: 2 }, missByKey: { j: 5 },
    retryMissByFinger: { 'r-index': 2 }, missByFinger: { 'r-index': 5 }
  });
  ok('items は 本編だけ', r.items.length === 2, r.items.length);
  ok('count も 本編だけ', r.summary.count === 2, r.summary.count);
  ok('打ち直しの 数は ext.retry に のこる', r.ext.retry.items === 2, JSON.stringify(r.ext.retry));
  ok('本編の ミスは 打ち直しを ひいた 数', r.ext.missByKey.j === 3, JSON.stringify(r.ext.missByKey));
  ok('打ち直しの ミスも すてない', r.ext.retry.missByKey.j === 2);
  ok('本編の 指ミスも ひいた 数', r.ext.missByFinger['r-index'] === 3);
  ok('打ち直しの 時間を activeMs から ひく', r.activeMs === 118000 - 8000, r.activeMs);
  const none = build();
  ok('打ち直しが ない 回に ext.retry を つけない', none.ext.retry === undefined);
}

// ------------------------------------------------------------------
// 5. count は お題の 数（§3.9.2）
// ------------------------------------------------------------------

group('5. count が お題の 数か（§3.9.2）');
{
  const r = build({ correctKeys: 300, totalKeys: 320, missKeys: 20 });
  ok('count に 打鍵数を 入れて いない', r.summary.count === 2, r.summary.count);
  ok('打鍵数は ext.keys に ある', r.ext.keys === 320, r.ext.keys);
  ok('打鍵ベースの 正かくさは 名前を かえて ある', typeof r.ext.keyAccuracy === 'number');
  ok('お題ベースと 打鍵ベースが べつ物に なって いる',
    r.summary.firstTryCorrect !== r.ext.correctKeys);
  ok('20打より 少ない 回は さいこう記録に しない',
    build({ correctKeys: 8, totalKeys: 10 }).ext.eligibleForBest === false);
  ok('20打 いじょうなら さいこう記録に できる', r.ext.eligibleForBest === true);
}

// ------------------------------------------------------------------
// 6. 時間（§2.8・§3.9.4）
// ------------------------------------------------------------------

group('6. 時間の ものさしが 分かれて いるか（§2.8・§3.9.4）');
{
  const r = build();
  ok('activeMs は 60秒 基準の 値', r.activeMs === 118000, r.activeMs);
  ok('5秒 基準の 値は ext.typingMs に 分けて ある', r.ext.typingMs === 110000, r.ext.typingMs);
  ok('activeMs に 5秒 基準の 値が まぎれて いない', r.activeMs !== r.ext.typingMs);
  ok('Study の 無操作の しきい値は 60秒', Study.IDLE_LIMIT_MS === 60000, Study.IDLE_LIMIT_MS);

  const over = build({ activeMs60: 999999 });
  ok('activeMs は elapsedMs を こえない', over.activeMs <= over.elapsedMs, over.activeMs);

  const ch = build({
    stage: T.Lessons.buildChallengeStage('word', 60).stage,
    course: T.Lessons.CHALLENGE_COURSE,
    status: 'completed', elapsedMs: 60000, activeMs: 60000, activeMs60: 41000
  });
  ok('チャレンジは 手止まりを のぞかない（activeMs === elapsedMs）',
    ch.activeMs === ch.elapsedMs, `${ch.activeMs} / ${ch.elapsedMs}`);

  const long = build({ elapsedMs: 99 * 3600000 });
  ok('elapsedMs は 24時間で おさえる', long.elapsedMs === 86400000, long.elapsedMs);
}

// ------------------------------------------------------------------
// 7. 単元ID（§2.5・§3.9.1）
// ------------------------------------------------------------------

group('7. 単元IDが 表示名から できて いないか（§2.5・§3.9.1）');
{
  const r = build();
  ok('コースIDと ステージIDを つないで いる', r.unit.id === 'home-position-hp-1', r.unit.id);
  ok('英数小文字と ハイフンだけ', /^[a-z0-9-]+$/.test(r.unit.id), r.unit.id);

  // 表示名を かえても 単元IDは かわらない（ここが いちばん 大事な ところ）
  const renamed = JSON.parse(JSON.stringify(found.stage));
  renamed.items = found.stage.items;
  renamed.title = 'ホームポジション（１）だい1かい';
  const r2 = Study.buildRecord(result({ stage: renamed }), {});
  ok('表示名を かえても 単元IDは かわらない', r2.unit.id === r.unit.id, r2.unit.id);
  ok('表示名は unit.title に 出る', r2.unit.title.indexOf('だい1かい') >= 0, r2.unit.title);
  ok('学年が 入って いる', r.unit.grade === 1, r.unit.grade);

  const weak = build({ special: 'weak' });
  ok('にがて とっくんは weak-review', weak.unit.id === 'weak-review', weak.unit.id);
  ok('にがて とっくんの mode は weak', weak.mode === 'weak', weak.mode);
  ok('にがて とっくんの source は weak', weak.source === 'weak', weak.source);

  const ch = build({
    stage: T.Lessons.buildChallengeStage('sentence', 30).stage,
    course: T.Lessons.CHALLENGE_COURSE
  });
  ok('チャレンジは 秒数ごとに べつの 単元', ch.unit.id === 'challenge-30s', ch.unit.id);
  ok('何を 打ったかは ext.pool に ある', ch.ext.pool === 'sentence', ch.ext.pool);
  ok('チャレンジの 単元名は 秒数だけ（ID 1つに 名前 1つ）',
    ch.unit.title.indexOf('30') >= 0 && ch.unit.title.indexOf('文') < 0, ch.unit.title);

  const review = build({ source: 'review' });
  ok('ふくしゅうは source が review', review.source === 'review', review.source);
  ok('ふくしゅうでも mode は practice', review.mode === 'practice', review.mode);
}

// ------------------------------------------------------------------
// 8. 設問ID（§2.10）
// ------------------------------------------------------------------

group('8. 設問IDが きまった 値に なるか（§2.10）');
{
  ok('アルファベットの お題は そのまま', Study.questionId('ffff') === 'ffff');
  ok('かなの お題は ハッシュに なる', /^w-[0-9a-f]+$/.test(Study.questionId('がっこう')),
    Study.questionId('がっこう'));
  ok('同じ お題は いつも 同じ ID',
    Study.questionId('がっこう') === Study.questionId('がっこう'));
  ok('ちがう お題は ちがう ID',
    Study.questionId('がっこう') !== Study.questionId('こうえん'));
  ok('20文字を こえたら ハッシュ',
    /^w-/.test(Study.questionId('abcdefghijklmnopqrstuvwxyz')));
  ok('空の お題は q-empty', Study.questionId('') === 'q-empty');
  ok('設問IDに 問題文が 入って いない',
    build().items.every(it => it.q.length <= 20));

  const r = build({ items: [item('ffff', { wrong: ['d', 'k'] })] });
  ok('まちがえた 中身が のこる', r.items[0].wrong.length === 2, JSON.stringify(r.items[0]));
}

// ------------------------------------------------------------------
// 9. 保存（studyLog.js）
// ------------------------------------------------------------------

group('9. 保存の ふるまい（§5.1.2）');
{
  delete memory['study.records.v1'];
  ok('ロジック版が 見える', StudyLog.LOGIC_VERSION === '1.1', StudyLog.LOGIC_VERSION);

  const id = StudyLog.saveStudyRecord(build());
  ok('1件 のこる', !!id && JSON.parse(memory['study.records.v1']).length === 1);
  ok('id が UUID の かたち',
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id), id);

  StudyLog.saveStudyRecord(build());
  const two = JSON.parse(memory['study.records.v1']);
  ok('id は 回ごとに ちがう', two[0].id !== two[1].id);

  // こわれた データからの 立ち直り。ここが できて いないと、いちど こわれた
  // 端末は それ以降 ずっと 1件も のこせず、しかも だれも 気づけません
  memory['study.records.v1'] = '{こわれた';
  const after = StudyLog.saveStudyRecord(build());
  ok('こわれて いても 空から やり直せる',
    !!after && JSON.parse(memory['study.records.v1']).length === 1);

  memory['study.records.v1'] = '{"not":"array"}';
  StudyLog.saveStudyRecord(build());
  ok('配列で なくても 立ち直る', JSON.parse(memory['study.records.v1']).length === 1);

  // 500件を こえたら 古い ものから すてる
  const many = [];
  for (let i = 0; i < 520; i++) many.push({ schema: 'study.v1', id: `x${i}`, appId: 'typa' });
  memory['study.records.v1'] = JSON.stringify(many);
  StudyLog.saveStudyRecord(build());
  const capped = JSON.parse(memory['study.records.v1']);
  ok('500件で 止まる', capped.length === 500, capped.length);
  ok('古い ものから すてる', capped[0].id === 'x21', capped[0].id);

  ok('必須項目が 足りない ものは のこさない',
    StudyLog.saveStudyRecord({ appId: 'typa', unit: { id: 'x' }, elapsedMs: 1 }) === null);
  ok('あぶない 文字の まちがいは すてる', (() => {
    delete memory['study.records.v1'];
    StudyLog.saveStudyRecord(build({ items: [item('ffff', { wrong: ['<script>', 'd'] })] }));
    const saved = JSON.parse(memory['study.records.v1'])[0];
    return saved.items[0].wrong.length === 1 && saved.items[0].wrong[0] === 'd';
  })());
}

// ------------------------------------------------------------------
// 10. 読み出し（§5.5）
// ------------------------------------------------------------------

group('10. 読み出しの きまり（§5.5）');
{
  const mine = build();
  const other = Object.assign({}, build(), { appId: 'qalc' });
  const broken = { schema: 'other.v1', appId: 'typa' };
  memory['study.records.v1'] = JSON.stringify([mine, other, broken]);

  const list = T.StudyStats.loadRecords();
  ok('自分の アプリの ぶんだけ 読む', list.length === 1 && list[0].appId === 'typa', list.length);
  ok('schema が ちがう ものは 読まない', list.every(r => r.schema === 'study.v1'));

  memory['study.records.v1'] = '{こわれた';
  ok('こわれて いたら 空の 配列', T.StudyStats.loadRecords().length === 0);

  // 自己評価・ふたりで つかった 回は 学力の 目やすに 入れない
  ok('objective 以外は 正答率に 入れない',
    T.StudyStats.scorable({ grading: 'selfReport', summary: { attempted: 5 } }) === false);
  ok('multiplayer は 正答率に 入れない',
    T.StudyStats.scorable({ grading: 'objective', multiplayer: true, summary: { attempted: 5 } }) === false);

  // 切り詰めた 回は、ほんとうの 解答数で 数える（§2.7 の 警告）
  const today = new Date().toISOString();
  const truncated = Object.assign(build({
    items: Array.from({ length: 260 }, (_, i) => item(`w${i}`, { firstTry: i < 130 }))
  }), { startedAt: today });
  memory['study.records.v1'] = JSON.stringify([truncated]);
  const sum = T.StudyStats.summary(7);
  ok('切り詰めた 回は ext の ほんとうの 数で 数える',
    sum.attempted === 260 && sum.firstTryCorrect === 130,
    `${sum.attempted} / ${sum.firstTryCorrect}`);
  ok('お題の 合計は count の 合計', sum.items === 260, sum.items);

  // 読み出しは 書きかえない
  const before = memory['study.records.v1'];
  T.StudyStats.summary(7);
  T.StudyStats.byUnit(1);
  ok('読んでも 中身は かわらない', memory['study.records.v1'] === before);
}

// ------------------------------------------------------------------
// 11. status（§5.4・§3.9）
// ------------------------------------------------------------------

group('11. 中断の あつかい（§5.4・§3.9）');
{
  ok('ひとまわりの とちゅうで やめたら aborted',
    build({ laps: 0, lapPos: 3 }).status === 'aborted');
  ok('ひとまわり できた ところで やめたら completed',
    build({ laps: 1, lapPos: 0 }).status === 'completed');
  ok('ひとまわりの あと さらに 打って やめたら aborted',
    build({ laps: 1, lapPos: 2 }).status === 'aborted');
  ok('チャレンジは 時間切れで completed',
    build({
      stage: T.Lessons.buildChallengeStage('word', 60).stage,
      course: T.Lessons.CHALLENGE_COURSE, status: 'completed'
    }).status === 'completed');
  ok('チャレンジを とちゅうで やめたら aborted',
    build({
      stage: T.Lessons.buildChallengeStage('word', 60).stage,
      course: T.Lessons.CHALLENGE_COURSE, status: 'stopped'
    }).status === 'aborted');
  ok('タブが とじられた 回（left）も きろくに のこる かたち',
    accepts(build({ status: 'left' })).length === 0);
}

// ------------------------------------------------------------------
// 12. リセット・書き出しで 学習ログを こわさない（§1.2）
// ------------------------------------------------------------------

group('12. リセットと 書き出しが 学習ログに さわらないか（§1.2）');
{
  require(path.join(__dirname, '..', 'src', 'backup.js'));

  Object.keys(memory).forEach(k => delete memory[k]);
  memory['study.records.v1'] = JSON.stringify([build()]);
  memory['typa.history.v1'] = JSON.stringify([{ at: '2026-07-30T00:00:00.000Z', correctKeys: 10 }]);
  memory['typa.progress.v1'] = JSON.stringify({ 'hp-1': { clears: 1 } });

  T.Store.clearRecords();
  ok('「きろくを けす」で 学習ログを 消さない', !!memory['study.records.v1']);
  ok('typa.* の きろくは ちゃんと 消える', !memory['typa.history.v1']);

  const dump = JSON.stringify(T.Backup.buildExport('9.9.9'));
  ok('書き出しに 学習ログを 入れない', dump.indexOf('study.records.v1') < 0);

  const before = memory['study.records.v1'];
  T.Backup.applyImport({ 'typa.history.v1': [] });
  ok('読みこみ（置きかえ）でも 学習ログは のこる',
    memory['study.records.v1'] === before);
}

// ------------------------------------------------------------------

console.log(`\n${failed === 0 ? 'すべて OK' : `${failed} 件 NG`}`);
process.exit(failed === 0 ? 0 : 1);
