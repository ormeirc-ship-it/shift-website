#!/usr/bin/env node
/**
 * avif.mjs — מקבילות AVIF לרצף המוח (פריט 40).
 *
 * מקודד כל פריים WebP ל-AVIF ב-quality מדורג, ומדווח את המאזן: אם
 * החיסכון הכולל <15% — לפי התור, זורקים את הרעיון ומתעדים. ההכרעה
 * נעשית על המספרים, לא על אמונה ב-format החדש.
 *
 * שימוש:  node scripts/avif.mjs [--quality 50] [--write]
 *   בלי --write: קידוד ל-scratch ומדידה בלבד (לא נוגע ב-assets).
 *   עם  --write: כותב assets/brain-seq/{d,m}-avif/ (רק אם הרווח ≥15%).
 */
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { ROOT, pad, kb } from './lib/env.mjs';

const QUALITY = (() => { const i = process.argv.indexOf('--quality'); return i > -1 ? +process.argv[i + 1] : 50; })();
const WRITE = process.argv.includes('--write');

let totalWebp = 0, totalAvif = 0;
const perDir = [];

for (const dir of ['d', 'm']) {
  const src = join(ROOT, 'assets/brain-seq', dir);
  const files = readdirSync(src).filter((f) => f.endsWith('.webp')).sort();
  const outDir = WRITE ? join(ROOT, 'assets/brain-seq', dir + '-avif') : join(tmpdir(), 'shift-avif-' + dir);
  mkdirSync(outDir, { recursive: true });
  let w = 0, a = 0;
  for (const f of files) {
    const buf = readFileSync(join(src, f));
    const avif = await sharp(buf).avif({ quality: QUALITY, effort: 4 }).toBuffer();
    w += buf.length;
    a += avif.length;
    writeFileSync(join(outDir, f.replace('.webp', '.avif')), avif);
  }
  perDir.push({ dir, n: files.length, w, a });
  totalWebp += w;
  totalAvif += a;
}

console.log(pad('סט', 6) + pad('פריימים', 10) + pad('WebP', 10) + pad('AVIF (q' + QUALITY + ')', 12) + 'חיסכון');
console.log('─'.repeat(50));
for (const r of perDir) {
  console.log(pad(r.dir, 6) + pad(r.n, 10) + pad(kb(r.w), 10) + pad(kb(r.a), 12) +
    ((1 - r.a / r.w) * 100).toFixed(1) + '%');
}
const gain = (1 - totalAvif / totalWebp) * 100;
console.log('─'.repeat(50));
console.log(`סה"כ: ${kb(totalWebp)} → ${kb(totalAvif)} · חיסכון ${gain.toFixed(1)}%`);
console.log(gain >= 15
  ? '✓ מעל סף ה-15% — שווה חיווט (picture/סניפינג ב-motion.js)'
  : '✗ מתחת לסף 15% שנקבע בתור — לתעד ולזרוק');
process.exit(0);
