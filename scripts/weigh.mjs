#!/usr/bin/env node
/**
 * weigh.mjs — משקל העמוד בפועל, לפי סוג נכס, בדסקטופ ובמובייל.
 * שימוש:  npm run weigh   ·   node scripts/weigh.mjs --json
 */
import puppeteer from 'puppeteer-core';
import { chromePath, serveRepo, ready, kb, pad } from './lib/env.mjs';

const JSON_OUT = process.argv.includes('--json');
const site = await serveRepo();
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new' });
const out = [];

for (const [label, width] of [['דסקטופ 1440', 1440], ['מובייל 390', 390]]) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900 });
  const byType = {};
  let total = 0;
  page.on('response', async (res) => {
    try {
      const len = Number(res.headers()['content-length'] || 0);
      const size = len || await res.buffer().then((b) => b.length).catch(() => 0);
      const url = res.url();
      let t = 'אחר';
      if (/brain-seq/.test(url)) t = 'רצף המוח';
      else if (/\.(webp|jpe?g|png|svg)(\?|$)/i.test(url)) t = 'תמונות';
      else if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) t = 'וידאו';
      else if (/\.js(\?|$)/.test(url)) t = 'JS';
      else if (/\.css(\?|$)/.test(url) || /fonts\.googleapis/.test(url)) t = 'CSS/גופן';
      else if (/fonts\.gstatic/.test(url)) t = 'קובצי גופן';
      else if (url === site.url) t = 'HTML';
      byType[t] = (byType[t] || 0) + size;
      total += size;
    } catch { /* התעלמות */ }
  });
  await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 60000 });
  await ready(page);
  const dive = await page.evaluate(() => window.__dive
    ? { count: window.__dive.count, first: window.__dive.firstFrameMs, all: window.__dive.allFramesMs } : null);
  out.push({ label, width, total, byType, dive });
  await page.close();
}
await browser.close();
await site.close();

if (JSON_OUT) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
for (const r of out) {
  console.log(`\n=== ${r.label} ===`);
  Object.entries(r.byType).sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log('  ' + pad(k, 14) + kb(v).padStart(8)));
  console.log('  ' + '─'.repeat(22) + '\n  ' + pad('סה"כ', 14) + kb(r.total).padStart(8) +
    `  (${(r.total / 1024 / 1024).toFixed(2)}MB)`);
  if (r.dive) console.log(`  רצף: ${r.dive.count} פריימים · ראשון ${r.dive.first}ms · הכול ${r.dive.all}ms`);
}
console.log('\n⚠ מקומי — בלי latency רשת. ל-Slow 4G: npm run net');
