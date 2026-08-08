#!/usr/bin/env node
/**
 * =====================================================================
 * measure.mjs — 見た目を 実さいの ブラウザで 測る（Part I §7-1, §7-2）
 * =====================================================================
 *
 *   npm i -D playwright && npx playwright install chromium
 *   node scripts/measure/measure.mjs
 *
 * ぜんぶの 画面を 歩いて、つぎを 測ります。
 *
 *   ・文字と 地の コントラスト（4.5 / 大きい 字は 3.0）
 *   ・さわれる 大きさ（44px。疑似要素の 当たり判定 こみ）
 *   ・320px はばで よこスクロールが 出ないか
 *   ・JS エラー・CSP違反
 *
 * ■ 色の 読みかたに 注意（§7-2）
 * `getComputedStyle().color` の 文字を 数字で 拾っては いけません。
 * oklch() や color-mix() が そのまま 返って きて、うまく 読めません。
 * **1px 実さいに 塗って getImageData で 読む** のが いちばん たしかです。
 * Typa は キーの 地に color-mix() を つかって いるので、ここは 必須です。
 *
 * ■ そのほかの 落とし穴（実さいに 踏んだ もの）
 *   ・親の opacity は 子の computed color に 出ません。さかのぼって 掛けます。
 *     これを 見て いなかった ころ、opacity: .62 の 行を 見のがして いました。
 *   ・出て くる とちゅう（opacity: 0 の アニメーション）を 測ると、
 *     ぜんぶ 比 1.0 の 誤報に なります。落ちついてから 測ります。
 *   ・絵文字は フォント 自身の 色で 描かれ、CSS の color が 効きません。除きます。
 *   ・つかえない 状態（disabled）は WCAG の 対象外です。除きます。
 *
 * ■ ここで 測れない もの
 * 打って いる とちゅうにしか 出ない 色（○×の しるし・つぎの キー・シフト中）は
 * この スクリプトでは 出ません。scripts/measure/typing.mjs で 測ります。
 */
import { launchBrowser } from './launch.mjs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const REPO = path.basename(ROOT);
const PORT = Number(process.env.PORT || 8802);
const BASE = `http://127.0.0.1:${PORT}/${REPO}/`;

/** 見る 画面。Typa は 画面遷移で 中身を 入れかえるので Nav から 呼びます */
const SCREENS = [
  ['うつ（ひらいた ところ）', (p) => p.evaluate(() => window.Typa.Nav.selectTab('play'))],
  ['えらぶ',                  (p) => p.evaluate(() => window.Typa.Nav.selectTab('menu'))],
  ['コース一覧',              (p) => p.evaluate(() => window.Typa.Nav.go('courses', {}))],
  ['チャレンジ',              (p) => p.evaluate(() => window.Typa.Nav.go('challenge', {}))],
  ['きろく',                  (p) => p.evaluate(() => window.Typa.Nav.selectTab('records'))],
  ['バッジ',                  (p) => p.evaluate(() => window.Typa.Nav.go('badges', {}))],
  ['せってい',                (p) => p.evaluate(() => window.Typa.Nav.selectTab('settings'))],
  ['ローマ字ひょう',          (p) => p.evaluate(() => window.Typa.Nav.go('romaji-table', {}))],
  ['きろくを もちだす',       (p) => p.evaluate(() => window.Typa.Nav.go('backup', {}))],
  ['うつ（指の色分け OFF）',  (p) => p.evaluate(() => {
    document.querySelectorAll('.kb').forEach((k) => k.classList.remove('show-finger'));
    window.Typa.Nav.selectTab('play');
  })],
];

