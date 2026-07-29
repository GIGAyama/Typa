/**
 * =====================================================================
 * keyboard.js — 画面の キーボード
 * =====================================================================
 * 手もとの キーボードと 同じ 形を 画面に 出し、
 * 「つぎに どのキーを、どの指で 押すか」を 見せます。
 *
 * ■ 見た目を 本物に そろえる
 * 日本語配列（JIS）の Enter は たてに 2段ぶんの 形を して います。
 * ここが ちがうと、画面と 手もとを 見くらべた ときに まよいます。
 * そこで キーボードを CSS グリッド（よこ60マス）で 組み、
 * Enter は 2行ぶんを つかって 本物と 同じ 形に します。
 *
 * ■ 色だけに たよらない
 * 指は 色で 分けますが、色の ちがいが 見えにくい 子も います。
 * 「つぎに 押すキー」は 色だけでなく、太い わく・矢じるし・
 * 画面の 上の ことば（例:「みぎの ひとさしゆび」）でも つたえます。
 *
 * ■ キーボードが ない 端末でも つかえる
 * タブレットや スマートフォンでは、画面の キーを タップすると
 * その 文字を 打ったことに なります（onTap）。
 */
(function (global) {
  'use strict';

  const Layout = global.Typa.Layout;

  const state = {
    container: null,
    layoutId: 'jis',
    keyEls: {},       // code → 要素
    onTap: null,
    fingerGuide: true,
    shiftSticky: false
  };

  /** キー1つの 中身を 組み立てます */
  function keyHtml(key, layoutId) {
    const finger = Layout.fingerOf(key.code);
    const isHome = Layout.HOME_KEYS.indexOf(key.code) >= 0;
    const isBump = Layout.BUMP_KEYS.indexOf(key.code) >= 0;
    const classes = ['kb-key'];
    if (key.top) classes.push('is-top');
    if (isHome) classes.push('is-home');
    if (isBump) classes.push('is-bump');
    if (key.label) classes.push('is-named');
    if (finger) classes.push(`f-${finger.id}`);

    let inner = '';
    if (key.label) {
      inner = `<span class="kb-name">${key.label}</span>`;
    } else {
      const main = key.lo === ' ' ? '' : (key.lo || '');
      inner = `<span class="kb-main">${escapeHtml(main.toUpperCase())}</span>`;
      if (key.up && key.up !== key.lo.toUpperCase()) {
        inner = `<span class="kb-up">${escapeHtml(key.up)}</span>` + inner;
      }
      if (layoutId === 'jis' && key.kana) {
        inner += `<span class="kb-kana">${escapeHtml(key.kana)}</span>`;
      }
    }
    return { classes, inner, finger };
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * キーボードを 描きます。
   * @param {HTMLElement} container
   * @param {Object} opt { layoutId, fingerGuide, onTap }
   */
  function render(container, opt) {
    opt = opt || {};
    state.container = container;
    state.layoutId = opt.layoutId || state.layoutId;
    state.fingerGuide = opt.fingerGuide !== false;
    state.onTap = opt.onTap !== undefined ? opt.onTap : state.onTap;
    state.keyEls = {};

    const rows = (Layout.LAYOUTS[state.layoutId] || Layout.LAYOUTS.jis).rows;
    container.className = `kb${state.fingerGuide ? ' show-finger' : ''}`;
    container.innerHTML = '';

    rows.forEach((row, rowIndex) => {
      // ふつうの 行は よこ15マスぶん。Chromebook の いちばん上の 行だけ
      // キーの 数が ちがうので、はば いっぱいに 引きのばします
      const total = row.reduce((sum, k) => sum + k.w, 0);
      const scale = row[0] && row[0].top ? (60 / total) : 4;
      let col = 1;
      row.forEach(key => {
        const span = Math.max(2, Math.round(key.w * scale));
        const { classes, inner } = keyHtml(key, state.layoutId);
        const el = document.createElement('div');
        el.className = classes.join(' ');
        el.style.gridColumn = `${col} / span ${span}`;
        el.style.gridRow = `${rowIndex + 1} / span ${key.h || 1}`;
        const finger = Layout.fingerOf(key.code);
        if (finger) el.style.setProperty('--finger', finger.color);
        el.dataset.code = key.code;
        el.innerHTML = inner;
        container.appendChild(el);
        state.keyEls[key.code] = el;
        col += span;
      });
    });

    bindTap(container);
  }

  /** 画面の キーを タップして 打てるように します（キーボードの ない 端末むけ） */
  function bindTap(container) {
    container.addEventListener('pointerdown', e => {
      const el = e.target.closest('.kb-key');
      if (!el || !state.onTap) return;
      const code = el.dataset.code;
      const key = findKeyByCode(code);
      if (!key || key.top) return;
      e.preventDefault();
      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        state.shiftSticky = !state.shiftSticky;
        container.classList.toggle('shift-on', state.shiftSticky);
        return;
      }
      const ch = state.shiftSticky && key.up ? key.up : key.lo;
      if (state.shiftSticky) {
        state.shiftSticky = false;
        container.classList.remove('shift-on');
      }
      flash(code, true);
      state.onTap({ code, char: ch });
    });
  }

  function findKeyByCode(code) {
    const rows = (Layout.LAYOUTS[state.layoutId] || Layout.LAYOUTS.jis).rows;
    for (const row of rows) for (const key of row) if (key.code === code) return key;
    return null;
  }

  /**
   * つぎに 押す キーを 光らせます。
   * @param {string[]} codes キーの 位置
   * @param {boolean} [shift] Shift も いっしょに 押すか
   */
  function highlight(codes, shift) {
    Object.keys(state.keyEls).forEach(code => {
      state.keyEls[code].classList.remove('is-next', 'is-next-shift');
    });
    (codes || []).forEach(code => {
      const el = state.keyEls[code];
      if (el) el.classList.add('is-next');
    });
    if (shift) {
      ['ShiftLeft', 'ShiftRight'].forEach(code => {
        const el = state.keyEls[code];
        if (el) el.classList.add('is-next-shift');
      });
    }
  }

  /** 押した ときの 手ごたえ（正かい／まちがい で 色が かわります） */
  function flash(code, ok) {
    const el = state.keyEls[code];
    if (!el) return;
    const cls = ok ? 'hit-ok' : 'hit-miss';
    el.classList.remove('hit-ok', 'hit-miss');
    // いったん 描きなおしてから 付けなおすと、続けて 同じキーを 押しても 光ります
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 220);
  }

  /** 指の 色分けの オン・オフ */
  function setFingerGuide(on) {
    state.fingerGuide = !!on;
    if (state.container) state.container.classList.toggle('show-finger', state.fingerGuide);
  }

  /**
   * にがてな キーを 色の こさで しめします（きろく画面の ヒートマップ）。
   *
   * 「どの指が にがてか」は ことばで わかりますが、**キーボードの どこか** は
   * 図で 見るのが いちばん はやいので、本物と 同じ ならびの 上に かさねます。
   *
   * @param {Object} byChar 打つはずだった 文字 → ミスの 数（スペースは 'space'）
   * @returns {number} いちばん 多かった ミスの 数（0 なら 何も 出て いません）
   */
  function heat(byChar) {
    let max = 0;
    Object.keys(byChar || {}).forEach(k => { max = Math.max(max, byChar[k]); });

    Object.keys(state.keyEls).forEach(code => {
      const el = state.keyEls[code];
      el.classList.remove('is-heat');
      el.style.removeProperty('--heat');
      el.removeAttribute('title');
    });
    if (max <= 0) return 0;

    const byCode = {};
    Object.keys(byChar).forEach(ch => {
      const found = Layout.findKey(state.layoutId, ch === 'space' ? ' ' : ch);
      if (!found) return;
      byCode[found.key.code] = (byCode[found.key.code] || 0) + byChar[ch];
    });
    Object.keys(byCode).forEach(code => {
      const el = state.keyEls[code];
      if (!el) return;
      el.classList.add('is-heat');
      el.style.setProperty('--heat', (byCode[code] / max).toFixed(2));
      el.setAttribute('title', `ミス ${Math.round(byCode[code])} かい`);
    });
    return max;
  }

  global.Typa = global.Typa || {};
  global.Typa.Keyboard = { render, highlight, flash, heat, setFingerGuide, get layoutId() { return state.layoutId; } };
})(window);
