/**
 * =====================================================================
 * check-lessons.js — お題が ほんとうに 打てるかを たしかめる
 * =====================================================================
 * つかいかた:
 *
 *   node tools/check-lessons.js
 *
 * lessons.js の ことばや 文を 手なおししたら、かならず これを 走らせてください。
 *
 * ■ なぜ ひつようか
 * お題の `k`（打つ 文字）に **漢字が まざって いても、画面は ふつうに 出ます**。
 * ところが ローマ字エンジンは 知らない 文字を「そのまま 1打」として あつかうので、
 * 児童は その 漢字そのものを 打たない かぎり 先へ すすめません。
 * 目で 見ても 気づきにくく、じゅぎょうの まん中で 手が 止まります。
 *
 * そこで この スクリプトは、ぜんぶの お題を **さいごまで 打ちとおして**
 * つぎの 3つを たしかめます。
 *
 *   1. どの 1打も「つぎに 押す キー」が 出るか
 *   2. その キーが JIS と US の どちらの 配列にも あるか
 *   3. その キーに 指の わりあてが あるか（ないと 指の 案内が 消えます）
 *
 * 漢字は `k` では なく、第2引数（画面に 出す ことば）に 書いてください。
 *   w('ひとと はなす。', '人と はなす。')
 */
'use strict';

const path = require('path');

// ブラウザむけの ファイルを そのまま よみこむため、window を 用意します
global.window = global;
require(path.join(__dirname, '..', 'js', 'romaji.js'));
require(path.join(__dirname, '..', 'js', 'layout.js'));
require(path.join(__dirname, '..', 'js', 'lessons.js'));

const { Romaji, Layout, Lessons } = global.Typa;
const LAYOUT_IDS = Object.keys(Layout.LAYOUTS);

const problems = [];
let checked = 0;

/** お題を 1つ、さいごまで 打ちとおします */
function drive(text, where) {
  checked++;
  const m = Romaji.createMatcher(text);
  for (let guard = 0; guard < 1000; guard++) {
    if (m.isFinished()) return;
    const ch = m.expected();
    if (!ch) {
      problems.push(`${where}「${text}」… つぎに 押す キーが 出ません`);
      return;
    }
    LAYOUT_IDS.forEach(id => {
      const found = Layout.findKey(id, ch);
      if (!found) problems.push(`${where}「${text}」… "${ch}" が ${id} の キーボードに ありません`);
      else if (!Layout.fingerOf(found.key.code)) {
        problems.push(`${where}「${text}」… "${ch}"（${found.key.code}）に 指の わりあてが ありません`);
      }
    });
    if (!m.input(ch).ok) {
      problems.push(`${where}「${text}」… "${ch}" が はじかれました`);
      return;
    }
  }
  problems.push(`${where}「${text}」… おわりません`);
}

// --- ふつうの コースと ステージ ---
Lessons.COURSES.forEach(course => {
  course.stages.forEach(stage => {
    (stage.items || []).forEach(item => drive(item.k, `${course.id}/${stage.id} `));
  });
});

// --- チャレンジ（お題は コースから 組み立てられます） ---
Lessons.CHALLENGE_POOLS.forEach(pool => {
  const built = Lessons.buildChallengeStage(pool.id, 60);
  if (!built) { problems.push(`チャレンジ「${pool.id}」の お題が からです`); return; }
  built.stage.items.forEach(item => drive(item.k, `challenge/${pool.id} `));
});

// --- にがて とっくん（ありうる にがてキーで ためします） ---
const sample = ['p', 'q', 'z', ';', '.', '8', 'x', 'w'];
const weak = Lessons.buildWeakStage(sample);
if (!weak) problems.push('にがて とっくんが 組み立てられません');
else weak.stage.items.forEach(item => drive(item.k, 'weak '));

// --- ショートカット課題の 中身 ---
Object.keys(Lessons.SHORTCUT_TASKS).forEach(group => {
  Lessons.SHORTCUT_TASKS[group].forEach(task => {
    if (!task.combo || !task.combo.code) problems.push(`shortcut/${group}/${task.id} … combo が ありません`);
    if (task.type === 'do' && !task.check) problems.push(`shortcut/${group}/${task.id} … check が ありません`);
    if (!task.instruct || !task.hint) problems.push(`shortcut/${group}/${task.id} … 説明が 足りません`);
  });
});

