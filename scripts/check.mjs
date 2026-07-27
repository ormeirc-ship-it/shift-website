#!/usr/bin/env node
/**
 * check.mjs — השער המאוחד (פריט 10). מריץ את כל רשת הביטחון מהמהיר
 * לאיטי, אוסף תוצאה ומשך לכל שלב, ומדפיס טבלת סיכום אחת בסוף.
 * שלב שנכשל לא עוצר את השאר — ככה רואים את כל התמונה בריצה אחת.
 *
 * drift הוא שלב "רך": הוא תלוי ברשת חיצונית (Firestore החי); כשל שלו
 * מסומן ⚠ ולא מפיל את השער — אבל מודפס במלואו כדי שלא ייעלם.
 *
 * שימוש:  npm run check
 */
import { spawnSync } from 'node:child_process';
import { pad } from './lib/env.mjs';

const STEPS = [
  { name: 'test', desc: 'בדיקות node:test' },
  { name: 'verify', desc: 'תוכן 21 הימים מול המפרט' },
  { name: 'drift', desc: 'סחיפה מול Firestore החי', soft: true },
  { name: 'budget', desc: 'תקציב משקל' },
  { name: 'audit', desc: 'HTML/נכסים' },
  { name: 'a11y', desc: 'נגישות' },
  { name: 'console', desc: 'קונסול נקי' },
  { name: 'motion', desc: 'מופחת-תנועה' },
  { name: 'type', desc: 'טיפוגרפיה 5 רוחבים' },
  { name: 'overlap', desc: 'קריאוּת המסלול' },
  { name: 'vr', desc: 'רגרסיה ויזואלית' },
];

const results = [];
for (const step of STEPS) {
  const t0 = Date.now();
  process.stderr.write(`▸ ${step.name}…\n`);
  const r = spawnSync('npm', ['run', '--silent', step.name], {
    encoding: 'utf8', timeout: 10 * 60 * 1000,
  });
  const ok = r.status === 0;
  results.push({
    ...step, ok, ms: Date.now() - t0,
    tail: ok ? '' : ((r.stdout || '') + (r.stderr || '')).split('\n').slice(-14).join('\n'),
  });
}

console.log('\n' + '═'.repeat(58));
console.log(pad('שלב', 12) + pad('מצב', 6) + pad('משך', 9) + 'מה נבדק');
console.log('─'.repeat(58));
let hard = 0, soft = 0;
for (const r of results) {
  const mark = r.ok ? '✓' : r.soft ? '⚠' : '✗';
  if (!r.ok) r.soft ? soft++ : hard++;
  console.log(pad(r.name, 12) + pad(mark, 6) + pad((r.ms / 1000).toFixed(1) + 'ש׳', 9) + r.desc);
}
console.log('═'.repeat(58));
for (const r of results.filter((r) => !r.ok)) {
  console.log(`\n${r.soft ? '⚠' : '✗'} ${r.name} — סוף הפלט:\n${r.tail}`);
}
const total = results.reduce((s, r) => s + r.ms, 0);
console.log(`\n${hard ? '✗ ' + hard + ' שלבים נכשלו' : soft ? '⚠ עבר עם ' + soft + ' אזהרות רכות' : '✓ כל השער ירוק'} · ${(total / 1000 / 60).toFixed(1)} דקות`);
process.exit(hard ? 1 : 0);
