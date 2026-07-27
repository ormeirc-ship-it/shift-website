#!/usr/bin/env node
/**
 * stress.mjs — הצלילה בתנאי קצה (פריט T2).
 * ארבעה תרחישים שבהם קל לשבור רצף פריימים שנטען ברקע:
 *   1. Slow 3G — גלילה מלאה כשרוב הפריימים עוד לא הגיעו
 *   2. גלילה מהירה לסוף לפני שהטעינה התחילה
 *   3. טאב מוסתר בזמן הטעינה, ואז חזרה
 *   4. רענון באמצע הצלילה (עם hash)
 * הבדיקה: האם משהו קורס, האם הקנבס נשאר ריק, והאם התוכן נשאר נגיש.
 */
import puppeteer from 'puppeteer-core';
import { chromePath, serveRepo, pad } from './lib/env.mjs';

const SLOW3G = { downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8, latency: 2000 };
const site = await serveRepo();
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new' });
const results = [];
const fails = [];

// האם הקנבס מצייר משהו (לא שחור/ריק לגמרי)
const canvasHasContent = () => {
  const c = document.getElementById('brainCanvas');
  if (!c || !c.width) return false;
  const t = document.createElement('canvas');
  t.width = 24; t.height = 24;
  const cx = t.getContext('2d', { willReadFrequently: true });
  cx.drawImage(c, 0, 0, 24, 24);
  const d = cx.getImageData(0, 0, 24, 24).data;
  let lit = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 40) lit++;
  return lit / (24 * 24) > 0.05;
};

async function scenario(name, fn, { throttle = false, width = 390 } = {}) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.setViewport({ width, height: 844 });
  if (throttle) {
    const c = await page.createCDPSession();
    await c.send('Network.enable');
    await c.send('Network.emulateNetworkConditions', { offline: false, ...SLOW3G });
  }
  let r;
  try { r = await fn(page); } catch (e) { r = { error: e.message }; }
  const state = await page.evaluate((src) => ({
    canvasPainted: (new Function('return ' + src)())(),
    curtainGone: document.documentElement.classList.contains('preloader-done'),
    headings: document.querySelectorAll('h1, h2, h3').length,
    bodyScrollable: getComputedStyle(document.body).overflow !== 'hidden',
    navLightStuck: document.documentElement.classList.contains('nav-light') &&
      (document.getElementById('products') || {}).getBoundingClientRect
      ? (() => { const p = document.getElementById('products');
          const r = p.getBoundingClientRect();
          return r.top <= 76 && r.bottom > 76 && document.documentElement.classList.contains('nav-light'); })()
      : false,
  }), canvasHasContent.toString()).catch((e) => ({ error: e.message }));
  const row = { name, ...r, ...state, errors: errs.length, errorSample: errs.slice(0, 2) };
  results.push(row);
  if (errs.length) fails.push(`${name}: ${errs.length} שגיאות (${errs[0] || ''})`);
  if (!state.curtainGone) fails.push(`${name}: מסך הפתיחה לא נסגר`);
  if (!state.bodyScrollable) fails.push(`${name}: העמוד ננעל (overflow hidden)`);
  if (state.navLightStuck) fails.push(`${name}: סרגל בהיר נדבק על סקשן כהה`);
  if (state.headings < 20) fails.push(`${name}: רק ${state.headings} כותרות`);
  await page.close();
  return row;
}

// 1 — Slow 3G, גלילה מלאה בזמן שהפריימים עוד בדרך
await scenario('Slow 3G + גלילה מלאה', async (page) => {
  await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await new Promise((r) => setTimeout(r, 2500));   // בכוונה לא מחכים לרצף
  return page.evaluate(async () => {
    if (window.__lenis) window.__lenis.stop();
    const total = document.documentElement.scrollHeight - innerHeight;
    for (let y = 0; y <= total; y += 220) {
      scrollTo(0, y);
      if (window.ScrollTrigger) ScrollTrigger.update();
      await new Promise((r) => requestAnimationFrame(r));
    }
    scrollTo(0, 0);
    if (window.ScrollTrigger) ScrollTrigger.update();
    return { loadedFrames: window.__dive ? window.__dive.allFramesMs !== null : null };
  });
}, { throttle: true });

// 2 — קפיצה לסוף הצלילה מיד, לפני שהטעינה התקדמה
await scenario('קפיצה לסוף לפני טעינה', async (page) => {
  await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.evaluate(() => {
    const d = document.querySelector('.dive');
    if (d) scrollTo(0, d.offsetHeight - innerHeight);
  });
  await new Promise((r) => setTimeout(r, 3500));
  return {};
}, { throttle: true });

// 3 — טאב מוסתר בזמן הטעינה
await scenario('טאב מוסתר בטעינה', async (page) => {
  const c = await page.createCDPSession();
  await page.goto(site.url, { waitUntil: 'domcontentloaded' });
  await c.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 }).catch(() => {});
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
    Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await new Promise((r) => setTimeout(r, 2500));
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await new Promise((r) => setTimeout(r, 1200));
  return {};
});

// 4 — רענון באמצע הצלילה
await scenario('רענון באמצע הצלילה', async (page) => {
  await page.goto(site.url, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1200));
  await page.evaluate(() => {
    const d = document.querySelector('.dive');
    scrollTo(0, Math.round((d.offsetHeight - innerHeight) * 0.5));
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1800));
  return { scrollAfterReload: await page.evaluate(() => Math.round(scrollY)) };
});

await browser.close();
await site.close();

console.log('\n' + pad('תרחיש', 26) + pad('קנבס מצויר', 12) + pad('פתיח נסגר', 11) +
            pad('כותרות', 8) + pad('נגיש', 7) + 'שגיאות');
console.log('─'.repeat(76));
for (const r of results) {
  console.log(pad(r.name, 26) + pad(r.canvasPainted ? 'כן' : 'לא', 12) +
    pad(r.curtainGone ? 'כן' : 'לא', 11) + pad(r.headings ?? '—', 8) +
    pad(r.bodyScrollable ? 'כן' : 'לא', 7) + (r.errors || 0));
}
console.log('\n' + (fails.length ? '✗ כשלים:\n  · ' + fails.join('\n  · ') : '✓ כל התרחישים עברו'));
process.exit(fails.length ? 1 : 0);
