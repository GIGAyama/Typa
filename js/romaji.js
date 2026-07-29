/**
 * =====================================================================
 * romaji.js — ローマ字入力エンジン
 * =====================================================================
 * かなの文字列を「打てるかたまり（チャンク）」に分け、児童が打ったキーが
 * 正しいかどうかを1打ずつ判定します。
 *
 * 設計の考え方
 * ------------
 * ローマ字には**正解が複数あります**（し = si / shi / ci、じゃ = ja / zya / jya）。
 * 学校でどのローマ字表を習ったかは学年や教科書で変わるので、
 * このアプリは「習ったやり方でそのまま打てる」ことを最優先にし、
 * よく使われる打ち方をすべて正解として受け付けます。
 * そのうえで、画面のヒントには **cands[0]（もっとも基本的な打ち方）** を出します。
 *
 * むずかしいのは次の3つで、いずれも「かたまりの作り方」で吸収しています。
 *
 * 1. っ（そくおん）… 次のかたまりの子音を2回打つ（きって → kitte）。
 *    「っ」を単独の xtu として打つ児童もいるので、両方を受け付けます。
 *    → 「っ」は次のかたまりと合体させ、候補を作り直します。
 *
 * 2. ん（はつおん）… ふつうは nn ですが、次が子音なら n 1回でも打てます
 *    （かんじ → kanji）。ただし次が「あ行・な行・や行」のときに n 1回だと
 *    別の音になってしまうため、そのときは nn / n' だけを正解にします。
 *
 * 3. n を1回打った時点では、まだ「ん」が確定していません。
 *    次に打たれたキーが n なら「ん」、k なら「ん＋か行」…と後から決まります。
 *    → 「かたまりが完成しているかもしれない（completable）」状態を持ち、
 *      次の1打を「今のかたまりの続き」→「次のかたまりの先頭」の順に試します。
 *
 * 数字・記号・アルファベットは1文字＝1チャンクとしてそのまま通します。
 */
