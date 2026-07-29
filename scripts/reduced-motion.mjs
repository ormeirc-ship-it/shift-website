#!/usr/bin/env node
/**
 * reduced-motion.mjs — פריט T4.
 * הכלל: אפקט שלא רץ ומשאיר תוכן נסתר הוא באג חמור, לא ליטוש.
 * לכן הבדיקה כאן אינה "האם האנימציה כבויה" אלא "האם התוכן שהאנימציה
 * הייתה אמורה לחשוף — נראה בפועל".
 */
import puppeteer from 'puppeteer-core';
import { chromePath, serveRepo, ready, pad } from './lib/env.mjs';

// כל אפקט: מה הוא חושף, ואיך נראית החלופה השקטה
const EFFECTS = [
  ['הצלילה אל המוח', '#diveArrival h1'],
  ['תת-כותרת ההגעה', '.arrival-sub'],
  ['כפתורי ההגעה', '.arrival-ctas .btn'],
  ['ההצהרה', '.statement-title'],
  ['טקסט ההצהרה', '.statement-text'],
  ['סל המוצרים', '#products .basket-card'],
  ['כותרות סקשנים', '#method .section-head h2'],
  ['שקופיות העולמות', '.world-slide'],
  ['טריפטיך ההרגלים', '.tri'],
  ['סקשן הנשימה', '#breathe .breath'],
  ['ארבעת הצעדים', '.step'],
  ['שבועות המסלול', '.week-card'],
  ['שורות הימים', '.day-item'],
  ['כרטיסי האירועים', '.event-card'],
  ['הסיפור', '.story-body blockquote'],
  ['הצ׳יפים', '.chips li'],
  ['כרטיס האהבה', '.love-card'],
  ['סצנת הסיום', '.cta-content h2'],
  ['מילת הסיום', '.closing-word'],
  ['הפוטר', '.footer-links'],
];

const site = await serveRepo();
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 60000 });
await ready(page, { frames: false });

// גלילה מלאה — במצב שקט אין טריגרים, אבל אם משהו תלוי בהם זה ייחשף כאן
await page.evaluate(async () => {
  const total = document.documentElement.scrollHeight - innerHeight;
  for (let y = 0; y <= total; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 15)); }
  scrollTo(0, 0);
});
await new Promise((r) => setTimeout(r, 800));

const rows = await page.evaluate((effects) => effects.map(([label, sel]) => {
  const els = [...document.querySelectorAll(sel)];
  if (!els.length) return { label, sel, found: 0, visible: 0, note: 'לא נמצא' };
  let visible = 0;
  els.forEach((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const ok = +cs.opacity > 0.05 && cs.visibility !== 'hidden' && cs.display !== 'none' &&
      (r.width > 0 || r.height > 0);
    if (ok) visible++;
  });
  return { label, sel, found: els.length, visible };
}), EFFECTS);

// אין אנימציות רצות
const anim = await page.evaluate(() => {
  const running = document.getAnimations ? document.getAnimations().filter((a) => a.playState === 'running') : [];
  return { count: running.length, sample: running.slice(0, 3).map((a) => (a.effect && a.effect.target && a.effect.target.className) || '?') };
});

// לוגו ההגעה — בדיוק אחד גלוי, והוא הכהה (רגרסיית 0.5 סיבוב ב': סדר-קסקדה
// הדליק את שניהם יחד. הבדיקה על ה-computed, לא על הקוד — תופסת כל גלגול עתידי)
const logos = await page.evaluate(() => {
  const vis = (el) => el && getComputedStyle(el).display !== 'none';
  return {
    dark: vis(document.querySelector('.arrival-logo-dark')),
    light: vis(document.querySelector('.arrival-logo-light')),
  };
});
await browser.close();
await site.close();

const bad = rows.filter((r) => r.found === 0 || r.visible < r.found);
console.log(pad('אפקט', 24) + pad('נמצאו', 8) + pad('גלויים', 8) + 'סטטוס');
console.log('─'.repeat(56));
rows.forEach((r) => console.log(pad(r.label, 24) + pad(r.found, 8) + pad(r.visible, 8) +
  (r.found === 0 ? '✗ ' + (r.note || '') : r.visible === r.found ? '✓' : '✗ תוכן נסתר')));
console.log(`\nאנימציות שרצות במצב שקט: ${anim.count}` + (anim.count ? ' — ' + anim.sample.join(', ') : ' ✓'));
const logoOk = !logos.dark && logos.light;
console.log('לוגו ההגעה במצב שקט: ' + (logoOk ? '✓ רק הבהיר (הנייבי)' :
  `✗ dark=${logos.dark} light=${logos.light} — חייב בדיוק אחד (הבהיר)`));
console.log('\n' + (bad.length || !logoOk ? `✗ ${bad.length + (logoOk ? 0 : 1)} כשלים במצב מופחת-תנועה` : '✓ כל התוכן נגיש במצב מופחת-תנועה'));
process.exit(bad.length || !logoOk ? 1 : 0);
