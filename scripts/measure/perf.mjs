#!/usr/bin/env node
/**
 * =====================================================================
 * perf.mjs — ひらいた ときの 速さを 実ブラウザで 測る（Part I §8）
 * =====================================================================
 *
 *   CHROME_PATH=... node scripts/measure/perf.mjs
 *
 * ■ 測る こと
 *   ・LCP（いちばん 大きい ものが 出るまで）      目標 2.5秒 以下
 *   ・CLS（出て きてから 画面が ずれた 量）        目標 0.1 以下
 *   ・初回に とどく JS の 大きさ（gzip 前）        目標 300KB 以下
 *   ・初回に とどく ぜんぶの 大きさ                目標 1MB 以下
 *
 * ■ どういう 端末の つもりで 測るか
 * 本物の Chromebook は ここに ありません。**あると 言っては いけません。**
 * かわりに 2つ 測ります。
 *
 *   ふつう      … この 機械の まま
 *   Chromebook風 … CPU を 4ばい おそく する（GIGA標準機に よせた もの）
 *
 * 目標との くらべは **Chromebook風** の ほうで 見ます。
 * 実機の 数字では ない ことを AUDIT.md に そのまま 書いて ください。
 *
 * ■ 落とし穴（実さいに 踏んだ もの）
 *   ・LCP は「もう これ以上 大きく ならない」と ブラウザが 決めるまで
 *     確定しません。**測る 前に 一度 ページから 離れる**（visibilitychange）と
 *     その場で 確定します。待つだけでは 最後の 1件が 落ちます。
 *   ・CLS は 出て くる アニメーションを 拾います。Typa は カードが
 *     ふわっと 出るので、`hadRecentInput` の ない ずれだけを 足します
 *     （それが WCAG／Core Web Vitals の 数えかたです）。
 *   ・Service Worker が 前回の ひかえを 返すと 2回目 以降が 速く 出ます。
 *     **毎回 まっさらな プロフィールで 測ります。**
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './launch.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const REPO = path.basename(ROOT);
const PORT = Number(process.env.PORT || 8805);
const BASE = `http://127.0.0.1:${PORT}/${REPO}/`;

const RUNS = Number(process.env.RUNS || 5);
const TARGET = { lcp: 2500, cls: 0.1, js: 300 * 1024, total: 1024 * 1024 };

/** ページを ひらく 前に しこむ 見はり。LCP と CLS を ためて おきます */
const WATCH = `
  window.__lcp = 0; window.__cls = 0;
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__lcp = Math.max(window.__lcp, e.startTime);
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
  }).observe({ type: 'layout-shift', buffered: true });
`;

const server = spawn(process.execPath,
  [path.join(HERE, 'server.mjs'), path.resolve(ROOT, '..'), String(PORT)], { stdio: 'ignore' });
await new Promise((s) => setTimeout(s, 900));

const browser = await launchBrowser();

/** 1回 ひらいて 測ります。@param {number} slow CPU を 何ばい おそく するか */
async function once(slow) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.addInitScript(WATCH);

  const cdp = await ctx.newCDPSession(page);
  if (slow > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: slow });

  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#view')?.children.length > 0, null, { timeout: 30000 });
  await page.waitForTimeout(2500);

  // LCP を 確定させます。離れないと 最後の 1件が 出ません
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(300);

  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];

    // とどいた 大きさは PerformanceResourceTiming から 数えます。
    // ヘッダーの Content-Length を 見て いた ころは、それを 出さない
    // サーバーだと **ぜんぶ 0 KB に なり、「0 KB なので 300 KB 以下、合格」
    // という うその ✅ を 出して いました**。中身の 大きさを 直に 数えます。
    // decodedBodySize ＝ gzip を ほどいた あとの 大きさ（§8 の 数えかた）
    const bytes = { js: 0, css: 0, img: 0, html: 0, other: 0 };
    const docSize = nav.decodedBodySize || 0;
    bytes.html += docSize;
    for (const r of performance.getEntriesByType('resource')) {
      const p = new URL(r.name, location.href).pathname;
      const size = r.decodedBodySize || r.transferSize || 0;
      if (p.endsWith('.js')) bytes.js += size;
      else if (p.endsWith('.css')) bytes.css += size;
      else if (/\.(png|svg|jpe?g|webp|ico)$/.test(p)) bytes.img += size;
      else if (p.endsWith('/') || p.endsWith('.html')) bytes.html += size;
      else bytes.other += size;
    }
    return {
      lcp: Math.round(window.__lcp),
      cls: Math.round(window.__cls * 1000) / 1000,
      fcp: fcp ? Math.round(fcp.startTime) : null,
      dcl: Math.round(nav.domContentLoadedEventEnd || 0),
      bytes,
    };
  });
  m.wall = Date.now() - t0;
  await ctx.close();
  return m;
}

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

