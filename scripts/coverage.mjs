#!/usr/bin/env node
/**
 * coverage.mjs — כיסוי קוד אמיתי של js/ (פריט 30; הורחב 28.7 — ליטוש כיסוי).
 *
 * לא c8 (הקוד רץ בדפדפן, לא ב-node) — אלא Coverage API של כרום על מסע
 * שימוש מלא. שורה שלא רצה באף תרחיש = או קוד מת או תרחיש שחסר לבדיקה;
 * שני המקרים שווים בדיקה אנושית.
 *
 * המסע (אחרי ניתוח הפערים של 28.7 — כל שלב סוגר פער שנמדד בפועל):
 *   דסקטופ (תנועה מלאה): גלילה מלאה · עכבר אמיתי (cursor-dot + הכפתור
 *   המגנטי .btn-primary/.btn-ghost) · קליק-עוגן + Back (‏popstate) ·
 *   נשימה בתנועה מלאה (בניית ה-timeline) · תפריט + לכידת פוקוס
 *   (Tab/Shift+Tab) + Escape · קליק-אינסטגרם (מעקב outbound) · חציית
 *   breakpoint‏ 900 (וילון worlds — שני האגפים) · חלון 1800 גובה (ערימת
 *   הקלפים B1 — הדלקה וכיבוי) · טעינה שנייה: שהות בראש הצלילה עד שכפתור
 *   הדילוג מופיע (‏2.5ש'), מעבר מלא דרכה, ולחיצת דילוג אמיתית.
 *   מובייל (מופחת-תנועה, נטען עם ‎#hash): גלילה · תפריט · "לראש העמוד"
 *   בלי Lenis · נשימה מלאה עד "סיימתם" (~26ש' — שלושת הסבבים והסיום).
 *
 * מה נשאר לא-מכוסה בכוונה (fallback-ים שסביבת localhost לא מפעילה):
 *   תאי-קריסה (מכוסים ב-npm run faults) · ענף afterReveal האיטי (מרוץ
 *   רשת — בlocalhost התמונה תמיד מקדימה את ה-JS) · כשל בדיקת-השקיפות
 *   של וידאו הלוגו וחסימת ניגון · fallback ל-ScrollTrigger כש-IO חסר ·
 *   מאזיני load/error של תמונת הגיבוי (מרוץ רשת) · getter הדיבוג של
 *   הצלילה. ושני ממצאי קוד-מת שאותרו ולא נמחקו (מחיקה = החלטת OC):
 *   ‏splitChars ב-motion.js (שריד מהאינטרו הישן — אין לו קורא) והענף
 *   המתגונן של `.statement .label` (האלמנט לא קיים ב-HTML).
 *
 * שימוש:  npm run coverage
 */
import puppeteer from 'puppeteer-core';
import { chromePath, serveRepo, ready, pad } from './lib/env.mjs';

// הועלה 60→80 אחרי ליטוש המסע (28.7): נמדד ‏94.6/93.4 — סף 80 משאיר
// ~14 נק' מרווח לרעש, ותופס כל ריקון-מסע או נפילת-פיצ'ר גדולה.
const THRESHOLD = 80; // אחוז כיסוי מינימלי לקובצי הבית שלנו

const site = await serveRepo();
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new' });

// צובר טווחים-בשימוש לכל קובץ, מאוחד בין תרחישים
const used = new Map(); // url → Set of "s-e"
const totals = new Map(); // url → length

const collect = async (page) => {
  const cov = await page.coverage.stopJSCoverage();
  for (const entry of cov) {
    if (!/\/js\/(motion|main)\.js/.test(entry.url)) continue;
    const key = entry.url.split('/').pop().split('?')[0];
    totals.set(key, entry.text.length);
    if (!used.has(key)) used.set(key, []);
    used.get(key).push(...entry.ranges);
  }
};

