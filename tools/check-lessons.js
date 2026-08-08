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
