# RUNBOOK — תפעול ופריסה · shift-website

מסמך אחד לכל פעולה תפעולית. אם משהו כאן לא עובד כמו שכתוב — זה באג
במסמך, לתקן אותו באותו commit.

> **✅ הפריסה הראשונה בוצעה 2.8.2026** (הוראת OC, לפי GO-LIVE.md):
> ‏main נדחף `5bc2c9e→eb912b1`, האתר חי ב-
> https://ormeirc-ship-it.github.io/shift-website/ ואומת ‏25/25
> (כולל מסלול-הכשל של A1 באוויר). מכאן: השגרה שלמטה היא הדרך -
> שער מלא + drift, מיזוג ל-main, push, ואימות על הכתובת החיה.

## פריסה רגילה (כבר יש דומיין או שנשארים ב-github.io)

1. `npm run check` — חייב ירוק (או ⚠ רכות מוסברות בלבד).
2. `npm run drift` — חייב ✓ מול Firestore החי (האתר מבטיח את תוכן המסלול).
3. מיזוג ל-`main` ודחיפה. ה-workflow (deploy-pages.yml) מסנן לקבצי ריצה
   בלבד ומפרסם. **פריסה = push ל-main, אין דרך אחרת.**
4. אימות אחרי עלייה: לפתוח את ה-URL החי, לגלול עד הסוף, ולוודא
   שה-console נקי. (עדיין אין לנו בדיקת post-deploy אוטומטית — ברשימה.)

## יום הדומיין — רשימת ההחלפה המלאה

כשיש כתובת (נניח `https://shift.example`), בסדר הזה:

1. **`index.html`** — ‏4 מקומות: `og:url`, ‏`og:image` (URL מלא), ‏`rel=canonical`,
   ובלוק ה-JSON-LD (‏url/logo/@id ×5 מופעים).
2. **`robots.txt`** — שורת ה-Sitemap.
3. **`sitemap.xml`** — ה-`loc`.
4. **`404.html`** — שלושת הנתיבים האבסולוטיים `/shift-website/` → `/`.
4½. **`site.webmanifest`** — ‏`start_url`.
5. חיפוש ביטחון: `grep -rn "ormeirc-ship-it.github.io" --include="*.html" --include="*.txt" --include="*.xml" .`
   חייב לחזור ריק (מחוץ ל-docs).
6. ב-GitHub: ‏Settings → Pages → Custom domain (+ Enforce HTTPS).
7. `npm run check` + פריסה רגילה.
8. לסמן ✓ את שורת הדומיין ב-`LAUNCH.md`.

## כשמגיעים מייל/וואטסאפ אמיתיים

1. `index.html` — להחזיר את כפתור "שיחת היכרות" (מסומן TODO ליד ה-CTA
   הסופי) ואת המשפט המלא בקופי הסגירה (ההערה שומרת את הנוסח).
2. `npm run check` + פריסה.

## תוכן אירועים אמיתי

1. להחליף את שלושת ה-placeholder-ים (`.event-soon`) בתוכן + להסיר את
   הערות ה-TODO (9 סימונים).
2. תמונות אמיתיות → `assets/img/`, ‏webp+jpg (כמו הקיימות).

## עדכון תוכן המסלול (כש-data.js משתנה בפלטפורמה)

1. `node scripts/generate-program-spec.mjs` (מחדש את PROGRAM-SPEC.md).
2. לעדכן את סקשן המסלול ב-index.html לפי המפרט.
3. `npm run verify` — חובה 21/21. ‏`npm run drift` לאימות מול החי.

## תקלות מוכרות

| סימפטום | סיבה | טיפול |
|---|---|---|
| `.git/index.lock` תקוע | git של Cowork בסנדבוקס לא מוחק אחריו | לוודא שאין תהליך git רץ → למחוק את הקובץ |
| ‏vr נכשל אחרי שינוי מכוון | ה-baseline הישן | לבדוק ב-`.vr/current/` שהשינוי נכון → `npm run vr:accept` |
| ‏drift נכשל | רשת/Firestore או סחיפה אמיתית | לבדוק את הפלט: אם הרשת — לנסות שוב; אם תוכן — לתקן את האתר, לא את המקור |
| פריסה עלתה אבל נכסים ישנים | cache של Pages | לוודא שפרמטר `?v=` עודכן בכל שינוי css/js |

## CSP — טיוטה ליום שיש שליטה ב-headers (פריט 39)

GitHub Pages לא מאפשר headers, ו-**Report-Only דרך meta אינו נתמך
בדפדפנים** (חייב header) — לכן זו טיוטה מתועדת, לא meta חי: meta אוכף
היה מסכן את האתר בלי דרך לנסות-קודם. כשעוברים לדומיין מאחורי
Cloudflare/Netlify/Pages-proxy — להדביק כ-header, קודם ב-Report-Only.

הרשימה נגזרה מהצרכים בפועל (אחרי self-host של הגופנים אין שום מקור חוץ):

```
Content-Security-Policy-Report-Only:
  default-src 'none';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  font-src 'self';
  media-src 'self';
  connect-src 'self';
  base-uri 'none';
  form-action 'none';
  frame-ancestors 'self';
```

הערות אכיפה:
- `'unsafe-inline'` ל-script נדרש בגלל שני בלוקי ה-inline ב-head (שער
  + שחרור גופן). חלופה קשוחה: hashes (‏sha256) — אבל כל עריכת בלוק
  שוברת אותם; להחליט רק כשיש pipeline שמחשב אותם אוטומטית.
- GSAP כותב סגנונות דרך CSSOM — זה *לא* נחסם ע"י CSP; ‏`'unsafe-inline'`
  ל-style הוא בשביל מאפייני style ב-HTML (יש כמה).
- `img-src data:` — לאייקוני ה-favicon בזמן פיתוח ולקנבס; אפשר לנסות
  בלעדיו ב-Report-Only ולראות אם יש דיווחים.

## כלים (מפה מלאה ב-README)

`npm run check` הוא השער; כל השאר ב-README כולל מתי מריצים מה.
