#!/usr/bin/env node
/**
 * =====================================================================
 * self-test.mjs — 検査そのものが 動いて いるかを たしかめる
 * =====================================================================
 *
 *   node scripts/self-test.mjs
 *
 * ■ なぜ 要るのか
 * 「0件でした」だけでは、**検査が 動いて いるのか、何も 見て いないのか**
 * 区別が つきません。GIGA Standard v5 では、この たしかめを した ことで
 * 共通の 検査そのものの 不具合が 3件 見つかって います。
 *
 * ここでは リポジトリを 一時フォルダに まるごと 写し、検査ごとに
 * **わざと 1か所 こわして**、その 検査が ちゃんと 落ちるかを 見ます。
 * 落ちなければ、その 検査は 何も 見て いません。
 *
 * 元の リポジトリには いっさい さわりません。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECKS, runGigaChecks } from './lib/giga-v5-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 検査ID → わざと こわす やりかた */
const BREAKAGES = {
  A_LICENSE:        (d) => fs.rmSync(path.join(d, 'LICENSE')),
  A_GITIGNORE:      (d) => write(d, '.gitignore', 'dist/\n'),
  A_DEPENDABOT:     (d) => fs.rmSync(path.join(d, '.github/dependabot.yml')),
  A_CI_ON_PR:       (d) => write(d, '.github/workflows/ci.yml', 'name: check\non:\n  push:\n    branches: [main]\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps: []\n'),
  A_DOCS:           (d) => fs.rmSync(path.join(d, 'README.md')),
  B_NO_CDN_CODE:    (d) => edit(d, 'index.html', (s) => s.replace('</head>', '<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>\n</head>')),
  B_CSP:            (d) => edit(d, 'index.html', (s) => s.replace("script-src 'self';", "script-src 'self' 'unsafe-inline';")),
  B_NO_INLINE_SCRIPT: (d) => edit(d, 'index.html', (s) => s.replace('</body>', '<script>console.log(1)</script>\n</body>')),
  C_NO_LS_CLEAR:    (d) => edit(d, 'js/store.js', (s) => s + '\nfunction wipeAll(){ localStorage.clear(); }\n'),
  C_PAGEHIDE:       (d) => forEachJs(d, (s) => s.replace(/addEventListener\((\s*)'pagehide'/g, "addEventListener($1'blur'")),
  C_NO_POSTMESSAGE_STAR: (d) => edit(d, 'js/app.js', (s) => s + "\nfunction leak(w){ w.postMessage({a:1}, '*'); }\n"),
  D_VIEWPORT:       (d) => edit(d, 'index.html', (s) => s.replace('user-scalable=yes', 'user-scalable=no')),
  D_DVH:            (d) => edit(d, 'css/style.css', (s) => s + '\n.leftover { height: 100vh; }\n'),
  D_SAFE_AREA:      (d) => forEachCss(d, (s) => s.replace(/env\(\s*safe-area-inset[^)]*\)/g, '0px')),
  // 「notclamp(」に すると /clamp\(/ が まだ 当たって しまい、
  // こわした つもりで こわせて いません（最初に 踏みました）
  D_FLUID_TYPE:     (d) => forEachCss(d, (s) => s.replace(/clamp\(/g, 'calc(')),
  D_CANVAS_DPR:     (d) => edit(d, 'js/fx.js', (s) => s + "\nfunction draw(c){ const ctx = c.getContext('2d'); ctx.fillRect(0,0,1,1); }\n"),
  D_REDUCED_MOTION: (d) => edit(d, 'css/style.css', (s) => s.replace('animation-duration: .001ms !important;', 'animation-duration: 0 !important;')),
  D_FORCED_COLORS:  (d) => forEachCss(d, (s) => s.replace(/forced-colors\s*:\s*active/g, 'min-width: 1px')),
  D_RT_COLOR:       (d) => edit(d, 'css/style.css', (s) => s + '\nrt { color: #666; }\n'),
  // 「ファイルを えらぶ」が マウスでしか 押せなかった 形に もどします
  F_LABEL_FOR_TABBABLE: (d) => edit(d, 'js/app.js', (s) =>
    s.replace('<input type="file" id="bk-file" accept="application/json,.json" class="file-pick-input">',
      '<input type="file" id="bk-file" accept="application/json,.json" hidden>')),
  // "./" は 独自ドメインでも サブディレクトリ配信でも 正しく 解決されるので、もう こわれた 形では ない。
  // 配信場所と 食いちがう 絶対パス（CNAME が あるのに /Typa/ の まま）が いまの こわれかた。
  E_MANIFEST_ID:    (d) => editJson(d, 'manifest.webmanifest', (j) => { j.id = '/Typa/'; j.scope = '/Typa/'; j.start_url = '/Typa/'; }),
  // 目に 見えない BOM。テストで 押さえて おかないと 二度と 気づけない。
  E_CNAME:          (d) => write(d, 'CNAME', '﻿typa.giga-school.com\n'),
  E_ICONS:          (d) => editJson(d, 'manifest.webmanifest', (j) => { j.icons = j.icons.filter((i) => !(i.purpose || '').includes('maskable')); }),
  E_SW_CACHE_SCOPE: (d) => edit(d, 'sw.js', (s) => s.replace(/\.filter\(k => k\.startsWith\(CACHE_PREFIX\) && k !== VERSION\)/, '.filter(k => k !== VERSION)')),
  E_SW_NO_LOCALSTORAGE: (d) => edit(d, 'sw.js', (s) => s + "\nself.addEventListener('sync', () => { localStorage.setItem('x','1'); });\n"),
  E_SW_NO_SKIP_WAITING_ON_INSTALL: (d) => edit(d, 'sw.js', (s) => s.replace("self.addEventListener('install', event => {\n  event.waitUntil(", "self.addEventListener('install', event => {\n  self.skipWaiting();\n  event.waitUntil(")),
  E_SW_UPDATE_PROMPT: (d) => forEachJs(d, (s) => s.replace(/SKIP_WAITING/g, 'NOPE_WAITING')),
  E_SW_REGISTER_READYSTATE: (d) => edit(d, 'js/app.js', (s) => s.replace(/if \(document\.readyState === 'complete'\) start\(\);\s*\n\s*else /, '')),
  E_OFFLINE_HTML:   (d) => edit(d, 'offline.html', (s) => s.replace('</body>', '<script>location.reload()</script>\n</body>')),
  E_SW_PRECACHE_OFFLINE: (d) => edit(d, 'sw.js', (s) => s.replace(/^\s*'\.\/offline\.html',\n/m, '')),
  E_MASKABLE_SAFE_ZONE: (d) => makeTransparentPng(path.join(d, 'icons/icon-maskable-512.png')),
  F_FILE_SIZE:      (d) => write(d, 'js/huge.js', '// ' + 'x'.repeat(10) + '\n'.repeat(1) + Array(5100).fill('// ぎょう').join('\n')),
  F_IMG_SIZE:       (d) => fs.writeFileSync(path.join(d, 'icons/big.png'), Buffer.alloc(200 * 1024)),
  F_IMG_DIMENSIONS: (d) => edit(d, 'index.html', (s) => s.replace('</body>', '<img src="./icons/icon-192.png">\n</body>')),
};

// ---------------------------------------------------------------- 道具
function write(d, rel, s) { fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true }); fs.writeFileSync(path.join(d, rel), s); }
function edit(d, rel, fn) {
  const p = path.join(d, rel);
  const before = fs.readFileSync(p, 'utf8');
  const after = fn(before);
  if (after === before) throw new Error(`${rel} を こわせませんでした（置きかえる 文字列が 見つからない）`);
  fs.writeFileSync(p, after);
}
function editJson(d, rel, fn) {
  const p = path.join(d, rel);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  fn(j);
  fs.writeFileSync(p, JSON.stringify(j, null, 2));
}
function forEachJs(d, fn) {
  let changed = false;
  for (const f of fs.readdirSync(path.join(d, 'js'))) {
    const p = path.join(d, 'js', f);
    const before = fs.readFileSync(p, 'utf8');
    const after = fn(before);
    if (after !== before) { fs.writeFileSync(p, after); changed = true; }
  }
  if (!changed) throw new Error('js/ を こわせませんでした');
}
function forEachCss(d, fn) {
  let changed = false;
  for (const f of fs.readdirSync(path.join(d, 'css'))) {
    const p = path.join(d, 'css', f);
    const before = fs.readFileSync(p, 'utf8');
    const after = fn(before);
    if (after !== before) { fs.writeFileSync(p, after); changed = true; }
  }
  if (!changed) throw new Error('css/ を こわせませんでした');
}
/** 四すみに 透明を 1画素 足した PNG を 作る（RGBA・無圧縮フィルタ） */
function makeTransparentPng(dest) {
  const zlib = require$('node:zlib');
  const size = 8;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0];
    for (let x = 0; x < size; x++) row.push(30, 78, 216, (x === 0 && y === 0) ? 0 : 255);
    rows.push(Buffer.from(row));
  }
  const raw = Buffer.concat(rows);
  const chunk = (tag, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(tag, 'latin1'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(dest, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]));
}
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c;
}
import { createRequire } from 'node:module';
const require$ = createRequire(import.meta.url);

