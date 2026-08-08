/**
 * =====================================================================
 * lessons.js — コースとステージ（練習の中身）
 * =====================================================================
 * アプリの階層は「コース → ステージ → れんしゅう → けっか」の4段です。
 * どの画面からも下部バーの「もどる」で1つ前にもどれます。
 *
 * mode は練習のしゅるいです。きろくの集計や表示の出しわけに使います。
 *   key       … キーの位置をおぼえる（アルファベットをそのまま打つ）
 *   romaji    … ローマ字のきまりをおぼえる（かな1〜2文字ずつ）
 *   word      … ことばを打つ
 *   sentence  … 文を打つ
 *   shortcut  … ショートカットキーをつかう
 *   challenge … 時間ぎめ（このファイルの下のほうで組み立てます）
 *
 * grade は想定学年です。ステージ一覧に「めやす ○年」として出ます。
 * skill は「このステージが何を鍛えるか」を半角で書いたラベルで、
 * このファイルを手なおしする人のための目印です（アプリの動きには使いません）。
 */
(function (global) {
  'use strict';

  /** かな（＋表示用のことば）をまとめて作るヘルパー */
  const w = (k, d) => ({ k, d: d || '' });

  /** キーの位置をおぼえるステージのお題（アルファベットをそのまま打ちます） */
  const keyItems = list => list.map(t => ({ k: t, d: '', raw: true }));

  const COURSES = [
    // -----------------------------------------------------------------
    { id: 'home-position', title: 'ゆびの ばしょを おぼえる', short: 'ゆびの ばしょ',
      note: 'ホームポジションから じゅんばんに ひろげます',
      note2: 'キーボードを 見ないで 打てるように なる いちばんの ちかみちです。',
      color: 'blue', icon: 'hand',
      stages: [
        { id: 'hp-1', title: 'ホームポジション ①', note: 'f と j に ゆびを おく',
          mode: 'key', skill: 'home-fj', grade: 1,
          items: keyItems(['ffff', 'jjjj', 'fjfj', 'jfjf', 'ffjj', 'jjff', 'fjjf', 'jffj']) },
        { id: 'hp-2', title: 'ホームポジション ②', note: 'd k s l を ふやす',
          mode: 'key', skill: 'home-dksl', grade: 1,
          items: keyItems(['dddd', 'kkkk', 'dkdk', 'ssss', 'llll', 'slsl', 'dksl', 'lsdk', 'fdjk']) },
        { id: 'hp-3', title: 'ホームポジション ③', note: 'a と ; まで ぜんぶ',
          mode: 'key', skill: 'home-all', grade: 2,
          items: keyItems(['aaaa', ';;;;', 'asdf', 'jkl;', 'fdsa', ';lkj', 'asdfjkl;', 'aslk', 'dfjk']) },
        { id: 'hp-4', title: 'うえの だん', note: 'q w e r t y u i o p',
          mode: 'key', skill: 'top-row', grade: 2,
          items: keyItems(['qwer', 'tyui', 'op', 'quit', 'type', 'were', 'your', 'poet', 'quiet']) },
        { id: 'hp-5', title: 'したの だん', note: 'z x c v b n m',
          mode: 'key', skill: 'bottom-row', grade: 3,
          items: keyItems(['zxcv', 'bnm', 'zxzx', 'cvcv', 'bnbn', 'move', 'zone', 'comb']) },
        { id: 'hp-6', title: 'すうじの だん', note: '1 から 0 まで',
          mode: 'key', skill: 'number-row', grade: 3,
          items: keyItems(['1234', '5678', '90', '1470', '2580', '3690', '1234567890']) },
        { id: 'hp-7', title: 'ぜんぶ ミックス', note: 'どの だんも まぜて',
          mode: 'key', skill: 'mixed-keys', grade: 3,
          items: keyItems(['fjdksla;', 'qazwsx', 'edcrfv', 'tgbyhn', 'ujmik', 'ol.p;/', 'a1s2d3', 'z9x8c7']) },
        { id: 'hp-8', title: 'きごうの キー', note: 'シフトを つかう キー',
          mode: 'key', skill: 'symbol-shift', grade: 4,
          items: keyItems(['!!', '??', '()', '!?', '""', '$%', '&*', '()!?', '?!?!']) }
      ] },

    // -----------------------------------------------------------------
    { id: 'romaji', title: 'ローマ字を おぼえる', short: 'ローマ字',
      note: 'あ行から じゅんばんに、かなを ローマ字で 打ちます',
      note2: 'し は si でも shi でも、じゃ は ja でも zya でも 正かいです。ならった うちかたで だいじょうぶ。',
      color: 'teal', icon: 'letter',
      stages: [
        { id: 'rm-a', title: 'あ行', note: 'a i u e o',
          mode: 'romaji', skill: 'row-a', grade: 3,
          items: [w('あ'), w('い'), w('う'), w('え'), w('お'), w('あお'), w('いえ'), w('うえ'), w('あい')] },
        { id: 'rm-ka', title: 'か行・が行', note: 'k と g',
          mode: 'romaji', skill: 'row-ka', grade: 3,
          items: [w('か'), w('き'), w('く'), w('け'), w('こ'), w('かき'), w('きく'), w('こけ'), w('がっこう', '学校'), w('かぎ')] },
        { id: 'rm-sa', title: 'さ行・ざ行', note: 's と z（し は si / shi）',
          mode: 'romaji', skill: 'row-sa', grade: 3,
          items: [w('さ'), w('し'), w('す'), w('せ'), w('そ'), w('さしすせそ'), w('すし'), w('かぜ'), w('じかん', '時間')] },
        { id: 'rm-ta', title: 'た行・だ行', note: 't と d（ち は ti / chi）',
          mode: 'romaji', skill: 'row-ta', grade: 3,
          items: [w('た'), w('ち'), w('つ'), w('て'), w('と'), w('たちつてと'), w('つくえ', 'つくえ'), w('てつだい', '手つだい')] },
        { id: 'rm-na', title: 'な行・は行', note: 'n と h（ふ は hu / fu）',
          mode: 'romaji', skill: 'row-na-ha', grade: 3,
          items: [w('な'), w('に'), w('ぬ'), w('ね'), w('の'), w('は'), w('ひ'), w('ふ'), w('へ'), w('ほ'), w('はなび', '花火'), w('ふね', '船')] },
        { id: 'rm-ma', title: 'ま行・や行・ら行・わ行', note: 'm y r w',
          mode: 'romaji', skill: 'row-ma-wa', grade: 3,
          items: [w('ま'), w('み'), w('む'), w('め'), w('も'), w('や'), w('ゆ'), w('よ'), w('ら'), w('り'), w('る'), w('れ'), w('ろ'), w('わ'), w('を'), w('やま', '山'), w('みらい', '未来')] },
        { id: 'rm-dakuten', title: 'てんてん・まる', note: 'ば行・ぱ行',
          mode: 'romaji', skill: 'dakuten', grade: 3,
          items: [w('ば'), w('び'), w('ぶ'), w('べ'), w('ぼ'), w('ぱ'), w('ぴ'), w('ぷ'), w('ぺ'), w('ぽ'), w('でんぱ', '電ぱ'), w('たんぽぽ')] },
        { id: 'rm-n', title: 'ん の うちかた', note: 'nn と 打つのが かくじつ',
          mode: 'romaji', skill: 'hatsuon-n', grade: 4,
          items: [w('ほん', '本'), w('えんぴつ'), w('かんじ', '漢字'), w('しんぶん', '新聞'), w('でんわ', '電話'), w('あんない', 'あん内'), w('ぐんて')] },
        { id: 'rm-sokuon', title: 'ちいさい つ', note: 'つぎの 字を 2かい 打つ',
          mode: 'romaji', skill: 'sokuon', grade: 4,
          items: [w('きって', '切手'), w('がっこう', '学校'), w('ざっし'), w('らっぱ'), w('しゅっぱつ', '出ぱつ'), w('まっすぐ'), w('いっしょ')] },
        { id: 'rm-youon', title: 'ちいさい や ゆ よ', note: 'きゃ しゅ ちょ など',
          mode: 'romaji', skill: 'youon', grade: 4,
          items: [w('きゃく', 'お客'), w('しゅくだい', 'しゅく題'), w('ちょきん', 'ちょ金'), w('びょういん', '病院'), w('りょうり', '料理'), w('じゅぎょう', '授業'), w('きょうしつ', '教室')] },
        { id: 'rm-mix', title: 'ローマ字 ミックス', note: 'ぜんぶ まぜて',
          mode: 'romaji', skill: 'romaji-mixed', grade: 4,
          items: [w('とうきょう', '東京'), w('しゃしん', '写真'), w('がっきゅう', '学級'), w('ちいきの', '地いきの'), w('こんしゅう', '今週'), w('はっぴょう', '発表'), w('しゅうかん', '習かん')] }
      ] },

    // -----------------------------------------------------------------
    { id: 'words', title: 'ことばを 打つ', short: 'ことば',
      note: 'みじかい ことばを、リズムよく',
      note2: '見ないで 打てるように なってきたら、スピードを 上げてみましょう。',
      color: 'green', icon: 'word',
      stages: [
        { id: 'wd-1', title: 'みのまわりの ことば', note: 'みじかい ことば',
          mode: 'word', skill: 'word-daily', grade: 2,
          items: [w('あさ', '朝'), w('いぬ', '犬'), w('うみ', '海'), w('えき', '駅'), w('おかし'), w('かさ'), w('くつ'), w('そら', '空'), w('つくえ'), w('とけい', '時計'), w('ねこ', 'ねこ'), w('はな', '花'), w('ほし', '星'), w('みかん'), w('やま', '山'), w('ゆき', '雪'), w('りんご'), w('わたし', '私')] },
        { id: 'wd-2', title: 'がっこうの ことば', note: 'きょうかや ばしょ',
          mode: 'word', skill: 'word-school', grade: 3,
          items: [w('こくご', '国語'), w('さんすう', '算数'), w('りか', '理科'), w('しゃかい', '社会'), w('たいいく', '体育'), w('おんがく', '音楽'), w('ずこう', '図工'), w('きゅうしょく', '給食'), w('としょかん', '図書館'), w('ほけんしつ', '保健室'), w('うんどうかい', '運動会'), w('きょうかしょ', '教科書')] },
        { id: 'wd-3', title: 'まなびの ことば', note: 'じゅぎょうで つかう ことば',
          mode: 'word', skill: 'word-learning', grade: 4,
          items: [w('かんさつ', '観察'), w('じっけん', '実験'), w('けんきゅう', '研究'), w('しりょう', '資料'), w('はっぴょう', '発表'), w('きろく', '記録'), w('もくひょう', '目標'), w('ふりかえり', 'ふり返り'), w('かだい', '課題'), w('かいけつ', '解決'), w('きょうりょく', '協力'), w('せつめい', '説明')] },
        { id: 'wd-4', title: 'コンピュータの ことば', note: '長めの ことばに ちょうせん',
          mode: 'word', skill: 'word-ict', grade: 5,
          items: [w('じょうほう', '情報'), w('けんさく', '検索'), w('ほぞん', '保存'), w('がめん', '画面'), w('にゅうりょく', '入力'), w('へんかん', '変換'), w('ふぁいる', 'ファイル'), w('ふぉるだ', 'フォルダ'), w('ぷろぐらみんぐ', 'プログラミング'), w('いんたーねっと', 'インターネット'), w('きーぼーど', 'キーボード'), w('たいぴんぐ', 'タイピング')] },
        { id: 'wd-5', title: 'ローマ字で 書く なまえ', note: '地名を ローマ字で',
          mode: 'word', skill: 'word-place', grade: 4,
          items: [w('にほん', '日本'), w('とうきょう', '東京'), w('きょうと', '京都'), w('おおさか', '大阪'), w('ほっかいどう', '北海道'), w('おきなわ', '沖縄'), w('ふじさん', '富士山'), w('しんかんせん', '新幹線')] }
      ] },

    // -----------------------------------------------------------------
    { id: 'sentences', title: '文を 打つ', short: '文',
      note: 'くとうてんも いっしょに',
      note2: '、は「,」、。は「.」で 打てます。あわてずに、まちがえないことを たいせつに。',
      color: 'violet', icon: 'text',
      stages: [
        { id: 'st-1', title: 'あいさつ', note: 'みじかい 文',
          mode: 'sentence', skill: 'sentence-greeting', grade: 3,
          items: [w('おはようございます。'), w('ありがとうございます。'), w('いってきます。'), w('よろしくおねがいします。'), w('しつれいします。')] },
        { id: 'st-2', title: 'きょうの できごと', note: 'にっきの ような 文',
          mode: 'sentence', skill: 'sentence-diary', grade: 4,
          items: [
            w('きょうは、あさから あめが ふって いました。'),
            w('きゅうしょくの カレーが とても おいしかったです。'),
            w('となりの せきの ひとと、いっしょに かんがえました。', 'となりの せきの 人と、いっしょに かんがえました。'),
            w('あしたは、はやく おきて じゅんびを します。')
          ] },
        { id: 'st-3', title: 'まなびの ふり返り', note: 'じゅぎょうの あとに 書く 文',
          mode: 'sentence', skill: 'sentence-reflect', grade: 5,
          items: [
            w('きょうの じゅぎょうで、わかった ことを かきます。', 'きょうの じゅぎょうで、わかった ことを 書きます。'),
            w('つぎは、じぶんで しらべて はっぴょうしたいです。'),
            w('ともだちの いけんを きいて、かんがえが かわりました。'),
            w('もくひょうに むかって、すこしずつ すすめて います。')
          ] },
        { id: 'st-4', title: 'ながい 文', note: 'さいごまで あきらめないで',
          mode: 'sentence', skill: 'sentence-long', grade: 6,
          items: [
            w('タイピングは、まいにち すこしずつ れんしゅうすると、かならず じょうずに なります。'),
            w('キーボードを みないで うてるように なると、かんがえながら かくことが できます。',
              'キーボードを 見ないで 打てるように なると、かんがえながら 書くことが できます。'),
            w('ローマじの きまりが わかると、しらない ことばでも うてるように なります。',
              'ローマ字の きまりが わかると、しらない ことばでも 打てるように なります。')
          ] }
      ] },

    // -----------------------------------------------------------------
    { id: 'shortcut', title: 'ショートカットを つかう', short: 'ショートカット',
      note: 'コピー・はりつけ・もとにもどす',
      note2: 'キーを くみあわせると、マウスを つかうより ずっと はやく できます。じっさいに 手を うごかして おぼえましょう。',
      color: 'amber', icon: 'bolt',
      stages: [
        { id: 'sc-1', title: 'コピーと はりつけ', note: 'Ctrl+A / C / V',
          mode: 'shortcut', skill: 'shortcut-copy', grade: 3, tasks: 'copy' },
        { id: 'sc-2', title: '切りとりと もとにもどす', note: 'Ctrl+X / Z / Y',
          mode: 'shortcut', skill: 'shortcut-undo', grade: 4, tasks: 'undo' },
        { id: 'sc-3', title: 'えらぶ・うごかす', note: 'Shift や Ctrl と やじるし',
          mode: 'shortcut', skill: 'shortcut-select', grade: 5, tasks: 'select' },
        { id: 'sc-4', title: 'べんりな キー', note: 'ほぞん・さがす・まとめてけす',
          mode: 'shortcut', skill: 'shortcut-tool', grade: 5, tasks: 'tool' }
      ] }
  ];

  /**
   * ショートカットの課題。
   *
   * 「キーを おぼえる」だけで おわらせず、**じっさいに エディタで やってみて、
   * けっかが 正しいか** で 正かいを 決めます（type: 'do'）。
   * ブラウザの きのうを よびだして しまう キー（ほぞん・さがす など）は、
   * ページの ほうで 止めて キーの くみあわせだけを みます（type: 'press'）。
   */
  const SHORTCUT_TASKS = {
    copy: [
      { id: 'sc-all', name: 'ぜんぶ えらぶ', combo: { ctrl: true, code: 'KeyA' }, type: 'do',
        instruct: '「もとの文」の 中を クリックしてから、ぜんぶ えらぼう。',
        hint: 'Ctrl を おしながら A', check: 'selectAll' },
      { id: 'sc-copy', name: 'コピー', combo: { ctrl: true, code: 'KeyC' }, type: 'do',
        instruct: 'えらんだ 文を コピーしよう。', hint: 'Ctrl を おしながら C', check: 'copied' },
      { id: 'sc-paste', name: 'はりつけ', combo: { ctrl: true, code: 'KeyV' }, type: 'do',
        instruct: '「じぶんの文」の 中を クリックして、はりつけよう。',
        hint: 'Ctrl を おしながら V', check: 'pasted' },
      { id: 'sc-paste2', name: 'もう1かい はりつけ', combo: { ctrl: true, code: 'KeyV' }, type: 'do',
        instruct: 'コピーは なんども つかえます。つづけて もう1かい はりつけよう。',
        hint: 'Ctrl を おしながら V', check: 'pastedTwice' }
    ],
    undo: [
      { id: 'sc-cut', name: '切りとり', combo: { ctrl: true, code: 'KeyX' }, type: 'do',
        instruct: '「もとの文」を ぜんぶ えらんで、切りとろう（きえます）。',
        hint: 'Ctrl+A で えらんでから Ctrl+X', check: 'cut' },
      { id: 'sc-undo', name: 'もとに もどす', combo: { ctrl: true, code: 'KeyZ' }, type: 'do',
        instruct: 'まちがえても だいじょうぶ。いまの そうさを もとに もどそう。',
        hint: 'Ctrl を おしながら Z', check: 'undone' },
      { id: 'sc-redo', name: 'やりなおす', combo: { ctrl: true, shift: true, code: 'KeyZ' }, type: 'press',
        alt: [{ ctrl: true, code: 'KeyY' }],
        instruct: 'もどしすぎたら「やりなおす」。キーを おしてみよう。',
        hint: 'Ctrl+Shift+Z（Ctrl+Y でも できます）' }
    ],
    select: [
      { id: 'sc-shift-right', name: '1文字ずつ えらぶ', combo: { shift: true, code: 'ArrowRight' }, type: 'press',
        instruct: '「もとの文」の さいしょを クリックして、右へ 1文字ずつ えらぼう。',
        hint: 'Shift を おしながら →' },
      { id: 'sc-ctrl-right', name: 'ことばごと うごく', combo: { ctrl: true, code: 'ArrowRight' }, type: 'press',
        instruct: 'ことばの かたまりごと、いっきに うごこう。', hint: 'Ctrl を おしながら →' },
      { id: 'sc-ctrl-shift-right', name: 'ことばごと えらぶ', combo: { ctrl: true, shift: true, code: 'ArrowRight' }, type: 'press',
        instruct: 'Ctrl と Shift を いっしょに つかうと、ことばごと えらべます。',
        hint: 'Ctrl+Shift を おしながら →' },
      { id: 'sc-home', name: '行の はじめへ', combo: { code: 'Home' }, type: 'press',
        alt: [{ meta: true, code: 'ArrowLeft' }],
        instruct: '行の いちばん はじめに もどろう。',
        hint: 'Chromebook は けんさくキー を おしながら ←' },
      { id: 'sc-end', name: '行の おわりへ', combo: { code: 'End' }, type: 'press',
        alt: [{ meta: true, code: 'ArrowRight' }],
        instruct: '行の いちばん おわりへ いこう。',
        hint: 'Chromebook は けんさくキー を おしながら →' }
    ],
    tool: [
      { id: 'sc-save', name: 'ほぞん', combo: { ctrl: true, code: 'KeyS' }, type: 'press',
        instruct: 'つくった ものを ほぞんする キーです。', hint: 'Ctrl を おしながら S' },
      { id: 'sc-find', name: 'さがす', combo: { ctrl: true, code: 'KeyF' }, type: 'press',
        instruct: 'ページの 中の ことばを さがす キーです。', hint: 'Ctrl を おしながら F' },
      { id: 'sc-del-word', name: 'ことばを まとめて けす', combo: { ctrl: true, code: 'Backspace' }, type: 'do',
        instruct: '「じぶんの文」の おわりから、ことばを まとめて けそう。',
        hint: 'Ctrl を おしながら けすキー', check: 'deletedWord' },
      { id: 'sc-plain-paste', name: 'かざりなしで はりつけ', combo: { ctrl: true, shift: true, code: 'KeyV' }, type: 'press',
        instruct: '文字の 大きさや 色を つけずに はりつける キーです。',
        hint: 'Ctrl+Shift を おしながら V' }
    ]
  };

  /** ショートカット練習で つかう 文（じっさいに コピーする もとの文） */
  const SHORTCUT_SOURCE = 'きょうの じゅぎょうで、あたらしい ことを おぼえました。';

  // ===================================================================
  // とくべつ れんしゅう（コース一覧には ならばない、その場で 作る ステージ）
  // ===================================================================
  //
  // ふつうの ステージは 中身が 決まって いますが、この2つは
  // **そのときの じょうたいから 組み立てます**。
  //   チャレンジ … 時間ないに どれだけ 打てるか。お題は つきません
  //   にがて とっくん … これまでの ミスから、その子だけの お題を つくります
  // どちらも コースの じゅんばんとは べつなので、★は つけません。

  const CHALLENGE_COURSE = {
    id: 'challenge', title: 'チャレンジ', short: 'チャレンジ',
    note: '時間ないに どれだけ 打てるか', color: 'amber', icon: 'trophy'
  };

  const WEAK_COURSE = {
    id: 'weak', title: 'にがて とっくん', short: 'にがて',
    note: 'まちがえやすい キーだけ あつめて', color: 'blue', icon: 'finger'
  };

  /** チャレンジの 時間（びょう）と お題の しゅるい */
  const CHALLENGE_SECONDS = [30, 60, 120];
  const CHALLENGE_POOLS = [
    { id: 'word', title: 'ことば', note: 'みじかい ことばが つぎつぎ 出ます', icon: 'word' },
    { id: 'sentence', title: '文', note: 'くとうてんの ある 文で', icon: 'text' },
    { id: 'key', title: 'アルファベット', note: 'ローマ字を つかわず キーだけ', icon: 'keyboard' }
  ];

  /** コース id から すべての お題を あつめます */
  function itemsOfCourse(courseId) {
    const course = findCourse(courseId);
    if (!course) return [];
    return course.stages.reduce((all, s) => all.concat(s.items || []), []);
  }

  function challengeItems(poolId) {
    if (poolId === 'sentence') return itemsOfCourse('sentences');
    if (poolId === 'key') return itemsOfCourse('home-position');
    // ことばは「ことば」コースに、ローマ字コースの ことばも 足して 数を ふやします
    return itemsOfCourse('words').concat(itemsOfCourse('romaji').filter(i => i.k.length >= 2));
  }

  /**
   * チャレンジの ステージを 組み立てます。
   * items が つきても おわらず、じゅんばんを かえて くりかえします（endless）。
   */
  function buildChallengeStage(poolId, seconds) {
    const pool = CHALLENGE_POOLS.filter(p => p.id === poolId)[0] || CHALLENGE_POOLS[0];
    const sec = CHALLENGE_SECONDS.indexOf(seconds) >= 0 ? seconds : 60;
    const items = challengeItems(pool.id);
    if (items.length === 0) return null;
    return {
      course: CHALLENGE_COURSE,
      stage: {
        id: `ch-${pool.id}-${sec}`,
        title: `${sec}びょう ／ ${pool.title}`,
        note: pool.note,
        mode: 'challenge',
        skill: `challenge-${pool.id}`,
        items,
        endless: true,
        limitMs: sec * 1000,
        noStars: true,
        pool: pool.id,
        seconds: sec
      }
    };
  }

  /** ホームポジションの キー。にがてな キーの あいだに はさんで リズムを 作ります */
  const ANCHORS = ['f', 'j', 'd', 'k', 's', 'l', 'a', ';'];

  /** にがて とっくんで つかえる キー（JIS と US の どちらにも あり、指も 決まって いる） */
  const SAFE_KEY = /^[a-z0-9;,./-]$/;

  /** 1回の とっくんに 入れる お題の 数の かぎり（90びょうくらいで おわる 長さ） */
  const WEAK_MAX_ITEMS = 16;

  /**
   * これまでの きろくから、その子だけの お題を つくります。
   *
   * ■ 単キーの くりかえし（ffff）だけでは 弱い
   * じっさいの つまずきは **キーの つなぎ目** と **にた キーの とりちがえ** で
   * 起きます。同じ キーを 4回 打つ 練習は、その どちらにも あたりません。
   * そこで つぎの じゅんに 組み立てます。
   *
   *   1. とりちがえた くみあわせ（dfdf fdfd）… いちばん 手がかりが 強い
   *   2. まちがえる キー（tttt と、ホームポジションに もどる ttaa）
   *   3. まちがえないが 手が とまる キー … くりかえしでは なく つなぎ目だけ
   *   4. さいごに ぜんぶ まぜた もの
   *
   * @param {string[]|{keys, slow, pairs}} weak にがての ねらい。
   *   配列を わたすと これまでどおり「まちがえる キー」として あつかいます
   * @returns {{course: Object, stage: Object}|null} データが 足りなければ null
   */
  function buildWeakStage(weak) {
    const w = Array.isArray(weak) ? { keys: weak } : (weak || {});
    const keys = (w.keys || []).filter(k => SAFE_KEY.test(k)).slice(0, 4);
    const slow = (w.slow || []).filter(k => SAFE_KEY.test(k) && keys.indexOf(k) < 0).slice(0, 2);
    const pairs = (w.pairs || [])
      .filter(p => p && SAFE_KEY.test(p.from) && SAFE_KEY.test(p.to) && p.from !== p.to)
      .slice(0, 3);

    if (keys.length + slow.length < 2 && pairs.length === 0) return null;

    const items = [];
    const add = t => { if (items.length < WEAK_MAX_ITEMS) items.push(t); };

    // 1. とりちがえ … 交ごに 打つと「区べつ」が つきます
    pairs.forEach(p => {
      add(p.from + p.to + p.from + p.to);
      add(p.to + p.from + p.to + p.from);
    });

    // 2. まちがえる キー
    keys.forEach((t, i) => {
      const anchor = ANCHORS[i % ANCHORS.length];
      add(t + t + t + t);                        // まず その キーだけを くりかえす
      add(t + anchor + t + anchor);              // ホームポジションに もどる れんしゅう
    });

    // 3. まちがえないが おそい キー … くりかえしても 意味が ないので つなぎ目だけ
    slow.forEach((t, i) => {
      const anchor = ANCHORS[(keys.length + i) % ANCHORS.length];
      add(t + anchor + t + anchor);
    });

    // 4. さいごに ぜんぶ まぜた お題を 2つ
    const all = keys.concat(slow, pairs.map(p => p.from), pairs.map(p => p.to))
      .filter((v, i, a) => a.indexOf(v) === i);
    if (all.length >= 2) {
      add(all.join(''));
      add(all.slice().reverse().join('') + all[0]);
    }

    return {
      course: WEAK_COURSE,
      stage: {
        id: 'weak-drill',
        title: 'にがて とっくん',
        note: weakNote(keys, slow, pairs),
        mode: 'key',
        skill: 'weak-drill',
        items: items.map(t => ({ k: t, d: '', raw: true })),
        noStars: true,
        targets: all,
        pairs
      }
    };
  }

  /** 何を あつめたかを ことばで つたえます（キーの ならびだけでは 分かりません） */
  function weakNote(keys, slow, pairs) {
    const parts = [];
    if (pairs.length) {
      parts.push(pairs.map(p => `${p.from.toUpperCase()} と ${p.to.toUpperCase()}`).join('、') + ' の とりちがえ');
    }
    if (keys.length) parts.push(keys.map(k => k.toUpperCase()).join(' '));
    if (slow.length) parts.push(slow.map(k => k.toUpperCase()).join(' ') + '（手が とまる キー）');
    return parts.length ? parts.join('、') + ' を あつめました' : 'にがてな キーを あつめました';
  }

  /** コースIDから コースを ひきます */
  function findCourse(id) { return COURSES.filter(c => c.id === id)[0] || null; }

  /** ステージIDだけから ひきます（ふくしゅうは コースを またぐため） */
  function findStageById(stageId) {
    for (const course of COURSES) {
      for (const stage of course.stages) {
        if (stage.id === stageId) return { course, stage };
      }
    }
    return null;
  }

  /** ステージIDから コースと ステージを ひきます */
  function findStage(courseId, stageId) {
    const course = findCourse(courseId);
    if (!course) return null;
    const stage = course.stages.filter(s => s.id === stageId)[0];
    return stage ? { course, stage } : null;
  }

  /** ステージの お題の数（ショートカットは 課題の数） */
  function stageCount(stage) {
    return stage.mode === 'shortcut' ? (SHORTCUT_TASKS[stage.tasks] || []).length : stage.items.length;
  }

  /** ぜんぶの ステージの 数（きろく画面の「すすみぐあい」に つかいます） */
  function totalStages() {
    return COURSES.reduce((sum, c) => sum + c.stages.length, 0);
  }

  /**
   * ★3つを とった ステージの **つぎに やると よい ステージ**。
   *
   * ■ 何を さがすか
   * すぐ うしろから じゅんに 見て、**まだ ★3で ない**ステージを 1つ 返します。
   * コースの さいごまで いったら、こんどは 先頭から さがします。
   * ぜんぶ ★3なら null（そこで「そのさき」＝ だんの 時期に 入ります）。
   *
   * ■ もう ★3の ステージは とばします
   * 「つぎの ステージ」を そのまま 返すと、すでに ★3の ところへ
   * 送りこむ ことに なります。それでは「できた から すすんだ」に なりません。
   *
   * ■ ショートカットは 入れません
   * 打鍵の れんしゅうの とちゅうに、コピー・はりつけの 課題が
   * 出て くるのは べつの しごとです。あちらは 一覧から えらんで もらいます。
   *
   * localStorage には さわりません（node から そのまま ためせます）。
   *
   * @param {string} stageId いま ★3に した ステージ
   * @param {Function} done (stageId) => その ステージは もう ★3か
   * @returns {{course: Object, stage: Object}|null}
   */
  function nextStageAfter(stageId, done) {
    const list = [];
    COURSES.forEach(c => c.stages.forEach(s => list.push({ course: c, stage: s })));
    const at = list.findIndex(x => x.stage.id === stageId);
    const pick = x => x.stage.mode !== 'shortcut' && !x.stage.noStars && !done(x.stage.id);
    for (let i = at + 1; i < list.length; i++) if (pick(list[i])) return list[i];
    for (let i = 0; i < Math.max(0, at); i++) if (pick(list[i])) return list[i];
    return null;
  }

  global.Typa = global.Typa || {};
  global.Typa.Lessons = {
    COURSES, SHORTCUT_TASKS, SHORTCUT_SOURCE,
    CHALLENGE_COURSE, WEAK_COURSE, CHALLENGE_SECONDS, CHALLENGE_POOLS,
    buildChallengeStage, buildWeakStage,
    findCourse, findStage, findStageById, stageCount, totalStages, nextStageAfter
  };
})(window);
