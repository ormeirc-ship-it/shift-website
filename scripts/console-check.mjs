#!/usr/bin/env node
/**
 * console-check.mjs — קונסול נקי גם תחת אינטראקציה (פריט T3).
 * לא רק טעינה וגלילה: פותח תפריט, מפעיל את תרגיל הנשימה, לוחץ דילוג,
 * מנווט בעוגנים, ומשנה גודל — כל אלה מסלולים שלא נבדקו קודם.
 */
import puppeteer from 'puppeteer-core';
import { chromePath, serveRepo, ready, SCROLL_ALL } from './lib/env.mjs';

const site = await serveRepo();
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new' });
const page = await browser.newPage();
const msgs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) msgs.push({ t: m.type(), text: m.text(), at: 'טעינה' }); });
page.on('pageerror', (e) => msgs.push({ t: 'pageerror', text: e.message, at: 'טעינה' }));

let phase = 'טעינה';
const mark = (p) => { phase = p; };
page.on('console', () => {}); // ה-listener למעלה כבר אוסף
await page.setViewport({ width: 1440, height: 900 });
await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 60000 });
await ready(page);

const step = async (label, fn) => {
  const before = msgs.length;
  mark(label);
  await fn();
  await new Promise((r) => setTimeout(r, 700));
  msgs.slice(before).forEach((m) => { m.at = label; });
};

await step('גלילה מלאה', () => page.evaluate(async (s) => (new Function('return ' + s)())(), SCROLL_ALL.toString()));
await step('פתיחת תפריט', () => page.evaluate(() => document.getElementById('navBurger').click()));
await step('סגירת תפריט (Escape)', () => page.keyboard.press('Escape'));
await step('ניווט בעוגן', () => page.evaluate(() => {
  const a = [...document.querySelectorAll('.dot-nav a')].find((x) => x.getAttribute('href') === '#program');
  if (a) a.click();
}));
await step('תרגיל הנשימה', async () => {
  await page.evaluate(() => {
    const b = document.getElementById('breathStart');
    if (b) { b.scrollIntoView(); b.click(); }
  });
  await new Promise((r) => setTimeout(r, 9000));  // סבב שלם
});
await step('חזרה לראש + דילוג', () => page.evaluate(() => {
  scrollTo(0, 0);
  const s = document.getElementById('diveSkip');
  if (s) s.click();
}));
await step('שינוי גודל', async () => {
  await page.setViewport({ width: 390, height: 844 });
  await new Promise((r) => setTimeout(r, 500));
  await page.setViewport({ width: 1440, height: 900 });
});

await browser.close();
await site.close();

if (!msgs.length) { console.log('✓ הקונסול נקי לחלוטין — כולל תחת אינטראקציה'); process.exit(0); }
console.log(`נמצאו ${msgs.length} הודעות:\n`);
msgs.forEach((m) => console.log(`  [${m.t}] בשלב "${m.at}": ${m.text.slice(0, 160)}`));
process.exit(1);
