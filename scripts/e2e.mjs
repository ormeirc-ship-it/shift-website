#!/usr/bin/env node
/**
 * e2e.mjs — המסע המלא של מבקר אמיתי (פריט 27).
 *
 * לא בדיקת יחידות — תסריט: שער נסגר, צלילה עד האור, עוגנים מהסרגל,
 * תרגיל הנשימה עד הסוף, תפריט מובייל על באמת (פתיחה/סגירה/Escape/מלכודת
 * פוקוס), כפתור הדילוג, ואירועי האנליטיקס שנרשמו בדרך. קונסול נקי לכל
 * האורך. דסקטופ 1440 + מובייל 390.
 *
 * שימוש:  npm run e2e   (נכנס גם ל-npm run check)
 */
import puppeteer from 'puppeteer-core';
import { chromePath, serveRepo, ready, pad } from './lib/env.mjs';

const site = await serveRepo();
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new' });
const results = [];
const step = (name, ok, note = '') => {
  results.push({ name, ok, note });
  console.log(pad(ok ? '✓' : '✗', 3) + pad(name, 40) + note);
};

// ── דסקטופ: השער, הצלילה, העוגנים, הדילוג ─────────────────────────────
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 60000 });
  await ready(page);

  step('השער נסגר מעצמו', await page.evaluate(() =>
    document.documentElement.classList.contains('preloader-done')));

  // צלילה הדרגתית עד ההגעה — כמו גלגלת אמיתית
  await page.evaluate(async () => {
    if (window.__lenis) window.__lenis.stop();
    const dive = document.querySelector('.dive');
    const end = dive.offsetTop + dive.offsetHeight - innerHeight * 0.5;
    for (let y = 0; y <= end; y += 120) {
      scrollTo(0, y);
      if (window.ScrollTrigger) ScrollTrigger.update();
      await new Promise((r) => requestAnimationFrame(r));
    }
  });
  await new Promise((r) => setTimeout(r, 900));
  const arrival = await page.evaluate(() => {
    const h1 = document.querySelector('#diveArrival h1');
    const r = h1 ? h1.getBoundingClientRect() : null;
    const cs = h1 ? getComputedStyle(h1) : null;
    return { visible: !!(r && r.height > 0 && +cs.opacity > 0.5), curtain: (() => {
      const c = document.getElementById('diveCurtain');
      return c ? +getComputedStyle(c).opacity : null;
    })() };
  });
  step('ההגעה אל האור נראית בסוף הצלילה', arrival.visible);
  step('הווילון (B3) נפתח עם ההגעה', arrival.curtain !== null && arrival.curtain > 0.8,
    'אטימות ' + arrival.curtain);
  step('dive_complete נרשם ב-dataLayer', await page.evaluate(() =>
    (window.dataLayer || []).some((e) => e.event === 'shift:dive_complete')));

  // עוגנים: כל קישור בסרגל מביא את הסקשן אל מתחת לסרגל.
  // ‏Lenis הופעל מחדש — נעצר לצורך סקרוב-הצלילה, אבל העוגנים גוללים דרכו
  const anchors = await page.evaluate(async () => {
    if (window.__lenis) window.__lenis.start();
    const out = [];
    for (const a of document.querySelectorAll('.nav-links a')) {
      const id = a.getAttribute('href');
      const target = document.querySelector(id);
      if (!target) { out.push({ id, ok: false, note: 'אין יעד' }); continue; }
      a.click();
      await new Promise((r) => setTimeout(r, 1600)); // ‏Lenis מסיים
      const top = target.getBoundingClientRect().top;
      out.push({ id, ok: top > -80 && top < 160, note: Math.round(top) + 'px' });
    }
    return out;
  });
  for (const a of anchors) step('עוגן ' + a.id, a.ok, a.note);

  // הדילוג: טעינה נקייה, מחכים שיופיע, לוחצים — מגיעים לתוכן
  await page.goto(site.url + '?e2e-skip', { waitUntil: 'networkidle2', timeout: 60000 });
  await ready(page);
  await page.waitForFunction(() => {
    const b = document.getElementById('diveSkip');
    return b && !b.hidden && getComputedStyle(b).opacity !== '0';
  }, { timeout: 8000 }).catch(() => {});
  const skipOk = await page.evaluate(async () => {
    const b = document.getElementById('diveSkip');
    if (!b || b.hidden) return { ok: false, note: 'לא הופיע' };
    b.click();
    await new Promise((r) => setTimeout(r, 2200));
    const t = document.getElementById('products').getBoundingClientRect().top;
    return { ok: t > -120 && t < 220, note: Math.round(t) + 'px' };
  });
  step('כפתור הדילוג מביא אל התוכן', skipOk.ok, skipOk.note);
  step('dive_skip נרשם', await page.evaluate(() =>
    (window.dataLayer || []).some((e) => e.event === 'shift:dive_skip')));

  step('קונסול נקי לאורך מסע הדסקטופ', consoleErrors.length === 0,
    consoleErrors.slice(0, 2).join(' | '));
  await page.close();
}

