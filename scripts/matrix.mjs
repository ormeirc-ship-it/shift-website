#!/usr/bin/env node
/**
 * matrix.mjs — מטריצת מכשירים מדומה + גבהים קצרים (פריטים 28+29).
 *
 * לכל מכשיר: טעינה, גלילה מלאה, ואסרטות שאינן צילום-תלויות:
 *   · אין גלילה אופקית (עודף רוחב = שבירת RTL/פריסה)
 *   · הצלילה, הנשימה והקלפים לא נחתכים (הגובה נגיש, כפתורים ב-viewport)
 *   · כל ימי המסלול קריאים (הלוגיקה של overlap, על המכשיר הזה)
 *   · קונסול נקי
 * צילום נשמר ל-scratch לכל מכשיר — לעיון, לא ל-baseline.
 *
 * שימוש:  npm run matrix
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { chromePath, serveRepo, ready, pad } from './lib/env.mjs';

const SHOTS_DIR = process.env.MATRIX_SHOTS ||
  '/private/tmp/claude-501/-Users-ormeircohen-Desktop/bb650e24-85c2-46a6-9039-bbd60cfb1362/scratchpad/matrix';
mkdirSync(SHOTS_DIR, { recursive: true });

const DEVICES = [
  { name: 'iPhone-SE', w: 375, h: 667, mobile: true },
  { name: 'iPhone-12', w: 390, h: 844, mobile: true },
  { name: 'iPhone-15Pro', w: 393, h: 852, mobile: true },
  { name: 'Pixel-7', w: 412, h: 915, mobile: true },
  { name: 'iPad-portrait', w: 810, h: 1080, mobile: true },
  { name: 'iPad-landscape', w: 1080, h: 810, mobile: true },
  { name: 'mobile-landscape', w: 844, h: 390, mobile: true },
  // רצועת 900–1100 — הנקודה שבה וידאו-העיניים (‏40vw) פוגש את הכותרת;
  // סומנה כשטח-עיוור ע"י Cowork ‏28.7 ‏12:05 ונכנסה למטריצה דרך-קבע
  { name: 'narrow-desktop-1000', w: 1000, h: 800 },
  { name: 'laptop-short-600', w: 1280, h: 600 },
  { name: 'laptop-short-700', w: 1440, h: 700 },
  { name: 'desktop-1920', w: 1920, h: 1080 },
  { name: 'desktop-2560', w: 2560, h: 1440 },
];

const site = await serveRepo();
const browser = await puppeteer.launch({
  executablePath: chromePath(), headless: 'new',
  args: ['--hide-scrollbars', '--force-device-scale-factor=1'],
});

let failures = 0;
console.log(pad('מכשיר', 20) + pad('רוחב×גובה', 12) + pad('אופקי', 7) + pad('צלילה', 7) +
  pad('נשימה', 7) + pad('קלפים', 7) + pad('ימים', 7) + 'קונסול');
console.log('─'.repeat(74));

for (const d of DEVICES) {
  const page = await browser.newPage();
  await page.setViewport({ width: d.w, height: d.h, isMobile: !!d.mobile, hasTouch: !!d.mobile });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 90000 });
  await ready(page);
  await page.evaluate(() => document.fonts.ready);

  const r = await page.evaluate(async () => {
    if (window.__lenis) window.__lenis.stop();
    // גלילה מלאה כדי שכל הטריגרים יירו
    const total = document.documentElement.scrollHeight - innerHeight;
    for (let y = 0; y <= total; y += Math.max(90, innerHeight / 8)) {
      scrollTo(0, y);
      if (window.ScrollTrigger) ScrollTrigger.update();
      await new Promise((res) => requestAnimationFrame(res));
    }
    await new Promise((res) => setTimeout(res, 500));

    const out = {};
    // 1. אין גלילה אופקית
    out.noHScroll = document.documentElement.scrollWidth <= innerWidth + 1;

    // 2. הצלילה: הדבקית ממלאת את המסך והדילוג נגיש
    const sticky = document.querySelector('.dive-sticky');
    out.dive = !!sticky && Math.abs(sticky.getBoundingClientRect().height - innerHeight) < innerHeight * 0.25;

    // 3. הנשימה: הכפתור והעיגול נראים יחד באיזשהו מצב גלילה
    const breath = document.getElementById('breath');
    const btn = document.getElementById('breathStart');
    if (breath && btn) {
      breath.scrollIntoView({ block: 'center' });
      await new Promise((res) => setTimeout(res, 250));
      const rb = btn.getBoundingClientRect();
      const rc = document.getElementById('breathCircle').getBoundingClientRect();
      out.breath = rb.top >= 0 && rb.bottom <= innerHeight && rc.top >= -8;
    } else out.breath = false;

    // 4. קלפי המסלול: כל קלף נכנס לרוחב, ואם יש ערימה — הקלף לא גבוה מהחלון
    const cards = [...document.querySelectorAll('.week-card')];
    out.cards = cards.length === 3 && cards.every((c) => {
      const rr = c.getBoundingClientRect();
      return rr.width <= innerWidth + 1 &&
        (!document.documentElement.classList.contains('stack-on') || rr.height < innerHeight);
    });

    // 5. כל 21 הימים קיימים וקריאים (רוחב טקסט לא נחתך)
    const days = [...document.querySelectorAll('.day-item')];
    out.days = days.length === 21 && days.every((el) => el.getBoundingClientRect().width > 100);

    scrollTo(0, 0);
    return out;
  });

  await page.screenshot({ path: `${SHOTS_DIR}/${d.name}.png` });
  const clean = consoleErrors.length === 0;
  const ok = r.noHScroll && r.dive && r.breath && r.cards && r.days && clean;
  if (!ok) failures++;
  const m = (v) => (v ? '✓' : '✗');
  console.log(pad(d.name, 20) + pad(d.w + '×' + d.h, 12) + pad(m(r.noHScroll), 7) +
    pad(m(r.dive), 7) + pad(m(r.breath), 7) + pad(m(r.cards), 7) + pad(m(r.days), 7) +
    (clean ? '✓' : '✗ ' + consoleErrors[0]?.slice(0, 40)));
  await page.close();
}

await browser.close();
await site.close();
console.log('\n' + (failures ? `✗ ${failures} מכשירים עם ממצאים` : `✓ כל ${DEVICES.length} המכשירים נקיים`) +
  ` · צילומים: ${SHOTS_DIR}`);
process.exit(failures ? 1 : 0);
