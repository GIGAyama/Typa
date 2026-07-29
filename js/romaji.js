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

  // ------------------------------------------------------------------
  // ローマ字の きまり（どこで つまずいたかを 数えるための ふだ）
  // ------------------------------------------------------------------
  //
  // 「d が にがて」より「ちいさい つ が にがて」の ほうが、つぎに 何を
  // すれば よいかが はっきり します。ローマ字の つまずきは キーの もんだいでは
  // なく **きまりの もんだい** だからです。
  //
  // ふだは buildChunks() の 中で つけます。ここが「どの きまりか」を
  // すでに 知って いる **ただ 1つの 場所** だからです。あとから かなを 見て
  // 引きなおす 作りに すると、いつか かならず 食いちがいます。

  /** ちいさい や ゆ よ（拗音）を 見わける ための 字 */
  const SMALL_Y = 'ゃゅょ';
  /** ちいさい あ い う え お（外来音の 見わけに つかいます） */
  const SMALL_V = 'ぁぃぅぇぉ';
  /** てんてん・まるの つく かな */
  const DAKUTEN = 'がぎぐげござじずぜぞだぢづでどばびぶべぼゔぱぴぷぺぽ';

  /** かなの 行（さいしょの 子音から 引きます。ヘボン式でも 同じ 行に なります） */
  const ROW_OF_HEAD = {
    a: 'row-a', i: 'row-a', u: 'row-a', e: 'row-a', o: 'row-a',
    k: 'row-ka', g: 'row-ka', c: 'row-ka', q: 'row-ka',
    s: 'row-sa', z: 'row-sa', j: 'row-sa',
    t: 'row-ta', d: 'row-ta',
    n: 'row-na',
    h: 'row-ha', b: 'row-ha', p: 'row-ha', f: 'row-ha',
    m: 'row-ma', y: 'row-ya', r: 'row-ra', w: 'row-wa', v: 'row-wa'
  };

  /**
   * かたまり1つに ふだを つけます。
   * @param {string} kana かたまりの かな（'っこ' 'ん' 'しゅ' など）
   * @param {string} cand 基本の 打ちかた
   * @returns {string} きまりの ふだ
   */
  function ruleOf(kana, cand) {
    if (!kana) return 'raw';
    // っ は つぎの かなと ひとかたまりに なります。
    // その ばあいは っ の ほうを 見ます（つぎの 行の ふだは 消えます）
    if (kana.indexOf('っ') >= 0) return 'sokuon';
    if (kana === 'ん') return 'hatsuon';
    if (kana.length === 2 && SMALL_Y.indexOf(kana[1]) >= 0) return 'youon';
    if (kana.length === 2 && SMALL_V.indexOf(kana[1]) >= 0) return 'gaion';
    if (kana.length === 1 && DAKUTEN.indexOf(kana) >= 0) return 'dakuten';
    if (kana.length === 1 && KANA[kana]) {
      // 記号（ー、。・「」スペース）は きまりの べんきょうでは ないので べつに します
      const row = ROW_OF_HEAD[(cand || '').charAt(0)];
      return row || 'kigou';
    }
    // かな表に ない もの（英数字）は 数えません
    return 'raw';
  }

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
    // ふだは ぜんぶ 組み上がってから つけます。っ と ん は
    // うしろの かたまりと まざるので、ここで ないと 正しく つきません
    chunks.forEach(c => { c.rule = ruleOf(c.kana, c.cands[0]); });
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

    /**
     * これから打つキーと、それが どの きまりの ものか。
     *
     * expected() と べつべつに 引く 作りに すると、下の「次のかたまりに
     * ずれる」場面で かならず 食いちがいます。ここに 一本化します。
     *
     * @returns {{ch: string, rule: string, kana: string}}
     */
    function expectedInfo() {
      if (finished()) return { ch: '', rule: '', kana: '' };
      const cur = chunks[index];
      const list = alive(buffer);
      const cand = list[0] || cur.cands[0];
      const ch = cand.charAt(buffer.length);
      if (ch) return { ch, rule: cur.rule, kana: cur.kana };
      // 「かんじ」の n を1回打った状態のように、いまのかたまりはもう打ち終えていて、
      // 次の1打で「ん」か「んな」かが決まる場面。ここで空を返すと画面の案内が
      // 消えてしまうので、次のかたまりの1文字目を出します。
      const next = chunks[index + 1];
      if (!next || !next.cands[0]) return { ch: '', rule: '', kana: '' };
      return { ch: next.cands[0].charAt(0), rule: next.rule, kana: next.kana };
    }

    /** これから打つキー（複数の正解があるときは基本の打ち方を出します） */
    function expected() { return expectedInfo().ch; }

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
      expectedInfo,
      kanaDone,
      isFinished: finished,
      /** 「ん」を n 1回で打ち終えた状態など、区切りとして正解にできるか */
      canFinishHere: () => finished() || (index === chunks.length - 1 && completable()),
      /** お題全体のローマ字（基本の打ち方）の長さ。速さの目安に使います */
      length: () => chunks.reduce((sum, c) => sum + c.cands[0].length, 0)
    };
  }

  /**
   * 「ローマ字ひょう」の画面に出す並び。
   * ひょうの中身はこのファイルの KANA / KANA2 から引くので、
   * 打てるものとひょうに出るものが食いちがうことはありません。
   */
  const TABLE = [
    { title: 'あ行', kana: ['あ', 'い', 'う', 'え', 'お'] },
    { title: 'か行', kana: ['か', 'き', 'く', 'け', 'こ'] },
    { title: 'さ行', kana: ['さ', 'し', 'す', 'せ', 'そ'] },
    { title: 'た行', kana: ['た', 'ち', 'つ', 'て', 'と'] },
    { title: 'な行', kana: ['な', 'に', 'ぬ', 'ね', 'の'] },
    { title: 'は行', kana: ['は', 'ひ', 'ふ', 'へ', 'ほ'] },
    { title: 'ま行', kana: ['ま', 'み', 'む', 'め', 'も'] },
    { title: 'や行', kana: ['や', 'ゆ', 'よ'] },
    { title: 'ら行', kana: ['ら', 'り', 'る', 'れ', 'ろ'] },
    { title: 'わ行・ん', kana: ['わ', 'を', 'ん'],
      note: '「ん」は n を 2かい 打つと かならず 出ます。' },
    { title: 'が行', kana: ['が', 'ぎ', 'ぐ', 'げ', 'ご'] },
    { title: 'ざ行', kana: ['ざ', 'じ', 'ず', 'ぜ', 'ぞ'] },
    { title: 'だ行', kana: ['だ', 'ぢ', 'づ', 'で', 'ど'] },
    { title: 'ば行', kana: ['ば', 'び', 'ぶ', 'べ', 'ぼ'] },
    { title: 'ぱ行', kana: ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'] },
    { title: 'きゃ・ぎゃ', kana: ['きゃ', 'きゅ', 'きょ', 'ぎゃ', 'ぎゅ', 'ぎょ'] },
    { title: 'しゃ・じゃ', kana: ['しゃ', 'しゅ', 'しょ', 'じゃ', 'じゅ', 'じょ'] },
    { title: 'ちゃ・にゃ', kana: ['ちゃ', 'ちゅ', 'ちょ', 'にゃ', 'にゅ', 'にょ'] },
    { title: 'ひゃ・びゃ・ぴゃ', kana: ['ひゃ', 'ひゅ', 'ひょ', 'びゃ', 'びゅ', 'びょ', 'ぴゃ', 'ぴゅ', 'ぴょ'] },
    { title: 'みゃ・りゃ', kana: ['みゃ', 'みゅ', 'みょ', 'りゃ', 'りゅ', 'りょ'] },
    { title: 'ちいさい 字', kana: ['ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゃ', 'ゅ', 'ょ', 'っ'],
      note: '「っ」は、つぎの 字の さいしょを 2かい 打つのが かんたんです（きって → kitte）。' },
    { title: 'きごう', kana: ['ー', '、', '。', '・'] }
  ];

  /** ひょうに出す打ちかた。「ん」「っ」はチャンクの作りかたで決まるのでここで足します */
  function candidatesOf(kana) {
    if (kana === 'ん') return ['nn', "n'"];
    if (kana === 'っ') return SOKUON.slice(0, 2);
    return (KANA2[kana] || KANA[kana] || []).slice();
  }

  global.Typa = global.Typa || {};
  global.Typa.Romaji = { buildChunks, createMatcher, toHiragana, candidatesOf, ruleOf, KANA, KANA2, SOKUON, TABLE };
})(window);
