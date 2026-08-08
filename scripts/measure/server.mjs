#!/usr/bin/env node
/**
 * server.mjs — 検査用の ちいさな サーバー
 *
 *   node scripts/measure/server.mjs <おやフォルダ> <ポート>
 *
 * リポジトリを /{リポジトリ名}/ の 形で 出します。
 * manifest の scope / start_url が 絶対パス（/Typa/）なので、
 * この 形で 出さないと PWA の 挙動が 本番と そろいません。
 *
 * ・Cache-Control: no-store … ブラウザの ひかえが 混ざると、
 *   Service Worker の ふるまいを 測って いるのか 分からなく なります
 * ・Access-Control-Allow-Origin … 将来 SRI 付きの ひかえを 置く ときに 要ります
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2];
const PORT = Number(process.argv[3] || 8801);
const MIME = {
  '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8',
  '.mjs': 'text/javascript;charset=utf-8', '.css': 'text/css;charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json',
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, url);
  try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); }
  catch { res.writeHead(404); return res.end('404'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      // 大きさを 測る 側が とどいた バイト数を 数えられる ように 出します
      'Content-Length': data.length,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}).listen(PORT, () => console.log(`${ROOT} を http://127.0.0.1:${PORT}/ で 出して います`));
