/**
 * =====================================================================
 * awards.js — レベル・けいけんち・バッジ
 * =====================================================================
 * 「うまく なって いる」ことが 目に 見えると、れんしゅうは つづきます。
 * このアプリは 通信を しないので、ごほうびも すべて 端末の 中で 完結します。
 *
 * ■ けいけんち（XP）の 考えかた
 * いちばん 大きいのは **正しく 打てた 数** です。速さでは ありません。
 * そのうえで「正かくさ」「はじめての クリア」「さいこう記録」に ボーナスを
 * つけます。こうすると、ゆっくり ていねいに 打つ 子ほど よく のびます。
 *
 * ■ バッジ
 * 「たまたま 出た」ものが ないように、条件は すべて 数で 決めます。
 * 一度 もらった バッジは 消えません（きろくを けした ときだけ 消えます）。
 */
(function (global) {
  'use strict';

  const T = global.Typa;

  const MAX_LEVEL = 50;

  /** レベルを 1つ 上げるのに ひつような けいけんち */
  function need(level) { return 80 + (level - 1) * 25; }

  /** レベルに つく よび名。5レベルごとに かわります */
  const RANKS = [
    { min: 1,  name: 'ひよこ タイパー' },
    { min: 5,  name: 'みならい タイパー' },
    { min: 9,  name: 'なかよし タイパー' },
    { min: 14, name: 'ちからもち タイパー' },
    { min: 20, name: 'たつじん タイパー' },
    { min: 27, name: 'めいじん タイパー' },
    { min: 35, name: 'でんせつの タイパー' }
  ];

  function rankOf(level) {
    let name = RANKS[0].name;
    RANKS.forEach(r => { if (level >= r.min) name = r.name; });
    return name;
  }

  /**
   * けいけんちから いまの レベルを 出します。
   * @returns {{level, xp, need, ratio, rank, total}} xp は そのレベルの 中で ためた ぶん
   */
  function levelOf(total) {
    let level = 1;
    let remain = Math.max(0, Math.round(total || 0));
    while (level < MAX_LEVEL && remain >= need(level)) { remain -= need(level); level++; }
    const n = need(level);
    return { level, xp: remain, need: n, ratio: Math.min(1, remain / n), rank: rankOf(level), total: Math.round(total || 0) };
  }

  // ------------------------------------------------------------------
  // けいけんちの けいさん
  // ------------------------------------------------------------------

  /**
   * 練習1回ぶんの けいけんち。
   *
   * ■ 「さいごまで やった」には あげません
   * 前は 最後まで やりきった 回に ボーナスを つけて いました。けれど
   * それは 「時間が ある 子ほど 有利」という ことで、10びょうしか
   * 時間が ない 子を そのまま おいて いく しくみでした。
   * いまは **打った ぶん**と **ひとまわり できた こと**に つけます。
   * 5回に わけて ひとまわりしても、1回で ひとまわりしても 同じ です。
   *
   * @param {Object} r セッションの けっか
   * @param {Object} meta { firstClear, newBestKps, newStars, isBestScore, laps }
   * @returns {{total: number, parts: Array<{label: string, xp: number}>}}
   */
  function xpFor(r, meta) {
    const parts = [];
    const add = (label, xp) => { if (xp > 0) parts.push({ label, xp: Math.round(xp) }); };
    const m = meta || {};

    add('打てた 数', r.correctKeys || 0);

    if (m.laps > 0) add('ひとまわり できた', 20 * m.laps);
    // チャレンジは ひとまわりが ないので、時間まで やりきった ことに つけます
    else if (r.status === 'completed' && r.stage && r.stage.mode === 'challenge') {
      add('さいごまで やった', 20);
    }

    const acc = r.accuracy || 0;
    // 正かくさの ボーナスは、ある ていど 打った 回だけ です。
    // 3打で 100% の 回に 40 を つけると、すぐ やめる ほうが とくに なります
    if (r.totalKeys >= T.Store.MIN_RECORD_KEYS) {
      if (acc >= 98) add('ほとんど ミスなし', 40);
      else if (acc >= 92) add('正かくに 打てた', 20);
      else if (acc >= 80) add('がんばった', 10);
    }
    // ショートカットは 打鍵を 数えないので、できた 課題の 数で 見ます
    if (r.stage && r.stage.mode === 'shortcut') {
      add('できた 課題', (r.items || []).filter(i => i.ok).length * 12);
    }

    if (m.firstClear) add('はじめての クリア', 60);
    if (m.newBestKps || m.isBestScore) add('さいこう記録', 30);
    if (m.newStars) add('★が ふえた', m.newStars * 25);

    return { total: parts.reduce((sum, p) => sum + p.xp, 0), parts };
  }

  // ------------------------------------------------------------------
  // バッジ
  // ------------------------------------------------------------------

  /**
   * バッジの 一覧。
   * test(ctx) が true に なった ときに もらえます。
   * ctx は buildContext() が つくる「いまの じょうたい」です。
   */
  const BADGES = [
    { id: 'first-step', icon: 'play', title: 'はじめの いっぽ', note: 'はじめて れんしゅうした',
      test: c => c.awards.sessions >= 1 },
    { id: 'keys-500', icon: 'keyboard', title: '500だ', note: 'ぜんぶで 500だ 打った',
      test: c => c.awards.keys >= 500 },
    { id: 'keys-2000', icon: 'keyboard', title: '2000だ', note: 'ぜんぶで 2000だ 打った',
      test: c => c.awards.keys >= 2000 },
    { id: 'keys-10000', icon: 'keyboard', title: '10000だ', note: 'ぜんぶで 10000だ 打った',
      test: c => c.awards.keys >= 10000 },

    { id: 'perfect-1', icon: 'target', title: 'ノーミス', note: '1かいも まちがえずに クリアした',
      test: c => c.awards.perfect >= 1 },
    { id: 'perfect-10', icon: 'target', title: 'ノーミス 10かい', note: 'ノーミスの クリアが 10かい',
      test: c => c.awards.perfect >= 10 },

    { id: 'streak-3', icon: 'clock', title: '3日 つづけた', note: '3日 つづけて れんしゅうした',
      test: c => c.streakDays >= 3 },
    { id: 'streak-7', icon: 'clock', title: '1週間 つづけた', note: '7日 つづけて れんしゅうした',
      test: c => c.streakDays >= 7 },
    { id: 'streak-30', icon: 'clock', title: '1か月 つづけた', note: '30日 つづけて れんしゅうした',
      test: c => c.streakDays >= 30 },

    { id: 'speed-2', icon: 'bolt', title: 'はやさ 2.0', note: '2.0 打/びょう を こえた',
      test: c => c.bestKps >= 2 },
    { id: 'speed-4', icon: 'bolt', title: 'はやさ 4.0', note: '4.0 打/びょう を こえた',
      test: c => c.bestKps >= 4 },
    { id: 'speed-6', icon: 'bolt', title: 'はやさ 6.0', note: '6.0 打/びょう を こえた',
      test: c => c.bestKps >= 6 },

    { id: 'course-home-position', icon: 'hand', title: 'ゆびの ばしょ 名人', note: 'ゆびの ばしょの ステージを ぜんぶ クリア',
      test: c => c.courseCleared['home-position'] },
    { id: 'course-romaji', icon: 'letter', title: 'ローマ字 名人', note: 'ローマ字の ステージを ぜんぶ クリア',
      test: c => c.courseCleared.romaji },
    { id: 'course-words', icon: 'word', title: 'ことば 名人', note: 'ことばの ステージを ぜんぶ クリア',
      test: c => c.courseCleared.words },
    { id: 'course-sentences', icon: 'text', title: '文の 名人', note: '文の ステージを ぜんぶ クリア',
      test: c => c.courseCleared.sentences },
    { id: 'course-shortcut', icon: 'bolt', title: 'ショートカット名人', note: 'ショートカットを ぜんぶ クリア',
      test: c => c.courseCleared.shortcut },
    { id: 'star-master', icon: 'star', title: 'オール ★3', note: 'ぜんぶの ステージで ★3つ',
      test: c => c.allStars },

    { id: 'weak-5', icon: 'finger', title: 'にがて つぶし', note: 'にがて とっくんを 5かい やった',
      test: c => c.awards.weak >= 5 },
    { id: 'challenge-100', icon: 'trophy', title: 'チャレンジ 100だ', note: 'チャレンジで 100だ こえた',
      test: c => c.challengeBest >= 100 },
    { id: 'challenge-300', icon: 'trophy', title: 'チャレンジ 300だ', note: 'チャレンジで 300だ こえた',
      test: c => c.challengeBest >= 300 }
  ];

  function findBadge(id) { return BADGES.filter(b => b.id === id)[0] || null; }

  /** バッジの 条件を みるための「いまの じょうたい」を あつめます */
  function buildContext(awards) {
    const progress = T.Store.getProgress();
    const best = T.Store.bestOverall();
    const challenge = T.Store.getChallenge();

    const courseCleared = {};
    let allStars = true;
    let anyStage = false;
    T.Lessons.COURSES.forEach(course => {
      let cleared = true;
      course.stages.forEach(stage => {
        anyStage = true;
        const p = progress[stage.id] || {};
        if (!(p.clears > 0)) cleared = false;
        if ((p.stars || 0) < 3) allStars = false;
      });
      courseCleared[course.id] = cleared;
    });

    const challengeBest = Object.keys(challenge)
      .reduce((max, k) => Math.max(max, challenge[k].keys || 0), 0);

    return {
      awards: awards || T.Store.getAwards(),
      progress,
      streakDays: T.Store.streak().days,
      bestKps: best ? best.kps : 0,
      courseCleared,
      allStars: anyStage && allStars,
      challengeBest
    };
  }

  /** いま もらえる バッジを しらべ、あたらしい ものを 記録します */
  function checkBadges(awards) {
    const ctx = buildContext(awards);
    const fresh = [];
    const now = new Date().toISOString();
    BADGES.forEach(badge => {
      if (awards.unlocked[badge.id]) return;
      let ok = false;
      try { ok = !!badge.test(ctx); } catch (e) { ok = false; }
      if (ok) { awards.unlocked[badge.id] = now; fresh.push(badge); }
    });
    return fresh;
  }

  // ------------------------------------------------------------------
  // 練習1回ぶんを 反映する
  // ------------------------------------------------------------------

  /**
   * けっかを けいけんち・バッジに 反映します。
   * ここは saveResult() から 1回だけ よばれます。
   *
   * @param {Object} r セッションの けっか
   * @param {Object} meta { firstClear, newBestKps, newStars, isBestScore, special }
   * @returns {{gained: number, parts: Array, before: Object, after: Object, levelUp: boolean, badges: Array}}
   */
  function applyResult(r, meta) {
    const awards = T.Store.getAwards();
    const before = levelOf(awards.xp);

    const gain = xpFor(r, meta);
    awards.xp += gain.total;
    awards.keys += Math.round(r.correctKeys || 0);
    awards.sessions += 1;
    // ノーミスは「ひとまわり ミス0」で 数えます。1打だけ 打って やめた 回を
    // ノーミスに すると、バッジが 何も あらわさなく なります
    const perfectRun = (r.missKeys || 0) === 0 &&
      ((meta || {}).laps > 0 || (r.status === 'completed' && (r.totalKeys || 0) >= T.Store.MIN_RECORD_KEYS));
    if ((r.totalKeys || 0) > 0 && perfectRun) awards.perfect += 1;
    if ((meta || {}).special === 'weak') awards.weak += 1;
    if ((meta || {}).special === 'challenge') awards.challenge += 1;

    const badges = checkBadges(awards);
    T.Store.saveAwards(awards);

    const after = levelOf(awards.xp);
    return {
      gained: gain.total, parts: gain.parts,
      before, after, levelUp: after.level > before.level,
      badges
    };
  }

  /** きろく画面に 出す バッジの 一覧（もらった ものが 先） */
  function badgeList() {
    const awards = T.Store.getAwards();
    return BADGES.map(b => Object.assign({}, b, { got: awards.unlocked[b.id] || null }));
  }

  global.Typa = global.Typa || {};
  global.Typa.Awards = { BADGES, RANKS, levelOf, need, rankOf, xpFor, applyResult, badgeList, findBadge, checkBadges, buildContext };
})(window);
