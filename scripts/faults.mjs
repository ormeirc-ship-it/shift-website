#!/usr/bin/env node
/**
 * faults.mjs — בדיקת גבולות הכשל (פריט 36).
 *
 * מפיל פיצ'ר אחד בתורו (דרך וו-ההזרקה window.__failFeature שב-main.js)
 * וטוען את העמוד: הפיצ'ר המופל חייב להירשם כקריסה בקונסול, וכל השכנים
 * חייבים להישאר חיים — נבדק בפרוב אמיתי לכל אחד, לא בהנחה.
 * בנוסף: הפלת motion.js כולו (מחיקת gsap) — האתר חייב להישאר שמיש.
 *
 * שימוש:  npm run faults
 */
import puppeteer from 'puppeteer-core';
import { chromePath, serveRepo, pad } from './lib/env.mjs';

const site = await serveRepo();
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new' });

// פרוב חיוּת לכל פיצ'ר — רץ בעמוד ומחזיר true אם הפיצ'ר מתפקד
const PROBES = {
  'menu': async (page) => page.evaluate(() => {
    const burger = document.getElementById('navBurger');
    const menu = document.getElementById('mobileMenu');
    if (!burger || !menu) return false;
    burger.click();
    const opened = menu.classList.contains('open');
    burger.click();
    return opened && !menu.classList.contains('open');
  }),
  'breath': async (page) => page.evaluate(() => {
    const btn = document.getElementById('breathStart');
    if (!btn || btn.disabled) return false;
    btn.click();
    const started = btn.disabled && btn.textContent.includes('נושמים');
    return started;
  }),
  'nav-tone': async (page) => page.evaluate(() =>
    !!(window.__navTone && typeof window.__navTone.set === 'function')),
  'nav-scrolled': async (page) => page.evaluate(async () => {
    scrollTo(0, 200);
    await new Promise((r) => setTimeout(r, 120));
    const ok = document.getElementById('nav')?.classList.contains('scrolled');
    scrollTo(0, 0);
    return !!ok;
  }),
  'reveals': async (page) => page.evaluate(async () => {
    scrollTo(0, document.documentElement.scrollHeight * 0.6);
    await new Promise((r) => setTimeout(r, 700));
    scrollTo(0, 0);
    return document.querySelectorAll('.reveal.visible, .reveal:not([style*="opacity: 0"])').length > 0;
  }),
  'gate-logo': async (page) => page.evaluate(() =>
    document.documentElement.classList.contains('preloader-done')),
};

const load = async (inject) => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (inject) await page.evaluateOnNewDocument((f) => { window.__failFeature = f; }, inject);
  await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.classList.contains('preloader-done'),
    { timeout: 15000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 600));
  return { page, errors };
};

// רשימת הפיצ'רים — מהעמוד עצמו, שלא נתחזק רשימה כפולה
const { page: probe0 } = await load(null);
const features = await probe0.evaluate(() => window.__features || []);
await probe0.close();
if (!features.length) {
  console.error('✗ window.__features ריק — העטיפות נמחקו?');
  process.exit(1);
}

let failures = 0;
console.log(pad('מפילים', 14) + pad('נרשם ככשל', 12) + 'שכנים חיים');
console.log('─'.repeat(60));
for (const victim of features) {
  const { page, errors } = await load(victim);
  const crashLogged = errors.some((e) => e.includes(victim));
  const alive = [];
  const dead = [];
  for (const [name, probeFn] of Object.entries(PROBES)) {
    if (name === victim) continue;
    let ok = false;
    try { ok = await probeFn(page); } catch { ok = false; }
    (ok ? alive : dead).push(name);
  }
  const pass = crashLogged && dead.length === 0;
  if (!pass) failures++;
  console.log(pad(victim, 14) + pad(crashLogged ? '✓' : '✗', 12) +
    (dead.length ? '✗ מתו: ' + dead.join(', ') : '✓ כולם (' + alive.length + ')'));
  await page.close();
}

// התרחיש הגדול: מנוע התנועה לא קיים בכלל (gsap נמחק) — האתר שמיש
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setRequestInterception(true);
  page.on('request', (r) => r.url().includes('gsap') ? r.abort() : r.continue());
  await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 3500));
  const usable = await page.evaluate(() => ({
    released: document.documentElement.classList.contains('preloader-done'),
    h1: !!document.querySelector('h1'),
    menuWorks: (() => {
      const b = document.getElementById('navBurger');
      const m = document.getElementById('mobileMenu');
      if (!b || !m) return false;
      b.click();
      const ok = m.classList.contains('open');
      b.click();
      return ok;
    })(),
  }));
  const pass = usable.released && usable.h1 && usable.menuWorks;
  if (!pass) failures++;
  console.log(pad('gsap כולו', 14) + pad('—', 12) +
    (pass ? '✓ שער השתחרר, תוכן ותפריט חיים' : '✗ ' + JSON.stringify(usable)));
  await page.close();
}

await browser.close();
await site.close();
console.log('\n' + (failures ? `✗ ${failures} תרחישי כשל לא מבודדים` : `✓ כל פיצ'ר מבודד — קריסה לא מדביקה שכנים (${features.length} פיצ'רים + תרחיש gsap)`));
process.exit(failures ? 1 : 0);