// ---------------------------------------------------------------- 本体
function copyRepo() {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'giga-selftest-'));
  // CNAME も 写すこと。E_MANIFEST_ID は「CNAME が あるか」で 正しい 値が 変わるため、
  // 写し忘れると 独自ドメイン側の 判定が まるごと 検査されない。
  for (const rel of ['index.html', 'offline.html', 'sw.js', 'install-hook.js', 'manifest.webmanifest',
    'CNAME', 'LICENSE', '.gitignore', 'README.md', 'MANUAL.md', 'AUDIT.md', 'package.json']) {
    const src = path.join(ROOT, rel);
    if (fs.existsSync(src)) { fs.mkdirSync(path.dirname(path.join(dest, rel)), { recursive: true }); fs.copyFileSync(src, path.join(dest, rel)); }
  }
  for (const dir of ['js', 'css', 'icons', '.github/workflows', '.github']) {
    const src = path.join(ROOT, dir);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(path.join(dest, dir), { recursive: true });
    for (const f of fs.readdirSync(src)) {
      const full = path.join(src, f);
      if (fs.statSync(full).isFile()) fs.copyFileSync(full, path.join(dest, dir, f));
    }
  }
  return dest;
}

const base = copyRepo();
const baseline = runGigaChecks(base);
const baseFail = baseline.filter((r) => !r.ok).map((r) => r.id);
if (baseFail.length) {
  console.log('⚠️  こわす まえから 落ちて いる 検査が あります: ' + baseFail.join(', '));
  console.log('    （その 検査は「こわしたら 落ちる」の たしかめが できません）\n');
}

