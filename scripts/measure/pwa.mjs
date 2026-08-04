#!/usr/bin/env node
/**
 * =====================================================================
 * pwa.mjs — PWA の 挙動を 実さいの ブラウザで 測る（Part I §7-5）
 * =====================================================================
 *
 *   npm i -D playwright && npx playwright install chromium
 *   node scripts/measure/pwa.mjs
 *
 * sw.js を 読んでも 分からない ことを 測ります。
 *
 *   ① 初回訪問で 勝手に リロードしないか（文書の 読みこみが 1回か）
 *   ② Service Worker が ほんとうに 登録されて いるか
 *   ③ 版を 上げて 3秒 放置しても、押すまで 切りかわらないか
 *   ④ 押したら 切りかわり、古い ひかえが 消えるか
 *   ⑤ 同じ ドメインの **他アプリの ひかえを 巻きぞえに しないか**
 *   ⑥ ほんとうの 圏外で 起動するか
 *   ⑦ 本体の ひかえが 無い ときに offline.html が 出るか
 *
 * ■ 圏外の 作りかたに 注意
 * Playwright の `context.setOffline(true)` は **Service Worker からの
 * 通信には 効きません**（Chromium）。これで 測ると、サーバーは 生きた まま
 * なので「圏外でも 動いた」という **意味の ない 結果**に なります。
 * ここでは 検査用の サーバー その ものを 止めて 測ります。
 *
 * ■ 版を 上げる ところ
 * リポジトリには さわりません。一時フォルダに 写した ほうの sw.js を
 * 書きかえます。
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const REPO = path.basename(ROOT);
const PORT = Number(process.env.PORT || 8801);
const BASE = `http://127.0.0.1:${PORT}/${REPO}/`;

// 一時フォルダに 写す（/{リポジトリ名}/ の 形で 出さないと scope が 合いません）
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'typa-pwa-'));
fs.cpSync(ROOT, path.join(work, REPO), {
  recursive: true,
  filter: (src) => !src.includes(`${path.sep}.git`) && !src.includes('node_modules'),
});
const SW = path.join(work, REPO, 'sw.js');
const swOriginal = fs.readFileSync(SW, 'utf8');

let server = null;
const startServer = () => { server = spawn(process.execPath, [path.join(HERE, 'server.mjs'), work, String(PORT)], { stdio: 'ignore' }); };
const stopServer = () => { if (server) { server.kill('SIGKILL'); server = null; } };
const wait = (ms) => new Promise((s) => setTimeout(s, ms));

let ng = 0;
const say = (ok, label, extra = '') => { if (!ok) ng++; console.log(`${ok ? '✅' : '❌'} ${label}${extra ? '  ' + extra : ''}`); };

startServer();
await wait(900);

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
let loads = 0;
page.on('load', () => loads++);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(BASE, { waitUntil: 'networkidle' });
await wait(3000);

// ① 初回訪問
say(loads === 1, `① 初回訪問の 文書読みこみ ${loads} 回`,
  loads === 1 ? '（1回なら 正常）' : '（勝手に リロードして います）');

// ② 登録
const reg = await page.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration();
  return r ? { scope: r.scope, active: !!r.active, controller: !!navigator.serviceWorker.controller } : null;
});
say(!!(reg && reg.active), '② Service Worker が 登録されて いる', JSON.stringify(reg));

// 他アプリの ひかえを 置いて おく
await page.evaluate(async () => {
  (await caches.open('other-app-static-v1')).put('/o.txt', new Response('x'));
  (await caches.open('yetanother-v3')).put('/y.txt', new Response('y'));
  (await caches.open('typa-vOLD')).put('/old.txt', new Response('o'));
});

// ③ 版を 上げて 3秒 放置
fs.writeFileSync(SW, swOriginal.replace(/(APP_VERSION\s*=\s*')([^']+)(')/, '$1$2-test$3'));
const held = await page.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration();
  await r.update();
  await new Promise((s) => setTimeout(s, 3000));
  const bar = document.getElementById('update-bar');
  return { waiting: !!r.waiting, bar: !!bar, text: bar ? bar.innerText.replace(/\n+/g, ' / ') : '' };
});
say(held.waiting, '③ 版を 上げて 3秒 放置しても 待って いる');
say(held.bar, '   更新の おしらせが 出た', held.text && `「${held.text}」`);
say(loads === 1, '   放置中に 読みこみ直して いない', `読みこみ ${loads} 回`);

// ④⑤ 押したら 切りかわる／他アプリを 巻きぞえに しない
if (held.bar) {
  await page.click('#update-bar .update-yes');
  await wait(3000);
  const after = await page.evaluate(() => caches.keys());
  say(loads === 2, '④ 押したら 1回だけ 読みこみ直した', `読みこみ ${loads} 回`);
  say(!after.includes('typa-vOLD'), '   古い typa- の ひかえが 消えた', JSON.stringify(after));
  const kept = ['other-app-static-v1', 'yetanother-v3'].filter((k) => after.includes(k));
  say(kept.length === 2, `⑤ 他アプリの ひかえが ${kept.length}/2 のこった`);
}

// ⑥ ほんとうの 圏外で 起動するか
stopServer();
await wait(600);
const p2 = await ctx.newPage();
await p2.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
const t1 = await p2.evaluate(() => document.title).catch(() => '');
say(/タイピング|Typa/.test(t1), '⑥ 圏外で 起動する', `「${t1}」`);
await p2.close();

// ⑦ 本体の ひかえが 無い ときに offline.html が 出るか
await page.evaluate(async () => {
  for (const k of await caches.keys()) {
    if (!k.startsWith('typa-')) continue;
    const cc = await caches.open(k);
    for (const r of await cc.keys()) {
      const p = new URL(r.url).pathname;
      if (p.endsWith('/') || p.endsWith('/index.html')) await cc.delete(r);
    }
  }
});
const p3 = await ctx.newPage();
await p3.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
const t2 = await p3.evaluate(() => document.body.innerText.replace(/\n+/g, ' / ').slice(0, 60)).catch(() => '');
say(/つながって いません/.test(t2), '⑦ 本体の ひかえが 無い ときに offline.html が 出る', `「${t2}」`);

say(errors.length === 0, `⑧ JSエラー・CSP違反 ${errors.length} 件`, errors.slice(0, 3).join(' / '));

await browser.close();
stopServer();
fs.rmSync(work, { recursive: true, force: true });

console.log(ng === 0 ? '\nすべて 通りました。' : `\n${ng} 件 落ちました。`);
process.exit(ng === 0 ? 0 : 1);
