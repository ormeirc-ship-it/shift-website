// בדיקות מבנה על ה-HTML עצמו — בלי דפדפן, ריצה במילישניות.
// אלה החוזים שאם יישברו בשקט, אף אחד לא ישים לב עד שמבקר יראה עמוד שבור.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const css = readFileSync(resolve(ROOT, 'css/style.css'), 'utf8');

test('כל הסקשנים קיימים ובסדר הנכון', () => {
  const order = ['.dive', '.statement', '#products', '#method', '#habits',
    '#breathe', '#path', '#program', '#events', '#story', '#outcomes', '.closing'];
  let last = -1;
  for (const sel of order) {
    const needle = sel.startsWith('#') ? `id="${sel.slice(1)}"` : `class="${sel.slice(1)}`;
    const at = html.indexOf(needle);
    assert.ok(at > -1, `הסקשן ${sel} נעלם מה-HTML`);
    assert.ok(at > last, `הסקשן ${sel} אינו במקומו בסדר`);
    last = at;
  }
});

test('תגיות פתוחות וסגורות מאוזנות', () => {
  for (const tag of ['section', 'div', 'picture', 'article', 'ol', 'ul']) {
    const open = (html.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
    const close = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    assert.equal(open, close, `<${tag}> לא מאוזן: ${open} פתיחות מול ${close} סגירות`);
  }
});

test('כל תמונה עם alt ועם מידות', () => {
  const imgs = html.match(/<img[^>]*>/g) || [];
  assert.ok(imgs.length >= 10, 'פחות מדי תמונות — משהו נמחק?');
  for (const img of imgs) {
    assert.ok(/\salt=/.test(img), `תמונה בלי alt: ${img.slice(0, 70)}`);
    assert.ok(/\swidth="\d+"/.test(img) && /\sheight="\d+"/.test(img),
      `תמונה בלי מידות (קפיצת פריסה): ${img.slice(0, 70)}`);
  }
});

test('כל נכס שמופנה אליו קיים על הדיסק', () => {
  const refs = new Set();
  for (const m of html.matchAll(/(?:src|href|srcset)="(assets\/[^"]+)"/g)) refs.add(m[1]);
  for (const m of css.matchAll(/url\(["']?\.\.\/(assets\/[^"')]+)/g)) refs.add(m[1]);
  assert.ok(refs.size > 10, 'כמעט אין הפניות לנכסים — הבדיקה כנראה שבורה');
  for (const r of refs) {
    assert.ok(existsSync(resolve(ROOT, r)), `נכס חסר: ${r}`);
  }
});

test('קישורי העוגנים מצביעים על יעדים קיימים', () => {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/href="#([^"]+)"/g)) {
    assert.ok(ids.has(m[1]), `עוגן מת: #${m[1]}`);
  }
});

test('כל קישור וכפתור מקבל שם נגיש', () => {
  for (const m of html.matchAll(/<a\s[^>]*>([\s\S]*?)<\/a>/g)) {
    const [tag] = m[0].split('>');
    const inner = m[1].replace(/<[^>]+>/g, '').trim();
    const hasName = inner || /aria-label="/.test(tag) || /alt="[^"]+"/.test(m[0]);
    assert.ok(hasName, `קישור בלי שם נגיש: ${m[0].slice(0, 80)}`);
  }
});

test('הפלטה והפונט נעולים — לא הוחלפו', () => {
  assert.match(css, /--navy:\s*#18163B/i, 'הנייבי השתנה');
  assert.match(css, /--sky:\s*#5CBBF0/i, 'התכלת השתנה');
  assert.match(css, /--paper:\s*#F6F5F2/i, 'ה-paper השתנה');
  assert.match(css, /font-family:\s*'Assistant'/, 'משפחת הגופן השתנתה');
  assert.ok(!/Frank Ruhl|Heebo|Rubik|Karantina|Amatic/i.test(css), 'נוסף פונט חלופי');
});

test('התבניות שהוסרו לא חזרו', () => {
  const labels = (html.match(/class="label/g) || []).length;
  assert.ok(labels <= 1, `${labels} לייבלים — היו אמורים להישאר לכל היותר 1`);
  assert.equal((html.match(/class="sec-num"/g) || []).length, 0, 'מספור הסקשנים חזר');
  assert.ok(!/grad-text/.test(html) && !/\.grad-text\s*\{/.test(css), '.grad-text חזר');
});

test('רשתות הביטחון של מסך הפתיחה קיימות', () => {
  assert.match(html, /preloader-done/, 'אין מנגנון שחרור למסך הפתיחה');
  assert.match(html, /onload="document\.documentElement\.classList\.add\('preloader-done'\)/,
    'תמונת הגיבוי כבר לא משחררת את מסך הפתיחה — ברשת איטית זה שניות של מסך ריק');
  const m = html.match(/classList\.add\('preloader-done'\);[\s\S]*?\},\s*(\d+)\)/);
  assert.ok(m && +m[1] <= 2500, 'רשת הביטחון ב-head ארוכה מ-2.5 שניות');
});

test('שני נכסי הלוגו קיימים בניווט (בלי פילטר CSS)', () => {
  assert.match(html, /logo-on-dark/, 'הלוגו הבהיר נעלם מהניווט');
  assert.match(html, /logo-on-light/, 'הלוגו הכהה נעלם מהניווט');
  assert.ok(!/filter:\s*invert/i.test(css), 'הלוגו עבר פילטר CSS — אסור לפי חוקי המותג');
});
