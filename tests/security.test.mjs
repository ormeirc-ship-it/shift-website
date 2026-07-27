// חוזי אבטחת-אספקה על ה-HTML — בלי דפדפן.
// פריט 7: אין לנו סקריפטים מ-CDN (הכול vendored) ולכן SRI לא רלוונטי —
// הבדיקה כאן היא שהמצב הזה *נשאר* כך, ושכל target=_blank מוגן.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const pages = { 'index.html': read('index.html'), '404.html': read('404.html') };

test('אין סקריפטים חיצוniים — כולם מוגשים מהריפו (לכן אין צורך ב-SRI)', () => {
  for (const [name, html] of Object.entries(pages)) {
    for (const m of html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/g)) {
      assert.ok(!/^(https?:)?\/\//i.test(m[1]),
        `${name}: סקריפט חיצוני נכנס (${m[1]}) — או לארח אותו ב-assets/vendor או להוסיף integrity+crossorigin`);
    }
  }
});

test('כל קישור עם target=_blank נושא rel=noopener', () => {
  for (const [name, html] of Object.entries(pages)) {
    for (const m of html.matchAll(/<a\b[^>]*target=["']?_blank["']?[^>]*>/g)) {
      assert.match(m[0], /rel=["'][^"']*noopener/,
        `${name}: קישור _blank בלי noopener — ${m[0].slice(0, 90)}`);
    }
  }
});

test('קישורים חיצוניים יוצאים רק ליעדים המוכרים', () => {
  // רשימה סגורה: אינסטגרם והאפליקציה. יעד חדש = החלטה מודעת, לא תוצר לוואי.
  const allowed = ['www.instagram.com', 'shift-21-day-course-ceos.web.app',
    'fonts.googleapis.com', 'fonts.gstatic.com', 'schema.org',
    'ormeirc-ship-it.github.io', 'www.sitemaps.org'];
  for (const [name, html] of Object.entries(pages)) {
    for (const m of html.matchAll(/https?:\/\/([^/"'\s<>)]+)/g)) {
      assert.ok(allowed.includes(m[1]),
        `${name}: יעד חיצוני לא מוכר — ${m[1]}. אם מכוון, להוסיף לרשימה בבדיקה`);
    }
  }
});

test('בלוק ה-JSON-LD הוא JSON תקין ומכיל רק את הישויות המוסכמות', () => {
  const m = pages['index.html'].match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m, 'בלוק JSON-LD נעלם מה-head');
  const data = JSON.parse(m[1]);
  const types = data['@graph'].map((n) => n['@type']).sort();
  assert.deepEqual(types, ['Organization', 'WebSite'],
    'JSON-LD חורג מהמוסכם (Organization+WebSite בלבד, בלי עובדות חדשות)');
});
