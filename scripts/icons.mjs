// מחולל אייקונים מנכס המותג העגול (asset10.png, 1551²) — משטיח על נייבי
// המותג כי iOS מציג שקיפות כשחור. מייצר 16/32/180/512 ל-assets/brand/icons/.
// דטרמיניסטי: אותו קלט → אותם קבצים. מורץ ידנית כשנכס המקור משתנה.
import puppeteer from 'puppeteer-core';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, chromePath } from './lib/env.mjs';

const SRC = join(ROOT, 'assets/brand/asset10.png');
const OUT = join(ROOT, 'assets/brand/icons');
const NAVY = '#18163B';
const SIZES = [16, 32, 180, 512];

await mkdir(OUT, { recursive: true });
const b64 = (await readFile(SRC)).toString('base64');

const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new' });
const page = await browser.newPage();
for (const size of SIZES) {
  const png = await page.evaluate(async ({ b64, size, navy }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = navy;
    ctx.fillRect(0, 0, size, size);
    // העיגול ממלא ~92% מהמסגרת — שוליים קטנים כדי שמסכת הפינות של iOS לא תחתוך בו
    const m = size * 0.04;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, m, m, size - 2 * m, size - 2 * m);
    return c.toDataURL('image/png').split(',')[1];
  }, { b64, size, navy: NAVY });
  const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
  await writeFile(join(OUT, name), Buffer.from(png, 'base64'));
  console.log('✓', name);
}
await browser.close();
