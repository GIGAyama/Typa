/**
 * =====================================================================
 * hands.js — 手の イラスト（つぎに つかう 指が 光ります）
 * =====================================================================
 * 画面の キーボードは「キーが どこに あるか」を おしえて くれますが、
 * 「**どの 指を のばすか**」までは 教えて くれません。
 * 人差し指 2本だけで 打つ 癖は、そこで つきます。
 *
 * そこで キーボードの **すぐ 下**に 上から 見た 両手を 出し、
 * つぎに つかう 指だけを 光らせます。指の 色は layout.js の 色を
 * そのまま つかうので、キーボードの 色分けと かならず 一致します。
 *
 * ■ キーボードと 同じ ものさしで 描きます
 * まえは 手の 絵を キーボードの **よこ**に ならべて いました。
 * すると「キーの ばしょ」と「その指」を 見くらべる たびに 目が
 * 左右に いききします。どの 指が どの キーの 下に あるのかも
 * 分かりません。
 *
 * いまは キーボードの 下に かさねて 描きます。keyboard.js は
 * キーボードを **よこ60マス**の グリッドで 組むので、この 絵も
 * 同じ 60マスを 1000 に のばした ものさしで 描きます。すると
 * 指先は かならず ホームポジションの キーの **まっすぐ 下**に 来ます。
 * 目は 上下に すこし うごくだけ で すみます。
 *
 * ■ たては わざと ひくく します
 * 学校の Chromebook は「よこに ひろく、たてに みじかい」です。
 * 手を まるごと 大きく 描くと、こんどは キーボードが 画面の 外に
 * 出て しまいます。そこで **手のひらは 画面の 下に 出したまま**、
 * 指先だけが 見える 高さに して、たての 場所を つかいません。
 *
 * ■ 色だけに たよらない
 * 光る 指は 色を つけるだけで なく、まわりに 太い わくが つき、
 * すこし 前に のびます。色の ちがいが 見えにくい 子でも
 * 「どれが 光って いるか」が 形で わかります。
 * 指先には ホームポジションの 文字（A S D F J K L ;）を 書いて、
 * 「この 指は この キー」を 目で つなげられるように しました。
 *
 * ■ 鏡（scale(-1,1)）で 右手を 作らない
 * まとめて 左右を ひっくり返すと、指先の 文字まで 裏返って しまいます。
 * それに 日本語配列の ホームポジションは 左右で 対称では ありません
 * （左は けんさくキーの ぶん 右へ ずれて います）。
 * そこで 左右 それぞれの キーの ばしょから 座標を 出します。
 */
