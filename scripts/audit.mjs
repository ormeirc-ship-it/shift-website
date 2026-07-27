#!/usr/bin/env node
/**
 * audit.mjs — מעבר בדיקה: רוחבי מסך, קונסול, מקלדת, reduced-motion, בלי JS.
 * יוצא עם קוד שגיאה בכל כשל — מתאים ל-CI.
 * שימוש:  npm run audit   ·   node scripts/audit.mjs --json
 */
import puppeteer from 'puppeteer-core';
import { chromePath, serveRepo, ready, SCROLL_ALL, pad } from './lib/env.mjs';

const JSON_OUT = process.argv.includes('--json');
const site = await serveRepo();
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new' });
const out = { widths: {}, keyboard: null, reducedMotion: null, noJs: null };
const fails = [];

for (const w of [360, 390, 768, 1440]) {
  const page = await browser.newPage();
  const errs = [], warns = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text());
    if (m.type() === 'warning') warns.push(m.text());
  });
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.setViewport({ width: w, height: 800 });
  await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 60000 });
  await ready(page);
  await page.evaluate(async (src) => (new Function('return ' + src)())(), SCROLL_ALL.toString());
  await new Promise((r) => setTimeout(r, 500));
  const r = await page.evaluate(() => ({
    overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    longLines: [...document.querySelectorAll('p')].filter((p) => {
      const t = p.textContent.trim();
      if (t.length < 40) return false;
      const fs = parseFloat(getComputedStyle(p).fontSize);
      return p.getBoundingClientRect().width / (fs * 0.5) > 78;
    }).length,
  }));
  r.errors = errs; r.warnings = warns.filter((x) => !/Lenis|deprecat/i.test(x));
  out.widths[w] = r;
  if (r.overflowX) fails.push(`${w}px: גלישה רוחבית ${r.overflowX}px`);
  if (errs.length) fails.push(`${w}px: ${errs.length} שגיאות קונסול`);
  if (r.warnings.length) fails.push(`${w}px: ${r.warnings.length} אזהרות קונסול`);
  await page.close();
}

{ // מקלדת
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(site.url, { waitUntil: 'networkidle2' });
  await ready(page, { frames: false });
  const seq = [];
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press('Tab');
    seq.push(await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return null;
      const cs = getComputedStyle(a);
      return { tag: a.tagName.toLowerCase(),
        text: (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 24),
        hasOutline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 };
    }));
  }
  out.keyboard = seq.filter(Boolean);
  const noRing = out.keyboard.filter((k) => !k.hasOutline);
  if (noRing.length) fails.push(`מקלדת: ${noRing.length} אלמנטים בלי סימון פוקוס`);
  await page.close();
}

{ // reduced motion
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(site.url, { waitUntil: 'networkidle2' });
  await ready(page, { frames: false });
  out.reducedMotion = await page.evaluate(() => {
    const vis = (s) => { const e = document.querySelector(s); if (!e) return null;
      const cs = getComputedStyle(e);
      return e.getBoundingClientRect().height > 0 && cs.visibility !== 'hidden' && +cs.opacity > 0.05; };
    const arr = document.getElementById('diveArrival');
    return {
      arrivalVisible: +getComputedStyle(arr).opacity > 0.9,
      gateHidden: getComputedStyle(document.getElementById('diveGate')).display === 'none',
      sections: ['#products', '#method', '#breathe', '#program', '#events', '#story', '.closing'].map(vis),
    };
  });
  if (!out.reducedMotion.arrivalVisible) fails.push('reduced-motion: הכותרת בהגעה לא גלויה');
  if (out.reducedMotion.sections.some((v) => v !== true)) fails.push('reduced-motion: סקשן נסתר');
  await page.close();
}

{ // בלי JS
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(site.url, { waitUntil: 'networkidle2' });
  out.noJs = {
    headings: await page.$$eval('h1, h2, h3', (e) => e.length),
    stillVisible: await page.$eval('.dive-still', (e) => getComputedStyle(e).display !== 'none').catch(() => false),
  };
  if (out.noJs.headings < 20) fails.push('בלי JS: פחות מ-20 כותרות גלויות');
  if (!out.noJs.stillVisible) fails.push('בלי JS: תמונת הגיבוי של הצלילה לא מוצגת');
  await page.close();
}

await browser.close();
await site.close();

if (JSON_OUT) { console.log(JSON.stringify(out, null, 1)); process.exit(fails.length ? 1 : 0); }
for (const [w, r] of Object.entries(out.widths)) {
  console.log(`${pad(w + 'px', 8)} גלישה=${r.overflowX}  שורות-ארוכות=${r.longLines}  שגיאות=${r.errors.length}  אזהרות=${r.warnings.length}`);
}
console.log(`\nמקלדת: ${out.keyboard.length} עצירות, כולן עם סימון פוקוס: ${out.keyboard.every((k) => k.hasOutline) ? 'כן' : 'לא'}`);
console.log(`reduced-motion: כותרת גלויה=${out.reducedMotion.arrivalVisible} · שער מוסתר=${out.reducedMotion.gateHidden} · סקשנים=${out.reducedMotion.sections.filter(Boolean).length}/${out.reducedMotion.sections.length}`);
console.log(`בלי JS: ${out.noJs.headings} כותרות · תמונת גיבוי=${out.noJs.stillVisible}`);
console.log('\n' + (fails.length ? '✗ כשלים:\n  · ' + fails.join('\n  · ') : '✓ הכול עבר'));
process.exit(fails.length ? 1 : 0);
