#!/usr/bin/env node
/**
 * =====================================================================
 * typing.mjs — 打って いる とちゅうにしか 出ない ところを 測る
 * =====================================================================
 *
 *   node scripts/measure/typing.mjs
 *
 * ■ なぜ わざわざ 打つのか
 * 画面を 歩いて 測るだけでは、**打った しゅんかんにしか 出ない 色**が
 * 1つも 見えません。Typa で いちばん 大事なのは まさに そこ です。
 *
 *   ・つぎに 押す キー（is-next）
 *   ・正かい／まちがいの しるし（hit-ok / hit-miss）
 *   ・シフトを 押して いる あいだ（shift-on）
 *
 * 実さいに、くらい 画面での「まちがい」の しるしが 比 2.21 だった ことが
 * ここで 分かりました。歩くだけの 検査では 見つかりません。
 *
 * ■ 待ち時間に 注意
 * .kb-key には background-color の transition が かかって います。
 * 押した すぐ あとに 測ると **色が 変わって いる とちゅう**を 拾い、
 * ほんとうは 通って いる ものが 落ちます。落ちつくまで 待ちます。
 *
 * ■ CSP で 指の 色分けが 消えて いないかも ここで 見ます
 * 指の 色は style="--finger: …" で 出して いるので、
 * style-src を しめすぎると **画面は 出るのに 色分けだけ 黙って 消えます**。
 * キーの 地の 色が 何種類 あるかを 数えて、生きて いる ことを たしかめます。
 */
import { launchBrowser } from './launch.mjs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const REPO = path.basename(ROOT);
const PORT = Number(process.env.PORT || 8803);
const BASE = `http://127.0.0.1:${PORT}/${REPO}/`;
const SETTLE = 220;   // transition が おわるまで（.1s）＋ よゆう

function contrastOf(sel) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const parse = (s) => {
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000';
    try { ctx.fillStyle = s; } catch (e) { return [0, 0, 0, 0]; }
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); const [h, l] = x > y ? [x, y] : [y, x]; return (h + 0.05) / (l + 0.05); };
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    let bg = parse(getComputedStyle(el).backgroundColor);
    let n = el.parentElement;
    while (bg[3] < 0.99 && n) { const c = parse(getComputedStyle(n).backgroundColor); if (c[3] > 0.99) { bg = c; break; } n = n.parentElement; }
    if (bg[3] < 0.99) bg = [255, 255, 255, 1];
    for (const kid of [el, ...el.querySelectorAll('span')]) {
      const t = [...kid.childNodes].filter((x) => x.nodeType === 3).map((x) => x.nodeValue).join('').trim();
      if (!t) continue;
      const cs = getComputedStyle(kid);
      const fs = parseFloat(cs.fontSize);
      const wt = parseInt(cs.fontWeight, 10) || 400;
      out.push({
        part: kid.className || 'キー', text: t.slice(0, 6),
        got: Math.round(ratio(parse(cs.color), bg) * 100) / 100,
        need: (fs >= 24 || (fs >= 18.66 && wt >= 700)) ? 3 : 4.5,
        fg: cs.color, bg: 'rgb(' + bg.slice(0, 3).join(',') + ')',
      });
    }
  }
  return out;
}

const server = spawn(process.execPath, [path.join(HERE, 'server.mjs'), path.resolve(ROOT, '..'), String(PORT)], { stdio: 'ignore' });
await new Promise((s) => setTimeout(s, 900));

let ng = 0;
const browser = await launchBrowser();
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, colorScheme: scheme });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  console.log(`\n##### ${scheme === 'light' ? 'あかるい 画面' : 'くらい 画面'} #####`);

  const finger = await page.evaluate(() => ({
    ことなる地の色: new Set([...document.querySelectorAll('.kb .kb-key')].map((k) => getComputedStyle(k).backgroundColor)).size,
    finger属性: document.querySelectorAll('[style*="--finger"]').length,
  }));
  const alive = finger.ことなる地の色 > 3;
  if (!alive) ng++;
  console.log(`${alive ? '✅' : '❌'} 指の 色分けが 生きて いる  ${JSON.stringify(finger)}`);

  const bad = [];
  const take = async (state, sel) => {
    const rows = await page.evaluate(contrastOf, sel);
    rows.filter((r) => r.got < r.need - 0.005).forEach((r) => bad.push({ state, ...r }));
  };

  await take('つぎに 押す キー', '.kb .kb-key.is-next');
  await page.keyboard.press('f'); await page.waitForTimeout(SETTLE);
  await take('○ 正かい', '.kb .kb-key.hit-ok');
  await page.keyboard.press('q'); await page.waitForTimeout(SETTLE);
  await take('× まちがい', '.kb .kb-key.hit-miss');
  await page.keyboard.down('Shift'); await page.waitForTimeout(SETTLE);
  await take('シフト中', '.kb.shift-on .kb-key[data-code^=Shift]');
  await page.keyboard.up('Shift'); await page.waitForTimeout(SETTLE);
  await page.evaluate(() => document.querySelectorAll('.kb').forEach((k) => k.classList.remove('show-finger')));
  await page.waitForTimeout(SETTLE);
  await take('つぎに 押す キー（指の色分け OFF）', '.kb .kb-key.is-next');

  const seen = new Set();
  for (const r of bad) {
    const k = r.state + r.part + r.got;
    if (seen.has(k)) continue;
    seen.add(k);
    console.log(`  ❌ ${r.state} / ${r.part}「${r.text}」 ${r.got}（要 ${r.need}） ${r.fg} on ${r.bg}`);
  }
  ng += bad.length;
  console.log(bad.length ? `  → 打って いる とちゅうの 基準未満 ${bad.length}件`
    : '  ✅ 打って いる とちゅうの 基準未満 0件');
  if (errors.length) { ng += errors.length; console.log('  ❌ JSエラー・CSP違反 ' + errors.length + '件: ' + errors.slice(0, 3).join(' / ')); }
  else console.log('  ✅ JSエラー・CSP違反 0件');
  await ctx.close();
}
await browser.close();
server.kill('SIGKILL');
console.log(ng === 0 ? '\nすべて 通りました。' : `\n${ng} 件 落ちました。`);
process.exit(ng === 0 ? 0 : 1);
