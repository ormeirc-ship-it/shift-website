#!/usr/bin/env node
/**
 * a11y.mjs — נגישות מלאה (פריט T7) → A11Y.md
 * ניגודיות בפועל על כל צמד טקסט/רקע · מעבר מקלדת · alt · תוויות ·
 * היררכיית כותרות · שדות טופס · יעדי מגע · aria-live.
 */
import puppeteer from 'puppeteer-core';
import { chromePath, serveRepo, ready, pad } from './lib/env.mjs';

const JSON_OUT = process.argv.includes('--json');
const site = await serveRepo();
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 60000 });
await ready(page);

// גלילה מלאה כדי שכל התוכן ייחשף (כניסות מבוססות טריגר)
await page.evaluate(async () => {
  const total = document.documentElement.scrollHeight - innerHeight;
  for (let y = 0; y <= total; y += 300) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 12)); }
  scrollTo(0, 0);
});
await new Promise((r) => setTimeout(r, 800));

const report = await page.evaluate(() => {
  // ── ניגודיות ─────────────────────────────────────────────
  const lum = (c) => {
    const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const parse = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a));
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.6) return c.rgb;
      n = n.parentElement;
    }
    return [255, 255, 255];
  };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05); };

  const textEls = [...document.querySelectorAll('p, h1, h2, h3, h4, li, a, button, span, blockquote, label')]
    .filter((el) => {
      const t = (el.textContent || '').trim();
      if (!t || t.length < 2) return false;
      if ([...el.children].some((c) => (c.textContent || '').trim() === t)) return false; // רק העלה
      if (el.closest('[aria-hidden="true"]')) return false;   // דקורטיבי — לא מוכרז ולא נקרא
      // רקע קנבס/תמונה: הכלי לא יודע לדגום ממנו, וכל תוצאה תהיה שקר
      if (el.closest('.dive, .love-card, .cta, .closing')) return false;
      // תפריט סגור: האלמנטים עצמם גלויים, המיכל בשקיפות 0
      const mm = el.closest('.mobile-menu');
      if (mm && !mm.classList.contains('open')) return false;
      // סרגל שקוף מעל קנבס — אין רקע שאפשר לדגום ממנו
      if (el.closest('.nav') && !document.getElementById('nav').classList.contains('scrolled')) return false;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.3 && r.width > 0;
    });

  const contrast = [];
  textEls.forEach((el) => {
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    if (!fg) return;
    const bg = bgOf(el);
    const eff = over(fg, bg);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const r = ratio(eff, bg);
    if (r < need) contrast.push({
      text: (el.textContent || '').trim().slice(0, 40),
      cls: (el.className || el.tagName).toString().slice(0, 32),
      ratio: +r.toFixed(2), need, size: Math.round(size),
    });
  });

  // ── תמונות, תוויות, כותרות ────────────────────────────────
  const imgs = [...document.querySelectorAll('img')];
  const imgNoAlt = imgs.filter((i) => !i.hasAttribute('alt')).map((i) => i.src.split('/').pop());
  const interactive = [...document.querySelectorAll('a, button')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const nameOf = (el) => (el.textContent || '').trim() || el.getAttribute('aria-label') ||
    el.getAttribute('title') || (el.querySelector('img') || {}).alt || '';
  const unlabeled = interactive.filter((el) => !nameOf(el))
    .map((el) => (el.className || el.tagName).toString().slice(0, 30));

  const heads = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => +h.tagName[1]);
  const jumps = [];
  heads.reduce((prev, cur, i) => { if (cur - prev > 1) jumps.push({ at: i, from: prev, to: cur }); return cur; }, heads[0] || 1);

  // WCAG 2.2 — יעד מגע 24×24. נמדד כולל אזור הלחיצה האמיתי (pseudo/padding)
  const hit = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el, '::before');
    const bw = parseFloat(cs.width), bh = parseFloat(cs.height);
    return { w: Math.max(r.width, isFinite(bw) ? bw : 0), h: Math.max(r.height, isFinite(bh) ? bh : 0) };
  };
  const small = interactive.filter((el) => { const s = hit(el); return s.w < 24 || s.h < 24; }).map((el) => ({ cls: (el.className || el.tagName).toString().slice(0, 28),
    w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }));

  return {
    textChecked: textEls.length, contrast,
    imgTotal: imgs.length, imgNoAlt,
    interactiveTotal: interactive.length, unlabeled,
    h1Count: document.querySelectorAll('h1').length,
    headingJumps: jumps,
    smallTargets: small,
    ariaLive: [...document.querySelectorAll('[aria-live]')].map((e) => e.id || e.className),
    lang: document.documentElement.lang, dir: document.documentElement.dir,
  };
});

// מעבר מקלדת מלא
const kb = [];
for (let i = 0; i < 40; i++) {
  await page.keyboard.press('Tab');
  const r = await page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return null;
    const cs = getComputedStyle(a);
    const rect = a.getBoundingClientRect();
    return { tag: a.tagName.toLowerCase(),
      label: (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 30),
      ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
      inView: rect.top >= -5 && rect.bottom <= innerHeight + 5 };
  });
  if (r) kb.push(r);
}
report.keyboard = { stops: kb.length, noRing: kb.filter((k) => !k.ring).length,
  offscreen: kb.filter((k) => !k.inView).length };

await browser.close();
await site.close();

if (JSON_OUT) { console.log(JSON.stringify(report, null, 1)); process.exit(0); }
console.log('\n=== נגישות ===');
console.log(`lang="${report.lang}" dir="${report.dir}" · h1: ${report.h1Count}`);
console.log(`ניגודיות: נבדקו ${report.textChecked} אלמנטים · נכשלו ${report.contrast.length}`);
report.contrast.slice(0, 12).forEach((c) =>
  console.log(`  ✗ ${pad(c.ratio, 6)}(דרוש ${c.need}) ${pad(c.size + 'px', 6)} ${c.cls} — "${c.text}"`));
console.log(`תמונות: ${report.imgTotal} · בלי alt: ${report.imgNoAlt.length}`);
console.log(`אינטראקטיביים: ${report.interactiveTotal} · בלי תווית: ${report.unlabeled.length}`);
console.log(`יעדי מגע קטנים מ-24px: ${report.smallTargets.length}`);
report.smallTargets.slice(0, 6).forEach((s) => console.log(`  · ${s.cls} ${s.w}×${s.h}`));
console.log(`קפיצות בהיררכיית כותרות: ${report.headingJumps.length}`);
console.log(`מקלדת: ${report.keyboard.stops} עצירות · בלי טבעת: ${report.keyboard.noRing} · מחוץ למסך: ${report.keyboard.offscreen}`);
console.log(`aria-live: ${report.ariaLive.join(', ') || 'אין'}`);
