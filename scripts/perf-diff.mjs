#!/usr/bin/env node
/**
 * perf-diff.mjs — השוואת שתי ריצות המדידה האחרונות (פריט 8).
 *
 * `npm run perf` ו-`npm run net` שומרים JSON מתוארך ל-perf/. הכלי הזה
 * לוקח את שתי הריצות האחרונות מכל סוג ומתריע על רגרסיה מעל 10%:
 * ירידת FPS, עליית long tasks, התארכות זמן-עד-מוח. בלי היסטוריה —
 * רגרסיית ביצועים מתגלה רק כשמישהו מרגיש אותה ביד, וזה מאוחר.
 *
 * שימוש:  npm run perf:diff
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, pad } from './lib/env.mjs';

const DIR = join(ROOT, 'perf');
const PCT = 10;

const latestTwo = (kind) => {
  let files = [];
  try {
    files = readdirSync(DIR).filter((f) => f.endsWith(`-${kind}.json`)).sort();
  } catch { /* אין תיקייה עדיין */ }
  return files.slice(-2).map((f) => ({ name: f, data: JSON.parse(readFileSync(join(DIR, f), 'utf8')) }));
};

// metric: {key, better: 'high'|'low', min — סף רעש אבסולוטי}
const RULES = {
  perf: [
    { key: 'medianFps', better: 'high' },
    { key: 'p1Fps', better: 'high' },
    { key: 'framesOver50ms', better: 'low', min: 3 },
    { key: 'longTasks', better: 'low', min: 2 },
  ],
  net: [
    { key: 'curtainMs', better: 'low', min: 200 },
    { key: 'allMs', better: 'low', min: 500 },
  ],
};

let regressions = 0, compared = 0;
for (const kind of ['perf', 'net']) {
  const runs = latestTwo(kind);
  if (runs.length < 2) {
    console.log(`· ${kind}: ${runs.length ? 'ריצה אחת בלבד' : 'אין ריצות'} — אין למה להשוות`);
    continue;
  }
  const [prev, cur] = runs;
  console.log(`\n${kind}: ${prev.name} → ${cur.name}`);
  for (const cfg of cur.data) {
    const old = prev.data.find((r) => r.label === cfg.label);
    if (!old) continue;
    for (const rule of RULES[kind]) {
      const a = old[rule.key], b = cfg[rule.key];
      if (a == null || b == null || !isFinite(a) || !isFinite(b)) continue;
      compared++;
      const worse = rule.better === 'high' ? a - b : b - a;
      const base = Math.max(Math.abs(a), 1);
      const overNoise = rule.min ? Math.abs(b - a) >= rule.min : true;
      if (worse / base * 100 > PCT && overNoise) {
        regressions++;
        console.log(`  ✗ ${pad(cfg.label, 26)} ${rule.key}: ${a} → ${b} (רגרסיה ${Math.round(worse / base * 100)}%)`);
      }
    }
  }
}

if (!compared) { console.log('\n· אין עדיין זוג ריצות להשוואה'); process.exit(0); }
console.log(regressions
  ? `\n✗ ${regressions} רגרסיות מעל ${PCT}%`
  : `\n✓ אין רגרסיה מעל ${PCT}% (הושוו ${compared} מדדים)`);
process.exit(regressions ? 1 : 0);
