#!/usr/bin/env node
/**
 * perf.mjs — חלקות התנועה בגלילה מלאה, עם ובלי האטת CPU.
 * מודד: FPS (חציון/אחוזונים/מינימום), long tasks מעל 50ms, recalc ו-layout.
 * שימוש:  npm run perf   ·   node scripts/perf.mjs --json
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, chromePath, serveRepo, ready, SCROLL_ALL, pad } from './lib/env.mjs';

const JSON_OUT = process.argv.includes('--json');
const CONFIGS = [
  { label: 'דסקטופ 1440, ללא האטה', w: 1440, h: 900, cpu: 1 },
  { label: 'דסקטופ 1440, האטה ×4', w: 1440, h: 900, cpu: 4 },
  { label: 'מובייל 390, ללא האטה', w: 390, h: 844, cpu: 1 },
  { label: 'מובייל 390, האטה ×4', w: 390, h: 844, cpu: 4 },
];

const site = await serveRepo();
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new' });
const results = [];

for (const cfg of CONFIGS) {
  const page = await browser.newPage();
  await page.setViewport({ width: cfg.w, height: cfg.h });
  const client = await page.createCDPSession();
  if (cfg.cpu > 1) await client.send('Emulation.setCPUThrottlingRate', { rate: cfg.cpu });
  await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 60000 });
  await ready(page);

  const data = await page.evaluate(async (scrollAllSrc) => {
    const frames = [], longTasks = [];
    let po = null;
    try {
      po = new PerformanceObserver((l) => l.getEntries().forEach((e) => {
        if (e.duration >= 50) longTasks.push({ dur: Math.round(e.duration), y: Math.round(scrollY) });
      }));
      po.observe({ entryTypes: ['longtask'] });
    } catch { /* לא נתמך */ }

    let last = performance.now(), running = true;
    const tick = () => {
      const now = performance.now();
      frames.push({ dt: now - last, y: Math.round(scrollY) });
      last = now;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    await (new Function('return ' + scrollAllSrc)())();

    running = false;
    if (po) po.disconnect();
    await new Promise((r) => setTimeout(r, 100));

    const usable = frames.slice(3);
    const total = document.documentElement.scrollHeight - innerHeight;
    const fps = usable.map((f) => ({ fps: 1000 / f.dt, y: f.y })).filter((f) => isFinite(f.fps));
    fps.sort((a, b) => a.fps - b.fps);
    const pct = (p) => fps[Math.floor(fps.length * p)] || null;
    const heavy = usable.filter((f) => f.dt > 50);
    const zones = {};
    heavy.forEach((f) => {
      const z = Math.floor(f.y / (total / 10)) + 1;
      zones['אזור ' + z + '/10'] = (zones['אזור ' + z + '/10'] || 0) + 1;
    });
    return {
      frameCount: usable.length,
      minFps: Math.round(fps[0] ? fps[0].fps : 0),
      p1Fps: Math.round((pct(0.01) || {}).fps || 0),
      p5Fps: Math.round((pct(0.05) || {}).fps || 0),
      medianFps: Math.round((pct(0.5) || {}).fps || 0),
      framesOver50ms: heavy.length,
      longTasks: longTasks.length,
      longTasksWorst: longTasks.sort((a, b) => b.dur - a.dur).slice(0, 5),
      zones,
    };
  }, SCROLL_ALL.toString());

  const m = await page.metrics();
  results.push({ ...cfg, ...data,
    recalcCount: m.RecalcStyleCount, recalcMs: Math.round(m.RecalcStyleDuration * 1000),
    layoutCount: m.LayoutCount, layoutMs: Math.round(m.LayoutDuration * 1000) });
  await page.close();
  if (!JSON_OUT) console.error('נמדד: ' + cfg.label);
}

await browser.close();
await site.close();

// כל ריצה נשמרת מתוארכת ל-perf/ — ההיסטוריה היא שמאפשרת perf:diff (פריט 8)
{
  const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
  mkdirSync(join(ROOT, 'perf'), { recursive: true });
  const file = join(ROOT, 'perf', `${stamp}-perf.json`);
  writeFileSync(file, JSON.stringify(results, null, 1));
  if (!JSON_OUT) console.error('נשמר: perf/' + file.split('/').pop());
}

if (JSON_OUT) { console.log(JSON.stringify(results, null, 1)); process.exit(0); }

console.log('\n' + pad('תצורה', 26) + pad('FPS חציון', 11) + pad('אחוזון-1', 10) +
            pad('>50ms', 8) + pad('long tasks', 12) + pad('recalc', 9) + 'layout');
console.log('─'.repeat(84));
for (const r of results) {
  console.log(pad(r.label, 26) + pad(r.medianFps, 11) + pad(r.p1Fps, 10) +
    pad(r.framesOver50ms + '/' + r.frameCount, 8) + pad(r.longTasks, 12) +
    pad(r.recalcCount, 9) + r.layoutCount);
}
const bad = results.filter((r) => r.longTasks > 0 || r.p1Fps < 30);
console.log('\n' + (bad.length ? '⚠ נמצאו בעיות ב-' + bad.length + ' תצורות' : '✓ אין long tasks ואין צניחת FPS'));
process.exit(bad.length ? 1 : 0);
