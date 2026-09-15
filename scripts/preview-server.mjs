#!/usr/bin/env node
/**
 * preview-server.mjs — שרת-סטטי לתצוגת-פיתוח: `node scripts/preview-server.mjs <dir> [port]`
 *
 * קיים בגלל לקח 15.9: התצוגה רצה על `python3 -m http.server`, שאינו תומך
 * ‏Range/206 - וכרום נועל את ה-seek של וידאו על 0 בשקט (seekable ריק).
 * ה-scrub של וידאו-העיניים "לא עבד" בתצוגה בזמן שבאתר החי הוא רץ - שעה
 * של חקירה על באג שלא היה בקוד. אותו לקח כבר נלמד פעם ב-T15 (serveRepo
 * ב-lib/env.mjs); זה אותו מימוש, משוחרר מהצמדה ל-ROOT כדי לשרת כל תיקייה.
 */
import { createServer } from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import { join, normalize, extname, resolve } from 'node:path';

const DIR = resolve(process.argv[2] || '.');
const PORT = +(process.argv[3] || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.gif': 'image/gif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(DIR, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(DIR)) { res.writeHead(403).end(); return; }
    const s = await stat(file).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404).end(); return; }
    const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
    // ‏Range/206 - בלעדיו כרום לא מבצע seek בווידאו (ננעל על 0)
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      const start = range[1] ? +range[1] : Math.max(0, s.size - +range[2]);
      const end = range[1] && range[2] ? Math.min(+range[2], s.size - 1) : s.size - 1;
      if (start >= s.size || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${s.size}` }).end();
        return;
      }
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${s.size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
      });
      res.end((await readFile(file)).subarray(start, end + 1));
      return;
    }
    res.writeHead(200, {
      'Content-Type': type, 'Content-Length': s.size,
      'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store',
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(500).end();
  }
}).listen(PORT, () => console.log(`▸ preview: http://localhost:${PORT} ← ${DIR}`));
