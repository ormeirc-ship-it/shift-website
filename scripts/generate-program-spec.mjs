#!/usr/bin/env node
/**
 * generate-program-spec.mjs — מחולל את PROGRAM-SPEC.md ממקור האמת.
 *
 * CLAUDE.md קובע: "אם data.js השתנה, יש לחדש את PROGRAM-SPEC.md ממנו".
 * זה הכלי שעושה את זה — אף פעם לא לערוך את PROGRAM-SPEC.md ביד.
 *
 * מקור האמת: data.js של האפליקציה. סדר החיפוש זהה ל-verify-program.mjs:
 * ארגומנט → משתנה סביבה → עותק הריפו (זהה לפרוס) → העותק הישן ב-Documents.
 *
 * שימוש:  node scripts/generate-program-spec.mjs [path/to/data.js]
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, '..');

const CANDIDATES = [
  process.argv[2],
  process.env.SHIFT_DATA_JS,
  // עותק הריפו של הפלטפורמה — זהה בית-לבית ל-data.js שהאפליקציה החיה מגישה
  // (אומת ב-md5 מול https://shift-21-day-course-ceos.web.app/data.js ב-26.7.2026)
  resolve(homedir(), 'Desktop/SHIFT/shift platform main /shift-platform/קבצי קוד/data.js'),
  // עותק ישן (7.7.2026) — fallback אחרון בלבד
].filter(Boolean);

const DATA_JS = CANDIDATES.find((p) => existsSync(p));
if (!DATA_JS) {
  console.error('✗ לא מצאתי את data.js. נסיתי:');
  CANDIDATES.forEach((p) => console.error('  · ' + p));
  process.exit(2);
}

const raw = readFileSync(DATA_JS, 'utf8');
const md5 = createHash('md5').update(raw).digest('hex');

let days, weeks;
try {
  const ctx = createContext({
    localStorage: { getItem: () => null, setItem: () => {} },
    console,
  });
  runInContext(raw + '\n;globalThis.__D = DEFAULT_DAYS; globalThis.__W = WEEK_INTROS;', ctx);
  days = ctx.__D;
  weeks = ctx.__W;
} catch (err) {
  console.error(`✗ לא הצלחתי לקרוא את מקור האמת:\n  ${DATA_JS}\n  ${err.message}`);
  process.exit(2);
}

// המשפט הפותח של כל יום — השורה הראשונה של content, חתוכה במקום טבעי
const opener = (content, max = 170) => {
  const first = String(content || '')
    .split('\n')
    .map((l) => l.replace(/\*\*/g, '').trim())
    .find((l) => l.length > 0) || '';
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  const at = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('—'));
  return cut.slice(0, at > 60 ? at : max).trim() + '…';
};

const esc = (s) => String(s || '').replace(/\|/g, '\\|');

const today = new Date();
const stamp = `${today.getDate()}.${today.getMonth() + 1}.${today.getFullYear()}`;

const lines = [];
lines.push('# PROGRAM-SPEC — המפרט המחייב לסקשן "מסלול 21 הימים"');
lines.push('');
lines.push(`נוצר אוטומטית ב-${stamp} על ידי \`scripts/generate-program-spec.mjs\` מתוך:`);
lines.push('```');
lines.push(DATA_JS);
lines.push(`md5: ${md5}`);
lines.push('```');
lines.push('');
lines.push('**אל תערוך את הקובץ הזה ביד ואל תכתוב תוכן מהזיכרון.** אם data.js השתנה — הרץ את המחולל מחדש.');
lines.push('הכותרות למטה הן טקסט מדויק — להעתיק כמו שהוא. התקצירים הם המשפט הפותח של כל יום; מותר לקצר, אסור לנסח מחדש.');
lines.push('');
lines.push('אימות: `node scripts/verify-program.mjs`');
lines.push('');
lines.push('---');

for (const w of weeks) {
  lines.push('');
  lines.push(`## שבוע ${w.week} — כותרת מדויקת: «${w.title}»`);
  lines.push('');
  lines.push('**תיאור השבוע (מ-WEEK_INTROS):**');
  lines.push('');
  for (const p of String(w.description || '').split('\n')) {
    lines.push(p.trim() ? `> ${p.trim()}` : '>');
  }
  lines.push('');
  lines.push('| יום | כותרת מדויקת | פתיח |');
  lines.push('|---|---|---|');
  const weekDays = days.filter((d) => Math.ceil(d.day / 7) === w.week);
  for (const d of weekDays) {
    const restMark = d.rest ? ' 🌿' : '';
    lines.push(`| ${d.day}${restMark} | ${esc(d.title)} | ${esc(opener(d.content))} |`);
  }
}

lines.push('');
lines.push('---');
lines.push('');
lines.push('## ימי מנוחה');
lines.push('');
lines.push(`במקור, \`rest: true\` מסומן על הימים: ${days.filter((d) => d.rest).map((d) => d.day).join(', ')} — ורק עליהם.`);
lines.push('');
lines.push('## הצ\'יפים הצפים באתר — אימות מול המקור');
lines.push('');
for (const n of [8, 12, 17]) {
  const d = days.find((x) => x.day === n);
  if (d) lines.push(`- יום ${n} · «${d.title}»`);
}
lines.push('');

writeFileSync(resolve(SITE, 'PROGRAM-SPEC.md'), lines.join('\n'), 'utf8');
console.log(`✓ PROGRAM-SPEC.md חודש מ:\n  ${DATA_JS}\n  (${days.length} ימים, ${weeks.length} שבועות, md5 ${md5.slice(0, 8)}…)`);
