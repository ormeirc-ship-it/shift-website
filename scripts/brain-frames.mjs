#!/usr/bin/env node
/**
 * brain-frames.mjs — חילוץ רצף פריימים מהמקור (T14, ‏28.7).
 *
 * אין ffmpeg בסביבה — החילוץ בכרום: ‏<video> נטען, ‏seek מדויק לכל
 * חותמת-זמן (אחיד על פני האורך), ציור לקנבס ברוחב היעד, ‏PNG master →
 * ‏sharp → ‏webp (+avif אופציונלי, באותם פרמטרים של avif.mjs כדי שהמדידה
 * תהיה ברת-השוואה). דטרמיניסטי: אותם ארגומנטים = אותם פריימים בדיוק.
 *
 * שימוש:
 *   node scripts/brain-frames.mjs --count 60 --width 1920 --out <dir> [--avif] [--webp-q 75] [--src <path-in-repo>]
 *
 * ‏--src ברירת-מחדל: המקור הישן; ל-T14 (29.7): ‏_build/brain-dive-4k.mp4
 * (גרסה B שבחר OC — ‏3840×2160, מחוץ ל-git, קישור ההורדה ב-NEXT).
 * הסטים החיים היום (לשחזור בעת החלפה): ‏d ‏60×900 · ‏m ‏65×640.
 * מועמדי מלוא-המקור (T14): ‏d ‏60×1920 · ‏m ‏65×1280.
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { chromePath, serveRepo, pad } from './lib/env.mjs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const COUNT = +arg('count', 60);
const WIDTH = +arg('width', 1920);
const OUT = arg('out', null);
const SRC = arg('src', 'assets/video/brain-intro-source.mp4');
const AVIF = process.argv.includes('--avif');
const WEBP_Q = +arg('webp-q', 75);
if (!OUT) { console.error('חסר --out'); process.exit(1); }

mkdirSync(OUT, { recursive: true });
if (AVIF) mkdirSync(OUT + '-avif', { recursive: true });

const site = await serveRepo();
const browser = await puppeteer.launch({
  executablePath: chromePath(), headless: 'new',
  args: ['--disable-web-security'], // canvas.toDataURL על וידאו same-origin — ליתר ביטחון
});
const page = await browser.newPage();
await page.goto(site.url + SRC, { waitUntil: 'domcontentloaded' });
const dur = await page.evaluate(() => new Promise((res) => {
  const v = document.querySelector('video');
  v.muted = true; v.pause();
  const done = () => res(v.duration);
  if (v.readyState >= 1) done(); else v.addEventListener('loadedmetadata', done, { once: true });
}));
const HEIGHT = Math.round(WIDTH * 9 / 16 / 2) * 2; // ‏16:9, זוגי
console.log(`מקור: ${dur.toFixed(2)}ש' → ${COUNT} פריימים ב-${WIDTH}×${HEIGHT}`);

let webpTotal = 0, avifTotal = 0;
for (let i = 1; i <= COUNT; i++) {
  // אחיד מ-0 עד כמעט-הסוף (הפריים האחרון מעט לפני duration — seek לסוף
  // המוחלט מחזיר לפעמים פריים שחור בקידודים מסוימים)
  const t = ((i - 1) / (COUNT - 1)) * Math.max(0, dur - 0.05);
  const dataUrl = await page.evaluate((tt, w, h) => new Promise((res, rej) => {
    const v = document.querySelector('video');
    const done = () => {
      try {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(v, 0, 0, w, h);
        res(c.toDataURL('image/png'));
      } catch (e) { rej(e.message); }
    };
    v.addEventListener('seeked', done, { once: true });
    v.currentTime = tt;
    setTimeout(done, 1200); // רשת ביטחון — אם seeked לא הגיע, מציירים מה שיש
  }), t, WIDTH, HEIGHT);
  const png = Buffer.from(dataUrl.split(',')[1], 'base64');
  const name = 'f' + String(i).padStart(3, '0');
  const webp = await sharp(png).webp({ quality: WEBP_Q, effort: 5 }).toBuffer();
  writeFileSync(join(OUT, name + '.webp'), webp);
  webpTotal += webp.length;
  if (AVIF) {
    const avif = await sharp(png).avif({ quality: 50, effort: 4 }).toBuffer();
    writeFileSync(join(OUT + '-avif', name + '.avif'), avif);
    avifTotal += avif.length;
  }
  if (i % 10 === 0 || i === COUNT) process.stdout.write(`  ${i}/${COUNT}\r`);
}
await browser.close();
await site.close();

console.log('\n' + pad('פורמט', 10) + pad('סה"כ', 12) + 'ממוצע/פריים');
console.log('─'.repeat(36));
console.log(pad('webp', 10) + pad((webpTotal / 1048576).toFixed(2) + 'MB', 12) + Math.round(webpTotal / COUNT / 1024) + 'KB');
if (AVIF) console.log(pad('avif', 10) + pad((avifTotal / 1048576).toFixed(2) + 'MB', 12) + Math.round(avifTotal / COUNT / 1024) + 'KB');
