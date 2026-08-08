/* Typa — src/app.js から つくった 配信用です。手で 直さず src/ を 直して npm run build。*/
(function (global) {
'use strict';
const T = global.Typa;
const icon = T.icon;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s)
.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const APP_VERSION = '4.2.0';
let view = null;
let installPrompt = null;
let userAskedUpdate = false;
let reloading = false;
let updateShown = false;
const challengePick = { pool: 'word', seconds: 60 };
let heatMode = 'miss';
let recordTab = 'today';
let settingsTab = 'hint';
let stopReason = null;
function stars(n) {
let html = '<span class="stars" aria-label="ほし ' + n + 'つ">';
for (let i = 1; i <= 3; i++) html += `<span class="star${i <= n ? ' on' : ''}">${icon('star')}</span>`;
return html + '</span>';
}
function card(inner, cls) { return `<section class="card ${cls || ''}">${inner}</section>`; }
function pageTitle(title, note) {
return `<header class="page-head"><h1>${esc(title)}</h1>${note ? `<p class="page-note">${esc(note)}</p>` : ''}</header>`;
}
function levelBox(lv) {
return `
      <div class="level-box">
        <div class="level-top">
          <span class="level-badge">Lv.${lv.level}</span>
          <span class="level-rank">${esc(lv.rank)}</span>
          <span class="level-xp">つぎの レベルまで あと ${Math.max(0, lv.need - lv.xp)}</span>
        </div>
        <div class="level-bar" role="img" aria-label="レベル ${lv.level}、つぎまで ${Math.max(0, lv.need - lv.xp)}">
          <span data-grow="${Math.round(lv.ratio * 100)}"></span>
        </div>
      </div>`;
}
function levelHero(lv, st, today) {
const left = Math.max(0, lv.need - lv.xp);
return `
      <section class="hero" role="img"
        aria-label="レベル ${lv.level}、${lv.rank}。つぎの レベルまで あと ${left}。れんぞく ${st.days}日。">
        <div class="hero-ring">
          <svg class="ring" viewBox="0 0 120 120" aria-hidden="true">
            <circle class="ring-bg" cx="60" cy="60" r="52"/>
            <circle class="ring-fg" cx="60" cy="60" r="52" data-ring="${lv.ratio.toFixed(3)}"/>
          </svg>
          <span class="hero-lv">
            <b class="hero-lv-num" data-count="${lv.level}">0</b>
            <span class="hero-lv-cap">レベル</span>
          </span>
        </div>
        <div class="hero-body">
          <p class="hero-rank">${esc(lv.rank)}</p>
          <p class="hero-xp">つぎの レベルまで あと <b>${left}</b></p>
          <div class="hero-chips">
            <span class="hero-chip${st.days > 0 ? ' is-fire' : ''}">${icon('fire')}<b>${st.days}</b>日 れんぞく</span>
            <span class="hero-chip">${icon('keyboard')}<b>${today.keys}</b>だ きょう</span>
          </div>
        </div>
      </section>`;
}
function subtabs(list, currentId, attr, label) {
return `
      <div class="subtabs" role="tablist" aria-label="${esc(label)}">
        ${list.map(t => `
          <button class="subtab${t.id === currentId ? ' on' : ''}" type="button" role="tab"
            aria-selected="${t.id === currentId}" data-${attr}="${esc(t.id)}">
            ${icon(t.icon)}<span>${esc(t.label)}</span>
          </button>`).join('')}
      </div>`;
}
function fold(title, count, inner, open) {
return `
      <details class="fold"${open ? ' open' : ''}>
        <summary>${esc(title)}${count ? `<span class="fold-count">${esc(count)}</span>` : ''}</summary>
        <div class="fold-body">${inner}</div>
      </details>`;
}
function empty(iconName, title, note, action) {
return card(`
      <div class="empty">
        ${icon(iconName)}
        <p class="empty-title">${esc(title)}</p>
        <p>${esc(note)}</p>
        ${action || ''}
      </div>`);
}
function bindSubtabs(attr, onPick) {
const list = view.querySelectorAll(`[data-${attr}]`);
list.forEach((el, i) => {
el.addEventListener('click', () => {
const id = el.dataset[attr.replace(/-([a-z])/g, (m, c) => c.toUpperCase())];
if (el.classList.contains('on')) return;
const from = Array.prototype.findIndex.call(list, b => b.classList.contains('on'));
sectionDir = from < 0 ? null : (i > from ? 'right' : 'left');
list.forEach(b => {
const on = b === el;
b.classList.toggle('on', on);
b.setAttribute('aria-selected', String(on));
});
onPick(id);
});
});
}
let sectionDir = null;
function swapSection(box, html, bind) {
if (!box) return;
box.innerHTML = html;
box.classList.remove('section-body');
void box.offsetWidth;
box.classList.add('section-body');
if (bind) bind(box);
if (T.FX) T.FX.enter(box, { dir: sectionDir });
sectionDir = null;
}
function streakLine(st) {
if (st.days <= 0) return `<p class="streak"><span class="streak-off">${icon('fire')}</span>きょう れんしゅうすると、れんぞく 1日目です。</p>`;
return `<p class="streak"><span class="streak-on">${icon('fire')}</span>
      <b>${st.days}日</b> つづいて います。${st.todayDone ? 'きょうの ぶんは できました。' : 'きょうも やると のびます。'}</p>`;
}
function renderMenu() {
const progress = T.Store.getProgress();
const next = findNextStage(progress);
const phase = phaseOf(progress);
const weak = T.Store.weakTargets();
const due = T.Store.dueStages(2);
const clearedStages = T.Lessons.COURSES
.reduce((sum, c) => sum + c.stages.filter(s => (progress[s.id] || {}).clears > 0).length, 0);
const HEADS = {
review: { head: 'きょうの ふくしゅう',
note: 'まえに できた ところです。わすれる 前に もう1かい。' },
resume: { head: 'つづきから', note: '' },
new: { head: 'いま やって いる ところ',
note: 'えらばなくても、下の「うつ」か スペースキーで ここから はじまります。' },
beyond: { head: 'そのさき', note: '' }
};
const head = HEADS[next ? next.reason : 'new'] || HEADS.new;
const beyondNote = next && next.reason === 'beyond'
? beyondLine(progress[next.stage.id] || {})
: '';
const lead = `
      ${next ? card(`
        <p class="lead">${icon(next.reason === 'beyond' ? 'bolt' : 'play')} ${head.head}</p>
        <button class="btn btn-primary btn-big" data-go-stage="${esc(next.course.id)}:${esc(next.stage.id)}">
          <span class="btn-sub">${esc(next.course.short)}</span>
          <span class="btn-main">${esc(next.stage.title)}</span>
          ${icon('next')}
        </button>
        <p class="muted start-note">${next.reason === 'resume'
? `あと ${next.left}もん 打つと ひとまわりです。`
: (beyondNote || head.note)}</p>`, 'card-next') : ''}
      ${reviewCard(next && next.reason === 'review' ? due.slice(1) : due)}
      ${phase.name === 'beyond' ? beyondCard(progress) : ''}`.trim();
view.innerHTML = `
      ${pageTitle('えらぶ', 'べつの ことを やりたい ときは ここから。スペースキーで すぐ 打てます')}

      <div class="menu-grid">
        ${lead ? `<div class="menu-col">${lead}</div>` : ''}

        <div class="menu-list">
        <button class="menu-row tile-blue" data-go-screen="courses">
          <span class="row-icon">${icon('keyboard')}</span>
          <span class="row-body">
            <span class="row-title">コースから えらぶ</span>
            <span class="row-note">ゆびの ばしょ・ローマ字・ことば・文・ショートカット</span>
            <span class="row-bar"><span data-grow="${Math.round(clearedStages / Math.max(1, T.Lessons.totalStages()) * 100)}"></span></span>
            <span class="row-count">${clearedStages} / ${T.Lessons.totalStages()} ステージ</span>
          </span>
          <span class="row-arrow">${icon('next')}</span>
        </button>

        <button class="menu-row tile-amber" data-go-screen="challenge">
          <span class="row-icon">${icon('timer')}</span>
          <span class="row-body">
            <span class="row-title">チャレンジ</span>
            <span class="row-note">30・60・120びょうで どれだけ 打てるか</span>
            <span class="row-count">${challengeBestLine()}</span>
          </span>
          <span class="row-arrow">${icon('next')}</span>
        </button>

        <button class="menu-row tile-violet" data-go-weak ${weak.ready ? '' : 'disabled'}>
          <span class="row-icon">${icon('finger')}</span>
          <span class="row-body">
            <span class="row-title">にがて とっくん</span>
            <span class="row-note">${weak.ready
? 'まちがえやすい キーだけ あつめて 打ちます'
: 'すこし れんしゅうすると つかえます'}</span>
          </span>
          <span class="row-arrow">${icon('next')}</span>
        </button>

        <button class="menu-row tile-teal" data-tab-go="records">
          <span class="row-icon">${icon('chart')}</span>
          <span class="row-body">
            <span class="row-title">きょうの ようす・きろく</span>
            <span class="row-note">レベル・れんぞく日数・にがてキー・バッジ</span>
          </span>
          <span class="row-arrow">${icon('next')}</span>
        </button>
      </div>
      </div>
    `;
bindGoButtons();
}
function beyondLine(p) {
const next = T.Store.nextRank((p || {}).rank || 0);
if (!next) return 'この ステージは 3だん。ほかの ステージで だんを あげよう。';
return `${next.rank}だんは「${T.Store.HINT_STEPS[next.hint]}」で `
+ `${next.kps.toFixed(1)} 打/びょう。ひとまわりを ★3つで。`;
}
function beyondCard(progress) {
const list = allStages().filter(x => !x.stage.noStars && x.stage.mode !== 'shortcut');
const total = list.length;
const sum = [0, 0, 0, 0];
list.forEach(x => { sum[Math.max(0, Math.min(3, (progress[x.stage.id] || {}).rank || 0))]++; });
const done = total - sum[0];
return card(`
      <p class="lead">${icon('bolt')} そのさき ― はやく、見ないで 打つ</p>
      <p class="muted">★は ぜんぶ 3つに なりました。ここからは
      <b>キーボードを 見ないで</b>、<b>はやく</b> 打てるように していきます。
      ヒントを 1つ 消した ままで はやさの めやすに とどくと「だん」が 上がります。</p>
      <span class="row-bar"><span data-grow="${Math.round(done / Math.max(1, total) * 100)}"></span></span>
      <p class="rank-sum">${[1, 2, 3].map(n =>
`<span class="rank-chip">${n}だん <b>${sum[n]}</b></span>`).join('')}
        <span class="rank-chip muted">まだ <b>${sum[0]}</b></span>
        <span class="muted">／ ぜんぶで ${total} ステージ</span></p>
      <ul class="rank-goals">
        ${T.Store.SPEED_RANKS.map(s =>
`<li><b>${s.rank}だん</b> … ${esc(T.Store.HINT_STEPS[s.hint])} ＋ ${s.kps.toFixed(1)} 打/びょう</li>`).join('')}
      </ul>`, 'card-beyond');
}
function reviewCard(due) {
const rows = (due || []).map(d => {
const found = T.Lessons.findStageById(d.stageId);
return found ? { found, due: d } : null;
}).filter(Boolean);
if (rows.length === 0) return '';
return card(`
      <p class="lead">${icon('clock')} そろそろ ふくしゅう</p>
      <p class="muted">まえに できた ステージです。わすれる まえに もう1かい やると、
      ずっと わすれにくく なります。</p>
      <div class="review-list">
        ${rows.map(({ found, due: d }) => `
          <button class="btn btn-outline review-row" data-go-stage="${esc(found.course.id)}:${esc(found.stage.id)}">
            <span class="review-body">
              <span class="review-sub">${esc(found.course.short)}</span>
              <span class="review-title">${esc(found.stage.title)}</span>
            </span>
            <span class="review-when">${esc(sinceLabel(d.lastAt))}</span>
            ${icon('next')}
          </button>`).join('')}
      </div>`, 'card-review');
}
function sinceLabel(lastAt) {
const day = T.Store.localDay(lastAt);
if (!day) return '';
for (let i = 0; i <= 60; i++) {
if (T.Store.dayBefore(i) === day) {
if (i === 0) return 'きょう';
if (i === 1) return 'きのう';
return `${i}日 まえ`;
}
}
return 'ずっと まえ';
}
function allStages() {
const out = [];
T.Lessons.COURSES.forEach(course => {
course.stages.forEach(stage => out.push({ course, stage }));
});
return out;
}
function phaseOf(progress) {
const all = allStages();
const done = all.filter(x => ((progress[x.stage.id] || {}).stars || 0) >= 3);
return {
name: done.length === all.length && all.length > 0 ? 'beyond' : 'learn',
starred: done.length,
total: all.length
};
}
function findNextStage(progress) {
const stageInfo = id => {
const found = T.Lessons.findStageById(id);
return found || null;
};
const leftOf = stage => {
const need = Math.max(1, T.Lessons.stageCount(stage));
const p = progress[stage.id] || {};
return Math.max(1, need - Math.min(need - 1, p.lapItems || 0));
};
const due = T.Store.dueStages(1);
if (due.length) {
const f = stageInfo(due[0].stageId);
if (f) {
const p = progress[f.stage.id] || {};
return {
course: f.course, stage: f.stage, reason: 'review',
resume: (p.lapItems || 0) > 0, left: leftOf(f.stage),
goalKps: goalKpsOf(p), rank: p.rank || 0
};
}
}
let resume = null;
allStages().forEach(({ course, stage }) => {
const p = progress[stage.id];
if (!p || !(p.lapItems > 0)) return;
if (!resume || String(p.lastAt || '') > String(resume.p.lastAt || '')) {
resume = { course, stage, p };
}
});
if (resume) {
return {
course: resume.course, stage: resume.stage, reason: 'resume',
resume: true, left: leftOf(resume.stage),
goalKps: goalKpsOf(resume.p), rank: resume.p.rank || 0
};
}
const list = allStages();
for (const { course, stage } of list) {
const p = progress[stage.id];
if (!p || (p.stars || 0) < 3) {
return { course, stage, reason: 'new', resume: false, left: 0, goalKps: 0, rank: 0 };
}
}
const beyond = list
.filter(x => !x.stage.noStars && x.stage.mode !== 'shortcut')
.slice()
.sort((a, b) => {
const pa = progress[a.stage.id] || {}, pb = progress[b.stage.id] || {};
const ra = pa.rank || 0, rb = pb.rank || 0;
if (ra !== rb) return ra - rb;
return String(pa.lastAt || '') < String(pb.lastAt || '') ? -1 : 1;
})[0] || list[0];
const bp = progress[beyond.stage.id] || {};
return {
course: beyond.course, stage: beyond.stage, reason: 'beyond',
resume: false, left: 0, goalKps: goalKpsOf(bp), rank: bp.rank || 0
};
}
function goalKpsOf(p) {
const next = T.Store.nextRank((p || {}).rank || 0);
return next ? next.kps : 0;
}
function renderCourses() {
const progress = T.Store.getProgress();
view.innerHTML = `
      ${pageTitle('れんしゅう', 'コースを えらんでね')}
      <div class="course-list">
        ${T.Lessons.COURSES.map(c => {
const cleared = c.stages.filter(s => (progress[s.id] || {}).clears > 0).length;
const done = cleared >= c.stages.length;
return `
          <button class="course-row tile-${c.color}${done ? ' is-full' : ''}" data-go-course="${esc(c.id)}">
            <span class="row-icon">${icon(c.icon)}</span>
            <span class="row-body">
              <span class="row-title">${esc(c.title)}${done ? `<span class="grade-chip">${icon('check')} ぜんぶ クリア</span>` : ''}</span>
              <span class="row-note">${esc(c.note)}</span>
              <span class="row-bar"><span data-grow="${Math.round(cleared / c.stages.length * 100)}"></span></span>
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
const cleared = course.stages.filter(s => (progress[s.id] || {}).clears > 0).length;
const starSum = course.stages.reduce((n, s) => n + ((progress[s.id] || {}).stars || 0), 0);
view.innerHTML = `
      ${pageTitle(course.title, course.note)}

      <!-- コースの すすみぐあいを 1行だけ。ステージを 1つずつ 見なくても
           「どこまで きたか」が わかります -->
      ${card(`
        <p class="lead">${icon(course.icon)} この コースの すすみ
          <span class="course-sum">${cleared} / ${course.stages.length} ステージ ・ ★ ${starSum} / ${course.stages.length * 3}</span></p>
        <span class="row-bar"><span data-grow="${Math.round(cleared / course.stages.length * 100)}"></span></span>
        ${course.note2 ? `<p class="muted">${icon('info')} ${esc(course.note2)}</p>` : ''}
        ${course.id === 'romaji' ? `
          <button class="btn btn-outline btn-small mt" data-go-screen="romaji-table">${icon('grid')} ローマ字ひょうを 見る</button>` : ''}
      `, `tile-${course.color} card-course`)}

      <div class="stage-list">
        ${course.stages.map((s, i) => {
const p = progress[s.id] || { clears: 0, stars: 0, bestKps: 0, bestAccuracy: 0 };
const need = Math.max(1, T.Lessons.stageCount(s));
const lap = Math.max(0, Math.min(need - 1, p.lapItems || 0));
const cls = p.stars >= 3 ? ' is-full' : (lap > 0 ? ' is-doing' : '');
return `
          <button class="stage-row${cls}" data-go-stage="${esc(course.id)}:${esc(s.id)}">
            <span class="stage-no">${p.stars >= 3 ? icon('crown') : (i + 1)}</span>
            <span class="stage-body">
              <span class="stage-title">${esc(s.title)}${s.grade
? `<span class="grade-chip">めやす ${s.grade}年</span>` : ''}</span>
              <span class="stage-note">${esc(s.note)}</span>
              ${lap > 0 ? `<span class="stage-lap">
                <span class="lap-bar"><span data-grow="${Math.round(lap / need * 100)}"></span></span>
                <span class="stage-lap-text">ひとまわりまで あと ${need - lap}もん</span></span>` : ''}
              ${p.clears > 0 ? `<span class="stage-best">さいこう ${p.bestKps.toFixed(1)} 打/びょう ・ 正かくさ ${Math.round(p.bestAccuracy)}%</span>` : ''}
            </span>
            ${(p.rank || 0) > 0 ? `<span class="stage-rank">${icon('bolt')}${p.rank}だん</span>` : ''}
            ${stars(p.stars)}
            <span class="row-arrow">${icon('next')}</span>
          </button>`;
}).join('')}
      </div>`;
bindGoButtons();
}
function renderChallenge() {
const all = T.Store.getChallenge();
const id = `ch-${challengePick.pool}-${challengePick.seconds}`;
const best = all[id];
view.innerHTML = `
      ${pageTitle('チャレンジ', '時間ないに どれだけ 打てるかな')}
      <p class="hint-box">${icon('info')} 正しく 打てた 数が スコアです。
      まちがえると すすまないので、あわてず ていねいに 打つほうが たくさん 打てます。</p>

      <!-- ひろい 画面では 3まいの カードを よこに ならべます（style.css の .card-cols）-->
      <div class="card-cols">
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
      </div>
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
function renderPlay(params) {
let found = null;
const special = params.special || '';
if (special === 'challenge') {
found = T.Lessons.buildChallengeStage(params.pool, params.seconds);
} else if (special === 'weak') {
found = T.Lessons.buildWeakStage(T.Store.weakTargets());
if (!found) {
toast('にがてが まだ わかりません。すこし れんしゅうしてから きてね。');
T.Nav.selectTab('menu');
return;
}
} else if (params.courseId || params.stageId) {
found = T.Lessons.findStage(params.courseId, params.stageId);
} else {
const next = findNextStage(T.Store.getProgress());
found = { course: next.course, stage: next.stage };
}
if (!found) { T.Nav.selectTab('menu'); return; }
const progressNow = T.Store.getProgress();
const goalKps = (!special && phaseOf(progressNow).name === 'beyond' && !found.stage.noStars
&& found.stage.mode !== 'shortcut')
? goalKpsOf(progressNow[found.stage.id]) : 0;
const opt = {
course: found.course, stage: found.stage,
source: params.source || 'course', special, mount: view,
goalKps,
blind: !!params.blind,
assistLevel: typeof params.assistLevel === 'number' ? params.assistLevel : undefined,
onStop: () => T.Nav.back('stop'),
onPick: () => T.Nav.go('course', { courseId: found.course.id }),
onAway: () => T.Nav.replace('play', sessionParams(found, params))
};
if (found.stage.mode === 'shortcut') {
T.Shortcut.setOnFinish(onSessionFinish);
T.Shortcut.start(opt);
} else {
T.Play.setOnFinish(onSessionFinish);
T.Play.start(opt);
}
}
function sessionParams(found, params) {
const special = params.special || '';
if (special === 'challenge') {
return { special, pool: found.stage.pool, seconds: found.stage.seconds };
}
if (special === 'weak') return { special };
return {
courseId: found.course.id,
stageId: found.stage.id,
source: params.source || 'course',
blind: !!params.blind,
assistLevel: params.assistLevel
};
}
function leavePlay(params, reason) {
const isPlay = T.Play.isRunning();
const isShortcut = T.Shortcut.isRunning();
if (!isPlay && !isShortcut) return true;
const mod = isPlay ? T.Play : T.Shortcut;
const showResult = reason === 'back' && mod.hasWork();
stopReason = showResult ? 'show' : 'quiet';
mod.stop();
stopReason = null;
return !showResult;
}
function onSessionFinish(result) {
if (!hadWork(result)) return;
const info = saveResult(result);
if (result.status === 'completed' || stopReason === 'show') {
T.Nav.replace('result', { result, info });
}
}
function hadWork(r) {
return (r.totalKeys || 0) > 0 || (r.doneItems || 0) > 0 || (r.done || 0) > 0;
}
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
} else if (!stage.noStars) {
const applied = T.Store.applyResult(stage.id, {
doneItems: result.doneItems != null ? result.doneItems : result.done,
correctItems: (result.items || []).filter(it => it && it.ok && !it.retry).length,
lapNeed: result.lapNeed || result.count || 1,
correctKeys: result.correctKeys,
totalKeys: result.totalKeys,
hintStrength: result.hintStrength,
lapStarsSeen: result.lapStarsSeen,
kps: result.kps, accuracy: result.accuracy, finishedAt: result.finishedAt
});
meta.firstClear = applied.firstClear;
meta.newBestKps = applied.newBestKps;
meta.newStars = applied.newStars;
meta.prevBestKps = applied.prevBestKps;
meta.laps = applied.laps;
meta.lapStars = applied.lapStars;
meta.lapAccuracy = applied.lapAccuracy;
meta.lapItems = applied.lapItems;
meta.lapNeed = applied.lapNeed;
meta.lapRank = applied.lapRank;
meta.newRank = applied.newRank;
meta.rank = applied.best.rank || 0;
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
stars: stage.noStars || !meta.laps ? 0 : (meta.lapStars || 0),
missByKey: result.missByKey,
missByFinger: result.missByFinger,
lat: result.lat,
conf: result.conf,
rule: result.rule
});
if (T.Study) {
T.Study.save(result, {
appVersion: APP_VERSION, lapStars: meta.lapStars, rank: meta.rank
});
}
const awarded = T.Awards.applyResult(result, meta);
return { meta, awarded };
}
function renderResult(params) {
const r = params.result;
if (!r) { T.Nav.selectTab('courses'); return; }
const info = params.info || {};
const meta = info.meta || {};
const awarded = info.awarded || null;
const isShortcut = r.stage.mode === 'shortcut';
const isChallenge = r.stage.mode === 'challenge';
const noStars = !!r.stage.noStars;
const lapped = (meta.laps || 0) > 0;
const n = lapped && meta.lapStars != null ? meta.lapStars : T.Store.starsOf(r);
const progress = T.Store.getProgress()[r.stage.id] || {};
const okCount = r.items.filter(i => i.ok).length;
const isBest = !!(meta.newBestKps || meta.isBestScore);
const recStep = recommend(r);
const recParams = recStep ? recStep.params : null;
const title = isChallenge
? (r.status === 'completed' ? 'そこまで！' : 'ここまでの きろく')
: (lapped ? 'ひとまわり できました' : 'ここまでの きろく');
view.innerHTML = `
      ${pageTitle(title, `${r.course.short}／${r.stage.title}`)}

      ${card(`
        ${isBest ? `<p class="result-best">${icon('sparkle')} 新記録！</p>` : ''}
        ${noStars || (!lapped && !isChallenge) ? '' : `<div class="result-stars">${stars(n)}</div>`}
        <p class="result-word">${esc(praise(r, meta, n))}</p>
        <div class="result-grid">
          ${isShortcut ? `
            <div><span>できた 課題</span><b data-count="${okCount}">0</b><small>/ ${r.items.length}</small></div>
            <div><span>かかった 時間</span><b data-count="${Math.round(r.elapsedMs / 1000)}">0</b><small>びょう</small></div>
          ` : `
            ${isChallenge ? `<div><span>スコア</span><b data-count="${r.correctKeys}">0</b><small>だ</small></div>` : ''}
            <div><span>はやさ</span><b data-count="${r.kps.toFixed(1)}" data-dec="1">0.0</b><small>打/びょう</small></div>
            <div><span>正かくさ</span><b data-count="${Math.round(r.accuracy)}">0</b><small>%</small></div>
            ${isChallenge ? '' : `<div><span>正しく 打てた 数</span><b data-count="${r.correctKeys}">0</b><small>だ</small></div>`}
            <div><span>ミス</span><b data-count="${r.missKeys}">0</b><small>かい</small></div>
            <div><span>れんぞく</span><b data-count="${r.combo || 0}">0</b><small>だ</small></div>
          `}
        </div>
        ${compareLine(r, meta, progress)}
      `, 'card-result')}

      ${lapCard(r, meta)}
      ${rankCard(r, meta)}

      ${xpCard(awarded)}
      ${badgeCard(awarded)}
      ${nextStepCard(recStep)}

      <!-- ここから下は「もっと しりたい ときだけ」の ところです。
           けっか画面は つぎへ すすむ ための 画面なので、グラフや にがては
           たたんで おきます。ひらいて さいしょに 見えるのは、
           けっか・すすみ・けいけんち・つぎに やる こと の 4つだけ です -->
      ${detailFold(r)}

      <div class="result-actions">
        <button class="btn btn-outline" data-again>${icon('retry')} もう1かい</button>
        ${nextActionButton(r)}
        <button class="btn btn-ghost" data-back-list>${isChallenge ? 'チャレンジを えらぶ' : (noStars ? 'うつ 画面へ' : 'コースに もどる')}</button>
      </div>`;
const again = view.querySelector('[data-again]');
if (again) again.addEventListener('click', () => T.Nav.replace('play', againParams(r)));
const rec = view.querySelector('[data-rec]');
if (rec && recParams) rec.addEventListener('click', () => T.Nav.replace('play', recParams));
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
else if (noStars) T.Nav.selectTab(T.Nav.ROOT_TAB);
else T.Nav.replace('course', { courseId: r.course.id });
});
}
bindGoButtons();
celebrate(r, meta, awarded, n, lapped);
}
function celebrate(r, meta, awarded, n, lapped) {
if (!T.FX) return;
const starEls = view.querySelectorAll('.result-stars .star');
if (starEls.length) T.FX.popAll(starEls, 140);
const isBest = !!(meta.newBestKps || meta.isBestScore);
const levelUp = !!(awarded && awarded.levelUp);
const newBadge = !!(awarded && awarded.badges && awarded.badges.length);
const great = lapped && n >= 3;
if (!(isBest || levelUp || newBadge || great || (lapped && meta.firstClear))) return;
const power = (levelUp || isBest) ? 1.15 : .85;
const count = (levelUp || isBest) ? 110 : 70;
const later = (ms, fn) => setTimeout(() => {
const el = view.querySelector('.card-result');
if (el && document.contains(el)) fn(el);
}, ms);
later(260, () => {
T.FX.confettiAt(view.querySelector('.card-result'), { count, power });
const badgeBox = view.querySelector('.card-badge-new');
if (badgeBox) T.FX.ripple(badgeBox);
});
if (levelUp && newBadge) {
later(1100, () => T.FX.confettiAt(view.querySelector('.card-badge-new'), { count: 48, power: .7 }));
}
}
function detailFold(r) {
const chart = r.keystrokes && r.keystrokes.length >= 8
? `<p class="lead">${icon('chart')} どこで 手が とまったか</p>${timeline(r.keystrokes)}`
: '';
const weak = weakBody(r);
if (!chart && !weak) return '';
return fold('くわしく 見る', '', `${chart}${chart && weak ? '<hr class="fold-line">' : ''}${weak}`);
}
function timeline(keystrokes) {
const list = (keystrokes || []).filter(k => k.ms > 0);
if (list.length < 8) return '';
const CLIP = 1200;
const w = 300, h = 80, pad = 5;
const MAX_BARS = 200;
const step = Math.ceil(list.length / MAX_BARS);
const bars = [];
for (let i = 0; i < list.length; i += step) {
const chunk = list.slice(i, i + step);
let worst = chunk[0];
chunk.forEach(k => { if (k.ms > worst.ms) worst = k; });
bars.push({ ms: worst.ms, ok: chunk.every(k => k.ok), ch: worst.ch, retry: worst.retry });
}
const bw = (w - pad * 2) / bars.length;
const body = h - pad * 2;
const rects = bars.map((b, i) => {
const x = pad + bw * i;
const bh = Math.max(1.5, body * Math.min(1, b.ms / CLIP));
const y = h - pad - bh;
const cls = b.ok ? (b.retry ? 'tl-retry' : 'tl-ok') : 'tl-ng';
const tick = b.ok ? '' :
`<rect class="tl-tick" x="${(x + bw * 0.15).toFixed(1)}" y="${(h - pad).toFixed(1)}"
           width="${Math.max(1.2, bw * 0.7).toFixed(1)}" height="3"/>`;
return `<rect class="${cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}"
        width="${Math.max(0.8, bw * 0.8).toFixed(1)}" height="${bh.toFixed(1)}" rx="1"/>${tick}`;
}).join('');
const sorted = list.map(k => k.ms).sort((a, b) => a - b);
const mid = sorted[Math.floor(sorted.length / 2)];
const midY = h - pad - body * Math.min(1, mid / CLIP);
let worst = list[0];
list.forEach(k => { if (k.ms > worst.ms) worst = k; });
const worstSec = (worst.ms / 1000).toFixed(1);
const midSec = (mid / 1000).toFixed(1);
const smooth = worst.ms < mid * 3;
return `
      <svg class="tl" viewBox="0 0 ${w} ${h}" role="img"
        aria-label="1打ごとに かかった 時間の グラフ。ふだんは ${midSec}びょう、いちばん 止まったのは ${worstSec}びょうでした。">
        <line class="tl-mid" x1="${pad}" y1="${midY.toFixed(1)}" x2="${w - pad}" y2="${midY.toFixed(1)}"/>
        ${rects}
      </svg>
      <p class="muted">ふだんは <b>${midSec}びょう</b>に 1打。
      いちばん 手が 止まったのは <b>${esc(worst.ch === ' ' ? 'スペース' : worst.ch.toUpperCase())}</b> の
      ところで <b>${worstSec}びょう</b>でした。
      ${smooth ? 'リズムよく 打てて います。' : 'そこが すらすら 打てると、ぐんと はやく なります。'}</p>`;
}
function nextStepCard(rec) {
if (!rec) return '';
return card(`
      <p class="lead">${icon('target')} つぎは これを やろう</p>
      <p class="muted">${esc(rec.why)}</p>
      <button class="btn btn-primary btn-big" data-rec>
        <span class="btn-sub">${esc(rec.sub)}</span>
        <span class="btn-main">${esc(rec.title)}</span>
        ${icon('next')}
      </button>`, 'card-next');
}
function recommend(r) {
const due = T.Store.dueStages(1);
if (due.length && due[0].stageId !== r.stage.id) {
const f = T.Lessons.findStageById(due[0].stageId);
if (f) {
return {
why: `${sinceLabel(due[0].lastAt)}に できた ステージです。わすれる 前に もう1かい。`,
sub: f.course.short, title: f.stage.title,
params: { courseId: f.course.id, stageId: f.stage.id, source: 'course' }
};
}
}
const targets = T.Store.weakTargets();
if (targets.ready && r.special !== 'weak' && (r.accuracy || 100) < 92) {
const pair = targets.pairs[0];
return {
why: pair
? `${pair.from.toUpperCase()} と ${pair.to.toUpperCase()} を とりちがえて いました。区べつを つけよう。`
: `${targets.keys.slice(0, 3).map(k => k.toUpperCase()).join(' ')} で つまずいて いました。`,
sub: 'とくべつ れんしゅう', title: 'にがて とっくん',
params: { special: 'weak' }
};
}
const rules = T.Store.weakRules();
if (rules.length) {
const stage = stageForRule(rules[0].rule);
if (stage && stage.stage.id !== r.stage.id) {
return {
why: `「${rules[0].label}」で 10かいに ${Math.max(1, Math.round(rules[0].errRate * 10))}かい まちがえて います。`,
sub: stage.course.short, title: stage.stage.title,
params: { courseId: stage.course.id, stageId: stage.stage.id, source: 'course' }
};
}
}
const progress = T.Store.getProgress();
const stars = (progress[r.stage.id] || {}).stars || 0;
const typing = !r.stage.noStars && r.stage.mode !== 'shortcut' && r.stage.mode !== 'challenge';
if (typing && phaseOf(progress).name === 'beyond') {
const beyond = beyondStep(r, progress);
if (beyond) return beyond;
}
const s = T.Store.getSettings();
const level = typeof s.assist === 'number' ? s.assist : (s.keyboard === false ? 3 : 0);
const solid = (r.totalKeys || 0) >= T.Store.MIN_RECORD_KEYS;
if (typing && stars >= 3 && level < 3 && s.assist !== 'auto' && solid && T.Store.starsOf(r) >= 3) {
return {
why: 'ばっちり 打てて います。つぎは ヒントを へらして、手もとを 見ないで やってみよう。',
sub: r.course.short, title: 'めかくしで やってみる',
params: { courseId: r.course.id, stageId: r.stage.id, source: 'review', blind: true }
};
}
const course = T.Lessons.findCourse(r.course.id);
if (course && !r.stage.noStars) {
const i = course.stages.findIndex(st => st.id === r.stage.id);
const next = course.stages[i + 1];
if (next && stars >= 2) {
return {
why: 'この ステージは よく できました。つぎへ すすもう。',
sub: course.short, title: next.title,
params: { courseId: course.id, stageId: next.id, source: 'course' }
};
}
if (i >= 0 && stars < 3) {
return {
why: '★3つを めざして、もう1かい ゆっくり ていねいに。',
sub: r.course.short, title: r.stage.title,
params: againParams(r)
};
}
if (i >= 0) {
const first = firstStageWithout3(progress);
if (first) {
return {
why: 'この コースは ここまでです。まだ ★3つに なって いない ところへ。',
sub: first.course.short, title: first.stage.title,
params: { courseId: first.course.id, stageId: first.stage.id, source: 'course' }
};
}
}
}
return null;
}
function firstStageWithout3(progress) {
return allStages().filter(x => ((progress[x.stage.id] || {}).stars || 0) < 3)[0] || null;
}
function beyondStep(r, progress) {
const p = progress[r.stage.id] || {};
const next = T.Store.nextRank(p.rank || 0);
if (!next) {
const low = findNextStage(progress);
if (low && low.stage.id !== r.stage.id) {
return {
why: 'この ステージは 3だん。つぎの ステージで だんを あげよう。',
sub: low.course.short, title: low.stage.title,
params: { courseId: low.course.id, stageId: low.stage.id, source: 'course' }
};
}
return {
why: 'ぜんぶの ステージが 3だん。つぎは 時間ぎめの チャレンジで ためそう。',
sub: 'チャレンジ', title: '60びょう ／ 文',
params: { special: 'challenge', pool: 'sentence', seconds: 60 }
};
}
const hintNow = Math.max(0, Math.round(r.hintStrength || 0));
if (hintNow < next.hint) {
return {
why: `${next.rank}だんは「${T.Store.HINT_STEPS[next.hint]}」で 打てたら です。`
+ ' この回 だけ ヒントを へらして やってみよう。',
sub: r.course.short, title: `${T.Store.HINT_STEPS[next.hint]}で やってみる`,
params: {
courseId: r.course.id, stageId: r.stage.id, source: 'review',
assistLevel: next.hint
}
};
}
return {
why: `${T.Store.HINT_STEPS[next.hint]}で 打てて います。`
+ ` あとは はやさ ${next.kps.toFixed(1)} 打/びょう で ${next.rank}だんです。`,
sub: r.course.short, title: 'もう1かい、リズムよく',
params: {
courseId: r.course.id, stageId: r.stage.id, source: 'review',
assistLevel: next.hint
}
};
}
function againParams(r) {
if (r.stage.mode === 'challenge') {
return { special: 'challenge', pool: r.stage.pool, seconds: r.stage.seconds };
}
if (r.special === 'weak') return { special: 'weak' };
return { courseId: r.course.id, stageId: r.stage.id, source: 'review' };
}
function lapCard(r, meta) {
if (r.stage.noStars || r.stage.mode === 'challenge' || !meta.lapNeed) return '';
const need = meta.lapNeed;
const items = Math.max(0, Math.min(need, meta.lapItems || 0));
const laps = meta.laps || 0;
const left = Math.max(0, need - items);
return card(`
      <p class="lead">${icon('target')} ${esc(r.stage.title)}の すすみ</p>
      ${laps > 0
? `<p class="muted">この 回で <b>${laps}しゅう</b> できました。${
left < need ? `つぎの しゅうは <b>${need - left}もん</b> すすんで います。` : ''}</p>`
: `<p class="muted">この 回で <b>${r.doneItems || 0}もん</b> 打ちました。
           やめても 消えません。つぎは <b>${items + 1}もん目</b>から はじまります。</p>`}
      <div class="lap-bar" role="img" aria-label="ひとまわりまで あと ${left}もん">
        <span data-grow="${Math.round(items / need * 100)}"></span>
      </div>
      <p class="lap-note">${left === 0
? 'ひとまわり できました。'
: `ひとまわりまで あと <b>${left}もん</b>（ぜんぶで ${need}もん）`}</p>
      ${lapAccuracyNote(r, meta)}`, 'card-lap');
}
function lapAccuracyNote(r, meta) {
const lap = meta.lapAccuracy;
if (typeof lap !== 'number' || r.stage.mode === 'shortcut') return '';
if (Math.abs(lap - (r.accuracy || 0)) < 1) return '';
const shown = Math.round(lap);
return meta.laps > 0
? `<p class="lap-note muted">★は この ひとまわり ぜんぶ（前の つづきも 入れて）の
         正かくさ <b>${shown}%</b> で つきました。</p>`
: `<p class="lap-note muted">いまの ひとまわりは、ここまで あわせて
         正かくさ <b>${shown}%</b> です。</p>`;
}
function rankCard(r, meta) {
if (r.stage.noStars || r.stage.mode === 'challenge' || r.stage.mode === 'shortcut') return '';
const progress = T.Store.getProgress();
const p = progress[r.stage.id] || {};
if ((p.stars || 0) < 3) return '';
if (phaseOf(progress).name !== 'beyond') return '';
const rank = p.rank || 0;
const next = T.Store.nextRank(rank);
const got = meta.newRank > 0;
const hintNow = T.Store.HINT_STEPS[Math.max(0, Math.round(r.hintStrength || 0))] || '';
let todo = '';
if (next) {
const fastEnough = (r.kps || 0) >= next.kps;
const quietEnough = (r.hintStrength || 0) >= next.hint;
const parts = [];
if (!quietEnough) parts.push(`ヒントを <b>${esc(T.Store.HINT_STEPS[next.hint])}</b> まで へらす`);
if (!fastEnough) parts.push(`はやさ <b>${next.kps.toFixed(1)} 打/びょう</b>`);
if ((meta.lapStars || 0) < 3 && meta.laps > 0) parts.push('ひとまわりを <b>★3つ</b> で');
todo = parts.length
? `<p class="rank-todo">${rank + 1}だんまで あと … ${parts.join(' ／ ')}</p>`
: '<p class="rank-todo">つぎの ひとまわりで とどきます。</p>';
}
return card(`
      <p class="lead">${icon('bolt')} ${esc(r.stage.title)}の だん</p>
      ${got
? `<p class="rank-up">${icon('trophy')} <b>${rank}だん</b> に なりました！</p>`
: ''}
      <p class="rank-now">${rank > 0 ? `いま <b>${rank}だん</b>` : 'まだ <b>だんなし</b>'}
        <span class="muted">／ この回は「${esc(hintNow)}」で ${(r.kps || 0).toFixed(1)} 打/びょう</span></p>
      ${next ? todo : '<p class="rank-todo">3だん。この ステージは ここまでです。ほかの ステージへ どうぞ。</p>'}`,
'card-rank');
}
function praise(r, meta, n) {
if (r.stage.mode === 'challenge') {
if (r.status !== 'completed') {
return `${r.correctKeys}だ 打てました。さいごの 時間まで やると スコアに なります。`;
}
if (meta.isBestScore) return `${r.correctKeys}だ！ これまでで いちばん たくさん 打てました。`;
return `${r.correctKeys}だ 打てました。正かくさが 上がると スコアも のびます。`;
}
if (r.special === 'weak') return 'にがてな キーに むきあえました。くりかえすほど 手が おぼえます。';
if (!(meta.laps > 0)) {
if ((r.correctKeys || 0) < 10) return 'すこしでも 打てば、その ぶんは のこります。また いつでも どうぞ。';
return `${r.correctKeys}だ 打てました。つづきは いつでも ここから はじめられます。`;
}
if (n >= 3) return 'ミスが ほとんど ない、すばらしい 打ちかたです。';
if (n === 2) return 'いい ちょうし。あと すこしで ★3つ。';
if (n === 1) return 'ひとまわり できました。正かくさを 上げていこう。';
return 'ゆっくりで いいので、正しい 指で 打ってみよう。';
}
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
function xpCard(awarded) {
if (!awarded || awarded.gained <= 0) return '';
return card(`
      <p class="lead">${icon('sparkle')} もらった けいけんち</p>
      ${awarded.levelUp ? `<p class="level-up">${icon('trophy')} レベルアップ！
        <b>Lv.${awarded.after.level}</b> ${esc(awarded.after.rank)} に なりました。</p>` : ''}
      <p class="xp-total">＋<b data-count="${awarded.gained}">0</b> <span>けいけんち</span></p>
      <ul class="xp-list">
        ${awarded.parts.map(p => `<li>${esc(p.label)}<span>＋${p.xp}</span></li>`).join('')}
      </ul>
      ${levelBox(awarded.after)}`);
}
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
function weakBody(r) {
const keys = Object.keys(r.missByFinger || {});
if (keys.length === 0) return '';
const top = keys.sort((a, b) => r.missByFinger[b] - r.missByFinger[a]).slice(0, 3);
return `
      <p class="lead">${icon('finger')} つぎに 気を つけると よい ところ</p>
      <ul class="weak-list">
        ${top.map(id => {
const f = T.Layout.FINGERS[id];
return `<li><span class="finger-dot" style="--finger:${f.color}"></span>
            ${esc(f.label)}<span class="weak-count">${r.missByFinger[id]} かい</span></li>`;
}).join('')}
      </ul>`;
}
function studyCard() {
if (!T.StudyStats) return '';
const records = T.StudyStats.loadRecords();
if (records.length === 0) return '';
const week = T.StudyStats.summary(7, records);
if (week.sessions === 0) return '';
const units = T.StudyStats.byUnit(10, records).slice(0, 3);
return card(`
      <p class="lead">${icon('chart')} この 1しゅうかんの つみあげ</p>
      <div class="today">
        <div class="today-item"><span class="today-num">${week.sessions}</span><span class="today-unit">かい</span><span class="today-label">れんしゅう</span></div>
        <div class="today-item"><span class="today-num">${week.items}</span><span class="today-unit">こ</span><span class="today-label">打った お題</span></div>
        <div class="today-item"><span class="today-num">${week.minutes}</span><span class="today-unit">ふん</span><span class="today-label">うちこんだ 時間</span></div>
      </div>
      ${week.rate === null ? '' : `
        <p class="muted mt">ひとりで さいごまで 打てた お題は
          <b>${Math.round(week.rate)}%</b>（${week.firstTryCorrect} / ${week.attempted} こ）。
          1文字でも まちがえた お題は 入れて いないので、画面の「正かくさ」より 低く 出ます。</p>`}
      ${units.length ? `
        <p class="muted mt">もう1かい やると のびる ところ</p>
        <ul class="weak-list">
          ${units.map(u => `<li>${esc(u.title)}<span class="weak-count">${Math.round(u.rate)}%</span></li>`).join('')}
        </ul>` : ''}`);
}
const RECORD_TABS = [
{ id: 'today', label: 'きょう', icon: 'clock' },
{ id: 'weak', label: 'にがて', icon: 'target' },
{ id: 'collect', label: 'たからもの', icon: 'box' },
{ id: 'history', label: 'あゆみ', icon: 'map' }
];
function renderRecords() {
const lv = T.Awards.levelOf(T.Store.getAwards().xp);
const st = T.Store.streak();
const today = T.Store.todaySummary();
view.innerHTML = `
      ${pageTitle('きろく', 'これまでの あゆみ')}
      ${levelHero(lv, st, today)}
      ${subtabs(RECORD_TABS, recordTab, 'record-tab', 'きろくの ひきだし')}
      <div class="section-body" id="rec-section">${recordSection()}</div>`;
bindSubtabs('record-tab', id => {
recordTab = id;
swapSection($('rec-section'), recordSection(), bindRecordSection);
});
bindRecordSection($('rec-section'));
}
function recordSection() {
if (recordTab === 'weak') return weakSection();
if (recordTab === 'collect') return collectSection();
if (recordTab === 'history') return historySection();
return todaySection();
}
function bindRecordSection(box) {
if (!box) return;
bindGoButtons(box);
const heat = $('heat-kb');
if (heat) {
T.Keyboard.render(heat, { layoutId: T.Store.getSettings().layout, fingerGuide: false, onTap: null });
if (heatMode === 'mastery') T.Keyboard.mastery(T.Store.keySummary().byKey);
else T.Keyboard.heat(T.Store.missSummary().byKey);
}
box.querySelectorAll('[data-heat-mode]').forEach(el => {
el.addEventListener('click', () => {
if (heatMode === el.dataset.heatMode) return;
heatMode = el.dataset.heatMode;
swapSection(box, recordSection(), bindRecordSection);
});
});
}
function todaySection() {
const today = T.Store.todaySummary();
const st = T.Store.streak();
const lv = T.Awards.levelOf(T.Store.getAwards().xp);
const progress = T.Store.getProgress();
const clearedStages = T.Lessons.COURSES
.reduce((sum, c) => sum + c.stages.filter(s => (progress[s.id] || {}).clears > 0).length, 0);
const start = today.count === 0
? empty('smile', 'きょうは これからです',
st.days > 0 ? `きのうまで ${st.days}日 つづいて います。きょうも 1回 やると のびます。`
: '1もんだけでも きろくに のこります。',
`<button class="btn btn-primary" data-tab-go="play">${icon('play')} いま うつ</button>`)
: '';
return `
      ${start}
      ${today.count === 0 ? '' : card(`
        <p class="lead">${icon('clock')} きょうの ようす</p>
        <div class="today">
          <div class="today-item"><span class="today-num" data-count="${today.count}">0</span><span class="today-unit">かい</span><span class="today-label">れんしゅう</span></div>
          <div class="today-item"><span class="today-num" data-count="${today.keys}">0</span><span class="today-unit">だ</span><span class="today-label">打った数</span></div>
          <div class="today-item"><span class="today-num" data-count="${today.minutes}">0</span><span class="today-unit">ふん</span><span class="today-label">じかん</span></div>
        </div>`, 'card-today')}

      ${card(`
        <p class="lead">${icon('fire')} れんしゅうした 日</p>
        ${streakLine(st)}
        ${calendar()}`)}

      ${studyCard()}

      ${card(`
        <p class="lead">${icon('sparkle')} つみあげ</p>
        <p class="muted">ためた けいけんち <b>${lv.total}</b>。
        ステージは <b>${clearedStages} / ${T.Lessons.totalStages()}</b> クリア。</p>
        <span class="row-bar"><span data-grow="${Math.round(clearedStages / Math.max(1, T.Lessons.totalStages()) * 100)}"></span></span>`)}`;
}
function weakSection() {
const miss = T.Store.missSummary();
const keyStats = T.Store.keySummary();
const weakRules = T.Store.weakRules();
const hasAny = miss.keys.length || keyStats.slow.length || miss.fingers.length || weakRules.length;
if (!hasAny) {
return empty('target', 'にがては まだ 見つかって いません',
'すこし れんしゅうすると、まちがえやすい キーや 手が とまる キーが ここに 出ます。',
`<button class="btn btn-primary" data-tab-go="play">${icon('play')} れんしゅうする</button>`);
}
return `
      ${(miss.keys.length || keyStats.slow.length) ? card(`
        <p class="lead">${icon('target')} キーボードで 見る</p>
        <div class="seg" role="radiogroup" aria-label="キーボードの 見かた">
          <button class="seg-btn${heatMode === 'miss' ? ' on' : ''}" role="radio"
            aria-checked="${heatMode === 'miss'}" data-heat-mode="miss">まちがえた かず</button>
          <button class="seg-btn${heatMode === 'mastery' ? ' on' : ''}" role="radio"
            aria-checked="${heatMode === 'mastery'}" data-heat-mode="mastery">おぼえぐあい</button>
        </div>
        <p class="muted mt">${heatMode === 'miss'
? '色が こい キーほど まちがえて います。手もとの キーボードと 見くらべてみよう。'
: '色が こい キーほど、まだ 手が おぼえて いません。まちがえなくても、さがして いれば こく なります。'}</p>
        <div class="kb-guide"><div id="heat-kb"></div></div>
        <!-- 色の 見本と ボタンは 1行に ならべます。図の 下に 2段 つむと、
             その ぶんだけ キーボードが 画面の 外へ 出て いきます -->
        <div class="heat-foot">
        ${heatMode === 'miss'
? `<p class="heat-legend"><span class="heat-sample lv1"></span>すこし
             <span class="heat-sample lv2"></span>ふつう
             <span class="heat-sample lv3"></span>おおい</p>`
: `<p class="heat-legend"><span class="mastery-sample m-good"></span>だいじょうぶ
             <span class="mastery-sample m-soso"></span>もうすこし
             <span class="mastery-sample m-weak"></span>まだまだ
             <span class="mastery-sample m-unknown"></span>まだ わからない</p>`}
        <button class="btn btn-primary" data-go-weak>${icon('finger')} にがて とっくんを する</button>
        </div>`,
'card-wide') : ''}

      <!-- こまかい 中身は たたんで おきます。ひらいて さいしょに 見せたいのは
           「キーボードの どこが にがてか」の 1つだけ です -->
      ${slowKeyCard(keyStats)}
      ${ruleCard(weakRules)}

      ${miss.fingers.length ? card(`
        <p class="lead">${icon('finger')} にがてな 指</p>
        <ul class="weak-list">
          ${miss.fingers.slice(0, 3).map(id => {
const f = T.Layout.FINGERS[id];
if (!f) return '';
return `<li><span class="finger-dot" style="--finger:${f.color}"></span>
              ${esc(f.label)}<span class="weak-count">${Math.round(miss.byFinger[id])} かい</span></li>`;
}).join('')}
        </ul>`) : ''}`;
}
function collectSection() {
const badges = T.Awards.badgeList();
const got = badges.filter(b => b.got);
const progress = T.Store.getProgress();
const starSum = T.Lessons.COURSES.reduce((n, c) =>
n + c.stages.reduce((m, s) => m + ((progress[s.id] || {}).stars || 0), 0), 0);
const starMax = T.Lessons.totalStages() * 3;
return `
      ${card(`
        <p class="lead">${icon('medal')} バッジ</p>
        <span class="collect-bar"><span data-grow="${Math.round(got.length / Math.max(1, badges.length) * 100)}"></span></span>
        <p class="muted"><b data-count="${got.length}">0</b> / ${badges.length} こ あつめました。</p>
        ${got.length ? `<div class="badge-grid">
          ${got.slice(-6).reverse().map(b => badgeTile(b, true)).join('')}
        </div>` : '<p class="muted">さいしょの バッジは、1回 れんしゅうすると もらえます。</p>'}
        <button class="btn btn-outline mt" data-go-screen="badges">ぜんぶ 見る</button>`)}

      ${card(`
        <p class="lead">${icon('star')} ステージの ★</p>
        <span class="collect-bar"><span data-grow="${Math.round(starSum / Math.max(1, starMax) * 100)}"></span></span>
        <p class="muted"><b data-count="${starSum}">0</b> / ${starMax} こ。コースを えらぶと 中が 見られます。</p>
        <!-- コースごとの ★は「たたんだ 見出し」が 5つ ならぶだけ なので、
             ひろい 画面では 2れつに して たての ながさを はんぶんに します -->
        <div class="fold-cols">
        ${T.Lessons.COURSES.map(c => {
const sum = c.stages.reduce((m, s) => m + ((progress[s.id] || {}).stars || 0), 0);
const max = c.stages.length * 3;
return fold(c.short, `★ ${sum} / ${max}`, `
            ${c.stages.map(s => `<div class="star-line">
              <span>${esc(s.title)}</span>${stars((progress[s.id] || {}).stars || 0)}
            </div>`).join('')}
            <button class="btn btn-outline btn-small mt" data-go-course="${esc(c.id)}">この コースへ ${icon('next')}</button>`);
}).join('')}
        </div>`)}`;
}
function historySection() {
const history = T.Store.getHistory().slice().reverse();
const best = T.Store.bestOverall();
if (history.length === 0) {
return empty('map', 'あゆみは これから',
'れんしゅうすると、はやさの グラフと さいこう記録が ここに たまって いきます。',
`<button class="btn btn-primary" data-tab-go="play">${icon('play')} はじめる</button>`);
}
const line = history.filter(h => T.Store.countsAsTyping(h) &&
(h.totalKeys || 0) >= T.Store.MIN_RECORD_KEYS).slice(0, 20).reverse();
return `
      ${best && best.kps > 0 ? card(`
        <p class="lead">${icon('trophy')} さいこう記録</p>
        <div class="best-row">
          <div><b data-count="${best.kps.toFixed(1)}" data-dec="1">0.0</b><span>打/びょう</span></div>
          <div><b data-count="${Math.round(best.accuracy)}">0</b><span>% 正かくさ</span></div>
          <div><b data-count="${best.count}">0</b><span>かい</span></div>
        </div>`) : card(`<p class="muted">${'さいこう記録は、すこし まとまって 打った 回から つきます。もう ちょっと つづけて みよう。'}</p>`)}

      ${card(`
        <p class="lead">${icon('chart')} はやさの うつりかわり</p>
        ${sparkline(line)}`)}

      ${challengeCard()}

      ${card(`
        <p class="lead">${icon('clock')} さいきんの れんしゅう</p>
        <ul class="hist-list">
          ${history.slice(0, 6).map(historyRow).join('')}
        </ul>
        ${history.length > 6
? fold('もっと まえの れんしゅう', `${Math.min(history.length, 40) - 6} かい`,
`<ul class="hist-list">${history.slice(6, 40).map(historyRow).join('')}</ul>`)
: ''}`)}`;
}
function historyRow(h) {
return `
      <li>
        <span class="hist-date">${esc(formatDate(h.at))}</span>
        <span class="hist-title">${esc(h.title)}</span>
        <span class="hist-num">${h.mode === 'shortcut'
? `できた ${Math.round(h.accuracy)}%`
: `${(h.kps || 0).toFixed(1)} 打/びょう ・ ${Math.round(h.accuracy)}%`}</span>
      </li>`;
}
function slowKeyCard(keyStats) {
const list = keyStats.slow.slice(0, 5);
if (list.length === 0) return '';
return card(`
      <p class="lead">${icon('clock')} まだ 手が とまる キー</p>
      <p class="muted">まちがえては いないけれど、すこし さがして いる キーです。
      ここが はやく なると、ぐんと らくに なります。</p>
      <ul class="weak-list">
        ${list.map(ch => {
const s = keyStats.byKey[ch];
const found = T.Layout.findKey(T.Store.getSettings().layout, ch === 'space' ? ' ' : ch);
const finger = found ? T.Layout.fingerOf(found.key.code) : null;
return `<li>
            ${finger ? `<span class="finger-dot" style="--finger:${finger.color}"></span>` : ''}
            <b class="weak-key">${esc(ch === 'space' ? 'スペース' : ch.toUpperCase())}</b>
            ${finger ? `<span class="weak-finger">${esc(finger.label)}</span>` : ''}
            <span class="weak-count">${(s.medianMs / 1000).toFixed(1)} びょう</span>
          </li>`;
}).join('')}
      </ul>
      <button class="btn btn-outline" data-go-weak>${icon('finger')} にがて とっくんを する</button>`);
}
function ruleCard(rules) {
const list = (rules || []).slice(0, 3);
if (list.length === 0) return '';
return card(`
      <p class="lead">${icon('letter')} ローマ字で つまずく ところ</p>
      <ul class="weak-list">
        ${list.map(r => {
const stage = stageForRule(r.rule);
const per = Math.max(1, Math.round(r.errRate * 10));
return `<li class="rule-row">
            <span class="rule-name">${esc(r.label)}</span>
            <span class="weak-count">10かいに ${per}かい</span>
            ${stage ? `<button class="btn btn-outline btn-small"
              data-go-stage="${esc(stage.course.id)}:${esc(stage.stage.id)}">ここだけ れんしゅう</button>` : ''}
          </li>`;
}).join('')}
      </ul>`);
}
function stageForRule(rule) {
const skill = T.Mastery.RULE_TO_SKILL[rule];
if (!skill) return null;
for (const course of T.Lessons.COURSES) {
for (const stage of course.stages) {
if (stage.skill === skill) return { course, stage };
}
}
return null;
}
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
function challengeLabel(id) {
const m = /^ch-(.+)-(\d+)$/.exec(id);
if (!m) return id;
const pool = T.Lessons.CHALLENGE_POOLS.filter(p => p.id === m[1])[0];
return `${m[2]}びょう ／ ${pool ? pool.title : m[1]}`;
}
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
const yet = badges.filter(b => !b.got);
view.innerHTML = `
      ${pageTitle('バッジ', `${got.length} / ${badges.length} こ あつめました`)}

      ${card(`
        <p class="lead">${icon('medal')} あつめぐあい</p>
        <span class="collect-bar"><span data-grow="${Math.round(got.length / Math.max(1, badges.length) * 100)}"></span></span>
        <p class="muted"><b data-count="${got.length}">0</b> / ${badges.length} こ。
        いちど もらった バッジは なくなりません。</p>`)}

      ${got.length ? card(`
        <p class="lead">${icon('trophy')} もって いる バッジ</p>
        <div class="badge-grid">
          ${got.slice().reverse().map(b => badgeTile(b, true)).join('')}
        </div>`) : empty('medal', 'バッジは これから',
'さいしょの バッジは、1回 れんしゅうすると もらえます。',
`<button class="btn btn-primary" data-tab-go="play">${icon('play')} れんしゅうする</button>`)}

      ${yet.length ? card(`
        ${fold('これから もらえる バッジ', `${yet.length} こ`, `
          <div class="badge-grid badge-grid-all">
            ${yet.map(b => badgeTile(b, false)).join('')}
          </div>`)}`) : ''}`;
bindGoButtons();
}
function formatDate(iso) {
const d = new Date(iso);
if (isNaN(d.getTime())) return '';
return `${d.getMonth() + 1}/${d.getDate()}`;
}
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
const SETTINGS_TABS = [
{ id: 'hint', label: 'ヒント', icon: 'hand' },
{ id: 'look', label: 'みため', icon: 'palette' },
{ id: 'kb', label: 'キーボード', icon: 'keyboard' },
{ id: 'data', label: 'データ', icon: 'save' }
];
function renderSettings() {
view.innerHTML = `
      ${pageTitle('せってい', 'じぶんに あわせて かえられます')}
      ${subtabs(SETTINGS_TABS, settingsTab, 'settings-tab', 'せっていの ひきだし')}
      <div class="section-body" id="set-section">${settingsSection()}</div>`;
bindSubtabs('settings-tab', id => {
settingsTab = id;
swapSection($('set-section'), settingsSection(), bindSettingsSection);
});
bindSettingsSection($('set-section'));
}
function settingsSection() {
if (settingsTab === 'look') return lookSettings();
if (settingsTab === 'kb') return keyboardSettings();
if (settingsTab === 'data') return dataSettings();
return hintSettings();
}
function bindSettingsSection(box) {
if (!box) return;
const guide = $('guide-kb');
if (guide) T.Keyboard.render(guide, { layoutId: T.Store.getSettings().layout, fingerGuide: true, onTap: null });
bindSettings(box);
bindGoButtons(box);
}
function hintSettings() {
const s = T.Store.getSettings();
const job = T.Buddy.normalizeJob(s.buddyJob);
const jobUnit = (T.Buddy.jobs().filter(j => j.id === job)[0] || {}).unit || 'できた もの';
return `
      ${card(`
        <p class="lead">${icon('hand')} ヒントの つよさ</p>
        <p class="muted">なれてきたら すこしずつ へらすと、手もとを 見ないで
        打てるように なります。どの つよさでも「つぎは D を みぎの ひとさしゆびで」の
        ことばは 消えません。</p>
        <div class="seg" role="radiogroup" aria-label="ヒントの つよさ">
          ${T.Store.ASSIST_LABELS.map((label, i) => `
            <button class="seg-btn${s.assist === i ? ' on' : ''}" role="radio"
              aria-checked="${s.assist === i}" data-assist="${i}">${esc(label)}</button>`).join('')}
          <button class="seg-btn${s.assist === 'auto' ? ' on' : ''}" role="radio"
            aria-checked="${s.assist === 'auto'}" data-assist="auto">じどう</button>
        </div>
        <p class="muted mt">${s.assist === 'auto'
? 'おぼえぐあいに あわせて、れんしゅうを はじめる ときに 決めます。1回の とちゅうでは かわりません。'
: (s.assist === 'custom'
? 'いまは じぶんで えらんだ 見え方に なって います（下の スイッチ）。'
: '')}</p>
        <details class="more">
          <summary>こまかく きめる</summary>
          ${toggle('keyboard', '画面に キーボードを 出す', s.keyboard)}
          ${toggle('keyLabels', 'キーに 文字を 書く', s.keyLabels)}
          ${toggle('fingerGuide', '指を 色で 分ける', s.fingerGuide)}
          ${toggle('romajiHint', 'ローマ字の ヒントを 出す', s.romajiHint)}
        </details>`)}

      ${card(`
        <p class="lead">${icon('hand')} 手の イラストと キャラクター</p>
        <p class="muted">手の 絵は「どの 指を のばすか」を つたえます。
        キャラクターは 打つと うごきます。気が 散る ときは 消せます
        （ヒントを「ばしょだけ」まで 下げると 手の 絵も 消えます）。</p>
        ${toggle('hands', '手の イラストを 出す', s.hands)}
        ${toggle('buddy', 'キャラクターを 出す', s.buddy)}
        <p class="muted mt">だれと いっしょに はたらく？</p>
        <div class="seg" role="radiogroup" aria-label="キャラクター">
          <button class="seg-btn${job === T.Buddy.RANDOM ? ' on' : ''}" role="radio"
            aria-checked="${job === T.Buddy.RANDOM}" data-set="buddyJob" data-value="${esc(T.Buddy.RANDOM)}"
            ${s.buddy === false ? 'disabled' : ''}>おまかせ</button>
          ${T.Buddy.jobs().map(j => `
            <button class="seg-btn${job === j.id ? ' on' : ''}" role="radio"
              aria-checked="${job === j.id}" data-set="buddyJob" data-value="${esc(j.id)}"
              ${s.buddy === false ? 'disabled' : ''}>${esc(j.label)}</button>`).join('')}
        </div>
        <p class="muted">${job === T.Buddy.RANDOM
? `「おまかせ」は くじ引きです（${esc(T.Buddy.jobs().map(j => j.label).join('・'))}）。`
: 'いつも 同じ キャラクターに なります。'}
        お題を 1つ 打ちきる ごとに ${esc(jobUnit)}が 1つ ふえ、ひとまわり できると
        ぜんぶ おさめて${job === T.Buddy.RANDOM ? '、つぎは だれが 来るか もう一度 くじを 引きます' : '、また 空から はじまります'}。</p>`)}`;
}
function lookSettings() {
const s = T.Store.getSettings();
return `
      ${card(`
        <p class="lead">${icon('palette')} 画面の 色</p>
        <div class="seg" role="radiogroup" aria-label="画面の 色">
          ${[['auto', 'じどう'], ['light', 'あかるい'], ['dark', 'くらい']].map(([v, label]) => `
            <button class="seg-btn${s.theme === v ? ' on' : ''}" role="radio"
              aria-checked="${s.theme === v}" data-set="theme" data-value="${v}">${label}</button>`).join('')}
        </div>
        <p class="muted">「じどう」は Chromebook の せっていに あわせます。</p>`)}

      ${card(`
        <p class="lead">${icon('gear')} 文字と おと</p>
        ${toggle('bigText', '文字を 大きくする', s.bigText)}
        ${toggle('sound', '打ったときの おと', s.sound)}
        ${toggle('retry', 'まちがえた お題を ひとまわりの さいごに もう1かい', s.retry)}`)}`;
}
function keyboardSettings() {
const s = T.Store.getSettings();
return `
      ${card(`
        <p class="lead">${icon('keyboard')} キーボードの ならび</p>
        <div class="seg" role="radiogroup" aria-label="キーボードの ならび">
          ${Object.keys(T.Layout.LAYOUTS).map(id => `
            <button class="seg-btn${s.layout === id ? ' on' : ''}" role="radio"
              aria-checked="${s.layout === id}" data-set="layout" data-value="${id}">
              ${esc(T.Layout.LAYOUTS[id].label)}</button>`).join('')}
        </div>
        <p class="muted">キーボードの 右上に「¥」や「かな」が あれば 日本語配列（JIS）です。
        「1」の 左に <b>かな英数キー</b>が あり、「1」は Q の ななめ 左上に なります。</p>
        <p class="muted">${icon('keyboard')} どの 画面でも <b>スペースキー</b>を おすと、
        すぐ 打つ 画面に もどれます。</p>`)}

      ${card(`
        <p class="lead">${icon('grid')} ローマ字ひょう</p>
        <p class="muted">「し」は si でも shi でも 正かいです。ならった うちかたを たしかめられます。</p>
        <button class="btn btn-outline" data-go-screen="romaji-table">ローマ字ひょうを 見る</button>`)}

      <!-- キーボードの 図は よこに ひろい ので、いちばん 下に おきます。
           ひろい 画面では 上の 2まいが よこに ならび、この 図が その 下に
           はば いっぱいで 出ます（style.css の .card-wide）-->
      ${card(`
        <p class="lead">${icon('hand')} ゆびの ばしょ</p>
        <p class="muted">ホームポジションは、左手を <b>F</b>、右手を <b>J</b> に おく ばしょです。
        この 2つの キーには でっぱりが あるので、見なくても さわると わかります。</p>
        <!-- キーボードを 描く ところは 中の 入れものに します。
             keyboard.js は わたされた 要素の class を 入れかえるので、
             外がわに 1つ わくを のこして おくと、せまい 画面でも
             **その わくの 中だけ**で よこに うごかせます -->
        <div class="kb-guide"><div id="guide-kb"></div></div>
        <ul class="finger-legend">
          ${Object.keys(T.Layout.FINGERS).map(id => {
const f = T.Layout.FINGERS[id];
return `<li><span class="finger-dot" style="--finger:${f.color}"></span>${esc(f.label)}</li>`;
}).join('')}
        </ul>`, 'card-wide')}`;
}
function dataSettings() {
return `
      ${card(`
        <p class="lead">${icon('send')} きろくを もちだす</p>
        <p class="muted">きろくを ファイルに して、べつの 端末に うつせます。
        学年が かわって Chromebook が 入れかわる ときに つかいます。</p>
        <button class="btn btn-outline" data-go-screen="backup">書き出し・読みこみ</button>`)}

      ${card(`
        <p class="lead">${icon('info')} アプリとして つかう</p>
        <p class="muted">ホーム画面に 入れると、ブラウザの バーが 消えて 画面が 広くなります。
        インターネットに つながって いなくても れんしゅうできます。</p>
        <button class="btn btn-outline" id="install-btn" hidden>ホーム画面に 入れる</button>
        ${fold('入れかたを 見る', '', `
          <ul class="howto">
            <li><b>Chrome</b>: アドレスバーの 右の インストール、または メニュー →「アプリをインストール」</li>
            <li><b>Safari（iPad・iPhone）</b>: 共有ボタン →「ホーム画面に追加」</li>
          </ul>`)}
        <p class="version">Typa ${esc(APP_VERSION)}</p>`)}

      ${card(`
        <p class="lead">${icon('lock')} きろくと プライバシー</p>
        <p class="muted">Typa は 名前も 出席番号も もちません。インターネットにも つながず、
        れんしゅうの きろくは <b>この 端末の 中だけ</b>に たまります。
        ほかの 人や ほかの サイトに おくられる ことは ありません。</p>
        <p class="muted">ブラウザの データを けすと、きろくも いっしょに 消えます。
        べつの 端末に うつす ときは、下の「きろくを もちだす」を つかいます。</p>
        <button class="btn btn-outline btn-danger" id="reset-btn">${icon('trash')} きろくを ぜんぶ けす</button>
        <p class="muted" id="reset-note" hidden>ほんとうに けしますか？ もとには もどせません。</p>
        <div class="reset-confirm" id="reset-confirm" hidden>
          <button class="btn btn-danger-solid" id="reset-yes">けす</button>
          <button class="btn btn-ghost" id="reset-no">やめる</button>
        </div>`)}`;
}
function renderBackup() {
view.innerHTML = `
      ${pageTitle('きろくを もちだす', 'ファイルに して、べつの 端末へ')}

      <p class="hint-box">${icon('lock')} できる ファイルは <b>この 端末の 中</b>に できます。
      インターネットには 出ません。名前や 出席番号は 入って いません。</p>

      ${card(`
        <p class="lead">${icon('send')} 書き出す</p>
        <p class="muted">いまの きろくを 1つの ファイルに します。
        できた ファイルは「ダウンロード」に 入ります。</p>
        <button class="btn btn-primary" id="bk-save">${icon('send')} ファイルに 書き出す</button>
        <button class="btn btn-ghost" id="bk-show">がめんに 出す</button>
        <div id="bk-text-wrap" hidden>
          <p class="muted">ぜんぶ えらんで コピーし、べつの 端末で はりつけます。</p>
          <textarea id="bk-text" class="bk-text" readonly rows="6"></textarea>
          <button class="btn btn-outline" id="bk-copy">${icon('check')} コピーする</button>
        </div>`)}

      ${card(`
        <p class="lead">${icon('back')} 読みこむ</p>
        <p class="muted"><b>いまの きろくは 消えて</b>、ファイルの きろくに なります。
        もとには もどせません。読みこむ 前に、いまの きろくを 書き出して おくと あんしんです。</p>
        <label class="btn btn-outline" for="bk-file">${icon('grid')} ファイルを えらぶ</label>
        <input type="file" id="bk-file" accept="application/json,.json" hidden>
        <p class="bk-error" id="bk-error" hidden></p>
        <div id="bk-preview" hidden>
          <ul class="bk-summary" id="bk-summary"></ul>
          <p class="muted">この きろくに 入れかえますか？</p>
          <div class="reset-confirm">
            <button class="btn btn-danger-solid" id="bk-yes">入れかえる</button>
            <button class="btn btn-ghost" id="bk-no">やめる</button>
          </div>
        </div>`)}

      ${card(`
        <p class="lead">${icon('info')} せんせいへ</p>
        <p class="muted">この ファイルには 児童を 特定する 情報は 入って いません
        （名前・出席番号・端末の ID などは もともと アプリが もって いません）。
        中身は れんしゅうの 記録・★・けいけんち・せっていだけです。
        書き出しも 読みこみも 端末の 中だけで 完結し、外部に 送信されません。</p>`)}
    `;
bindBackup();
}
function bindBackup() {
let pending = null;
const save = $('bk-save');
if (save) save.addEventListener('click', () => {
const text = T.Backup.toText(T.Backup.buildExport(APP_VERSION));
if (T.Backup.download(text, T.Backup.fileName())) {
toast('きろくを 書き出しました。「ダウンロード」を 見てね。');
} else {
showText(text);
toast('ファイルに できませんでした。がめんに 出したので コピーしてね。');
}
});
const show = $('bk-show');
if (show) show.addEventListener('click', () => {
showText(T.Backup.toText(T.Backup.buildExport(APP_VERSION)));
});
function showText(text) {
$('bk-text').value = text;
$('bk-text-wrap').hidden = false;
}
const copy = $('bk-copy');
if (copy) copy.addEventListener('click', () => {
Promise.resolve(T.Backup.copyText($('bk-text').value)).then(ok => {
toast(ok ? 'コピーしました。' : 'コピーできませんでした。手で えらんで コピーしてね。');
});
});
const file = $('bk-file');
if (file) file.addEventListener('change', () => {
const f = file.files && file.files[0];
if (!f) return;
const reader = new FileReader();
reader.onload = () => {
const res = T.Backup.parseImport(String(reader.result || ''));
if (!res.ok) { fail(res.message); return; }
pending = res.clean;
$('bk-error').hidden = true;
$('bk-summary').innerHTML = summaryHtml(res.summary);
$('bk-preview').hidden = false;
};
reader.onerror = () => fail('ファイルを 読めませんでした。');
reader.readAsText(f);
file.value = '';
});
function fail(message) {
pending = null;
$('bk-preview').hidden = true;
const box = $('bk-error');
box.textContent = message;
box.hidden = false;
}
function summaryHtml(s) {
const rows = [
['れんしゅうした 回数', `${s.sessions} かい`],
['★の 数', `${s.stars} こ`],
['けいけんち', `${s.xp}`]
];
if (s.lastAt) rows.push(['さいごの れんしゅう', formatDate(s.lastAt)]);
if (s.exportedAt) rows.push(['書き出した 日', formatDate(s.exportedAt)]);
return rows.map(([k, v]) => `<li><span>${esc(k)}</span><b>${esc(v)}</b></li>`).join('');
}
const no = $('bk-no');
if (no) no.addEventListener('click', () => {
pending = null;
$('bk-preview').hidden = true;
});
const yes = $('bk-yes');
if (yes) yes.addEventListener('click', () => {
if (!pending) return;
const ok = T.Backup.applyImport(pending);
pending = null;
applySettings();
if (ok) {
toast('きろくを 読みこみました。');
T.Nav.selectTab(T.Nav.ROOT_TAB);
} else {
toast('ぜんぶは 読みこめませんでした。もう一度 ためしてね。');
T.Nav.render();
}
});
}
function toggle(name, label, on) {
return `<label class="switch">
      <input type="checkbox" data-toggle="${name}"${on ? ' checked' : ''}>
      <span class="switch-box">${icon('check')}</span>
      <span class="switch-label">${esc(label)}</span>
    </label>`;
}
function bindSettings(scope) {
const box = scope || view;
box.querySelectorAll('[data-toggle]').forEach(el => {
el.addEventListener('change', () => {
T.Store.setSetting(el.dataset.toggle, el.checked);
applySettings();
});
});
box.querySelectorAll('[data-set]').forEach(el => {
el.addEventListener('click', () => {
T.Store.setSetting(el.dataset.set, el.dataset.value);
applySettings();
T.Nav.render();
});
});
box.querySelectorAll('[data-assist]').forEach(el => {
el.addEventListener('click', () => {
const v = el.dataset.assist;
T.Store.setAssist(v === 'auto' ? 'auto' : Number(v));
T.Nav.render();
});
});
const install = $('install-btn');
if (install) {
install.hidden = !installPrompt;
install.addEventListener('click', async () => {
if (!installPrompt) return;
install.hidden = true;
installPrompt.prompt();
await installPrompt.userChoice;
installPrompt = null;
});
}
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
function applySettings() {
const s = T.Store.getSettings();
document.documentElement.dataset.theme = s.theme;
document.documentElement.classList.toggle('big-text', !!s.bigText);
}
function bindGoButtons(scope) {
const box = scope || view;
const onGo = (sel, run) => {
box.querySelectorAll(sel).forEach(el => {
el.addEventListener('click', () => {
if (T.FX && T.FX.tapThen) T.FX.tapThen(el, () => run(el));
else run(el);
});
});
};
onGo('[data-go-course]', el => T.Nav.go('course', { courseId: el.dataset.goCourse }));
onGo('[data-go-stage]', el => {
const [courseId, stageId] = el.dataset.goStage.split(':');
T.Nav.go('play', { courseId, stageId, source: 'course' });
});
onGo('[data-go-screen]', el => T.Nav.go(el.dataset.goScreen, {}));
onGo('[data-go-challenge]', () => T.Nav.go('play', {
special: 'challenge', pool: challengePick.pool, seconds: challengePick.seconds
}));
onGo('[data-go-weak]', () => T.Nav.go('play', { special: 'weak' }));
onGo('[data-tab-go]', el => T.Nav.selectTab(el.dataset.tabGo));
}
const NO_SPACE_KEY = 'input, textarea, select, summary, [contenteditable=""], [contenteditable="true"]';
function bindPlayShortcut() {
document.addEventListener('keydown', e => {
if (e.key !== ' ' && e.code !== 'Space') return;
if (e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
if (e.defaultPrevented) return;
const cur = T.Nav.current();
if (cur && cur.screen === 'play') return;
const el = e.target;
if (el && el.closest && el.closest(NO_SPACE_KEY)) return;
e.preventDefault();
T.Nav.selectTab('play');
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
if (T.FX) {
T.FX.clearLayer();
if (cur && cur.screen !== 'play') T.FX.enter(view, { dir: info.dir });
}
}
function beforeRender(dir, next) {
if (!T.FX || !view) return;
if (!dir || !next || next.screen === 'play') return;
if (document.body.dataset.screen === 'play') return;
T.FX.ghost(view, dir === 'back' || dir === 'left' ? 'back' : 'fwd');
}
function boot() {
view = $('view');
applySettings();
$('nav-back').addEventListener('click', () => T.Nav.back('bar'));
bindPlayShortcut();
T.Nav.TABS.forEach(tab => {
const el = document.querySelector(`[data-tab="${tab.id}"]`);
if (el) el.addEventListener('click', () => T.Nav.selectTab(tab.id));
});
T.Nav.register('menu', { render: renderMenu });
T.Nav.register('courses', { render: renderCourses });
T.Nav.register('course', { render: renderCourse });
T.Nav.register('challenge', { render: renderChallenge });
T.Nav.register('play', { render: renderPlay, leave: leavePlay });
T.Nav.register('result', { render: renderResult });
T.Nav.register('records', { render: renderRecords });
T.Nav.register('badges', { render: renderBadges });
T.Nav.register('settings', { render: renderSettings });
T.Nav.register('romaji-table', { render: renderRomajiTable });
T.Nav.register('backup', { render: renderBackup });
let start = T.Nav.ROOT_TAB;
let deep = null;
try {
const params = new URLSearchParams(location.search);
let tab = params.get('tab');
if (tab === 'home') tab = T.Nav.ROOT_TAB;
if (tab === 'courses') { tab = 'menu'; deep = 'courses'; }
if (T.Nav.TABS.some(t => t.id === tab)) start = tab;
if (params.get('screen') === 'challenge') { start = 'menu'; deep = 'challenge'; }
if (location.search) history.replaceState(null, '', location.pathname);
} catch (e) { }
T.Nav.init({
root: document.body,
indicator: $('edge-hint'),
start,
onChange: updateChrome,
onBeforeRender: beforeRender,
onRootBack: () => {
document.body.classList.add('root-bump');
setTimeout(() => document.body.classList.remove('root-bump'), 300);
}
});
if (deep) T.Nav.go(deep, {});
installPrompt = global.__pwaInstallPrompt || null;
if (installPrompt) showInstallButton();
global.addEventListener('pwa-install-available', () => {
installPrompt = global.__pwaInstallPrompt;
showInstallButton();
});
global.addEventListener('pwa-installed', () => {
installPrompt = null;
const btn = $('install-btn');
if (btn) btn.hidden = true;
});
startServiceWorker();
}
function showInstallButton() {
const btn = $('install-btn');
if (btn) btn.hidden = false;
}
function startServiceWorker() {
if (!('serviceWorker' in navigator)) return;
const start = () => {
navigator.serviceWorker.register('./sw.js')
.then(watchForUpdate)
.catch(() => { });
};
if (document.readyState === 'complete') start();
else global.addEventListener('load', start, { once: true });
}
function watchForUpdate(reg) {
if (!reg) return;
navigator.serviceWorker.addEventListener('controllerchange', () => {
if (!userAskedUpdate || reloading) return;
reloading = true;
location.reload();
});
const notify = (worker) => {
if (!worker || updateShown) return;
updateShown = true;
showUpdateBar(() => {
userAskedUpdate = true;
worker.postMessage({ type: 'SKIP_WAITING' });
});
};
reg.addEventListener('updatefound', () => {
const sw = reg.installing;
if (!sw) return;
sw.addEventListener('statechange', () => {
if (sw.state === 'installed' && navigator.serviceWorker.controller) notify(sw);
});
});
if (reg.waiting && navigator.serviceWorker.controller) notify(reg.waiting);
}
function showUpdateBar(onAccept) {
if ($('update-bar')) return;
const bar = document.createElement('div');
bar.id = 'update-bar';
bar.className = 'update-bar no-print';
bar.setAttribute('role', 'status');
const text = document.createElement('span');
text.className = 'update-text';
text.textContent = 'あたらしい ばんが あります';
const yes = document.createElement('button');
yes.type = 'button';
yes.className = 'btn btn-primary update-yes';
yes.textContent = 'さいしんに する';
const later = document.createElement('button');
later.type = 'button';
later.className = 'btn btn-ghost update-later';
later.textContent = 'あとで';
yes.addEventListener('click', () => {
yes.disabled = true;
yes.textContent = 'かえて います…';
onAccept();
});
later.addEventListener('click', () => bar.remove());
bar.append(text, yes, later);
document.body.appendChild(bar);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})(window);
