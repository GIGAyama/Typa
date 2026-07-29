/**
 * =====================================================================
 * nav.js — 画面の 階層と「もどる」操作
 * =====================================================================
 * Typa は 画面を はっきりした 階層に します。
 *
 *   ホーム
 *   れんしゅう → コース → ステージ → けっか
 *   きろく
 *   せってい → つかいかた
 *
 * 「もどる」は つぎの 3つが すべて **同じ 1つの 動き** に なります。
 *   1. 画面下の ナビゲーションバーの「もどる」を タップ
 *   2. 画面の 左右の はしから 中央へ スワイプ
 *   3. 端末や ブラウザの「戻る」（Android の 戻る、iOS の はしスワイプ、Alt+←）
 *
 * ■ アプリが とじたり、ブラウザだけ 先に もどったり しないように する
 * ブラウザの 戻るは、ふつうに つかうと **アプリから 出て しまいます**。
 * そこで「見えない 履歴を 1つ 足しておき、戻られたら すぐ 足しなおす」
 * という 形にして、戻る操作を いつも アプリの 中で 受け取ります。
 * こうすると、階層が いちばん 上でも ページから 出て しまいません。
 *
 * また、同じ 1回の 操作が バーの タップと 端末の 戻るの 両方から
 * 二重に 届くことが あるため、みじかい 時間の 重なりは 1回に まとめます。
 */
