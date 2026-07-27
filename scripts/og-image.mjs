#!/usr/bin/env node
/**
 * og-image.mjs — תמונת שיתוף ייעודית 1200×630 (פריט 38).
 * מנכסי המותג והפלטה הנעולה בלבד: רקע נייבי→נייבי-עמוק, התג העגול,
 * וה-tagline. דטרמיניסטי — אותם נכסים, אותה תמונה.
 *
 * שימוש:  node scripts/og-image.mjs  →  assets/brand/og.png
 */
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, chromePath } from './lib/env.mjs';

const badge = readFileSync(join(ROOT, 'assets/brand/asset10.png')).toString('base64');
const logo = readFileSync(join(ROOT, 'assets/brand/logo-white.png')).toString('base64');
// הגופן העברי — ה-woff2 המקומי, שהטקסט ייכתב ב-Assistant אמיתי
const font = readFileSync(join(ROOT, 'assets/fonts/assistant-300-hebrew.woff2')).toString('base64');

const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.setContent(`<!DOCTYPE html><html><head><style>
  @font-face { font-family: 'Assistant'; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 300; }
  * { margin: 0; }
  body {
    width: 1200px; height: 630px; overflow: hidden; position: relative;
    background:
      radial-gradient(ellipse 900px 500px at 78% 30%, rgba(92, 187, 240, 0.22), transparent 65%),
      linear-gradient(135deg, #18163B 0%, #121234 100%);
    font-family: 'Assistant', sans-serif;
  }
  .box { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); text-align: center; direction: rtl; }
  .logo { width: 560px; height: auto; display: block; margin: 0 auto 10px;
    filter: drop-shadow(0 0 60px rgba(92, 187, 240, 0.35)); }
  .tag { color: rgba(246, 245, 242, 0.92); font-size: 44px; font-weight: 300; letter-spacing: 0.04em; }
  .dot { position: absolute; inset: 0;
    background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px);
    background-size: 26px 26px; }
</style></head><body>
  <div class="dot"></div>
  <div class="box">
    <img class="logo" src="data:image/png;base64,${logo}">
    <div class="tag">מהישרדות ליצירה</div>
  </div>
</body></html>`, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 300));
const png = await page.screenshot({ type: 'png' });
await browser.close();
writeFileSync(join(ROOT, 'assets/brand/og.png'), png);
console.log('✓ assets/brand/og.png — ' + (png.length / 1024).toFixed(0) + 'KB');
