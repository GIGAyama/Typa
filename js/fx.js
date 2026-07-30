/**
 * =====================================================================
 * fx.js — 画面の うごき（アニメーション）を まとめて うけもつ ところ
 * =====================================================================
 * ■ なぜ 1つの ファイルに まとめるのか
 * うごきの コードを 画面ごとに 書くと、「動きを へらす」設定を 入れわすれた
 * ところが かならず 出てきます。ここに まとめて おけば、止めるのも
 * 1か所で すみます。
 *
 * ■ うごきの きまり
 *   1. **お題の 文字を じゃまする うごきは つけません。**
 *      打つ 画面（data-screen="play"）では、この ファイルの 出しいれの
 *      うごきを つかいません。打ちながら 画面が うごくのは 最悪です。
 *   2. うごきは 0.2〜0.9びょう。長い うごきは 待ち時間に なります。
 *   3. ならんだ ものは すこしずつ ずらして 出します（さいだい 0.5びょう）。
 *      ずらしを 数に あわせて のばすと、下の ほうが いつまでも 出てきません。
 *   4. prefers-reduced-motion:reduce の 端末では、うごきを ぜんぶ とばして
 *      **さいごの すがた**を すぐ 出します（消すのでは ありません）。
 *
 * つかいかた
 *   T.FX.enter(view)              画面を 出した ときに 1回だけ
 *   T.FX.enter(el, { base: 0 })   中の 一部だけ 差しかえた とき
 *   T.FX.confetti({ x, y })       おいわいの ひらひら
 *   T.FX.pop(el)                  ぴょこんと はねる
 */
