/**
 * =====================================================================
 * play.js — れんしゅうの 画面（打つ ところ）
 * =====================================================================
 * お題を 1つずつ 出し、1打ごとに 正誤を 判定します。
 *
 * ■ 「はじまり」も「おわり」も 決めない
 * ステージは とちゅうで 止まりません。お題を ひとまわり すると、
 * みじかく ほめて そのまま つぎの しゅうに 入ります。**やめる のは
 * いつでも、子どもが 決めます**。「さいごまで やらないと 何も のこらない」
 * という 決まりを なくす ためです。
 *
 * 10びょうで やめても、打った ぶんは かならず のこります。
 *   ・打った お題の 数 → ステージの「ひとまわり」の すすみに たまる
 *   ・打鍵・ミス・かかった 時間 → きろく と にがての 集計に 入る
 *   ・けいけんち → その 回の ぶんだけ もらえる
 * つぎに ひらいた ときは、**とちゅうの お題から** はじまります。
 *
 * だから この ファイルには「クリア」という 考えかたが ありません。
 * finish() は「いま までの ぶんを まとめて 返す」だけ です。
 *
 * ■ ★3つの ときだけ、その ばで 知らせます
 * ★は ずっと けっか画面（＝「やめる」を おした あと）でしか 見えませんでした。
 * すると **いちばん うまく 打てた しゅんかんに 何も おきません**。
 * ノーミスで ひとまわり できても、画面は 何ごとも なかった ように つぎの
 * しゅうに 入り、子どもは やめるまで それを 知りません。
 * そこで ひとまわりの ★が 3つの ときだけ、おいわいの しるしを
 * 金色に かえて「★3つ！」と 出します。
 *
 * **それでも 練習は 止めません。** 出すのは 2びょうほどの みじかい しるし
 * だけで、つぎの ステージに すすむ かどうかは これまで どおり
 * けっか画面で 子どもが 決めます。ここで 手を 止めさせて しまうと、
 * 上の「はじまりも おわりも 決めない」が こわれます。
 *
 * ■ 打ちまちがえても 先へは すすみません
 * まちがえた ままで すすむと、まちがった 指づかいの まま 速くなります。
 * 正しい キーを 押すまで まつ かわりに、「どの指で 押すか」を
 * 画面と ことばの 両方で しめして、すぐに やりなおせるように しています。
 * それでも つまずいた ときのために、同じ お題で 4回 まちがえると
 * 「とばす」ボタンが 出ます。1つの キーで 手が 止まりつづけない ためです。
 *
 * ■ 時計は「さいしょの 1打」から うごきます
 * 画面が 出た しゅんかんから 数えると、まだ 手を おいて いない 時間まで
 * 記録に 入って しまいます。ストップウォッチは 最初の 1打で スタートします。
 *
 * ■ 時間の 数えかた
 * elapsedMs は はじめから おわりまで。activeMs は「手が 止まっていた
 * 5秒より 長い あいだ」を のぞいた 時間です。速さ（打/秒）は activeMs で
 * 計算するので、とちゅうで 先生の 話を 聞いて いた 回でも 記録が 下がりません。
 * ただし **チャレンジ（時間ぎめ）だけは のぞきません**。じっさいの
 * 60びょうで どれだけ 打てたかを、そのまま スコアに するためです。
 *
 * ■ まちがえた お題は ひとまわりの さいごに もう1回（おまけの 周）
 * まちがえた 直後に もう一度 打つと よく 身に つきます。そこで
 * ひとまわり する たびに、その しゅうで つまずいた お題を もう1回だけ 出します。
 *
 * この おまけの 周の 打鍵は **はやさ・正かくさ・★・けいけんちには
 * 数えません**。数えて しまうと、2回目に 打ち直した 子ほど 正かくさが
 * 上がり、★が「さいしょに どれだけ 正しく 打てたか」を あらわさなく
 * なるためです。いっぽうで「どの キーで つまずいたか」の きろくには
 * ちゃんと 数えます。れんしゅうとしては 本物だからです。
 */
