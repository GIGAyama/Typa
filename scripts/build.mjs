#!/usr/bin/env node
/**
 * =====================================================================
 * build.mjs — src/ の ソースから js/ の 配信用を つくる
 * =====================================================================
 *
 *   npm run build
 *
 * ■ なにを するか
 * **コメントと 字下げを 外すだけ** です。名前は 1つも 書きかえません。
 * `state.correctKeys` は 配信用でも `state.correctKeys` の ままなので、
 * 学校の 端末で 開発者ツールを 開いても そのまま 読めますし、
 * エラーの 行番号も 追えます。
 *
 *   src/app.js  … 人が 読む もの（コメントが 正本の 説明です）
 *   js/app.js   … ブラウザに 配る もの（これを 手で 直しては いけません）
 *
 * ■ なぜ ひつようか
 * 実ブラウザで はかると、19本の JS が **とどいて からの 550ms**（CPU を
 * 4ばい おそくした 値）が まるごと 読みこみ・実行でした。通信は 70ms しか
 * かかって いません。つまり おそいのは **量**です。
 * 481KB の うち 186KB（39%）が コメントで、それを 外すと 254KB に なります。
 * このアプリが いちばん みじかく したい「ひらいてから 打ちはじめるまで」に
 * そのまま きいて きます。
 *
 * ■ 安全のために していること
 *
 * 1. **文字列・テンプレート・正規表現の 中には 1文字も さわりません。**
 *    お題の HTML は テンプレートの 中に 字下げ ごと 書いて あるので、
 *    そこを 詰めると **画面の 中身が かわって しまいます**。
 *    中身は もとの ままで 写します（下の `emit(..., true)`）。
 *
 * 2. **改行を むやみに 消しません。**
 *    JavaScript は 改行で 文の 切れ目を 決める ことが あります（ASI）。
 *    行コメントは 改行を のこして 消し、複数行に またがる ブロックコメントは
 *    **改行 1つに** 置きかえます。空に なった 行だけを おとします。
 *
 * 3. **できた ものを 3つの めじるしで たしかめます。**
 *    ・V8 の 本物の 構文解析（`new vm.Script`）を 通るか
 *    ・もう一度 かけても 何も 変わらないか（べきとう）
 *    ・コメントと 空白を のぞいた 中身が、もとと **1文字も ちがわない**か
 *    そのうえで `tools/check-bundle.js` が、src/ と js/ を べつべつに
 *    読みこんで **同じ こたえを 返すか**まで くらべます。
 *
 * ■ ここに 依存パッケージを 入れては いけません
 * CI は `npm install` を しません（`.github/workflows/ci.yml`）。
 * 依存が 0 だからこそ、CI が その場で 作り直して **配信用が 古い ままなら
 * 落とす** ことが できます。古いまま 配られる ことが、この 仕組みで
 * いちばん こわい 失敗です。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SRC_DIR = path.join(ROOT, 'src');
export const OUT_DIR = path.join(ROOT, 'js');

/** 名前・数字を つくる 文字 */
const ID = /[A-Za-z0-9_$]/;

/**
 * この ことばの あとの `/` は わりざんでは なく **正規表現の はじまり**です。
 * `return /^a/.test(x)` のような 書きかたを わりざんと まちがえると、
 * 正規表現の 中の 文字が コードとして 読まれて しまいます。
 */
const REGEX_AFTER = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'case', 'do', 'else', 'yield', 'await'
]);

/** 直前の 文字と ことばから、`/` が 正規表現の はじまりかを 決めます */
function regexAllowed(prevChar, prevWord) {
  if (!prevChar) return true;
  if (REGEX_AFTER.has(prevWord)) return true;
  // 名前・数字・閉じかっこ の あとは わりざん（a/2, arr[0]/2, f(x)/2）
  if (ID.test(prevChar)) return false;
  return prevChar !== ')' && prevChar !== ']' && prevChar !== '}';
}

/**
 * ソースを「コメントを のぞいた 文字」と「そこが 文字列の 中か」に 分けます。
 *
 * @param {string} src
 * @returns {{text: string, raw: boolean[]}}
 *   raw[i] が true の ところは 文字列・テンプレート・正規表現の 中です。
 *   **そこは 1文字も さわりません。**
 */