(function (global) {
  'use strict';

  const T = global.Typa = global.Typa || {};
  const doc = global.document;

  /** ならんだ ものを ずらす はば と、その 合計の 上限 */
  const STEP_MS = 42;
  const STEP_MAX_MS = 420;

  /** おいわいの 色。アプリの 色より あかるく して、はっきり お祝いに 見せます */
  const PARTY = ['#ffd166', '#06d6a0', '#4cc9f0', '#ff6b6b', '#b794ff', '#ffa94d', '#5ee7df'];

  function reduced() {
    try { return global.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  /** Web Animations が つかえるか（ふるい 端末では しずかに 何も しません） */
  const canAnimate = typeof Element !== 'undefined' && !!Element.prototype.animate;

  // ------------------------------------------------------------------
  // 出しいれ
  // ------------------------------------------------------------------

  /**
   * ならんだ ものを すこしずつ ずらして 出します。
   * @param {NodeList|Array} nodes
   * @param {number} base はじまりの まち時間（ms）
   * @returns {number} つぎに つかえる まち時間
   */
  function stagger(nodes, base) {
    let last = base;
    Array.prototype.forEach.call(nodes, (el, i) => {
      if (!el || el.nodeType !== 1) return;
      if (el.hasAttribute('hidden')) return;
      const delay = Math.min(base + i * STEP_MS, base + STEP_MAX_MS);
      el.classList.add('fx-rise');
      el.style.setProperty('--fx-d', delay + 'ms');
      last = Math.max(last, delay);
    });
    return last;
  }

  /** ならびの 中身（バッジ・タイル・行）にも ずらしを かけます */
  const INNER_LISTS = [
    // .menu-grid / .menu-col は「よこに ならべる」ための 入れもの です。
    // 入れものだけを 出すと 中の カードが いっしょに 出て しまうので、
    // その 中の ものにも ずらしを かけます
    '.menu-grid', '.menu-col', '.menu-list', '.course-list', '.stage-list', '.badge-grid',
    '.pool-grid', '.today', '.result-grid', '.tile-row', '.subtabs'
  ];

  /**
   * 画面（や その 一部）を 出します。
   * @param {Element} root
   * @param {{base?: number, self?: boolean}} [opt] self:true なら root じしんも 出します
   */
  function enter(root, opt) {
    if (!root) return;
    const o = opt || {};
    const base = o.base != null ? o.base : 0;

    if (!reduced()) {
      if (o.self) stagger([root], base);
      else stagger(root.children, base);
      INNER_LISTS.forEach(sel => {
        root.querySelectorAll(sel).forEach(list => stagger(list.children, base + 60));
      });
    }
    numbers(root);
    bars(root);
    rings(root);
  }

  /** 出しいれの あとしまつ。おなじ 要素を 2回 出しても かさならない ように します */
  function clear(root) {
    if (!root) return;
    root.querySelectorAll('.fx-rise').forEach(el => {
      el.classList.remove('fx-rise');
      el.style.removeProperty('--fx-d');
    });
  }

  /**
   * とんで いる ひらひらを すぐ かたづけます。
   * 画面を かえた あとも まえの 画面の おいわいが とび つづけると、
   * つぎの 画面の 中身に かぶって 読みにくく なります。
   */
  function clearLayer() {
    const box = doc.getElementById('fx-layer');
    if (box) box.innerHTML = '';
  }

  // ------------------------------------------------------------------
  // 数字が そだつ
  // ------------------------------------------------------------------

  /**
   * `data-count="123"` の ある ところを 0 から かぞえ上げます。
   * `data-dec="1"` で 小数の けたを 指定できます。
   *
   * かぞえ上げは「たくさん やった」ことを 目で 見せる ための ものです。
   * 0 の ときは うごかしません（0 が そだつ ように 見えるのは うそです）。
   */
  function numbers(root) {
    root.querySelectorAll('[data-count]').forEach(el => {
      const to = Number(el.dataset.count);
      const dec = Number(el.dataset.dec || 0);
      if (!isFinite(to)) return;
      const text = to.toFixed(dec);
      if (reduced() || to === 0 || !global.requestAnimationFrame) { el.textContent = text; return; }

      const dur = 620;
      const wait = Number(el.dataset.countDelay || 140);
      el.textContent = (0).toFixed(dec);
      const begin = () => {
        const start = performance.now();
        const tick = now => {
          const p = Math.min(1, (now - start) / dur);
          const e = 1 - Math.pow(1 - p, 3);          // さいごに ゆっくり 止まります
          el.textContent = (to * e).toFixed(dec);
          if (p < 1) requestAnimationFrame(tick);
          else el.textContent = text;
        };
        requestAnimationFrame(tick);
      };
      if (wait > 0) setTimeout(begin, wait); else begin();
    });
  }

  // ------------------------------------------------------------------
  // おびが のびる
  // ------------------------------------------------------------------

  /** `data-grow="62"`（％）の おびを 0 から のばします */
  function bars(root) {
    root.querySelectorAll('[data-grow]').forEach(el => {
      const pct = Math.max(0, Math.min(100, Number(el.dataset.grow) || 0));
      if (reduced() || !global.requestAnimationFrame) { el.style.width = pct + '%'; return; }
      el.style.width = '0%';
      requestAnimationFrame(() => requestAnimationFrame(() => { el.style.width = pct + '%'; }));
    });
  }

  /** `data-ring="0.62"` の わっかを 0 から まわします */
  function rings(root) {
    root.querySelectorAll('[data-ring]').forEach(el => {
      const r = Number(el.getAttribute('r')) || 0;
      const len = 2 * Math.PI * r;
      const ratio = Math.max(0, Math.min(1, Number(el.dataset.ring) || 0));
      el.style.strokeDasharray = len.toFixed(2);
      if (reduced() || !global.requestAnimationFrame) {
        el.style.strokeDashoffset = (len * (1 - ratio)).toFixed(2);
        return;
      }
      el.style.strokeDashoffset = len.toFixed(2);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = 'stroke-dashoffset .95s cubic-bezier(.2,.85,.3,1) .12s';
        el.style.strokeDashoffset = (len * (1 - ratio)).toFixed(2);
      }));
    });
  }

  // ------------------------------------------------------------------
  // おいわい
  // ------------------------------------------------------------------

  function layer() {
    let el = doc.getElementById('fx-layer');
    if (!el) {
      el = doc.createElement('div');
      el.id = 'fx-layer';
      el.className = 'fx-layer';
      el.setAttribute('aria-hidden', 'true');
      doc.body.appendChild(el);
    }
    return el;
  }

  /**
   * ひらひらを まきます。
   *
   * ■ 音は 出しません
   * 教室で 30台が いっせいに 音を 出すと、それだけで つかえなく なります。
   * よろこびは 目で つたえます。
   *
   * @param {{x?: number, y?: number, count?: number, power?: number}} [opt]
   */
  function confetti(opt) {
    if (reduced() || !canAnimate) return;
    const o = opt || {};
    const box = layer();
    const n = Math.max(6, Math.min(160, o.count || 84));
    const power = o.power || 1;
    const x = o.x != null ? o.x : global.innerWidth / 2;
    const y = o.y != null ? o.y : global.innerHeight * 0.3;

    for (let i = 0; i < n; i++) {
      const p = doc.createElement('span');
      p.className = 'fx-bit';
      const size = 6 + Math.random() * 8;
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.width = size + 'px';
      p.style.height = (size * (0.4 + Math.random() * 0.8)) + 'px';
      p.style.background = PARTY[i % PARTY.length];
      if (i % 3 === 0) p.style.borderRadius = '50%';
      box.appendChild(p);

      const angle = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const dist = (110 + Math.random() * 230) * power;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist * 0.62 - 60 * power;
      const fall = 260 + Math.random() * 320;
      const spin = (Math.random() * 900 - 450) + 'deg';
      const dur = 1100 + Math.random() * 900;

      const anim = p.animate([
        { transform: 'translate3d(0,0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate3d(${dx * 0.72}px, ${dy}px, 0) rotate(${spin})`, opacity: 1, offset: 0.42 },
        { transform: `translate3d(${dx}px, ${dy + fall}px, 0) rotate(${spin})`, opacity: 0 }
      ], { duration: dur, easing: 'cubic-bezier(.18,.75,.3,1)', fill: 'forwards' });
      anim.onfinish = () => { if (p.parentNode) p.parentNode.removeChild(p); };
      // うごきが 止まって いる 端末でも のこらない ように 保険を かけます
      setTimeout(() => { if (p.parentNode) p.parentNode.removeChild(p); }, dur + 400);
    }
  }

  /** ある 要素の まん中から ひらひらを まきます */
  function confettiAt(el, opt) {
    if (!el) { confetti(opt); return; }
    const r = el.getBoundingClientRect();
    confetti(Object.assign({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, opt || {}));
  }

  /** キラッと ひかる わっか（新記録などの「うれしい」しるし） */
  function ripple(el) {
    if (!el || reduced() || !canAnimate) return;
    const r = el.getBoundingClientRect();
    const ring = doc.createElement('span');
    ring.className = 'fx-ripple';
    ring.style.left = (r.left + r.width / 2) + 'px';
    ring.style.top = (r.top + r.height / 2) + 'px';
    layer().appendChild(ring);
    const anim = ring.animate([
      { transform: 'translate(-50%,-50%) scale(.2)', opacity: .85 },
      { transform: 'translate(-50%,-50%) scale(2.4)', opacity: 0 }
    ], { duration: 720, easing: 'cubic-bezier(.2,.8,.3,1)' });
    anim.onfinish = () => { if (ring.parentNode) ring.parentNode.removeChild(ring); };
  }

  /** ぴょこんと はねる（もらった もの・できた ものに つけます） */
  function pop(el, delay) {
    if (!el || reduced() || !canAnimate) return;
    el.animate([
      { transform: 'scale(.4)', opacity: 0 },
      { transform: 'scale(1.18)', opacity: 1, offset: .62 },
      { transform: 'scale(1)', opacity: 1 }
    ], { duration: 520, delay: delay || 0, easing: 'cubic-bezier(.2,1.5,.4,1)', fill: 'backwards' });
  }

  /** ならんだ ものを じゅんばんに ぴょこんと させます（★など） */
  function popAll(nodes, step) {
    Array.prototype.forEach.call(nodes || [], (el, i) => pop(el, i * (step || 130)));
  }

  T.FX = {
    reduced, enter, clear, clearLayer, stagger, numbers, bars, rings,
    confetti, confettiAt, ripple, pop, popAll
  };
})(window);
