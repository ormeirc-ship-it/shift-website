#!/usr/bin/env node
/**
 * net.mjs — מדידה בתנאי רשת אמיתיים (פריט H).
 * כל המספרים ב-PERF.md נמדדו על localhost, כלומר בלי latency בכלל.
 * כאן מוסיפים throttling של הרשת דרך CDP ומודדים מה שבאמת מרגיש המבקר:
 * מתי מופיע הפריים הראשון של המוח, ומתי הרצף כולו מוכן.
 *
 * שימוש:  npm run net   ·   node scripts/net.mjs --json
 */
import puppeteer from 'puppeteer-core';
import { chromePath, serveRepo, pad } from './lib/env.mjs';

const JSON_OUT = process.argv.includes('--json');

// פרופילים סטנדרטיים (אותם מספרים ש-DevTools משתמש בהם)
const NET = {
  'Slow 4G': { downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8, latency: 400 },
  'Fast 4G': { downloadThroughput: 4 * 1024 * 1024 / 8, uploadThroughput: 3 * 1024 * 1024 / 8, latency: 150 },
  'Slow 3G': { downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8, latency: 2000 },
};

const CONFIGS = [
  { label: 'מובייל 390 · Slow 4G', w: 390, h: 844, net: 'Slow 4G' },
  { label: 'מובייל 390 · Fast 4G', w: 390, h: 844, net: 'Fast 4G' },
  { label: 'דסקטופ 1440 · Slow 4G', w: 1440, h: 900, net: 'Slow 4G' },
  { label: 'מובייל 390 · Slow 3G', w: 390, h: 844, net: 'Slow 3G' },
];

const site = await serveRepo();
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new' });
const out = [];

for (const cfg of CONFIGS) {
  const page = await browser.newPage();
  await page.setViewport({ width: cfg.w, height: cfg.h });
  const client = await page.createCDPSession();
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', { offline: false, ...NET[cfg.net] });

  const t0 = Date.now();
  await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 180000 });

  // מתי הפתיח נסגר (= המבקר רואה משהו אמיתי)
  await page.waitForFunction(() => document.documentElement.classList.contains('preloader-done'),
    { timeout: 120000 }).catch(() => {});
  const curtainMs = Date.now() - t0;

  // מתי כל הרצף מוכן
  await page.waitForFunction(() => window.__dive && window.__dive.allFramesMs !== null,
    { timeout: 180000 }).catch(() => {});
  const allMs = Date.now() - t0;

  const paint = await page.evaluate(() => {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    return {
      fcp: fcp ? Math.round(fcp.startTime) : null,
      firstFrameMs: window.__dive ? window.__dive.firstFrameMs : null,
      frames: window.__dive ? window.__dive.count : null,
    };
  });
  out.push({ ...cfg, curtainMs, allMs, ...paint });
  await page.close();
  if (!JSON_OUT) console.error('נמדד: ' + cfg.label);
}

await browser.close();
await site.close();

if (JSON_OUT) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
console.log('\n' + pad('תצורה', 24) + pad('FCP', 9) + pad('מסך פתיחה נסגר', 17) + pad('כל הרצף', 11) + 'פריימים');
console.log('─'.repeat(70));
for (const r of out) {
  console.log(pad(r.label, 24) + pad((r.fcp ?? '—') + 'ms', 9) +
    pad(r.curtainMs + 'ms', 17) + pad((r.allMs / 1000).toFixed(1) + 'ש\'', 11) + r.frames);
}
console.log('\nהערה: "מסך פתיחה נסגר" = הרגע שבו המבקר רואה את המוח.');
console.log('רשת ביטחון בקוד פותחת אותו אחרי 2.5ש\' גם אם הפריים לא הגיע.');