function scan(src) {
  let text = '';
  const raw = [];
  const emit = (s, isRaw) => {
    text += s;
    for (let k = 0; k < s.length; k++) raw.push(!!isRaw);
  };

  /** 直前に 出した 1文字が「コードの ここに 書いた もの」なら 返します */
  const lastCode = () =>
    (text.length && raw[raw.length - 1] === false) ? text[text.length - 1] : '';

  /**
   * コードの 区切り（空白か 改行）を 1つ 出します。
   *
   * コメントを 空白に 置きかえる ので、`{ /* … *​/ }` のように 前後にも 空白が
   * ある ところでは 区切りが 2つ 3つ ならびます。そのまま 出すと
   * **もう一度 かけた ときに 結果が 変わり**、配信用が ソースと そろって いるかを
   * バイトで くらべられなく なります。ここで 1つに まとめて おきます。
   */
  const emitGap = (ch) => {
    const last = lastCode();
    if (ch === '\n') {
      if (last === '\n') return;                       // すでに 改行が ある
      if (last === ' ') { text = text.slice(0, -1); raw.pop(); }   // 空白を 改行に かえる
      emit('\n', false);
      return;
    }
    if (last === ' ' || last === '\n') return;         // すでに 区切りが ある
    emit(' ', false);
  };

  const n = src.length;
  let i = 0;
  let prevChar = '';
  let prevWord = '';
  // テンプレートの 入れ子。`${` の 中に また テンプレートが 書けます
  //   { kind: 'tpl' } … いま テンプレートの 文字の 中
  //   { kind: 'sub', depth } … いま `${ … }` の 中（depth は かっこの 深さ）
  const stack = [];
  const top = () => (stack.length ? stack[stack.length - 1] : null);

  while (i < n) {
    const t = top();

    // ---- テンプレートの 文字の 中（そのまま 写します）----
    if (t && t.kind === 'tpl') {
      const c = src[i];
      if (c === '\\') { emit(src.slice(i, i + 2), true); i += 2; continue; }
      if (c === '`') { stack.pop(); emit(c, true); i++; prevChar = '`'; prevWord = ''; continue; }
      if (c === '$' && src[i + 1] === '{') {
        stack.push({ kind: 'sub', depth: 0 });
        emit('${', true);
        i += 2; prevChar = '{'; prevWord = '';
        continue;
      }
      emit(c, true); i++;
      continue;
    }

    // ---- コードの 中 ----
    const c = src[i];
    const d = src[i + 1];

    // 行コメント … 改行は のこして 中身だけ すてます
    if (c === '/' && d === '/') {
      let j = src.indexOf('\n', i);
      if (j < 0) j = n;
      i = j;
      continue;
    }

    // ブロックコメント … 改行を またぐなら 改行 1つに して、ASI を こわしません
    if (c === '/' && d === '*') {
      let j = src.indexOf('*/', i + 2);
      j = j < 0 ? n : j + 2;
      emitGap(src.slice(i, j).includes('\n') ? '\n' : ' ');
      i = j;
      continue;
    }

    // 文字列
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === c || src[j] === '\n') break;
        j++;
      }
      emit(src.slice(i, j + 1), true);
      i = j + 1; prevChar = c; prevWord = '';
      continue;
    }

    // テンプレートの はじまり
    if (c === '`') { stack.push({ kind: 'tpl' }); emit(c, true); i++; continue; }

    // 正規表現
    if (c === '/' && regexAllowed(prevChar, prevWord)) {
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < n) {
        const e = src[j];
        if (e === '\\') { j += 2; continue; }
        if (e === '\n') break;
        if (e === '[') inClass = true;
        else if (e === ']') inClass = false;
        else if (e === '/' && !inClass) { closed = true; break; }
        j++;
      }
      if (closed) {
        j++;
        while (j < n && /[a-z]/.test(src[j])) j++;      // g i m s u y の ふだ
        emit(src.slice(i, j), true);
        i = j; prevChar = '/'; prevWord = '';
        continue;
      }
      // 閉じて いなければ ただの わりざんです。下の ふつうの 文字へ
    }

    // よこの 空白は まとめて 1つに します（たての そろえは 見た目だけの もの）
    if (c === ' ' || c === '\t') {
      let j = i;
      while (j < n && (src[j] === ' ' || src[j] === '\t')) j++;
      emitGap(' ');
      i = j;
      continue;
    }

    // `${ … }` を 閉じたら テンプレートに もどります
    if (c === '}' && t && t.kind === 'sub') {
      if (t.depth === 0) {
        stack.pop();
        emit('}', true);
        i++; prevChar = '}'; prevWord = '';
        continue;
      }
      t.depth--;
    } else if (c === '{' && t && t.kind === 'sub') {
      t.depth++;
    }

    emit(c, false);
    if (!/\s/.test(c)) {
      prevChar = c;
      prevWord = ID.test(c) ? prevWord + c : '';
    }
    i++;
  }

  return { text, raw };
}

