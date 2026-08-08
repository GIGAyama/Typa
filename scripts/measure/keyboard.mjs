#!/usr/bin/env node
/**
 * =====================================================================
 * keyboard.mjs — キーボードだけで 全機能に 届くかを 実ブラウザで 測る
 * =====================================================================
 * GIGA Standard v5 の F3「キーボードのみで 全機能に 到達（Tab 順が 視覚順と 一致）」。
 *
 *   CHROME_PATH=... node scripts/measure/keyboard.mjs
 *
 * ■ なぜ 別の スクリプトに するのか
 * measure.mjs は「見た目」を 測ります。キーボードは **歩いて みないと
 * 分からない** ことばかりです。読むだけでは 気づけません。
 * 実さいに、`<label for>` と `hidden` の 組みあわせで
 * **「ファイルを えらぶ」に Tab で 一生 たどりつけない** ことが
 * この スクリプトで 分かりました（マウスでは ふつうに 押せます）。
 *
 * ■ 測る こと
 *   ① 押せそうなのに Tab で 届かない ものが ないか
 *      cursor: pointer や role="button" が ついて いるのに、
 *      じぶんも 親も フォーカスを 受けとれない 要素。
 *      **フォーカスできる ものの 中身（button の 中の span）は 除きます。**
 *      cursor は 継承するので、除かないと 誤報だらけに なります。
 *   ② Tab で ぜんぶの 部品に 届くか（届かない ものが 0 か）
 *   ③ Tab の 順番が 見た目の 順番（上から 下、同じ 行なら 左から 右）と 合うか
 *      行の 区切りは 24px。同じ 帯に ある ものは 同じ 行と みなします。
 *      **左右 2列に 分かれた カードは 列ごとに 読むのが 自然**なので、
 *      画面の 半分より 右で 帯が 変わる ところは 行ちがいと して 数えません
 *      （下の COLUMN_SPLIT を 見て ください）。
 *   ④ フォーカスの しるし（outline）が 見えるか
 *      :focus-visible の outline が 0 だと、どこに いるか 分からなく なります。
 *   ⑤ Tab が どこかで 回り続けない か（わなに なって いない か）
 *
 * ■ 測れない もの
 * 「押した あと 何が おきるか」までは 見て いません。届くか どうか だけです。
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './launch.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const REPO = path.basename(ROOT);
const PORT = Number(process.env.PORT || 8804);
const BASE = `http://127.0.0.1:${PORT}/${REPO}/`;

/** 同じ「行」と みなす たての はば（px） */
const ROW_BAND = 24;

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([type=hidden]):not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', 'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * 見る 画面。せっていは 中で さらに 4つに 分かれるので、
 * サブタブも 1つずつ ひらいて 測ります（ここを 見て いなかった ころ、
 * 「キーボード」タブの スイッチ 6つを まるごと 見のがして いました）。
 */
const SCREENS = [
  ['うつ', (p) => p.evaluate(() => window.Typa.Nav.selectTab('play'))],
  ['えらぶ', (p) => p.evaluate(() => window.Typa.Nav.selectTab('menu'))],
  ['コース一覧', (p) => p.evaluate(() => window.Typa.Nav.go('courses', {}))],
  ['チャレンジ', (p) => p.evaluate(() => window.Typa.Nav.go('challenge', {}))],
  ['きろく', (p) => p.evaluate(() => window.Typa.Nav.selectTab('records'))],
  ['バッジ', (p) => p.evaluate(() => window.Typa.Nav.go('badges', {}))],
  ['ローマ字ひょう', (p) => p.evaluate(() => window.Typa.Nav.go('romaji-table', {}))],
  ['きろくを もちだす', (p) => p.evaluate(() => window.Typa.Nav.go('backup', {}))],
];
/** せっていの サブタブ。ボタンの 文字で えらびます */
const SETTINGS_TABS = ['ヒント', 'みため', 'キーボード', 'データ'];