// ------------------------------------------------------------------
// ★3つを とった あとの 行き先
// ------------------------------------------------------------------
//
// ★3つに なると その ばで つぎの ステージに 入れかわります（js/play.js）。
// ここが ずれると、**できたのに 同じ ステージに とどまる**か、
// **もう ★3の ところへ 送られる**か、どちらかが しずかに 起きます。
// どちらも「打てて いる のに 手ごたえが ない」形に なります。

function nextOf(stageId, doneIds) {
  const done = new Set(doneIds || []);
  const r = Lessons.nextStageAfter(stageId, id => done.has(id));
  return r ? r.stage.id : null;
}

function want(got, expect, what) {
  checked++;
  if (got !== expect) problems.push(`${what} … ${JSON.stringify(expect)} の はずが ${JSON.stringify(got)}`);
}

const ALL = [];
Lessons.COURSES.forEach(c => c.stages.forEach(s => ALL.push(s)));
const TYPING = ALL.filter(s => s.mode !== 'shortcut' && !s.noStars).map(s => s.id);

want(nextOf('hp-1', []), 'hp-2', 'すぐ つぎの ステージへ');
want(nextOf('hp-1', ['hp-2', 'hp-3']), 'hp-4', 'もう ★3の ステージは とばす');

// コースの さいごまで いったら、つぎの コースの さいしょへ つながります
const lastOfFirst = Lessons.COURSES[0].stages[Lessons.COURSES[0].stages.length - 1].id;
want(nextOf(lastOfFirst, []), Lessons.COURSES[1].stages[0].id, 'コースを またいで つながる');

// うしろが ぜんぶ ★3なら、先頭に もどって まだの ところへ
want(nextOf(TYPING[TYPING.length - 1], TYPING.slice(1)), TYPING[0],
  'うしろが ぜんぶ ★3なら 先頭の まだの ところへ');

// ぜんぶ ★3なら もう 行き先は ありません（そこから「そのさき」の 時期に なります）
want(nextOf('hp-1', TYPING), null, 'ぜんぶ ★3なら 入れかえない');

// ショートカットには 送りません（打鍵の れんしゅうの とちゅうに 出て きては こまります）
const scIds = ALL.filter(s => s.mode === 'shortcut').map(s => s.id);
checked++;
if (scIds.length === 0) problems.push('ショートカットの ステージが ありません');
TYPING.forEach(id => {
  const to = nextOf(id, TYPING.filter(x => x !== id));
  checked++;
  if (to !== null && scIds.indexOf(to) >= 0) problems.push(`${id} から ショートカット（${to}）へ 送られました`);
});

// 知らない ステージIDでも 落ちない（お題を 入れかえた あとの きろくで 起きます）
want(nextOf('nope', []), ALL[0].id, '知らない ステージIDでも 先頭から さがす');

// ★3に する たびに 行き先が へって、いつか かならず おわる
checked++;
{
  const done = new Set();
  let at = TYPING[0];
  let guard = 0;
  while (guard++ < TYPING.length + 5) {
    done.add(at);
    const r = Lessons.nextStageAfter(at, id => done.has(id));
    if (!r) break;
    at = r.stage.id;
  }
  if (guard > TYPING.length + 1) problems.push('★3に して いっても 行き先が つきません（ぐるぐる まわります）');
  if (done.size !== TYPING.length) {
    problems.push(`ぜんぶの ステージを とおりません（${done.size} / ${TYPING.length}）`);
  }
}

// --- ステージIDの かぶりが ないか ---
const seen = {};
Lessons.COURSES.forEach(course => course.stages.forEach(stage => {
  if (seen[stage.id]) problems.push(`ステージID「${stage.id}」が かぶって います`);
  seen[stage.id] = true;
}));

console.log(`しらべた お題: ${checked}`);
if (problems.length === 0) {
  console.log('すべて 打てます。指の わりあても そろって います。');
  process.exit(0);
}
[...new Set(problems)].forEach(p => console.log(' - ' + p));
console.log(`\n${problems.length} 件 見つかりました。`);
process.exit(1);
