#!/usr/bin/env node
/**
 * vr.mjs — רגרסיה ויזואלית (פריט 9).
 *
 * מצלם סט קבוע של מצבים ומשווה פיקסל-פיקסל ל-baseline ב-tests/vr-baseline/.
 * שינוי מעל הסף = כישלון — כדי ששינוי ויזואלי לא-מכוון לא יעבור בשקט.
 * ה-baseline מתעדכן אך ורק במפורש:
 *
 *   npm run vr          השוואה מול ה-baseline (נכשל על סטייה >1.5% בצילום)
 *   npm run vr:accept   צילום מחדש ואימוץ כ-baseline החדש
 *
 * דטרמיניזם: אנימציות CSS מנוטרלות (animation:none — מצב התחלתי קבוע),
 * Lenis נעצר, הגלילה הדרגתית כדי ש-ScrollTrigger יירה כמו אצל מבקר אמיתי,
 * והצילום אחרי השהיית התייצבות. הסף 1.5% + סובלנות ערוץ 24 סופגים רעש
 * דחיסה ו-AA; שינוי עיצובי אמיתי גדול מזה בסדרי גודל.
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, chromePath, serveRepo, ready, pad } from './lib/env.mjs';
import { comparePNG } from './lib/png.mjs';

const ACCEPT = process.argv.includes('--accept');
const BASE = join(ROOT, 'tests/vr-baseline');
const CUR = join(ROOT, '.vr/current');
mkdirSync(BASE, { recursive: true });
mkdirSync(CUR, { recursive: true });

// הסט: לכל viewport — ראש העמוד + הסקשנים שמכסים את מרחב העיצוב
// (כהה, מעבר כהה→בהיר, קלפים, סיפור, סגירה).
const SETS = [
  // ‏arrival = תחתית הצלילה (מצב הווילון החי של B3); ‏events = הכרטיסיות
  // עם משבצות-המקום — שניהם נוספו בלולאת-הרקע של 28.7 אחרי שהתברר שהסט
  // המקורי לא מכסה אותם
  { tag: 'd', w: 1440, h: 900, targets: ['top', 'dive-end', '.statement', '#method', '#program', '#events', '#story', '.closing'] },
  { tag: 'm', w: 390, h: 844, mobile: true, targets: ['top', '#program', '#breathe', '#events', '.closing'] },
];
const THRESHOLD = 1.5;

const site = await serveRepo();
const browser = await puppeteer.launch({
  executablePath: chromePath(), headless: 'new',
  args: ['--hide-scrollbars', '--force-device-scale-factor=1'],
});

const shots = [];
for (const set of SETS) {
  const page = await browser.newPage();
  await page.setViewport({ width: set.w, height: set.h, isMobile: !!set.mobile, hasTouch: !!set.mobile });
  await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 60000 });
  await ready(page);
  await page.evaluate(async () => {
    if (window.__lenis) window.__lenis.stop();
    const s = document.createElement('style');
    s.textContent = '*,*::before,*::after{animation:none!important;caret-color:transparent!important}';
    document.head.appendChild(s);
    await document.fonts.ready;
  });
  for (const target of set.targets) {
    await page.evaluate(async (sel) => {
      const to = sel === 'top' ? 0
        : sel === 'dive-end'
          ? (() => { const d = document.querySelector('.dive'); return d.offsetTop + d.offsetHeight - innerHeight; })()
          : (document.querySelector(sel)?.getBoundingClientRect().top ?? 0) + scrollY;
      // הדרגתי כדי שכל טריגר בדרך יירה; 120px לצעד = מהיר אבל לא קפיצה
      const from = scrollY, dist = to - from, steps = Math.max(1, Math.ceil(Math.abs(dist) / 120));
      for (let i = 1; i <= steps; i++) {
        scrollTo(0, from + (dist * i) / steps);
        if (window.ScrollTrigger) ScrollTrigger.update();
        await new Promise((r) => requestAnimationFrame(r));
      }
    }, target);
    await new Promise((r) => setTimeout(r, 1100));
    // דטרמיניזם וידאו: המנוע מנגן את וידאו-האירועים כשהוא נגלה (IO in
    // motion.js) — בלי קיבוע לפריים 0, כל צילום תופס פריים אקראי
    // (נמדד 28.7: ‏6.5% סטייה על d-events בלי שום שינוי קוד).
    await page.evaluate(async () => {
      for (const v of document.querySelectorAll('video')) {
        try {
          v.pause();
          if (v.readyState >= 1 && v.currentTime !== 0) {
            await new Promise((res) => {
              v.addEventListener('seeked', res, { once: true });
              v.currentTime = 0;
              setTimeout(res, 300);
            });
          }
        } catch (e) { /* וידאו בלי מקור — לא מעניין */ }
      }
    });
    await new Promise((r) => setTimeout(r, 150));
    const name = `${set.tag}-${target.replace(/[#.]/g, '')}.png`;
    await page.screenshot({ path: join(CUR, name) });
    shots.push(name);
  }
  await page.close();
}
await browser.close();
await site.close();

if (ACCEPT) {
  for (const name of shots) copyFileSync(join(CUR, name), join(BASE, name));
  // ניקוי baseline יתום — צילום שהוסר מהסט לא נשאר לרפאים
  for (const f of readdirSync(BASE)) if (!shots.includes(f)) console.log('⚠ baseline יתום (לא בסט):', f);
  console.log(`✓ ה-baseline אומץ: ${shots.length} צילומים → tests/vr-baseline/`);
  process.exit(0);
}

let failed = 0, missing = 0;
console.log('\n' + pad('צילום', 20) + pad('סטייה', 10) + 'מצב');
console.log('─'.repeat(46));
for (const name of shots) {
  const basePath = join(BASE, name);
  if (!existsSync(basePath)) {
    missing++;
    console.log(pad(name, 20) + pad('—', 10) + '⚠ אין baseline');
    continue;
  }
  const r = comparePNG(readFileSync(basePath), readFileSync(join(CUR, name)));
  if (r.sizeMismatch) {
    failed++;
    console.log(pad(name, 20) + pad('—', 10) + `✗ גודל שונה (${r.a} מול ${r.b})`);
    continue;
  }
  const bad = r.diffPct > THRESHOLD;
  if (bad) failed++;
  console.log(pad(name, 20) + pad(r.diffPct.toFixed(2) + '%', 10) + (bad ? '✗ מעל הסף' : '✓'));
}
if (missing) console.log(`\n⚠ ${missing} צילומים בלי baseline — להריץ npm run vr:accept אחרי אימות ידני`);
if (failed) {
  console.log(`\n✗ ${failed} צילומים סטו מעל ${THRESHOLD}%. אם השינוי מכוון: npm run vr:accept`);
  console.log('  הצילומים הנוכחיים ב-.vr/current/ להשוואה ידנית');
  process.exit(1);
}
console.log(missing ? '\n⚠ עבר חלקית (חסר baseline)' : '\n✓ אין סטייה ויזואלית');
process.exit(missing ? 1 : 0);
