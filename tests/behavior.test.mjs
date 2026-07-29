// חוזי התנהגות סטטיים על מכונות המצבים (פריט 24) - בלי דפדפן.
// אלה תופסים מחיקה/שבירה של הלוגיקה; ההרצה החיה שלהן - ב-npm run e2e
// (פריט 27), שם הנשימה נלחצת באמת והתפריט נפתח באמת.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(resolve(ROOT, 'js/main.js'), 'utf8');
const motion = readFileSync(resolve(ROOT, 'js/motion.js'), 'utf8');

test('מכונת הנשימה: שלושה סבבים, נעילת לחיצה-כפולה, וסיום שמוביל הלאה', () => {
  assert.match(main, /TOTAL = 3/, 'מספר הסבבים השתנה מ-3');
  assert.match(main, /if \(running\) return;/, 'נעילת הלחיצה בזמן ריצה נעלמה - לחיצה כפולה תערבב סבבים');
  assert.match(main, /round < TOTAL \? runRound\(round \+ 1\) : finish\(\)/,
    'שרשרת הסבבים נשברה');
  // המסלול השקט חייב להתקיים במקביל למסלול gsap - אחרת מופחת-תנועה נתקע
  assert.match(main, /hasGsap && !reduced/, 'הסתעפות המסלול השקט נעלמה');
  assert.match(main, /setTimeout\(next, \d+\)/, 'למסלול השקט אין התקדמות עצמאית');
  // הסיום: משחרר את הכפתור, חושף את ההמשך, ומדווח
  for (const needle of ['btn.disabled = false', 'after.hidden = false', "track('breath_done'"]) {
    assert.ok(main.includes(needle), `הסיום איבד את: ${needle}`);
  }
});

test('התפריט: aria מסונכרן, נעילת גלילה משוחררת בכל דרכי הסגירה', () => {
  assert.match(main, /aria-expanded', String\(open\)/, 'aria-expanded לא מסונכרן למצב');
  assert.match(main, /overflow = open \? 'hidden' : ''/, 'נעילת הגלילה של התפריט השתנתה');
  // כל דרכי הסגירה: קישור, Escape, ו-bfcache
  assert.match(main, /link.addEventListener\('click', \(\) => setMenu\(false\)\)/,
    'קליק על קישור לא סוגר את התפריט');
  assert.match(main, /Escape/, 'אין סגירה ב-Escape');
  assert.match(main, /pageshow.*setMenu\(false\)/, 'שחזור bfcache לא סוגר תפריט תקוע');
  // ניהול פוקוס - פתיחה אל התפריט, סגירה חזרה לכפתור
  assert.match(main, /first.focus\(\{ preventScroll: true \}\)/, 'הפוקוס לא נכנס לתפריט');
  assert.match(main, /burger.focus\(\{ preventScroll: true \}\)/, 'הפוקוס לא חוזר לכפתור');
});

test('nav-tone: מקרי הקצה מכוסים - צלילה, קפיצת עוגן, ומצב-דבוק', () => {
  // R1 ההיסטורי: המצב מחושב לפני early-return (יש בדיקה ייעודית ב-motion.test);
  // כאן - שהצלילה מדווחת דרך הערוץ המשותף ולא נוגעת במחלקה ישירות
  assert.match(motion, /window\.__navTone.*\.set\('dive', lit\)/,
    'הצלילה עוקפת את ערוץ הטון המשותף');
  assert.match(motion, /lit !== litOn/, 'דיווח הטון לא מסונן לשינויים - ספאם בכל פריים');
  // ה-observer של הטון עובד על elementsFromPoint או רצועה - קפיצת עוגן
  // חייבת לקבל טון נכון מיד (הבאג של hush-verify)
  assert.match(main, /IntersectionObserver|elementsFromPoint/,
    'מנגנון קביעת הטון נעלם מ-main.js');
});
