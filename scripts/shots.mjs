#!/usr/bin/env node
/**
 * shots.mjs — צילומי מסך של כל סקשן ושל שלוש נקודות הצלילה, ב-1440 וב-390.
 * שימוש:  npm run shots            → delivery/
 *         node scripts/shots.mjs --out delivery/before --only hero
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromePath, serveRepo, ready, ROOT } from './lib/env.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };
const OUT = resolve(ROOT, arg('out', 'delivery'));
const ONLY = arg('only', null);
mkdirSync(OUT, { recursive: true });

const DIVE = [['hero-1-start', 0.02], ['hero-2-mid', 0.55], ['hero-3-light', 1.0]];
const SECTIONS = [['statement', '.statement'], ['products', '#products'], ['method', '#method'],
  ['habits', '#habits'], ['breath', '#breathe'], ['path', '#path'], ['program', '#program'],
  ['events', '#events'], ['story', '#story'], ['outcomes', '#outcomes'], ['closing', '.closing']];

const site = await serveRepo();
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new',
  args: ['--hide-scrollbars', '--font-render-hinting=none'] });

for (const [name, width, height] of [['1440', 1440, 900], ['390', 390, 844]]) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 60000 });
  await ready(page);

  for (const [label, frac] of DIVE) {
    await page.evaluate((f) => {
      if (window.__lenis) window.__lenis.stop();
      const d = document.querySelector('.dive');
      scrollTo(0, Math.round((d.offsetHeight - innerHeight) * f));
      if (window.ScrollTrigger) ScrollTrigger.update();
      if (window.__dive && window.__dive.render) for (let i = 0; i < 300; i++) window.__dive.render();
    }, frac);
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: `${OUT}/${label}-${name}.png` });
    console.log(`✓ ${label}-${name}.png`);
  }

  if (ONLY !== 'hero') {
    for (const [label, sel] of SECTIONS) {
      const ok = await page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return false;
        if (window.__lenis) window.__lenis.stop();
        scrollTo(0, Math.max(0, Math.round(el.getBoundingClientRect().top + scrollY - 30)));
        if (window.ScrollTrigger) ScrollTrigger.update();
        return true;
      }, sel);
      if (!ok) { console.log(`· ${label}: לא נמצא`); continue; }
      await new Promise((r) => setTimeout(r, 850));
      await page.screenshot({ path: `${OUT}/${label}-${name}.png` });
      console.log(`✓ ${label}-${name}.png`);
    }
  }
  await page.close();
}
await browser.close();
await site.close();
console.log('\nנשמר ב: ' + OUT);