(function (global) {
  'use strict';

  const Layout = global.Typa.Layout;

  /**
   * 絵の 大きさ。よこ 1000 は keyboard.js の グリッド 60マスぶん です
   * （1マス = 1000 / 60）。たては 指先だけが 入る 高さに します。
   */
  const VIEW_W = 1000;
  const VIEW_H = 100;
  const COL = VIEW_W / 60;

  /**
   * ホームポジションの キーの まんなかが、グリッドの 何マス目か。
   * A は 8マス目から 4マスぶん なので まんなかは 9、S は 13 … と つづきます。
   * keyboard.js の 組みかたを かえたら、ここも あわせて なおします。
   */
  const HOME_COL = {
    'l-pinky': 9, 'l-ring': 13, 'l-middle': 17, 'l-index': 21,
    'r-index': 33, 'r-middle': 37, 'r-ring': 41, 'r-pinky': 45
  };

  /**
   * 指（小指がわ から 人差し指がわ へ）。top が 小さいほど 長い 指です。
   *
   * 長さの ちがいは わざと ひかえめに して います。たてが みじかい 画面では
   * 絵の 下を きって（style.css の .hands-body）たかさを つめるので、
   * ちがいを 大きく すると **小指の 先が きられて 見えなく** なります。
   */
  const ROLES = ['pinky', 'ring', 'middle', 'index'];
  const FINGER_TOP = { pinky: 30, ring: 12, middle: 4, index: 18 };
  /** 指の はば。キー1つは 66.7 なので、すこし ほそくして となりと 分けます */
  const FINGER_W = 52;
  /** 指先に 書く 文字の 高さ（指の 先から どれだけ 下か）。
      きられても のこるように、なるべく 先の ほうに 書きます */
  const LETTER_DY = 26;

  /** 手のひら。下は 画面の 外に 出します（指先に 場所を ゆずります） */
  const PALM = { y: 66, h: 80, rx: 36, edge: 6 };

  /**
   * おやゆびは 手のひらの うちがわ（スペースキーの ほう）に ななめに つきます。
   * 回す 中心は「つけ根」＝人差し指の うちがわ の 下 です。
   * 左右の おやゆびが まんなかで かさならない ながさに して います。
   */
  const THUMB = { w: 44, h: 52, rot: 44, pivotY: 96 };

  /** 指先に 書く ホームポジションの 文字 */
  const HOME_CHAR = {
    'l-pinky': 'A', 'l-ring': 'S', 'l-middle': 'D', 'l-index': 'F',
    'r-index': 'J', 'r-middle': 'K', 'r-ring': 'L', 'r-pinky': ';'
  };

  const state = { container: null, els: {}, on: [] };

  function fingerId(hand, role) { return `${hand === 'left' ? 'l' : 'r'}-${role}`; }

  /** その 指の まんなかの x（キーボードの キーの まんなかと 同じ） */
  function centerX(hand, role) { return HOME_COL[fingerId(hand, role)] * COL; }

  function part(id, shape) {
    return `<g class="hand-finger" data-finger="${id}" style="--finger:${color(id)}">${shape}</g>`;
  }

  function color(id) {
    const f = Layout.FINGERS[id];
    return f ? f.color : 'currentColor';
  }

  /**
   * 片手ぶんの SVG。
   *
   * 手のひら → おやゆび → 指 の じゅんに 描きます。指が いちばん 上に
   * かさなるので、指は 手のひらの 上を とおって 下まで つながって 見えます
   * （手のひらを あとに 描くと、指が そこで ぶつっと 切れて 見えます）。
   */
  function handSvg(hand) {
    const inner = hand === 'left' ? 1 : -1;      // 手の「うちがわ」の むき
    const pivotX = centerX(hand, 'index') + inner * (FINGER_W / 2);
    const outerX = centerX(hand, 'pinky') - inner * (FINGER_W / 2 + PALM.edge);

    let out = `<rect class="hand-palm" x="${round(Math.min(pivotX, outerX))}" y="${PALM.y}"
      width="${round(Math.abs(pivotX - outerX))}" height="${PALM.h}" rx="${PALM.rx}"/>`;

    // おやゆびは 左右で かたむきの むきが ぎゃくに なります
    out += part('thumb',
      `<rect x="${round(pivotX - THUMB.w / 2)}" y="${THUMB.pivotY - THUMB.h}"
         width="${THUMB.w}" height="${THUMB.h}" rx="${THUMB.w / 2}"
         transform="rotate(${inner * THUMB.rot} ${round(pivotX)} ${THUMB.pivotY})"/>`);

    ROLES.forEach(role => {
      const id = fingerId(hand, role);
      const cx = centerX(hand, role);
      const top = FINGER_TOP[role];
      out += part(id,
        `<rect x="${round(cx - FINGER_W / 2)}" y="${top}" width="${FINGER_W}"
           height="${VIEW_H + 20 - top}" rx="${FINGER_W / 2}"/>` +
        (HOME_CHAR[id] ? `<text x="${round(cx)}" y="${top + LETTER_DY}">${HOME_CHAR[id]}</text>` : ''));
    });

    return out;
  }

  /** 手の まんなか（ラベルを 手の 下に そろえる ため）を % で 返します */
  function handCenterPct(hand) {
    const inner = hand === 'left' ? 1 : -1;
    const a = centerX(hand, 'index') + inner * (FINGER_W / 2);
    const b = centerX(hand, 'pinky') - inner * (FINGER_W / 2 + PALM.edge);
    return round((a + b) / 2 / VIEW_W * 100);
  }

  function round(n) { return Math.round(n * 10) / 10; }

  /**
   * 手の イラストを 描きます。
   *
   * 入れものの はばは、上に ある キーボードと **同じ** に して ください。
   * ずれると 指先が キーの 下から はずれて、いちばんの ねらいが 消えます。
   *
   * @param {HTMLElement} container
   */
  function render(container) {
    if (!container) return;
    state.container = container;
    state.els = {};
    state.on = [];

    container.className = 'hands';
    container.innerHTML = `
      <div class="hands-body">
        <svg class="hands-svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" role="img"
             aria-label="りょうての イラスト。つぎに つかう 指が 光ります">
          <g class="hand hand-left">${handSvg('left')}</g>
          <g class="hand hand-right">${handSvg('right')}</g>
        </svg>
      </div>
      <p class="hands-label">
        <span style="left:${handCenterPct('left')}%">ひだり手</span>
        <span style="left:${handCenterPct('right')}%">みぎ手</span>
      </p>`;

    // 同じ 指の ID が 左右に ある のは おやゆびだけ です（thumb は 両手）
    container.querySelectorAll('.hand-finger').forEach(el => {
      const id = el.dataset.finger;
      if (!state.els[id]) state.els[id] = [];
      state.els[id].push(el);
    });
  }

  /**
   * つぎに つかう 指を 光らせます。
   * @param {string[]} ids 指の ID（layout.js の FINGERS）。空なら ぜんぶ 消します
   */
  function highlight(ids) {
    state.on.forEach(el => el.classList.remove('is-next'));
    state.on = [];
    (ids || []).forEach(id => {
      (state.els[id] || []).forEach(el => {
        el.classList.add('is-next');
        state.on.push(el);
      });
    });
  }

  /**
   * 打った ときの 手ごたえ。正かいか まちがいかで 色を かえます。
   * @param {string} id 指の ID
   * @param {boolean} ok
   */
  function press(id, ok) {
    const cls = ok ? 'is-hit' : 'is-miss';
    (state.els[id] || []).forEach(el => {
      el.classList.remove('is-hit', 'is-miss');
      void el.getBoundingClientRect();   // いったん 消してから 付けなおすと 続けて 光ります
      el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), 220);
    });
  }

  /** シフトを おす ほうの こゆび（打つ 手と はんたいの 手）*/
  function shiftFingerFor(id) {
    if (!id) return 'l-pinky';
    return String(id).charAt(0) === 'l' ? 'r-pinky' : 'l-pinky';
  }

  global.Typa = global.Typa || {};
  global.Typa.Hands = { render, highlight, press, shiftFingerFor, HOME_CHAR, VIEW_W, VIEW_H };
})(window);
