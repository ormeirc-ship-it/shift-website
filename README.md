# shift-website

אתר SHIFT — עמוד אחד, עברית RTL, סטטי. אין build: מה שבריפו הוא מה שנפרס
(GitHub Pages, ‏workflow שמסנן לקבצי ריצה בלבד). ‏npm משמש לכלי מדידה
ובדיקה בלבד.

- **תוכן המסלול** נגזר אך ורק מ-`PROGRAM-SPEC.md` (מחולל מ-`data.js` של
  הפלטפורמה). פרטים ב-`CLAUDE.md`.
- **תיאום בין הסוכנים**: `NEXT.md` (תור) · `REVIEW.md` (ממצאים) ·
  `HANDOFF.md` (מסירה) · `LAUNCH.md` (מה חוסם עלייה ומי מחזיק).

## פקודות

| פקודה | מה היא עושה |
|---|---|
| `npm run check` | **השער המלא** — כל הבדיקות מהמהיר לאיטי, טבלת סיכום אחת |
| `npm test` | בדיקות מבנה/תנועה/אבטחה (node:test, מילישניות) |
| `npm run verify` | תוכן 21 הימים מול המפרט — חובה 21/21 לפני commit שנוגע במסלול |
| `npm run drift` | סחיפת תוכן מול Firestore החי (`--json` לפלט מכונה) |
| `npm run vr` / `vr:accept` | רגרסיה ויזואלית מול baseline / אימוץ baseline חדש |
| `npm run perf` / `net` | ביצועי גלילה / תנאי רשת — כל ריצה נשמרת מתוארכת ל-`perf/` |
| `npm run perf:diff` | השוואת שתי הריצות האחרונות; מתריע על רגרסיה >10% |
| `npm run a11y` / `motion` / `type` / `overlap` / `budget` / `audit` / `console` | בדיקות ממוקדות (נכללות ב-check) |
| `npm run stress` / `compat` / `shots` / `weigh` | כלים ידניים לפי צורך |
| `npm run hooks` | התקנת pre-commit קל (בדיקות+אימות, שניות) — להריץ פעם אחת אחרי clone |

## מתי מריצים מה

- **לפני כל commit** — ה-hook כבר מריץ בדיקות+אימות. (עקיפה מודעת: `--no-verify`.)
- **בסוף כל סבב עבודה** — `npm run check`.
- **לפני כל פריסה (push ל-main)** — `npm run check` ירוק **וגם** `npm run drift`
  ירוק מול ה-Firestore החי: האתר מבטיח את תוכן המסלול, והפלטפורמה היא
  מקור האמת. סחיפה שמתגלה אחרי פריסה היא הבטחה שבורה לגולש.
- **אחרי שינוי שנוגע בתנועה/פריסה** — `npm run vr`; אם השינוי מכוון,
  `npm run vr:accept` ולצרף את ה-baseline המעודכן ל-commit.

## פריסה

פריסה = push ל-main, ורק זה. מדריך צעד-צעד ליום הדומיין — ב-`RUNBOOK.md`.
