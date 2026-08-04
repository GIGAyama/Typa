/**
 * =====================================================================
 * giga-v5-checks.mjs — GIGA Standard v5 / Part I の 検査
 * =====================================================================
 *
 * ここは **ほかの リポジトリと 共通の 中身**です。
 * 正本が 更新されたら、この ファイルごと 差しかえられる 形に して います。
 * Typa 固有の 検査は ここには 書かず、tools/check-*.js に 置いて ください。
 *
 * ■ 検査を 書く ときの 決まりごと（実さいに 踏んだ 3つの あな）
 *
 *   1. 「消す 式」を 正規表現で 追わない。
 *      caches.keys() の 全削除を さがす とき、`caches.delete(k)` の 形を
 *      追うと `(k) => caches.delete(k)` のような 書き方を 見のがします。
 *      見るべきは **`startsWith` で しぼって いる 式が あるか** です。
 *
 *   2. 判定の 前に コメントを 落とす。
 *      「localStorage は さわりません」という **注意書き**に 反応して
 *      誤検知します。
 *
 *   3. 前方も 見る。
 *      `@supports not (height: 100dvh) { … 100vh … }` は 正しい
 *      フォールバックです。100vh を 見つけただけで 落として は いけません。
 */
import fs from 'node:fs';
import path from 'node:path';

