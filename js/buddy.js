/**
 * =====================================================================
 * buddy.js — いっしょに はたらく 2D/3Dイラストちょう ちびキャラ
 * =====================================================================
 * 打つと キャラクターが はたらきます。「リズム天国」のように、
 * **自分の 1打が すぐ 何かを 動かす** 手ごたえを つくるためです。
 * うまく なる 前から「打つのが たのしい」が 先に 来ると、
 * スキマ時間に もう1回 ひらいて もらえます。
 *
 *   1打 正しく 打てた     → tap()    しごとの うごきを 1回
 *   お題を 1つ 打ちきった → done()   できあがった ものが つみ上がる
 *   打ちまちがえた        → miss()   しごとを しくじって あわてる
 *   れんぞく 10だごと     → combo()  よろこぶ（山は ふえません）
 *   ひとまわり できた     → cheer()  つみ上げた ものを おさめて 大よろこび
 *
 * しごとは office（かいしゃいん）/ chef（シェフ）/ carpenter（大工）。
 * 絵の 素材や 外部CDNは 1つも つかわず、ぜんぶ この ファイルの 中で
 * グラデーション・立体影・ハイライトを 重ねた 2D/3D調 SVG を 組みます。
 * 重い feGaussianBlur フィルタは 動かさない 設計なので、学校の
 * Chromebook でも 連打中 60fps で なめらかに 動きます。
 *
 * だれが 出るかは、きほん **くじ引き**です（せっていの「おまかせ」）。
 * ドリルが ひとまわり 終わる ごとに 引きなおすので、つづけて 打つほど
 * いろいろな しごとに 会えます（reroll）。じぶんで 決めたい 子は
 * せっていで しごとを えらべます。
 *
 * ---------------------------------------------------------------------
 * ■ なめらかに 動かすために していること
 *
 * 速く 打つ 子は 1びょうに 5〜8回 ここを 呼びます。ふつうに 作ると
 * **前の うごきが 途中で 切られて**、カクカクした 点滅に 見えます。
 * そこで 4つの ことを して います。
 *
 * 1. **うごきごとに べつの <g> を もつ**
 *    息づかい / よろこび / かたむき / うで / あたま / ぼうし・かざり を
 *    それぞれ べつの グループに わけ、1つの グループに 2つの うごきを
 *    かさねません。取りあいが 起きないので、切りかえで とびません。
 *
 * 2. **composite: 'add'（足しあわせ）**
 *    1打の うごきを「いまの すがたに 足す」形で 動かします。
 *    前の うごきの 途中でも 打ち消さず、**2つが 足されて つながります**。
 *    はじめと おわりを 0（scale は 1）に して あるので、何回 かさねても
 *    もとの すがたから ずれません。
 *
 * 3. **待機の うごきは 止めない**
 *    息づかい・ゆれ・まばたき・ゆげ・ほのおは Infinity で 回しつづけ、
 *    一度も 止めません。1打の うごきは その 上に 足されるだけ なので、
 *    打っても 打たなくても 生きて いるように 見えます。
 *
 * 4. **class の 付けはずしを つかわない**
 *    CSS の class で 動かすと、同じ class を つけ直す ために
 *    いったん 消して 描きなおす（リフロー）ことに なり、そこで 1こま とびます。
 *    Web Animations（el.animate）は 何本でも かさねられるので、
 *    その 細工が いりません。
 *
 * ■ 気を 散らさない
 * いちばん 目立って よいのは、いつも **お題の 文字**です。そこで
 *   ・大きさは ひかえめ。お題の 文字と かさなる ところには 置きません
 *   ・1打の うごきは 0.2〜0.3びょうほど。すぐ もとに もどります
 *   ・「動きを へらす」端末では うごきを 止め、**顔だけ かえます**
 *     （当たり・はずれは 形で つたわります）
 * うるさければ「せってい → キャラクターを 出す」で 消せます。
 */