/** ページの 中で 走る 本体 */
function probe() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const parse = (s) => {
    if (!s) return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    try { ctx.fillStyle = s; } catch (e) { return null; }
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    const a = d[3] / 255;
    return a === 0 ? null : [d[0], d[1], d[2], a];
  };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); const [h, l] = x > y ? [x, y] : [y, x]; return (h + 0.05) / (l + 0.05); };
  const over = (fg, bg) => { const a = fg[3]; return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1]; };

  // グラデーションの 地は backgroundColor が 透明に なります。
  // 見ないと「白の 上の 白（比 1.0）」という 誤報に なります。
  const gradient = (el) => {
    const bi = getComputedStyle(el).backgroundImage;
    if (!bi || bi === 'none') return null;
    const cols = bi.match(/(?:rgba?|oklch|oklab|lab|lch|color|hsla?)\([^()]*(?:\([^()]*\))?[^()]*\)|#[0-9a-f]{3,8}/gi);
    const ok = (cols || []).map(parse).filter(Boolean).filter((c) => c[3] > 0.1);
    if (!ok.length) return null;
    ok.sort((a, b) => lum(a) - lum(b));
    return ok[0];   // いちばん 暗い ところ ＝ いちばん きびしい ところ で 見ます
  };
  const background = (el) => {
    const layers = [];
    let n = el;
    while (n && n.nodeType === 1) {
      const g = gradient(n);
      if (g) { layers.push(g); break; }
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0.99) { layers.push(c); break; }
      if (c && c[3] > 0.01) layers.push(c);
      n = n.parentElement;
    }
    if (!layers.length || layers[layers.length - 1][3] < 0.99) layers.push([255, 255, 255, 1]);
    let base = layers[layers.length - 1];
    for (let i = layers.length - 2; i >= 0; i--) base = over(layers[i], base);
    return base;
  };
  // 親の opacity は 子の computed color には 出ません
  const chainOpacity = (el) => {
    let o = 1, n = el;
    while (n && n.nodeType === 1) { o *= parseFloat(getComputedStyle(n).opacity || '1'); n = n.parentElement; }
    return o;
  };
  const name = (el) => el.tagName.toLowerCase()
    + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '');

  const EMOJI = /\p{Extended_Pictographic}/u;
  const out = { contrast: [], tap: [] };
  const seen = new Set();

  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (el.closest('[aria-hidden="true"]')) continue;

    let text = '';
    for (const n of el.childNodes) if (n.nodeType === 3) text += n.nodeValue;
    text = text.trim();
    const op = chainOpacity(el);
    const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true'
      || el.closest('[disabled],[aria-disabled="true"],.is-disabled,.is-locked') !== null
      || cs.cursor === 'not-allowed';

    // op が 0 ＝ まだ 出て きて いない（見えて いない）。測っても 意味が ありません
    if (text && !EMOJI.test(text) && !disabled && op > 0.05) {
      const raw = parse(cs.color);
      if (raw) {
        const bg = background(el);
        const fg = raw[3] * op < 0.99 ? over([raw[0], raw[1], raw[2], raw[3] * op], bg) : raw;
        const fs = parseFloat(cs.fontSize);
        const wt = parseInt(cs.fontWeight, 10) || 400;
        const need = (fs >= 24 || (fs >= 18.66 && wt >= 700)) ? 3 : 4.5;
        const got = ratio(fg, bg);
        if (got < need - 0.005) {
          out.contrast.push({
            sel: name(el), text: text.slice(0, 20), got: Math.round(got * 100) / 100, need,
            fs: Math.round(fs * 10) / 10, wt, op: Math.round(op * 100) / 100,
            color: cs.color, bg: 'rgb(' + bg.slice(0, 3).map(Math.round).join(',') + ')',
          });
        }
      }
    }

    if (el.matches('a[href],button,input:not([type=hidden]),select,textarea,[role="button"],[tabindex]:not([tabindex="-1"])')) {
      const key = name(el) + '|' + Math.round(r.x) + ',' + Math.round(r.y);
      if (seen.has(key)) continue;
      seen.add(key);
      let w = r.width, h = r.height;
      // 疑似要素で 当たり判定だけ ひろげて いる ことが あります
      for (const pe of ['::after', '::before']) {
        const p = getComputedStyle(el, pe);
        if (!p.content || p.content === 'none' || p.position !== 'absolute') continue;
        for (const v of [p.width, p.minWidth]) { const n2 = parseFloat(v); if (!isNaN(n2)) w = Math.max(w, n2); }
        for (const v of [p.height, p.minHeight]) { const n2 = parseFloat(v); if (!isNaN(n2)) h = Math.max(h, n2); }
      }
      // input は 疑似要素を もてません。囲みの <label> の 大きさで 見ます
      const lab = el.tagName === 'INPUT' ? el.closest('label') : null;
      if (lab) { const lr = lab.getBoundingClientRect(); w = Math.max(w, lr.width); h = Math.max(h, lr.height); }
      if (w < 43.5 || h < 43.5) {
        out.tap.push({
          sel: name(el), text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20),
          w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10,
        });
      }
    }
  }
  return out;
}

