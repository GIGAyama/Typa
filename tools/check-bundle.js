/**
 * =====================================================================
 * check-bundle.js — 配信用（js/）が ソース（src/）と 同じかを たしかめる
 * =====================================================================
 * つかいかた:
 *
 *   node tools/check-bundle.js
 *
 * ■ なぜ ひつようか
 * `src/` の コメントを 外した ものを `js/` に 置いて 配って います
 * （`scripts/build.mjs`。479KB → 262KB）。ここには **2つの こわい 失敗**が
 * あります。
 *
 *   1. **src/ を 直したのに build を わすれる。**
 *      GitHub Pages が 配るのは `js/` なので、直した はずの ところが
 *      いつまでも 直りません。しかも 手もとの 検査は src/ を 見るので
 *      **ぜんぶ 通ります**。だれも 気づけません。
 *   2. **コメントを 外す ときに 中身まで こわす。**
 *      お題の HTML は テンプレートの 中に 字下げ ごと 書いて あります。
 *      正規表現を わりざんと 読みまちがえる ことも あります。
 *      どちらも「画面は 出るのに 中身だけ ちがう」形で 出ます。
 *
 * そこで ここでは 3つ しらべます。
 *
 *   1. **作り直して バイトで くらべる。** 1バイトでも ちがえば 落とします。
 *      依存パッケージが 0 なので、CI（`npm install` を しません）でも 走ります。
 *   2. **index.html と sw.js が 19本 とも さして いるか。**
 *      1本 わすれると、その 画面だけ 白く なります。
 *   3. **src/ と js/ を べつべつに 読みこんで、同じ こたえを 返すか。**
 *      ぜんぶの お題の ローマ字判定・★の 計算・学習ログの 組み立て・
 *      にがての 集計を 両方で 走らせて、1文字ちがわず 同じかを 見ます。
 *      バイト比較は「作り直せば 同じ」しか 言えませんが、こちらは
 *      **作りかたが まちがって いても 気づけます**。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'js');

const problems = [];
let checked = 0;

function ok(cond, what) {
  checked++;
  if (!cond) problems.push(what);
}

function eq(got, want, what) {
  ok(got === want, `${what} … ${JSON.stringify(want)} の はずが ${JSON.stringify(got)}`);
}

// ------------------------------------------------------------------
// 1. 作り直して バイトで くらべる
// ------------------------------------------------------------------

let build = null;

async function main() {
  build = await import(path.join(ROOT, 'scripts', 'build.mjs').replace(/\\/g, '/'));

  const names = build.sources();
  ok(names.length > 0, 'src/ に ファイルが ありません');

  const built = new Map();
  // つくれなかった ファイル。あとの 検査で「src/ に ありません」と
  // 言いなおすと、ほんとうの 理由（上の エラー）が 埋もれます
  const broken = new Set();
  for (const name of names) {
    try {
      built.set(name, build.buildOne(name));
    } catch (e) {
      broken.add(name);
      problems.push(`src/${name} … ${e.message}`);
    }
  }

  for (const [name, want] of built) {
    const p = path.join(OUT, name);
    if (!fs.existsSync(p)) {
      problems.push(`js/${name} が ありません。\`npm run build\` を 走らせて ください`);
      checked++;
      continue;
    }
    const got = fs.readFileSync(p, 'utf8');
    ok(got === want,
      `js/${name} が src/${name} と そろって いません。\`npm run build\` を 走らせて ください` +
      `（いま ${got.length} 文字 / つくると ${want.length} 文字）`);
  }

  // src/ から 消えた ものが js/ に のこって いないか（消し わすれた ファイルも 配られます）
  for (const f of fs.readdirSync(OUT)) {
    if (!f.endsWith('.js') || broken.has(f)) continue;
    ok(built.has(f), `js/${f} は src/ に ありません。\`npm run build\` で かたづきます`);
  }

  // ------------------------------------------------------------------
  // 2. index.html と sw.js が ぜんぶ さして いるか
  // ------------------------------------------------------------------

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const inHtml = [...html.matchAll(/<script src="\.\/js\/([^"]+)"><\/script>/g)].map(m => m[1]);

  for (const name of names) {
    ok(inHtml.indexOf(name) >= 0, `index.html が js/${name} を よんで いません`);
    ok(sw.includes(`'./js/${name}'`), `sw.js が js/${name} を 先読みして いません`);
  }
  for (const name of inHtml) {
    if (broken.has(name)) continue;
    ok(names.indexOf(name) >= 0, `index.html が よんで いる js/${name} が src/ に ありません`);
  }
  eq(inHtml.length, new Set(inHtml).size, 'index.html に 同じ スクリプトが 2回 出て います');

  // ------------------------------------------------------------------
  // 3. src/ と js/ で 同じ こたえに なるか
  // ------------------------------------------------------------------

  const a = load(SRC, names);
  const b = load(OUT, names);
  if (!a || !b) {
    problems.push('読みこめませんでした（上の エラーを 見て ください）');
  } else {
    compare(a, b);
  }

  // ------------------------------------------------------------------

  console.log(`しらべた こと: ${checked}`);
  if (problems.length === 0) {
    console.log('配信用は ソースと そろって いて、同じ ように うごきます。');
    process.exit(0);
  }
  [...new Set(problems)].forEach(p => console.log(' - ' + p));
  console.log(`\n${problems.length} 件 見つかりました。`);
  process.exit(1);
}

/**
 * ブラウザむけの ファイルを、まっさらな 入れものの 中で 読みこみます。
 * src/ と js/ が おたがいに まざらない ように、1つずつ 別の 入れものに します。
 */
