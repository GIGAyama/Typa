#!/usr/bin/env node
/**
 * =====================================================================
 * check-project.mjs — 品質ゲート（CI と 手もとで 同じ ものを 走らせます）
 * =====================================================================
 *
 *   npm run check
 *
 * 2つの 検査を 合成します。
 *
 *   1. Part I の 検査（scripts/lib/giga-v5-checks.mjs）
 *      GIGA Standard v5 の 共通の 決まりごと。ほかの リポジトリと 同じ 中身で、
 *      正本が 更新されたら **ファイルごと 差しかえ** られる 形に して あります。
 *   2. アプリの 中身の 検査（tools/check-*.js）
 *      Typa 固有。お題が ほんとうに 打てるか、記録の 計算が 合って いるか。
 *
 * ■ 「0件でした」だけでは 検査が 動いて いるか 分かりません
 * わざと 壊して 落ちる ことを たしかめる ための 目印を 用意して います。
 *
 *   node scripts/check-project.mjs --self-test
 *
 * これは 一時ファイルを 作って 各 検査を わざと 落とし、
 * **ぜんぶの 検査が ほんとうに 反応する か**を 見ます。
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runGigaChecks, CHECKS } from './lib/giga-v5-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --self-test は べつの スクリプトに 委ねます（元の リポジトリを こわさない ため、
// 一時フォルダに 写して から わざと 壊します）
if (process.argv.includes('--self-test')) {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/self-test.mjs')], { stdio: 'inherit' });
  process.exit(0);
}

const APP_CHECKS = [
  ['お題が ほんとうに 打てるか', 'tools/check-lessons.js'],
  ['にがて判定の 計算',         'tools/check-mastery.js'],
  ['すすみぐあいの 計算',       'tools/check-progress.js'],
  ['ふくしゅうの えらびかた',   'tools/check-review.js'],
  ['学習ログ study.v1',         'tools/check-study.js'],
  ['きろくの もちだし',         'tools/check-backup.js'],
];

function heading(s) { console.log('\n=== ' + s + ' ==='); }

let failed = 0;

// ---------------------------------------------------------------- Part I
heading('GIGA Standard v5 — Part I の 検査');
const results = runGigaChecks(ROOT);
for (const r of results) {
  const mark = r.ok ? '✅' : '❌';
  console.log(`${mark} ${r.id.padEnd(22)} ${r.title}`);
  if (!r.ok) { failed++; for (const d of r.detail) console.log('     ↳ ' + d); }
}

// ---------------------------------------------------------------- アプリ
heading('Typa の 中身の 検査');
for (const [title, rel] of APP_CHECKS) {
  try {
    execFileSync(process.execPath, [path.join(ROOT, rel)], { stdio: 'pipe' });
    console.log('✅ ' + title);
  } catch (e) {
    failed++;
    console.log('❌ ' + title);
    const out = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
    for (const line of out.trim().split('\n').slice(-12)) console.log('     ↳ ' + line);
  }
}

heading('けっか');
if (failed === 0) {
  console.log(`検査 ${results.length + APP_CHECKS.length} 件、すべて 通りました。`);
  console.log('（検査そのものが 動いて いる ことは `node scripts/check-project.mjs --self-test` で たしかめられます）');
  process.exit(0);
}
console.log(`${failed} 件 落ちました。`);
console.log('Part I の 検査の 意味は scripts/lib/giga-v5-checks.mjs の 各 check の 説明を 見て ください。');
process.exit(1);
