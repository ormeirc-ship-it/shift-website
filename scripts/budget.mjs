#!/usr/bin/env node
/**
 * budget.mjs — תקציב משקל (פריט TC).
 * בלי תקציב מפורש המשקל רק גדל, ואף אחד לא שם לב לרגע שבו זה קרה:
 * העמוד כבר גדל מ-1.49MB ל-3.3MB בסבב אחד.
 *
 * הסקריפט נכשל (קוד 1) בחריגה — מיועד לרוץ ב-CI ולפני מיזוג.
 * לעדכון מכוון של תקציב: לשנות כאן, עם הסבר בהודעת ה-commit.
 */
import puppeteer from 'puppeteer-core';
import { chromePath, serveRepo, ready, kb, pad } from './lib/env.mjs';

// התקציבים נגזרו מהמצב בפועל ב-27.7 ועוד מרווח קטן — הם נועדו לתפוס
// גדילה, לא לתאר יעד אידיאלי. תקציב שנקבע גבוה מדי לא שומר על כלום.
const BUDGET = {
  'מובייל 390': {
    critical: 170 * 1024,     // נמדד 152KB · מרווח ~12%
    // ‏29.7 (T14): הרצף הוחלף למקור ה-4K שבחר OC — ‏m ‏1.3→2.26MB (webp).
    // עדכון מכוון: נמדד 2172KB אחרי ההחלפה + ~12%. הקריטי לא זז.
    total: 2.4 * 1024 * 1024,
    js: 200 * 1024,
    css: 100 * 1024,          // כולל ה-CSS וקובצי הגופן של Google
    images: 120 * 1024,       // בלי רצף המוח
  },
  'דסקטופ 1440': {
    critical: 185 * 1024,     // נמדד 165KB · מרווח ~12%
    // ‏29.7 (T14): ‏d ‏1.9→3.25MB (webp) — עדכון מכוון באותו אישור
    total: 4.4 * 1024 * 1024,
    js: 200 * 1024,
    css: 100 * 1024,
    images: 120 * 1024,
  },
};

// "המסלול הקריטי" = מה שחייב להגיע כדי שהמבקר יראה משהו אמיתי.
// נמדד לפי זהות המשאב ולא לפי מרוץ תזמונים, כי על localhost הכול מגיע
// כמעט מיידית וכל מדידה מבוססת-זמן תחזיר את הכול או כלום.
const isCritical = (u) => /index\.html|\/$/.test(u) || /style\.css/.test(u) ||
  /fonts\.(googleapis|gstatic)/.test(u) || /brain-seq\/[dm]\/f001\.webp/.test(u);

const site = await serveRepo();
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new' });
const rows = [];
const fails = [];

for (const [label, width] of [['מובייל 390', 390], ['דסקטופ 1440', 1440]]) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 844 });
  let criticalBytes = 0;
  const by = { js: 0, css: 0, images: 0, seq: 0, other: 0 };
  let total = 0;

  page.on('response', async (res) => {
    try {
      const len = Number(res.headers()['content-length'] || 0);
      const size = len || await res.buffer().then((b) => b.length).catch(() => 0);
      const u = res.url();
      total += size;
      if (isCritical(u)) criticalBytes += size;
      if (/brain-seq/.test(u)) by.seq += size;
      else if (/\.js(\?|$)/.test(u)) by.js += size;
      else if (/\.css(\?|$)/.test(u) || /fonts\./.test(u)) by.css += size;
      else if (/\.(webp|jpe?g|png|svg)(\?|$)/i.test(u)) by.images += size;
      else by.other += size;
    } catch { /* התעלמות */ }
  });

  await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await ready(page);

  const b = BUDGET[label];
  const checks = [
    ['מסלול קריטי', criticalBytes, b.critical],
    ['סה"כ', total, b.total],
    ['JS', by.js, b.js],
    ['CSS+גופנים', by.css, b.css],
    ['תמונות (בלי הרצף)', by.images, b.images],
  ];
  checks.forEach(([name, got, cap]) => {
    rows.push({ label, name, got, cap, over: got > cap });
    if (got > cap) fails.push(`${label} · ${name}: ${kb(got)} מתוך ${kb(cap)} (חריגה של ${kb(got - cap)})`);
  });
  rows.push({ label, name: 'רצף המוח (ללא תקציב)', got: by.seq, cap: null, over: false });
  await page.close();
}

await browser.close();
await site.close();

let last = null;
for (const r of rows) {
  if (r.label !== last) { console.log(`\n=== ${r.label} ===`); last = r.label; }
  const status = r.cap === null ? '—' : (r.over ? '✗ חריגה' : '✓');
  console.log('  ' + pad(r.name, 22) + pad(kb(r.got), 9) +
    pad(r.cap === null ? '' : 'מתוך ' + kb(r.cap), 14) + status);
}
console.log('\n' + (fails.length
  ? '✗ חריגה מהתקציב:\n  · ' + fails.join('\n  · ')
  : '✓ הכול בתוך התקציב'));
process.exit(fails.length ? 1 : 0);