function load(dir, names) {
  const memory = {};
  const sandbox = {
    console,
    Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error, Set, Map,
    isNaN, isFinite, parseInt, parseFloat,
    localStorage: {
      getItem: k => (Object.prototype.hasOwnProperty.call(memory, k) ? memory[k] : null),
      setItem: (k, v) => { memory[k] = String(v); },
      removeItem: k => { delete memory[k]; }
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // DOM を さわる ファイル（画面まわり）は 読みこみません。
  // ここで くらべるのは **計算の こたえ** です
  const SKIP = ['app.js', 'play.js', 'shortcut.js', 'nav.js', 'fx.js', 'buddy.js',
                'hands.js', 'keyboard.js', 'icons.js', 'backup.js'];
  const order = ['romaji.js', 'layout.js', 'lessons.js', 'mastery.js', 'store.js',
                 'studyLog.js', 'studySession.js', 'studyStats.js', 'awards.js'];

  try {
    for (const name of order) {
      if (names.indexOf(name) < 0) continue;
      const code = fs.readFileSync(path.join(dir, name), 'utf8');
      new vm.Script(code, { filename: `${path.basename(dir)}/${name}` }).runInContext(sandbox);
    }
    // 読みこまない ものが ふえて いないか（ふえたら ここに 足します）
    for (const name of names) {
      if (order.indexOf(name) < 0 && SKIP.indexOf(name) < 0) {
        problems.push(`${name} を check-bundle.js が 見て いません。order か SKIP に 足して ください`);
      }
    }
    return { T: sandbox.Typa, StudyLog: sandbox.StudyLog, memory };
  } catch (e) {
    problems.push(`${path.basename(dir)}/ を 読みこめません: ${e.message}`);
    return null;
  }
}

/** 2つの 入れものに 同じ ことを させて、こたえを くらべます */
function compare(a, b) {
  const same = (name, fn) => {
    let ra;
    let rb;
    try { ra = JSON.stringify(fn(a)); } catch (e) { ra = 'ERR: ' + e.message; }
    try { rb = JSON.stringify(fn(b)); } catch (e) { rb = 'ERR: ' + e.message; }
    checked++;
    if (ra !== rb) {
      problems.push(`${name} の こたえが ちがいます\n     src: ${cut(ra)}\n     js : ${cut(rb)}`);
    } else if (String(ra).startsWith('ERR:')) {
      problems.push(`${name} が 両方とも エラーです: ${ra}`);
    }
  };
  const cut = s => (String(s).length > 200 ? String(s).slice(0, 200) + '…' : String(s));

  // --- 出て いる 名前が そろって いるか
  same('Typa の 中身', ({ T }) => Object.keys(T).sort());
  same('Store の 中身', ({ T }) => Object.keys(T.Store).sort());
  same('Romaji の 中身', ({ T }) => Object.keys(T.Romaji).sort());
  same('Mastery の 中身', ({ T }) => Object.keys(T.Mastery).sort());
  same('Study の 中身', ({ T }) => Object.keys(T.Study).sort());
  same('Awards の 中身', ({ T }) => Object.keys(T.Awards).sort());

  // --- お題の データが 1文字も ちがわないか（テンプレートを こわすと ここが 出ます）
  same('コースと お題', ({ T }) => T.Lessons.COURSES);
  same('ショートカットの 課題', ({ T }) => T.Lessons.SHORTCUT_TASKS);
  same('ローマ字ひょう', ({ T }) => T.Romaji.TABLE);
  same('かなの 打ちかた', ({ T }) => [T.Romaji.KANA, T.Romaji.KANA2, T.Romaji.SOKUON]);
  same('キーボードの ならび', ({ T }) => T.Layout.LAYOUTS);
  same('指の 色と 名まえ', ({ T }) => T.Layout.FINGERS);
  same('バッジ', ({ T }) => T.Awards.BADGES.map(x => [x.id, x.icon, x.title, x.note]));
  same('★の きめかた', ({ T }) => [T.Store.STAR_RULES, T.Store.SPEED_RANKS, T.Store.HINT_STEPS,
                                   T.Store.ASSIST_LEVELS, T.Store.ASSIST_LABELS, T.Store.REVIEW_DAYS]);

  // --- ぜんぶの お題を さいごまで 打ちとおして、1打ずつ 同じかを 見る
  same('ぜんぶの お題の 打ちかた', ({ T }) => {
    const out = [];
    T.Lessons.COURSES.forEach(c => c.stages.forEach(s => (s.items || []).forEach(item => {
      const m = T.Romaji.createMatcher(item.k);
      const keys = [];
      for (let g = 0; g < 400 && !m.isFinished(); g++) {
        const info = m.expectedInfo();
        if (!info.ch) break;
        keys.push(info.ch + ':' + info.rule);
        if (!m.input(info.ch).ok) { keys.push('NG'); break; }
      }
      out.push(item.k + '=' + keys.join(''));
    })));
    return out;
  });

  // --- ★の 計算
  same('★の 計算', ({ T }) => {
    const out = [];
    [[100, 100, 100], [98, 49, 50], [92, 46, 50], [80, 40, 50], [0, 0, 13],
     [92.3, 12, 13], [66.7, 2, 3], [50, 5, 10]].forEach(([acc, ok2, total]) => {
      out.push(T.Store.starsOf({ accuracy: acc, correctKeys: ok2, totalKeys: total }));
      out.push(T.Store.starsOf({ accuracy: acc }));
    });
    return out;
  });

  // --- ひとまわりの つみあげ
  same('ひとまわりの つみあげ', ({ T }) => {
    const out = [];
    [[3, 10], [10, 10], [25, 10], [1, 1], [5, 0]].forEach(([items, need]) => {
      const cur = { lapItems: 0, lapCorrect: 0, lapTotal: 0 };
      out.push(T.Store.lapAdvance(cur, { items, correct: items * 9, total: items * 10 }, need));
      out.push(cur);
    });
    return out;
  });

  // --- だん（そのさき）
  same('だんの 計算', ({ T }) => {
    const out = [];
    for (let stars = 0; stars <= 3; stars++) {
      for (const kps of [1, 2, 3, 4, 5]) {
        for (let hint = 0; hint <= 4; hint++) out.push(T.Store.rankOf({ stars, kps, hintStrength: hint }));
      }
    }
    return out;
  });

  // --- ヒントの つよさ
  same('ヒントの つよさ', ({ T }) => {
    const out = [];
    ['custom', 'auto', 0, 1, 2, 3].forEach(assist => {
      const s = Object.assign({}, T.Store.DEFAULT_SETTINGS, { assist });
      [{}, { stageMastery: 0.2 }, { stageMastery: 0.9, everThreeStars: true }, { blind: true }]
        .forEach(ctx => {
          const v = T.Store.resolveAssist(s, ctx);
          out.push([v, T.Store.hintStrengthOf(v)]);
        });
    });
    return out;
  });

  // --- おぼえぐあい（にがての 集計）
  same('おぼえぐあいの 集計', ({ T }) => {
    const history = [];
    for (let i = 0; i < 30; i++) {
      history.push({
        at: `2026-07-${String((i % 28) + 1).padStart(2, '0')}T09:00:00.000Z`,
        missByKey: { d: i % 3, f: 1, j: 0, k: 2 },
        missByFinger: { 'l-index': 2, 'r-index': 1 },
        lat: { d: [1, 2, 3, 4, 5, 6], f: [9, 4, 1, 0, 0, 0], j: [0, 0, 1, 4, 6, 9] },
        conf: { 'd>f': 3, 'j>k': 2 },
        rule: { sokuon: [30, 8], youon: [20, 1], 'row-a': [50, 2] }
      });
    }
    return [
      T.Mastery.keySummary(history),
      T.Mastery.ruleSummary(history),
      T.Mastery.weakRules(history),
      T.Mastery.weakTargets(history),
      T.Mastery.stageMastery(T.Mastery.keySummary(history).byKey, T.Lessons.COURSES[0].stages[0])
    ];
  });

  // --- にがて とっくんの 組み立て
  same('にがて とっくんの お題', ({ T }) =>
    T.Lessons.buildWeakStage({
      keys: ['p', 'q', 'z'], slow: ['x'], pairs: [{ from: 'd', to: 'f', n: 3 }]
    }));
  same('チャレンジの 組み立て', ({ T }) =>
    T.Lessons.CHALLENGE_POOLS.map(p => T.Lessons.buildChallengeStage(p.id, 60)));

  // --- 学習ログ（study.v1）
  same('学習ログの 組み立て', ({ T }) => {
    const found = T.Lessons.findStage('romaji', 'rm-a');
    return T.Study.buildRecord({
      course: found.course, stage: found.stage, source: 'course', status: 'stopped',
      startedAt: '2026-07-20T09:00:00.000Z', clockStartedAt: '2026-07-20T09:00:05.000Z',
      finishedAt: '2026-07-20T09:03:00.000Z',
      elapsedMs: 175000, activeMs: 160000, activeMs60: 170000, retryMs: 4000,
      items: [
        { q: 'あ', ok: true, firstTry: true, tries: 1, ms: 900 },
        { q: 'いえ', ok: true, firstTry: false, tries: 2, ms: 1800, wrong: ['x'] },
        { q: 'うえ', ok: true, firstTry: true, tries: 1, ms: 800, retry: true }
      ],
      correctKeys: 40, totalKeys: 44, missKeys: 4, kps: 2.5, accuracy: 90.9, combo: 12,
      missByKey: { d: 2, f: 1 }, missByFinger: { 'l-index': 3 },
      retryMissByKey: { d: 1 }, retryMissByFinger: { 'l-index': 1 },
      lapNeed: 9, lapPos: 0, laps: 1, layout: 'jis', hintLevel: 'finger-color'
    }, { appVersion: '9.9.9', lapStars: 2, rank: 1 });
  });

  // --- 設問ID・単元ID（きろくの つながりを 決める もの）
  same('設問IDと 単元ID', ({ T }) => [
    ['ffff', 'あいうえお', '', 'ちょっと ながい お題です'].map(T.Study.questionId),
    T.Study.unitIdOf('romaji', 'rm-a')
  ]);

  // --- レベルと けいけんち
  same('レベルと けいけんち', ({ T }) => {
    const out = [];
    [0, 79, 80, 500, 5000, 999999].forEach(xp => out.push(T.Awards.levelOf(xp)));
    out.push(T.Awards.xpFor(
      { correctKeys: 120, totalKeys: 130, missKeys: 10, status: 'stopped', stage: { mode: 'romaji' }, items: [] },
      { laps: 1, firstClear: true, newStars: 2, newRank: 1 }));
    return out;
  });

  // --- 日づけの 数えかた（きょう・れんぞく日数の もと）
  same('日づけの 数えかた', ({ T }) => [
    T.Store.localDay('2026-07-20T23:30:00.000Z'),
    T.Store.localDay('こわれた 日づけ'),
    T.Store.dayBefore(0) === T.Store.localDay(),
    T.Store.dayAhead(1) > T.Store.localDay()
  ]);

  // --- localStorage を つかう 道（読み書きを とおして 同じに なるか）
  same('のこして 読みかえす', ({ T }) => {
    const out = [];
    for (let i = 0; i < 3; i++) {
      out.push(T.Store.applyResult('hp-1', {
        doneItems: 4, lapNeed: 8, correctKeys: 30, totalKeys: 32,
        kps: 2.2, accuracy: 93.75, hintStrength: 2, finishedAt: '2026-07-20T09:00:00.000Z'
      }));
    }
    out.push(T.Store.getProgress());
    out.push(T.Store.lapState('hp-1', 8));
    out.push(T.Store.applyChallenge('ch-word-60',
      { correctKeys: 210, kps: 3.5, accuracy: 97, finishedAt: '2026-07-20T09:10:00.000Z' }));
    out.push(T.Store.setAssist(2));
    out.push(T.Store.getSettings());
    return out;
  });

  same('のこした 中身そのもの', ({ memory }) => memory);
}

main();