/** ページの 中で 走る 本体 —— ①②④の 材料を あつめます */
function probe(FOCUSABLE) {
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity || '1') < 0.05) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0.5 && r.height > 0.5;
  };
  // Tab に 乗って いるか。**見えて いるか とは べつ** です。
  // わざと 大きさ 0 に して、しるしだけ となりに 出す 作りが あるので、
  // 「小さいから 届かない」と 決めては いけません。
  const tabbable = (el) => {
    if (!el.matches(FOCUSABLE)) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && !el.hasAttribute('hidden');
  };
  const nm = (el) => el.tagName.toLowerCase()
    + (typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '')
    + (el.id ? '#' + el.id : '');
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);

  // ① 押せそうなのに Tab で 届かない もの
  const unreachable = [];
  const ROLES = ['button', 'link', 'tab', 'checkbox', 'switch', 'menuitem', 'option'];
  for (const el of document.querySelectorAll('*')) {
    if (!visible(el)) continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    if (el.closest(FOCUSABLE)) continue;             // フォーカスできる ものの 中身は 除く
    const cs = getComputedStyle(el);
    const role = el.getAttribute('role');
    const looks = cs.cursor === 'pointer' || (role && ROLES.includes(role));
    if (!looks) continue;
    // 中に フォーカスできる ものが あるなら、それで 届く
    if (el.querySelector(FOCUSABLE)) continue;
    // 囲みの <label> の 中に 本体（checkbox など）が あるなら、それで 届く。
    // スイッチは <label><input><span 見た目></label> の 形なので、
    // ここを 見ないと 見た目の span 12個が まるごと 誤報に なります。
    const wrap = el.closest('label');
    if (wrap && wrap !== el && wrap.querySelector(FOCUSABLE)) continue;
    // <label for="…"> は それ自身は Tab に 乗りません。
    // 指す 先が Tab に 乗って いるかで 見ます（hidden な input は 乗りません）。
    if (el.tagName === 'LABEL') {
      const target = el.htmlFor ? document.getElementById(el.htmlFor) : null;
      if (target && tabbable(target)) continue;
      unreachable.push({ n: nm(el), t: label(el), why: target ? `for="${el.htmlFor}" が Tab に 乗って いない` : 'for の 先が ない' });
      continue;
    }
    unreachable.push({ n: nm(el), t: label(el), why: `cursor:${cs.cursor}${role ? ' role=' + role : ''}` });
  }

  // ②④ 見えて いる フォーカス先の 一覧（位置と、フォーカスの しるし）
  const items = [...document.querySelectorAll(FOCUSABLE)]
    .filter(visible)
    .filter((el) => !el.closest('[aria-hidden="true"]'))
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { n: nm(el), t: label(el), x: Math.round(r.x), y: Math.round(r.y) };
    });
  return { unreachable, items };
}

const server = spawn(process.execPath,
  [path.join(HERE, 'server.mjs'), path.resolve(ROOT, '..'), String(PORT)], { stdio: 'ignore' });
await new Promise((s) => setTimeout(s, 900));

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const VIEW_W = 1366;
/** この x より 右に ある ものは「右の 列」。列またぎは 順ちがいに 数えません */
const COLUMN_SPLIT = VIEW_W / 2;

const total = { unreachable: 0, missed: 0, order: 0, noOutline: 0, trap: 0 };

/** Tab を 押しつづけて、実さいに 止まった ところを ならべます */
async function tabWalk(page, limit) {
  await page.evaluate(() => {
    const v = document.getElementById('view');
    if (v) { v.focus(); v.blur(); }
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  });
  const seen = [];
  const been = new Set();
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab');
    const cur = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const ow = parseFloat(cs.outlineWidth) || 0;
      return {
        n: el.tagName.toLowerCase()
          + (typeof el.className === 'string' && el.className.trim()
            ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '')
          + (el.id ? '#' + el.id : ''),
        t: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24),
        x: Math.round(r.x), y: Math.round(r.y),
        ring: (ow > 0 && cs.outlineStyle !== 'none') || cs.boxShadow !== 'none',
      };
    });
    if (!cur) break;                                   // ブラウザの UI へ 出た ＝ ひとまわり した
    // ヘッドレスでは アドレスバーが 無いので、さいごまで 行くと
    // ブラウザの UI を はさまずに 先頭へ もどって きます。
    // これを 数えると「順ちがい」と「わな」の 誤報に なります（実さいに 出ました）。
    const k = `${cur.n}|${cur.x},${cur.y}`;
    if (been.has(k)) break;                            // 2周目に 入った ＝ ひとまわり した
    been.add(k);
    seen.push(cur);
  }
  // limit まで 使いきった ＝ 先頭へ もどりも、ブラウザの UI へ 抜けも しない。
  // どこかで 回り続けて いる（わな）か、部品が 増えつづけて います。
  return { seen, exhausted: seen.length >= limit };
}

