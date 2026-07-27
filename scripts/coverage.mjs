#!/usr/bin/env node
/**
 * coverage.mjs — כיסוי קוד אמיתי של js/ (פריט 30).
 *
 * לא c8 (הקוד רץ בדפדפן, לא ב-node) — אלא Coverage API של כרום על מסע
 * שימוש מלא: גלילה עד הסוף, תפריט, נשימה, דילוג, resize — בדסקטופ
 * ובמובייל, והאיחוד נמדד. שורה שלא רצה באף תרחיש = או קוד מת או תרחיש
 * שחסר לבדיקה; שני המקרים שווים בדיקה אנושית.
 *
 * שימוש:  npm run coverage
 */
import puppeteer from 'puppeteer-core';
import { chromePath, serveRepo, ready, pad } from './lib/env.mjs';

const THRESHOLD = 60; // אחוז כיסוי מינימלי לקובצי הבית שלנו

const site = await serveRepo();
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new' });

// צובר טווחים-בשימוש לכל קובץ, מאוחד בין תרחישים
const used = new Map(); // url → Set of "s-e"
const totals = new Map(); // url → length

const journey = async (mobile) => {
  const page = await browser.newPage();
  await page.setViewport(mobile
    ? { width: 390, height: 844, isMobile: true, hasTouch: true }
    : { width: 1440, height: 900 });
  if (mobile) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 60000 });
  await ready(page, { frames: !mobile });

  await page.evaluate(async () => {
    // מסע: גלילה מלאה ובחזרה
    if (window.__lenis) window.__lenis.stop();
    const total = document.documentElement.scrollHeight - innerHeight;
    for (let y = 0; y <= total; y += 160) {
      scrollTo(0, y);
      if (window.ScrollTrigger) ScrollTrigger.update();
      await new Promise((r) => requestAnimationFrame(r));
    }
    scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
    // תפריט: פתיחה, Escape
    const burger = document.getElementById('navBurger');
    if (burger) {
      burger.click();
      await new Promise((r) => setTimeout(r, 250));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }
    // נשימה: התחלה (בלי לחכות לסוף — מכסה את מסלול ההפעלה)
    document.getElementById('breathStart')?.click();
    await new Promise((r) => setTimeout(r, 400));
  });
  // resize — מסלולי rebuild
  await page.setViewport(mobile
    ? { width: 390, height: 700, isMobile: true, hasTouch: true }
    : { width: 1200, height: 800 });
  await new Promise((r) => setTimeout(r, 600));

  const cov = await page.coverage.stopJSCoverage();
  for (const entry of cov) {
    if (!/\/js\/(motion|main)\.js/.test(entry.url)) continue;
    const key = entry.url.split('/').pop().split('?')[0];
    totals.set(key, entry.text.length);
    if (!used.has(key)) used.set(key, []);
    used.get(key).push(...entry.ranges);
  }
  await page.close();
};

await journey(false);
await journey(true);
await browser.close();
await site.close();

let failed = false;
console.log(pad('קובץ', 14) + pad('בייטים', 10) + pad('בשימוש', 10) + 'כיסוי (מסע מאוחד, 2 מכשירים)');
console.log('─'.repeat(58));
for (const [file, len] of totals) {
  // איחוד טווחים
  const ranges = used.get(file).sort((a, b) => a.start - b.start);
  let covered = 0, curS = -1, curE = -1;
  for (const r of ranges) {
    if (r.start > curE) { covered += Math.max(0, curE - curS); curS = r.start; curE = r.end; }
    else curE = Math.max(curE, r.end);
  }
  covered += Math.max(0, curE - curS);
  const pct = (covered / len) * 100;
  if (pct < THRESHOLD) failed = true;
  console.log(pad(file, 14) + pad(len, 10) + pad(covered, 10) +
    pct.toFixed(1) + '%' + (pct < THRESHOLD ? ` ✗ (סף ${THRESHOLD}%)` : ' ✓'));
}
console.log('\n' + (failed
  ? '✗ כיסוי מתחת לסף — או קוד מת או תרחיש חסר במסע'
  : '✓ הכיסוי מעל הסף בשני הקבצים'));
process.exit(failed ? 1 : 0);
