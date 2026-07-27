#!/usr/bin/env node
/**
 * fonts-fetch.mjs — self-host לגופן Assistant (פריט 18).
 *
 * מוריד מגוגל את קבצי ה-woff2 המפוצלים (subset עברית + לטינית בסיסית,
 * הם כבר מפוצלים כך אצלם), שומר ב-assets/fonts/, ומחולל css/fonts.css
 * עם אותם unicode-range — כך שהדפדפן ממשיך להוריד רק את מה שבשימוש.
 * הרווח: בלי preconnect כפול ובלי סבב CSS חיצוני — הכול מהמקור שלנו.
 *
 * מורץ ידנית כשמשנים משקלים. זה כלי אספקה, לא בדיקה.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/env.mjs';

const WEIGHTS = [200, 300, 400, 600, 700];
const CSS_URL = 'https://fonts.googleapis.com/css2?family=Assistant:wght@' +
  WEIGHTS.join(';') + '&display=swap';
// UA של כרום כדי לקבל woff2 (בלעדיו גוגל מחזירה פורמטים ישנים)
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0entifier Safari/537.36';

const SUBSETS = {
  hebrew: /U\+0590-05FF/i,
  latin: /U\+0000-00FF/i,
};

const res = await fetch(CSS_URL, { headers: { 'User-Agent': UA } });
if (!res.ok) { console.error('✗ גוגל החזירה ' + res.status); process.exit(1); }
const css = await res.text();

// כל בלוק @font-face: הערת subset מעליו, ואז ההצהרות
const blocks = [...css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face \{([^}]+)\}/g)];
const outDir = join(ROOT, 'assets/fonts');
mkdirSync(outDir, { recursive: true });

let outCss = `/* Assistant — self-host (פריט 18). מחולל ע"י scripts/fonts-fetch.mjs —
   לא לערוך ביד. ‏unicode-range נשמר מהמקור: הדפדפן מוריד רק subset שבשימוש.
   font-display: swap — טקסט במערכת עד שהגופן מגיע, בלי מסך ריק. */\n`;
let files = 0;

for (const [, subset, body] of blocks) {
  const want = Object.entries(SUBSETS).find(([name, re]) => name === subset && re.test(body));
  if (!want) continue;
  const weight = body.match(/font-weight:\s*(\d+)/)[1];
  const url = body.match(/src:\s*url\((https:[^)]+\.woff2)\)/)[1];
  const range = body.match(/unicode-range:\s*([^;]+);/)[1].trim();
  const file = `assistant-${weight}-${subset}.woff2`;
  const bin = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
  writeFileSync(join(outDir, file), bin);
  files++;
  console.log(`✓ ${file} (${(bin.length / 1024).toFixed(0)}KB)`);
  outCss += `@font-face {
  font-family: 'Assistant';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url('../assets/fonts/${file}') format('woff2');
  unicode-range: ${range};
}\n`;
}

writeFileSync(join(ROOT, 'css/fonts.css'), outCss);
console.log(`\n✓ ${files} קבצים → assets/fonts/ · css/fonts.css חוּלל`);