(function (global) {
  'use strict';

  const BACK_DEBOUNCE_MS = 400;   // この あいだに きた 2回目の「もどる」は 同じ 操作と みなします
  const EDGE_PX = 28;             // 画面の はしと みなす はば
  const SWIPE_MIN = 60;           // 「もどる」と 判定する よこの うごき

  /** タブ（いちばん 上の 階層）。ここでは 下部バーの ならびも 決めます */
  const TABS = [
    { id: 'home', label: 'ホーム', icon: 'home' },
    { id: 'courses', label: 'れんしゅう', icon: 'keyboard' },
    { id: 'records', label: 'きろく', icon: 'chart' },
    { id: 'settings', label: 'せってい', icon: 'gear' }
  ];

  const state = {
    stack: [],          // [{ screen, params }] いちばん うしろが いま出ている画面
    tab: 'home',
    lastBackAt: 0,
    handlers: {},       // screen → { render(params), leave(params) }
    onChange: null,     // 画面が かわったときに よばれます
    guardArmed: false
  };

  function current() { return state.stack[state.stack.length - 1] || null; }
  function canGoBack() { return state.stack.length > 1 || state.tab !== 'home'; }

  /** 画面の 中身を 描く 担当を 登録します */
  function register(screen, handler) { state.handlers[screen] = handler; }

  function emit() {
    if (typeof state.onChange === 'function') state.onChange(current(), { canGoBack: canGoBack(), tab: state.tab });
  }

  /** いまの 画面を 描きなおします */
  function render() {
    const cur = current();
    if (!cur) return;
    const handler = state.handlers[cur.screen];
    if (handler && typeof handler.render === 'function') handler.render(cur.params || {});
    emit();
  }

  /**
   * 1つ 下の 階層へ すすみます。
   * @param {string} screen 画面名
   * @param {Object} [params]
   */
  function go(screen, params) {
    const cur = current();
    if (cur && !leaveOk(cur)) return false;
    state.stack.push({ screen, params: params || {} });
    render();
    return true;
  }

  /** タブを えらんだとき。その タブの いちばん 上の 階層に もどします */
  function selectTab(tabId) {
    const cur = current();
    if (cur && cur.screen === tabId && state.stack.length === 1) return;
    if (cur && !leaveOk(cur)) return;
    state.tab = tabId;
    state.stack = [{ screen: tabId, params: {} }];
    render();
  }

  /** 画面を はなれてよいか（練習中は「やめますか？」を 出します） */
  function leaveOk(entry) {
    const handler = state.handlers[entry.screen];
    if (handler && typeof handler.leave === 'function') return handler.leave(entry.params || {}) !== false;
    return true;
  }

  /**
   * 1つ 前の 階層へ もどります。
   * いちばん 上の 階層に いるときは、ホームタブへ もどります。
   * ホームの いちばん 上では 何も しません（＝アプリから 出ません）。
   */
  function back(source) {
    const now = Date.now();
    if (now - state.lastBackAt < BACK_DEBOUNCE_MS) return;
    state.lastBackAt = now;

    const cur = current();
    if (cur && !leaveOk(cur)) return;

    if (state.stack.length > 1) {
      state.stack.pop();
      render();
      return;
    }
    if (state.tab !== 'home') {
      state.tab = 'home';
      state.stack = [{ screen: 'home', params: {} }];
      render();
      return;
    }
    // ここが いちばん 上。もどる先が ないので、画面を ゆらして 知らせます
    if (typeof state.onRootBack === 'function') state.onRootBack(source);
  }

  /** いまの 画面を すてて、べつの 画面に おきかえます（けっか画面 → もう1かい など） */
  function replace(screen, params) {
    if (state.stack.length > 0) state.stack.pop();
    state.stack.push({ screen, params: params || {} });
    render();
  }

  // ------------------------------------------------------------------
  // ブラウザ／端末の 戻る を 受け取る
  // ------------------------------------------------------------------

  function armGuard() {
    try {
      history.pushState({ typa: 'guard', t: Date.now() }, '');
      state.guardArmed = true;
    } catch (e) { state.guardArmed = false; }
  }

  function setupHistoryGuard() {
    try { history.replaceState({ typa: 'root' }, ''); } catch (e) { /* つづけます */ }
    armGuard();
    global.addEventListener('popstate', () => {
      // 見えない 履歴が 1つ へったので、すぐに 足しなおします。
      // これで つぎの「戻る」も また ここで 受け取れます
      armGuard();
      back('history');
    });
  }

  // ------------------------------------------------------------------
  // 画面の はしからの スワイプ
  // ------------------------------------------------------------------

  function setupEdgeSwipe(root, indicator) {
    let tracking = false, decided = false, startX = 0, startY = 0, fromLeft = false;

    root.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      const x = e.touches[0].clientX;
      const width = global.innerWidth;
      fromLeft = x <= EDGE_PX;
      const fromRight = x >= width - EDGE_PX;
      tracking = fromLeft || fromRight;
      decided = false;
      startX = x;
      startY = e.touches[0].clientY;
    }, { passive: true });

    root.addEventListener('touchmove', e => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      const inward = fromLeft ? dx : -dx;
      if (!decided) {
        if (Math.abs(dy) > Math.abs(dx)) { tracking = false; return; }   // たての スクロールは じゃましません
        if (inward < 12) return;
        decided = true;
      }
      // 「どれくらい 引いたか」を 見せます（とちゅうで 手を はなせば もどりません）
      if (indicator) {
        indicator.classList.add('is-active');
        indicator.classList.toggle('from-right', !fromLeft);
        indicator.style.setProperty('--pull', Math.min(1, inward / SWIPE_MIN).toFixed(2));
      }
      if (e.cancelable) e.preventDefault();   // ブラウザの はしスワイプが 同時に 動くのを 止めます
    }, { passive: false });

    const finish = () => {
      if (indicator) { indicator.classList.remove('is-active'); indicator.style.removeProperty('--pull'); }
      tracking = false;
      decided = false;
    };

    root.addEventListener('touchend', e => {
      if (tracking && decided) {
        const touch = e.changedTouches[0];
        const dx = touch.clientX - startX;
        const inward = fromLeft ? dx : -dx;
        if (inward >= SWIPE_MIN) back('swipe');
      }
      finish();
    }, { passive: true });
    root.addEventListener('touchcancel', finish, { passive: true });
  }

  /**
   * ナビゲーションを うごかしはじめます。
   * @param {Object} opt { root, indicator, onChange, onRootBack, start }
   */
  function init(opt) {
    state.onChange = opt.onChange || null;
    state.onRootBack = opt.onRootBack || null;
    state.tab = opt.start || 'home';
    state.stack = [{ screen: state.tab, params: {} }];
    setupHistoryGuard();
    if (opt.root) setupEdgeSwipe(opt.root, opt.indicator || null);
    render();
  }

  global.Typa = global.Typa || {};
  global.Typa.Nav = {
    TABS, init, register, go, back, replace, selectTab, render, current, canGoBack,
    get tab() { return state.tab; }
  };
})(window);
