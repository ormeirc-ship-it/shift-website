// תשתית משותפת לכלי המדידה: איתור כרום, שרת סטטי מקומי, ועזרי פורמט.
// הכלים מגישים את הריפו בעצמם ולא תלויים בשרת תצוגה חיצוני — כך שכל
// מדידה ניתנת לשחזור מאפס בפקודה אחת.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

export const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  join(homedir(), 'Desktop/Google Chrome.app/Contents/MacOS/Google Chrome'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  join(homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean);

export function chromePath() {
  const hit = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!hit) {
    console.error('✗ לא נמצא כרום. נסיתי:');
    CHROME_CANDIDATES.forEach((p) => console.error('  · ' + p));
    console.error('\nהרץ עם נתיב מפורש:  CHROME_PATH="/path/to/Chrome" npm run <script>');
    process.exit(2);
  }
  return hit;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp4': 'video/mp4',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

/** מגיש את הריפו על פורט פנוי. מחזיר {url, close}. */
export async function serveRepo() {
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      const s = await stat(file);
      if (!s.isFile()) { res.writeHead(404).end(); return; }
      const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
      // ‏Range/206 — בלעדיו כרום לא מסוגל לבצע seek בווידאו (seekable ריק,
      // ‏currentTime ננעל על 0 — נמדד ב-T15). ‏GitHub Pages ופייתון-4173
      // תומכים; הרִיג חייב לשקף את הפרודקשן.
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
        'Content-Type': type,
        'Content-Length': s.size,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
      });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise((r) => server.close(r)),
  };
}

export const kb = (n) => (n / 1024).toFixed(0) + 'KB';
export const pad = (s, n) => String(s).padEnd(n);

/** ממתין שהאתר יסיים את מסך הפתיחה ושהרצף ייטען (עם תקרה). */
export async function ready(page, { frames = true, timeout = 25000 } = {}) {
  await page.waitForFunction(
    () => document.documentElement.classList.contains('preloader-done'),
    { timeout }).catch(() => {});
  if (frames) {
    await page.waitForFunction(
      () => window.__dive && window.__dive.allFramesMs !== null,
      { timeout }).catch(() => {});
  }
  await new Promise((r) => setTimeout(r, 900));
}

/** גלילה הדרגתית לאורך כל העמוד — פריים-פריים, כמו אצבע רציפה. */
export const SCROLL_ALL = async (step = 14) => {
  if (window.__lenis) window.__lenis.stop();
  const total = document.documentElement.scrollHeight - innerHeight;
  for (let y = 0; y <= total; y += step) {
    scrollTo(0, y);
    if (window.ScrollTrigger) ScrollTrigger.update();
    await new Promise((r) => requestAnimationFrame(r));
  }
};
