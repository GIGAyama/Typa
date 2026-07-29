/**
 * =====================================================================
 * buddy.js — いっしょに 打つ キャラクター
 * =====================================================================
 * 打つと キャラクターが うごきます。「リズム天国」のように、
 * **自分の 1打が すぐ 何かを 動かす** 手ごたえを つくるためです。
 * うまく なる 前から「打つのが たのしい」が 先に 来ると、
 * スキマ時間に もう1回 ひらいて もらえます。
 *
 * ■ 気を 散らさない
 * ここは 画面の 中で いちばん 目立っては いけない ところ です。
 * いちばん 目立つのは いつも **お題の 文字** です。そこで、
 *   ・大きさは 小さく、色は 少なく、キラキラは 出しません
 *   ・動きは 1打 0.2びょう 前後で すぐ もとに もどります
 *   ・お題の 文字と かさなる ところには 置きません
 * うるさければ「せってい → キャラクターを 出す」で 消せます。
 *
 * ■ 左右 こうごに うごく
 * 1打ごとに はねる むきを 左右で かえます。ずっと 同じ 動きだと
 * ただの 点滅に 見えますが、こうごに すると リズムに 見えます。
 *
 * ■ 「動きを へらす」端末
 * CSS の prefers-reduced-motion で アニメーションは 止まります。
 * その ときでも 色は かわるので、当たり・はずれは つたわります。
 */
(function (global) {
  'use strict';

  const state = { container: null, el: null, flip: false, timer: 0, moodTimer: 0 };

  /** ひよこの すがた。レベルの よび名（ひよこ タイパー）に そろえて います */
  const SVG = `
    <svg class="buddy-svg" viewBox="0 0 120 110" aria-hidden="true" focusable="false">
      <ellipse class="buddy-shadow" cx="60" cy="100" rx="30" ry="6"/>
      <g class="buddy-body">
        <path class="buddy-foot" d="M50 92v8M44 100h12M70 92v8M64 100h12"/>
        <ellipse class="buddy-belly" cx="60" cy="66" rx="30" ry="28"/>
        <path class="buddy-wing buddy-wing-l" d="M32 60q-12 6-10 18 10 2 16-8z"/>
        <path class="buddy-wing buddy-wing-r" d="M88 60q12 6 10 18-10 2-16-8z"/>
        <circle class="buddy-head" cx="60" cy="34" r="24"/>
        <path class="buddy-tuft" d="M60 10v-8M52 12l-4-6M68 12l4-6"/>
        <g class="buddy-face">
          <circle class="buddy-eye buddy-eye-l" cx="51" cy="32" r="3.4"/>
          <circle class="buddy-eye buddy-eye-r" cx="69" cy="32" r="3.4"/>
          <path class="buddy-eye-shut buddy-eye-l" d="M47 32l4 3 4-3"/>
          <path class="buddy-eye-shut buddy-eye-r" d="M65 32l4 3 4-3"/>
          <path class="buddy-beak" d="M60 38l-6 5 6 5 6-5z"/>
        </g>
      </g>
    </svg>`;

  /**
   * キャラクターを 出します。
   * @param {HTMLElement} container
   */
  function render(container) {
    if (!container) return;
    state.container = container;
    container.className = 'buddy';
    container.innerHTML = SVG;
    state.el = container.querySelector('.buddy-svg');
    state.flip = false;
  }

  /**
   * 打った ことを つたえます。
   * @param {string} kind 'hit' 正かい / 'miss' まちがい / 'combo' れんぞく / 'cheer' ひとまわり
   */
  function react(kind) {
    const el = state.el;
    if (!el) return;

    // ほめる うごきの とちゅうは、1打ごとの はねで 上書きしません。
    // 大きい うごきが すぐ 消えると、ごほうびに 見えなく なります
    if (state.moodTimer && (kind === 'hit' || kind === 'miss')) return;

    const classes = ['hop-a', 'hop-b', 'is-miss', 'is-combo', 'is-cheer'];
    classes.forEach(c => el.classList.remove(c));
    void el.getBoundingClientRect();     // いったん 消してから 付けなおして、続けて 打っても うごかします

    let cls = 'hop-a';
    let hold = 240;
    if (kind === 'miss') { cls = 'is-miss'; hold = 380; }
    else if (kind === 'combo') { cls = 'is-combo'; hold = 700; }
    else if (kind === 'cheer') { cls = 'is-cheer'; hold = 1100; }
    else { state.flip = !state.flip; cls = state.flip ? 'hop-a' : 'hop-b'; }

    el.classList.add(cls);

    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => { el.classList.remove(cls); state.timer = 0; }, hold);

    if (kind === 'combo' || kind === 'cheer' || kind === 'miss') {
      if (state.moodTimer) clearTimeout(state.moodTimer);
      state.moodTimer = setTimeout(() => { state.moodTimer = 0; }, hold);
    }
  }

  /** 画面を はなれる ときに タイマーを かたづけます */
  function stop() {
    if (state.timer) clearTimeout(state.timer);
    if (state.moodTimer) clearTimeout(state.moodTimer);
    state.timer = 0;
    state.moodTimer = 0;
  }

  global.Typa = global.Typa || {};
  global.Typa.Buddy = { render, react, stop };
})(window);
