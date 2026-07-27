#!/usr/bin/env node
/**
 * doctor.mjs — בדיקת שלמות סביבת הפיתוח (פריט 25).
 * עונה בשלושים שניות על "למה הכלים לא עובדים אצלי": node, תלויות, כרום,
 * מקור האמת, hooks, וקבצי התשתית. ירוק = כל כלי בריפו ירוץ.
 *
 * שימוש:  npm run doctor
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createServer } from 'node:net';
import { ROOT, pad } from './lib/env.mjs';

const checks = [];
const add = (name, ok, note = '') => checks.push({ name, ok, note });

// 1. node
const [maj] = process.versions.node.split('.').map(Number);
add('node ≥ 18 (fetch מובנה)', maj >= 18, 'v' + process.versions.node);

// 2. תלויות
let puppeteerOk = false;
try {
  await import('puppeteer-core');
  puppeteerOk = true;
} catch { /* חסר */ }
add('puppeteer-core מותקן', puppeteerOk, puppeteerOk ? '' : 'להריץ: npm install');

// 3. כרום — אותם מועמדים כמו env.mjs, בלי לצאת מהתהליך
const chromeCands = [
  process.env.CHROME_PATH,
  join(homedir(), 'Desktop/Google Chrome.app/Contents/MacOS/Google Chrome'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  join(homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean);
const chrome = chromeCands.find((p) => existsSync(p));
add('כרום נמצא', !!chrome, chrome ? chrome.replace(homedir(), '~') : 'CHROME_PATH=/path npm run …');

// 4. מקור האמת של המסלול
const dataCands = [
  process.env.SHIFT_DATA_JS, process.env.DATA_JS,
  resolve(homedir(), 'Desktop/SHIFT/shift platform main /shift-platform/קבצי קוד/data.js'),
].filter(Boolean);
const dataJs = dataCands.find((p) => existsSync(p));
add('data.js (מקור המסלול) נגיש', !!dataJs, dataJs ? '' : 'verify/drift ייכשלו — ראו CLAUDE.md');

// 5. hook מותקן
const hook = join(ROOT, '.git/hooks/pre-commit');
const hookOk = existsSync(hook) && readFileSync(hook, 'utf8').includes('install-hooks');
add('pre-commit hook מותקן', hookOk, hookOk ? '' : 'להריץ: npm run hooks');

// 6. תשתיות בדיקה על הדיסק
add('baseline רגרסיה ויזואלית', existsSync(join(ROOT, 'tests/vr-baseline')), 'npm run vr:accept אם חסר');
add('היסטוריית perf/', existsSync(join(ROOT, 'perf')), 'נוצר בריצת perf/net ראשונה');
add('גופנים self-hosted', existsSync(join(ROOT, 'assets/fonts/assistant-400-hebrew.woff2')),
  'להריץ: node scripts/fonts-fetch.mjs');
add('PROGRAM-SPEC.md קיים', existsSync(join(ROOT, 'PROGRAM-SPEC.md')), '');

// 7. פורט התצוגה (4173) — רק מידע: תפוס זה בסדר אם שרת התצוגה רץ
const portFree = await new Promise((res) => {
  const s = createServer().once('error', () => res(false))
    .once('listening', () => s.close(() => res(true)))
    .listen(4173, '127.0.0.1');
});
add('פורט 4173 (תצוגה)', true, portFree ? 'פנוי' : 'תפוס — כנראה שרת התצוגה רץ, זה תקין');

// 8. רשת החוצה (ל-drift) — לא מפיל, רק מדווח
let netOk = false;
try {
  const r = await fetch('https://firestore.googleapis.com/', { signal: AbortSignal.timeout(4000) });
  netOk = r.status > 0;
} catch { /* אין רשת */ }
add('רשת אל Firestore (ל-drift)', true, netOk ? 'זמינה' : 'לא זמינה — drift ידווח ⚠');

const bad = checks.filter((c) => !c.ok);
console.log(pad('בדיקה', 32) + pad('מצב', 5) + 'הערה');
console.log('─'.repeat(64));
for (const c of checks) console.log(pad(c.name, 32) + pad(c.ok ? '✓' : '✗', 5) + c.note);
console.log('\n' + (bad.length ? `✗ ${bad.length} בעיות — הסביבה לא שלמה` : '✓ הסביבה שלמה — כל הכלים ירוצו'));
process.exit(bad.length ? 1 : 0);
