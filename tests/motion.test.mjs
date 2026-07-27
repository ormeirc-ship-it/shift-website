// בדיקות על שכבת התנועה. אלה לא בדיקות יחידה קלאסיות — הקוד הוא IIFE
// שרץ בדפדפן — אלא שמירה על החוזים שנשברו כאן בפועל, יותר מפעם אחת.
// כל בדיקה כאן מתעדת באג אמיתי שקרה, כדי שלא יחזור בשקט.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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
    'הטעינה בשלבים בוטלה — כל הבקשות במקביל מרעיבות את הפריים הראשון ברשת איטית');
  assert.match(motion, /WINDOW\s*=\s*\d+/, 'חלון הבקשות המקבילות נעלם');
});

test('מובייל טוען את סט הפריימים שלו בלבד, והספירה תואמת לקבצים', () => {
  assert.match(motion, /MOBILE\s*\?\s*'m\/'\s*:\s*'d\/'/, 'ההפרדה בין סטי הפריימים נשברה');
  // B2 (27.7): הרצף דולל 97→60. הספירה בקוד חייבת לתאום את הקבצים בפועל —
  // ספירה גבוהה מדי = draw על תמונות שלא קיימות; נמוכה מדי = הרצף נקטע.
  const count = (dir) => readdirSync(resolve(ROOT, 'assets/brain-seq/' + dir))
    .filter((f) => /^f\d{3}\.webp$/.test(f)).length;
  const m = motion.match(/MOBILE\s*\?\s*(\d+)\s*:\s*(\d+)/);
  assert.ok(m, 'הצהרת COUNT נעלמה מ-motion.js');
  assert.equal(Number(m[1]), count('m'), 'ספירת המובייל בקוד לא תואמת את הקבצים');
  assert.equal(Number(m[2]), count('d'), 'ספירת הדסקטופ בקוד לא תואמת את הקבצים');
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

test('R5: איש לא נועל גלילה לפני החשיפה, והיציאה של מסך הפתיחה ב-CSS', () => {
  // הבאג: motion.js נעל overflow אחרי שה-onload של תמונת הגיבוי כבר סגר
  // את מסך הפתיחה — עמוד גלוי לגמרי שהגלילה בו מתה ל-800ms בלי שום סימן.
  // נמדד ב-27.7: 89–101 פריימים נעולים בכל מהירות רשת; ב-Slow 4G זה נחת
  // בשנייה השביעית. מותר לנעול רק בתפריט (main.js) — לא במנוע התנועה.
  assert.ok(!/overflow\s*=\s*'hidden'/.test(motion),
    'motion.js חזר לנעול גלילה — מבקר שהתמונה הקדימה אצלו את ה-JS יקבל עמוד קפוא');
  // והטקס עצמו חייב לשבת ב-CSS: כשהוא ישב ב-GSAP הוא רץ על אלמנט מוסתר,
  // כי המחלקה preloader-done תמיד הקדימה את חבילת התנועה.
  const css = readFileSync(resolve(ROOT, 'css/style.css'), 'utf8');
  assert.match(css, /html\.preloader-done \.preloader\s*\{[^}]*animation/,
    'יציאת מסך הפתיחה כבר לא ב-CSS — היא תחזור לרוץ בחושך על אלמנט display:none');
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  assert.ok(!/overflow\s*=\s*''/.test(html),
    'שחרור overflow עיוור חזר ל-index.html — הוא דורס את נעילת התפריט');
  // T11/R6: גם שחרור עיוור אסור — מאז T9 רק התפריט נוגע ב-overflow,
  // ושחרור "ליתר ביטחון" מוחק את הנעילה שלו מתחת לידיים.
  assert.ok(!/body\.style\.overflow/.test(motion),
    'motion.js חזר לגעת ב-overflow — הנגיעה היחידה המותרת היא בתפריט (main.js)');
});

test('B1: ערימת הקלפים מותנית במדידה, והקלפים אטומים', () => {
  const css = readFileSync(resolve(ROOT, 'css/style.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ''); // בלי הערות — שלא ייקראו כסלקטורים
  // הבאג: סטיקי לפי רוחב בלבד. קלף גבוה מחלון נמוך ננעץ בראשו והימים
  // התחתונים שלו לא קיבלו אף רגע קריא (על 1440×900 — ימים 4–7).
  // הרגקס תופס בלוקים פנימיים בלבד (selector בלי סוגריים) — עמיד ל-@media.
  const stickyRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => /position:\s*sticky/.test(m[2]))
    .map((m) => m[1])
    .filter((sel) => sel.includes('.week-card'));
  assert.ok(stickyRules.length > 0, 'הסטיקי של הקלפים נעלם מה-CSS');
  for (const sel of stickyRules) {
    assert.ok(sel.includes('html.stack-on'),
      'סטיקי על .week-card בלי שער stack-on — הערימה תופעל גם כשקלף לא נכנס במסך: ' + sel.trim());
  }
  // הבאג השני: רקע זכוכית. קלף מכוסה נראה דרך הקלף שמעליו.
  assert.match(css, /\.week-card\s*\{[^}]*background:\s*var\(--card-bg/,
    'רקע הקלפים חזר להיות שקוף — טקסט של קלף מכוסה ייראה דרך הקלף שמעליו');
  // והמדידה עצמה חייבת להתקיים ב-JS
  assert.match(motion, /stackFits/, 'מדידת ההתאמה של הערימה נעלמה מ-motion.js');
  assert.match(motion, /offsetHeight/, 'הגובה לא נמדד — השער יחליט בלי נתונים');
});
