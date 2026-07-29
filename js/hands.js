/**
 * =====================================================================
 * hands.js — 手の イラスト（つぎに つかう 指が 光ります）
 * =====================================================================
 * 画面の キーボードは「キーが どこに あるか」を おしえて くれますが、
 * 「**どの 指を のばすか**」までは 教えて くれません。
 * 人差し指 2本だけで 打つ 癖は、そこで つきます。
 *
 * そこで キーボードの となりに 上から 見た 両手を 出し、
 * つぎに つかう 指だけを 光らせます。指の 色は layout.js の 色を
 * そのまま つかうので、キーボードの 色分けと かならず 一致します。
 *
 * ■ 色だけに たよらない
 * 光る 指は 色を つけるだけで なく、**すこし 前に のびて**、
 * まわりに 太い わくが つきます。色の ちがいが 見えにくい 子でも
 * 「どれが 光って いるか」が 形で わかります。
 * 指先には ホームポジションの 文字（A S D F J K L ;）を 書いて、
 * 「この 指は この キー」を 目で つなげられるように しました。
 *
 * ■ 鏡（scale(-1,1)）で 右手を 作らない
 * まとめて 左右を ひっくり返すと、指先の 文字まで 裏返って しまいます。
 * そこで 形の 座標だけを JS で 折り返して、文字は そのまま 描きます。
 */
(function (global) {
  'use strict';

  const Layout = global.Typa.Layout;

  /**
   * 片手ぶんの 大きさ。
   *
   * おやゆびは ななめに たおすので、**たおした 先が はみ出さない はば**を
   * とって おきます。ここが せまいと、左右の おやゆびが まんなかで
   * かさなって、手が 2つ ある ように 見えなく なります。
   */
  const HAND_W = 178;
  const HAND_H = 180;
  const GAP = 12;

  const PALM = { x: 16, y: 100, w: 118, h: 62, rx: 24 };

  /** 指（小指がわ から 人差し指がわ へ）。y が 小さいほど 長い 指です */
  const FINGERS = [
    { role: 'pinky',  x: 20,  w: 22, y: 58, h: 54 },
    { role: 'ring',   x: 48,  w: 24, y: 38, h: 74 },
    { role: 'middle', x: 78,  w: 24, y: 30, h: 82 },
    { role: 'index',  x: 108, w: 24, y: 42, h: 70 }
  ];

  /**
   * おやゆびは 手のひらの そとがわに ななめに つきます。
   * 回す 中心は「つけ根」＝この 四角の 下の まんなか です。
   * たおした 先は x = 中心 + h×sin(rot) まで のびます（HAND_W の 中に おさめます）。
   */
  const THUMB = { x: 122, y: 104, w: 22, h: 46, rot: 60 };

  /** 指先に 書く ホームポジションの 文字 */
  const HOME_CHAR = {
    'l-pinky': 'A', 'l-ring': 'S', 'l-middle': 'D', 'l-index': 'F',
    'r-index': 'J', 'r-middle': 'K', 'r-ring': 'L', 'r-pinky': ';'
  };

  const state = { container: null, els: {}, on: [] };

  /** 右手は 座標を 折り返して 作ります（文字は 裏返しません） */
  function flipX(x, w, mirror) { return mirror ? HAND_W - x - w : x; }

  function fingerId(hand, role) { return `${hand === 'left' ? 'l' : 'r'}-${role}`; }

  function part(id, shape) {
    return `<g class="hand-finger" data-finger="${id}" style="--finger:${color(id)}">${shape}</g>`;
  }

  function color(id) {
    const f = Layout.FINGERS[id];
    return f ? f.color : 'currentColor';
  }

  /** 片手ぶんの SVG。mirror が true なら 右手です */
  function handSvg(hand) {
    const mirror = hand === 'right';
    let out = `<rect class="hand-palm" x="${flipX(PALM.x, PALM.w, mirror)}" y="${PALM.y}"
      width="${PALM.w}" height="${PALM.h}" rx="${PALM.rx}"/>`;

    FINGERS.forEach(f => {
      const id = fingerId(hand, f.role);
      const x = flipX(f.x, f.w, mirror);
      const cx = x + f.w / 2;
      const shape =
        `<rect x="${x}" y="${f.y}" width="${f.w}" height="${f.h + 24}" rx="${f.w / 2}"/>` +
        (HOME_CHAR[id] ? `<text x="${cx}" y="${f.y + 20}">${HOME_CHAR[id]}</text>` : '');
      out += part(id, shape);
    });

    // おやゆびは 左右で かたむきの むきが ぎゃくに なります
    const tx = flipX(THUMB.x, THUMB.w, mirror);
    const pivotX = tx + THUMB.w / 2;
    const pivotY = THUMB.y + THUMB.h;
    const rot = mirror ? -THUMB.rot : THUMB.rot;
    out += part('thumb',
      `<rect x="${tx}" y="${THUMB.y}" width="${THUMB.w}" height="${THUMB.h}" rx="${THUMB.w / 2}"
        transform="rotate(${rot} ${pivotX} ${pivotY})"/>`);

    return out;
  }

  /**
   * 手の イラストを 描きます。
   * @param {HTMLElement} container
   */
  function render(container) {
    if (!container) return;
    state.container = container;
    state.els = {};
    state.on = [];

    const total = HAND_W * 2 + GAP;
    container.className = 'hands';
    container.innerHTML = `
      <svg class="hands-svg" viewBox="0 0 ${total} ${HAND_H}" role="img"
           aria-label="りょうての イラスト。つぎに つかう 指が 光ります">
        <g class="hand hand-left">${handSvg('left')}</g>
        <g class="hand hand-right" transform="translate(${HAND_W + GAP} 0)">${handSvg('right')}</g>
      </svg>
      <p class="hands-label"><span>ひだり手</span><span>みぎ手</span></p>`;

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
  global.Typa.Hands = { render, highlight, press, shiftFingerFor, HOME_CHAR };
})(window);
