#!/usr/bin/env node
/**
 * compat.mjs — תאימות דפדפנים (פריט T8).
 * אין כאן ספארי ופיירפוקס להריץ, ולכן הכלי לא מתיימר לבדוק אותם.
 * מה שהוא כן עושה: מאתר כל פיצ'ר שהאתר משתמש בו ושתמיכתו אינה מלאה,
 * ובודק לכל אחד — **האם קיים fallback בקוד**. פיצ'ר בלי fallback הוא
 * הימור; פיצ'ר עם fallback הוא החלטה.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pad } from './lib/env.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const css = readFileSync(resolve(ROOT, 'css/style.css'), 'utf8');
const js = ['js/motion.js', 'js/main.js'].map((f) => readFileSync(resolve(ROOT, f), 'utf8')).join('\n');
const all = html + css + js;

const CHECKS = [
  { name: 'WebP', used: /\.webp/.test(all), risk: 'ספארי <14, אנדרואיד ישן',
    fallback: /<picture>/.test(html) && /image-set\(/.test(css),
    how: '<picture> עם JPG, ו-image-set ברקעי CSS' },
  { name: 'HEVC alpha (.mov)', used: /hevc\.mov/.test(all), risk: 'רק ספארי; במובייל דווח מלבן שחור',
    fallback: /getImageData/.test(js),
    how: 'בדיקת פיקסלים אחרי טעינה; כשל → לוגו סטטי' },
  { name: 'backdrop-filter', used: /backdrop-filter/.test(css), risk: 'פיירפוקס ישן',
    fallback: /-webkit-backdrop-filter/.test(css) && /background:\s*rgba/.test(css),
    how: 'תחילית -webkit- + רקע rgba אטום מאחוריו' },
  { name: 'text-wrap: balance/pretty', used: /text-wrap:/.test(css), risk: 'פיירפוקס/ספארי ישנים',
    fallback: true, how: 'שיפור בלבד — דפדפן שלא תומך מתעלם ומקבל שבירה רגילה' },
  { name: 'IntersectionObserver', used: /IntersectionObserver/.test(js), risk: 'דפדפנים עתיקים',
    fallback: /'IntersectionObserver' in window/.test(js),
    how: 'בדיקת קיום; בלעדיו — ScrollTrigger או תוכן גלוי מראש' },
  { name: 'MutationObserver', used: /MutationObserver/.test(js), risk: 'נמוך',
    fallback: /'MutationObserver' in window/.test(js), how: 'בדיקת קיום' },
  { name: 'canvas 2d', used: /getContext\('2d'/.test(js), risk: 'נמוך',
    fallback: /dive-still/.test(html), how: 'תמונת גיבוי ב-HTML, גלויה עד שהקנבס מצייר' },
  { name: 'position: sticky', used: /position:\s*sticky/.test(css), risk: 'נמוך',
    fallback: /prefers-reduced-motion[\s\S]*?position:\s*(static|relative)/.test(css),
    how: 'במצב מופחת-תנועה חוזר ל-relative' },
  { name: 'CSS custom properties', used: /--navy:/.test(css), risk: 'נמוך',
    fallback: /var\(--navy-deep,\s*#/.test(css), how: 'ערך גיבוי בתוך var() במקומות הקריטיים' },
  { name: 'fetchpriority', used: /fetchpriority/.test(html), risk: 'פיירפוקס',
    fallback: true, how: 'רמז בלבד — התעלמות ממנו לא משנה נכונות' },
  { name: 'image-set()', used: /image-set\(/.test(css), risk: 'תחביר ישן בספארי',
    fallback: /-webkit-image-set|url\([^)]*\.jpg/.test(css), how: 'JPG כשכבה אחרונה באותו background' },
  // הבדיקה חייבת להיות פר-הצהרה. הגרסה הראשונה חיפשה 100vh בכל הקובץ
  // ומצאה אותו במקום אחר לגמרי — כלומר דיווחה "יש גיבוי" כשלא היה.
  { name: 'svh units', used: /\d+svh/.test(css), risk: 'ספארי <15.4 — ההצהרה נפסלת כולה',
    fallback: (() => {
      const svh = [...css.matchAll(/([ \t]*)(min-height|height):\s*\d+svh;/g)];
      return svh.length > 0 && svh.every((m) => {
        const before = css.slice(Math.max(0, m.index - 160), m.index);
        return new RegExp(m[2] + ':\\s*\\d+vh;\\s*(\\/\\*[^*]*\\*\\/)?\\s*$').test(before);
      });
    })(),
    how: 'הצהרת vh זהה מיד לפניה, באותו כלל' },
  { name: 'ES6 (arrow/const/template)', used: /=>/.test(js), risk: 'IE11 בלבד — לא נתמך ממילא',
    fallback: true, how: 'מחוץ לתחום התמיכה המוצהר' },
  { name: 'prefers-reduced-motion', used: /prefers-reduced-motion/.test(css), risk: 'נמוך',
    fallback: true, how: 'שאילתה שלא נתמכת פשוט לא מופעלת' },
];

const used = CHECKS.filter((c) => c.used);
const risky = used.filter((c) => !c.fallback);

console.log('\n=== תאימות דפדפנים — פיצ\'רים בשימוש ===\n');
console.log(pad('פיצ\'ר', 26) + pad('סיכון', 30) + 'גיבוי');
console.log('─'.repeat(78));
used.forEach((c) => console.log(pad(c.name, 26) + pad(c.risk, 30) + (c.fallback ? '✓ ' + c.how : '✗ אין')));

console.log('\n' + (risky.length
  ? `✗ ${risky.length} פיצ'רים בלי גיבוי: ${risky.map((r) => r.name).join(', ')}`
  : `✓ כל ${used.length} הפיצ'רים בסיכון מכוסים בגיבוי`));
console.log('\n⚠ מה שהכלי הזה לא עושה: להריץ ספארי או פיירפוקס. אין כאן כאלה.');
console.log('  הוא מוודא שקיים מסלול נסיגה — לא שהמסלול נבדק בפועל.');
process.exit(risky.length ? 1 : 0);