(function (global) {
  'use strict';

  /**
   * かな1文字（または拗音などの2文字）→ 受け付けるローマ字の一覧。
   * 先頭がヒントに出る「基本の打ち方」です。
   */
  const KANA = {
    // --- あ行 ---
    'あ': ['a'], 'い': ['i', 'yi'], 'う': ['u', 'wu'], 'え': ['e'], 'お': ['o'],
    // --- か行 ---
    'か': ['ka', 'ca'], 'き': ['ki'], 'く': ['ku', 'cu', 'qu'], 'け': ['ke'], 'こ': ['ko', 'co'],
    'が': ['ga'], 'ぎ': ['gi'], 'ぐ': ['gu'], 'げ': ['ge'], 'ご': ['go'],
    // --- さ行 ---
    'さ': ['sa'], 'し': ['si', 'shi', 'ci'], 'す': ['su'], 'せ': ['se', 'ce'], 'そ': ['so'],
    'ざ': ['za'], 'じ': ['zi', 'ji'], 'ず': ['zu'], 'ぜ': ['ze'], 'ぞ': ['zo'],
    // --- た行 ---
    'た': ['ta'], 'ち': ['ti', 'chi'], 'つ': ['tu', 'tsu'], 'て': ['te'], 'と': ['to'],
    'だ': ['da'], 'ぢ': ['di'], 'づ': ['du'], 'で': ['de'], 'ど': ['do'],
    // --- な行 ---
    'な': ['na'], 'に': ['ni'], 'ぬ': ['nu'], 'ね': ['ne'], 'の': ['no'],
    // --- は行 ---
    'は': ['ha'], 'ひ': ['hi'], 'ふ': ['hu', 'fu'], 'へ': ['he'], 'ほ': ['ho'],
    'ば': ['ba'], 'び': ['bi'], 'ぶ': ['bu'], 'べ': ['be'], 'ぼ': ['bo'],
    'ぱ': ['pa'], 'ぴ': ['pi'], 'ぷ': ['pu'], 'ぺ': ['pe'], 'ぽ': ['po'],
    // --- ま行 ---
    'ま': ['ma'], 'み': ['mi'], 'む': ['mu'], 'め': ['me'], 'も': ['mo'],
    // --- や行 ---
    'や': ['ya'], 'ゆ': ['yu'], 'よ': ['yo'],
    // --- ら行 ---
    'ら': ['ra'], 'り': ['ri'], 'る': ['ru'], 'れ': ['re'], 'ろ': ['ro'],
    // --- わ行 ---
    'わ': ['wa'], 'ゐ': ['wi'], 'ゑ': ['we'], 'を': ['wo'],
    'ゔ': ['vu'],
    // --- 小さい字（単独で打つとき） ---
    'ぁ': ['xa', 'la'], 'ぃ': ['xi', 'li'], 'ぅ': ['xu', 'lu'], 'ぇ': ['xe', 'le'], 'ぉ': ['xo', 'lo'],
    'ゃ': ['xya', 'lya'], 'ゅ': ['xyu', 'lyu'], 'ょ': ['xyo', 'lyo'], 'ゎ': ['xwa', 'lwa'],
    // --- 記号 ---
    'ー': ['-'], '、': [','], '。': ['.'], '・': ['/'], '「': ['['], '」': [']'],
    '　': [' '], ' ': [' ']
  };

  /** 拗音など、かな2文字でひとかたまりになるもの */
  const KANA2 = {
    'きゃ': ['kya'], 'きぃ': ['kyi'], 'きゅ': ['kyu'], 'きぇ': ['kye'], 'きょ': ['kyo'],
    'ぎゃ': ['gya'], 'ぎぃ': ['gyi'], 'ぎゅ': ['gyu'], 'ぎぇ': ['gye'], 'ぎょ': ['gyo'],
    'しゃ': ['sya', 'sha'], 'しゅ': ['syu', 'shu'], 'しぇ': ['sye', 'she'], 'しょ': ['syo', 'sho'],
    'じゃ': ['zya', 'ja', 'jya'], 'じゅ': ['zyu', 'ju', 'jyu'],
    'じぇ': ['zye', 'je', 'jye'], 'じょ': ['zyo', 'jo', 'jyo'],
    'ちゃ': ['tya', 'cha', 'cya'], 'ちゅ': ['tyu', 'chu', 'cyu'],
    'ちぇ': ['tye', 'che', 'cye'], 'ちょ': ['tyo', 'cho', 'cyo'],
    'ぢゃ': ['dya'], 'ぢゅ': ['dyu'], 'ぢょ': ['dyo'],
    'にゃ': ['nya'], 'にぃ': ['nyi'], 'にゅ': ['nyu'], 'にぇ': ['nye'], 'にょ': ['nyo'],
    'ひゃ': ['hya'], 'ひゅ': ['hyu'], 'ひぇ': ['hye'], 'ひょ': ['hyo'],
    'びゃ': ['bya'], 'びゅ': ['byu'], 'びょ': ['byo'],
    'ぴゃ': ['pya'], 'ぴゅ': ['pyu'], 'ぴょ': ['pyo'],
    'みゃ': ['mya'], 'みゅ': ['myu'], 'みょ': ['myo'],
    'りゃ': ['rya'], 'りゅ': ['ryu'], 'りぇ': ['rye'], 'りょ': ['ryo'],
    'ふぁ': ['fa'], 'ふぃ': ['fi'], 'ふぇ': ['fe'], 'ふぉ': ['fo'], 'ふゅ': ['fyu'],
    'ゔぁ': ['va'], 'ゔぃ': ['vi'], 'ゔぇ': ['ve'], 'ゔぉ': ['vo'],
    'てぃ': ['thi'], 'でぃ': ['dhi'], 'とぅ': ['twu'], 'どぅ': ['dwu'],
    'うぃ': ['wi', 'whi'], 'うぇ': ['we', 'whe'], 'うぉ': ['who'],
    'つぁ': ['tsa'], 'つぃ': ['tsi'], 'つぇ': ['tse'], 'つぉ': ['tso']
  };

  /** 「っ」を単独で打つときの候補 */
  const SOKUON = ['xtu', 'ltu', 'xtsu', 'ltsu'];

  /** カタカナ → ひらがな（お題にカタカナが混ざっても打てるようにします） */
  function toHiragana(text) {
    return String(text).replace(/[ァ-ヶ]/g, ch =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60));
  }

  /** 母音（「ん」を n 1回で打ってよいかの判定に使います） */
  const VOWELS = 'aiueo';

  /**
   * かな文字列を「打つかたまり」の配列にします。
   * @param {string} text お題（ひらがな・カタカナ・英数字・記号）
   * @returns {Array<{kana: string, cands: string[]}>}
   */
  function buildChunks(text) {
    const src = toHiragana(text);
    const raw = [];
    for (let i = 0; i < src.length;) {
      const pair = src.substr(i, 2);
      if (KANA2[pair]) { raw.push({ kana: pair, cands: KANA2[pair].slice() }); i += 2; continue; }
      const ch = src[i];
      if (ch === 'っ') { raw.push({ kana: 'っ', cands: null, sokuon: true }); i += 1; continue; }
      if (KANA[ch]) { raw.push({ kana: ch, cands: KANA[ch].slice() }); i += 1; continue; }
      // かな表にない文字（英数字・記号）はそのまま1打で通します
      raw.push({ kana: ch, cands: [ch] });
      i += 1;
    }

    // うしろから前に向かって「っ」と「ん」を組み立てます。
    // どちらも**次のかたまり**を見て候補が決まるためです。
    const chunks = [];
    for (let i = raw.length - 1; i >= 0; i--) {
      const cur = raw[i];
      const next = chunks[0] || null;

      if (cur.sokuon) {
        // っ + 次のかたまり = 次の子音を2回（kitte）。次が無ければ xtu だけ
        if (!next) { chunks.unshift({ kana: 'っ', cands: SOKUON.slice() }); continue; }
        const doubled = next.cands
          .filter(c => c.length > 0 && VOWELS.indexOf(c[0]) < 0 && c[0] !== 'n' && /[a-z]/.test(c[0]))
          .map(c => c[0] + c);
        const alone = SOKUON.map(s => s + next.cands[0]);
        const cands = doubled.concat(alone);
        chunks.shift();
        chunks.unshift({ kana: 'っ' + next.kana, cands: cands.length ? cands : alone });
        continue;
      }

      if (cur.kana === 'ん') {
        const cands = ['nn', "n'", 'xn'];
        // 次が「あ行・な行・や行・ん」でなければ、n 1回でも打てます（kanji）
        const head = next && next.cands[0] ? next.cands[0][0] : '';
        if (head && VOWELS.indexOf(head) < 0 && head !== 'n' && head !== 'y') cands.unshift('n');
        chunks.unshift({ kana: 'ん', cands });
        continue;
      }

      chunks.unshift({ kana: cur.kana, cands: cur.cands });
    }
    return chunks;
  }

  /**
   * お題1つぶんの入力判定機を作ります。
   *
   * 1打ごとに `input(key)` を呼び、返ってきた `ok` で正誤を判定します。
   * 画面には `hint()` の返す「これから打つローマ字」を出します。
   */
  function createMatcher(text) {
    const chunks = buildChunks(text);
    let index = 0;      // いま打っているかたまり
    let buffer = '';    // そのかたまりで打ち終えた文字
    let typed = '';     // 最初から打ち終えたローマ字（表示用）

    /** いまのかたまりで、buffer から続けられる候補 */
    function alive(buf) {
      const c = chunks[index];
      return c ? c.cands.filter(cand => cand.indexOf(buf) === 0) : [];
    }

    /** buffer がちょうど候補ひとつと同じ＝かたまりが完成しているかもしれない */
    function completable() {
      const c = chunks[index];
      return !!c && buffer !== '' && c.cands.indexOf(buffer) >= 0;
    }

    function finished() { return index >= chunks.length; }

    /** これから打つキー（複数の正解があるときは基本の打ち方を出します） */
    function expected() {
      if (finished()) return '';
      const list = alive(buffer);
      const cand = list[0] || chunks[index].cands[0];
      return cand.charAt(buffer.length) || '';
    }

    /**
     * 画面に出すローマ字のヒント。
     * @returns {{done: string, rest: string}} done は打ち終えた分（色を変えて出します）
     */
    function hint() {
      let rest = '';
      if (!finished()) {
        const list = alive(buffer);
        const cand = list[0] || chunks[index].cands[0];
        rest += cand.slice(buffer.length);
      }
      for (let i = index + 1; i < chunks.length; i++) rest += chunks[i].cands[0];
      return { done: typed + buffer, rest };
    }

    /** かたまりを1つ確定して次へ進みます */
    function commit() {
      typed += buffer;
      buffer = '';
      index++;
    }

    /**
     * 1打を判定します。
     * @param {string} key 打たれた文字（1文字）
     * @returns {{ok: boolean, chunkDone: boolean, finished: boolean}}
     */
    function input(key) {
      if (finished()) return { ok: false, chunkDone: false, finished: true };
      const list = alive(buffer + key);
      if (list.length > 0) {
        buffer += key;
        let chunkDone = false;
        // 「これ以上のばせない」ときだけ、その場でかたまりを確定します。
        // n のように先があるときは確定を保留し、次の1打で決めます
        if (list.indexOf(buffer) >= 0 && list.every(c => c.length === buffer.length)) {
          commit();
          chunkDone = true;
        }
        return { ok: true, chunkDone, finished: finished() };
      }

      // いまのかたまりでは続けられない。
      // 「n」だけ打った「ん」のように、すでに完成しているとみなせるなら
      // 次のかたまりの1打目として、もう一度だけ試します
      if (completable() && index + 1 < chunks.length) {
        const nextChunk = chunks[index + 1];
        if (nextChunk.cands.some(cand => cand.indexOf(key) === 0)) {
          commit();
          return input(key);
        }
      }
      return { ok: false, chunkDone: false, finished: false };
    }

    /** お題の かなを 何文字まで 打ち終えたか（画面の 色分けに つかいます） */
    function kanaDone() {
      let n = 0;
      for (let i = 0; i < index && i < chunks.length; i++) n += chunks[i].kana.length;
      return n;
    }

    return {
      chunks,
      input,
      hint,
      expected,
      kanaDone,
      isFinished: finished,
      /** 「ん」を n 1回で打ち終えた状態など、区切りとして正解にできるか */
      canFinishHere: () => finished() || (index === chunks.length - 1 && completable()),
      /** お題全体のローマ字（基本の打ち方）の長さ。速さの目安に使います */
      length: () => chunks.reduce((sum, c) => sum + c.cands[0].length, 0)
    };
  }

  global.Typa = global.Typa || {};
  global.Typa.Romaji = { buildChunks, createMatcher, toHiragana, KANA, KANA2 };
})(window);
