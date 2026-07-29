/**
 * =====================================================================
 * mastery.js — どのキーが「もう おぼえた」かを 見る
 * =====================================================================
 * ■ なぜ「ミスの 数」だけでは 足りないのか
 * タイピングで ほんとうに 身に つけたいのは **見ないで 打てる** ことです。
 * ところが「まちがえた 数」だけを 見ていると、
 *
 *   まちがえないが、いつも 1びょう さがしている キー
 *
 * が まったく 見えません。この 子は まだ 画面を 見て 打って います。
 * ミスは 0 なので、これまでの にがて集計には 一度も 出て きませんでした。
 *
 * そこで **打つまでに かかった 時間** も 数え、
 * 「正しさ」と「はやさ」を あわせて おぼえぐあいに します。
 *
 * ■ 時間は「入れもの」で 数えます
 * 1打ずつの 生の 時間を のこすと 保存領域が すぐ いっぱいに なります。
 * かといって 平均を とると、1回の 長い 手止まりで 大きく ずれます。
 * そこで 6つの 入れものに 数だけを 入れ、まん中の 値を そこから 出します。
 * これなら 何回ぶんを 足しても 正しく まん中が 出せますし、
 * 「おそい 打鍵の わりあい」も そのまま 分かります。
 *
 * ■ 数が 少ない うちは「わからない」と 出します
 * 2回 打っただけの キーを「にがて」と 言い切るのは まちがいです。
 * 数が たりない キーは おぼえぐあいを null に して、
 * 画面でも「にがて」とは べつの 見た目に します。
 *
 * このファイルは **localStorage に さわりません**。きろくの 配列を もらって
 * 数えるだけなので、node からも そのまま ためせます。
 */