/**
 * コメントと 字下げを 外します。
 *
 * 行の あたまと おしりの 空白は、**そこが 文字列の 中で ない ときだけ** 外します。
 * テンプレートの 中の 字下げは 画面に そのまま 出る 中身なので のこします。
 */
export function strip(src) {
  const { text, raw } = scan(src);
  const out = [];
  let from = 0;

  for (let p = 0; p <= text.length; p++) {
    if (p !== text.length && text[p] !== '\n') continue;

    let a = from;
    let b = p;
    // あたまの 空白（コードの ぶんだけ）
    while (a < b && !raw[a] && (text[a] === ' ' || text[a] === '\t')) a++;
    // おしりの 空白（コードの ぶんだけ）
    while (b > a && !raw[b - 1] && (text[b - 1] === ' ' || text[b - 1] === '\t')) b--;

    const line = text.slice(a, b);
    // 中身が なく、行の おわりの 改行も コードの ものなら、行ごと おとします。
    // テンプレートの 中の 空行は「文の 切れ目」では なく 中身なので のこします
    const eolIsCode = p === text.length || !raw[p];
    if (line === '' && eolIsCode) { from = p + 1; continue; }

    out.push(line);
    if (p !== text.length) out.push(eolIsCode ? '\n' : '\n');
    from = p + 1;
  }

  return out.join('').replace(/^\n+/, '').replace(/\n+$/, '') + '\n';
}

/**
 * たしかめ用の「中身の ゆびもん」。
 * コメントと **コードの 空白**を のぞいた もので、文字列の 中は そのまま です。
 * もとと 配信用で これが 1文字でも ちがえば、何かを こわして います。
 */
export function signature(src) {
  const { text, raw } = scan(src);
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (!raw[i] && /\s/.test(text[i])) continue;
    out += text[i];
  }
  return out;
}

const BANNER = (name) =>
  `/* Typa — src/${name} から つくった 配信用です。手で 直さず src/ を 直して npm run build。*/\n`;

/** src/ の ファイル名（読む じゅんばんは index.html が 決めるので ならびは 名前順） */
export function sources() {
  return fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.js')).sort();
}

/**
 * 1本 ぶんの 配信用を つくります（ファイルには 書きません）。
 * @returns {string}
 */
export function buildOne(name) {
  const src = fs.readFileSync(path.join(SRC_DIR, name), 'utf8');
  const out = strip(src);

  // ① V8 の 本物の 構文解析を 通るか
  try { new vm.Script(out, { filename: `js/${name}` }); }
  catch (e) { throw new Error(`js/${name} が 構文解析を 通りません: ${e.message}`); }

  // ② もう一度 かけても 変わらないか（べきとう）
  if (strip(out) !== out) throw new Error(`js/${name} … もう一度 かけると 変わります`);

  // ③ コメントと 空白を のぞいた 中身が もとと 同じか
  const a = signature(src);
  const b = signature(out);
  if (a !== b) {
    let k = 0;
    while (k < a.length && k < b.length && a[k] === b[k]) k++;
    throw new Error(
      `js/${name} … 中身が かわりました（${k} 文字目のあたり）\n` +
      `  もと: ${JSON.stringify(a.slice(Math.max(0, k - 40), k + 40))}\n` +
      `  あと: ${JSON.stringify(b.slice(Math.max(0, k - 40), k + 40))}`
    );
  }

  return BANNER(name) + out;
}

/** ぜんぶ つくります。@returns {Map<string,string>} ファイル名 → 中身 */
export function buildAll() {
  const out = new Map();
  for (const name of sources()) out.set(name, buildOne(name));
  return out;
}

// ------------------------------------------------------------------
// じっさいに 書き出す（npm run build）
// ------------------------------------------------------------------

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const built = buildAll();

  // src/ から 消えた ファイルが js/ に のこりつづけない ように します
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.js') && !built.has(f)) fs.unlinkSync(path.join(OUT_DIR, f));
  }

  let before = 0;
  let after = 0;
  for (const [name, text] of built) {
    before += Buffer.byteLength(fs.readFileSync(path.join(SRC_DIR, name), 'utf8'));
    after += Buffer.byteLength(text);
    fs.writeFileSync(path.join(OUT_DIR, name), text);
  }
  const kb = (n) => (n / 1024).toFixed(0) + ' KB';
  console.log(`${built.size} 本 つくりました  ${kb(before)} → ${kb(after)}` +
    `（${(100 - (after / before) * 100).toFixed(0)}% へらしました）`);
}
