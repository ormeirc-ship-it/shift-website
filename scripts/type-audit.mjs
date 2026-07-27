#!/usr/bin/env node
/**
 * type-audit.mjs — טיפוגרפיה עברית ב-5 רוחבים (פריט TB).
 * RTL ועברית שוברים הנחות שהרבה CSS מניח בשקט, ולכן הבדיקה מודדת
 * שורות אמיתיות (דרך Range על צומתי טקסט) ולא מעריכה לפי רוחב חלוקה.
 *
 * מחפש: גלישה מהמיכל · יתומים (שורה אחרונה במילה אחת) · שורות מעל
 * 75 תווים · קו מפריד או מקף בסוף שורה · חיתוך אנכי.
 */
import puppeteer from 'puppeteer-core';
import { chromePath, serveRepo, ready, pad } from './lib/env.mjs';

const WIDTHS = [360, 414, 768, 1024, 1440];
const site = await serveRepo();
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new' });
const all = [];

for (const w of WIDTHS) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: 900 });
  await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 60000 });
  await ready(page);
  await page.evaluate(async () => {
    const t = document.documentElement.scrollHeight - innerHeight;
    for (let y = 0; y <= t; y += 350) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 12)); }
    scrollTo(0, 0);
  });
  await new Promise((r) => setTimeout(r, 700));

  const found = await page.evaluate(() => {
    // פיצול לשורות ויזואליות אמיתיות: מודדים כל תו ומזהים מתי ה-top משתנה
    const linesOf = (el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      const lines = [];
      let cur = '', lastTop = null;
      let node;
      while ((node = walker.nextNode())) {
        const s = node.data;
        for (let i = 0; i < s.length; i++) {
          range.setStart(node, i); range.setEnd(node, i + 1);
          const r = range.getBoundingClientRect();
          if (!r.height) { cur += s[i]; continue; }
          const top = Math.round(r.top);
          if (lastTop !== null && Math.abs(top - lastTop) > 3) { lines.push(cur); cur = ''; }
          lastTop = top;
          cur += s[i];
        }
      }
      if (cur.trim()) lines.push(cur);
      return lines.map((l) => l.trim()).filter(Boolean);
    };

    const out = [];
    const els = [...document.querySelectorAll('h1, h2, h3, .section-intro, .statement-title, .arrival-sub, .gate-line')]
      .filter((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 4;
      });

    els.forEach((el) => {
      const lines = linesOf(el);
      if (!lines.length) return;
      const label = (el.tagName + '.' + (el.className || '').toString().split(' ')[0]).slice(0, 26);
      const text = el.textContent.trim().slice(0, 34);
      const r = el.getBoundingClientRect();
      const parent = el.parentElement.getBoundingClientRect();
      const issues = [];

      if (r.right > parent.right + 2 || r.left < parent.left - 2) issues.push('גולש מהמיכל');
      const last = lines[lines.length - 1];
      if (lines.length > 1 && last.split(/\s+/).length === 1 && last.length <= 6) issues.push(`יתום: "${last}"`);
      const longest = Math.max(...lines.map((l) => l.length));
      if (longest > 75) issues.push(`שורה של ${longest} תווים`);
      lines.slice(0, -1).forEach((l) => {
        if (/[—–-]$/.test(l)) issues.push(`מקף בסוף שורה: "${l.slice(-18)}"`);
      });
      if (el.scrollHeight > el.clientHeight + 4 && getComputedStyle(el).overflow !== 'visible') issues.push('חיתוך אנכי');

      if (issues.length) out.push({ label, text, lines: lines.length, issues });
    });
    return out;
  });

  all.push({ w, found });
  await page.close();
  console.log(`${pad(w + 'px', 8)} ${found.length ? found.length + ' ממצאים' : '✓ נקי'}`);
  found.forEach((f) => console.log(`   · ${pad(f.label, 24)} "${f.text}" → ${f.issues.join(' · ')}`));
}

await browser.close();
await site.close();
const total = all.reduce((n, r) => n + r.found.length, 0);
console.log('\n' + (total ? `סה"כ ${total} ממצאים ב-${WIDTHS.length} רוחבים` : '✓ הטיפוגרפיה נקייה בכל חמשת הרוחבים'));