let bad = 0;
let done = 0;
for (const check of CHECKS) {
  const breaker = BREAKAGES[check.id];
  if (!breaker) { console.log(`⚠️  ${check.id.padEnd(34)} こわしかたが 決めて ありません`); bad++; continue; }
  if (baseFail.includes(check.id)) { console.log(`--  ${check.id.padEnd(34)} もともと 落ちて いる ため 見おくり`); continue; }

  const dir = copyRepo();
  let err = null;
  try { breaker(dir); } catch (e) { err = e.message; }
  if (err) { console.log(`❌ ${check.id.padEnd(34)} こわせませんでした: ${err}`); bad++; fs.rmSync(dir, { recursive: true, force: true }); continue; }

  const after = runGigaChecks(dir).find((r) => r.id === check.id);
  done++;
  if (after.ok) { console.log(`❌ ${check.id.padEnd(34)} こわしたのに 通りました（この 検査は 何も 見て いません）`); bad++; }
  else console.log(`✅ ${check.id.padEnd(34)} こわしたら 落ちました`);
  fs.rmSync(dir, { recursive: true, force: true });
}
fs.rmSync(base, { recursive: true, force: true });

console.log(`\n${done} 件の 検査が「こわしたら 落ちる」ことを たしかめました。`);
if (bad) { console.log(`${bad} 件に 問題が あります。`); process.exit(1); }
console.log('検査は ぜんぶ 動いて います。');