const desktopJourney = async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 60000 });
  await ready(page, { frames: true });

  // עכבר אמיתי — cursor-dot (מעל קישור ומעל שטח מת) — לפני עצירת Lenis
  await page.mouse.move(300, 300);
  await page.mouse.move(720, 60);   // מעל הניווט (interactive → scale)
  await page.mouse.move(500, 500);
  await page.evaluate(() => {
    // mouseleave של החלון — הנקודה נעלמת
    const ev = new Event('mouseleave', { bubbles: false });
    document.documentElement.dispatchEvent(ev);
    document.dispatchEvent(new Event('mouseleave'));
  });

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
  });

  // הכפתור המגנטי — כפתור *נראה* (הראשון ב-DOM יושב בתפריט הסגור ורוחבו
  // אפס), עכבר אמיתי מעליו + דיספץ' סינתטי כגיבוי לשכבות-על
  const btnBox = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.btn-primary, .btn-ghost')];
    const btn = btns.find((b) => b.getBoundingClientRect().width > 0);
    if (!btn) return null;
    btn.scrollIntoView({ block: 'center' });
    if (window.ScrollTrigger) ScrollTrigger.update();
    const r = btn.getBoundingClientRect();
    btn.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + 10, clientY: r.top + 8, bubbles: true }));
    btn.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (btnBox) {
    await page.mouse.move(btnBox.x - 20, btnBox.y - 6);
    await page.mouse.move(btnBox.x + 14, btnBox.y + 4);
    await page.mouse.move(btnBox.x, btnBox.y);
  }

  // עוגנים + היסטוריה: קליק על קישור-עוגן (‏pushState + ‏scrollToHash),
  // ואז Back (‏popstate). ‏Lenis חייב לרוץ — לקח ה-e2e.
  await page.evaluate(async () => {
    if (window.__lenis) window.__lenis.start();
    const link = document.querySelector('a[href="#program"], a[href^="#"]:not([href="#"])');
    if (link) link.click();
    await new Promise((r) => setTimeout(r, 1500));
    history.back();
    await new Promise((r) => setTimeout(r, 1500));
  });

  // נשימה בתנועה מלאה — בניית ה-timeline של הסבב (הסיום המלא רץ במובייל)
  await page.evaluate(async () => {
    document.getElementById('breathStart')?.click();
    await new Promise((r) => setTimeout(r, 2000));
  });

  // תפריט: פתיחה, לכידת פוקוס (Tab בקצוות — עטיפה לשני הכיוונים), Escape.
  // וגם קליק-אינסטגרם למעקב outbound — הניווט עצמו נבלם.
  await page.evaluate(async () => {
    const burger = document.getElementById('navBurger');
    if (burger) {
      burger.click();
      await new Promise((r) => setTimeout(r, 250));
      const menu = document.getElementById('mobileMenu');
      const links = menu ? menu.querySelectorAll('a') : [];
      if (links.length) {
        links[links.length - 1].focus();
        links[links.length - 1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        links[0].focus();
        links[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
      }
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
    }
    const insta = document.querySelector('a[href*="instagram"]');
    if (insta) {
      document.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true });
      insta.click();
    }
  });

  // חציית ה-breakpoint של worlds (‏900px): ההצרה מריצה את אגף המובייל
  // של matchMedia + ה-cleanup של הבמה הנעוצה; ההרחבה בונה מחדש.
  await page.setViewport({ width: 800, height: 900 });
  await new Promise((r) => setTimeout(r, 600));

  // ערימת הקלפים (‏B1): נכנסת רק כשהקלף הגבוה ביותר נכנס במלואו בגובה
  // החלון (‏tallest + ~156px). ב-900 היא לעולם לא נדלקת, וגם 1300 לא
  // הספיק בפועל — 1800 מדליק אותה, והגלילה מפעילה את ערימת העמעום.
  await page.setViewport({ width: 1440, height: 1800 });
  await new Promise((r) => setTimeout(r, 700));
  await page.evaluate(async () => {
    const prog = document.getElementById('program');
    if (!prog) return;
    const to = prog.offsetTop + prog.offsetHeight;
    for (let y = Math.max(0, prog.offsetTop - 200); y <= to; y += 220) {
      scrollTo(0, y);
      if (window.ScrollTrigger) ScrollTrigger.update();
      await new Promise((r) => requestAnimationFrame(r));
    }
  });

  // ההצרה חזרה — הערימה כבה (מסלול הכיבוי) + rebuild של התצפיתנים
  await page.setViewport({ width: 1200, height: 800 });
  await new Promise((r) => setTimeout(r, 600));

  await collect(page);
  await page.close();
};

// כפתור הדילוג באמת: הטיימר (‏2.5ש') נדרך באתחול העמוד ומציג את הכפתור
// רק אם עוד לא צללנו — לכן עמוד נפרד (ניווט בתוך עמוד מאפס את צבירת
// הכיסוי גם עם resetOnNavigation:false — נמדד): שהות בראש הצלילה, מעבר
// מלא דרכה (הכפתור נעלם אחרי ‎p>0.8), חזרה לאמצע — ולחיצה אמיתית.
const diveSkipJourney = async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 60000 });
  await ready(page, { frames: true });
  await new Promise((r) => setTimeout(r, 2900));
  await page.evaluate(async () => {
    if (window.__lenis) window.__lenis.stop();
    const dive = document.querySelector('.dive');
    if (dive) {
      const end = dive.offsetTop + dive.offsetHeight - innerHeight;
      for (let y = 0; y <= end; y += 140) {
        scrollTo(0, y);
        if (window.ScrollTrigger) ScrollTrigger.update();
        await new Promise((r) => requestAnimationFrame(r));
      }
      scrollTo(0, dive.offsetTop + dive.offsetHeight * 0.3);
      if (window.ScrollTrigger) ScrollTrigger.update();
      await new Promise((r) => setTimeout(r, 300));
    }
    if (window.__lenis) window.__lenis.start();
    document.getElementById('diveSkip')?.click();
    await new Promise((r) => setTimeout(r, 1600));
  });
  await collect(page);
  await page.close();
};

const mobileJourney = async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  // נטען עם ‎#hash — מסלול הגלילה-לעוגן שבטעינה
  await page.goto(site.url + '#program', { waitUntil: 'networkidle2', timeout: 60000 });
  await ready(page);

  await page.evaluate(async () => {
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
    // "לראש העמוד" בלי Lenis (מופחת-תנועה) — ענף ה-scrollTo הישיר
    const topLink = document.querySelector('a[href="#top"]');
    if (topLink) {
      topLink.click();
      await new Promise((r) => setTimeout(r, 400));
    }
  });

  // נשימה מלאה: שלושת הסבבים עד "סיימתם" (~8.7ש' לסבב) — מכסה את כל
  // שלבי ההנחיה, את finish() ואת איפוס הכפתור. המתנה אמיתית, לא האצה —
  // כדי שהמסע יישאר נאמן למכונת הזמנים שבקוד.
  await page.evaluate(async () => {
    const start = document.getElementById('breathStart');
    if (!start) return;
    start.click();
    await new Promise((r) => setTimeout(r, 28000));
  });

  // resize — מסלולי rebuild
  await page.setViewport({ width: 390, height: 700, isMobile: true, hasTouch: true });
  await new Promise((r) => setTimeout(r, 600));

  await collect(page);
  await page.close();
};

await desktopJourney();
await diveSkipJourney();
await mobileJourney();
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