(function (global) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  /** 「動きを へらす」端末か。えらんだ その場で 変わるので 毎回 見ます */
  function reduced() {
    try {
      return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  // ------------------------------------------------------------------
  // SVG を 組む 小道具
  // ------------------------------------------------------------------

  /** SVG の 要素を 1つ つくって 親に つけます */
  function S(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(k => {
      if (attrs[k] !== null && attrs[k] !== undefined) el.setAttribute(k, String(attrs[k]));
    });
    if (parent) parent.appendChild(el);
    return el;
  }

  /** <linearGradient> を defs に 足します */
  function linGrad(defs, id, x1, y1, x2, y2, stops) {
    const g = S('linearGradient', { id, x1, y1, x2, y2 }, defs);
    stops.forEach(([offset, color, opacity]) => {
      const a = { offset, 'stop-color': color };
      if (opacity !== undefined) a['stop-opacity'] = opacity;
      S('stop', a, g);
    });
    return g;
  }

  /** <radialGradient> を defs に 足します */
  function radGrad(defs, id, cx, cy, r, stops, fx, fy) {
    const attrs = { id, cx, cy, r };
    if (fx !== undefined) attrs.fx = fx;
    if (fy !== undefined) attrs.fy = fy;
    const g = S('radialGradient', attrs, defs);
    stops.forEach(([offset, color, opacity]) => {
      const a = { offset, 'stop-color': color };
      if (opacity !== undefined) a['stop-opacity'] = opacity;
      S('stop', a, g);
    });
    return g;
  }

  /**
   * まわる 中心を SVG の ざひょうで 決めます。
   * transform-box: view-box を つけないと、ブラウザは
   * **その 要素の かたまりの まんなか** を 中心に して しまいます。
   */
  function pivot(el, x, y) {
    el.style.transformBox = 'view-box';
    el.style.transformOrigin = `${x}px ${y}px`;
    el.style.willChange = 'transform';
    return el;
  }

  /**
   * かたち じたいを 中心に して 大きさ・かたむきを かえる ための したく。
   * fill-box は **その かたちの わく** が もとに なるので、
   * どこに あっても その場で 大きく なります。
   *
   * @param {SVGElement} el
   * @param {string} [origin] 'center'（きほん）/ 'bottom' … 下を 支点に する
   */
  function fitPivot(el, origin) {
    el.style.transformBox = 'fill-box';
    el.style.transformOrigin = origin === 'bottom' ? '50% 100%' : '50% 50%';
    return el;
  }

  /** うごきを 1本 走らせます。「動きを へらす」ときは 何も しません */
  function run(el, frames, opt) {
    if (!el || reduced() || typeof el.animate !== 'function') return null;
    try { return el.animate(frames, opt); } catch (e) { return null; }
  }

  /** 出して、終わったら 消える もの（キラキラ・あせ・けむり・かみふぶき） */
  function once(parent, el, frames, opt) {
    if (reduced() || !parent) return;
    parent.appendChild(el);
    const a = run(el, frames, opt);
    if (!a) { el.remove(); return; }
    const bye = () => { if (el.parentNode) el.parentNode.removeChild(el); };
    a.onfinish = bye;
    a.oncancel = bye;
  }

  function rand(a, b) { return Math.random() * (b - a) + a; }

  /** はねる ときの ばねの ような 曲がりかた（もどりで すこし 行きすぎます） */
  const SPRING = 'cubic-bezier(.22,1.25,.36,1)';
  const OUT = 'cubic-bezier(.22,1,.36,1)';
  const SNAP = 'cubic-bezier(.34,1.35,.5,1)';

  let renderUid = 0;

  // ------------------------------------------------------------------
  // 共通の 立体マテリアル（グラデーション）を defs に 組みます
  // ------------------------------------------------------------------

  function buildSharedDefs(defs, id, p) {
    // 背後からの やわらかい スタジオ光（ライト・ダーク両テーマで 自然に キャラを 浮き立たせます）
    radGrad(defs, id('aura'), '50%', '50%', '50%', [
      ['0%', '#ffffff', .18],
      ['42%', '#d8ebff', .07],
      ['78%', '#d8ebff', .015],
      ['100%', '#d8ebff', 0]
    ]);
    linGrad(defs, id('beam'), '0%', '0%', '100%', '100%', [
      ['0%', '#ffffff', .13],
      ['50%', '#ffffff', .035],
      ['100%', '#ffffff', 0]
    ]);

    // 3D球面のような やわらかい はだ色（左上に キーライト、右下に やわらかい 影）
    radGrad(defs, id('skin'), '38%', '30%', '68%', [
      ['0%', '#fff4e9'],
      ['42%', p.skin || '#ffdcba'],
      ['78%', '#f3be96'],
      ['100%', '#e09d72']
    ], '34%', '26%');

    // 手（まるい 3D 球体）
    radGrad(defs, id('hand'), '34%', '26%', '70%', [
      ['0%', '#fff6ec'],
      ['46%', p.skin || '#ffdcba'],
      ['84%', '#efb68c'],
      ['100%', '#dc976c']
    ]);

    // みみの 内がわの 影
    linGrad(defs, id('earIn'), '0%', '0%', '100%', '100%', [
      ['0%', '#e7a47e', .75],
      ['100%', '#f6c7a8', .35]
    ]);

    // ほっぺの すけ感チーク（ふちが すっと とける）
    radGrad(defs, id('blush'), '50%', '50%', '50%', [
      ['0%', '#ff7888', .56],
      ['58%', '#ff95a1', .22],
      ['100%', '#ff95a1', 0]
    ]);

    // 宝石のような つやの ある ひとみ
    linGrad(defs, id('eye'), '0%', '0%', '0%', '100%', [
      ['0%', '#1d2136'],
      ['55%', '#323a5c'],
      ['100%', '#556599']
    ]);

    // 口の なか（立体感の ある あたたかい 影）
    linGrad(defs, id('mouthIn'), '0%', '0%', '0%', '100%', [
      ['0%', '#822735'],
      ['100%', '#b94151']
    ]);

    // かみの毛（ジョブごとの 立体グラデーション）
    linGrad(defs, id('hair'), '18%', '0%', '84%', '100%', [
      ['0%', p.hairHi],
      ['48%', p.hair],
      ['100%', p.hairLo]
    ]);
    linGrad(defs, id('hairBack'), '0%', '0%', '0%', '100%', [
      ['0%', p.hair],
      ['100%', p.hairLo]
    ]);

    // ふく（円筒の 立体感：左に 明るみ、右に 影）
    linGrad(defs, id('cloth'), '12%', '10%', '92%', '95%', [
      ['0%', p.clothHi],
      ['45%', p.cloth],
      ['100%', p.clothLo]
    ]);
    // そで（まるみの ある 光沢）
    linGrad(defs, id('sleeve'), '0%', '15%', '100%', '85%', [
      ['0%', p.sleeveHi || p.clothHi],
      ['52%', p.sleeve || p.cloth],
      ['100%', p.sleeveLo || p.clothLo]
    ]);
    // えり・ネクタイ・スカーフなどの アクセント
    if (p.accent) {
      linGrad(defs, id('accent'), '0%', '0%', '100%', '100%', [
        ['0%', p.accentHi || p.accent],
        ['55%', p.accent],
        ['100%', p.accentLo || p.accent]
      ]);
    }

    // 金属・セラミックの 共通マテリアル
    linGrad(defs, id('metal'), '0%', '0%', '100%', '100%', [
      ['0%', '#f4f7fb'],
      ['38%', '#c3cddb'],
      ['74%', '#8490a3'],
      ['100%', '#b9c4d4']
    ]);
    linGrad(defs, id('metalDark'), '0%', '0%', '100%', '100%', [
      ['0%', '#687182'],
      ['45%', '#414957'],
      ['100%', '#282e38']
    ]);
    linGrad(defs, id('ceramic'), '15%', '0%', '85%', '100%', [
      ['0%', '#ffffff'],
      ['58%', '#f1f5fb'],
      ['100%', '#d5dfec']
    ]);
    linGrad(defs, id('gold'), '0%', '0%', '100%', '100%', [
      ['0%', '#fff4b8'],
      ['48%', '#ffd15c'],
      ['100%', '#df9720']
    ]);

    // ゆか・つくえ上の 接地影
    radGrad(defs, id('shadow'), '50%', '50%', '50%', [
      ['0%', '#152236', .24],
      ['65%', '#152236', .10],
      ['100%', '#152236', 0]
    ]);
  }

  // ------------------------------------------------------------------
  // からだ（2D/3Dイラスト調の ちびキャラ造形）
  // ------------------------------------------------------------------

  const HEAD_X = 142, HEAD_Y = 94;
  const SH_L = { x: 112, y: 132 }, SH_R = { x: 172, y: 132 };
  const ARM_LEN = 33;

  /**
   * 立体感のある ちびキャラの からだを 組みます。
   * かえってくる ものは、それぞれ **1つの うごき専用**の グループです。
   */
  function buildBody(parent, ctx, job) {
    const p = job.palette;
    const u = ctx.url;
    const armBase = job.armBase || { l: 14, r: -14 };

    // 接地かげ（ジャンプ時に すぼむ 専用の グループ）
    const groundShadow = pivot(S('ellipse', {
      cx: HEAD_X, cy: 172, rx: 46, ry: 8, fill: u('shadow')
    }, parent), HEAD_X, 172);

    // 息づかい（ずっと）→ よろこび・おどろき（1回）→ 打つ かたむき（足しあわせ）
    const breath = pivot(S('g', { class: 'bd-breath' }, parent), HEAD_X, 172);
    const react = pivot(S('g', { class: 'bd-react' }, breath), HEAD_X, 172);
    const lean = pivot(S('g', { class: 'bd-lean' }, react), HEAD_X, 172);

    // うしろ髪（みみ・くびの うしろに まわって 立体感を 出します）
    const backHair = S('g', {}, lean);
    if (job.drawBackHair) {
      job.drawBackHair(backHair, ctx, HEAD_X, HEAD_Y);
    } else {
      S('ellipse', { cx: HEAD_X, cy: HEAD_Y + 4, rx: 38, ry: 33, fill: u('hairBack') }, backHair);
    }

    // からだ（丸みのある ベル型の 3D フォルム・なだらかな肩ライン）
    const torso = S('g', {}, lean);
    S('path', {
      d: `M${HEAD_X - 31} 131 C${HEAD_X - 30} 118, ${HEAD_X + 30} 118, ${HEAD_X + 31} 131 L${HEAD_X + 35} 176 C${HEAD_X + 35} 182, ${HEAD_X - 35} 182, ${HEAD_X - 35} 176 Z`,
      fill: u('cloth'), stroke: p.clothEdge || 'rgba(30,45,70,.16)', 'stroke-width': 1
    }, torso);
    // 左かたからの リムハイライト（立体感の 決め手）
    S('path', {
      d: `M${HEAD_X - 27} 131 C${HEAD_X - 28} 145, ${HEAD_X - 29} 160, ${HEAD_X - 31} 171`,
      fill: 'none', stroke: '#ffffff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: .34
    }, torso);
    // 右わきの 落ち影
    S('path', {
      d: `M${HEAD_X + 26} 130 C${HEAD_X + 28} 146, ${HEAD_X + 30} 160, ${HEAD_X + 32} 174`,
      fill: 'none', stroke: '#102036', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: .10
    }, torso);

    // しごとごとの ふくそう（えり・ネクタイ・エプロン・ボタン等）
    if (job.drawOutfit) job.drawOutfit(torso, ctx, HEAD_X);

    // くび と あご下の アンビエントオクルージョン影（頭が 前に 浮き出ます）
    S('rect', { x: HEAD_X - 9, y: 117, width: 18, height: 14, rx: 7, fill: '#e9ad85' }, lean);
    S('ellipse', { cx: HEAD_X, cy: 125, rx: 14, ry: 5.5, fill: '#8b4d2f', opacity: .22 }, lean);

    /**
     * うで。外がわ（アニメーション用）と 内がわ（基本角度）を 分け、
     * さらに 手くび位置に 水平基準の toolHost を 持たせます。
     * これにより 道具を 握ったまま 息づかい・打鍵・ジャンプしても 絶対に ずれません。
     */
    function buildArm(sh, baseDeg, mirror) {
      const outer = pivot(S('g', {}, lean), sh.x, sh.y);
      const inner = S('g', { transform: `rotate(${baseDeg} ${sh.x} ${sh.y})` }, outer);

      // かた〜そで（肩に なじむ 丸み 3D スリーブ）
      S('rect', {
        x: sh.x - 8, y: sh.y - 3.5, width: 16, height: ARM_LEN + 2, rx: 8,
        fill: u('sleeve'), stroke: p.clothEdge || 'rgba(30,45,70,.12)', 'stroke-width': .75
      }, inner);
      // そでの ハイライト筋
      S('path', {
        d: `M${sh.x - 3.8} ${sh.y + 3} L${sh.x - 3.8} ${sh.y + ARM_LEN - 7}`,
        stroke: '#fff', 'stroke-width': 2.2, 'stroke-linecap': 'round', opacity: .35
      }, inner);
      // そで口（カフス）
      if (p.cuff) {
        S('rect', {
          x: sh.x - 9, y: sh.y + ARM_LEN - 10, width: 18, height: 6.5, rx: 3.2,
          fill: p.cuff, stroke: 'rgba(30,45,70,.12)', 'stroke-width': .8
        }, inner);
      }

      // 手のひら（うしろ側）
      const handY = sh.y + ARM_LEN;
      S('circle', {
        cx: sh.x, cy: handY, r: 9.2, fill: u('hand'),
        stroke: 'rgba(166,98,62,.24)', 'stroke-width': .8
      }, inner);
      // おやゆび（内がわに ちょこんと）
      S('ellipse', {
        cx: sh.x + (mirror ? -7.2 : 7.2), cy: handY - 2.2, rx: 4, ry: 3.2,
        fill: u('hand')
      }, inner);
      // 手の ぷっくり光沢
      S('ellipse', {
        cx: sh.x - 2.8, cy: handY - 3.4, rx: 2.8, ry: 1.8, fill: '#fff', opacity: .45
      }, inner);

      // 道具を もたせる ための 水平アンカー（基本角度を 打ち消して 水平 0° に 戻します）
      const toolAnchor = S('g', { transform: `rotate(${-baseDeg} ${sh.x} ${handY})` }, inner);
      // 道具の うえから 握りこむ 指先オーバーレイ用（道具が あるときだけ つかいます）
      const gripCap = S('g', {}, inner);

      outer._dir = mirror ? -1 : 1;
      outer._hand = { x: sh.x, y: handY };
      outer._toolAnchor = toolAnchor;
      outer._gripCap = gripCap;
      return outer;
    }

    const armL = buildArm(SH_L, armBase.l, false);
    const armR = buildArm(SH_R, armBase.r, true);

    // あたま（うなずき・かしげ用に べつの グループ）
    const head = pivot(S('g', {}, lean), HEAD_X, HEAD_Y + 28);

    // みみ（左右に 立体感のある 丸みみ）
    [-1, 1].forEach(side => {
      const ex = HEAD_X + side * 34.5;
      const ey = HEAD_Y + 4;
      S('ellipse', {
        cx: ex, cy: ey, rx: 7.5, ry: 9.2, fill: u('skin'),
        stroke: 'rgba(176,105,68,.26)', 'stroke-width': .9
      }, head);
      S('path', {
        d: `M${ex - side * 2.5} ${ey - 3.5} Q${ex + side * 2.5} ${ey} ${ex - side * 1.8} ${ey + 4}`,
        fill: 'none', stroke: u('earIn'), 'stroke-width': 2.5, 'stroke-linecap': 'round'
      }, head);
    });

    // 輪郭（まん丸ではなく ほっぺが ふっくらした ちび3D 輪郭）
    S('path', {
      d: `M${HEAD_X - 35} ${HEAD_Y - 2}
          C${HEAD_X - 35} ${HEAD_Y - 26}, ${HEAD_X - 20} ${HEAD_Y - 34}, ${HEAD_X} ${HEAD_Y - 34}
          C${HEAD_X + 20} ${HEAD_Y - 34}, ${HEAD_X + 35} ${HEAD_Y - 26}, ${HEAD_X + 35} ${HEAD_Y - 2}
          C${HEAD_X + 35} ${HEAD_Y + 19}, ${HEAD_X + 22} ${HEAD_Y + 32}, ${HEAD_X} ${HEAD_Y + 32}
          C${HEAD_X - 22} ${HEAD_Y + 32}, ${HEAD_X - 35} ${HEAD_Y + 19}, ${HEAD_X - 35} ${HEAD_Y - 2} Z`,
      fill: u('skin'),
      stroke: 'rgba(176,105,68,.28)', 'stroke-width': 1
    }, head);

    // ほっぺの すけ感チーク（ソフトな 放射グラデーション）
    S('ellipse', { cx: HEAD_X - 21.5, cy: HEAD_Y + 11.5, rx: 9.5, ry: 6.2, fill: u('blush') }, head);
    S('ellipse', { cx: HEAD_X + 21.5, cy: HEAD_Y + 11.5, rx: 9.5, ry: 6.2, fill: u('blush') }, head);
    // ほっぺの つやハイライト点（2D/3Dイラストらしさ）
    S('ellipse', { cx: HEAD_X - 24, cy: HEAD_Y + 9.2, rx: 2.2, ry: 1.3, fill: '#fff', opacity: .45 }, head);
    S('ellipse', { cx: HEAD_X + 19, cy: HEAD_Y + 9.2, rx: 2.2, ry: 1.3, fill: '#fff', opacity: .42 }, head);

    // ちいさな 立体ボタンばな
    S('path', {
      d: `M${HEAD_X - 2} ${HEAD_Y + 6.5} Q${HEAD_X} ${HEAD_Y + 8.4} ${HEAD_X + 2} ${HEAD_Y + 6.5}`,
      fill: 'none', stroke: '#cf8b64', 'stroke-width': 1.5, 'stroke-linecap': 'round', opacity: .7
    }, head);
    S('circle', { cx: HEAD_X - .7, cy: HEAD_Y + 5.1, r: 1.1, fill: '#fff7ef', opacity: .75 }, head);

    // 表情（ふつう / うれしい / こまった）
    const face = buildFace(head, ctx, p);

    // まえ髪（おでこに 落ちる やわらかい 影つき）
    const hairFront = S('g', {}, head);
    if (job.drawFrontHair) {
      job.drawFrontHair(hairFront, ctx, HEAD_X, HEAD_Y);
    }

    // ぼうし・はちまき・アホ毛（二次的な 遅れバウンド用グループ）
    const hatHost = pivot(S('g', {}, head), HEAD_X, HEAD_Y - 28);

    return {
      groundShadow, breath, react, lean, armL, armR, head, face, hatHost
    };
  }

  /**
   * 顔。うれしい・こまった を 差しかえでは なく かさねて 濃さで 移します。
   * まゆげ・つやのある ひとみ・立体的な 口で、豊かな 感情が 伝わります。
   */
  function buildFace(head, ctx, p) {
    const eyeY = HEAD_Y + 1;
    const browColor = p.brow || p.hairLo || '#3c2a21';
    const u = ctx.url;
    const g = S('g', {}, head);

    // ---- ふつうの 顔（まばたきする） ----
    const normal = S('g', {}, g);
    // やさしい まゆげ
    S('path', {
      d: `M${HEAD_X - 18.5} ${eyeY - 10.5} Q${HEAD_X - 13} ${eyeY - 13.2} ${HEAD_X - 7.5} ${eyeY - 10.8}`,
      fill: 'none', stroke: browColor, 'stroke-width': 2.1, 'stroke-linecap': 'round'
    }, normal);
    S('path', {
      d: `M${HEAD_X + 7.5} ${eyeY - 10.8} Q${HEAD_X + 13} ${eyeY - 13.2} ${HEAD_X + 18.5} ${eyeY - 10.5}`,
      fill: 'none', stroke: browColor, 'stroke-width': 2.1, 'stroke-linecap': 'round'
    }, normal);

    const eyes = pivot(S('g', {}, normal), HEAD_X, eyeY);
    [-13, 13].forEach(dx => {
      const ex = HEAD_X + dx;
      // ひとみ本体（グラデーション）
      S('ellipse', { cx: ex, cy: eyeY, rx: 5.4, ry: 6.7, fill: u('eye') }, eyes);
      // ひとみ下部の 光の照り返し（3Dフィギュアのような 透明感）
      S('path', {
        d: `M${ex - 3.2} ${eyeY + 3.2} Q${ex} ${eyeY + 5.7} ${ex + 3.2} ${eyeY + 3.2} Q${ex} ${eyeY + 4.3} ${ex - 3.2} ${eyeY + 3.2} Z`,
        fill: '#8fa8e8', opacity: .55
      }, eyes);
      // 上まつげの きわ（くっきりした 立体ライン）
      S('path', {
        d: `M${ex - 5.8} ${eyeY - 2.2} Q${ex} ${eyeY - 8.2} ${ex + 5.8} ${eyeY - 2.2}`,
        fill: 'none', stroke: '#1b1d2c', 'stroke-width': 2.1, 'stroke-linecap': 'round'
      }, eyes);
      // メインの 白キャッチライト + ちいさな サブ光点
      S('circle', { cx: ex - 1.9, cy: eyeY - 2.7, r: 2.1, fill: '#fff' }, eyes);
      S('circle', { cx: ex + 1.8, cy: eyeY + 1.9, r: 0.95, fill: '#fff', opacity: .85 }, eyes);
    });

    // あたたかい ほほえみの 口
    S('path', {
      d: `M${HEAD_X - 6.5} ${HEAD_Y + 15.5} Q${HEAD_X} ${HEAD_Y + 21.8} ${HEAD_X + 6.5} ${HEAD_Y + 15.5}`,
      fill: 'none', stroke: '#5a3128', 'stroke-width': 2.3, 'stroke-linecap': 'round'
    }, normal);

    // ---- うれしい 顔（目を にっこり、口を 大きく） ----
    const happy = S('g', { opacity: 0 }, g);
    S('path', {
      d: `M${HEAD_X - 18.5} ${eyeY - 12.2} Q${HEAD_X - 13} ${eyeY - 15.8} ${HEAD_X - 7.5} ${eyeY - 12.4}`,
      fill: 'none', stroke: browColor, 'stroke-width': 2.1, 'stroke-linecap': 'round'
    }, happy);
    S('path', {
      d: `M${HEAD_X + 7.5} ${eyeY - 12.4} Q${HEAD_X + 13} ${eyeY - 15.8} ${HEAD_X + 18.5} ${eyeY - 12.2}`,
      fill: 'none', stroke: browColor, 'stroke-width': 2.1, 'stroke-linecap': 'round'
    }, happy);
    [-13, 13].forEach(dx => {
      S('path', {
        d: `M${HEAD_X + dx - 5.8} ${eyeY + 1.4} Q${HEAD_X + dx} ${eyeY - 6.2} ${HEAD_X + dx + 5.8} ${eyeY + 1.4}`,
        fill: 'none', stroke: '#23263a', 'stroke-width': 2.8, 'stroke-linecap': 'round'
      }, happy);
    });
    // うれしい 開いた口（舌つきで 3D イラスト感）
    S('path', {
      d: `M${HEAD_X - 9.2} ${HEAD_Y + 13.5} Q${HEAD_X} ${HEAD_Y + 14.8} ${HEAD_X + 9.2} ${HEAD_Y + 13.5} Q${HEAD_X + 7.5} ${HEAD_Y + 25.5} ${HEAD_X} ${HEAD_Y + 25.5} Q${HEAD_X - 7.5} ${HEAD_Y + 25.5} ${HEAD_X - 9.2} ${HEAD_Y + 13.5} Z`,
      fill: u('mouthIn')
    }, happy);
    S('path', {
      d: `M${HEAD_X - 5.2} ${HEAD_Y + 22} Q${HEAD_X} ${HEAD_Y + 18.2} ${HEAD_X + 5.2} ${HEAD_Y + 22} Q${HEAD_X} ${HEAD_Y + 25.4} ${HEAD_X - 5.2} ${HEAD_Y + 22} Z`,
      fill: '#ff8a95'
    }, happy);
    S('path', {
      d: `M${HEAD_X - 9.2} ${HEAD_Y + 13.5} Q${HEAD_X} ${HEAD_Y + 15.1} ${HEAD_X + 9.2} ${HEAD_Y + 13.5}`,
      fill: 'none', stroke: '#5a3128', 'stroke-width': 1.6, 'stroke-linecap': 'round'
    }, happy);

    // ---- こまった 顔（目が「＞＜」、あわてた 口） ----
    const sad = S('g', { opacity: 0 }, g);
    // こまった 下がりまゆ
    S('path', {
      d: `M${HEAD_X - 19} ${eyeY - 9.2} Q${HEAD_X - 13} ${eyeY - 10.6} ${HEAD_X - 7.5} ${eyeY - 13.2}`,
      fill: 'none', stroke: browColor, 'stroke-width': 2.1, 'stroke-linecap': 'round'
    }, sad);
    S('path', {
      d: `M${HEAD_X + 7.5} ${eyeY - 13.2} Q${HEAD_X + 13} ${eyeY - 10.6} ${HEAD_X + 19} ${eyeY - 9.2}`,
      fill: 'none', stroke: browColor, 'stroke-width': 2.1, 'stroke-linecap': 'round'
    }, sad);
    [-13, 13].forEach((dx, i) => {
      const s = i === 0 ? 1 : -1;
      S('path', {
        d: `M${HEAD_X + dx - 5 * s} ${eyeY - 4.8} L${HEAD_X + dx + 4.8 * s} ${eyeY + .2} L${HEAD_X + dx - 5 * s} ${eyeY + 5.2}`,
        fill: 'none', stroke: '#23263a', 'stroke-width': 2.6,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }, sad);
    });
    // ぷるっと あわてた 波ぐち
    S('path', {
      d: `M${HEAD_X - 7.5} ${HEAD_Y + 18.8} Q${HEAD_X - 3.6} ${HEAD_Y + 14.2} ${HEAD_X} ${HEAD_Y + 17.8} Q${HEAD_X + 3.6} ${HEAD_Y + 21.2} ${HEAD_X + 7.5} ${HEAD_Y + 16.8}`,
      fill: 'none', stroke: '#5a3128', 'stroke-width': 2.3, 'stroke-linecap': 'round'
    }, sad);

    return { normal, happy, sad, eyes, current: 'normal', timer: 0 };
  }

  /** 手のうえから 道具のえを にぎりこむ 指の 立体カバー */
  function addGripOverlay(arm, u) {
    const h = arm._hand;
    S('ellipse', {
      cx: h.x + 1.2, cy: h.y - 1.2, rx: 5.5, ry: 4.5,
      fill: u('hand'), stroke: 'rgba(166,98,62,.22)', 'stroke-width': .7
    }, arm._gripCap);
    S('ellipse', {
      cx: h.x - .4, cy: h.y - 2.6, rx: 2.1, ry: 1.2, fill: '#fff', opacity: .45
    }, arm._gripCap);
  }

  // ------------------------------------------------------------------
  // 効果（立体キラキラ・かみふぶき・あせ・けむり・ゆげ）
  // ------------------------------------------------------------------

  function sparkle(layer, x, y, color, size) {
    const r = size || 1;
    const g = fitPivot(S('g', {}));
    S('path', {
      d: `M0 ${-10 * r} L${2.8 * r} ${-2.8 * r} L${10 * r} 0 L${2.8 * r} ${2.8 * r} L0 ${10 * r} L${-2.8 * r} ${2.8 * r} L${-10 * r} 0 L${-2.8 * r} ${-2.8 * r} Z`,
      fill: color || '#ffd166'
    }, g);
    // 中心の 宝石ホワイトコア
    S('circle', { cx: 0, cy: 0, r: 2.4 * r, fill: '#fff', opacity: .9 }, g);
    once(layer, g, [
      { transform: `translate(${x}px,${y}px) scale(.2) rotate(0deg)`, opacity: 0 },
      { transform: `translate(${x}px,${y - 8}px) scale(1.18) rotate(48deg)`, opacity: 1, offset: .36 },
      { transform: `translate(${x}px,${y - 22}px) scale(.65) rotate(115deg)`, opacity: 0 }
    ], { duration: 680, easing: OUT });
  }

  function confettiBurst(layer, cx, cy, count) {
    const colors = ['#ffd166', '#2fb673', '#4a90e2', '#ef5f92', '#8b7cf6', '#ff9f43'];
    for (let i = 0; i < count; i++) {
      const col = colors[i % colors.length];
      const dx = rand(-72, 72);
      const dy = rand(-56, -18);
      const rot = rand(-220, 220);
      const el = fitPivot(S('rect', {
        x: -3.5, y: -2, width: 7, height: 4, rx: 1.8, fill: col
      }));
      once(layer, el, [
        { transform: `translate(${cx}px,${cy}px) scale(.4) rotate(0deg)`, opacity: 0 },
        { transform: `translate(${cx + dx * .55}px,${cy + dy}px) scale(1.1) rotate(${rot * .5}deg)`, opacity: 1, offset: .42 },
        { transform: `translate(${cx + dx}px,${cy + dy + 34}px) scale(.8) rotate(${rot}deg)`, opacity: 0 }
      ], { duration: rand(680, 960), delay: i * 32, easing: OUT });
    }
  }

  function sweat(layer, x, y) {
    const g = fitPivot(S('g', {}));
    S('path', {
      d: 'M0 -9.5 C4 -3, 6 2, 0 6.5 C-6 2, -4 -3, 0 -9.5 Z',
      fill: '#74c7f7', stroke: '#4aa5de', 'stroke-width': .8
    }, g);
    S('ellipse', { cx: -1.4, cy: -1, rx: 1.3, ry: 2.6, fill: '#fff', opacity: .82 }, g);
    once(layer, g, [
      { transform: `translate(${x}px,${y}px) scale(.45)`, opacity: 0 },
      { transform: `translate(${x + 7}px,${y + 13}px) scale(1.05)`, opacity: .98, offset: .34 },
      { transform: `translate(${x + 16}px,${y + 38}px) scale(.78)`, opacity: 0 }
    ], { duration: 820, easing: 'ease-in' });
  }

  function puff(layer, x, y, color) {
    for (let i = 0; i < 4; i++) {
      const g = fitPivot(S('g', {}));
      const rx = rand(6.5, 11.5);
      const cx = x + rand(-11, 11);
      S('circle', { cx, cy: y, r: rx, fill: color || '#b8c0cd' }, g);
      S('circle', { cx: cx - rx * .25, cy: y - rx * .25, r: rx * .45, fill: '#eef2f7', opacity: .55 }, g);
      once(layer, g, [
        { transform: 'translateY(0) scale(.35)', opacity: .86 },
        { transform: `translate(${rand(-12, 12)}px,-44px) scale(1.48)`, opacity: 0 }
      ], { duration: rand(760, 1060), delay: i * 85, easing: OUT });
    }
  }

  /** ずっと ゆるやかに のぼる ゆげ（マグカップ・フライパン） */
  function startSteam(parent, x, y, idleList, count) {
    for (let i = 0; i < (count || 2); i++) {
      const wrap = S('g', { transform: `translate(${x + i * 7} ${y})` }, parent);
      const wisp = fitPivot(S('path', {
        d: 'M0 0 Q-3 -6 0 -12 Q3 -18 0 -24',
        fill: 'none', stroke: '#ffffff', 'stroke-width': 2.2,
        'stroke-linecap': 'round', opacity: .55
      }, wrap), 'bottom');
      const anim = run(wisp, [
        { transform: 'translateY(4px) scale(.7)', opacity: 0 },
        { transform: 'translateY(-6px) scale(1)', opacity: .52, offset: .45 },
        { transform: 'translateY(-18px) scale(1.12)', opacity: 0 }
      ], { duration: 2200 + i * 520, delay: i * 760, iterations: Infinity, easing: 'ease-in-out' });
      if (anim) idleList.push(anim);
    }
  }

  /** 3D の つくえ・作業台の 基本構造（天板ハイライト＋立体ふち＋前面影） */
  function drawDeskBase(parent, defs, id, colors) {
    linGrad(defs, id('deskTop'), '0%', '0%', '0%', '100%', [
      ['0%', colors.topHi],
      ['100%', colors.topLo]
    ]);
    linGrad(defs, id('deskFront'), '0%', '0%', '0%', '100%', [
      ['0%', colors.frontHi],
      ['100%', colors.frontLo]
    ]);
    // つくえの 前面（下部）
    S('rect', { x: 6, y: 183, width: 308, height: 49, fill: `url(#${id('deskFront')})` }, parent);
    // 天板の 下に 落ちる 立体シャドウ
    S('rect', { x: 6, y: 183, width: 308, height: 6, fill: '#121d2d', opacity: .16 }, parent);
    // 天板（丸み＋上面ハイライト）
    S('rect', { x: 4, y: 170, width: 312, height: 15, rx: 6, fill: `url(#${id('deskTop')})` }, parent);
    S('line', {
      x1: 10, y1: 171.6, x2: 310, y2: 171.6,
      stroke: '#ffffff', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: .48
    }, parent);
  }

  // ------------------------------------------------------------------
  // しごとごとの 2D/3D ディオラマ と キャラ造形
  // ------------------------------------------------------------------

  const JOBS = {

    /* === かいしゃいん：パソコンで しょるいを つくる === */
    office: {
      label: 'かいしゃいん',
      unit: 'しょるい',
      armBase: { l: -10, r: 10 },
      palette: {
        skin: '#ffdcba',
        hairHi: '#7a5948', hair: '#533b2f', hairLo: '#36241b', brow: '#463026',
        clothHi: '#6b94e0', cloth: '#4b73c4', clothLo: '#355599', clothEdge: 'rgba(30,52,102,.22)',
        sleeveHi: '#ffffff', sleeve: '#edf3fb', sleeveLo: '#cfd9e8', cuff: '#ffffff',
        accentHi: '#ff966e', accent: '#ea6c4c', accentLo: '#c24d31'
      },
      drawBackHair(g, ctx, hx, hy) {
        S('path', {
          d: `M${hx - 36} ${hy + 4} C${hx - 39} ${hy - 26}, ${hx - 18} ${hy - 39}, ${hx} ${hy - 39}
              C${hx + 18} ${hy - 39}, ${hx + 39} ${hy - 26}, ${hx + 36} ${hy + 4}
              C${hx + 32} ${hy + 14}, ${hx - 32} ${hy + 14}, ${hx - 36} ${hy + 4} Z`,
          fill: ctx.url('hairBack')
        }, g);
      },
      drawFrontHair(g, ctx, hx, hy) {
        // おでこに 落ちる やわらかな 前髪のかげ
        S('path', {
          d: `M${hx - 32} ${hy - 7} Q${hx - 12} ${hy - 16} ${hx + 8} ${hy - 14} Q${hx + 22} ${hy - 13} ${hx + 32} ${hy - 6}
              Q${hx + 16} ${hy - 22} ${hx} ${hy - 22} Q${hx - 18} ${hy - 22} ${hx - 32} ${hy - 7} Z`,
          fill: '#b56e4b', opacity: .11
        }, g);
        // さわやかな 七三パートの 前髪
        S('path', {
          d: `M${hx - 36} ${hy - 2}
              C${hx - 37} ${hy - 26}, ${hx - 20} ${hy - 38}, ${hx} ${hy - 38}
              C${hx + 21} ${hy - 38}, ${hx + 37} ${hy - 25}, ${hx + 36} ${hy - 2}
              C${hx + 33} ${hy - 12}, ${hx + 26} ${hy - 18}, ${hx + 17} ${hy - 19}
              C${hx + 14} ${hy - 13}, ${hx + 10} ${hy - 12}, ${hx + 7} ${hy - 20}
              C${hx - 6} ${hy - 22}, ${hx - 19} ${hy - 16}, ${hx - 27} ${hy - 10}
              C${hx - 31} ${hy - 6}, ${hx - 34} ${hy - 4}, ${hx - 36} ${hy - 2} Z`,
          fill: ctx.url('hair')
        }, g);
        // サイドのもみあげ毛束
        S('path', {
          d: `M${hx - 35} ${hy - 8} C${hx - 37} ${hy + 1}, ${hx - 34} ${hy + 8}, ${hx - 31} ${hy + 10} C${hx - 31} ${hy + 2}, ${hx - 31} ${hy - 4}, ${hx - 32} ${hy - 8} Z`,
          fill: ctx.url('hair')
        }, g);
        S('path', {
          d: `M${hx + 35} ${hy - 8} C${hx + 37} ${hy + 1}, ${hx + 34} ${hy + 8}, ${hx + 31} ${hy + 10} C${hx + 31} ${hy + 2}, ${hx + 31} ${hy - 4}, ${hx + 32} ${hy - 8} Z`,
          fill: ctx.url('hair')
        }, g);
        // 天使の輪（つやハイライト）
        S('path', {
          d: `M${hx - 21} ${hy - 25} Q${hx - 6} ${hy - 32} ${hx + 9} ${hy - 27}`,
          fill: 'none', stroke: '#ffffff', 'stroke-width': 3.2, 'stroke-linecap': 'round', opacity: .26
        }, g);
        S('path', {
          d: `M${hx + 15} ${hy - 25} Q${hx + 21} ${hy - 22} ${hx + 25} ${hy - 18}`,
          fill: 'none', stroke: '#ffffff', 'stroke-width': 2.2, 'stroke-linecap': 'round', opacity: .20
        }, g);
      },
      drawOutfit(g, ctx, hx) {
        const u = ctx.url;
        // 白シャツの まるい えり
        S('path', {
          d: `M${hx - 15} 123 L${hx} 138 L${hx + 15} 123 L${hx + 10} 120 L${hx} 129 L${hx - 10} 120 Z`,
          fill: '#ffffff', stroke: '#cfd9e8', 'stroke-width': .8
        }, g);
        // 立体ネクタイ（結び目＋しま模様）
        S('path', {
          d: `M${hx - 4} 132 L${hx + 4} 132 L${hx + 6} 159 L${hx} 166 L${hx - 6} 159 Z`,
          fill: u('accent')
        }, g);
        S('path', {
          d: `M${hx - 4.4} 142 L${hx + 4.4} 139 M${hx - 5.2} 151 L${hx + 5.2} 148`,
          stroke: '#ffe3d6', 'stroke-width': 1.6, opacity: .75
        }, g);
        S('rect', { x: hx - 4.5, y: 129, width: 9, height: 6.5, rx: 2.5, fill: '#f38462' }, g);
        // むねポケット＆名札バッジ
        S('rect', { x: hx + 11, y: 141, width: 12, height: 8, rx: 2, fill: '#eef4fc', stroke: '#b8cae4', 'stroke-width': .8 }, g);
        S('rect', { x: hx + 13, y: 143.5, width: 6, height: 2, rx: 1, fill: '#4b73c4' }, g);
      },
      scene(ctx) {
        const id = ctx.id;
        const defs = ctx.defs;

        // 背後からの やわらかな 窓光（ディオラマ感）
        S('polygon', { points: '0,0 135,0 60,175 0,175', fill: ctx.url('beam') }, ctx.back);
        S('ellipse', { cx: HEAD_X, cy: 108, rx: 148, ry: 112, fill: ctx.url('aura') }, ctx.back);

        // うしろの 小さな 観葉植物（右奥・3D テラコッタ鉢）
        linGrad(defs, id('pot'), '0%', '0%', '100%', '100%', [['0%', '#e8956b'], ['100%', '#b55e39']]);
        linGrad(defs, id('leaf'), '0%', '0%', '100%', '100%', [['0%', '#7be098'], ['100%', '#2d9357']]);
        const plant = S('g', { opacity: .92 }, ctx.back);
        S('ellipse', { cx: 295, cy: 170, rx: 14, ry: 3.5, fill: ctx.url('shadow') }, plant);
        S('path', { d: 'M284 150 L306 150 L303 169 L287 169 Z', fill: ctx.url('pot') }, plant);
        S('rect', { x: 282, y: 146, width: 26, height: 5.5, rx: 2.5, fill: '#f0a67f' }, plant);
        S('ellipse', { cx: 295, cy: 138, rx: 5.5, ry: 10, fill: ctx.url('leaf') }, plant);
        S('ellipse', { cx: 288, cy: 141, rx: 4.5, ry: 8, transform: 'rotate(-26 288 141)', fill: ctx.url('leaf') }, plant);
        S('ellipse', { cx: 302, cy: 141, rx: 4.5, ry: 8, transform: 'rotate(26 302 141)', fill: '#48b873' }, plant);

        // 2.5D デスクトップモニター（右うしろ）
        linGrad(defs, id('scr'), '0%', '0%', '100%', '100%', [
          ['0%', '#c7f0ff'], ['48%', '#83d1f7'], ['100%', '#4ea8e0']
        ]);
        linGrad(defs, id('bezel'), '0%', '0%', '100%', '100%', [
          ['0%', '#4d5870'], ['100%', '#2a3142']
        ]);
        const mon = S('g', {}, ctx.back);
        // スタンドと接地かげ
        S('ellipse', { cx: 244, cy: 170, rx: 28, ry: 4.5, fill: ctx.url('shadow') }, mon);
        S('path', { d: 'M237 154 L251 154 L254 167 L234 167 Z', fill: ctx.url('metal') }, mon);
        S('rect', { x: 223, y: 165, width: 42, height: 5, rx: 2.5, fill: ctx.url('metal') }, mon);
        // 本体フレーム（厚み＋表面）
        S('rect', { x: 201, y: 92, width: 88, height: 64, rx: 9, fill: '#222836' }, mon);
        S('rect', { x: 199, y: 90, width: 88, height: 64, rx: 9, fill: ctx.url('bezel') }, mon);
        S('rect', { x: 205, y: 96, width: 76, height: 48, rx: 4.5, fill: ctx.url('scr') }, mon);
        // 画面の ガラス反射スラッシュ
        S('polygon', { points: '207,96 232,96 215,144 205,144', fill: '#ffffff', opacity: .22 }, mon);
        // 画面の なかの 文章バー（打つと 光る！）
        ctx.screenBars = [];
        const widths = [34, 48, 40, 52];
        for (let i = 0; i < 4; i++) {
          const bar = S('rect', {
            x: 212, y: 104 + i * 9, width: widths[i], height: 4.5, rx: 2.2,
            fill: '#ffffff', opacity: .82
          }, mon);
          ctx.screenBars.push(bar);
        }
        // 点滅カーソル
        const cursor = S('rect', { x: 266, y: 131, width: 3, height: 6, rx: 1, fill: '#fff8d6' }, mon);
        ctx.cursorEl = cursor;
        // 下べぜルの 電源ランプ
        S('circle', { cx: 243, cy: 149, r: 1.8, fill: '#5ef2b3' }, mon);

        // 3D 木目つくえ
        drawDeskBase(ctx.front, defs, id, {
          topHi: '#e6b784', topLo: '#cb9159',
          frontHi: '#bc814b', frontLo: '#9b6434'
        });
        // やさしい 木目ライン
        S('path', { d: 'M24 200 Q92 196 156 201 M188 212 Q245 208 298 213', stroke: '#8f592c', 'stroke-width': 1.4, fill: 'none', opacity: .26 }, ctx.front);

        // 2.5D キーボード（打つと 左右が ふわっと 光る）
        S('ellipse', { cx: 142, cy: 179, rx: 52, ry: 4.5, fill: ctx.url('shadow') }, ctx.front);
        S('path', {
          d: 'M98 166 L186 166 L192 178 C192 180, 190 181, 187 181 L97 181 C94 181, 92 180, 92 178 Z',
          fill: '#b8c3d4'
        }, ctx.front);
        S('path', {
          d: 'M99 164 L185 164 L190 175 C190 177, 188 178, 185 178 L99 178 C96 178, 94 177, 94 175 Z',
          fill: ctx.url('ceramic'), stroke: '#c7d2e2', 'stroke-width': 1
        }, ctx.front);
        // ミニキーの 列
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 8; c++) {
            S('rect', {
              x: 102 + c * 10, y: 166.5 + r * 4.2, width: 7.5, height: 2.8, rx: 1,
              fill: '#d8e1ee'
            }, ctx.front);
          }
        }
        // スペースバー
        S('rect', { x: 124, y: 174.6, width: 36, height: 2.4, rx: 1, fill: '#cbd6e6' }, ctx.front);
        // 打鍵フラッシュ（左右）
        ctx.kbGlowL = S('rect', { x: 102, y: 166, width: 36, height: 9, rx: 2, fill: '#4a90e2', opacity: 0 }, ctx.front);
        ctx.kbGlowR = S('rect', { x: 146, y: 166, width: 36, height: 9, rx: 2, fill: '#4a90e2', opacity: 0 }, ctx.front);

        // 3D テラコッタ・マグカップ（ゆげが ずっと のぼる）
        linGrad(defs, id('mug'), '0%', '0%', '100%', '100%', [['0%', '#ff9e7d'], ['55%', '#eb7554'], ['100%', '#c55235']]);
        S('ellipse', { cx: 25, cy: 172, rx: 14, ry: 3.6, fill: ctx.url('shadow') }, ctx.front);
        S('path', { d: 'M36 154 C44 154, 44 166, 36 166', fill: 'none', stroke: '#d66041', 'stroke-width': 3.6, 'stroke-linecap': 'round' }, ctx.front);
        S('rect', { x: 13, y: 148, width: 24, height: 23, rx: 5, fill: ctx.url('mug') }, ctx.front);
        S('ellipse', { cx: 25, cy: 149, rx: 11.5, ry: 2.8, fill: '#ffe7dc' }, ctx.front);
        S('ellipse', { cx: 25, cy: 149.2, rx: 9, ry: 1.9, fill: '#6b422a' }, ctx.front);
        // マグの 光沢
        S('rect', { x: 16.5, y: 153, width: 3.4, height: 13, rx: 1.7, fill: '#ffffff', opacity: .38 }, ctx.front);
      },
      props(ctx) {
        // ちょこんと はねる アホ毛（二次バウンド）
        S('path', {
          d: `M${HEAD_X - 2} ${HEAD_Y - 36} Q${HEAD_X + 4} ${HEAD_Y - 47} ${HEAD_X + 11} ${HEAD_Y - 41} Q${HEAD_X + 4} ${HEAD_Y - 41} ${HEAD_X + 2} ${HEAD_Y - 35} Z`,
          fill: ctx.url('hair')
        }, ctx.parts.hatHost);
        // ゆげ・カーソル点滅を 待機アニメに 登録
        startSteam(ctx.fx, 21, 144, ctx.idle, 2);
        const blinkCur = run(ctx.cursorEl, [
          { opacity: 1 }, { opacity: 1, offset: .48 }, { opacity: 0, offset: .52 }, { opacity: 0 }
        ], { duration: 920, iterations: Infinity });
        if (blinkCur) ctx.idle.push(blinkCur);
        ctx.barIdx = 0;
      },
      tap(ctx, arm, isLeft) {
        // 打った 手を 軽快に たたく
        run(arm, [
          { transform: 'rotate(0deg)' },
          { transform: `rotate(${9.5 * arm._dir}deg)` },
          { transform: 'rotate(0deg)' }
        ], { duration: 185, easing: OUT, composite: 'add' });
        // キーボードの 光フィードバック
        const glow = isLeft ? ctx.kbGlowL : ctx.kbGlowR;
        run(glow, [
          { opacity: .48 }, { opacity: 0 }
        ], { duration: 220, easing: OUT });
        // モニターの 行が 順番に きらっと 入力される
        const bar = ctx.screenBars[ctx.barIdx % ctx.screenBars.length];
        ctx.barIdx++;
        run(bar, [
          { opacity: .82 }, { opacity: 1, fill: '#fff4a3', offset: .35 }, { opacity: .82 }
        ], { duration: 240, easing: OUT });
      },
      done(ctx) {
        // できた 立体しょるいが ふわっと 舞って 山へ おさまる
        const doc = fitPivot(S('g', {}));
        S('rect', { x: 126, y: 146, width: 28, height: 20, rx: 2.5, fill: '#ffffff', stroke: '#c5d1e3', 'stroke-width': 1.2 }, doc);
        S('line', { x1: 131, y1: 152, x2: 148, y2: 152, stroke: '#9ab0cf', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, doc);
        S('line', { x1: 131, y1: 157, x2: 145, y2: 157, stroke: '#9ab0cf', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, doc);
        S('circle', { cx: 149, cy: 161, r: 2.4, fill: '#ffd15c' }, doc);
        once(ctx.fx, doc, [
          { transform: 'translate(0,0) scale(.85) rotate(0deg)', opacity: 0 },
          { transform: 'translate(-24px,-30px) scale(1.06) rotate(-14deg)', opacity: 1, offset: .45 },
          { transform: 'translate(-72px,4px) scale(.96) rotate(4deg)', opacity: 1 }
        ], { duration: 540, easing: 'cubic-bezier(.3,.7,.4,1)' });
        return 490;
      },
      stackItem(ctx, i, g) {
        const y = 162 - i * 6.5;
        const tilt = (i % 2 === 0 ? -1.4 : 1.2);
        const tabColors = ['#4a90e2', '#2fb673', '#f5942a', '#ef5f92', '#8b7cf6', '#21b6c8'];
        const item = S('g', { transform: `rotate(${tilt} 64 ${y + 3})` }, g);
        // 紙の 束の 厚みかげ
        S('rect', { x: 47, y: y + 2, width: 34, height: 6.5, rx: 1.8, fill: '#c6d2e2' }, item);
        // 紙の上面
        S('rect', { x: 46, y, width: 34, height: 6.5, rx: 1.8, fill: '#ffffff', stroke: '#cbd6e6', 'stroke-width': 1 }, item);
        // カラフルな ふせんタブ
        S('rect', { x: 76, y: y + 1.2, width: 6, height: 4, rx: 1.2, fill: tabColors[i % tabColors.length] }, item);
      },
      miss(ctx) {
        // しょるいが ぶわっと 散らばる + モニターに「!」
        for (let i = 0; i < 4; i++) {
          const doc = fitPivot(S('g', {}));
          S('rect', { x: 130, y: 146, width: 22, height: 16, rx: 2, fill: '#fff', stroke: '#c5d1e3', 'stroke-width': 1.2 }, doc);
          S('line', { x1: 134, y1: 151, x2: 147, y2: 151, stroke: '#a8b7ce', 'stroke-width': 1.4 }, doc);
          once(ctx.fx, doc, [
            { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
            { transform: `translate(${rand(-72, 72)}px,${rand(-62, -28)}px) rotate(${rand(-150, 150)}deg)`, opacity: 0 }
          ], { duration: rand(600, 860), easing: OUT });
        }
        const warn = fitPivot(S('g', {}));
        S('circle', { cx: 243, cy: 118, r: 12, fill: '#ffae33', stroke: '#fff', 'stroke-width': 2 }, warn);
        S('rect', { x: 241.4, y: 111.5, width: 3.2, height: 7.8, rx: 1.6, fill: '#fff' }, warn);
        S('circle', { cx: 243, cy: 122.8, r: 1.9, fill: '#fff' }, warn);
        once(ctx.fx, warn, [
          { transform: 'scale(.3)', opacity: 0 },
          { transform: 'scale(1.12)', opacity: 1, offset: .24 },
          { transform: 'scale(1)', opacity: 1, offset: .76 },
          { transform: 'scale(.7)', opacity: 0 }
        ], { duration: 760, easing: OUT });
      }
    },

    /* === シェフ：フライパンで りょうりを つくる === */
    chef: {
      label: 'シェフ',
      unit: 'りょうり',
      armBase: { l: 14, r: -26 },
      palette: {
        skin: '#ffdcba',
        hairHi: '#8a6242', hair: '#634329', hairLo: '#402917', brow: '#543822',
        clothHi: '#ffffff', cloth: '#f5f8fc', clothLo: '#d9e3f0', clothEdge: 'rgba(60,82,112,.18)',
        sleeveHi: '#ffffff', sleeve: '#f4f7fb', sleeveLo: '#d8e1ee', cuff: '#eef3f9',
        accentHi: '#ffe585', accent: '#f7b928', accentLo: '#d48a10'
      },
      drawBackHair(g, ctx, hx, hy) {
        S('ellipse', { cx: hx, cy: hy - 2, rx: 37, ry: 29, fill: ctx.url('hairBack') }, g);
      },
      drawFrontHair(g, ctx, hx, hy) {
        // コックぼうの下から のぞく ふんわり前髪（帽子の下縁を しっかり 覆います）
        S('path', {
          d: `M${hx - 36} ${hy - 3}
              C${hx - 37} ${hy - 26}, ${hx - 20} ${hy - 38}, ${hx} ${hy - 38}
              C${hx + 20} ${hy - 38}, ${hx + 37} ${hy - 26}, ${hx + 36} ${hy - 3}
              C${hx + 31} ${hy - 13}, ${hx + 22} ${hy - 16}, ${hx + 14} ${hy - 15}
              C${hx + 9} ${hy - 10}, ${hx + 3} ${hy - 12}, ${hx - 1} ${hy - 18}
              C${hx - 11} ${hy - 18}, ${hx - 20} ${hy - 15}, ${hx - 26} ${hy - 10}
              C${hx - 30} ${hy - 7}, ${hx - 33} ${hy - 5}, ${hx - 36} ${hy - 3} Z`,
          fill: ctx.url('hair')
        }, g);
        // なめらかな サイドの毛束（耳ぎわに そっと）
        S('path', {
          d: `M${hx - 35} ${hy - 7} C${hx - 37} ${hy + 1}, ${hx - 34} ${hy + 8}, ${hx - 30} ${hy + 10} C${hx - 30} ${hy + 2}, ${hx - 31} ${hy - 3}, ${hx - 32} ${hy - 7} Z`,
          fill: ctx.url('hair')
        }, g);
        S('path', {
          d: `M${hx + 35} ${hy - 7} C${hx + 37} ${hy + 1}, ${hx + 34} ${hy + 8}, ${hx + 30} ${hy + 10} C${hx + 30} ${hy + 2}, ${hx + 31} ${hy - 3}, ${hx + 32} ${hy - 7} Z`,
          fill: ctx.url('hair')
        }, g);
        // 前髪の やさしい つやハイライト
        S('path', {
          d: `M${hx - 18} ${hy - 22} Q${hx - 4} ${hy - 26} ${hx + 14} ${hy - 22}`,
          fill: 'none', stroke: '#ffffff', 'stroke-width': 2.6, 'stroke-linecap': 'round', opacity: .20
        }, g);
      },
      drawOutfit(g, ctx, hx) {
        const u = ctx.url;
        // ダブルブレストの コックコート合わせ線
        S('path', {
          d: `M${hx - 9} 131 L${hx - 12} 175 M${hx + 9} 131 L${hx + 12} 175`,
          stroke: '#cdd8e6', 'stroke-width': 1.2, fill: 'none'
        }, g);
        // 3D ドームボタン 4つ
        [143, 156].forEach(by => {
          [-9, 9].forEach(dx => {
            S('circle', { cx: hx + dx, cy: by + .8, r: 2.7, fill: '#b8c5d6' }, g);
            S('circle', { cx: hx + dx, cy: by, r: 2.5, fill: '#eef3f9', stroke: '#c5d0e0', 'stroke-width': .6 }, g);
            S('circle', { cx: hx + dx - .8, cy: by - .8, r: .8, fill: '#ffffff' }, g);
          });
        });
        // きいろの 立体ネッカチーフ（結び目つき）
        S('path', {
          d: `M${hx - 16} 123 Q${hx} 139 ${hx + 16} 123 L${hx + 12} 120 Q${hx} 130 ${hx - 12} 120 Z`,
          fill: u('accent'), stroke: '#d48a10', 'stroke-width': .6
        }, g);
        S('path', {
          d: `M${hx - 2} 132 L${hx - 9} 142 L${hx - 1} 139 Z M${hx + 2} 132 L${hx + 10} 142 L${hx + 1} 139 Z`,
          fill: u('accent')
        }, g);
        S('circle', { cx: hx, cy: 132, r: 4.2, fill: '#ffd966', stroke: '#d48a10', 'stroke-width': .7 }, g);
      },
      scene(ctx) {
        const id = ctx.id;
        const defs = ctx.defs;

        // やわらかい 背景スポット光 + キッチンタイルの さりげない 質感
        S('ellipse', { cx: HEAD_X, cy: 108, rx: 148, ry: 112, fill: ctx.url('aura') }, ctx.back);
        const tile = S('g', { opacity: .12 }, ctx.back);
        for (let x = 24; x < 310; x += 34) S('line', { x1: x, y1: 12, x2: x, y2: 170, stroke: '#7b95b3', 'stroke-width': 1 }, tile);
        for (let y = 34; y < 170; y += 34) S('line', { x1: 8, y1: y, x2: 312, y2: y, stroke: '#7b95b3', 'stroke-width': 1 }, tile);

        // うしろの レンジフードの さりげない 立体縁（右上）
        S('path', { d: 'M202 0 L282 0 L294 26 L190 26 Z', fill: ctx.url('metal'), opacity: .5 }, ctx.back);

        // 3D ステンレス・キッチンカウンター
        drawDeskBase(ctx.front, defs, id, {
          topHi: '#f4f7fb', topLo: '#d8e1ec',
          frontHi: '#cad4e2', frontLo: '#aebbc9'
        });

        // ガスコンロの 五徳（ごとく）と 立体バーナー
        S('ellipse', { cx: 238, cy: 173, rx: 32, ry: 4.5, fill: ctx.url('shadow') }, ctx.front);
        S('rect', { x: 208, y: 164, width: 60, height: 9, rx: 4, fill: ctx.url('metalDark') }, ctx.front);
        // 五徳の 爪
        S('path', {
          d: 'M213 164 L217 159 L224 159 M263 164 L259 159 L252 159',
          fill: 'none', stroke: '#3a414f', 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        }, ctx.front);
        // バーナーの 火口リング
        S('ellipse', { cx: 238, cy: 165, rx: 22, ry: 3, fill: '#232832' }, ctx.front);
      },
      props(ctx) {
        const id = ctx.id;
        const defs = ctx.defs;
        const u = ctx.url;

        // ふわふわ 立体コックぼう（hatHost に 載せて 二次バウンド！）
        linGrad(defs, id('toque'), '15%', '0%', '85%', '100%', [
          ['0%', '#ffffff'], ['62%', '#f2f6fc'], ['100%', '#d5dfee']
        ]);
        const h = ctx.parts.hatHost;
        // 4つの ふっくら山（奥→手前）
        S('circle', { cx: HEAD_X - 19, cy: HEAD_Y - 46, r: 13.5, fill: u('toque'), stroke: '#cfd9e8', 'stroke-width': 1 }, h);
        S('circle', { cx: HEAD_X + 19, cy: HEAD_Y - 46, r: 13.5, fill: u('toque'), stroke: '#cfd9e8', 'stroke-width': 1 }, h);
        S('circle', { cx: HEAD_X, cy: HEAD_Y - 53, r: 16.5, fill: u('toque'), stroke: '#cfd9e8', 'stroke-width': 1 }, h);
        // 内部の ひだ（プリーツ影で 3D 感）
        S('path', {
          d: `M${HEAD_X - 11} ${HEAD_Y - 50} Q${HEAD_X - 9} ${HEAD_Y - 42} ${HEAD_X - 10} ${HEAD_Y - 36}
              M${HEAD_X + 11} ${HEAD_Y - 50} Q${HEAD_X + 9} ${HEAD_Y - 42} ${HEAD_X + 10} ${HEAD_Y - 36}`,
          fill: 'none', stroke: '#c7d4e6', 'stroke-width': 1.5, 'stroke-linecap': 'round'
        }, h);
        // トップの光沢ハイライト
        S('ellipse', { cx: HEAD_X - 5, cy: HEAD_Y - 61, rx: 6, ry: 3, fill: '#ffffff', opacity: .8 }, h);
        // 帽子の はちまき帯（ゴールドの 細ラインつき）
        S('path', {
          d: `M${HEAD_X - 27} ${HEAD_Y - 40} Q${HEAD_X} ${HEAD_Y - 44} ${HEAD_X + 27} ${HEAD_Y - 40}
              L${HEAD_X + 26} ${HEAD_Y - 26} Q${HEAD_X} ${HEAD_Y - 30} ${HEAD_X - 26} ${HEAD_Y - 26} Z`,
          fill: u('toque'), stroke: '#cfd9e8', 'stroke-width': 1
        }, h);
        S('path', {
          d: `M${HEAD_X - 25} ${HEAD_Y - 30} Q${HEAD_X} ${HEAD_Y - 34} ${HEAD_X + 25} ${HEAD_Y - 30}`,
          fill: 'none', stroke: '#f0b429', 'stroke-width': 1.8, opacity: .85
        }, h);

        // 3D フライパン（右手の 水平アンカーに 装着 → 息づかいでも 離れません）
        linGrad(defs, id('panBody'), '0%', '0%', '100%', '100%', [
          ['0%', '#5c6575'], ['45%', '#363c48'], ['100%', '#1f242c']
        ]);
        linGrad(defs, id('panWood'), '0%', '0%', '0%', '100%', [
          ['0%', '#c98850'], ['100%', '#8c5327']
        ]);
        const hand = ctx.armR._hand;
        const pan = pivot(S('g', {}, ctx.armR._toolAnchor), hand.x, hand.y);
        // 木製ハンドル + リベット
        S('rect', { x: hand.x - 4, y: hand.y - 4.2, width: 32, height: 7.2, rx: 3.6, fill: ctx.url('panWood') }, pan);
        S('rect', { x: hand.x + 22, y: hand.y - 3.6, width: 12, height: 6, rx: 2, fill: ctx.url('metal') }, pan);
        // スキレット本体（ふっくら 3D 底面）
        S('path', {
          d: `M${hand.x + 30} ${hand.y - 8} L${hand.x + 76} ${hand.y - 8} C${hand.x + 74} ${hand.y + 8}, ${hand.x + 32} ${hand.y + 8}, ${hand.x + 30} ${hand.y - 8} Z`,
          fill: ctx.url('panBody')
        }, pan);
        // スキレットの つや反射
        S('path', {
          d: `M${hand.x + 36} ${hand.y + 1} Q${hand.x + 53} ${hand.y + 5} ${hand.x + 69} ${hand.y}`,
          fill: 'none', stroke: '#8c97ab', 'stroke-width': 1.8, 'stroke-linecap': 'round', opacity: .5
        }, pan);
        // フライパン内面（くぼみ立体）
        S('ellipse', { cx: hand.x + 53, cy: hand.y - 8, rx: 23, ry: 5.5, fill: '#5d6678', stroke: '#7b8599', 'stroke-width': 1 }, pan);
        S('ellipse', { cx: hand.x + 53, cy: hand.y - 7.6, rx: 19.5, ry: 3.8, fill: '#2c313b' }, pan);
        // なかで じゅわっと 焼ける いろどり具材
        S('circle', { cx: hand.x + 46, cy: hand.y - 8.5, r: 4, fill: '#ff8a52' }, pan);
        S('circle', { cx: hand.x + 54, cy: hand.y - 9.2, r: 4.5, fill: '#ffd15c' }, pan);
        S('circle', { cx: hand.x + 61, cy: hand.y - 8.2, r: 3.8, fill: '#64c975' }, pan);
        S('circle', { cx: hand.x + 53, cy: hand.y - 10.6, r: 1.5, fill: '#fff8d6', opacity: .7 }, pan);
        // 手が ハンドルを 握りこむ 立体指カバー
        addGripOverlay(ctx.armR, u);
        ctx.pan = pan;

        // 二重カラーの ゆらめく ガスほのお（外：黄金オレンジ / 内：青い炎）
        for (let i = 0; i < 3; i++) {
          const at = S('g', { transform: `translate(${224 + i * 14} 165)` }, ctx.front);
          const flameG = fitPivot(S('g', {}, at), 'bottom');
          S('path', {
            d: 'M0 0 Q7.5 -9 0 -18 Q-7.5 -9 0 0 Z',
            fill: '#ff961f', opacity: .9
          }, flameG);
          S('path', {
            d: 'M0 0 Q4 -5.5 0 -11 Q-4 -5.5 0 0 Z',
            fill: '#ffe66d', opacity: .92
          }, flameG);
          S('path', {
            d: 'M0 0 Q2.2 -3 0 -6 Q-2.2 -3 0 0 Z',
            fill: '#60d6ff', opacity: .88
          }, flameG);
          const anim = run(flameG, [
            { transform: 'scaleY(1) scaleX(1)' },
            { transform: 'scaleY(1.28) scaleX(.85)' },
            { transform: 'scaleY(.9) scaleX(1.1)' },
            { transform: 'scaleY(1) scaleX(1)' }
          ], { duration: 560 + i * 120, iterations: Infinity, easing: 'ease-in-out' });
          if (anim) ctx.idle.push(anim);
        }

        // フライパンから のぼる やわらかな 湯気
        startSteam(ctx.fx, 232, 138, ctx.idle, 2);
      },
      tap(ctx) {
        // フライパンを リズミカルに あおって 具材が ぱっと 宙返り！
        run(ctx.armR, [
          { transform: 'rotate(0deg)' },
          { transform: 'rotate(-10deg)', offset: .42 },
          { transform: 'rotate(0deg)' }
        ], { duration: 280, easing: OUT, composite: 'add' });
        run(ctx.pan, [
          { transform: 'rotate(0deg)' },
          { transform: 'rotate(-20deg)', offset: .38 },
          { transform: 'rotate(3deg)', offset: .76 },
          { transform: 'rotate(0deg)' }
        ], { duration: 290, easing: OUT, composite: 'add' });

        // 2つの いろどり具材が 放物線で はねる
        const bits = [
          { c: '#ff8552', hi: '#ffc6ad', dx: rand(-8, 12), peak: rand(104, 118), r: 4.8 },
          { c: '#66cc78', hi: '#c2f5cb', dx: rand(-14, 6), peak: rand(112, 124), r: 4.1 }
        ];
        bits.forEach((b, idx) => {
          const item = fitPivot(S('g', {}));
          S('circle', { cx: 0, cy: 0, r: b.r, fill: b.c }, item);
          S('circle', { cx: -b.r * .3, cy: -b.r * .3, r: b.r * .38, fill: b.hi, opacity: .85 }, item);
          once(ctx.fx, item, [
            { transform: `translate(${236 + idx * 6}px,146px) scale(.9) rotate(0deg)` },
            { transform: `translate(${240 + b.dx}px,${b.peak}px) scale(1.1) rotate(140deg)`, offset: .5 },
            { transform: `translate(${236 + idx * 4}px,147px) scale(.9) rotate(260deg)` }
          ], { duration: 420 + idx * 55, easing: 'ease-in-out' });
        });
      },
      done(ctx) {
        sparkle(ctx.fx, 238, 122, '#ffd15c', 1.15);
        sparkle(ctx.fx, 256, 134, '#ff9d76', .75);
        return 220;
      },
      stackItem(ctx, i, g) {
        const y = 166 - i * 10.5;
        const cx = 56;
        // 3D セラミック皿（接地影＋リム＋光沢）
        S('ellipse', { cx, cy: y + 3, rx: 24, ry: 5.5, fill: '#182438', opacity: .14 }, g);
        S('ellipse', { cx, cy: y, rx: 25, ry: 6.2, fill: ctx.url('ceramic'), stroke: '#c7d2e2', 'stroke-width': 1 }, g);
        S('ellipse', { cx, cy: y - .5, rx: 17, ry: 3.6, fill: '#eef3f9' }, g);

        // 6種類の 立体ミニりょうり（オムライス・ハンバーグ・パンケーキ等）
        const kind = i % 6;
        if (kind === 0) {
          // オムライス
          S('ellipse', { cx, cy: y - 4, rx: 12, ry: 5.5, fill: '#ffd452', stroke: '#e3a522', 'stroke-width': .7 }, g);
          S('path', { d: `M${cx - 6} ${y - 4.5} Q${cx - 3} ${y - 7.5} ${cx} ${y - 4.5} Q${cx + 3} ${y - 7.5} ${cx + 6} ${y - 4.5}`, fill: 'none', stroke: '#e84848', 'stroke-width': 1.8, 'stroke-linecap': 'round' }, g);
        } else if (kind === 1) {
          // ハンバーグ + ブロッコリー
          S('ellipse', { cx: cx - 1, cy: y - 3.6, rx: 11, ry: 5.2, fill: '#8c4c30', stroke: '#69341e', 'stroke-width': .7 }, g);
          S('ellipse', { cx: cx - 3, cy: y - 5.2, rx: 4, ry: 1.8, fill: '#b8714e', opacity: .6 }, g);
          S('circle', { cx: cx + 10, cy: y - 3.8, r: 3.6, fill: '#57bd6a' }, g);
        } else if (kind === 2) {
          // パンケーキ + バター
          S('ellipse', { cx, cy: y - 2.6, rx: 11, ry: 4.2, fill: '#e8a254' }, g);
          S('ellipse', { cx, cy: y - 5.8, rx: 10.5, ry: 4, fill: '#f2b86d', stroke: '#d48d3f', 'stroke-width': .6 }, g);
          S('rect', { x: cx - 3.2, y: y - 9.4, width: 6.4, height: 3.8, rx: 1, fill: '#fff2a6', stroke: '#e8c448', 'stroke-width': .6 }, g);
        } else if (kind === 3) {
          // トマトパスタ
          S('ellipse', { cx, cy: y - 4, rx: 11.5, ry: 5.5, fill: '#ffcf6e' }, g);
          S('circle', { cx, cy: y - 5.4, r: 4.8, fill: '#e85648' }, g);
          S('ellipse', { cx: cx + 2, cy: y - 8.5, rx: 3, ry: 1.5, transform: `rotate(-20 ${cx + 2} ${y - 8.5})`, fill: '#4db862' }, g);
        } else if (kind === 4) {
          // カレーライス
          S('ellipse', { cx: cx - 4, cy: y - 3.5, rx: 8, ry: 4.5, fill: '#ffffff' }, g);
          S('ellipse', { cx: cx + 4, cy: y - 3.2, rx: 8.5, ry: 4.5, fill: '#c97828' }, g);
          S('circle', { cx: cx + 5, cy: y - 4, r: 1.8, fill: '#ff8a4c' }, g);
        } else {
          // いちごショートケーキ
          S('path', { d: `M${cx - 9} ${y - 1} L${cx + 9} ${y - 1} L${cx + 9} ${y - 10} L${cx - 9} ${y - 10} Z`, fill: '#fff8ee', stroke: '#e5d4be', 'stroke-width': .7 }, g);
          S('line', { x1: cx - 9, y1: y - 5, x2: cx + 9, y2: y - 5, stroke: '#ff7a8a', 'stroke-width': 2 }, g);
          S('circle', { cx, cy: y - 11.5, r: 3.4, fill: '#ef4456' }, g);
        }
      },
      miss(ctx) {
        run(ctx.pan, [
          { transform: 'rotate(0deg)' },
          { transform: 'rotate(-34deg)', offset: .36 },
          { transform: 'rotate(8deg)', offset: .76 },
          { transform: 'rotate(0deg)' }
        ], { duration: 460, easing: OUT, composite: 'add' });
        const burnt = fitPivot(S('g', {}));
        S('circle', { cx: 0, cy: 0, r: 5.5, fill: '#7d4d2c' }, burnt);
        S('circle', { cx: -1.8, cy: -1.8, r: 2, fill: '#a86e44', opacity: .7 }, burnt);
        once(ctx.fx, burnt, [
          { transform: 'translate(238px,146px) rotate(0deg)', opacity: 1 },
          { transform: 'translate(284px,88px) rotate(190deg)', opacity: 1, offset: .45 },
          { transform: 'translate(310px,206px) rotate(360deg)', opacity: 0 }
        ], { duration: 820, easing: 'ease-in' });
        puff(ctx.fx, 238, 146, '#9ba3b0');
      }
    },

    /* === 大工：くぎを 打つ === */
    carpenter: {
      label: '大工',
      unit: 'くぎ',
      armBase: { l: 14, r: -24 },
      palette: {
        skin: '#ffdcba',
        hairHi: '#56504d', hair: '#332e2c', hairLo: '#1c1817', brow: '#2c2725',
        clothHi: '#7cc689', cloth: '#54a464', clothLo: '#387a46', clothEdge: 'rgba(29,74,40,.22)',
        sleeveHi: '#7cc689', sleeve: '#58a868', sleeveLo: '#3b7e49', cuff: '#f4e6c8',
        accentHi: '#e6b16a', accent: '#c98b42', accentLo: '#9b6324'
      },
      drawBackHair(g, ctx, hx, hy) {
        S('ellipse', { cx: hx, cy: hy, rx: 37, ry: 32, fill: ctx.url('hairBack') }, g);
      },
      drawFrontHair(g, ctx, hx, hy) {
        // 元気な ツンツン立体ヘア
        S('path', {
          d: `M${hx - 36} ${hy - 4}
              C${hx - 37} ${hy - 26}, ${hx - 20} ${hy - 39}, ${hx} ${hy - 39}
              C${hx + 20} ${hy - 39}, ${hx + 37} ${hy - 26}, ${hx + 36} ${hy - 4}
              L${hx + 28} ${hy - 13} L${hx + 20} ${hy - 8} L${hx + 12} ${hy - 17}
              L${hx + 3} ${hy - 9} L${hx - 6} ${hy - 18} L${hx - 15} ${hy - 9}
              L${hx - 24} ${hy - 15} L${hx - 31} ${hy - 6} Z`,
          fill: ctx.url('hair')
        }, g);
        // つやハイライト
        S('path', {
          d: `M${hx - 20} ${hy - 28} Q${hx - 2} ${hy - 35} ${hx + 16} ${hy - 28}`,
          fill: 'none', stroke: '#ffffff', 'stroke-width': 2.8, 'stroke-linecap': 'round', opacity: .2
        }, g);
      },
      drawOutfit(g, ctx, hx) {
        const u = ctx.url;
        // ベージュの えりあき
        S('path', {
          d: `M${hx - 13} 123 Q${hx} 135 ${hx + 13} 123 L${hx + 9} 120 Q${hx} 128 ${hx - 9} 120 Z`,
          fill: '#f5e7cb'
        }, g);
        // 丈夫な 立体ワークエプロン（肩ひも＋前ポケット＋真鍮リベット）
        S('rect', { x: hx - 18, y: 126, width: 6, height: 18, rx: 2, fill: u('accent') }, g);
        S('rect', { x: hx + 12, y: 126, width: 6, height: 18, rx: 2, fill: u('accent') }, g);
        S('path', {
          d: `M${hx - 23} 141 L${hx + 23} 141 L${hx + 27} 176 L${hx - 27} 176 Z`,
          fill: u('accent'), stroke: '#8c571d', 'stroke-width': .9
        }, g);
        // エプロンの 前ポケット
        S('rect', { x: hx - 15, y: 150, width: 30, height: 16, rx: 3.5, fill: '#b57632', stroke: '#8c571d', 'stroke-width': .8 }, g);
        S('line', { x1: hx, y1: 150, x2: hx, y2: 166, stroke: '#8c571d', 'stroke-width': .8 }, g);
        // 真鍮リベット 2つ
        [-15, 15].forEach(dx => {
          S('circle', { cx: hx + dx, cy: 143.5, r: 2.3, fill: u('gold'), stroke: '#9b6324', 'stroke-width': .6 }, g);
        });
      },
      scene(ctx) {
        const id = ctx.id;
        const defs = ctx.defs;

        // あたたかい 工房の光 + うしろの 有孔ボード（ペグボード）
        S('polygon', { points: '0,0 140,0 70,175 0,175', fill: ctx.url('beam') }, ctx.back);
        S('ellipse', { cx: HEAD_X, cy: 108, rx: 148, ry: 112, fill: ctx.url('aura') }, ctx.back);
        const peg = S('g', { opacity: .20 }, ctx.back);
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 5; col++) {
            S('circle', { cx: 212 + col * 20, cy: 32 + row * 20, r: 2, fill: '#8ca0bc' }, peg);
          }
        }
        // さりげない 掛けのこぎり＆さしがねシルエット（工房らしさ）
        const toolsBg = S('g', { opacity: .22 }, ctx.back);
        S('path', {
          d: 'M228 42 L278 36 L278 46 L232 52 Z',
          fill: '#7d8fa8'
        }, toolsBg);
        S('rect', { x: 277, y: 34, width: 12, height: 15, rx: 3.5, fill: 'none', stroke: '#b88450', 'stroke-width': 3.2 }, toolsBg);
        S('path', {
          d: 'M242 66 L284 66 L284 71 L248 71 L248 92 L242 92 Z',
          fill: '#7d8fa8'
        }, toolsBg);

        // 3D がっしりした 大工作業台
        drawDeskBase(ctx.front, defs, id, {
          topHi: '#e7bd84', topLo: '#ca9352',
          frontHi: '#ba8346', frontLo: '#96632d'
        });
        S('path', { d: 'M18 198 Q100 194 176 200 M205 210 Q258 206 302 212', stroke: '#7f5020', 'stroke-width': 1.5, fill: 'none', opacity: .28 }, ctx.front);
        // 左はしの 万力（バイス）ハンドル
        S('rect', { x: 14, y: 186, width: 22, height: 14, rx: 3, fill: ctx.url('metalDark') }, ctx.front);
        S('circle', { cx: 25, cy: 193, r: 4.5, fill: ctx.url('metal') }, ctx.front);

        // 2.5D の 立体の 木材（正面透視の 天面＋厚み正面＋木目）
        linGrad(defs, id('woodTop'), '0%', '0%', '100%', '0%', [['0%', '#f8dfb4'], ['100%', '#e8c186']]);
        linGrad(defs, id('woodFront'), '0%', '0%', '0%', '100%', [['0%', '#e0b376'], ['100%', '#c39050']]);

        const plank = pivot(S('g', {}, ctx.front), 248, 162);
        // 木材の 接地かげ
        S('ellipse', { cx: 248, cy: 173.5, rx: 58, ry: 4.5, fill: ctx.url('shadow') }, plank);
        // 天面（明るい 日なた・台形パースで ずれ無し）
        S('polygon', {
          points: '200,148 296,148 303,155 193,155',
          fill: ctx.url('woodTop'), stroke: '#cfa166', 'stroke-width': .8, 'stroke-linejoin': 'round'
        }, plank);
        // 正面（厚みのある 木肌）
        S('rect', {
          x: 193, y: 155, width: 110, height: 17, rx: 2,
          fill: ctx.url('woodFront'), stroke: '#b78548', 'stroke-width': 1
        }, plank);
        // 角の やわらかい ハイライト
        S('line', { x1: 195, y1: 155.8, x2: 301, y2: 155.8, stroke: '#fff6e3', 'stroke-width': 1.2, opacity: .65 }, plank);
        // 木目ディテール
        S('path', { d: 'M205 161.5 Q245 158.5 291 162 M212 167.5 Q256 165 295 167.5', stroke: '#b27f44', 'stroke-width': 1.4, fill: 'none', opacity: .48 }, plank);
        ctx.plank = plank;
      },
      props(ctx) {
        const id = ctx.id;
        const defs = ctx.defs;
        const u = ctx.url;

        // 3D ねじりはちまき（紅白ねじり＋右に なびく 結びひも！）
        const h = ctx.parts.hatHost;
        // 結びひも（うしろ）
        S('path', {
          d: `M${HEAD_X + 32} ${HEAD_Y - 22} Q${HEAD_X + 46} ${HEAD_Y - 28} ${HEAD_X + 51} ${HEAD_Y - 21} Q${HEAD_X + 43} ${HEAD_Y - 17} ${HEAD_X + 33} ${HEAD_Y - 17} Z`,
          fill: '#f7f9fc', stroke: '#d2dae6', 'stroke-width': .8
        }, h);
        S('path', {
          d: `M${HEAD_X + 32} ${HEAD_Y - 18} Q${HEAD_X + 45} ${HEAD_Y - 16} ${HEAD_X + 49} ${HEAD_Y - 9} Q${HEAD_X + 40} ${HEAD_Y - 10} ${HEAD_X + 31} ${HEAD_Y - 14} Z`,
          fill: '#e64952'
        }, h);
        // はちまき本体（丸み＋紅白ねじりライン）
        S('path', {
          d: `M${HEAD_X - 35} ${HEAD_Y - 18} Q${HEAD_X} ${HEAD_Y - 27} ${HEAD_X + 35} ${HEAD_Y - 18}
              L${HEAD_X + 34} ${HEAD_Y - 10} Q${HEAD_X} ${HEAD_Y - 19} ${HEAD_X - 34} ${HEAD_Y - 10} Z`,
          fill: '#ffffff', stroke: '#d2dae6', 'stroke-width': .9
        }, h);
        // ねじりの 赤ストライプ
        [-22, -7, 8, 22].forEach(dx => {
          S('path', {
            d: `M${HEAD_X + dx - 4} ${HEAD_Y - 20.5} L${HEAD_X + dx + 4} ${HEAD_Y - 13}`,
            stroke: '#e64952', 'stroke-width': 3.4, 'stroke-linecap': 'round'
          }, h);
        });
        // 結び目
        S('circle', { cx: HEAD_X + 33, cy: HEAD_Y - 16, r: 4.5, fill: '#ffffff', stroke: '#cfd7e3', 'stroke-width': .9 }, h);

        // 3D クローハンマー（右手の 水平アンカーに 装着！）
        linGrad(defs, id('hamWood'), '0%', '0%', '100%', '0%', [
          ['0%', '#d99e62'], ['50%', '#b97b3f'], ['100%', '#8f5826']
        ]);
        const hand = ctx.armR._hand;
        const ham = pivot(S('g', {}, ctx.armR._toolAnchor), hand.x, hand.y);
        const inner = S('g', { transform: `rotate(24 ${hand.x} ${hand.y})` }, ham);
        // 握りやすい 立体木柄（アッシュ材）
        S('path', {
          d: `M${hand.x - 4.2} ${hand.y + 8} L${hand.x - 3.6} ${hand.y - 46} L${hand.x + 3.6} ${hand.y - 46} L${hand.x + 4.8} ${hand.y + 8} Q${hand.x} ${hand.y + 11} ${hand.x - 4.2} ${hand.y + 8} Z`,
          fill: ctx.url('hamWood'), stroke: '#7a481c', 'stroke-width': .8
        }, inner);
        // グリップの 滑り止めバンド
        S('rect', { x: hand.x - 4.6, y: hand.y - 6, width: 9.2, height: 11, rx: 2, fill: '#3d4654' }, inner);
        // 鍛造スチール製 立体ハンマーヘッド（右：打撃面 / 左：釘抜きクロー）
        S('path', {
          d: `M${hand.x - 19} ${hand.y - 48}
              C${hand.x - 14} ${hand.y - 56}, ${hand.x - 4} ${hand.y - 57}, ${hand.x + 8} ${hand.y - 56}
              L${hand.x + 17} ${hand.y - 57} L${hand.x + 17} ${hand.y - 41} L${hand.x + 8} ${hand.y - 42}
              C${hand.x - 2} ${hand.y - 42}, ${hand.x - 10} ${hand.y - 45}, ${hand.x - 15} ${hand.y - 42}
              C${hand.x - 18} ${hand.y - 44}, ${hand.x - 20} ${hand.y - 46}, ${hand.x - 19} ${hand.y - 48} Z`,
          fill: ctx.url('metal'), stroke: '#5a6475', 'stroke-width': .9
        }, inner);
        // 打撃面の 金属べべる
        S('rect', { x: hand.x + 13.5, y: hand.y - 57.5, width: 4.5, height: 17, rx: 1.5, fill: '#6c778a' }, inner);
        // ヘッド上面の キラッと 金属ハイライト
        S('line', { x1: hand.x - 6, y1: hand.y - 53.5, x2: hand.x + 11, y2: hand.y - 53.5, stroke: '#ffffff', 'stroke-width': 2.2, 'stroke-linecap': 'round', opacity: .82 }, inner);

        // 手が 柄を しっかり握る 立体指カバー
        addGripOverlay(ctx.armR, u);
        ctx.hammer = ham;
      },
      tap(ctx) {
        // 予備動作（引き）→ 鋭い振り下ろし → 余韻のある 戻り
        run(ctx.hammer, [
          { transform: 'rotate(0deg)', offset: 0 },
          { transform: 'rotate(-18deg)', offset: .20 },
          { transform: 'rotate(62deg)', offset: .52 },
          { transform: 'rotate(0deg)', offset: 1 }
        ], { duration: 295, easing: 'cubic-bezier(.4,0,.5,1)', composite: 'add' });
        run(ctx.armR, [
          { transform: 'rotate(0deg)' },
          { transform: 'rotate(-7deg)', offset: .20 },
          { transform: 'rotate(15deg)', offset: .52 },
          { transform: 'rotate(0deg)' }
        ], { duration: 295, easing: OUT, composite: 'add' });

        // インパクトの しゅんかん（約145ms後）：火花＋木くず＋木材の わずかな 振動！
        schedule(() => {
          if (!state.ctx || state.ctx !== ctx) return;
          sparkle(ctx.fx, 238, 144, '#ffe17a', .95);
          // 飛びちる 木くず 2粒
          for (let i = 0; i < 2; i++) {
            const chip = fitPivot(S('rect', { x: -3, y: -1.5, width: 6, height: 3, rx: 1, fill: '#f2cb91' }));
            once(ctx.fx, chip, [
              { transform: 'translate(238px,148px) rotate(0deg)', opacity: 1 },
              { transform: `translate(${238 + rand(-24, 24)}px,${148 + rand(-24, -10)}px) rotate(${rand(-160, 160)}deg)`, opacity: 0 }
            ], { duration: 360, easing: OUT });
          }
          // 木材が トンッと 微振動
          run(ctx.plank, [
            { transform: 'translateY(0)' },
            { transform: 'translateY(1.8px)', offset: .35 },
            { transform: 'translateY(0)' }
          ], { duration: 160, easing: OUT, composite: 'add' });
        }, 145);
      },
      done(ctx) {
        sparkle(ctx.fx, 240, 136, '#fff29c', 1.1);
        return 0;
      },
      stackItem(ctx, i, g) {
        const x = 212 + i * 16;
        if (x > 296) return;
        // 木材に 落ちる くぎの かげ
        S('ellipse', { cx: x + 1.2, cy: 151.5, rx: 5.5, ry: 2, fill: '#8a5d29', opacity: .38 }, g);
        // 立体金属シャンク
        S('rect', { x: x - 1.8, y: 141, width: 3.6, height: 10.5, rx: 1, fill: ctx.url('metal') }, g);
        // 面取りされた くぎの あたま + 光点
        S('ellipse', { cx: x, cy: 141, rx: 5.2, ry: 2.6, fill: ctx.url('metal'), stroke: '#6c778a', 'stroke-width': .7 }, g);
        S('ellipse', { cx: x - 1.4, cy: 140.4, rx: 1.8, ry: .9, fill: '#ffffff', opacity: .88 }, g);
      },
      miss(ctx) {
        run(ctx.hammer, [
          { transform: 'rotate(0deg)' },
          { transform: 'rotate(64deg)', offset: .32 },
          { transform: 'rotate(42deg)', offset: .64 },
          { transform: 'rotate(0deg)' }
        ], { duration: 640, easing: OUT, composite: 'add' });
        const boom = fitPivot(S('g', {}));
        S('path', {
          d: 'M0 -15 L4.5 -5 L15 -4 L7 3.5 L10 14 L0 8.5 L-10 14 L-7 3.5 L-15 -4 L-4.5 -5 Z',
          fill: '#ff5d5d', stroke: '#ffd15c', 'stroke-width': 1.4
        }, boom);
        S('circle', { cx: 0, cy: 0, r: 4, fill: '#fff4a3' }, boom);
        once(ctx.fx, boom, [
          { transform: 'translate(204px,148px) scale(.28) rotate(-18deg)', opacity: 1 },
          { transform: 'translate(204px,136px) scale(1.45) rotate(16deg)', opacity: 0 }
        ], { duration: 620, easing: OUT });
      }
    }
  };

  const JOB_IDS = Object.keys(JOBS);
  const STACK_MAX = 6;

  /**
   * 「おまかせ」。だれと はたらくかを **アプリが くじで 決めます**。
   */
  const RANDOM = 'random';

  /** つづけて 同じ しごとに ならない ように、いまの ものを のぞいて 引きます */
  function pickJob(exclude) {
    const list = JOB_IDS.filter(id => id !== exclude);
    const from = list.length ? list : JOB_IDS;
    return from[Math.floor(Math.random() * from.length)];
  }

  // ------------------------------------------------------------------
  // 本体 と タイマー管理
  // ------------------------------------------------------------------

  const state = {
    host: null, ctx: null, job: null, jobId: '',
    stack: 0, flip: false, idle: [], timers: new Set(),
    faceTimer: 0, doneTimer: 0,
    // 'おまかせ' で 出して いるか（そのときだけ くじを 引きなおします）
    random: false, rerollTimer: 0
  };

  /** stop() で 一括かたづけ できる 安全な setTimeout */
  function schedule(fn, ms) {
    const t = setTimeout(() => {
      state.timers.delete(t);
      fn();
    }, ms);
    state.timers.add(t);
    return t;
  }

  /**
   * キャラクターを 出します。
   * @param {HTMLElement} host おく ところ
   * @param {Object} [opt] { job: 'office'|'chef'|'carpenter'|'random' }
   *   'random'（や 知らない 名前）なら くじで 決めます。
   */
  function render(host, opt) {
    if (!host) return;
    stop();
    state.host = host;
    state.stack = 0;
    state.flip = false;

    const want = opt ? opt.job : '';
    state.random = !JOBS[want];
    const jobId = state.random ? pickJob(state.jobId) : want;
    const job = JOBS[jobId];
    state.jobId = jobId;
    state.job = job;

    host.className = 'buddy';
    host.innerHTML = '';

    const uid = ++renderUid;
    const id = name => `bd${uid}-${name}`;
    const url = name => `url(#bd${uid}-${name})`;

    const svg = S('svg', {
      class: 'buddy-svg', viewBox: '0 0 320 230',
      role: 'img', 'aria-label': `${job.label}の ちびキャラ。打つと はたらきます`
    }, host);

    const defs = S('defs', {}, svg);
    buildSharedDefs(defs, id, job.palette);

    // かさねる じゅんばん … うしろ → キャラ → まえ（つくえ） → できあがった もの → 効果
    const ctx = {
      svg, defs, id, url, idle: state.idle,
      back: S('g', {}, svg),
      char: S('g', {}, svg),
      front: S('g', {}, svg)
    };

    job.scene(ctx);
    ctx.parts = buildBody(ctx.char, ctx, job);
    ctx.armL = ctx.parts.armL;
    ctx.armR = ctx.parts.armR;
    ctx.stackG = pivot(S('g', {}, svg), 64, 166);
    ctx.fx = S('g', {}, svg);
    if (job.props) job.props(ctx);

    state.ctx = ctx;
    startIdle();
    drawStack();
  }

  /**
   * 待機の うごき。**一度 はじめたら 止めません。**
   * 1打の うごきは この 上に 足されるだけ なので、
   * 打っている あいだも 息が とまりません。
   */
  function startIdle() {
    const c = state.ctx;
    if (!c) return;
    const add = a => { if (a) state.idle.push(a); };

    // 息づかい（立体感のある わずかな 伸縮）
    add(run(c.parts.breath, [
      { transform: 'translateY(0) scale(1, 1)' },
      { transform: 'translateY(-2.4px) scale(1.008, 1.014)' },
      { transform: 'translateY(0) scale(1, 1)' }
    ], { duration: 2500, iterations: Infinity, easing: 'ease-in-out' }));

    // 体の わずかな ゆれ（息づかいと 周期を ずらすと 生きて 見えます）
    add(run(c.parts.lean, [
      { transform: 'rotate(-.85deg)' },
      { transform: 'rotate(.85deg)' },
      { transform: 'rotate(-.85deg)' }
    ], { duration: 4100, iterations: Infinity, easing: 'ease-in-out' }));

    // まばたき（ほとんどの 時間は 開いて いて、ときどき さっと 1回）
    add(run(c.parts.face.eyes, [
      { transform: 'scaleY(1)', offset: 0 },
      { transform: 'scaleY(1)', offset: .91 },
      { transform: 'scaleY(.06)', offset: .95 },
      { transform: 'scaleY(1)', offset: .985 },
      { transform: 'scaleY(1)', offset: 1 }
    ], { duration: 4300, iterations: Infinity, easing: 'ease-in-out' }));
  }

  // ------------------------------------------------------------------
  // 表情
  // ------------------------------------------------------------------

  /**
   * 顔を かえます。**濃さを 行き来させる**だけ なので、
   * どの 顔から どの 顔へでも すっと 移ります。
   * @param {string} name 'normal' | 'happy' | 'sad'
   * @param {number} [holdMs] この 時間が すぎたら ふつうの 顔に もどします
   */
  function setFace(name, holdMs) {
    const f = state.ctx ? state.ctx.parts.face : null;
    if (!f) return;
    if (state.faceTimer) { clearTimeout(state.faceTimer); state.faceTimer = 0; }

    ['normal', 'happy', 'sad'].forEach(key => {
      const el = f[key];
      const to = key === name ? 1 : 0;
      if (reduced() || typeof el.animate !== 'function') { el.setAttribute('opacity', to); return; }
      el.setAttribute('opacity', to);
      run(el, [{ opacity: to === 1 ? 0 : 1 }, { opacity: to }], { duration: 140, easing: 'ease-out' });
    });
    f.current = name;

    if (holdMs && name !== 'normal') {
      state.faceTimer = setTimeout(() => { state.faceTimer = 0; setFace('normal'); }, holdMs);
    }
  }

  // ------------------------------------------------------------------
  // できあがった ものの 山
  // ------------------------------------------------------------------

  function drawStack() {
    const c = state.ctx;
    if (!c) return;
    c.stackG.innerHTML = '';
    for (let i = 0; i < state.stack; i++) state.job.stackItem(c, i, c.stackG);
  }

  function addStack() {
    const c = state.ctx;
    if (!c) return;
    state.stack = Math.min(STACK_MAX, state.stack + 1);
    drawStack();
    run(c.stackG, [
      { transform: 'scale(.76, .68) translateY(5px)', opacity: .45 },
      { transform: 'scale(1.06, 1.08) translateY(-2px)', opacity: 1, offset: .6 },
      { transform: 'scale(1, 1) translateY(0)', opacity: 1 }
    ], { duration: 340, easing: SPRING });
  }

  /** ジャンプに 合わせた 接地かげの 立体連動（浮くと 影が すぼみます） */
  function bounceShadow(c, duration) {
    run(c.parts.groundShadow, [
      { transform: 'scaleX(1)', opacity: 1, offset: 0 },
      { transform: 'scaleX(.76)', opacity: .55, offset: .38 },
      { transform: 'scaleX(1.06)', opacity: 1, offset: .76 },
      { transform: 'scaleX(1)', opacity: 1, offset: 1 }
    ], { duration, easing: OUT });
  }

  /** ぼうし・はちまき・アホ毛の 遅れバウンド（二次モーション） */
  function bounceAccessory(c, strength, duration) {
    run(c.parts.hatHost, [
      { transform: 'translateY(0) scale(1, 1)', offset: 0 },
      { transform: `translateY(${1.2 * strength}px) scale(${1 + .03 * strength}, ${1 - .04 * strength})`, offset: .22 },
      { transform: `translateY(${-3.2 * strength}px) scale(${1 - .02 * strength}, ${1 + .05 * strength})`, offset: .58 },
      { transform: 'translateY(0) scale(1, 1)', offset: 1 }
    ], { duration: duration || 340, easing: SPRING, composite: 'add' });
  }

  // ------------------------------------------------------------------
  // そとから 呼ぶ ところ
  // ------------------------------------------------------------------

  /** 1打 正しく 打てた */
  function tap() {
    const c = state.ctx;
    if (!c) return;
    state.flip = !state.flip;
    const arm = state.flip ? c.armL : c.armR;
    state.job.tap(c, arm, state.flip);

    // 立体感のある うなずき + かすかな 首かしげ（左右で リズムが 生まれます）
    const tilt = state.flip ? -1.4 : 1.4;
    run(c.parts.head, [
      { transform: 'translateY(0) rotate(0deg)' },
      { transform: `translateY(2.2px) rotate(${tilt}deg)`, offset: .45 },
      { transform: 'translateY(0) rotate(0deg)' }
    ], { duration: 200, easing: OUT, composite: 'add' });

    // からだの リズム前かがみ
    run(c.parts.lean, [
      { transform: 'rotate(0deg)' },
      { transform: 'rotate(1deg)' },
      { transform: 'rotate(0deg)' }
    ], { duration: 400, easing: 'ease-in-out', composite: 'add' });

    // ぼうし・かざりの 軽い 遅れゆれ
    bounceAccessory(c, .55, 250);
  }

  /** お題を 1つ 打ちきった */
  function done() {
    const c = state.ctx;
    if (!c) return;
    const wait = state.job.done(c) || 0;

    // 2D/3D アニメらしい スクワッシュ＆ストレッチ・ジャンプ
    run(c.parts.react, [
      { transform: 'translateY(0) scale(1, 1)', offset: 0 },
      { transform: 'translateY(2px) scale(1.06, .94)', offset: .14 },
      { transform: 'translateY(-14px) scale(.97, 1.05)', offset: .46 },
      { transform: 'translateY(2.5px) scale(1.04, .96)', offset: .78 },
      { transform: 'translateY(0) scale(1, 1)', offset: 1 }
    ], { duration: 540, easing: SPRING, composite: 'add' });

    bounceShadow(c, 540);
    bounceAccessory(c, 1.15, 560);

    sparkle(c.fx, HEAD_X - 48, 66, '#ffd15c', 1.1);
    sparkle(c.fx, HEAD_X + 48, 74, '#64d18c', .95);
    setFace('happy', 820);

    if (state.doneTimer) clearTimeout(state.doneTimer);
    if (wait > 0) state.doneTimer = setTimeout(() => { state.doneTimer = 0; addStack(); }, wait);
    else addStack();
  }

  /** 打ちまちがえた */
  function miss() {
    const c = state.ctx;
    if (!c) return;
    run(c.parts.react, [
      { transform: 'translateX(0) rotate(0deg) scale(1, 1)' },
      { transform: 'translateX(-6px) rotate(-4deg) scale(1.03, .96)' },
      { transform: 'translateX(6px) rotate(4deg) scale(.98, 1.02)' },
      { transform: 'translateX(-3.5px) rotate(-2.2deg) scale(1.01, .99)' },
      { transform: 'translateX(0) rotate(0deg) scale(1, 1)' }
    ], { duration: 440, easing: 'ease-in-out', composite: 'add' });

    bounceAccessory(c, .9, 420);
    sweat(c.fx, HEAD_X + 32, 64);
    state.job.miss(c);
    setFace('sad', 780);
  }

  /**
   * れんぞくが 10・20・30…に なった。
   * **できあがった ものは ふえません。**よろこぶ だけに します。
   */
  function combo() {
    const c = state.ctx;
    if (!c) return;
    run(c.parts.react, [
      { transform: 'translateY(0) rotate(0deg) scale(1, 1)', offset: 0 },
      { transform: 'translateY(2px) rotate(0deg) scale(1.07, .93)', offset: .14 },
      { transform: 'translateY(-16px) rotate(-4.5deg) scale(.96, 1.06)', offset: .42 },
      { transform: 'translateY(1px) rotate(3deg) scale(1.03, .97)', offset: .74 },
      { transform: 'translateY(0) rotate(0deg) scale(1, 1)', offset: 1 }
    ], { duration: 640, easing: SPRING, composite: 'add' });

    bounceShadow(c, 640);
    bounceAccessory(c, 1.35, 640);
    sparkle(c.fx, HEAD_X - 44, 56, '#ffd15c', 1.15);
    sparkle(c.fx, HEAD_X + 44, 62, '#6bc8ff', 1.05);
    confettiBurst(c.fx, HEAD_X, 66, 6);
    setFace('happy', 660);
  }

  /** ひとまわり できた。つみ上げた ものを おさめて 大よろこび */
  function cheer() {
    const c = state.ctx;
    if (!c) return;

    // 二段ジャンプの 大よろこび（スクワッシュ＆ストレッチ）
    run(c.parts.react, [
      { transform: 'translateY(0) scale(1, 1)', offset: 0 },
      { transform: 'translateY(3px) scale(1.08, .92)', offset: .10 },
      { transform: 'translateY(-19px) scale(.95, 1.07)', offset: .32 },
      { transform: 'translateY(2px) scale(1.06, .94)', offset: .54 },
      { transform: 'translateY(-11px) scale(.98, 1.04)', offset: .76 },
      { transform: 'translateY(0) scale(1, 1)', offset: 1 }
    ], { duration: 980, easing: SPRING, composite: 'add' });

    // 両手を バンザイぎみに 上げて よろこぶ
    run(c.armL, [
      { transform: 'rotate(0deg)' },
      { transform: 'rotate(32deg)', offset: .32 },
      { transform: 'rotate(16deg)', offset: .56 },
      { transform: 'rotate(28deg)', offset: .76 },
      { transform: 'rotate(0deg)' }
    ], { duration: 940, easing: SNAP, composite: 'add' });
    run(c.armR, [
      { transform: 'rotate(0deg)' },
      { transform: 'rotate(-26deg)', offset: .32 },
      { transform: 'rotate(-12deg)', offset: .56 },
      { transform: 'rotate(-24deg)', offset: .76 },
      { transform: 'rotate(0deg)' }
    ], { duration: 940, easing: SNAP, composite: 'add' });

    bounceShadow(c, 980);
    bounceAccessory(c, 1.5, 920);

    [[-54, 60, '#ffd15c'], [56, 66, '#64d18c'], [-18, 44, '#6bc8ff'], [28, 42, '#ff8aa3']]
      .forEach(([dx, y, color], i) => {
        schedule(() => {
          if (!state.ctx || state.ctx !== c) return;
          sparkle(c.fx, HEAD_X + dx, y, color, 1.15);
        }, i * 90);
      });
    confettiBurst(c.fx, HEAD_X, 58, 12);
    setFace('happy', 1400);

    // つみ上げた ものは きれいに おさめて、つぎの しゅうは また 空から
    run(c.stackG, [
      { transform: 'translateY(0) scale(1)', opacity: 1 },
      { transform: 'translateY(-18px) scale(1.04)', opacity: 0 }
    ], { duration: 480, easing: OUT });
    schedule(() => {
      if (!state.ctx || state.ctx !== c) return;
      state.stack = 0;
      drawStack();
    }, 460);
  }

  /**
   * つぎの キャラクターを くじで 引きなおします（ドリルが ひとまわり
   * 終わった ところで よばれます）。
   *
   * @param {number} [delayMs] 待つ 時間
   * @returns {boolean} 引きなおすか
   */
  function reroll(delayMs) {
    if (!state.random || !state.host) return false;
    if (state.rerollTimer) clearTimeout(state.rerollTimer);
    const host = state.host;
    state.rerollTimer = setTimeout(() => {
      state.rerollTimer = 0;
      if (!host.isConnected) return;
      render(host, { job: RANDOM });
    }, delayMs > 0 ? delayMs : 1800);
    return true;
  }

  /** タイマーと うごきを かたづけます（画面を はなれる とき） */
  function stop() {
    state.idle.forEach(a => { try { a.cancel(); } catch (e) { /* もう 消えて います */ } });
    state.idle = [];
    state.timers.forEach(t => clearTimeout(t));
    state.timers.clear();
    if (state.faceTimer) clearTimeout(state.faceTimer);
    if (state.doneTimer) clearTimeout(state.doneTimer);
    if (state.rerollTimer) clearTimeout(state.rerollTimer);
    state.faceTimer = 0;
    state.doneTimer = 0;
    state.rerollTimer = 0;
  }

  /** せっていの ならびに つかう しごとの 一覧 */
  function jobs() {
    return JOB_IDS.map(id => ({ id, label: JOBS[id].label, unit: JOBS[id].unit }));
  }

  /**
   * 知らない しごと名を うけとっても 落ちないように します。
   * 'random'（おまかせ）は そのまま 返します。せってい画面が
   * 「どれが えらばれて いるか」を 出すのに つかいます。
   */
  function normalizeJob(id) { return JOBS[id] ? id : RANDOM; }

  global.Typa = global.Typa || {};
  global.Typa.Buddy = {
    RANDOM, render, reroll, tap, done, miss, combo, cheer, stop, jobs, normalizeJob,
    get job() { return state.jobId; },
    get produced() { return state.stack; }
  };
})(window);
