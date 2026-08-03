#!/usr/bin/env node
/**
 * host-swap.mjs — החלפת כתובת-האירוח בכל קבצי-הריצה (T22 + יום-הדומיין).
 *
 * ‏T22 חשף שהרשימה גדולה מ"11 הכתובות": מלבד ה-origin המלא
 * (‏og/canonical/JSON-LD/sitemap/robots) יש גם הפניות-נתיב שמניחות את
 * תת-הנתיב ‏/shift-website/ - ‏404.html (שמוגש מכל נתיב ולכן אבסולוטי
 * בכוונה) ו-start_url במניפסט. באירוח-שורש (Firebase/דומיין) הן נשברות
 * בשקט - הכלי הזה מחליף את שתי המשפחות יחד, פעם אחת, בכל הקבצים.
 *
 * שימוש:
 *   node scripts/host-swap.mjs                          ← דו"ח בלבד (dry-run)
 *   node scripts/host-swap.mjs https://xxx.web.app      ← החלפה בפועל
 *   node scripts/host-swap.mjs https://shift.example    ← יום-הדומיין
 *
 * אחרי החלפה: npm run check מלא + אימות חי על הכתובת החדשה.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib/env.mjs';

const OLD_ORIGIN = 'https://ormeirc-ship-it.github.io/shift-website';
const OLD_PATH = '/shift-website/';

const newOrigin = process.argv[2] ? process.argv[2].replace(/\/$/, '') : null;
const DRY = !newOrigin;

// קבצי-הריצה בלבד - המסמכים (*.md) נשארים היסטוריה נכונה
const FILES = ['index.html', '404.html', 'sitemap.xml', 'robots.txt', 'site.webmanifest'];

let total = 0;
for (const f of FILES) {
  const p = resolve(ROOT, f);
  let s = readFileSync(p, 'utf8');
  const origins = (s.match(new RegExp(OLD_ORIGIN.replace(/[/.]/g, '\\$&'), 'g')) || []).length;
  // הפניות-נתיב שאינן חלק מ-origin מלא (כבר נספר למעלה)
  const paths = (s.match(/(?<!github\.io)\/shift-website\//g) || []).length;
  console.log(`${f}: ${origins} origin · ${paths} path`);
  total += origins + paths;
  if (!DRY) {
    s = s.split(OLD_ORIGIN).join(newOrigin);
    s = s.split(OLD_PATH).join('/');
    writeFileSync(p, s);
  }
}
console.log(DRY
  ? `\n— dry-run: ${total} מופעים. להחלפה: node scripts/host-swap.mjs <origin חדש>`
  : `\n✓ הוחלף ל-${newOrigin} (${total} מופעים). עכשיו: npm run check + אימות חי.`);
