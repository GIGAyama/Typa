/**
 * =====================================================================
 * launch.mjs — 実ブラウザを ひらく ところ（measure 3本の 共通部品）
 * =====================================================================
 *
 * ふだんは `npx playwright install chromium` で 入れた ブラウザを つかいます。
 * その ばあい ここは 何も しません。
 *
 * ■ なぜ 差しかえ口が 要るのか
 * playwright は「この 版の playwright には この 版の Chromium」と
 * 組みあわせが 決まって いて、合わない ものが すでに 手もとに あっても
 * つかって くれません。学校や 会社の ネットワークからは
 * `cdn.playwright.dev` へ 出られない ことが あり、
 * **ブラウザが 手もとに あるのに 測れない**という 形で 止まります
 * （実さいに 踏みました。403 request rejected）。
 *
 * その ときは 手もとの ブラウザの 場所を 教えて ください。
 *
 *   CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run measure
 *
 * Chrome や Edge の 実体を 指しても かまいません（Chromium 系なら 動きます）。
 */
import { chromium } from 'playwright';

export function launchOptions() {
  const exe = process.env.CHROME_PATH || process.env.CHROMIUM_PATH;
  return exe ? { executablePath: exe } : {};
}

export async function launchBrowser(extra = {}) {
  const opts = { ...launchOptions(), ...extra };
  if (opts.executablePath) console.log(`（ブラウザ: ${opts.executablePath}）`);
  return chromium.launch(opts);
}