async function checkScreen(title) {
  await page.waitForTimeout(700);
  const { unreachable, items } = await page.evaluate(probe, FOCUSABLE);
  const { seen: walked, exhausted } = await tabWalk(page, items.length + 8);

  // ② 届かなかった もの（見えて いるのに Tab 順に 出て こない）
  const key = (o) => `${o.n}|${o.x},${o.y}`;
  const walkedKeys = new Set(walked.map(key));
  const missed = items.filter((o) => !walkedKeys.has(key(o)));

  // ③ 見た目の 順と くらべる
  const orderBad = [];
  for (let i = 1; i < walked.length; i++) {
    const a = walked[i - 1], b = walked[i];
    const sameRow = Math.abs(a.y - b.y) <= ROW_BAND;
    if (sameRow) { if (b.x + 1 < a.x) orderBad.push([a, b, '同じ 行なのに 右から 左へ もどった']); continue; }
    if (b.y + ROW_BAND < a.y) {
      // 上へ もどった。左右 2列の 列うつりなら 自然な ことが あります
      const columnHop = a.x < COLUMN_SPLIT && b.x >= COLUMN_SPLIT;
      if (!columnHop) orderBad.push([a, b, '下に あった ものより 上へ もどった']);
    }
  }

  // ④ フォーカスの しるし
  const noRing = walked.filter((o) => !o.ring);

  // ⑤ わな（ひとまわりも しないし、外へも 抜けない）
  const trap = exhausted;

  const bad = unreachable.length + missed.length + orderBad.length + noRing.length + (trap ? 1 : 0);
  console.log(`\n### ${title}  （Tab で 止まる ところ ${walked.length} / 見えて いる 部品 ${items.length}）`);
  if (!bad) { console.log('  ✅ キーボードだけで ぜんぶに 届きます'); }
  for (const u of unreachable) console.log(`  ❌ 押せそうだが Tab で 届かない: ${u.n} 「${u.t}」（${u.why}）`);
  for (const m of missed) console.log(`  ❌ Tab 順に 出て こない: ${m.n} 「${m.t}」 (${m.x},${m.y})`);
  for (const [a, b, why] of orderBad) console.log(`  ❌ 順ちがい: 「${a.t}」(${a.x},${a.y}) → 「${b.t}」(${b.x},${b.y}) ${why}`);
  for (const o of noRing) console.log(`  ❌ フォーカスの しるしが 出ない: ${o.n} 「${o.t}」`);
  if (trap) console.log('  ❌ Tab が ひとまわり しません（わなに なって いる おそれ）');

  total.unreachable += unreachable.length;
  total.missed += missed.length;
  total.order += orderBad.length;
  total.noOutline += noRing.length;
  total.trap += trap ? 1 : 0;
}

for (const [title, go] of SCREENS) {
  try { await go(page); } catch (e) { console.log(`  ⚠️ ${title}: 到達できません ${String(e).slice(0, 60)}`); continue; }
  await checkScreen(title);
}
for (const tab of SETTINGS_TABS) {
  await page.evaluate(() => window.Typa.Nav.selectTab('settings'));
  await page.waitForTimeout(500);
  const hit = await page.evaluate((t) => {
    const b = [...document.querySelectorAll('.subtab')].find((x) => x.textContent.trim() === t);
    if (!b) return false;
    b.click();
    return true;
  }, tab);
  if (!hit) { console.log(`  ⚠️ せってい／${tab}: 見つかりません`); continue; }
  await checkScreen(`せってい／${tab}`);
}

await browser.close();
server.kill('SIGKILL');

console.log('\n===== 合計 =====');
console.log(`押せそうだが Tab で 届かない ${total.unreachable}件`);
console.log(`Tab 順に 出て こない ${total.missed}件`);
console.log(`Tab の 順が 見た目と ちがう ${total.order}件`);
console.log(`フォーカスの しるしが 出ない ${total.noOutline}件`);
console.log(`Tab が ひとまわり しない 画面 ${total.trap}件`);
console.log(`JSエラー・CSP違反 ${errors.length}件`);
errors.slice(0, 5).forEach((e) => console.log('   ' + e));

const bad = total.unreachable + total.missed + total.order + total.noOutline + total.trap + errors.length;
console.log(bad === 0 ? '\nキーボードだけで 全機能に 届きます（F3 ✅）' : `\n${bad}件 のこって います`);
process.exit(bad === 0 ? 0 : 1);
