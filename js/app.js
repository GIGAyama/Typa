/**
 * =====================================================================
 * app.js — 画面の 組み立てと 全体の うごき
 * =====================================================================
 * 階層は nav.js が もち、この ファイルは それぞれの 画面の 中身を 描きます。
 *
 *   ホーム
 *   れんしゅう → コース → ステージ（練習）→ けっか
 *   　　　　　  → チャレンジ（時間ぎめ）→ けっか
 *   　　　　　  → にがて とっくん → けっか
 *   きろく → バッジ
 *   せってい → ローマ字ひょう
 *
 * どの 画面でも、下部バーの「もどる」・画面の はしからの スワイプ・
 * 端末の 戻る の 3つが 同じ 1つの 動きに なります（nav.js を 見てください）。
 *
 * ■ このアプリは 外へ 出ません
 * ほかの サイトへの リンクも、きろくを 送る しくみも もちません。
 * ためた ものは すべて この 端末の 中だけに あります（store.js）。
 */
(function (global) {
  'use strict';

  const T = global.Typa;
  const icon = T.icon;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const APP_VERSION = '2.0.0';

  let view = null;
  let installPrompt = null;
  let leaveArmedAt = 0;         // 練習中に「もどる」を 1回 おした 時こく

  /** チャレンジ画面で えらんで いる 中身（画面を いききしても のこします） */
  const challengePick = { pool: 'word', seconds: 60 };

  // ------------------------------------------------------------------
  // 共通の 部品
  // ------------------------------------------------------------------

  function stars(n) {
    let html = '<span class="stars" aria-label="ほし ' + n + 'つ">';
    for (let i = 1; i <= 3; i++) html += `<span class="star${i <= n ? ' on' : ''}">${icon('star')}</span>`;
    return html + '</span>';
  }

  function card(inner, cls) { return `<section class="card ${cls || ''}">${inner}</section>`; }

  function pageTitle(title, note) {
    return `<header class="page-head"><h1>${esc(title)}</h1>${note ? `<p class="page-note">${esc(note)}</p>` : ''}</header>`;
  }

  /** レベルと けいけんちの おび。ホームと きろくの 両方で つかいます */
  function levelBox(lv) {
    return `
      <div class="level-box">
        <div class="level-top">
          <span class="level-badge">Lv.${lv.level}</span>
          <span class="level-rank">${esc(lv.rank)}</span>
          <span class="level-xp">つぎの レベルまで あと ${Math.max(0, lv.need - lv.xp)}</span>
        </div>
        <div class="level-bar" role="img" aria-label="レベル ${lv.level}、つぎまで ${Math.max(0, lv.need - lv.xp)}">
          <span style="width:${Math.round(lv.ratio * 100)}%"></span>
        </div>
      </div>`;
  }

  /** れんぞく日数の 1行 */
  function streakLine(st) {
    if (st.days <= 0) return `<p class="streak"><span class="streak-off">${icon('fire')}</span>きょう れんしゅうすると、れんぞく 1日目です。</p>`;
    return `<p class="streak"><span class="streak-on">${icon('fire')}</span>
      <b>${st.days}日</b> つづいて います。${st.todayDone ? 'きょうの ぶんは できました。' : 'きょうも やると のびます。'}</p>`;
  }

  // ------------------------------------------------------------------
  // ホーム
  // ------------------------------------------------------------------

  function renderHome() {
    const today = T.Store.todaySummary();
    const best = T.Store.bestOverall();
    const progress = T.Store.getProgress();
    const next = findNextStage(progress);
    const lv = T.Awards.levelOf(T.Store.getAwards().xp);
    const st = T.Store.streak();
    const weakReady = T.Store.missSummary().keys.filter(k => /^[a-z0-9;,./-]$/.test(k)).length >= 2;

    view.innerHTML = `
      ${pageTitle('Typa', 'キーボードと なかよく なろう')}

      ${card(`
        ${levelBox(lv)}
        ${streakLine(st)}
        <div class="today">
          <div class="today-item"><span class="today-num">${today.count}</span><span class="today-unit">かい</span><span class="today-label">きょうの れんしゅう</span></div>
          <div class="today-item"><span class="today-num">${today.keys}</span><span class="today-unit">だ</span><span class="today-label">きょう 打った数</span></div>
          <div class="today-item"><span class="today-num">${today.minutes}</span><span class="today-unit">ふん</span><span class="today-label">きょうの じかん</span></div>
        </div>`, 'card-today')}

      ${next ? card(`
        <p class="lead">${icon('play')} つづきから やってみよう</p>
        <button class="btn btn-primary btn-big" data-go-stage="${esc(next.course.id)}:${esc(next.stage.id)}">
          <span class="btn-sub">${esc(next.course.short)}</span>
          <span class="btn-main">${esc(next.stage.title)}</span>
          ${icon('next')}
        </button>`, 'card-next') : ''}

      ${card(`
        <p class="lead">${icon('sparkle')} とくべつ れんしゅう</p>
        <div class="special-grid">
          <button class="special-tile tile-amber" data-go-screen="challenge">
            <span class="tile-icon">${icon('timer')}</span>
            <span class="tile-title">チャレンジ</span>
            <span class="tile-note">時間ないに どれだけ 打てるか</span>
          </button>
          <button class="special-tile tile-blue" data-go-weak ${weakReady ? '' : 'disabled'}>
            <span class="tile-icon">${icon('finger')}</span>
            <span class="tile-title">にがて とっくん</span>
            <span class="tile-note">${weakReady
              ? 'まちがえやすい キーだけ あつめました'
              : 'すこし れんしゅうすると つかえます'}</span>
          </button>
        </div>`, 'card-special')}

      ${card(`
        <p class="lead">${icon('keyboard')} れんしゅうを えらぶ</p>
        <div class="course-grid">
          ${T.Lessons.COURSES.map(c => {
            const cleared = c.stages.filter(s => (progress[s.id] || {}).clears > 0).length;
            return `
            <button class="course-tile tile-${c.color}" data-go-course="${esc(c.id)}">
              <span class="tile-icon">${icon(c.icon)}</span>
              <span class="tile-title">${esc(c.title)}</span>
              <span class="tile-note">${esc(c.note)}</span>
              <span class="tile-count">${cleared} / ${c.stages.length} ステージ</span>
            </button>`;
          }).join('')}
        </div>`)}

      ${best ? card(`
        <p class="lead">${icon('trophy')} じぶんの さいこう記録</p>
        <div class="best-row">
          <div><b>${best.kps.toFixed(1)}</b><span>打/びょう</span></div>
          <div><b>${Math.round(best.accuracy)}</b><span>% 正かくさ</span></div>
          <div><b>${best.count}</b><span>かい れんしゅう</span></div>
        </div>`) : ''}
    `;
    bindGoButtons();
  }

  /** まだ ★3 に なっていない、いちばん さいしょの ステージ */
  function findNextStage(progress) {
    for (const course of T.Lessons.COURSES) {
      for (const stage of course.stages) {
        const p = progress[stage.id];
        if (!p || p.stars < 3) return { course, stage };
      }
    }
    const course = T.Lessons.COURSES[0];
    return { course, stage: course.stages[0] };
  }

  // ------------------------------------------------------------------
  // コース一覧 / ステージ一覧
  // ------------------------------------------------------------------

  function renderCourses() {
    const progress = T.Store.getProgress();
    view.innerHTML = `
      ${pageTitle('れんしゅう', 'コースを えらんでね')}
      <div class="course-list">
        ${T.Lessons.COURSES.map(c => {
          const cleared = c.stages.filter(s => (progress[s.id] || {}).clears > 0).length;
          return `
          <button class="course-row tile-${c.color}" data-go-course="${esc(c.id)}">
            <span class="row-icon">${icon(c.icon)}</span>
            <span class="row-body">
              <span class="row-title">${esc(c.title)}</span>
              <span class="row-note">${esc(c.note)}</span>
              <span class="row-bar"><span style="width:${Math.round(cleared / c.stages.length * 100)}%"></span></span>
              <span class="row-count">${cleared} / ${c.stages.length} ステージ</span>
            </span>
            <span class="row-arrow">${icon('next')}</span>
          </button>`;
        }).join('')}

        <button class="course-row tile-amber" data-go-screen="challenge">
          <span class="row-icon">${icon('timer')}</span>
          <span class="row-body">
            <span class="row-title">チャレンジ</span>
            <span class="row-note">30・60・120びょうで どれだけ 打てるか</span>
            <span class="row-count">${challengeBestLine()}</span>
          </span>
          <span class="row-arrow">${icon('next')}</span>
        </button>
      </div>`;
    bindGoButtons();
  }

  function challengeBestLine() {
    const all = T.Store.getChallenge();
    const ids = Object.keys(all);
    if (ids.length === 0) return 'まだ きろくが ありません';
    const top = ids.reduce((a, b) => (all[a].keys >= all[b].keys ? a : b));
    return `さいこう ${all[top].keys} だ`;
  }

  function renderCourse(params) {
    const course = T.Lessons.findCourse(params.courseId);
    if (!course) { T.Nav.selectTab('courses'); return; }
    const progress = T.Store.getProgress();
    view.innerHTML = `
      ${pageTitle(course.title, course.note)}
      ${course.note2 ? `<p class="hint-box">${icon('info')} ${esc(course.note2)}</p>` : ''}
      ${course.id === 'romaji' ? `<p class="course-extra">
        <button class="btn btn-outline" data-go-screen="romaji-table">${icon('grid')} ローマ字ひょうを 見る</button></p>` : ''}
      <div class="stage-list">
        ${course.stages.map((s, i) => {
          const p = progress[s.id] || { clears: 0, stars: 0, bestKps: 0, bestAccuracy: 0 };
          return `
          <button class="stage-row" data-go-stage="${esc(course.id)}:${esc(s.id)}">
            <span class="stage-no">${i + 1}</span>
            <span class="stage-body">
              <span class="stage-title">${esc(s.title)}${s.grade
                ? `<span class="grade-chip">めやす ${s.grade}年</span>` : ''}</span>
              <span class="stage-note">${esc(s.note)}</span>
              ${p.clears > 0 ? `<span class="stage-best">さいこう ${p.bestKps.toFixed(1)} 打/びょう ・ 正かくさ ${Math.round(p.bestAccuracy)}%</span>` : ''}
            </span>
            ${stars(p.stars)}
            <span class="row-arrow">${icon('next')}</span>
          </button>`;
        }).join('')}
      </div>`;
    bindGoButtons();
  }

  // ------------------------------------------------------------------
  // チャレンジ（時間ぎめ）を えらぶ
  // ------------------------------------------------------------------

  function renderChallenge() {
    const all = T.Store.getChallenge();
    const id = `ch-${challengePick.pool}-${challengePick.seconds}`;
    const best = all[id];

    view.innerHTML = `
      ${pageTitle('チャレンジ', '時間ないに どれだけ 打てるかな')}
      <p class="hint-box">${icon('info')} 正しく 打てた 数が スコアです。
      まちがえると すすまないので、あわてず ていねいに 打つほうが たくさん 打てます。</p>

      ${card(`
        <p class="lead">${icon('timer')} じかん</p>
        <div class="seg" role="radiogroup" aria-label="じかん">
          ${T.Lessons.CHALLENGE_SECONDS.map(sec => `
            <button class="seg-btn${challengePick.seconds === sec ? ' on' : ''}" role="radio"
              aria-checked="${challengePick.seconds === sec}" data-pick="seconds" data-value="${sec}">
              ${sec}びょう</button>`).join('')}
        </div>`)}

      ${card(`
        <p class="lead">${icon('word')} なにを 打つ？</p>
        <div class="pool-grid">
          ${T.Lessons.CHALLENGE_POOLS.map(p => `
            <button class="pool-tile${challengePick.pool === p.id ? ' on' : ''}" data-pick="pool" data-value="${p.id}">
              <span class="tile-icon">${icon(p.icon)}</span>
              <span class="tile-title">${esc(p.title)}</span>
              <span class="tile-note">${esc(p.note)}</span>
            </button>`).join('')}
        </div>`)}

      ${card(`
        <p class="lead">${icon('trophy')} この チャレンジの さいこう記録</p>
        ${best
          ? `<div class="best-row">
               <div><b>${best.keys}</b><span>だ</span></div>
               <div><b>${best.kps.toFixed(1)}</b><span>打/びょう</span></div>
               <div><b>${Math.round(best.accuracy)}</b><span>% 正かくさ</span></div>
             </div>`
          : '<p class="muted">まだ きろくが ありません。さいしょの きろくを つくろう。</p>'}
        <button class="btn btn-primary btn-big mt" data-go-challenge>
          <span class="btn-sub">${challengePick.seconds}びょう</span>
          <span class="btn-main">はじめる</span>
          ${icon('play')}
        </button>`)}
    `;

    view.querySelectorAll('[data-pick]').forEach(el => {
      el.addEventListener('click', () => {
        const value = el.dataset.value;
        challengePick[el.dataset.pick] = el.dataset.pick === 'seconds' ? Number(value) : value;
        renderChallenge();
      });
    });
    bindGoButtons();
  }

  // ------------------------------------------------------------------
  // 練習
  // ------------------------------------------------------------------

  function renderPlay(params) {
    leaveArmedAt = 0;
    let found = null;
    const special = params.special || '';

    if (special === 'challenge') {
      found = T.Lessons.buildChallengeStage(params.pool, params.seconds);
    } else if (special === 'weak') {
      found = T.Lessons.buildWeakStage(T.Store.missSummary().keys);
      if (!found) {
        toast('にがてが まだ わかりません。すこし れんしゅうしてから きてね。');
        T.Nav.selectTab('courses');
        return;
      }
    } else {
      found = T.Lessons.findStage(params.courseId, params.stageId);
    }
    if (!found) { T.Nav.selectTab('courses'); return; }

    const opt = {
      course: found.course, stage: found.stage,
      source: params.source || 'course', special, mount: view
    };
    if (found.stage.mode === 'shortcut') {
      T.Shortcut.setOnFinish(onSessionFinish);
      T.Shortcut.start(opt);
    } else {
      T.Play.setOnFinish(onSessionFinish);
      T.Play.start(opt);
    }
  }

  /**
   * 練習中に「もどる」が おされた ときの 動き。
   * 1回目は 画面の 下に「もう1かい おすと やめます」と 出して とどまり、
   * 2回目で ほんとうに やめます。うっかり さわって 消えて しまうのを ふせぎます。
   */
  function leavePlay() {
    const running = T.Play.isRunning() || T.Shortcut.isRunning();
    if (!running) return true;
    const now = Date.now();
    if (now - leaveArmedAt < 6000) {
      const result = T.Play.isRunning() ? T.Play.abort() : T.Shortcut.abort();
      if (result) saveResult(result);
      return true;
    }
    leaveArmedAt = now;
    toast('もう1かい「もどる」を おすと、れんしゅうを やめます');
    return false;
  }

  function onSessionFinish(result) {
    const info = saveResult(result);
    if (result.status === 'completed') T.Nav.replace('result', { result, info });
  }

  /**
   * けっかを 端末に のこします。
   *
   * ・ステージの ★と さいこう記録（さいごまで やった ときだけ）
   * ・チャレンジの さいこう記録
   * ・れんしゅうの きろく（きろく画面の グラフや ヒートマップの もと）
   * ・けいけんちと バッジ
   *
   * @returns {{meta: Object, awarded: Object}} けっか画面に 出す ための まとめ
   */
  function saveResult(result) {
    const stage = result.stage;
    const completed = result.status === 'completed';
    const meta = { special: result.special || '' };

    if (stage.mode === 'challenge') {
      if (completed) {
        const ch = T.Store.applyChallenge(stage.id, result);
        meta.isBestScore = ch.isBest;
        meta.prevChallenge = ch.prev;
        meta.challengeBest = ch.best;
      }
    } else if (!stage.noStars && completed) {
      // とちゅうで やめた 回は「クリア」に しません。
      // 2つだけ 打って やめても ★が つく、という ことが ないようにします
      const applied = T.Store.applyResult(stage.id, {
        kps: result.kps, accuracy: result.accuracy, finishedAt: result.finishedAt
      });
      meta.firstClear = applied.firstClear;
      meta.newBestKps = applied.newBestKps;
      meta.newStars = applied.newStars;
      meta.prevBestKps = applied.prevBestKps;
    }

    T.Store.addHistory({
      at: result.finishedAt,
      courseId: result.course.id,
      stageId: stage.id,
      title: `${result.course.short}／${stage.title}`,
      mode: stage.mode,
      status: result.status,
      kps: Math.round((result.kps || 0) * 100) / 100,
      accuracy: Math.round((result.accuracy || 0) * 10) / 10,
      correctKeys: result.correctKeys,
      totalKeys: result.totalKeys,
      elapsedMs: Math.round(result.elapsedMs),
      combo: result.combo || 0,
      stars: stage.noStars || !completed ? 0 : T.Store.starsOf(result),
      missByKey: result.missByKey,
      missByFinger: result.missByFinger
    });

    const awarded = T.Awards.applyResult(result, meta);
    return { meta, awarded };
  }

  // ------------------------------------------------------------------
  // けっか
  // ------------------------------------------------------------------

  function renderResult(params) {
    const r = params.result;
    if (!r) { T.Nav.selectTab('courses'); return; }
    const info = params.info || {};
    const meta = info.meta || {};
    const awarded = info.awarded || null;

    const isShortcut = r.stage.mode === 'shortcut';
    const isChallenge = r.stage.mode === 'challenge';
    const noStars = !!r.stage.noStars;
    const n = T.Store.starsOf(r);
    const progress = T.Store.getProgress()[r.stage.id] || {};
    const okCount = r.items.filter(i => i.ok).length;
    const isBest = !!(meta.newBestKps || meta.isBestScore);

    view.innerHTML = `
      ${pageTitle(isChallenge ? 'そこまで！' : 'できました', `${r.course.short}／${r.stage.title}`)}

      ${card(`
        ${isBest ? `<p class="result-best">${icon('sparkle')} 新記録！</p>` : ''}
        ${noStars ? '' : `<div class="result-stars">${stars(n)}</div>`}
        <p class="result-word">${esc(praise(r, meta, n))}</p>
        <div class="result-grid">
          ${isShortcut ? `
            <div><span>できた 課題</span><b>${okCount}</b><small>/ ${r.items.length}</small></div>
            <div><span>かかった 時間</span><b>${Math.round(r.elapsedMs / 1000)}</b><small>びょう</small></div>
          ` : `
            ${isChallenge ? `<div><span>スコア</span><b>${r.correctKeys}</b><small>だ</small></div>` : ''}
            <div><span>はやさ</span><b>${r.kps.toFixed(1)}</b><small>打/びょう</small></div>
            <div><span>正かくさ</span><b>${Math.round(r.accuracy)}</b><small>%</small></div>
            ${isChallenge ? '' : `<div><span>正しく 打てた 数</span><b>${r.correctKeys}</b><small>だ</small></div>`}
            <div><span>ミス</span><b>${r.missKeys}</b><small>かい</small></div>
            <div><span>れんぞく</span><b>${r.combo || 0}</b><small>だ</small></div>
          `}
        </div>
        ${compareLine(r, meta, progress)}
      `, 'card-result')}

      ${xpCard(awarded)}
      ${badgeCard(awarded)}
      ${weakList(r)}

      <div class="result-actions">
        <button class="btn btn-primary" data-again>${icon('retry')} もう1かい</button>
        ${nextActionButton(r)}
        <button class="btn btn-ghost" data-back-list>${isChallenge ? 'チャレンジを えらぶ' : (noStars ? 'ホームへ' : 'コースに もどる')}</button>
      </div>`;

    const again = view.querySelector('[data-again]');
    if (again) again.addEventListener('click', () => T.Nav.replace('play', againParams(r)));

    // けっか画面は「通りみち」なので、つぎへ すすむ ときも おきかえます。
    // こうすると、つぎの ステージで「もどる」を おした とき、
    // ひとつ前の けっか画面では なく コース一覧に もどります
    const nextStage = view.querySelector('[data-next-stage]');
    if (nextStage) {
      nextStage.addEventListener('click', () => {
        const [courseId, stageId] = nextStage.dataset.nextStage.split(':');
        T.Nav.replace('play', { courseId, stageId, source: 'course' });
      });
    }

    const backList = view.querySelector('[data-back-list]');
    if (backList) {
      backList.addEventListener('click', () => {
        if (isChallenge) T.Nav.replace('challenge', {});
        else if (noStars) T.Nav.selectTab('home');
        else T.Nav.replace('course', { courseId: r.course.id });
      });
    }
    bindGoButtons();
  }

  /** 「もう1かい」で 同じ ことを やりなおす ための パラメータ */
  function againParams(r) {
    if (r.stage.mode === 'challenge') {
      return { special: 'challenge', pool: r.stage.pool, seconds: r.stage.seconds };
    }
    if (r.special === 'weak') return { special: 'weak' };
    return { courseId: r.course.id, stageId: r.stage.id, source: 'review' };
  }

  function praise(r, meta, n) {
    if (r.stage.mode === 'challenge') {
      if (meta.isBestScore) return `${r.correctKeys}だ！ これまでで いちばん たくさん 打てました。`;
      return `${r.correctKeys}だ 打てました。正かくさが 上がると スコアも のびます。`;
    }
    if (r.special === 'weak') return 'にがてな キーに むきあえました。くりかえすほど 手が おぼえます。';
    if (n >= 3) return 'ミスが ほとんど ない、すばらしい 打ちかたです。';
    if (n === 2) return 'いい ちょうし。あと すこしで ★3つ。';
    if (n === 1) return 'さいごまで やりきりました。正かくさを 上げていこう。';
    return 'ゆっくりで いいので、正しい 指で 打ってみよう。';
  }

  /** 前より よく なったかを 1行で つたえます */
  function compareLine(r, meta, progress) {
    if (r.stage.mode === 'challenge') {
      const prev = meta.prevChallenge;
      if (!prev) return '';
      const diff = r.correctKeys - prev.keys;
      if (diff > 0) return `<p class="muted">まえの さいこう記録より <b>${diff}だ</b> ふえました。</p>`;
      return `<p class="muted">さいこう記録は ${prev.keys} だ。あと ${Math.max(1, -diff)} だ です。</p>`;
    }
    if (r.stage.mode === 'shortcut' || r.stage.noStars) return '';
    if (meta.newBestKps) {
      return `<p class="muted">まえの さいこう記録 ${(meta.prevBestKps || 0).toFixed(1)} 打/びょう を こえました。</p>`;
    }
    if (progress.bestKps) {
      return `<p class="muted">このステージの さいこう記録: ${progress.bestKps.toFixed(1)} 打/びょう</p>`;
    }
    return '';
  }

  /** もらった けいけんちと、レベルアップの おしらせ */
  function xpCard(awarded) {
    if (!awarded || awarded.gained <= 0) return '';
    return card(`
      <p class="lead">${icon('sparkle')} もらった けいけんち</p>
      ${awarded.levelUp ? `<p class="level-up">${icon('trophy')} レベルアップ！
        <b>Lv.${awarded.after.level}</b> ${esc(awarded.after.rank)} に なりました。</p>` : ''}
      <p class="xp-total">＋${awarded.gained} <span>けいけんち</span></p>
      <ul class="xp-list">
        ${awarded.parts.map(p => `<li>${esc(p.label)}<span>＋${p.xp}</span></li>`).join('')}
      </ul>
      ${levelBox(awarded.after)}`);
  }

  /** あたらしく もらった バッジ */
  function badgeCard(awarded) {
    if (!awarded || !awarded.badges.length) return '';
    return card(`
      <p class="lead">${icon('medal')} バッジを もらいました</p>
      <div class="badge-grid">
        ${awarded.badges.map(b => badgeTile(b, true)).join('')}
      </div>`, 'card-badge-new');
  }

  function badgeTile(badge, got) {
    return `
      <div class="badge-tile${got ? ' got' : ''}">
        <span class="badge-icon">${icon(got ? badge.icon : 'lock')}</span>
        <span class="badge-title">${esc(badge.title)}</span>
        <span class="badge-note">${esc(badge.note)}</span>
      </div>`;
  }

  /** つぎに すすむ ボタン（さいごの ステージや とくべつ れんしゅうでは 出しません） */
  function nextActionButton(r) {
    if (r.stage.noStars || r.stage.mode === 'challenge') return '';
    const course = T.Lessons.findCourse(r.course.id);
    if (!course) return '';
    const i = course.stages.findIndex(s => s.id === r.stage.id);
    const next = course.stages[i + 1];
    if (!next) return '';
    return `<button class="btn btn-outline" data-next-stage="${esc(course.id)}:${esc(next.id)}">
      つぎの ステージ ${icon('next')}</button>`;
  }

  /** にがてだった 指を まとめて 見せます（つぎの めあてに つながります） */
  function weakList(r) {
    const keys = Object.keys(r.missByFinger || {});
    if (keys.length === 0) return '';
    const top = keys.sort((a, b) => r.missByFinger[b] - r.missByFinger[a]).slice(0, 3);
    return card(`
      <p class="lead">${icon('finger')} つぎに 気を つけると よい ところ</p>
      <ul class="weak-list">
        ${top.map(id => {
          const f = T.Layout.FINGERS[id];
          return `<li><span class="finger-dot" style="--finger:${f.color}"></span>
            ${esc(f.label)}<span class="weak-count">${r.missByFinger[id]} かい</span></li>`;
        }).join('')}
      </ul>
      <button class="btn btn-outline" data-go-weak>${icon('target')} にがて とっくんを する</button>`);
  }

  // ------------------------------------------------------------------
  // きろく
  // ------------------------------------------------------------------

  function renderRecords() {
    const history = T.Store.getHistory().slice().reverse();
    const progress = T.Store.getProgress();
    const best = T.Store.bestOverall();
    const lv = T.Awards.levelOf(T.Store.getAwards().xp);
    const st = T.Store.streak();
    const miss = T.Store.missSummary();
    const badges = T.Awards.badgeList();
    const gotBadges = badges.filter(b => b.got);
    const clearedStages = T.Lessons.COURSES
      .reduce((sum, c) => sum + c.stages.filter(s => (progress[s.id] || {}).clears > 0).length, 0);

    view.innerHTML = `
      ${pageTitle('きろく', 'これまでの あゆみ')}

      ${card(`
        ${levelBox(lv)}
        <p class="muted">ためた けいけんち ${lv.total}。ステージは ${clearedStages} / ${T.Lessons.totalStages()} クリア。</p>`)}

      ${card(`
        <p class="lead">${icon('fire')} れんしゅうした 日</p>
        ${streakLine(st)}
        ${calendar()}`)}

      ${best ? card(`
        <p class="lead">${icon('trophy')} さいこう記録</p>
        <div class="best-row">
          <div><b>${best.kps.toFixed(1)}</b><span>打/びょう</span></div>
          <div><b>${Math.round(best.accuracy)}</b><span>% 正かくさ</span></div>
          <div><b>${best.count}</b><span>かい</span></div>
        </div>`) : card('<p class="muted">まだ きろくが ありません。「れんしゅう」から はじめよう。</p>')}

      ${history.length ? card(`
        <p class="lead">${icon('chart')} はやさの うつりかわり</p>
        ${sparkline(history.filter(h => T.Store.countsAsTyping(h) && h.correctKeys > 0).slice(0, 20).reverse())}`) : ''}

      ${miss.keys.length ? card(`
        <p class="lead">${icon('target')} にがてな キー</p>
        <p class="muted">色が こい キーほど まちがえて います。手もとの キーボードと 見くらべてみよう。</p>
        <div class="kb-guide" id="heat-kb"></div>
        <p class="heat-legend"><span class="heat-sample lv1"></span>すこし
          <span class="heat-sample lv2"></span>ふつう
          <span class="heat-sample lv3"></span>おおい</p>
        <button class="btn btn-outline" data-go-weak>${icon('finger')} にがて とっくんを する</button>`) : ''}

      ${miss.fingers.length ? card(`
        <p class="lead">${icon('finger')} にがてな 指</p>
        <ul class="weak-list">
          ${miss.fingers.slice(0, 3).map(id => {
            const f = T.Layout.FINGERS[id];
            if (!f) return '';
            return `<li><span class="finger-dot" style="--finger:${f.color}"></span>
              ${esc(f.label)}<span class="weak-count">${Math.round(miss.byFinger[id])} かい</span></li>`;
          }).join('')}
        </ul>`) : ''}

      ${card(`
        <p class="lead">${icon('medal')} バッジ</p>
        <p class="muted">${gotBadges.length} / ${badges.length} こ あつめました。</p>
        <div class="badge-grid">
          ${(gotBadges.length ? gotBadges.slice(-6).reverse() : badges.slice(0, 3))
            .map(b => badgeTile(b, !!b.got)).join('')}
        </div>
        <button class="btn btn-outline mt" data-go-screen="badges">ぜんぶ 見る</button>`)}

      ${challengeCard()}

      ${card(`
        <p class="lead">${icon('star')} ステージの ★</p>
        <div class="star-grid">
          ${T.Lessons.COURSES.map(c => `
            <div class="star-course">
              <p class="star-course-title">${esc(c.short)}</p>
              ${c.stages.map(s => `<div class="star-line">
                <span>${esc(s.title)}</span>${stars((progress[s.id] || {}).stars || 0)}
              </div>`).join('')}
            </div>`).join('')}
        </div>`)}

      ${card(`
        <p class="lead">${icon('clock')} さいきんの れんしゅう</p>
        <ul class="hist-list">
          ${history.slice(0, 20).map(h => `
            <li>
              <span class="hist-date">${esc(formatDate(h.at))}</span>
              <span class="hist-title">${esc(h.title)}</span>
              <span class="hist-num">${h.mode === 'shortcut'
                ? `できた ${Math.round(h.accuracy)}%`
                : `${(h.kps || 0).toFixed(1)} 打/びょう ・ ${Math.round(h.accuracy)}%`}</span>
            </li>`).join('') || '<li class="muted">まだ ありません</li>'}
        </ul>`)}
    `;

    const heat = $('heat-kb');
    if (heat) {
      T.Keyboard.render(heat, { layoutId: T.Store.getSettings().layout, fingerGuide: false, onTap: null });
      T.Keyboard.heat(miss.byKey);
    }
    bindGoButtons();
  }

  /** チャレンジの さいこう記録（やったことが あるときだけ 出します） */
  function challengeCard() {
    const all = T.Store.getChallenge();
    const ids = Object.keys(all).sort();
    if (ids.length === 0) return '';
    return card(`
      <p class="lead">${icon('timer')} チャレンジの さいこう記録</p>
      <ul class="hist-list">
        ${ids.map(id => {
          const label = challengeLabel(id);
          return `<li>
            <span class="hist-title">${esc(label)}</span>
            <span class="hist-num">${all[id].keys} だ ・ ${all[id].kps.toFixed(1)} 打/びょう</span>
          </li>`;
        }).join('')}
      </ul>`);
  }

  /** ch-word-60 のような id を「60びょう ／ ことば」に もどします */
  function challengeLabel(id) {
    const m = /^ch-(.+)-(\d+)$/.exec(id);
    if (!m) return id;
    const pool = T.Lessons.CHALLENGE_POOLS.filter(p => p.id === m[1])[0];
    return `${m[2]}びょう ／ ${pool ? pool.title : m[1]}`;
  }

  /** 直近 28日の れんしゅう量。こい マスほど たくさん 打った 日です */
  function calendar() {
    const days = T.Store.recentDays(28);
    const max = days.reduce((m, d) => Math.max(m, d.keys), 0);
    const doneDays = days.filter(d => d.keys > 0).length;
    const cells = days.map(d => {
      let level = 0;
      if (d.keys > 0) level = d.keys < max * 0.34 ? 1 : (d.keys < max * 0.67 ? 2 : 3);
      const label = `${d.day.slice(5).replace('-', '/')} ${d.keys} だ`;
      return `<span class="cal-cell lv${level}" title="${esc(label)}"></span>`;
    }).join('');
    return `
      <div class="cal" role="img" aria-label="この 4週間で ${doneDays}日 れんしゅうしました">${cells}</div>
      <p class="cal-axis"><span>4週間まえ</span><span>きょう</span></p>
      <p class="muted">この 4週間で <b>${doneDays}日</b> れんしゅうしました。</p>`;
  }

  function renderBadges() {
    const badges = T.Awards.badgeList();
    const got = badges.filter(b => b.got);
    view.innerHTML = `
      ${pageTitle('バッジ', `${got.length} / ${badges.length} こ あつめました`)}
      <p class="hint-box">${icon('info')} バッジは れんしゅうを つづけると もらえます。
      いちど もらった バッジは なくなりません。</p>
      <div class="badge-grid badge-grid-all">
        ${badges.map(b => badgeTile(b, !!b.got)).join('')}
      </div>`;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  /** はやさの 折れ線（外部の ライブラリは つかわず SVG で 描きます） */
  function sparkline(list) {
    if (list.length < 2) return '<p class="muted">2かい いじょう れんしゅうすると グラフが 出ます。</p>';
    const values = list.map(h => h.kps || 0);
    const max = Math.max.apply(null, values) || 1;
    const w = 300, h = 90, pad = 6;
    const xy = values.map((v, i) => {
      const x = pad + (w - pad * 2) * (i / (values.length - 1));
      const y = h - pad - (h - pad * 2) * (v / max);
      return { x, y };
    });
    const points = xy.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${pad},${h - pad} ${points} ${(w - pad).toFixed(1)},${h - pad}`;
    const last = xy[xy.length - 1];
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="はやさの グラフ">
      <polygon class="spark-area" points="${area}"/>
      <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round"/>
      <circle class="spark-dot" cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="4"/>
    </svg>
    <p class="muted">いちばん はやかった とき: ${max.toFixed(1)} 打/びょう ／ このかい: ${values[values.length - 1].toFixed(1)} 打/びょう</p>`;
  }

  // ------------------------------------------------------------------
  // ローマ字ひょう
  // ------------------------------------------------------------------

  function renderRomajiTable() {
    view.innerHTML = `
      ${pageTitle('ローマ字ひょう', 'ならった うちかたで だいじょうぶ')}
      <p class="hint-box">${icon('info')} 1つの かなに いくつも うちかたが ある ときは、
      <b>ふとい 字</b>が この アプリの ヒントに 出る うちかたです。どれで 打っても 正かいです。</p>
      <div class="rt-grid">
        ${T.Romaji.TABLE.map(section => `
          <section class="rt-section">
            <h2 class="rt-title">${esc(section.title)}</h2>
            <ul class="rt-list">
              ${section.kana.map(k => {
                const cands = T.Romaji.candidatesOf(k);
                if (!cands.length) return '';
                return `<li><span class="rt-kana">${esc(k)}</span>
                  <span class="rt-romaji"><b>${esc(cands[0])}</b>${cands.length > 1
                    ? ` <span class="rt-alt">${esc(cands.slice(1).join(' / '))}</span>` : ''}</span></li>`;
              }).join('')}
            </ul>
            ${section.note ? `<p class="rt-note">${esc(section.note)}</p>` : ''}
          </section>`).join('')}
      </div>`;
  }

  // ------------------------------------------------------------------
  // せってい
  // ------------------------------------------------------------------

  function renderSettings() {
    const s = T.Store.getSettings();
    view.innerHTML = `
      ${pageTitle('せってい', 'じぶんに あわせて かえられます')}

      ${card(`
        <p class="lead">${icon('keyboard')} キーボードの ならび</p>
        <div class="seg" role="radiogroup" aria-label="キーボードの ならび">
          ${Object.keys(T.Layout.LAYOUTS).map(id => `
            <button class="seg-btn${s.layout === id ? ' on' : ''}" role="radio"
              aria-checked="${s.layout === id}" data-set="layout" data-value="${id}">
              ${esc(T.Layout.LAYOUTS[id].label)}</button>`).join('')}
        </div>
        <p class="muted">キーボードの 右上に「¥」や「かな」が あれば 日本語配列（JIS）です。</p>`)}

      ${card(`
        <p class="lead">${icon('gear')} 見え方・おと</p>
        ${toggle('keyboard', '画面に キーボードを 出す', s.keyboard)}
        ${toggle('fingerGuide', '指を 色で 分ける', s.fingerGuide)}
        ${toggle('romajiHint', 'ローマ字の ヒントを 出す', s.romajiHint)}
        ${toggle('sound', '打ったときの おと', s.sound)}
        ${toggle('bigText', '文字を 大きくする', s.bigText)}
        <div class="seg mt" role="radiogroup" aria-label="画面の 色">
          ${[['auto', 'じどう'], ['light', 'あかるい'], ['dark', 'くらい']].map(([v, label]) => `
            <button class="seg-btn${s.theme === v ? ' on' : ''}" role="radio"
              aria-checked="${s.theme === v}" data-set="theme" data-value="${v}">${label}</button>`).join('')}
        </div>`)}

      ${card(`
        <p class="lead">${icon('hand')} ゆびの ばしょ</p>
        <p class="muted">ホームポジションは、左手を <b>F</b>、右手を <b>J</b> に おく ばしょです。
        この 2つの キーには でっぱりが あるので、見なくても さわると わかります。</p>
        <div id="guide-kb" class="kb-guide"></div>
        <ul class="finger-legend">
          ${Object.keys(T.Layout.FINGERS).map(id => {
            const f = T.Layout.FINGERS[id];
            return `<li><span class="finger-dot" style="--finger:${f.color}"></span>${esc(f.label)}</li>`;
          }).join('')}
        </ul>`)}

      ${card(`
        <p class="lead">${icon('grid')} ローマ字ひょう</p>
        <p class="muted">「し」は si でも shi でも 正かいです。ならった うちかたを たしかめられます。</p>
        <button class="btn btn-outline" data-go-screen="romaji-table">ローマ字ひょうを 見る</button>`)}

      ${card(`
        <p class="lead">${icon('lock')} きろくと プライバシー</p>
        <p class="muted">Typa は 名前も 出席番号も もちません。インターネットにも つながず、
        れんしゅうの きろくは <b>この 端末の 中だけ</b>に たまります。
        ほかの 人や ほかの サイトに おくられる ことは ありません。</p>
        <p class="muted">ブラウザの データを けすと、きろくも いっしょに 消えます。</p>
        <button class="btn btn-outline btn-danger" id="reset-btn">${icon('trash')} きろくを ぜんぶ けす</button>
        <p class="muted" id="reset-note" hidden>ほんとうに けしますか？ もとには もどせません。</p>
        <div class="reset-confirm" id="reset-confirm" hidden>
          <button class="btn btn-danger-solid" id="reset-yes">けす</button>
          <button class="btn btn-ghost" id="reset-no">やめる</button>
        </div>`)}

      ${card(`
        <p class="lead">${icon('info')} アプリとして つかう</p>
        <p class="muted">ホーム画面に 入れると、ブラウザの バーが 消えて 画面が 広くなります。
        インターネットに つながって いなくても れんしゅうできます。</p>
        <button class="btn btn-outline" id="install-btn" hidden>ホーム画面に 入れる</button>
        <ul class="howto">
          <li><b>Chrome</b>: アドレスバーの 右の インストール、または メニュー →「アプリをインストール」</li>
          <li><b>Safari（iPad・iPhone）</b>: 共有ボタン →「ホーム画面に追加」</li>
        </ul>
        <p class="version">Typa ${esc(APP_VERSION)}</p>`)}
    `;

    T.Keyboard.render($('guide-kb'), { layoutId: s.layout, fingerGuide: true, onTap: null });
    bindSettings();
    bindGoButtons();
  }

  function toggle(name, label, on) {
    return `<label class="switch">
      <input type="checkbox" data-toggle="${name}"${on ? ' checked' : ''}>
      <span class="switch-box">${icon('check')}</span>
      <span class="switch-label">${esc(label)}</span>
    </label>`;
  }

  function bindSettings() {
    view.querySelectorAll('[data-toggle]').forEach(el => {
      el.addEventListener('change', () => {
        T.Store.setSetting(el.dataset.toggle, el.checked);
        applySettings();
      });
    });
    view.querySelectorAll('[data-set]').forEach(el => {
      el.addEventListener('click', () => {
        T.Store.setSetting(el.dataset.set, el.dataset.value);
        applySettings();
        T.Nav.render();
      });
    });

    const install = $('install-btn');
    if (install && installPrompt) {
      install.hidden = false;
      install.addEventListener('click', async () => {
        install.hidden = true;
        installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
      });
    }

    // きろくを けす。まちがえて 押しても すぐには 消えないよう、2だんかいに します
    const reset = $('reset-btn');
    if (reset) {
      reset.addEventListener('click', () => {
        reset.hidden = true;
        $('reset-note').hidden = false;
        $('reset-confirm').hidden = false;
      });
      $('reset-no').addEventListener('click', () => {
        reset.hidden = false;
        $('reset-note').hidden = true;
        $('reset-confirm').hidden = true;
      });
      $('reset-yes').addEventListener('click', () => {
        T.Store.clearRecords();
        toast('きろくを けしました。はじめから やりなおせます。');
        T.Nav.render();
      });
    }
  }

  /** せっていを 画面ぜんたいに 反映します */
  function applySettings() {
    const s = T.Store.getSettings();
    document.documentElement.dataset.theme = s.theme;
    document.documentElement.classList.toggle('big-text', !!s.bigText);
  }

  // ------------------------------------------------------------------
  // 画面の きりかえ
  // ------------------------------------------------------------------

  function bindGoButtons() {
    view.querySelectorAll('[data-go-course]').forEach(el => {
      el.addEventListener('click', () => T.Nav.go('course', { courseId: el.dataset.goCourse }));
    });
    view.querySelectorAll('[data-go-stage]').forEach(el => {
      el.addEventListener('click', () => {
        const [courseId, stageId] = el.dataset.goStage.split(':');
        T.Nav.go('play', { courseId, stageId, source: 'course' });
      });
    });
    view.querySelectorAll('[data-go-screen]').forEach(el => {
      el.addEventListener('click', () => T.Nav.go(el.dataset.goScreen, {}));
    });
    view.querySelectorAll('[data-go-challenge]').forEach(el => {
      el.addEventListener('click', () => T.Nav.go('play', {
        special: 'challenge', pool: challengePick.pool, seconds: challengePick.seconds
      }));
    });
    view.querySelectorAll('[data-go-weak]').forEach(el => {
      el.addEventListener('click', () => T.Nav.go('play', { special: 'weak' }));
    });
  }

  function toast(message) {
    const area = $('toast');
    const box = document.createElement('div');
    box.className = 'toast-item';
    box.textContent = message;
    area.appendChild(box);
    setTimeout(() => { if (box.parentNode) box.parentNode.removeChild(box); }, 4000);
  }

  /** 下部バーの 見た目を、いまの 階層に あわせます */
  function updateChrome(cur, info) {
    const back = $('nav-back');
    back.disabled = !info.canGoBack;
    back.setAttribute('aria-disabled', String(!info.canGoBack));
    T.Nav.TABS.forEach(tab => {
      const el = document.querySelector(`[data-tab="${tab.id}"]`);
      if (el) {
        const on = info.tab === tab.id;
        el.classList.toggle('on', on);
        el.setAttribute('aria-current', on ? 'page' : 'false');
      }
    });
    document.body.dataset.screen = cur ? cur.screen : '';
    view.scrollTop = 0;
    global.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------
  // 起動
  // ------------------------------------------------------------------

  function boot() {
    view = $('view');
    applySettings();

    $('nav-back').addEventListener('click', () => T.Nav.back('bar'));
    T.Nav.TABS.forEach(tab => {
      const el = document.querySelector(`[data-tab="${tab.id}"]`);
      if (el) el.addEventListener('click', () => T.Nav.selectTab(tab.id));
    });

    T.Nav.register('home', { render: renderHome });
    T.Nav.register('courses', { render: renderCourses });
    T.Nav.register('course', { render: renderCourse });
    T.Nav.register('challenge', { render: renderChallenge });
    T.Nav.register('play', { render: renderPlay, leave: leavePlay });
    T.Nav.register('result', { render: renderResult });
    T.Nav.register('records', { render: renderRecords });
    T.Nav.register('badges', { render: renderBadges });
    T.Nav.register('settings', { render: renderSettings });
    T.Nav.register('romaji-table', { render: renderRomajiTable });

    // ホーム画面の ショートカット（manifest の shortcuts）から ひらかれたとき、
    // そのタブ（や 画面）から はじめます。アドレスは すぐ きれいに もどします
    let start = 'home';
    let deep = null;
    try {
      const params = new URLSearchParams(location.search);
      const tab = params.get('tab');
      if (T.Nav.TABS.some(t => t.id === tab)) start = tab;
      if (params.get('screen') === 'challenge') deep = 'challenge';
      if (location.search) history.replaceState(null, '', location.pathname);
    } catch (e) { /* パラメータが なくても うごきます */ }

    T.Nav.init({
      root: document.body,
      indicator: $('edge-hint'),
      start,
      onChange: updateChrome,
      onRootBack: () => {
        document.body.classList.add('root-bump');
        setTimeout(() => document.body.classList.remove('root-bump'), 300);
      }
    });
    if (deep) T.Nav.go(deep, {});

    global.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      installPrompt = e;
      const btn = $('install-btn');
      if (btn) btn.hidden = false;
    });

    if ('serviceWorker' in navigator) {
      global.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => { /* オフライン対応が なくても 動きます */ });
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
