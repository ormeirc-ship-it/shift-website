// בדיקות מבנה על ה-HTML עצמו - בלי דפדפן, ריצה במילישניות.
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
  // בלי הערות - ‏<img> בתוך הערת-תיעוד אינו תמונה (אותו שיעור כמו
  // בבדיקת ה-image-set ב-compat: סורקים קוד חי, לא תיעוד)
  const live = html.replace(/<!--[\s\S]*?-->/g, '');
  const imgs = live.match(/<img[^>]*>/g) || [];
  assert.ok(imgs.length >= 10, 'פחות מדי תמונות - משהו נמחק?');
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
  assert.ok(refs.size > 10, 'כמעט אין הפניות לנכסים - הבדיקה כנראה שבורה');
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

test('הפלטה והפונט נעולים - לא הוחלפו', () => {
  assert.match(css, /--navy:\s*#18163B/i, 'הנייבי השתנה');
  assert.match(css, /--sky:\s*#5CBBF0/i, 'התכלת השתנה');
  assert.match(css, /--paper:\s*#F6F5F2/i, 'ה-paper השתנה');
  assert.match(css, /font-family:\s*'Assistant'/, 'משפחת הגופן השתנתה');
  assert.ok(!/Frank Ruhl|Heebo|Rubik|Karantina|Amatic/i.test(css), 'נוסף פונט חלופי');
});

test('התבניות שהוסרו לא חזרו', () => {
  const labels = (html.match(/class="label/g) || []).length;
  assert.ok(labels <= 1, `${labels} לייבלים - היו אמורים להישאר לכל היותר 1`);
  assert.equal((html.match(/class="sec-num"/g) || []).length, 0, 'מספור הסקשנים חזר');
  assert.ok(!/grad-text/.test(html) && !/\.grad-text\s*\{/.test(css), '.grad-text חזר');
});

test('רשתות הביטחון של מסך הפתיחה קיימות', () => {
  assert.match(html, /preloader-done/, 'אין מנגנון שחרור למסך הפתיחה');
  assert.match(html, /onload="document\.documentElement\.classList\.add\('preloader-done'\)/,
    'תמונת הגיבוי כבר לא משחררת את מסך הפתיחה - ברשת איטית זה שניות של מסך ריק');
  const m = html.match(/classList\.add\('preloader-done'\);[\s\S]*?\},\s*(\d+)\)/);
  assert.ok(m && +m[1] <= 2500, 'רשת הביטחון ב-head ארוכה מ-2.5 שניות');
});

test('שני נכסי הלוגו קיימים בניווט (בלי פילטר CSS)', () => {
  assert.match(html, /logo-on-dark/, 'הלוגו הבהיר נעלם מהניווט');
  assert.match(html, /logo-on-light/, 'הלוגו הכהה נעלם מהניווט');
  assert.ok(!/filter:\s*invert/i.test(css), 'הלוגו עבר פילטר CSS - אסור לפי חוקי המותג');
});

test('בלי JS העמוד שמיש: הפתיח מגודר, ה-reveal לא קובר תוכן, אביזרי-JS חבויים', () => {
  // פריט 13. מסך הפתיחה מוצג רק תחת html.js - מבקר בלי JS לא ננעל מאחוריו
  assert.match(css, /html\.js \.preloader \{ display: flex/,
    'שער ה-no-JS של מסך הפתיחה נעלם');
  // כל חוק שמסתיר .reveal חייב שער html.js - בלעדיו תוכן נקבר לתמיד בלי JS
  for (const block of css.split('}')) {
    if (/\.reveal[^{]*\{/.test(block) && /opacity:\s*0/.test(block)) {
      assert.match(block, /html\.js/, '.reveal מוסתר בלי שער js: ' + block.trim().slice(0, 80));
    }
  }
  // כפתור הדילוג של הצלילה נחשף רק ע"י JS - ב-HTML הוא חייב hidden
  assert.match(html, /id="diveSkip"[^>]*\bhidden\b/, 'diveSkip גלוי בלי JS אבל מת בלי JS');
});

test('bfcache: אין unload/beforeunload, ויש שיקום ב-pageshow', () => {
  // פריט 14. מאזין unload פוסל את העמוד מה-bfcache - חזרה עם Back תיטען מאפס
  const motion = readFileSync(resolve(ROOT, 'js/motion.js'), 'utf8');
  const main = readFileSync(resolve(ROOT, 'js/main.js'), 'utf8');
  for (const [name, src] of [['motion.js', motion], ['main.js', main]]) {
    assert.ok(!/addEventListener\(\s*['"](?:before)?unload['"]/.test(src),
      name + ' רושם מאזין unload - פוסל את העמוד מ-bfcache');
  }
  assert.match(motion, /pageshow/, 'motion.js בלי שיקום pageshow (רענון ScrollTrigger)');
  assert.match(main, /pageshow/, 'main.js בלי שיקום pageshow (סגירת תפריט + שחרור נעילה)');
});

test('כל אפקט hover מגודר ב-hover:hover - טאפ במגע לא משאיר אפקט תקוע', () => {
  // פריט 15. בונה מפת עומק: כל שורת :hover חייבת לשבת בתוך @media (hover: hover),
  // חוץ ממנטרלים מפורשים (transform: none).
  const lines = css.split('\n');
  let depth = 0;
  const guardDepths = [];
  lines.forEach((line, i) => {
    if (/@media[^{]*hover:\s*hover/.test(line)) guardDepths.push(depth);
    depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    while (guardDepths.length && depth <= guardDepths[guardDepths.length - 1]) guardDepths.pop();
    if (/:hover/.test(line) && !/@media/.test(line) && !/transform:\s*none/.test(line)) {
      assert.ok(guardDepths.length > 0,
        `שורה ${i + 1}: חוק :hover מחוץ ל-@media (hover: hover) - יתקע על מגע: ${line.trim().slice(0, 70)}`);
    }
  });
});

test('גיבויי תאימות במקומם: url() לפני image-set, ‏vh לפני svh', () => {
  // פריט 16. שני המקרים שבהם הצהרה נפסלת בדפדפן ישן וגוררת מסך שבור -
  // חייבים שורת גיבוי שקודמת להם באותו בלוק. הערות מוסרות קודם -
  // אזכור הפיצ'ר בהערה אינו שימוש בו.
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const block of bare.split('}')) {
    if (/image-set\(/.test(block)) {
      const before = block.slice(0, block.indexOf('image-set'));
      assert.match(before, /background:[\s\S]*url\(/,
        'image-set בלי שורת גיבוי url() לפניו: ' + block.trim().slice(0, 60));
    }
    if (/100svh/.test(block)) {
      assert.match(block, /100vh/,
        'svh בלי גיבוי vh באותו בלוק: ' + block.trim().slice(0, 60));
    }
  }
});

test('אין מקף ארוך במלל - הוראת OC ‏29.7 (חריג יחיד: סקשן ה-data הנעול)', () => {
  // "מקף ארוך לא נכנס יותר לשום מלל חדש". תוכן 21 הימים נשאב מ-data.js
  // החי (מקור-אמת ש-verify-program בודק 1:1) - ולכן מוחרג עד הכרעה
  // נפרדת של OC מול הפלטפורמה.
  const progStart = html.indexOf('<section class="program');
  const progEnd = html.indexOf('<section class="events');
  assert.ok(progStart > -1 && progEnd > progStart, 'סימוני סקשן המסלול זזו');
  const outside = html.slice(0, progStart) + html.slice(progEnd);
  const hit = outside.indexOf('—');
  assert.equal(hit, -1, 'מקף ארוך מחוץ לסקשן המסלול: "…' +
    outside.slice(Math.max(0, hit - 30), hit + 30) + '…"');
  const notFound = readFileSync(resolve(ROOT, '404.html'), 'utf8');
  assert.ok(!notFound.includes('—'), 'מקף ארוך ב-404.html');
});

test('לוגו ההגעה הכהה מגודר ב-no-preference - לקח סיבוב ב׳ של 0.5', () => {
  // הרגרסיה: הכלל display:block ישב אחרי בלוק ה-reduce באותה ספציפיות
  // וגבר בקסקדה - שני לוגואים יחד במצב שקט. כאן נאכף שכל display:block
  // על arrival-logo-dark יושב בתוך no-preference.
  const lines = css.split('\n');
  let depth = 0;
  const guards = [];
  let inDarkRule = false, ruleGuarded = false;
  lines.forEach((line, i) => {
    if (/@media[^{]*no-preference/.test(line)) guards.push(depth);
    depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    while (guards.length && depth <= guards[guards.length - 1]) guards.pop();
    if (/\.arrival-logo-dark[^{]*\{/.test(line)) { inDarkRule = true; ruleGuarded = guards.length > 0; }
    if (inDarkRule && /display:\s*block/.test(line)) {
      assert.ok(ruleGuarded,
        `שורה ${i + 1}: ‏arrival-logo-dark מקבל display:block מחוץ ל-no-preference - ידליק שני לוגואים במצב שקט`);
    }
    if (inDarkRule && /\}/.test(line)) inDarkRule = false;
  });
});

test('היררכיית כותרות: h1 יחיד, בלי דילוגי-רמה כלפי מטה', () => {
  // פריט 32. קורא-מסך מנווט לפי המדרגות; h2→h4 הוא בור.
  const levels = [...html.matchAll(/<h([1-4])[\s>]/g)].map((m) => +m[1]);
  assert.equal(levels.filter((l) => l === 1).length, 1, 'חייב בדיוק h1 אחד');
  let prev = 0;
  levels.forEach((l, i) => {
    assert.ok(l <= prev + 1,
      `כותרת #${i + 1}: קפיצה h${prev}→h${l} - רמה דולגה`);
    prev = l;
  });
});

test('RTL מוקשח: בלי מאפייני-כיוון פיזיים חדשים ב-CSS', () => {
  // פריט 33. העמוד RTL; מאפיין פיזי חדש (margin-left וכו') כמעט תמיד
  // באג-כיוון בהמתנה. הקיימים היחידים: left/top על נקודת העכבר -
  // מרחב-מסך אמיתי (JS כותב קואורדינטות), לא זרימת טקסט.
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal((bare.match(/margin-(left|right)\s*:/g) || []).length, 0, 'margin פיזי נכנס - להשתמש ב-margin-inline-*');
  assert.equal((bare.match(/padding-(left|right)\s*:/g) || []).length, 0, 'padding פיזי נכנס - להשתמש ב-padding-inline-*');
  assert.equal((bare.match(/text-align:\s*(left|right)\b/g) || []).length, 0, 'text-align פיזי - להשתמש ב-start/end');
  // left:/right: מיקום - מותר רק בבלוק נקודת העכבר
  const blocks = bare.split('}');
  for (const b of blocks) {
    if (/(^|[^-])\b(left|right)\s*:/.test(b) && !/cursor-dot/.test(b)) {
      assert.fail('מיקום פיזי מחוץ לנקודת העכבר: ' + b.trim().slice(0, 70));
    }
  }
});
