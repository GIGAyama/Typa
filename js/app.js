/**
 * =====================================================================
 * app.js — 画面の 組み立てと 全体の うごき
 * =====================================================================
 * 階層は nav.js が もち、この ファイルは それぞれの 画面の 中身を 描きます。
 *
 *   ホーム
 *   れんしゅう → コース → ステージ（練習）→ けっか
 *   きろく
 *   せってい
 *
 * どの 画面でも、下部バーの「もどる」・画面の はしからの スワイプ・
 * 端末の 戻る の 3つが 同じ 1つの 動きに なります（nav.js を 見てください）。
 */
(function (global) {
  'use strict';

  const T = global.Typa;
  const icon = T.icon;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const PORTAL_URL = 'https://gigayama.github.io/Gamification/manabi-portal/';

  let view = null;
  let installPrompt = null;
  let leaveArmedAt = 0;         // 練習中に「もどる」を 1回 おした 時こく

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

  // ------------------------------------------------------------------
  // ホーム
  // ------------------------------------------------------------------

  function renderHome() {
    const today = T.Store.todaySummary();
    const best = T.Store.bestOverall();
    const pending = T.StudyLog.pendingCount();
    const progress = T.Store.getProgress();
    const next = findNextStage(progress);

    view.innerHTML = `
      ${pageTitle('Typa', 'キーボードと なかよく なろう')}

      ${card(`
        <p class="lead">${icon('clock')} きょうの ようす</p>
        <div class="today">
          <div class="today-item"><span class="today-num">${today.count}</span><span class="today-unit">かい</span><span class="today-label">れんしゅう</span></div>
          <div class="today-item"><span class="today-num">${today.keys}</span><span class="today-unit">だ</span><span class="today-label">打った数</span></div>
          <div class="today-item"><span class="today-num">${today.minutes}</span><span class="today-unit">ふん</span><span class="today-label">じかん</span></div>
        </div>`, 'card-today')}

      ${next ? card(`
        <p class="lead">${icon('play')} つづきから やってみよう</p>
        <button class="btn btn-primary btn-big" data-go-stage="${esc(next.course.id)}:${esc(next.stage.id)}">
          <span class="btn-sub">${esc(next.course.short)}</span>
          <span class="btn-main">${esc(next.stage.title)}</span>
          ${icon('next')}
        </button>`, 'card-next') : ''}

      ${card(`
        <p class="lead">${icon('keyboard')} れんしゅうを えらぶ</p>
        <div class="course-grid">
          ${T.Lessons.COURSES.map(c => `
            <button class="course-tile tile-${c.color}" data-go-course="${esc(c.id)}">
              <span class="tile-icon">${icon(c.icon)}</span>
              <span class="tile-title">${esc(c.title)}</span>
              <span class="tile-note">${esc(c.note)}</span>
              <span class="tile-count">${c.stages.length} ステージ</span>
            </button>`).join('')}
        </div>`)}

      ${best ? card(`
        <p class="lead">${icon('trophy')} じぶんの さいこう記録</p>
        <div class="best-row">
          <div><b>${best.kps.toFixed(1)}</b><span>打/びょう</span></div>
          <div><b>${Math.round(best.accuracy)}</b><span>% 正かくさ</span></div>
          <div><b>${best.count}</b><span>かい れんしゅう</span></div>
        </div>`) : ''}

      ${card(`
        <p class="lead">${icon('send')} まなびクエストへ おくる</p>
        <p class="muted">れんしゅうの きろくは この 端末に たまります。
        <b>学習ポータル</b>を ひらくと、まなびクエストに おくられて 経験値に なります。</p>
        <p class="pending">まだ おくって いない きろく: <b>${pending}</b> 件</p>
        <a class="btn btn-outline" href="${PORTAL_URL}" target="_blank" rel="noopener">学習ポータルを ひらく</a>`,
        'card-send')}
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
      </div>`;
    bindGoButtons();
  }

  function renderCourse(params) {
    const course = T.Lessons.findCourse(params.courseId);
    if (!course) { T.Nav.selectTab('courses'); return; }
    const progress = T.Store.getProgress();
    view.innerHTML = `
      ${pageTitle(course.title, course.note)}
      ${course.note2 ? `<p class="hint-box">${icon('info')} ${esc(course.note2)}</p>` : ''}
      <div class="stage-list">
        ${course.stages.map((s, i) => {
          const p = progress[s.id] || { clears: 0, stars: 0, bestKps: 0, bestAccuracy: 0 };
          return `
          <button class="stage-row" data-go-stage="${esc(course.id)}:${esc(s.id)}">
            <span class="stage-no">${i + 1}</span>
            <span class="stage-body">
              <span class="stage-title">${esc(s.title)}</span>
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
  // 練習
  // ------------------------------------------------------------------

  function renderPlay(params) {
    const found = T.Lessons.findStage(params.courseId, params.stageId);
    if (!found) { T.Nav.selectTab('courses'); return; }
    leaveArmedAt = 0;
    const opt = { course: found.course, stage: found.stage, source: params.source || 'course', mount: view };
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
    saveResult(result);
    if (result.status === 'completed') T.Nav.replace('result', { result });
  }

  /** けっかを 端末に のこし、学習ログ（study.v1）にも 1件 ためます */
  function saveResult(result) {
    const stage = result.stage;
    const stars = T.Store.starsOf(result);
    T.Store.applyResult(stage.id, {
      kps: result.kps, accuracy: result.accuracy, finishedAt: result.finishedAt
    });
    T.Store.addHistory({
      at: result.finishedAt,
      courseId: result.course.id,
      stageId: stage.id,
      title: `${result.course.short}／${stage.title}`,
      mode: stage.mode,
      status: result.status,
      kps: Math.round(result.kps * 100) / 100,
      accuracy: Math.round(result.accuracy * 10) / 10,
      correctKeys: result.correctKeys,
      totalKeys: result.totalKeys,
      elapsedMs: Math.round(result.elapsedMs),
      stars,
      missByFinger: result.missByFinger
    });
    const saved = T.StudyLog.saveSession(result);
    if (!saved.saved) toast('この 端末に きろくを のこせませんでした。先生に つたえてね。');
  }

  // ------------------------------------------------------------------
  // けっか
  // ------------------------------------------------------------------

  function renderResult(params) {
    const r = params.result;
    if (!r) { T.Nav.selectTab('courses'); return; }
    const n = T.Store.starsOf(r);
    const progress = T.Store.getProgress()[r.stage.id] || {};
    const isShortcut = r.stage.mode === 'shortcut';
    const okCount = r.items.filter(i => i.ok).length;

    view.innerHTML = `
      ${pageTitle('できました', `${r.course.short}／${r.stage.title}`)}
      ${card(`
        <div class="result-stars">${stars(n)}</div>
        <p class="result-word">${esc(praise(n))}</p>
        <div class="result-grid">
          ${isShortcut ? `
            <div><span>できた 課題</span><b>${okCount}</b><small>/ ${r.items.length}</small></div>
            <div><span>かかった 時間</span><b>${Math.round(r.elapsedMs / 1000)}</b><small>びょう</small></div>
          ` : `
            <div><span>はやさ</span><b>${r.kps.toFixed(1)}</b><small>打/びょう</small></div>
            <div><span>正かくさ</span><b>${Math.round(r.accuracy)}</b><small>%</small></div>
            <div><span>正しく 打てた 数</span><b>${r.correctKeys}</b><small>だ</small></div>
            <div><span>ミス</span><b>${r.missKeys}</b><small>かい</small></div>
          `}
        </div>
        ${!isShortcut && progress.bestKps ? `<p class="muted">このステージの さいこう記録: ${progress.bestKps.toFixed(1)} 打/びょう</p>` : ''}
      `, 'card-result')}

      ${weakList(r)}

      <div class="result-actions">
        <button class="btn btn-primary" data-again>${icon('retry')} もう1かい</button>
        ${nextStageButton(r)}
        <button class="btn btn-ghost" data-back-course="${esc(r.course.id)}">コースに もどる</button>
      </div>`;

    const again = view.querySelector('[data-again]');
    if (again) {
      again.addEventListener('click', () =>
        T.Nav.replace('play', { courseId: r.course.id, stageId: r.stage.id, source: 'review' }));
    }
    const backCourse = view.querySelector('[data-back-course]');
    if (backCourse) backCourse.addEventListener('click', () => T.Nav.replace('course', { courseId: r.course.id }));
    bindGoButtons();
  }

  function praise(n) {
    if (n >= 3) return 'ミスが ほとんど ない、すばらしい 打ちかたです。';
    if (n === 2) return 'いい ちょうし。あと すこしで ★3つ。';
    if (n === 1) return 'さいごまで やりきりました。正かくさを 上げていこう。';
    return 'ゆっくりで いいので、正しい 指で 打ってみよう。';
  }

  /** つぎの ステージへ すすむ ボタン（最後の ステージなら 出しません） */
  function nextStageButton(r) {
    const course = T.Lessons.findCourse(r.course.id);
    const i = course.stages.findIndex(s => s.id === r.stage.id);
    const next = course.stages[i + 1];
    if (!next) return '';
    return `<button class="btn btn-outline" data-go-stage="${esc(course.id)}:${esc(next.id)}">
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
      </ul>`);
  }

  // ------------------------------------------------------------------
  // きろく
  // ------------------------------------------------------------------

  function renderRecords() {
    const history = T.Store.getHistory().slice().reverse();
    const progress = T.Store.getProgress();
    const best = T.Store.bestOverall();
    const finger = {};
    history.slice(0, 30).forEach(h => {
      Object.keys(h.missByFinger || {}).forEach(k => { finger[k] = (finger[k] || 0) + h.missByFinger[k]; });
    });
    const weak = Object.keys(finger).sort((a, b) => finger[b] - finger[a]).slice(0, 3);

    view.innerHTML = `
      ${pageTitle('きろく', 'これまでの あゆみ')}

      ${best ? card(`
        <p class="lead">${icon('trophy')} さいこう記録</p>
        <div class="best-row">
          <div><b>${best.kps.toFixed(1)}</b><span>打/びょう</span></div>
          <div><b>${Math.round(best.accuracy)}</b><span>% 正かくさ</span></div>
          <div><b>${best.count}</b><span>かい</span></div>
        </div>`) : card('<p class="muted">まだ きろくが ありません。「れんしゅう」から はじめよう。</p>')}

      ${history.length ? card(`
        <p class="lead">${icon('chart')} はやさの うつりかわり</p>
        ${sparkline(history.filter(h => h.mode !== 'shortcut').slice(0, 20).reverse())}`) : ''}

      ${weak.length ? card(`
        <p class="lead">${icon('finger')} にがてな 指</p>
        <ul class="weak-list">
          ${weak.map(id => {
            const f = T.Layout.FINGERS[id];
            return `<li><span class="finger-dot" style="--finger:${f.color}"></span>
              ${esc(f.label)}<span class="weak-count">${finger[id]} かい</span></li>`;
          }).join('')}
        </ul>`) : ''}

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
                ? `正かい ${Math.round(h.accuracy)}%`
                : `${(h.kps || 0).toFixed(1)} 打/びょう ・ ${Math.round(h.accuracy)}%`}</span>
            </li>`).join('') || '<li class="muted">まだ ありません</li>'}
        </ul>`)}
    `;
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
    const points = values.map((v, i) => {
      const x = pad + (w - pad * 2) * (values.length === 1 ? 0 : i / (values.length - 1));
      const y = h - pad - (h - pad * 2) * (v / max);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="はやさの グラフ">
      <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <p class="muted">いちばん はやかった とき: ${max.toFixed(1)} 打/びょう</p>`;
  }

  // ------------------------------------------------------------------
  // せってい
  // ------------------------------------------------------------------

  function renderSettings() {
    const s = T.Store.getSettings();
    const pending = T.StudyLog.pendingCount();
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
        <p class="lead">${icon('send')} きろくと プライバシー</p>
        <p class="muted">Typa は 名前も 出席番号も もちません。れんしゅうの きろくは
        この 端末の 中だけに たまり、<b>学習ポータル</b>を ひらいた ときに
        まなびクエストへ おくられます。</p>
        <p class="pending">まだ おくって いない きろく: <b>${pending}</b> 件</p>
        <a class="btn btn-outline" href="${PORTAL_URL}" target="_blank" rel="noopener">学習ポータルを ひらく</a>`)}

      ${card(`
        <p class="lead">${icon('info')} アプリとして つかう</p>
        <p class="muted">ホーム画面に 入れると、ブラウザの バーが 消えて 画面が 広くなります。
        インターネットに つながって いなくても れんしゅうできます。</p>
        <button class="btn btn-outline" id="install-btn" hidden>ホーム画面に 入れる</button>
        <ul class="howto">
          <li><b>Chrome</b>: アドレスバーの 右の インストール、または メニュー →「アプリをインストール」</li>
          <li><b>Safari（iPad・iPhone）</b>: 共有ボタン →「ホーム画面に追加」</li>
        </ul>
        <p class="version">Typa ${esc(T.StudyLog.APP_VERSION)}</p>`)}
    `;

    T.Keyboard.render($('guide-kb'), { layoutId: s.layout, fingerGuide: true, onTap: null });
    bindSettings();
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
    T.Nav.register('play', { render: renderPlay, leave: leavePlay });
    T.Nav.register('result', { render: renderResult });
    T.Nav.register('records', { render: renderRecords });
    T.Nav.register('settings', { render: renderSettings });

    // ホーム画面の ショートカット（manifest の shortcuts）から ひらかれたとき、
    // そのタブから はじめます。アドレスは すぐ きれいに もどします
    let start = 'home';
    try {
      const tab = new URLSearchParams(location.search).get('tab');
      if (T.Nav.TABS.some(t => t.id === tab)) start = tab;
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