const VIEWPORTS = [
  ['Chromebook 1366×768 / あかるい', { width: 1366, height: 768 }, 'light'],
  ['Chromebook 1366×768 / くらい',   { width: 1366, height: 768 }, 'dark'],
  ['さいしょうはば 320×568',          { width: 320, height: 568 }, 'light'],
  ['iPad 810×1080',                   { width: 810, height: 1080 }, 'light'],
];

const server = spawn(process.execPath, [path.join(HERE, 'server.mjs'), path.resolve(ROOT, '..'), String(PORT)], { stdio: 'ignore' });
await new Promise((s) => setTimeout(s, 900));

const total = { contrast: 0, tap: 0, overflow: 0, errors: 0 };
const browser = await launchBrowser();
for (const [label, viewport, scheme] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: scheme });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  console.log('\n########## ' + label + ' ##########');

  let c = 0, t = 0, ov = 0;
  for (const [title, go] of SCREENS) {
    try { await go(page); } catch (e) { console.log(`  ⚠️ ${title}: 到達できません ${String(e).slice(0, 60)}`); continue; }
    await page.waitForTimeout(1000);   // 出て くる アニメーションが 落ちつくまで 待ちます
    const r = await page.evaluate(probe);
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    if (w[0] > w[1] + 1) { ov++; console.log(`  ❌ ${title}: よこスクロール ${w[0]} > ${w[1]}`); }
    c += r.contrast.length; t += r.tap.length;
    if (r.contrast.length || r.tap.length) {
      console.log(`  ${title}: コントラスト ${r.contrast.length}件 / タップ ${r.tap.length}件`);
      const uniq = new Map();
      for (const x of r.contrast) uniq.set(x.sel + x.got, x);
      for (const x of uniq.values()) console.log(`     [C] ${x.got}（要 ${x.need}） ${x.fs}px/${x.wt} op=${x.op} 「${x.text}」 ${x.color} on ${x.bg}  ${x.sel}`);
      for (const x of r.tap) console.log(`     [T] ${x.w}×${x.h} 「${x.text}」  ${x.sel}`);
    }
  }
  console.log(`  == コントラスト ${c}件 / タップ ${t}件 / よこスクロール ${ov}件 / JSエラー・CSP違反 ${errors.length}件`);
  errors.slice(0, 5).forEach((e) => console.log('     ' + e));
  total.contrast += c; total.tap += t; total.overflow += ov; total.errors += errors.length;
  await ctx.close();
}
await browser.close();
server.kill('SIGKILL');

console.log('\n===== 合計 =====');
console.log(`コントラスト基準未満 ${total.contrast}件 / タップ44px未満 ${total.tap}件`);
console.log(`よこスクロール ${total.overflow}件 / JSエラー・CSP違反 ${total.errors}件`);
process.exit(total.contrast + total.tap + total.overflow + total.errors === 0 ? 0 : 1);
