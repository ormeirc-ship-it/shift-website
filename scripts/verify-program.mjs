#!/usr/bin/env node
/**
 * verify-program.mjs — מוודא שסקשן "מסלול 21 הימים" באתר תואם למקור האמת.
 *
 * מקור האמת: data.js של האפליקציה (DEFAULT_DAYS + WEEK_INTROS) בריפו הפלטפורמה,
 * שאומת (md5, 26.7.2026) כזהה בית-לבית ל-data.js שהאפליקציה החיה מגישה.
 *
 * הסנפשוט הישן ב-Documents הוסר כ-fallback ב-26.7.2026 והועבר ל-_ארכיון-מיושן-7.7.
 * אם הריפו לא נמצא — הסקריפט נכשל ברעש במקום לאמת מול מקור מת.
 *
 * שימוש:  node scripts/verify-program.mjs
 * יוצא עם קוד 1 אם יש אי-התאמה — אפשר לחבר ל-CI או להריץ לפני כל commit.
 */

import { readFileSync, existsSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, '..');

// נתיב ל-data.js: ארגומנט מהשורה, משתנה סביבה, או המיקומים המוכרים
const CANDIDATES = [
  process.argv[2],
  process.env.SHIFT_DATA_JS,
  process.env.DATA_JS, // כינוי — הסנדבוקס של Cowork מזין את זה (REVIEW 00:05 🟡)
  // עותק הריפו — זהה ל-data.js הפרוס באפליקציה החיה (אומת md5 ב-26.7.2026)
  resolve(homedir(), 'Desktop/SHIFT/shift platform main /shift-platform/קבצי קוד/data.js'),
  // אין fallback לסנפשוט הישן — הועבר ל-_ארכיון-מיושן-7.7 ב-26.7.2026.
  // מוטב להיכשל ברעש מאשר לאמת מול מקור מת (זה בדיוק מה שקרה ב-26.7).
].filter(Boolean);

const DATA_JS = CANDIDATES.find((p) => existsSync(p));
if (!DATA_JS) {
  console.error('✗ לא מצאתי את app/data.js. נסיתי:');
  CANDIDATES.forEach((p) => console.error('  · ' + p));
  console.error('\nהרץ עם נתיב מפורש:  node scripts/verify-program.mjs /path/to/app/data.js');
  process.exit(2);
}

// ── מקור האמת ────────────────────────────────────────────────────────
let days, weeks;
try {
  const ctx = createContext({
    localStorage: { getItem: () => null, setItem: () => {} },
    console,
  });
  runInContext(
    readFileSync(DATA_JS, 'utf8') +
      '\n;globalThis.__D = DEFAULT_DAYS; globalThis.__W = WEEK_INTROS;',
    ctx
  );
  days = ctx.__D;
  weeks = ctx.__W;
} catch (err) {
  console.error(`✗ לא הצלחתי לקרוא את מקור האמת:\n  ${DATA_JS}\n  ${err.message}`);
  process.exit(2);
}

// ── מה שכתוב באתר ────────────────────────────────────────────────────
const html = readFileSync(resolve(SITE, 'index.html'), 'utf8');

const norm = (s) =>
  String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/[‎‏]/g, '')
    .replace(/[""]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

// כל <li class="day-item"> עם מספר יום וכותרת
const siteDays = new Map();
const itemRe =
  /<li[^>]*class="[^"]*day-item[^"]*"[\s\S]*?<span[^>]*class="day-no"[^>]*>(\d+)<\/span>[\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>/g;
let m;
while ((m = itemRe.exec(html)) !== null) {
  siteDays.set(Number(m[1]), norm(m[2]));
}

const siteWeeks = [...html.matchAll(/<header[^>]*class="week-head"[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/g)]
  .map((x) => norm(x[1]));

// ── השוואה ───────────────────────────────────────────────────────────
const problems = [];

weeks.forEach((w, i) => {
  const expected = norm(w.title);
  const actual = siteWeeks[i];
  if (actual === undefined) problems.push(`שבוע ${w.week}: חסר באתר (צפוי "${expected}")`);
  else if (actual !== expected)
    problems.push(`שבוע ${w.week}: באתר "${actual}" · במקור "${expected}"`);
});

const rows = days.map((d) => {
  const expected = norm(d.title);
  const actual = siteDays.get(d.day);
  const ok = actual === expected;
  if (!ok) {
    problems.push(
      actual === undefined
        ? `יום ${d.day}: חסר באתר (צפוי "${expected}")`
        : `יום ${d.day}: באתר "${actual}" · במקור "${expected}"`
    );
  }
  return { day: d.day, ok, expected, actual: actual ?? '—' };
});

for (const day of siteDays.keys()) {
  if (!days.some((d) => d.day === day)) problems.push(`יום ${day}: קיים באתר אבל לא במקור`);
}

// ── פלט ──────────────────────────────────────────────────────────────
console.log('יום | סטטוס | באתר → במקור');
console.log('----+-------+' + '-'.repeat(60));
for (const r of rows) {
  const mark = r.ok ? '  ✓  ' : '  ✗  ';
  const detail = r.ok ? r.expected : `${r.actual}  →  ${r.expected}`;
  console.log(`${String(r.day).padStart(3)} |${mark}| ${detail}`);
}

const okCount = rows.filter((r) => r.ok).length;
console.log('\n' + '='.repeat(70));

if (problems.length === 0) {
  console.log(`✓ כל ${rows.length} הימים ושלושת השבועות תואמים למקור.`);
  process.exit(0);
}

console.log(`✗ ${okCount}/${rows.length} ימים תואמים. ${problems.length} אי-התאמות:\n`);
problems.forEach((p) => console.log('  · ' + p));
console.log(`\nמקור האמת: ${DATA_JS}`);
console.log('אל תכתוב את התוכן מחדש מהזיכרון — גזור אותו מהקובץ הזה.');
process.exit(1);