(function (global) {
  'use strict';

  const T = global.Typa;
  const IDLE_MS = 5000;        // これ以上 手が 止まったら「学習していない 時間」とみなします
  const SKIP_AFTER = 4;        // 同じ お題で これだけ まちがえたら「とばす」を 出します
  const COMBO_STEP = 10;       // れんぞくが これの ばいすうに なると ほめます
  const RETRY_MAX = 5;         // さいごに もう1回 出す お題の 数の かぎり
  const LAP_FLASH_MS = 1600;   // ひとまわりの おしらせを 出して おく 時間
  // ★3つの ときは すこし 長く 出します。読む ことばが 1つ ふえる ぶんです。
  // これ以上 のばすと、つぎの お題を 打って いる あいだ ずっと 出た ままに なります
  const FULL_FLASH_MS = 2400;

  /**
   * これだけ 画面を はなれて いたら、きろくを そこで 1つ 区切ります。
   *
   * 5分より みじかく すると、**先生の 話を 聞くための 数分の 離席**まで
   * 区切りに なって しまいます。長く すると、朝 ひらいて 昼に もどって きた
   * 回が ひとつづきの れんしゅうとして 数えられます。
   * 学習ログの きまり（§5.4）に そろえて 5分に します。
   */
  const AWAY_SPLIT_MS = 300000;

  const state = {
    course: null, stage: null, source: 'course', special: '',
    pool: [], queue: [], current: null, index: 0,
    endless: false, limitMs: 0,
    // ひとまわり … lapNeed もん 打つと 1しゅう。lapPos は 前の れんしゅうから
    // つづいて いる ぶんも 入って います（0 から はじまるとは かぎりません）
    lapNeed: 1, lapPos: 0, lapStart: 0, doneItems: 0, laps: 0,
    // れんしゅう中に 見せた ★の いちばん 大きい もの。けっか画面と
    // ステージ一覧が それより 下に ならない ように、finish() で わたします
    lapStarsSeen: 0,
    // この ステージは もう ★3つを とって いるか（おしらせの ことばを かえます）
    hadFullStars: false,
    lapFlashTimer: 0,
    // そのさきの「だん」を ねらって いる ときの はやさの めやす（0 = 出さない）
    goalKps: 0,
    matcher: null,
    startedAt: null, clockStartedAt: null, startTime: 0, lastKeyTime: 0,
    idleMs: 0, pausedAt: 0, pausedMs: 0, leftAt: 0,
    itemStart: 0, itemMistakes: 0, itemWrong: [], itemFirstTry: true,
    results: [],
    correctKeys: 0, missKeys: 0, combo: 0, bestCombo: 0,
    missByKey: {}, missByFinger: {},
    // おまけの 周（打ち直し）の ミスは べつに 数えます。学習ログでは 本編と
    // 分けて のこすためです（にがての 集計には ぜんぶ つかいます）
    retryMissByKey: {}, retryMissByFinger: {},
    phase: 'main', retryPool: [], retryTotal: 0, retryUse: true, retryNotice: false,
    // おまけの 周に つかった 時間は はやさの 計算から のぞきます
    retryMs: 0, retryEnter: 0, retryIdleMs: 0, idleEnter: 0,
    lat: {}, conf: {}, rule: {}, keystrokes: [],
    itemKeyCount: 0, lastOk: true, skipLatency: false,
    running: false, imeWarned: false,
    settings: null, view: null, showKeyboard: true, showHands: false, showBuddy: false,
    timerId: 0, onFinish: null, onStop: null, onPick: null, onAway: null
  };

  const $ = id => document.getElementById(id);

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ------------------------------------------------------------------
  // 画面
  // ------------------------------------------------------------------

  function screenHtml(course, stage) {
    const limited = !!stage.limitMs;
    return `
      <div class="play" id="play-root">
        <div class="play-head">
          <!-- ステージ名は そのまま 階層への 入口です。「これじゃ ない」と
               思った ときに、下のバーまで 目を うつさずに 変えられます -->
          ${stage.noStars
            ? `<div class="play-title">
                 <span class="chip chip-${course.color}">${esc(course.short)}</span>
                 <b>${esc(stage.title)}</b>
               </div>`
            : `<button class="play-title is-link" id="play-pick-btn" type="button">
                 <span class="chip chip-${course.color}">${esc(course.short)}</span>
                 <b>${esc(stage.title)}</b>
                 <span class="play-title-hint">かえる</span>
               </button>`}
          <div class="play-progress" role="group" aria-label="すすみぐあい">
            <div class="bar${limited ? ' bar-time' : ''}"><span id="play-bar"></span></div>
            <span class="num">${limited
              ? `のこり <b id="play-left">${Math.round(stage.limitMs / 1000)}</b> びょう`
              : '<span id="play-phase" hidden>もういちど </span>ひとまわりまで あと <b id="play-left-items">0</b>'}</span>
          </div>
        </div>

        <!-- ひろい 画面では お題と キャラクターを よこに ならべます。
             お題は いちばん 大きい ままで、たての ながさを へらせます -->
        <div class="play-main">
          <div class="play-col">
            <div class="play-stage" id="play-stage">
              <p class="q-label" id="q-label"></p>
              <p class="q-kana" id="q-kana"></p>
              <p class="q-romaji" id="q-romaji"></p>
              <!-- ひとまわり できた ときの おしらせ。打つのは 止めません -->
              <p class="lap-flash" id="play-lap-flash" hidden aria-hidden="true"></p>
            </div>

            <!-- 「つぎの 指」と きろくの 数字。たてが みじかい 画面では
                 この 2つを よこに ならべて、あいた ぶんを キーボードに
                 まわします（style.css の .play-status）-->
            <div class="play-status">
              <div class="play-finger" id="play-finger" aria-live="polite"></div>

              <div class="play-meter">
                <div class="meter" id="m-kps-box"><span class="meter-label">はやさ</span><b id="m-kps">0.0</b><span class="meter-unit">打/びょう</span><span class="meter-goal" id="m-kps-goal" hidden></span></div>
                <div class="meter"><span class="meter-label">正かくさ</span><b id="m-acc">100</b><span class="meter-unit">%</span></div>
                <div class="meter"><span class="meter-label">ミス</span><b id="m-miss">0</b><span class="meter-unit">かい</span></div>
                <div class="meter meter-combo" id="m-combo-box"><span class="meter-label">れんぞく</span><b id="m-combo">0</b><span class="meter-unit">だ</span></div>
              </div>
            </div>
          </div>

          <div class="play-side" id="play-side">
            <div id="play-buddy"></div>
          </div>
        </div>

        <div class="ime-warn" id="ime-warn" hidden>
          ${T.icon('info')} <span>かな入力に なって いるみたい。<b>かな英数キー</b>（1の 左）か
            <b>英数キー</b>（スペースの 左）を おしてから 打ってね。</span>
        </div>

        <p class="play-ready" id="play-ready">${T.icon('play')} さいしょの 1打で スタートします。10びょうでも きろくは のこります。</p>

        <!-- キーボードと 手の 絵は ひとくみ です。かならず **上下**に かさねます。
             よこに ならべると、キーの ばしょと 指を 見くらべる たびに 目が
             左右に いききして、どの 指が どの キーの 下に あるのかも
             分かりません。上下なら 指先が ホームポジションの キーの
             まっすぐ 下に 来るので、目は すこし 下を 見るだけ です。

             はばは この かたまり だけ 画面いっぱいに ひろげます（style.css）。
             ひとつの わく（kb-scroll）の 中に 入れて あるので、せまい 画面で
             よこに スクロールしても キーボードと 指が いっしょに うごきます -->
        <div class="play-lower">
          <div class="kb-scroll">
            <div class="kb-fit">
              <div class="kb-wrap"><div id="play-kb"></div></div>
              <div class="play-visual"><div id="play-hands"></div></div>
            </div>
          </div>
        </div>

        <div class="play-foot">
          <button class="btn btn-ghost" id="play-skip-btn" type="button" hidden>この お題を とばす</button>
          <button class="btn btn-outline btn-stop" id="play-stop-btn" type="button">
            ${T.icon('check')} やめる<span class="btn-note">ここまでの きろくは のこります</span>
          </button>
        </div>
      </div>`;
  }

  // ------------------------------------------------------------------
  // はじめる
  // ------------------------------------------------------------------

  /**
   * @param {Object} p { course, stage, source, mount, special, onStop, onPick }
   *   stage.endless … お題が つきても じゅんばんを かえて つづけます
   *   stage.limitMs … 時間ぎめ（チャレンジ）
   */
  function start(p) {
    const settings = T.Store.getSettings();
    stopTimer();

    state.course = p.course;
    state.stage = p.stage;
    state.source = p.source || 'course';
    state.special = p.special || '';
    state.settings = settings;
    state.endless = !!p.stage.endless;
    state.limitMs = p.stage.limitMs || 0;
    state.onStop = typeof p.onStop === 'function' ? p.onStop : null;
    state.onPick = typeof p.onPick === 'function' ? p.onPick : null;
    // 5分いじょう 画面を はなれて もどって きた ときの 行き先（app.js が 決めます）
    state.onAway = typeof p.onAway === 'function' ? p.onAway : null;
    state.pool = p.stage.items.slice();

    // ひとまわりの ながさと、前の れんしゅうの つづき。
    // ★の つかない ステージ（にがて とっくん・チャレンジ）は いつも 0 から です
    state.lapNeed = Math.max(1, state.pool.length);
    state.lapStart = (p.stage.noStars || state.limitMs)
      ? 0
      : T.Store.lapState(p.stage.id, state.lapNeed).items;
    state.lapPos = state.lapStart;
    state.doneItems = 0;
    state.laps = 0;
    state.lapStarsSeen = 0;
    // もう ★3つの ステージで「はじめての ★3つ！」と 言うと うそに なります
    state.hadFullStars = ((T.Store.getProgress()[p.stage.id] || {}).stars || 0) >= 3;
    if (state.lapFlashTimer) { clearTimeout(state.lapFlashTimer); state.lapFlashTimer = 0; }
    state.queue = firstQueue(state.pool, state.source, state.endless, state.lapPos);
    state.index = 0;
    state.results = [];
    state.correctKeys = 0;
    state.missKeys = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.missByKey = {};
    state.missByFinger = {};
    state.retryMissByKey = {};
    state.retryMissByFinger = {};
    state.lat = {};
    state.conf = {};
    state.rule = {};
    state.keystrokes = [];
    state.itemKeyCount = 0;
    state.lastOk = true;
    state.skipLatency = false;
    state.phase = 'main';
    state.retryPool = [];
    state.retryTotal = 0;
    state.retryMs = 0;
    state.retryEnter = 0;
    state.retryIdleMs = 0;
    state.idleEnter = 0;
    // 時間ぎめ（チャレンジ）と おわりの ない れんしゅうでは やりません。
    // 「60びょうで どれだけ 打てたか」に おまけの 周を 足せないためです
    state.retryUse = settings.retry !== false && !state.endless && !state.limitMs;
    state.idleMs = 0;
    state.pausedAt = 0;
    state.pausedMs = 0;
    state.imeWarned = false;
    state.startedAt = new Date();
    state.clockStartedAt = null;            // さいしょの 1打の 時こく（学習ログの startedAt）
    state.startTime = 0;                    // 0 = まだ 1打も 打って いない
    state.lastKeyTime = 0;
    state.leftAt = 0;
    state.running = true;
    // 学習ログの 時計（60秒 基準・8アプリ 共通）。画面に 出す 速さの 計算とは
    // べつ物です。ここを 5秒 基準に すると Typa だけ 学習時間が みじかく 出ます
    if (T.Study) T.Study.beginSession();
    // ヒントの つよさは ここで 1回だけ 決めます。あとは state.view だけを
    // 見るので、せっていの スイッチと 言うことが 食いちがう ことが ありません。
    // 1回の 中で 見え方が かわると 子どもが まようので、とちゅうでは かえません
    // 「ヒントを 1つ へらして やってみる」… **その回 だけ** の おためしで、
    // せっていは 書きかえません（README「自動では 下げません」）
    const viewSettings = typeof p.assistLevel === 'number'
      ? Object.assign({}, settings, { assist: p.assistLevel })
      : settings;
    state.view = T.Store.resolveAssist(viewSettings, {
      stageMastery: T.Mastery.stageMastery(T.Store.keySummary().byKey, p.stage),
      everThreeStars: ((T.Store.getProgress()[p.stage.id] || {}).stars || 0) >= 3,
      blind: !!p.blind || !!p.stage.blind
    });
    state.showKeyboard = state.view.keyboard;
    // 手の イラストは 指の 色分けと ひとくみ です。ヒントを「ばしょだけ」まで
    // 下げたら、手の 絵も いっしょに 消えます（消しかたを ばらばらに しません）
    state.showHands = settings.hands !== false && state.view.fingerGuide;
    state.showBuddy = settings.buddy !== false;

    p.mount.innerHTML = screenHtml(p.course, p.stage);
    if (!state.showKeyboard) $('play-kb').closest('.kb-wrap').hidden = true;
    else {
      T.Keyboard.render($('play-kb'), {
        layoutId: settings.layout,
        fingerGuide: state.view.fingerGuide,
        labels: state.view.keyLabels,
        onTap: tap => handleChar(tap.char, tap.code, 'tap')
      });
    }
    if (state.showHands) T.Hands.render($('play-hands'));
    else { const visual = document.querySelector('.play-visual'); if (visual) visual.hidden = true; }
    if (state.showBuddy) T.Buddy.render($('play-buddy'), { job: settings.buddyJob });
    else { const side = $('play-side'); if (side) side.hidden = true; }

    // そのさき（だん）を ねらって いる ときだけ、はやさの めやすを
    // メーターの 下に 出します。ふだんは 出しません — まだ ★を あつめて
    // いる 子に 速さの 目標を 見せると、正かくさより 速さを おいかけます
    state.goalKps = p.goalKps || 0;
    const goalEl = $('m-kps-goal');
    if (goalEl && state.goalKps > 0) {
      goalEl.textContent = `めやす ${state.goalKps.toFixed(1)}`;
      goalEl.hidden = false;
    }

    $('play-skip-btn').addEventListener('click', skipItem);
    $('play-stop-btn').addEventListener('click', () => { if (state.onStop) state.onStop(); });
    const pick = $('play-pick-btn');
    if (pick) pick.addEventListener('click', () => { if (state.onPick) state.onPick(); });
    loadItem();
    renderMeters();
    fitKeyboard();
    bindKeys();
    bindFit();
    bindLeaveGuard();
    bindVisibility();
    if (state.limitMs) startTimer();
  }

  // ------------------------------------------------------------------
  // キーボードの 大きさを 画面に あわせる
  // ------------------------------------------------------------------

  /**
   * キーボードと 手の 絵を、画面に のこって いる ぶんに あわせて
   * **いちばん 大きく** します。
   *
   * ■ なぜ CSS の 数字だけ では 足りないのか
   * 大きさを vw（画面の はば）で 決めると、よこに ひろく たてに みじかい
   * 学校の Chromebook で キーボードが 画面の 下に はみ出します。
   * vh（たかさ）で 決めても、お題の 文の ながさ・「文字を 大きくする」の
   * せってい・ちびキャラの あるなし で 上の ぶんの たかさが かわるので、
   * 決めうちの 数字では どこかで あいません。
   * 打ちながら スクロールは できない ので、ここだけは 実さいに はかります。
   *
   * ■ しくみ
   * キーの たかさは ぜんぶ「1文字ぶん（--kb-em）」の ばいすう なので、
   * 下の かたまりの たかさは em に **まっすぐ ひれい** します。
   * そこで 小さい ほうと 大きい ほうの 2つで はかって、
   * ちょうど 入る em を 出します（はかるのは 2回だけ）。
   *
   * ■ 大きさは とちゅうで かえません
   * お題が かわる たびに キーボードの 大きさが かわると、目が おどろいて
   * 打てなく なります。そこで **この ステージで いちばん 場所を とる お題**を
   * いったん 入れて はかり、そのあと もとに もどします。
   */
  const EM_MIN = 8;
  const EM_MAX = 22;

  function fitKeyboard() {
    const root = $('play-root');
    const lower = document.querySelector('.play-lower');
    if (!root || !lower) return;
    const scroll = lower.querySelector('.kb-scroll');
    if (!scroll || !lower.offsetHeight) return;      // 見えて いない ときは 何も しません

    let saved = null;
    try {
      saved = fillLongest();
      const setEm = em => root.style.setProperty('--kb-em', `${Math.round(em * 100) / 100}px`);
      // はばの 上限。キー1つが よこ長に なりすぎない ところで 止めます
      // （キーボードぜんたいの はば ＝ 88em。style.css の .kb-fit と 同じ 数）
      const emHi = Math.max(EM_MIN + 2, Math.min(EM_MAX, scroll.clientWidth / 88));

      setEm(EM_MIN);
      const low = lower.getBoundingClientRect().height;
      setEm(emHi);
      const high = lower.getBoundingClientRect().height;
      const slope = (high - low) / (emHi - EM_MIN);

      const rect = root.getBoundingClientRect();
      const nav = document.querySelector('.navbar');
      const navH = nav ? nav.getBoundingClientRect().height : 62;
      // 本文の 下の すきま（.view の padding-bottom）も 画面を つかいます
      const view = root.parentElement;
      const pad = view ? parseFloat(getComputedStyle(view).paddingBottom) || 0 : 0;
      // 下部バーの 上まで。すこし（4px）ゆとりを のこします
      const room = global.innerHeight - navH - (rect.top + global.scrollY) - pad - 4;
      const em = Math.max(EM_MIN, Math.min(emHi, slope > 0 ? emHi + (room - rect.height) / slope : emHi));
      setEm(em);
      stretchRows(root, lower, room);
    } finally {
      restoreQuestion(saved);
    }
  }

  /**
   * よこの はばを つかい切っても たかさに ゆとりが のこる とき
   * （大きな モニターなど）は、キーを **たてに** のばします。
   *
   * 本物の キーは ほぼ ましかく です。よこに ながい 長方形の キーボードは
   * 手もとと 見くらべた ときに 形が ちがって しまうので、
   * ましかくを こえては のばしません。
   */
  function stretchRows(root, lower, room) {
    root.style.removeProperty('--kb-row');
    const spare = room - root.getBoundingClientRect().height;
    if (spare < 6) return;
    const kb = lower.querySelector('.kb');
    const key = kb && kb.querySelector('.kb-key:not(.is-top)');
    if (!key) return;
    const now = key.getBoundingClientRect().height;               // いまの キーの たかさ
    const square = kb.getBoundingClientRect().width / 15 - 4;     // ましかくに なる たかさ
    // 6行ぶん（いちばん上の 行は 0.73ばい なので あわせて 5.73行ぶん）
    const row = Math.min(square, now + spare / 5.73);
    if (row > now + 1) root.style.setProperty('--kb-row', `${Math.round(row * 10) / 10}px`);
  }

  /** この ステージで いちばん 場所を とる お題を、いったん 画面に 入れます */
  function fillLongest() {
    const kana = $('q-kana'), label = $('q-label'), romaji = $('q-romaji');
    if (!kana || !label || !romaji) return null;
    let item = null, score = -1;
    state.pool.forEach(it => {
      const s = (it.k || '').length * 2 + (it.d || '').length;
      if (s > score) { score = s; item = it; }
    });
    if (!item) return null;

    // ローマ字の ヒントは 先に 作って おきます。入れかえた あとで しくじると
    // お題が もどらなく なる ので、しくじる かもしれない ことは 先に します
    let hint = '';
    if (!item.raw && state.view.romajiHint) {
      try { hint = T.Romaji.createMatcher(item.k).hint().rest; } catch (e) { hint = ''; }
    }

    const saved = {
      kana: kana.innerHTML, label: label.textContent, labelHidden: label.hidden,
      romaji: romaji.innerHTML, romajiHidden: romaji.hidden
    };
    kana.textContent = item.k;
    label.textContent = item.d || '';
    label.hidden = !item.d;
    if (hint) {
      romaji.hidden = false;
      romaji.textContent = hint;
    }
    return saved;
  }

  function restoreQuestion(saved) {
    if (!saved) return;
    $('q-kana').innerHTML = saved.kana;
    $('q-label').textContent = saved.label;
    $('q-label').hidden = saved.labelHidden;
    $('q-romaji').innerHTML = saved.romaji;
    $('q-romaji').hidden = saved.romajiHidden;
  }

  let fitHandler = null;

  /** 画面の 大きさが かわった とき（回転・ウィンドウ）だけ はかりなおします */
  function bindFit() {
    unbindFit();
    let waiting = false;
    fitHandler = () => {
      if (waiting) return;
      waiting = true;
      global.requestAnimationFrame(() => { waiting = false; if (state.running) fitKeyboard(); });
    };
    global.addEventListener('resize', fitHandler);
  }

  function unbindFit() {
    if (fitHandler) global.removeEventListener('resize', fitHandler);
    fitHandler = null;
  }

  /**
   * さいしょの お題の ならび。
   *
   * コースの ステージは **前の れんしゅうの つづき** から はじめます。
   * lapPos もん目まで 打ってあるので、のこりは lapNeed - lapPos もん です。
   * 「もう1かい」と チャレンジは じゅんばんを かえます。
   */
  function firstQueue(pool, source, endless, lapPos) {
    const need = Math.max(1, pool.length);
    const left = Math.max(1, need - Math.max(0, lapPos || 0));
    if (endless) return shuffle(pool.slice());
    if (source !== 'course') return shuffle(pool.slice()).slice(0, left);
    return pool.slice(need - left);
  }

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }

  function loadItem() {
    if (state.queue.length === 0) {
      // お題は かならず つづきます。ここで 止まる ことは ありません
      state.queue = shuffle(state.pool.slice());
    }
    const item = state.queue.shift();
    state.current = item;
    state.matcher = T.Romaji.createMatcher(item.k);
    state.itemStart = performance.now();
    state.itemKeyCount = 0;
    state.itemMistakes = 0;
    state.itemWrong = [];
    state.itemFirstTry = true;
    $('q-label').textContent = item.d || '';
    $('q-label').hidden = !item.d;
    $('play-skip-btn').hidden = true;
    renderQuestion();
    renderProgress();
  }

  /** お題の 表示を 描きなおします（打ち終えた ところは 色が かわります） */
  function renderQuestion() {
    const item = state.current;
    const done = state.matcher.kanaDone();
    const text = item.k;
    $('q-kana').innerHTML =
      `<span class="done">${esc(text.slice(0, done))}</span>` +
      `<span class="now">${esc(text.slice(done, done + 1))}</span>` +
      `<span class="rest">${esc(text.slice(done + 1))}</span>`;

    const romaji = $('q-romaji');
    if (item.raw || !state.view.romajiHint) {
      romaji.hidden = true;
    } else {
      const h = state.matcher.hint();
      romaji.hidden = false;
      romaji.innerHTML = `<span class="done">${esc(h.done)}</span><span class="rest">${esc(h.rest)}</span>`;
    }
    renderNextKey();
  }

  /** つぎに 押す キーと、その 指を しめします */
  function renderNextKey() {
    const ch = state.matcher.expected();
    const box = $('play-finger');
    if (!box) return;
    const clear = () => {
      box.innerHTML = '';
      if (state.view.nextGlow) T.Keyboard.highlight([]);
      if (state.showHands) T.Hands.highlight([]);
    };
    if (!ch) { clear(); return; }
    const found = T.Layout.findKey(state.settings.layout, ch);
    if (!found) { clear(); return; }
    const finger = T.Layout.fingerOf(found.key.code);
    if (state.view.nextGlow) T.Keyboard.highlight([found.key.code], found.shift);
    if (state.showHands) {
      const ids = finger ? [finger.id] : [];
      // シフトは 打つ 手と はんたいの こゆびです。かた手で 押さない ように
      if (found.shift) ids.push(T.Hands.shiftFingerFor(finger ? finger.id : ''));
      T.Hands.highlight(ids);
    }
    // めかくしの ときだけ、ことばの 案内も 出しません。
    // ほかの つよさでは のこします — 絵を 消しても、
    // 「どの指か」は かならず ことばで つたわるように するためです
    if (!state.view.fingerWords) { box.innerHTML = ''; return; }
    // 指が 決まっていない キー（やじるしなど）でも、
    // 「つぎに 何を 押すか」だけは かならず 出します
    const label = esc(ch === ' ' ? 'スペース' : ch.toUpperCase());
    box.innerHTML =
      (finger && state.view.fingerGuide ? `<span class="finger-dot" style="--finger:${finger.color}"></span>` : '') +
      `<span class="finger-text">つぎは <b>${label}</b>` +
      (finger ? ` を <b>${esc(finger.label)}</b>で` : '') + '</span>' +
      (found.shift ? '<span class="finger-shift">シフトも いっしょに</span>' : '');
  }

  function renderProgress() {
    const bar = $('play-bar');
    if (!bar) return;
    if (state.limitMs) {
      const left = Math.max(0, state.limitMs - elapsed());
      bar.style.width = `${Math.round(left / state.limitMs * 100)}%`;
      const num = $('play-left');
      if (num) num.textContent = String(Math.ceil(left / 1000));
      const box = $('play-root');
      if (box) box.classList.toggle('is-hurry', left <= 10000);
      return;
    }
    // おまけの 周は、ひとまわりの すすみとは べつに 数えます。
    // 本編の 数に 足しつづけると バーが 100%を こえて しまいます
    if (state.phase === 'retry') {
      const total = Math.max(1, state.retryTotal);
      bar.style.width = `${Math.round(Math.min(1, state.index / total) * 100)}%`;
      const left = $('play-left-items');
      if (left) left.textContent = String(Math.max(0, total - state.index));
      return;
    }
    const left = Math.max(0, state.lapNeed - state.lapPos);
    const leftEl = $('play-left-items');
    if (leftEl) leftEl.textContent = String(left);
    bar.style.width = `${Math.round(Math.min(1, state.lapPos / state.lapNeed) * 100)}%`;
  }

  function renderMeters() {
    const stats = liveStats();
    $('m-kps').textContent = stats.kps.toFixed(1);
    if (state.goalKps > 0) {
      const box = $('m-kps-box');
      if (box) box.classList.toggle('is-reached', stats.kps >= state.goalKps);
    }
    $('m-acc').textContent = String(Math.round(stats.accuracy));
    $('m-miss').textContent = String(state.missKeys);
    $('m-combo').textContent = String(state.combo);
  }

  /** はじめの 1打からの 時間。まだ 打って いなければ 0 */
  function elapsed() {
    if (!state.startTime) return 0;
    const now = state.pausedAt || performance.now();
    return Math.max(0, now - state.startTime - state.pausedMs);
  }

  /**
   * おまけの 周に つかった 時間の 合計。
   *
   * おまけの 周の 打鍵は 数えないので、時間だけ のびると はやさが
   * 実際より 低く 出て しまいます。ひとまわり する たびに おまけの 周が
   * 入るので、「入った ところで 時計を 止める」だけでは 足りません。
   * **入って いた あいだの 合計**を ためて おいて、あとから ひきます。
   */
  function retryElapsed() {
    return state.retryMs + (state.phase === 'retry' ? Math.max(0, elapsed() - state.retryEnter) : 0);
  }

  function retryIdle() {
    return state.retryIdleMs + (state.phase === 'retry' ? Math.max(0, state.idleMs - state.idleEnter) : 0);
  }

  function liveStats() {
    const ms = Math.max(0, elapsed() - retryElapsed());
    const idle = Math.max(0, state.idleMs - retryIdle());
    // 時間ぎめの チャレンジは、手を 止めた ぶんも そのまま スコアに ひびきます
    const active = state.limitMs ? Math.max(1, ms) : Math.max(1, ms - idle);
    const total = state.correctKeys + state.missKeys;
    return {
      elapsedMs: ms,
      activeMs: active,
      kps: ms > 0 ? state.correctKeys / (active / 1000) : 0,
      accuracy: total > 0 ? (state.correctKeys / total) * 100 : 100
    };
  }

  // ------------------------------------------------------------------
  // 時間ぎめ（チャレンジ）
  // ------------------------------------------------------------------

  function startTimer() {
    stopTimer();
    state.timerId = setInterval(() => {
      if (!state.running) return;
      renderProgress();
      if (state.startTime && elapsed() >= state.limitMs) finish('completed');
    }, 100);
  }

  function stopTimer() {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = 0;
  }

  // ------------------------------------------------------------------
  // ほかの タブへ うつって いる あいだ
  // ------------------------------------------------------------------
  //
  // ■ 時計は 止めます
  // ずるにも ならず、そんにも なりません。前は 時間ぎめの チャレンジだけで
  // 止めて いましたが、ふつうの れんしゅうでも 止めます。**止めないと、
  // 画面を ひらいた まま 図書室へ 行った 時間まで「れんしゅうした 時間」に
  // 入って しまう**からです。きょうの じかんも、先生が 見る 学習時間も
  // 実さいより 長く 出ます。
  //
  // ■ 5分より 長く はなれて いたら、そこで きろくを 1つ 区切ります
  // 朝 ひらいて 昼に もどって きた 回を ひとつづきの れんしゅうと して
  // 数えないためです。**はなれた 時こくで きろくを 締め**、もどって きたら
  // 新しい きろくを はじめます。打った ぶんは すすみぐあいに たまって いるので、
  // ステージは とちゅうの お題から そのまま つづきます。

  let visibilityHandler = null;

  function bindVisibility() {
    unbindVisibility();
    visibilityHandler = onVisibility;
    document.addEventListener('visibilitychange', visibilityHandler);
  }

  function unbindVisibility() {
    if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }

  function onVisibility() {
    if (!state.running) return;
    if (document.hidden) {
      state.leftAt = Date.now();
      if (state.startTime) state.pausedAt = performance.now();
      return;
    }
    const away = state.leftAt ? Math.max(0, Date.now() - state.leftAt) : 0;
    state.leftAt = 0;
    if (state.pausedAt) {
      state.pausedMs += performance.now() - state.pausedAt;
      state.pausedAt = 0;
      state.lastKeyTime = performance.now();
      // 時計を つけ直したので、つぎの 1打の「かかった 時間」は にせものです。
      // これを 数えると、ありもしない「速い キー」が できて しまいます
      state.skipLatency = true;
    }
    // 1打も 打って いない 回は 区切りません。中身の ない きろくが
    // ログの わく（500件）を うめて しまいます
    if (away < AWAY_SPLIT_MS || !hasWork() || !state.onAway) return;
    const resume = state.onAway;
    // 待って いた 5分を 学習時間に 入れない ため、**はなれた 時こく**で 締めます
    finish('left', new Date(Date.now() - away).toISOString());
    resume();
  }

  // ------------------------------------------------------------------
  // 入力
  // ------------------------------------------------------------------

  let keyHandler = null;

  function bindKeys() {
    unbindKeys();
    keyHandler = e => {
      if (!state.running) return;
      // かな入力（IME）が オンだと、キーが アプリまで 届きません
      if (e.isComposing || e.keyCode === 229) { warnIme(); return; }
      // Ctrl や Alt との くみあわせは ブラウザに ゆずります（ショートカットの ため）
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === 'Escape') return;                    // 「もどる」は ナビにまかせます
      if (e.key === 'Backspace') { e.preventDefault(); return; }
      if (e.key.length !== 1) return;
      e.preventDefault();                                 // スペースで 画面が 下がるのを 止めます
      handleChar(e.key, e.code);
    };
    document.addEventListener('keydown', keyHandler, true);
  }

  function unbindKeys() {
    if (keyHandler) document.removeEventListener('keydown', keyHandler, true);
    keyHandler = null;
  }

  function warnIme() {
    if (state.imeWarned) return;
    state.imeWarned = true;
    const el = $('ime-warn');
    if (el) el.hidden = false;
  }

  /**
   * 1打を うけとります（キーボードからも、画面の タップからも ここに 来ます）。
   * @param {string} ch 打たれた 文字
   * @param {string} [code] キーの 位置
   * @param {string} [src] 'tap' なら 画面を さわって 打った ぶん
   */
  function handleChar(ch, code, src) {
    if (!state.running || !state.matcher) return;
    const now = performance.now();
    const gapBefore = state.startTime ? now - state.lastKeyTime : 0;

    if (state.retryNotice) {
      // おまけの 周の あんないは、打ちはじめたら 消します
      state.retryNotice = false;
      const notice = $('play-ready');
      if (notice) notice.classList.add('is-gone');
    }

    if (!state.startTime) {
      // さいしょの 1打。ここから 時計が うごきはじめます。
      // performance.now() は 経過時間を はかる ための 時計なので、
      // 「何時 何分に はじめたか」は べつに Date から とります
      state.startTime = now;
      state.clockStartedAt = new Date();
      state.lastKeyTime = now;
      // 場所は のこして うすくするだけ。消すと 画面が とびます
      const ready = $('play-ready');
      if (ready) ready.classList.add('is-gone');
    } else {
      // 5秒より 長い 手止まりは 学習時間から のぞきます（チャレンジは のぞきません）
      const gap = now - state.lastKeyTime;
      if (gap > IDLE_MS) state.idleMs += gap - IDLE_MS;
      state.lastKeyTime = now;
    }

    const info = state.matcher.expectedInfo();
    const expectedChar = info.ch;
    const r = state.matcher.input(String(ch).toLowerCase());

    recordTiming(ch, r.ok, gapBefore, src);
    recordRule(info.rule, r.ok);

    // おまけの 周の 打鍵は、はやさ・正かくさ・★の もとには 数えません。
    // 数えると「まちがえて 打ち直した 子ほど 正かくさが 上がる」ことに なり、
    // ★が「さいしょに どれだけ 正しく 打てたか」を あらわさなく なります
    const counts = state.phase === 'main';

    // 手の イラストは「打つ はずだった 指」で 光らせます。
    // 打った キーで 光らせると、まちがえた ときに **まちがった 指** を
    // ほめる ことに なって しまいます
    const wantFinger = fingerOfChar(expectedChar);

    if (r.ok) {
      if (counts) state.correctKeys++;
      state.combo++;
      if (state.combo > state.bestCombo) state.bestCombo = state.combo;
      if (code && state.showKeyboard) T.Keyboard.flash(code, true);
      if (state.showHands && wantFinger) T.Hands.press(wantFinger.id, true);
      if (state.showBuddy) T.Buddy.tap();
      if (state.combo > 0 && state.combo % COMBO_STEP === 0) celebrateCombo();
      beep(true);
    } else {
      if (counts) state.missKeys++;
      state.itemMistakes++;
      state.itemFirstTry = false;
      state.combo = 0;
      recordMiss(ch, expectedChar);
      if (code && state.showKeyboard) T.Keyboard.flash(code, false);
      if (state.showHands && wantFinger) T.Hands.press(wantFinger.id, false);
      if (state.showBuddy) T.Buddy.miss();
      shake();
      beep(false);
      if (state.itemMistakes >= SKIP_AFTER) {
        const btn = $('play-skip-btn');
        if (btn) btn.hidden = false;
      }
    }

    state.itemKeyCount++;
    renderQuestion();
    renderMeters();

    if (state.matcher.isFinished()) finishItem(true);
  }

  /**
   * 打つまでに かかった 時間を 数えます。
   *
   * ■ 数えて よい 1打か
   * 「押すのに かかった 時間」に なって いない ものを まぜると、
   * にがての 一覧が でたらめに なります。つぎの ときは 数えません。
   *
   *   1. お題の 1文字目 … 前の 時間は お題を 読んで いた 時間です
   *   2. まちがえた すぐ あと … 打ち直しは「さがす 時間」では ありません
   *   3. 画面を さわって 打った ぶん … 指を はこぶ 時間で、タイピングでは ありません
   *   4. ほかの 画面から もどった すぐ あと … onVisibility が 時計を つけ直すので
   *      にせの みじかい 時間に なります
   *   5. 3びょうより 長い とき … キーボードから 手を はなして いました
   *
   * ■ 実際に 押した キーで 数えます
   * 「し」は si でも shi でも 正かいなので、出す はずだった キーでは なく
   * **手が 見つけた キー** で 数えないと 意味が ありません。
   */
  function recordTiming(pressed, ok, gap, src) {
    const M = T.Mastery;
    const key = String(pressed).toLowerCase();
    // 生の 1打は けっか画面の グラフに つかうだけで、保存は しません
    if (state.keystrokes.length < 2000) {
      state.keystrokes.push({ ms: Math.round(gap), ok: !!ok, ch: key, retry: state.phase === 'retry' });
    }

    const skip = state.skipLatency;
    state.skipLatency = false;
    const wasOk = state.lastOk;
    state.lastOk = !!ok;

    if (!ok) return;                                  // ミスは はやさに 数えません
    if (src === 'tap') return;                        // 3
    if (skip) return;                                 // 4
    if (state.itemKeyCount === 0) return;             // 1
    if (!wasOk) return;                               // 2
    if (gap <= 0 || gap > M.MAX_SAMPLE) return;       // 5

    if (!state.lat[key]) state.lat[key] = new Array(M.BUCKETS).fill(0);
    state.lat[key][M.bucketOf(gap)]++;
  }

  /**
   * ローマ字の どの きまりで つまずいたかを 数えます。
   * **正しく 打てた ぶんも 数えます**。回数では なく わりあいで 見ないと、
   * よく 出て くる きまりほど にがてに 見えて しまうためです。
   */
  function recordRule(rule, ok) {
    if (!rule || rule === 'raw' || rule === 'kigou') return;
    if (!state.rule[rule]) state.rule[rule] = [0, 0];
    state.rule[rule][0]++;
    if (!ok) state.rule[rule][1]++;
  }

  /** どの キー・どの指で つまずいたかを 数えます（にがて とっくんの もとに なります） */
  function recordMiss(pressed, expectedChar) {
    if (state.itemWrong.length < 8 && pressed && !/[<>{}\\]/.test(pressed)) {
      state.itemWrong.push(pressed);
    }
    if (!expectedChar) return;
    // 「何と 何を とりちがえたか」。
    // 「d が にがて」より「d と f の 区べつが ついて いない」の ほうが、
    // つぎに 何を すれば よいかが はっきり します
    const want = String(expectedChar).toLowerCase();
    const got = String(pressed).toLowerCase();
    if (want !== got && T.Mastery.SAFE_KEY.test(want) && T.Mastery.SAFE_KEY.test(got)) {
      const pair = `${want}>${got}`;
      state.conf[pair] = (state.conf[pair] || 0) + 1;
    }
    const key = expectedChar === ' ' ? 'space' : expectedChar;
    state.missByKey[key] = (state.missByKey[key] || 0) + 1;
    const found = T.Layout.findKey(state.settings.layout, expectedChar);
    const finger = found ? T.Layout.fingerOf(found.key.code) : null;
    if (finger) state.missByFinger[finger.id] = (state.missByFinger[finger.id] || 0) + 1;
    // おまけの 周の ぶんは、うえの 合計に 入れた まま べつにも 数えます。
    // にがての 集計（missSummary）は これまでどおり 合計を つかい、
    // 学習ログだけが 本編と 打ち直しを 分けて 見ます
    if (state.phase === 'retry') {
      state.retryMissByKey[key] = (state.retryMissByKey[key] || 0) + 1;
      if (finger) state.retryMissByFinger[finger.id] = (state.retryMissByFinger[finger.id] || 0) + 1;
    }
  }

  /** その 文字を 打つ ことに なって いる 指（見つからなければ null） */
  function fingerOfChar(ch) {
    if (!ch) return null;
    const found = T.Layout.findKey(state.settings.layout, ch);
    return found ? T.Layout.fingerOf(found.key.code) : null;
  }

  /** つまずいた ときの にげみち。とばした お題は 正かいには しません */
  function skipItem() {
    if (!state.running) return;
    state.combo = 0;
    renderMeters();
    finishItem(false);
  }

  function finishItem(ok) {
    const item = state.current;
    state.results.push({
      q: item.k,
      ok: !!ok,
      firstTry: ok && state.itemFirstTry,
      tries: state.itemMistakes + 1,
      ms: state.startTime ? performance.now() - state.itemStart : 0,
      wrong: state.itemWrong.slice(),
      retry: state.phase === 'retry'
    });
    // 本編で つまずいた お題は、しゅうの さいごに もう1回 出すために とっておきます
    if (state.phase === 'main' && state.retryUse && !state.itemFirstTry &&
        state.retryPool.length < RETRY_MAX) {
      state.retryPool.push(item);
    }
    state.index++;
    if (state.phase === 'main') {
      state.doneItems++;
      state.lapPos++;
    }
    renderProgress();

    const stage = $('play-stage');
    if (stage && ok) {
      stage.classList.add('is-clear');
      setTimeout(() => stage.classList.remove('is-clear'), 260);
      // お題 1つぶんの しごとが できあがりました。キャラクターの
      // よこに ものが つみ上がって いくのは ここです
      if (state.showBuddy) T.Buddy.done();
    }

    // 時間ぎめ（チャレンジ）と おわりの ない れんしゅうは、ひとまわりを 数えません
    if (!state.limitMs && !state.endless && state.queue.length === 0) {
      if (!startRetry()) lapDone();
    }
    loadItem();
  }

  /**
   * ひとまわり する たびに、その しゅうで まちがえた お題を もう1回だけ 出します。
   * 「まちがえた 直後に もう一度 打つ」のが いちばん 身に つくためです。
   * ここから 先の 打鍵は 記録には のこりますが、はやさ・正かくさ・★には
   * 数えません（handleChar の counts を 見てください）。
   *
   * @returns {boolean} おまけの 周に 入ったか
   */
  function startRetry() {
    if (state.phase !== 'main' || !state.retryUse || state.retryPool.length === 0) return false;
    state.phase = 'retry';
    // ここから おまけの 周。時間を ひくために 入った ところを おぼえて おきます
    state.retryEnter = elapsed();
    state.idleEnter = state.idleMs;
    state.queue = state.retryPool.slice();
    state.retryTotal = state.queue.length;
    state.index = 0;

    const root = $('play-root');
    if (root) root.classList.add('is-retry');
    const phase = $('play-phase');
    if (phase) phase.hidden = false;
    const notice = $('play-ready');
    if (notice) {
      notice.innerHTML = `${T.icon('retry')} もう1かいだけ、さっき まちがえた ことばを やってみよう。`;
      notice.classList.remove('is-gone');
      state.retryNotice = true;
    }
    return true;
  }

  /**
   * ひとまわり できました。
   *
   * **ここで 練習は 止めません。** みじかく ほめて、そのまま つぎの しゅうに
   * 入ります。「おわり」の 画面を はさむと、そこで やめる 気もちに なって
   * しまい、「あと 30びょう だけ」が できなく なるためです。
   * やめる のは いつでも 子どもが 決めます。
   */
  function lapDone() {
    if (state.phase === 'retry') {
      // おまけの 周に かかった 時間を ここで 合計に 入れます
      state.retryMs += Math.max(0, elapsed() - state.retryEnter);
      state.retryIdleMs += Math.max(0, state.idleMs - state.idleEnter);
      const root = $('play-root');
      if (root) root.classList.remove('is-retry');
      const phase = $('play-phase');
      if (phase) phase.hidden = true;
      const notice = $('play-ready');
      if (notice && state.retryNotice) { notice.classList.add('is-gone'); state.retryNotice = false; }
    }
    state.laps++;
    state.phase = 'main';
    state.retryPool = [];
    state.retryTotal = 0;
    state.index = 0;
    state.lapPos = 0;
    state.queue = shuffle(state.pool.slice());   // 2しゅう目からは じゅんばんを かえます
    renderProgress();

    const stars = lapStarsNow();
    if (stars > state.lapStarsSeen) state.lapStarsSeen = stars;
    celebrateLap(stars);
  }

  /**
   * いま できあがった ひとまわりに つく ★（0〜3）。
   *
   * 数えかたは store.js に まかせます。ここで 出しなおすと、
   * **前の れんしゅうの つづきぶん**が 入らず、れんしゅう中に 見せた ★と
   * けっか画面・ステージ一覧の ★が 食いちがいます。子どもから 見れば
   * 「★3つを とったのに 消えた」です。
   *
   * ★の つかない ステージ（にがて とっくん）と 時間ぎめ（チャレンジ）は
   * ひとまわりを 数えないので、いつも 0 です。
   */
  function lapStarsNow() {
    if (state.stage.noStars || state.limitMs) return 0;
    const total = state.correctKeys + state.missKeys;
    // 打鍵が 1つも ない（ぜんぶ とばした）ときは お題の 数で 見ます。
    // store.applyResult と 同じ 分けかたです
    const delta = total > 0
      ? { correct: state.correctKeys, total: total }
      : {
        correct: state.results.filter(it => it.ok && !it.retry).length,
        total: state.doneItems, byItem: true
      };
    return T.Store.lapStarsPreview(state.stage.id, delta);
  }

  /**
   * ひとまわりの おいわい。2びょうほどで 消え、打つのを じゃましません。
   *
   * ★3つの ときだけ、しるしを 金色に かえて その ばで 知らせます。
   * ★が 見えるのが けっか画面だけ だと、いちばん うまく 打てた しゅんかんに
   * 何も おきないためです。**ここでも 練習は 止めません。**
   *
   * @param {number} stars この ひとまわりに ついた ★（0〜3）
   */
  function celebrateLap(stars) {
    const full = stars >= 3;
    // 2回目からは「はじめての」と 言いません（うそに なります）
    const first = full && !state.hadFullStars;
    if (full) state.hadFullStars = true;

    const flash = $('play-lap-flash');
    if (flash) {
      const lap = `（${state.laps}しゅう目）`;
      // アイコンだけでは 意味が つたわらないので、かならず ことばを そえます
      flash.innerHTML = full
        ? `<span class="stars">${`<span class="star on">${T.icon('star')}</span>`.repeat(3)}</span>`
          + `${first ? 'はじめての ★3つ！' : '★3つ！'}${lap}`
        : `ひとまわり できた！${lap}`;
      flash.classList.toggle('is-full', full);
      flash.hidden = false;
      flash.classList.remove('is-on');
      void flash.getBoundingClientRect();
      flash.classList.add('is-on');
      if (state.lapFlashTimer) clearTimeout(state.lapFlashTimer);
      state.lapFlashTimer = setTimeout(() => {
        state.lapFlashTimer = 0;
        flash.hidden = true;
        flash.classList.remove('is-on');
      }, full ? FULL_FLASH_MS : LAP_FLASH_MS);

      // ひらひらを **しるしの ところから** すこしだけ まきます。
      //
      // ■ どうして まん中では ないのか
      // ひとまわりは いちばん うれしい しゅんかん なので、目に 見える
      // おいわいを 出します。でも 打つのは まだ つづいて います。
      // お題の 文字の 上に かぶせると、つぎの お題が 読めなく なります。
      // しるしと 同じ 右上から、少ない かずだけ まいて、すぐ 消します。
      // ★3つの ときだけ すこし 多く しますが、まく ばしょは かえません
      if (T.FX) T.FX.confettiAt(flash, full ? { count: 54, power: .8 } : { count: 26, power: .55 });
    }
    if (state.showBuddy) {
      T.Buddy.cheer();
      // ひとまわり ＝ ドリル 1つぶん。おわる ごとに つぎの キャラクターを
      // くじで 引きなおします（せっていで しごとを えらんで いる ときは
      // buddy.js が 何も しません）。よろこびの うごきが 終わってから 入れかえます
      T.Buddy.reroll();
    }
    if (full) chimeFull(); else chime();
  }

  /**
   * ヒントの つよさを、あとから 読める 名前に します。
   * 数字（0〜3）の ままだと、つよさの だんかいを 足した ときに
   * 過去の きろくの 意味が ずれます。
   */
  const HINT_NAMES = ['all', 'finger-color', 'position-only', 'none'];

  function hintLevelName(view) {
    if (!view) return '';
    const level = view.level;
    if (typeof level === 'number' && HINT_NAMES[level]) {
      return view.auto ? `auto-${HINT_NAMES[level]}` : HINT_NAMES[level];
    }
    return String(level || '');
  }

  /**
   * いま までの ぶんを まとめて 返します。
   *
   * status
   *   'completed' … 時間ぎめの チャレンジが 時間で おわった
   *   'stopped'   … 子どもが「やめる」や「もどる」で おえた
   *   'left'      … 画面を とじた（つづきは のこして おきます）
   *
   * **どの status でも 中身は 同じ です。** 「さいごまで やった 回だけ
   * 数える」という 分けかたを やめた ので、ここで 分ける ものが ありません。
   *
   * @param {string} status
   * @param {string} [endedAt] おわりの 時こく（ISO）。5分いじょう はなれて いた ときは
   *   **はなれた 時こく**を わたします。待って いた 時間を きろくに 入れない ためです
   */
  function finish(status, endedAt) {
    if (!state.running) return null;
    state.running = false;
    stopTimer();
    unbindKeys();
    unbindFit();
    unbindLeaveGuard();
    unbindVisibility();
    T.Buddy.stop();

    const stats = liveStats();
    const activeMs60 = T.Study ? T.Study.endSession() : null;
    const total = state.correctKeys + state.missKeys;
    const result = {
      course: state.course,
      stage: state.stage,
      source: state.source,
      special: state.special,
      status,
      startedAt: state.startedAt,
      // さいしょの 1打の 時こく。学習ログの startedAt は こちらを つかいます
      // （elapsedMs も そこから 数えて いるので、2つの 数字が 合います）
      clockStartedAt: state.clockStartedAt || state.startedAt,
      finishedAt: endedAt || new Date().toISOString(),
      elapsedMs: stats.elapsedMs,
      // 5秒 基準（アプリの 速さの 計算に つかう 時間）
      activeMs: stats.activeMs,
      // 60秒 基準（8アプリ 共通の 学習時間）。名前を 分けて、まざらない ように します
      activeMs60: activeMs60,
      items: state.results,
      correctKeys: state.correctKeys,
      totalKeys: total,
      missKeys: state.missKeys,
      kps: stats.kps,
      accuracy: total > 0 ? (state.correctKeys / total) * 100 : 0,
      combo: state.bestCombo,
      missByKey: state.missByKey,
      missByFinger: state.missByFinger,
      // おまけの 周（打ち直し）の ぶん。学習ログが 本編と 分けるのに つかいます
      retryMissByKey: state.retryMissByKey,
      retryMissByFinger: state.retryMissByFinger,
      retryMs: Math.round(retryElapsed()),
      // ヒントの つよさ。強い ヒントの まま 高い 正答率なのか、
      // ヒントを 消しても たもてて いるのかで、身に ついた ぐあいが ちがいます
      hintLevel: hintLevelName(state.view),
      // だん（そのさき）は「ヒントを どれだけ 消した じょうたいで 出した
      // はやさか」で 決まります。名前では くらべられないので 数でも 返します
      hintStrength: T.Store.hintStrengthOf(state.view),
      lat: state.lat,
      conf: state.conf,
      rule: state.rule,
      // 1打ずつの 生の きろく。けっか画面の グラフに つかうだけで、
      // 保存は しません（saveResult の 一覧に 入れて いません）
      keystrokes: state.keystrokes,
      layout: state.settings.layout,
      // ひとまわりの すすみに たす ぶん。とちゅうで やめても ここは のこります
      doneItems: state.doneItems,
      lapNeed: state.lapNeed,
      lapPos: state.lapPos,
      laps: state.laps,
      // れんしゅう中に「★3つ！」と 見せた ぶん。見せた ★より
      // けっか画面が 下に ならない ように、store に わたします
      lapStarsSeen: state.lapStarsSeen,
      count: state.doneItems,
      done: state.index,
      retried: state.retryTotal
    };
    if (typeof state.onFinish === 'function') state.onFinish(result);
    return result;
  }

  // ------------------------------------------------------------------
  // 画面を とじられた ときに とりこぼさない
  // ------------------------------------------------------------------
  //
  // 「もどる」や「やめる」で おえた ときは その ばで 保存できますが、
  // タブを とじられた ときは 何も よばれません。10びょうだけ 打って
  // タブを とじる 子は ふつうに いるので、そこで きろくが 消えると
  // 「みじかくても のこる」という 約束が やぶれます。
  //
  // pagehide は タブを とじる とき・べつの ページに うつる ときに
  // かならず 1回 きます（beforeunload は スマートフォンで きません）。

  let leaveHandler = null;

  function bindLeaveGuard() {
    unbindLeaveGuard();
    leaveHandler = () => {
      if (!state.running) return;
      if (state.correctKeys + state.missKeys === 0 && state.doneItems === 0) return;
      finish('left');
    };
    global.addEventListener('pagehide', leaveHandler);
  }

  function unbindLeaveGuard() {
    if (leaveHandler) global.removeEventListener('pagehide', leaveHandler);
    leaveHandler = null;
  }

  // ------------------------------------------------------------------
  // 手ごたえ（見た目と おと）
  // ------------------------------------------------------------------

  function shake() {
    const el = $('play-stage');
    if (!el) return;
    el.classList.remove('is-miss');
    void el.offsetWidth;
    el.classList.add('is-miss');
  }

  /** れんぞくが 10・20・30…に なった ときだけ、みじかく ほめます */
  function celebrateCombo() {
    const box = $('m-combo-box');
    if (box) {
      box.classList.remove('is-up');
      void box.offsetWidth;
      box.classList.add('is-up');
    }
    if (state.showBuddy) T.Buddy.combo();
    chime();
  }

  /** 打ったときの みじかい おと（せっていで 消せます） */
  let audioCtx = null;

  function tone(freq, ms, volume) {
    if (!state.settings || !state.settings.sound) return;
    try {
      audioCtx = audioCtx || new (global.AudioContext || global.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = volume;
      osc.connect(gain).connect(audioCtx.destination);
      const t = audioCtx.currentTime;
      osc.start(t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
      osc.stop(t + ms / 1000 + 0.01);
    } catch (e) { /* おとが 出せなくても 練習は つづけられます */ }
  }

  function beep(ok) { tone(ok ? 880 : 220, ok ? 60 : 140, 0.05); }

  /** れんぞくの おいわい。3つの 音を かさねて 明るく します */
  function chime() {
    [0, 90, 180].forEach((delay, i) => {
      setTimeout(() => tone([784, 988, 1319][i], 180, 0.045), delay);
    });
  }

  /**
   * ★3つの ひとまわり。ふつうの おいわいの 上に もう1つ 高い 音を のせます。
   * 音を 大きくは しません（教室で 30台が いっせいに 鳴らします）。
   * 「いつもと ちがう」ことが つたわれば じゅうぶんです
   */
  function chimeFull() {
    [784, 988, 1319, 1568].forEach((freq, i) => {
      setTimeout(() => tone(freq, i === 3 ? 300 : 180, 0.045), i * 90);
    });
  }

  function isRunning() { return state.running; }
  function setOnFinish(fn) { state.onFinish = fn; }

  /** 子どもが「やめる」や「もどる」で おえた とき */
  function stop() { return finish('stopped'); }

  /** この 回で 何か 打ったか（1打も なければ きろくに のこしません） */
  function hasWork() { return state.correctKeys + state.missKeys > 0 || state.doneItems > 0; }

  global.Typa = global.Typa || {};
  global.Typa.Play = { start, finish, stop, abort: stop, isRunning, hasWork, setOnFinish, unbindKeys };
})(window);
