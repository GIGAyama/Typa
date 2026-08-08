/**
 * =====================================================================
 * studyLog.js — がくしゅうログ（study.v1）を 端末に のこす
 * =====================================================================
 * ロジック版 **1.1**（「学習ログ共通スキーマ仕様書 study.v1」§5.1.2 の 参照実装）
 *
 * ■ このファイルだけは 8つの アプリで **中身が 同じ** です
 * GIGA山の 学習アプリは、どれも 同じ かたちで 学習の きろくを のこします。
 * そろって いないと、先生が 横に ならべて 見る ことが できません。
 * ですから **ここに Typa だけの 話を 書いては いけません**。
 * Typa の 事情は js/studySession.js の ほうに あります。
 *
 * 直した ときは、ほかの 7アプリにも 同じ ものを 配り直します
 * （仕様書 §5.1.3 の 表を いっしょに 直して ください）。
 *
 * ■ 保存だけ します。**外へ おくる しくみは ありません**
 * のこす さきは この 端末の localStorage だけです。先生の ところへ
 * まとめて おくるのは、同じ ドメインに ある べつの ページ（送信ページ）の
 * しごとです。Typa の 中には 通信の コードが 1行も ありません。
 *
 * ■ 児童を 見わける ものは 入れません
 * 名前・出席番号・メールアドレスは レコードに 入れません。だれの きろくかは
 * 送信ページが つけます。アプリの 中では ずっと 名なしの ままです。
 *
 * ■ キーの 名前だけ とくべつです
 *   study.records.v1  … **ほかの アプリと 共有** する 学習ログ
 * Typa の ほかの キーは typa.* で はじまりますが、これだけは 共有の ため
 * わざと 名前を そろえて いません。**「きろくを けす」で 消しては いけません**
 * （まだ 先生に とどいて いない 回が 消えます）。
 */
(function (global) {
  'use strict';

  /** この ファイルの ロジックの 版。ほかの アプリと 見くらべる ときに つかいます */
  const LOGIC_VERSION = '1.1';

  const STUDY_LOG_KEY = 'study.records.v1';
  const STUDY_LOG_MAX = 500;      // これを こえたら 古い ものから すてます
  const STUDY_ITEMS_MAX = 200;    // 1レコードに 入れる 設問の かず

  const uuid = () =>
    (global.crypto && global.crypto.randomUUID
      ? global.crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        }));

  /** 自由に 入力できた 値は そのまま のこしません（12文字まで・あぶない 字は すてる） */
  const sanitizeWrong = (v) =>
    typeof v === 'string' && v.length <= 12 && !/[<>{}\\]/.test(v) ? v : null;

  /**
   * レコードを 1件 のこします。
   *
   * ■ 保存に しくじっても だまって 続けます
   * 学習ログの つごうで れんしゅうが 止まっては いけません。
   *
   * @param {Object} rec 組み立てた レコード（studySession.js が つくります）
   * @returns {string|null} のこした レコードの id。のこせなければ null
   */
  function saveStudyRecord(rec) {
    try {
      // 必須項目の 検証。ここで 1回だけ します
      if (!rec || !rec.appId || !rec.unit || !rec.unit.id) return null;
      if (typeof rec.elapsedMs !== 'number' || rec.elapsedMs < 0) return null;
      if (!rec.summary || typeof rec.summary.count !== 'number') return null;

      const items = Array.isArray(rec.items)
        ? rec.items.slice(0, STUDY_ITEMS_MAX).map((it) => Object.assign({}, it, {
            wrong: Array.isArray(it.wrong)
              ? it.wrong.map(sanitizeWrong).filter(Boolean)
              : undefined
          }))
        : undefined;

      const entry = Object.assign({
        schema: 'study.v1',
        id: uuid(),
        kind: 'session',
        source: 'course',
        multiplayer: false,
        grading: 'objective',
        status: 'completed',
        timeBasis: 'app'
      }, rec, {
        items: items,
        elapsedMs: Math.round(rec.elapsedMs)
      });

      // 保存済みログの 読み出し。
      // 中身が こわれて いる（JSON として 読めない／配列でない）ときは 空から やり直します。
      // ここで 外側の catch に ながすと、一度 こわれた 端末は それ以降 ずっと
      // 1件も 保存できなく なります。しかも 失敗は だまって 見のがす つくりなので、
      // だれも 気づけません。
      const raw = localStorage.getItem(STUDY_LOG_KEY);
      let log = [];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) log = parsed;
        } catch (e) { /* こわれて いた → 空から やり直す */ }
      }

      log.push(entry);
      if (log.length > STUDY_LOG_MAX) log.splice(0, log.length - STUDY_LOG_MAX);
      localStorage.setItem(STUDY_LOG_KEY, JSON.stringify(log));
      return entry.id;
    } catch (e) {
      // 保存失敗は アプリの 動作を さまたげません
      console.warn('[studyLog] save failed', e);
      return null;
    }
  }

  global.StudyLog = {
    LOGIC_VERSION, STUDY_LOG_KEY, STUDY_LOG_MAX, STUDY_ITEMS_MAX, saveStudyRecord
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