(function (global) {
  'use strict';

  /**
   * 打つまでの 時間を 入れる ところ（ミリびょう）。
   * 150 より 速い＝手が おぼえている、1200 より おそい＝さがしている。
   */
  const EDGES = [150, 250, 400, 700, 1200];
  const BUCKETS = EDGES.length + 1;

  /** これより 長い 手止まりは「打つのを やめて いた」とみなして 数えません */
  const MAX_SAMPLE = 3000;

  /** おぼえぐあいを 出すのに ひつような 打鍵の 数 */
  const MIN_SAMPLES = 8;

  /** はやさの 点が 満点に なる／0に なる まん中の 時間 */
  const FAST_MS = 250;
  const SLOW_MS = 900;

  /** ここから 上は「おそい」ほうの 入れもの（4番目から） */
  const SLOW_BUCKET = 4;

  /** おぼえぐあいの 区切りと よび名 */
  const BUCKET_EDGES = [
    { min: 0.66, id: 'good', label: 'だいじょうぶ' },
    { min: 0.36, id: 'soso', label: 'もうすこし' },
    { min: 0, id: 'weak', label: 'まだまだ' }
  ];

  /** ローマ字の きまりの よび名（画面に そのまま 出します） */
  const RULE_LABELS = {
    sokuon: 'ちいさい つ',
    hatsuon: 'ん',
    youon: 'ちいさい や ゆ よ',
    dakuten: 'てんてん・まる',
    gaion: 'ふぁ・てぃ など',
    'row-a': 'あ行', 'row-ka': 'か行', 'row-sa': 'さ行', 'row-ta': 'た行',
    'row-na': 'な行', 'row-ha': 'は行', 'row-ma': 'ま行', 'row-ya': 'や行',
    'row-ra': 'ら行', 'row-wa': 'わ行'
  };

  /** どの きまりを どの ステージで ふくしゅうするか（stage.skill で 引きます） */
  const RULE_TO_SKILL = {
    sokuon: 'sokuon',
    hatsuon: 'hatsuon-n',
    youon: 'youon',
    dakuten: 'dakuten',
    gaion: 'romaji-mixed',
    'row-a': 'row-a', 'row-ka': 'row-ka', 'row-sa': 'row-sa', 'row-ta': 'row-ta',
    'row-na': 'row-na-ha', 'row-ha': 'row-na-ha',
    'row-ma': 'row-ma-wa', 'row-ya': 'row-ma-wa',
    'row-ra': 'row-ma-wa', 'row-wa': 'row-ma-wa'
  };

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  /** 時間（ミリびょう）が どの 入れものに 入るか */
  function bucketOf(ms) {
    for (let i = 0; i < EDGES.length; i++) if (ms < EDGES[i]) return i;
    return EDGES.length;
  }

  /**
   * 入れものの 数から まん中の 時間を 出します。
   * ぴったりの 値は 分からないので、またいで いる 入れものの 中を
   * まっすぐ 割って 見つもります。
   */
  function medianFrom(counts) {
    let total = 0;
    for (let i = 0; i < counts.length; i++) total += counts[i] || 0;
    if (total <= 0) return 0;
    const half = total / 2;
    let seen = 0;
    for (let i = 0; i < counts.length; i++) {
      const n = counts[i] || 0;
      if (seen + n >= half) {
        const lo = i === 0 ? 0 : EDGES[i - 1];
        const hi = i < EDGES.length ? EDGES[i] : EDGES[EDGES.length - 1] * 2;
        if (n <= 0) return lo;
        return Math.round(lo + (hi - lo) * ((half - seen) / n));
      }
      seen += n;
    }
    return EDGES[EDGES.length - 1];
  }

  /** おそい 打鍵の わりあい */
  function slowRateFrom(counts) {
    let total = 0;
    let slow = 0;
    for (let i = 0; i < counts.length; i++) {
      const n = counts[i] || 0;
      total += n;
      if (i >= SLOW_BUCKET) slow += n;
    }
    return total > 0 ? slow / total : 0;
  }

  /**
   * 1つの キーの おぼえぐあい（0〜1）。数が 足りなければ null。
   *
   * 正しさを 6わり、はやさを 4わりで 見ます。まちがえない ことの ほうが
   * 大事なので 正しさを 重く しますが、はやさを 入れないと
   * 「まちがえないが さがして いる」キーが 見つかりません。
   */
  function masteryOf(stat) {
    if (!stat || stat.n < MIN_SAMPLES) return null;
    const errRate = stat.n > 0 ? stat.misses / stat.n : 0;
    // ミス 15% で 正しさの 点は 0 に します
    const accScore = clamp01(1 - errRate / 0.15);
    const speedScore = stat.medianMs > 0
      ? clamp01((SLOW_MS - stat.medianMs) / (SLOW_MS - FAST_MS))
      : 0;
    return clamp01(0.6 * accScore + 0.4 * speedScore);
  }

  /** おぼえぐあい → よび名（色だけに たよらない ための ことば） */
  function labelOf(mastery) {
    if (mastery === null || mastery === undefined) return 'まだ わからない';
    for (const b of BUCKET_EDGES) if (mastery >= b.min) return b.label;
    return BUCKET_EDGES[BUCKET_EDGES.length - 1].label;
  }

  function idOf(mastery) {
    if (mastery === null || mastery === undefined) return 'unknown';
    for (const b of BUCKET_EDGES) if (mastery >= b.min) return b.id;
    return 'weak';
  }

  /**
   * あたらしい 回ほど おもく 見ます。
   * missSummary()（store.js）と まったく 同じ 式に そろえて います。
   * 2つの にがて集計が べつの 重みで 動くと、画面ごとに 言うことが かわります。
   */
  function weightAt(i, len) { return 1 + i / Math.max(1, len); }

  // ------------------------------------------------------------------
  // キーごとの まとめ
  // ------------------------------------------------------------------

  /**
   * きろくから キーごとの おぼえぐあいを 数えます。
   *
   * @param {Array} history store.getHistory() の 中身
   * @param {number} [span] 見にいく 回数
   * @returns {{byKey: Object, weak: string[], slow: string[], pairs: Array}}
   *   byKey … { [ch]: { n, misses, errRate, medianMs, slowRate, mastery, label } }
   *   weak  … おぼえぐあいの 低い じゅん
   *   slow  … まちがえないのに 手が とまる キー
   *   pairs … とりちがえた くみあわせ（多い じゅん）
   */
  function keySummary(history, span) {
    const list = (history || []).slice(-(span || 40));
    const byKey = {};
    const pairCount = {};

    function slot(ch) {
      if (!byKey[ch]) byKey[ch] = { n: 0, misses: 0, counts: new Array(BUCKETS).fill(0) };
      return byKey[ch];
    }

    list.forEach((h, i) => {
      const w = weightAt(i, list.length);
      // 打つまでの 時間（入れものごとの 数）
      const lat = h.lat || {};
      Object.keys(lat).forEach(ch => {
        const arr = lat[ch];
        if (!Array.isArray(arr)) return;
        const s = slot(ch);
        for (let b = 0; b < BUCKETS && b < arr.length; b++) {
          const n = arr[b] || 0;
          s.counts[b] += n * w;
          s.n += n * w;
        }
      });
      // ミスの 数
      Object.keys(h.missByKey || {}).forEach(ch => {
        const s = slot(ch);
        s.misses += h.missByKey[ch] * w;
        s.n += h.missByKey[ch] * w;
      });
      // とりちがえた くみあわせ
      Object.keys(h.conf || {}).forEach(pair => {
        pairCount[pair] = (pairCount[pair] || 0) + h.conf[pair] * w;
      });
    });

    const weak = [];
    const slow = [];
    Object.keys(byKey).forEach(ch => {
      const s = byKey[ch];
      s.errRate = s.n > 0 ? s.misses / s.n : 0;
      s.medianMs = medianFrom(s.counts);
      s.slowRate = slowRateFrom(s.counts);
      s.mastery = masteryOf(s);
      s.label = labelOf(s.mastery);
      if (s.mastery !== null && s.mastery < BUCKET_EDGES[1].min) weak.push(ch);
      // まちがえないのに 手が とまる キー。いままで まったく 見えて いなかった もの
      if (s.n >= 12 && s.errRate < 0.05 && s.slowRate > 0.35) slow.push(ch);
    });

    weak.sort((a, b) => byKey[a].mastery - byKey[b].mastery);
    slow.sort((a, b) => byKey[b].medianMs - byKey[a].medianMs);

    const pairs = Object.keys(pairCount)
      .map(p => {
        const [from, to] = p.split('>');
        return { from, to, n: pairCount[p] };
      })
      .filter(p => p.from && p.to && p.from !== p.to)
      .sort((a, b) => b.n - a.n);

    return { byKey, weak, slow, pairs };
  }

  // ------------------------------------------------------------------
  // ローマ字の きまりごとの まとめ
  // ------------------------------------------------------------------

  /**
   * どの きまりで つまずいて いるかを 数えます。
   * **正しく 打てた ぶんも 数えます**。回数では なく わりあいで 見ないと、
   * よく 出て くる きまりほど にがてに 見えて しまうためです。
   *
   * @returns {Array<{rule, label, total, miss, errRate}>} つまずく じゅん
   */
  function ruleSummary(history, span) {
    const list = (history || []).slice(-(span || 40));
    const acc = {};
    list.forEach((h, i) => {
      const w = weightAt(i, list.length);
      const r = h.rule || {};
      Object.keys(r).forEach(rule => {
        const pair = r[rule];
        if (!Array.isArray(pair)) return;
        if (!acc[rule]) acc[rule] = { total: 0, miss: 0 };
        acc[rule].total += (pair[0] || 0) * w;
        acc[rule].miss += (pair[1] || 0) * w;
      });
    });
    return Object.keys(acc)
      .map(rule => {
        const a = acc[rule];
        return {
          rule,
          label: RULE_LABELS[rule] || rule,
          total: a.total,
          miss: a.miss,
          errRate: a.total > 0 ? a.miss / a.total : 0
        };
      })
      .sort((a, b) => b.errRate - a.errRate);
  }

  /** はっきり にがてと 言える きまりだけ（数が 少ない うちは 出しません） */
  function weakRules(history, span) {
    return ruleSummary(history, span).filter(r => r.total >= 20 && r.errRate >= 0.15);
  }

  // ------------------------------------------------------------------
  // にがて とっくんの ねらい
  // ------------------------------------------------------------------

  /** にがて とっくんで つかえる キーだけ（JIS と US の どちらにも あるもの） */
  const SAFE_KEY = /^[a-z0-9;,./-]$/;

  /**
   * にがて とっくんに 何を 入れるかを 決めます。
   *
   * @returns {{keys: string[], slow: string[], pairs: Array, ready: boolean}}
   *   ready … とっくんを 組み立てられるか（ホームの ボタンの 出しわけに つかいます）
   */
  function weakTargets(history, span) {
    const keys = keySummary(history, span);
    const weak = keys.weak.filter(k => SAFE_KEY.test(k));
    const slow = keys.slow.filter(k => SAFE_KEY.test(k) && weak.indexOf(k) < 0);
    const pairs = keys.pairs.filter(p => SAFE_KEY.test(p.from) && SAFE_KEY.test(p.to));
    // とりちがえが 1つ でも あれば 組み立てる 意味が あります
    return { keys: weak, slow, pairs, ready: weak.length >= 2 || pairs.length >= 1 };
  }

  global.Typa = global.Typa || {};
  global.Typa.Mastery = {
    EDGES, BUCKETS, MAX_SAMPLE, MIN_SAMPLES, BUCKET_EDGES, RULE_LABELS, RULE_TO_SKILL, SAFE_KEY,
    bucketOf, medianFrom, slowRateFrom, masteryOf, labelOf, idOf,
    keySummary, ruleSummary, weakRules, weakTargets
  };
})(window);
