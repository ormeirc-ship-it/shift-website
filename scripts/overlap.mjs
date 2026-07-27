// B1: כל אחד מ-21 הימים חייב "רגע קריא" — מיקום גלילה שבו הטקסט שלו
// נראה במלואו, בלי שקלף אחר יושב עליו ובלי שהוא מעומעם.
//
// למה לא "בדיקת חפיפת מלבנים": בערימת קלפים חפיפה היא *הכוונה* — קלף
// חדש אמור לכסות את הקודם. הבאג הוא כשהכיסוי שקוף (רואים שני טקסטים
// זה על זה) או כשקלף גבוה מהמסך ננעץ והימים התחתונים שלו לא מגיעים
// לעולם לקריאה. שתי הצורות נתפסות באותה שאלה: האם היה רגע קריא.
//
// נבדק על קשת הרוחבים ש-OC ביקש + חלונות נמוכים/צרים — שם זה נשבר.
import puppeteer from 'puppeteer-core';
import { chromePath, serveRepo, ready } from './lib/env.mjs';

const VIEWPORTS = [
  ...[320, 360, 390, 414, 600, 768, 900, 1024, 1280, 1440].map((w) => [w, 900]),
  [900, 600], [1024, 650], [1280, 600], [1440, 700],  // דסקטופ נמוך — קלף גבוה מהמסך
  [700, 1100],                                        // פאנל צד צר-וגבוה
  [1440, 1600],                                       // מסך גבוה — הערימה אמורה לפעול כאן
];

const srv = await serveRepo();
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });

let failed = 0;
console.log('\nB1 — רגע קריא לכל יום במסלול, לכל גודל חלון');
console.log('─'.repeat(66));

for (const [w, h] of VIEWPORTS) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  await page.goto(srv.url, { waitUntil: 'load', timeout: 60000 });
  await ready(page, { frames: false });

  const result = await page.evaluate(async () => {
    if (window.__lenis) window.__lenis.stop();
    const raf = () => new Promise((r) => requestAnimationFrame(r));
    const navH = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--nav-h')) || 72;
    const prog = document.querySelector('.program');
    if (!prog) return { error: 'אין סקשן מסלול' };

    // אטימות של האבות בלבד — לא של השורה עצמה: יום מנוחה שקוף חלקית
    // בכוונה (design), אבל קלף שעומעם ע"י אפקט הערימה הוא באג קריאוּת.
    const effOpacity = (el, stopAt) => {
      let o = 1;
      for (let n = el.parentElement; n; n = n.parentElement) {
        o *= parseFloat(getComputedStyle(n).opacity);
        if (n === stopAt) break;
      }
      return o;
    };

    // מעבר ראשון — מלמעלה עד סוף המסלול, כדי שכל חשיפות הכניסה יסתיימו
    const end = prog.offsetTop + prog.offsetHeight;
    for (let y = 0; y <= end; y += innerHeight * 0.5) { scrollTo(0, y); await raf(); }
    await new Promise((r) => setTimeout(r, 800)); // זנב אנימציות כניסה

    const days = [...document.querySelectorAll('.day-item')].map((el, i) => ({
      el, i, card: el.closest('.week-card'), ok: false, why: '',
    }));

    // מעבר שני — צעדים עדינים; לכל יום שעוד לא הוכשר בודקים את הרגע הזה.
    // בדרך נאכף גם חוק האטימות: opacity על קלף שלם הופך את הרקע האטום
    // לשקוף, וקלף מכוסה נראה דרך המכסה — לכן קלף לעולם לא יורד מ-1.
    let minCardAlpha = 1;
    const cardEls = [...document.querySelectorAll('.week-card')];
    const from = Math.max(0, prog.offsetTop - innerHeight);
    for (let y = from; y <= end; y += Math.max(40, innerHeight * 0.18)) {
      scrollTo(0, y); await raf(); await raf();
      for (const c of cardEls) {
        minCardAlpha = Math.min(minCardAlpha, parseFloat(getComputedStyle(c).opacity));
      }
      for (const d of days) {
        if (d.ok) continue;
        const r = d.el.getBoundingClientRect();
        if (r.top < navH + 4 || r.bottom > innerHeight - 4 || r.height < 8) continue;
        if (effOpacity(d.el, d.card) < 0.9) { d.why = 'מעומעם'; continue; }
        // חמש נקודות דגימה על גוף הטקסט — מי באמת מצויר שם?
        const body = d.el.querySelector('.day-body') || d.el;
        const b = body.getBoundingClientRect();
        const pts = [
          [b.left + 8, b.top + 8], [b.right - 8, b.top + 8],
          [b.left + b.width / 2, b.top + b.height / 2],
          [b.left + 8, b.bottom - 8], [b.right - 8, b.bottom - 8],
        ];
        const foreign = pts.find(([x, yy]) => {
          const hit = document.elementFromPoint(x, yy);
          if (!hit) return true;
          const hitCard = hit.closest && hit.closest('.week-card');
          return hitCard && hitCard !== d.card;
        });
        if (foreign) { d.why = 'מכוסה ע"י קלף אחר'; continue; }
        d.ok = true;
      }
      if (days.every((d) => d.ok)) break;
    }
    return {
      total: days.length,
      bad: days.filter((d) => !d.ok).map((d) => ({
        week: d.card ? d.card.dataset.week : '?',
        day: (d.el.querySelector('.day-no') || {}).textContent || String(d.i + 1),
        why: d.why || 'לא הגיע למסך במלואו',
      })),
      sticky: getComputedStyle(document.querySelector('.week-card')).position,
      minCardAlpha,
    };
  });

  const label = `${w}×${h}`.padEnd(10);
  const opaque = result.minCardAlpha === undefined || result.minCardAlpha >= 0.999;
  if (result.error) { console.log(`✗ ${label} ${result.error}`); failed++; }
  else if (!opaque) {
    failed++;
    console.log(`✗ ${label} קלף ירד לאטימות ${result.minCardAlpha.toFixed(3)} — קלף מכוסה ייראה דרכו`);
  } else if (result.bad.length === 0) {
    console.log(`✓ ${label} ${result.total}/${result.total} ימים קריאים · קלפים: ${result.sticky}`);
  } else {
    failed++;
    const sample = result.bad.slice(0, 4)
      .map((b) => `ש${b.week}/יום ${b.day} (${b.why})`).join(' · ');
    console.log(`✗ ${label} ${result.total - result.bad.length}/${result.total} — נכשלו: ${sample}${result.bad.length > 4 ? ` +${result.bad.length - 4}` : ''}`);
  }
  await page.close();
}

await browser.close();
await srv.close();
console.log('─'.repeat(66));
if (failed) { console.log(`✗ ${failed} גדלי חלון עם ימים לא-קריאים\n`); process.exit(1); }
console.log('✓ לכל יום יש רגע קריא בכל גדלי החלון\n');
