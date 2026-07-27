// בדיקות על שכבת התנועה. אלה לא בדיקות יחידה קלאסיות — הקוד הוא IIFE
// שרץ בדפדפן — אלא שמירה על החוזים שנשברו כאן בפועל, יותר מפעם אחת.
// כל בדיקה כאן מתעדת באג אמיתי שקרה, כדי שלא יחזור בשקט.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const motion = readFileSync(resolve(ROOT, 'js/motion.js'), 'utf8');
const main = readFileSync(resolve(ROOT, 'js/main.js'), 'utf8');

test('ההחלקה של הצלילה נשמרה (0.14) — היא מה שגורם לה להרגיש כמו נשימה', () => {
  assert.match(motion, /eased\s*\+=\s*\(target\s*-\s*eased\)\s*\*\s*0\.14/,
    'קבוע ההחלקה שונה — הצלילה תרגיש כמו קפיצות גלגלת');
});

test('אין מאזין scroll מקביל — הקלט מגיע רק מ-ScrollTrigger', () => {
  const listeners = [...motion.matchAll(/addEventListener\(\s*'scroll'/g)];
  assert.equal(listeners.length, 0,
    'נוסף מאזין scroll ב-motion.js; Lenis כבר מנהל את הגלילה');
});

test('R1: מצב הסרגל מחושב לפני כל early-return ב-render', () => {
  const body = motion.slice(motion.indexOf('function render()'));
  const end = body.indexOf('\n    }');
  const fn = body.slice(0, end);
  const litAt = fn.indexOf('var lit =');
  const returnAt = fn.indexOf('return;');
  assert.ok(litAt > -1, 'חישוב lit נעלם מ-render');
  assert.ok(returnAt === -1 || litAt < returnAt,
    'ה-early-return חזר לשבת לפני חישוב hush/lit — זו בדיוק הרגרסיה R1: ' +
    'מבקר שמשתהה באור נועל את eased, והסרגל הבהיר נדבק על סקשן כהה');
});

test('R1: onScreen מגיע מ-IntersectionObserver ולא מ-onToggle של ScrollTrigger', () => {
  // ההשמה בפועל (לא ההצהרה) חייבת לבוא מתוך callback של IO
  assert.match(motion, /IntersectionObserver\(function \(entries\) \{\s*onScreen = entries\[0\]\.isIntersecting/,
    'onScreen חזר להסתמך על ScrollTrigger — הוא לא יורה בקפיצת עוגן, ' +
    'והצלילה נשארת מסומנת "על המסך" והסרגל הבהיר נדבק');
});

test('הפריים הראשון נטען לבדו, לפני שאר הרצף', () => {
  assert.match(motion, /loadFrame\(1,\s*function/,
    'הטעינה בשלבים בוטלה — 97 בקשות במקביל מרעיבות את הפריים הראשון ברשת איטית');
  assert.match(motion, /WINDOW\s*=\s*\d+/, 'חלון הבקשות המקבילות נעלם');
});

test('מובייל טוען את סט הפריימים שלו בלבד', () => {
  assert.match(motion, /MOBILE\s*\?\s*'m\/'\s*:\s*'d\/'/, 'ההפרדה בין סטי הפריימים נשברה');
  assert.match(motion, /MOBILE\s*\?\s*65\s*:\s*97/, 'ספירת הפריימים השתנתה');
});

test('סולם המסע נגזר מה-DOM ולא מרשימה קשיחה', () => {
  assert.ok(!/var JOURNEY\s*=\s*\[/.test(motion),
    'חזרה רשימת סלקטורים קשיחה — סקשן חדש יקבל מרווח ורוחב שבורים בשקט');
  assert.match(motion, /querySelectorAll\('body > section/, 'הגזירה מה-DOM נעלמה');
});

test('גוון הניווט לא קורא פריסה בזמן גלילה (layout thrash)', () => {
  const tone = main.slice(main.indexOf('גוון הניווט'));
  const scrollListeners = [...tone.matchAll(/addEventListener\('scroll'/g)];
  assert.equal(scrollListeners.length, 0,
    'חזר מאזין scroll בגוון הניווט — הגרסה הראשונה קראה getBoundingClientRect ' +
    'פעמיים בכל גלילה, וזה layout thrash');
});

test('R2: התצפיתנים נבנים מחדש בשינוי גודל', () => {
  assert.match(main, /addEventListener\('resize'/,
    'ה-rootMargin מקובע לגובה החלון בטעינה; סיבוב מסך מזיז את פס התצפית');
});

test('שומר הסף של הלוגו לא מסתמך על זיהוי דפדפן', () => {
  const logo = main.slice(main.indexOf('אנימציית הלוגו'), main.indexOf('אנימציות הופעה'));
  assert.ok(!/userAgent/.test(logo),
    'חזר זיהוי לפי UA — זו בדיוק החסימה הגורפת שהשאירה את רוב הקהל בלי אנימציה');
  assert.match(logo, /getImageData/, 'בדיקת הפיקסלים נעלמה');
});

test('כל אפקט חדש חייב חלופה שקטה', () => {
  const reducedInCss = (readFileSync(resolve(ROOT, 'css/style.css'), 'utf8')
    .match(/prefers-reduced-motion/g) || []).length;
  assert.ok(reducedInCss >= 8, `רק ${reducedInCss} בלוקי reduced-motion ב-CSS`);
  assert.match(motion, /REDUCED/, 'מנוע התנועה לא בודק reduced-motion');
});