// ── מובייל: תפריט (פתיחה/עוגן/Escape/מלכודת פוקוס) + נשימה עד הסוף ─────
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  // מצב שקט: מסלול הנשימה הלא-מונפש דטרמיניסטי בזמן (8.7ש' לסבב)
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 60000 });
  await ready(page, { frames: false });

  const menuFlow = await page.evaluate(async () => {
    const burger = document.getElementById('navBurger');
    const menu = document.getElementById('mobileMenu');
    if (!burger || !menu) return { open: false };
    burger.click();
    await new Promise((r) => setTimeout(r, 300));
    const open = menu.classList.contains('open');
    const locked = document.body.style.overflow === 'hidden';
    const focusIn = menu.contains(document.activeElement);
    // עוגן מהתפריט סוגר ומגיע
    const link = menu.querySelector('a[href="#program"]') || menu.querySelector('a');
    link.click();
    await new Promise((r) => setTimeout(r, 1200));
    const closed = !menu.classList.contains('open');
    const unlocked = document.body.style.overflow !== 'hidden';
    // ‏Escape על תפריט פתוח
    burger.click();
    await new Promise((r) => setTimeout(r, 200));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    const escClosed = !menu.classList.contains('open');
    return { open, locked, focusIn, closed, unlocked, escClosed };
  });
  step('תפריט נפתח ונועל גלילה', menuFlow.open && menuFlow.locked);
  step('הפוקוס נכנס לתפריט', menuFlow.focusIn);
  step('עוגן מהתפריט סוגר ומשחרר', menuFlow.closed && menuFlow.unlocked);
  step('Escape סוגר את התפריט', menuFlow.escClosed);
  step('menu_open נרשם', await page.evaluate(() =>
    (window.dataLayer || []).some((e) => e.event === 'shift:menu_open')));

  // הנשימה — עד הסוף (3 סבבים במסלול השקט ≈ 26ש')
  await page.evaluate(() => document.getElementById('breathe').scrollIntoView());
  await new Promise((r) => setTimeout(r, 500));
  await page.evaluate(() => document.getElementById('breathStart').click());
  const breathDone = await page.waitForFunction(() =>
    (window.dataLayer || []).some((e) => e.event === 'shift:breath_done'),
    { timeout: 40000 }).then(() => true).catch(() => false);
  step('הנשימה רצה עד הסוף (3 סבבים)', breathDone);
  if (breathDone) {
    const after = await page.evaluate(() => {
      const el = document.getElementById('breathAfter');
      const btn = document.getElementById('breathStart');
      return { revealed: el && !el.hidden, btnBack: btn && !btn.disabled };
    });
    step('הסיום חושף את ההמשך ומשחרר את הכפתור', after.revealed && after.btnBack);
  }

  step('קונסול נקי לאורך מסע המובייל', consoleErrors.length === 0,
    consoleErrors.slice(0, 2).join(' | '));
  await page.close();
}

await browser.close();
await site.close();
const bad = results.filter((r) => !r.ok);
console.log('\n' + (bad.length ? `✗ ${bad.length}/${results.length} צעדים נכשלו` : `✓ המסע המלא עבר (${results.length} צעדים)`));
process.exit(bad.length ? 1 : 0);