/** JavaScript / CSS の コメントを 落とす（判定の 前に 必ず 通す） */
export function stripComments(src) {
  let out = '';
  let i = 0;
  let mode = 'code';   // code | line | block | str | tpl
  let quote = '';
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (mode === 'code') {
      if (c === '/' && n === '/') { mode = 'line'; i += 2; continue; }
      if (c === '/' && n === '*') { mode = 'block'; i += 2; continue; }
      if (c === '"' || c === "'") { mode = 'str'; quote = c; out += c; i++; continue; }
      if (c === '`') { mode = 'tpl'; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (mode === 'line') { if (c === '\n') { mode = 'code'; out += c; } i++; continue; }
    if (mode === 'block') { if (c === '*' && n === '/') { mode = 'code'; i += 2; } else { if (c === '\n') out += c; i++; } continue; }
    if (mode === 'str') { if (c === '\\') { out += c + (n || ''); i += 2; continue; } if (c === quote) mode = 'code'; out += c; i++; continue; }
    if (mode === 'tpl') { if (c === '\\') { out += c + (n || ''); i += 2; continue; } if (c === '`') mode = 'code'; out += c; i++; continue; }
  }
  return out;
}

const read = (root, rel) => {
  const p = path.join(root, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
};
const listFiles = (root, dir, ext) => {
  const p = path.join(root, dir);
  if (!fs.existsSync(p)) return [];
  return fs.readdirSync(p).filter((f) => f.endsWith(ext)).map((f) => path.join(dir, f));
};

/**
 * 検査の 定義。
 * run(root) は { ok, detail[] } を 返します。
 */
export const CHECKS = [
  {
    id: 'A_LICENSE',
    title: 'LICENSE が 実ファイルで ある',
    run: (root) => {
      const s = read(root, 'LICENSE');
      if (!s) return { ok: false, detail: ['LICENSE が ありません'] };
      if (!/Copyright \(c\)/i.test(s)) return { ok: false, detail: ['LICENSE に 著作権表示が ありません'] };
      return { ok: true, detail: [] };
    },
  },
  {
    id: 'A_GITIGNORE',
    title: '.gitignore が 秘密ファイルを 除いて いる',
    run: (root) => {
      const s = read(root, '.gitignore');
      if (!s) return { ok: false, detail: ['.gitignore が ありません'] };
      const missing = ['node_modules', '.env', '.clasp.json'].filter((k) => !s.includes(k));
      return { ok: missing.length === 0, detail: missing.map((m) => `${m} の 行が ありません`) };
    },
  },
  {
    id: 'A_DEPENDABOT',
    title: 'dependabot.yml が ある',
    run: (root) => ({
      ok: !!read(root, '.github/dependabot.yml'),
      detail: ['.github/dependabot.yml が ありません'],
    }),
  },
  {
    id: 'A_CI_ON_PR',
    title: 'CI が pull_request でも 走る',
    run: (root) => {
      const files = listFiles(root, '.github/workflows', '.yml');
      if (!files.length) return { ok: false, detail: ['.github/workflows に ワークフローが ありません'] };
      const any = files.some((f) => /^\s*pull_request\s*:/m.test(read(root, f) || ''));
      return { ok: any, detail: ['push だけでは PR の 時点で 落ちて いる ことに 気づけません'] };
    },
  },
  {
    id: 'A_DOCS',
    title: 'README / MANUAL / AUDIT が ある',
    run: (root) => {
      const missing = ['README.md', 'MANUAL.md', 'AUDIT.md'].filter((f) => !read(root, f));
      return { ok: missing.length === 0, detail: missing.map((m) => `${m} が ありません`) };
    },
  },

  {
    id: 'B_NO_CDN_CODE',
    title: 'CDN から 取る 実行コードが 0 バイト',
    run: (root) => {
      const bad = [];
      for (const rel of ['index.html', 'offline.html', ...listFiles(root, 'js', '.js')]) {
        const s = read(root, rel);
        if (!s) continue;
        const code = stripComments(s);
        for (const m of code.matchAll(/(?:src|href)\s*=\s*["']https?:\/\/([^"'/]+)/gi)) {
          bad.push(`${rel}: ${m[1]} を 読んで います`);
        }
        if (/babel\/standalone|cdn\.tailwindcss\.com/.test(code)) bad.push(`${rel}: ブラウザの 中で コンパイルして います`);
      }
      return { ok: bad.length === 0, detail: bad };
    },
  },
  {
    id: 'B_CSP',
    title: 'CSP が あり、script-src が しまって いる',
    run: (root) => {
      const s = read(root, 'index.html');
      if (!s) return { ok: false, detail: ['index.html が ありません'] };
      const m = s.match(/http-equiv=["']Content-Security-Policy["'][^>]*content=["']([\s\S]*?)["']\s*>/i);
      if (!m) return { ok: false, detail: ['CSP の <meta> が ありません'] };
      const csp = m[1];
      const bad = [];
      const script = (csp.match(/script-src([^;]*)/) || [])[1] || '';
      if (!/'self'/.test(script)) bad.push("script-src に 'self' が ありません");
      if (/'unsafe-inline'|'unsafe-eval'/.test(script)) bad.push('script-src に unsafe-inline / unsafe-eval が あります');
      // frame-ancestors は <meta> では 無視される（書くと 警告が 出るだけ）
      if (/frame-ancestors/.test(csp)) bad.push('frame-ancestors は <meta> では 無視されます。HTTP ヘッダーで 設定して ください');
      return { ok: bad.length === 0, detail: bad };
    },
  },
  {
    id: 'B_NO_INLINE_SCRIPT',
    title: 'index.html に インラインの <script> と onclick= が ない',
    run: (root) => {
      const s = read(root, 'index.html');
      if (!s) return { ok: false, detail: ['index.html が ありません'] };
      // コメントの 中の 例示に 反応しないよう、HTML コメントを 落としてから 見る
      const html = s.replace(/<!--[\s\S]*?-->/g, '');
      const bad = [];
      for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
        if (m[1].trim()) bad.push('中身の ある <script> が あります（CSP で 動きません）');
      }
      if (/\son[a-z]+\s*=\s*["']/i.test(html)) bad.push('onclick= などの 属性が あります（CSP で 動きません）');
      return { ok: bad.length === 0, detail: bad };
    },
  },

  {
    id: 'C_NO_LS_CLEAR',
    title: 'localStorage.clear() を つかって いない',
    run: (root) => {
      const bad = [];
      for (const rel of listFiles(root, 'js', '.js')) {
        // ⚠️ コメントを 落としてから 見る。注意書きに 反応して 誤検知します
        if (/localStorage\s*\.\s*clear\s*\(/.test(stripComments(read(root, rel)))) bad.push(`${rel} で つかって います`);
      }
      return { ok: bad.length === 0, detail: bad };
    },
  },
  {
    id: 'C_PAGEHIDE',
    title: 'pagehide で きろくを 確定して いる',
    run: (root) => {
      const hit = listFiles(root, 'js', '.js')
        .some((rel) => /addEventListener\(\s*['"]pagehide['"]/.test(stripComments(read(root, rel))));
      return { ok: hit, detail: ['Chromebook は メモリ不足で タブを すてます。pagehide で 締めて ください'] };
    },
  },
  {
    id: 'C_NO_POSTMESSAGE_STAR',
    title: "postMessage の 宛先が '*' でない",
    run: (root) => {
      const bad = [];
      for (const rel of listFiles(root, 'js', '.js')) {
        if (/\.postMessage\([^)]*,\s*['"]\*['"]\s*\)/.test(stripComments(read(root, rel)))) bad.push(rel);
      }
      return { ok: bad.length === 0, detail: bad.map((f) => `${f} で 宛先が '*' です`) };
    },
  },

  {
    id: 'D_VIEWPORT',
    title: 'viewport が viewport-fit=cover で、拡大を 禁止して いない',
    run: (root) => {
      const s = read(root, 'index.html');
      const m = s && s.match(/<meta\s+name=["']viewport["'][^>]*content=["']([^"']+)["']/i);
      if (!m) return { ok: false, detail: ['viewport の <meta> が ありません'] };
      const bad = [];
      if (!/viewport-fit\s*=\s*cover/.test(m[1])) bad.push('viewport-fit=cover が ありません');
      if (/user-scalable\s*=\s*no/.test(m[1])) bad.push('user-scalable=no が あります（見えづらい 子が 拡大できません）');
      if (/maximum-scale\s*=\s*1(\.0)?\b/.test(m[1])) bad.push('maximum-scale=1.0 が あります');
      return { ok: bad.length === 0, detail: bad };
    },
  },
  {
    id: 'D_DVH',
    title: '100vh を 単独で つかって いない',
    run: (root) => {
      const bad = [];
      for (const rel of [...listFiles(root, 'css', '.css'), 'index.html', 'offline.html']) {
        const s = read(root, rel);
        if (!s) continue;
        // ⚠️ 前方も 見る。@supports not (height: 100dvh) の 中の 100vh は 正しい ひかえ
        const css = s.replace(/\/\*[\s\S]*?\*\//g, '');
        const guards = [];
        const re = /@supports\s+not\s*\(\s*height\s*:\s*100dvh\s*\)\s*\{/g;
        let g;
        while ((g = re.exec(css))) {
          // 対応する } まで を ひかえの 区間と する
          let depth = 1; let i = re.lastIndex;
          while (i < css.length && depth > 0) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; i++; }
          guards.push([g.index, i]);
        }
        for (const m of css.matchAll(/\b100vh\b/g)) {
          const inGuard = guards.some(([a, b]) => m.index > a && m.index < b);
          if (!inGuard) bad.push(`${rel}: @supports の 外で 100vh を つかって います`);
        }
      }
      return { ok: bad.length === 0, detail: bad };
    },
  },
  {
    id: 'D_SAFE_AREA',
    title: 'safe-area-inset を つかって いる',
    run: (root) => {
      const n = listFiles(root, 'css', '.css')
        .reduce((a, rel) => a + (read(root, rel).match(/env\(\s*safe-area-inset/g) || []).length, 0);
      return { ok: n > 0, detail: ['ノッチ・ホームバーの ぶんを 足して いません'] };
    },
  },
  {
    id: 'D_FLUID_TYPE',
    title: 'clamp() で 文字の 大きさを 決めて いる',
    run: (root) => {
      const n = listFiles(root, 'css', '.css')
        .reduce((a, rel) => a + (read(root, rel).match(/clamp\(/g) || []).length, 0);
      return { ok: n >= 3, detail: [`clamp() が ${n} か所 しか ありません`] };
    },
  },
  {
    id: 'D_CANVAS_DPR',
    title: 'Canvas に devicePixelRatio の 補正が ある（Canvas を つかう ときだけ）',
    run: (root) => {
      const files = listFiles(root, 'js', '.js').filter((rel) => /getContext\(\s*['"]2d['"]/.test(stripComments(read(root, rel))));
      if (!files.length) return { ok: true, detail: [], skip: 'Canvas を つかって いません' };
      const bad = files.filter((rel) => !/devicePixelRatio/.test(stripComments(read(root, rel))));
      return { ok: bad.length === 0, detail: bad.map((f) => `${f}: DPR 補正が ありません（高DPI機で ぼやけます）`) };
    },
  },
  {
    id: 'D_REDUCED_MOTION',
    title: 'prefers-reduced-motion に 対応し、0 では なく .01ms 以下の 実数',
    run: (root) => {
      const css = listFiles(root, 'css', '.css').map((rel) => read(root, rel)).join('\n');
      if (!/prefers-reduced-motion/.test(css)) return { ok: false, detail: ['対応して いません'] };
      const bad = [];
      // 0 に すると animation-fill-mode: forwards が 効かず、中身が 消えます
      if (/animation-duration\s*:\s*0(m?s)?\s*(!important)?\s*;/.test(css)) bad.push('animation-duration が 0 です（fill-mode: forwards が 効かず 中身が 消えます）');
      if (/transition-duration\s*:\s*0(m?s)?\s*(!important)?\s*;/.test(css)) bad.push('transition-duration が 0 です');
      return { ok: bad.length === 0, detail: bad };
    },
  },
  {
    id: 'D_FORCED_COLORS',
    title: 'forced-colors（ハイコントラスト）に 対応して いる',
    run: (root) => {
      const css = listFiles(root, 'css', '.css').map((rel) => read(root, rel)).join('\n');
      return { ok: /forced-colors\s*:\s*active/.test(css), detail: ['地の 色が 無効に されると、押せる ことが 分からなく なります'] };
    },
  },
  {
    id: 'D_RT_COLOR',
    title: 'ふりがな（rt）の 色を 決め打ちして いない',
    run: (root) => {
      const bad = [];
      for (const rel of listFiles(root, 'css', '.css')) {
        const css = read(root, rel).replace(/\/\*[\s\S]*?\*\//g, '');
        for (const m of css.matchAll(/(^|[},])\s*rt\s*\{([^}]*)\}/g)) {
          const body = m[2];
          if (/color\s*:/.test(body) && !/color\s*:\s*inherit/.test(body)) {
            // 色のついた 面で 継がせる 手当てが あれば よい
            if (!/\[class\*?=["']?bg-|button\s+rt|\brt\s*\{\s*color\s*:\s*inherit/.test(css)) {
              bad.push(`${rel}: rt に 色を 決め打ちして います（色の ついた 面で 読めなく なります）`);
            }
          }
        }
      }
      return { ok: bad.length === 0, detail: bad };
    },
  },

  {
    id: 'E_MANIFEST_ID',
    title: 'manifest の id / scope / start_url が リポジトリ名の 絶対パス',
    run: (root) => {
      const s = read(root, 'manifest.webmanifest');
      if (!s) return { ok: false, detail: ['manifest.webmanifest が ありません'] };
      let j;
      try { j = JSON.parse(s); } catch (e) { return { ok: false, detail: ['JSON として 読めません: ' + e.message] }; }
      const bad = [];
      for (const k of ['id', 'scope', 'start_url']) {
        if (!j[k]) { bad.push(`${k} が ありません`); continue; }
        if (!/^\/[^/]+\/$/.test(j[k])) bad.push(`${k} が "${j[k]}" です。/{リポジトリ名}/ の 形に して ください`);
      }
      if (j.id && j.scope && j.start_url && new Set([j.id, j.scope, j.start_url]).size !== 1) {
        bad.push('id / scope / start_url が そろって いません');
      }
      return { ok: bad.length === 0, detail: bad };
    },
  },
  {
    id: 'E_ICONS',
    title: 'アイコン 4種 と、透明を ふくまない apple-touch-icon',
    run: (root) => {
      const s = read(root, 'manifest.webmanifest');
      if (!s) return { ok: false, detail: ['manifest.webmanifest が ありません'] };
      const j = JSON.parse(s);
      const bad = [];
      const has = (size, purpose) => (j.icons || []).some((i) => i.sizes === size
        && (purpose === 'any' ? (!i.purpose || i.purpose.includes('any')) : (i.purpose || '').includes('maskable')));
      if (!has('192x192', 'any')) bad.push('192 の any アイコンが ありません');
      if (!has('512x512', 'any')) bad.push('512 の any アイコンが ありません');
      if (!has('192x192', 'maskable')) bad.push('192 の maskable が ありません');
      if (!has('512x512', 'maskable')) bad.push('512 の maskable が ありません');

      const html = read(root, 'index.html') || '';
      const m = html.replace(/<!--[\s\S]*?-->/g, '').match(/rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i);
      if (!m) bad.push('apple-touch-icon が ありません');
      else {
        const rel = m[1].replace(/^\.\//, '');
        const p = path.join(root, rel);
        if (!fs.existsSync(p)) bad.push(`apple-touch-icon の ファイルが ありません: ${rel}`);
        else if (pngHasAlpha(p)) bad.push(`${rel} に 透明が あります（iOS で 四すみが 黒く なります）`);
      }
      return { ok: bad.length === 0, detail: bad };
    },
  },
  {
    id: 'E_SW_CACHE_SCOPE',
    title: 'sw.js が 自アプリ接頭辞の キャッシュだけを 消して いる',
    run: (root) => {
      const src = read(root, 'sw.js');
      if (!src) return { ok: false, detail: ['sw.js が ありません'] };
      const code = stripComments(src);
      const at = code.search(/caches\s*\.\s*keys\s*\(/);
      if (at < 0) return { ok: true, detail: [] };
      // ⚠️ 「消す 式」を 追っては いけません（(k) => caches.delete(k) を 見のがします）。
      //    見るのは「startsWith で しぼって いる か」です。
      //
      // ⚠️ ファイル 全体から startsWith を さがしても いけません。
      //    sw.js には fetch の 中に
      //      if (!url.pathname.startsWith(...)) return;
      //    のような **別の** startsWith が ふつうに あります。
      //    それを 拾うと、caches.keys() を 全消しして いても 通って しまいます
      //    （scripts/self-test.mjs で 実さいに 見つかりました）。
      //    caches.keys() から その 式の おわりまで だけを 見ます。
      const seg = code.slice(at, at + 600);
      const end = seg.search(/addEventListener\s*\(/);
      const scope = end > 0 ? seg.slice(0, end) : seg;
      const ok = /\.\s*startsWith\s*\(/.test(scope) || /\.\s*indexOf\s*\([^)]*\)\s*===?\s*0/.test(scope);
      return { ok, detail: ['caches.keys() の 結果を しぼらずに 消して います。同じ ドメインの 他アプリが オフラインで 起動しなく なります'] };
    },
  },
  {
    id: 'E_SW_NO_LOCALSTORAGE',
    title: 'sw.js が localStorage に さわって いない',
    run: (root) => {
      const src = read(root, 'sw.js');
      if (!src) return { ok: false, detail: ['sw.js が ありません'] };
      // ⚠️ コメントを 落としてから 見る。「localStorage は さわりません」に 反応します
      return { ok: !/localStorage/.test(stripComments(src)), detail: ['sw.js が localStorage を さわって います'] };
    },
  },
  {
    id: 'E_SW_NO_SKIP_WAITING_ON_INSTALL',
    title: 'sw.js の install で skipWaiting() して いない',
    run: (root) => {
      const src = read(root, 'sw.js');
      if (!src) return { ok: false, detail: ['sw.js が ありません'] };
      const code = stripComments(src);
      const m = code.match(/addEventListener\(\s*['"]install['"][\s\S]*?(?=addEventListener\(\s*['"](?:activate|fetch|message)['"]|$)/);
      if (!m) return { ok: false, detail: ['install の ハンドラが ありません'] };
      const bad = /skipWaiting\s*\(/.test(m[0]);
      return { ok: !bad, detail: ['install で skipWaiting() すると、児童が 打って いる まっさい中に 版が 入れかわります'] };
    },
  },
  {
    id: 'E_SW_UPDATE_PROMPT',
    title: '更新の おしらせが あり、押された ときだけ 切りかえる',
    run: (root) => {
      const js = listFiles(root, 'js', '.js').map((rel) => stripComments(read(root, rel))).join('\n');
      const bad = [];
      if (!/SKIP_WAITING/.test(js)) bad.push('画面から SKIP_WAITING を おくって いません（更新の おしらせが ありません）');
      if (/addEventListener\(\s*['"]controllerchange['"]/.test(js)) {
        // 押した か どうか の 見はりが 無いと、初回訪問が かならず 1回 リロードされます
        const seg = js.slice(js.indexOf('controllerchange'), js.indexOf('controllerchange') + 400);
        if (!/location\s*\.\s*reload/.test(seg)) { /* reload しないなら 問題なし */ }
        else if (!/if\s*\(\s*!\w+/.test(seg)) bad.push('controllerchange で 無条件に reload して います（初回訪問が 1回 リロードされます）');
      }
      return { ok: bad.length === 0, detail: bad };
    },
  },
  {
    id: 'E_SW_REGISTER_READYSTATE',
    title: 'Service Worker の 登録に readyState の 分岐が ある',
    run: (root) => {
      const files = listFiles(root, 'js', '.js').filter((rel) => /serviceWorker\s*\.\s*register/.test(stripComments(read(root, rel))));
      if (!files.length) return { ok: false, detail: ['serviceWorker.register が ありません'] };
      const bad = files.filter((rel) => {
        const code = stripComments(read(root, rel));
        if (!/addEventListener\(\s*['"]load['"]/.test(code)) return false;   // load を 待って いない なら 問題なし
        return !/readyState\s*===?\s*['"]complete['"]/.test(code);
      });
      return { ok: bad.length === 0, detail: bad.map((f) => `${f}: load が もう 済んで いる 場合を 見て いません（黙って 登録されません）`) };
    },
  },
  {
    id: 'E_OFFLINE_HTML',
    title: 'offline.html が あり、外部資産にも JavaScript にも たよって いない',
    run: (root) => {
      const s = read(root, 'offline.html');
      if (!s) return { ok: false, detail: ['offline.html が ありません'] };
      const bad = [];
      const html = s.replace(/<!--[\s\S]*?-->/g, '');
      if (/<script/i.test(html)) bad.push('JavaScript を つかって います（本体が 無い ときに 出る ページです）');
      if (/https?:\/\//.test(html.replace(/<!DOCTYPE[^>]*>/i, ''))) bad.push('外の ファイルを 読んで います');
      if (/\son[a-z]+\s*=/i.test(html)) bad.push('onclick= が あります（CSP で 動きません）');
      if (!/<a[^>]+href/i.test(html)) bad.push('もういちど ひらく ための <a href> が ありません');
      return { ok: bad.length === 0, detail: bad };
    },
  },
  {
    id: 'E_SW_PRECACHE_OFFLINE',
    title: 'sw.js が offline.html を 先読みして いる',
    run: (root) => {
      const src = read(root, 'sw.js');
      if (!src) return { ok: false, detail: ['sw.js が ありません'] };
      const code = stripComments(src);
      // ⚠️ ファイル 全体で offline.html を さがしては いけません。
      //    fetch の 逃げ道に caches.match('./offline.html') と 書いて あれば
      //    見つかって しまい、**先読みして いなくても 通ります**。
      //    圏外では 先読みして いない ものは 出せないので、意味が 逆に なります
      //    （scripts/self-test.mjs で 実さいに 見つかりました）。
      //    先読みの 配列（[ … ] の 中）に 入って いる ことを 見ます。
      const inArray = [...code.matchAll(/\[[\s\S]{0,4000}?\]/g)]
        .some((m) => /offline\.html/.test(m[0]));
      return { ok: inArray, detail: ['offline.html を 先読みの 一覧に 入れて いません。圏外では 出せません'] };
    },
  },
  {
    id: 'E_MASKABLE_SAFE_ZONE',
    title: 'maskable の 下地が はしまで 届き、中身が セーフゾーンに おさまって いる',
    run: (root) => {
      const s = read(root, 'manifest.webmanifest');
      if (!s) return { ok: false, detail: ['manifest.webmanifest が ありません'] };
      const j = JSON.parse(s);
      const bad = [];
      for (const ic of (j.icons || []).filter((i) => (i.purpose || '').includes('maskable'))) {
        const p = path.join(root, ic.src);
        if (!fs.existsSync(p)) { bad.push(`${ic.src} が ありません`); continue; }
        if (pngHasAlpha(p)) bad.push(`${ic.src} に 透明が あります。maskable の 下地は はしまで のばして ください（縮んで 見えます）`);
      }
      return { ok: bad.length === 0, detail: bad };
    },
  },

  {
    id: 'F_FILE_SIZE',
    title: '1ファイルが 5,000行 / 400KB を こえて いない',
    run: (root) => {
      const bad = [];
      for (const rel of [...listFiles(root, 'js', '.js'), ...listFiles(root, 'css', '.css'), 'index.html']) {
        const s = read(root, rel);
        if (!s) continue;
        const lines = s.split('\n').length;
        const kb = Buffer.byteLength(s) / 1024;
        if (lines > 5000) bad.push(`${rel}: ${lines} 行`);
        if (kb > 400) bad.push(`${rel}: ${kb.toFixed(0)} KB`);
      }
      return { ok: bad.length === 0, detail: bad };
    },
  },
  {
    id: 'F_IMG_SIZE',
    title: '画像が 150KB 以下（PWA アイコン 512 は 60KB、favicon は 30KB）',
    run: (root) => {
      const bad = [];
      const walk = (dir) => {
        const p = path.join(root, dir);
        if (!fs.existsSync(p)) return;
        for (const f of fs.readdirSync(p)) {
          const full = path.join(p, f);
          if (fs.statSync(full).isDirectory()) { walk(path.join(dir, f)); continue; }
          if (!/\.(png|jpe?g|webp|gif)$/i.test(f)) continue;
          const kb = fs.statSync(full).size / 1024;
          const limit = /favicon/i.test(f) ? 30 : /512/.test(f) ? 60 : 150;
          if (kb > limit) bad.push(`${path.join(dir, f)}: ${kb.toFixed(1)} KB（上限 ${limit} KB）`);
        }
      };
      walk('icons'); walk('img'); walk('images');
      return { ok: bad.length === 0, detail: bad };
    },
  },
  {
    id: 'F_IMG_DIMENSIONS',
    title: '<img> に width / height が ある',
    run: (root) => {
      const bad = [];
      for (const rel of ['index.html', 'offline.html', ...listFiles(root, 'js', '.js')]) {
        const s = read(root, rel);
        if (!s) continue;
        const html = s.replace(/<!--[\s\S]*?-->/g, '');
        for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
          if (!/\bwidth=/.test(m[0]) || !/\bheight=/.test(m[0])) bad.push(`${rel}: width/height が ない <img>（画面が がたつきます）`);
          if (!/\balt=/.test(m[0])) bad.push(`${rel}: alt が ない <img>`);
        }
      }
      return { ok: bad.length === 0, detail: bad };
    },
  },
];

/** PNG に 完全不透明 でない 画素が あるか（標準ライブラリだけで 読みます） */
export function pngHasAlpha(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 26 || buf.readUInt32BE(0) !== 0x89504e47) return false;
  const colorType = buf[25];
  // 0 = グレー, 2 = RGB, 3 = パレット, 4 = グレー+α, 6 = RGBA
  if (colorType === 0 || colorType === 2) return false;
  if (colorType === 3) {
    // パレットの ときは tRNS チャンクが あれば 透明を もちます
    let i = 8;
    while (i + 8 <= buf.length) {
      const len = buf.readUInt32BE(i);
      const tag = buf.toString('latin1', i + 4, i + 8);
      if (tag === 'tRNS') return true;
      if (tag === 'IEND') break;
      i += 12 + len;
    }
    return false;
  }
  // α チャンネルを もつ 形式。実さいに 展開して 透明が あるかを 見ます
  return rgbaHasTransparency(buf);
}

function rgbaHasTransparency(buf) {
  const zlib = require$('node:zlib');
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const depth = buf[24];
  const colorType = buf[25];
  if (depth !== 8) return true;   // 判定できない ときは 安全側（透明が ある）に たおす
  const ch = colorType === 6 ? 4 : 2;
  let idat = Buffer.alloc(0);
  let i = 8;
  while (i + 8 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const tag = buf.toString('latin1', i + 4, i + 8);
    if (tag === 'IDAT') idat = Buffer.concat([idat, buf.subarray(i + 8, i + 8 + len)]);
    if (tag === 'IEND') break;
    i += 12 + len;
  }
  let raw;
  try { raw = zlib.inflateSync(idat); } catch (e) { return true; }
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[pos++];
    for (let x = 0; x < stride; x++) {
      const cur = raw[pos + x];
      const a = x >= ch ? out[y * stride + x - ch] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = (x >= ch && y > 0) ? out[(y - 1) * stride + x - ch] : 0;
      let v;
      if (filter === 0) v = cur;
      else if (filter === 1) v = cur + a;
      else if (filter === 2) v = cur + b;
      else if (filter === 3) v = cur + ((a + b) >> 1);
      else {
        const p = a + b - c;
        const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
        v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      out[y * stride + x] = v & 0xff;
    }
    pos += stride;
  }
  for (let k = ch - 1; k < out.length; k += ch) if (out[k] !== 255) return true;
  return false;
}

// node:zlib を 同期で 読むための 小さな ヘルパ（ESM から require 相当を つかう）
import { createRequire } from 'node:module';
const require$ = createRequire(import.meta.url);

export function runGigaChecks(root) {
  return CHECKS.map((c) => {
    let r;
    try { r = c.run(root); } catch (e) { r = { ok: false, detail: ['検査が 例外で 落ちました: ' + e.message] }; }
    return { id: c.id, title: c.title + (r.skip ? `（${r.skip}）` : ''), ok: !!r.ok, detail: r.ok ? [] : (r.detail || []) };
  });
}