const results = {};
for (const [label, slow] of [['ふつう', 1], ['Chromebook風（CPU 4ばい おそく）', 4]]) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await once(slow));
  results[label] = {
    lcp: med(runs.map((r) => r.lcp)),
    cls: Math.max(...runs.map((r) => r.cls)),      // ずれは いちばん 悪い 回で 見ます
    fcp: med(runs.map((r) => r.fcp)),
    dcl: med(runs.map((r) => r.dcl)),
    bytes: runs[runs.length - 1].bytes,
  };
}

await browser.close();
server.kill('SIGKILL');

console.log(`\n（${RUNS}回ずつ ひらいた 中央値。CLS だけは いちばん 悪い 回）\n`);
console.log('| | LCP | CLS | はじめて 字が 出る | DOMContentLoaded |');
console.log('|---|---:|---:|---:|---:|');
for (const [label, r] of Object.entries(results)) {
  console.log(`| ${label} | ${r.lcp} ms | ${r.cls} | ${r.fcp} ms | ${r.dcl} ms |`);
}

const b = results['Chromebook風（CPU 4ばい おそく）'].bytes;
const total = b.js + b.css + b.img + b.html + b.other;
console.log('\n| 初回に とどく もの | 大きさ | 目標 |');
console.log('|---|---:|---:|');
console.log(`| JS | ${kb(b.js)} | 300 KB |`);
console.log(`| CSS | ${kb(b.css)} | — |`);
console.log(`| 画像 | ${kb(b.img)} | — |`);
console.log(`| HTML ほか | ${kb(b.html + b.other)} | — |`);
console.log(`| **ぜんぶ** | **${kb(total)}** | 1 MB |`);

const slowR = results['Chromebook風（CPU 4ばい おそく）'];
const ng = [];
// 0 バイトは「軽い」では なく「測れて いない」です。
// 合格に して しまうと、いちばん たちの わるい うその ✅ に なります。
if (b.js === 0 || total === 0) {
  console.log('\n❌ 大きさを 測れて いません（0 バイト）。合格には しません。');
  process.exit(1);
}
if (slowR.lcp > TARGET.lcp) ng.push(`LCP ${slowR.lcp}ms > ${TARGET.lcp}ms`);
if (slowR.cls > TARGET.cls) ng.push(`CLS ${slowR.cls} > ${TARGET.cls}`);
if (b.js > TARGET.js) ng.push(`初回JS ${kb(b.js)} > ${kb(TARGET.js)}`);
if (total > TARGET.total) ng.push(`総アセット ${kb(total)} > ${kb(TARGET.total)}`);

console.log('');
if (!ng.length) console.log('§8 の 目標を すべて 満たして います。');
else { console.log('§8 の 目標に 届いて いない もの:'); ng.forEach((x) => console.log('  ❌ ' + x)); }
console.log('\n⚠️ これは 本物の Chromebook の 数字では ありません。CPU を 4ばい おそく した 目やすです。');
process.exit(0);   // 速さは 人が 判断する ところなので、ここでは 落としません
