// מתאם טלמטריה — אתר השיווק (`shift-website`)
// ────────────────────────────────────────────────────────────────────────
// האתר כבר בנה חצי מהעבודה בלי לדעת: `js/main.js` מגדיר `track(event, detail)`
// שדוחף כל אירוע ל-`window.dataLayer` ו**לא שולח אותו לשום מקום**. שכבת
// "מוכנות לאנליטיקס" שממתינה לצרכן. המתאם הזה הוא הצרכן.
//
// אין באתר שום מדידה חיצונית — לא Google Analytics, לא פיקסל, כלום. כלומר
// עד עכשיו לא היה שום מידע על מי מגיע, מאיפה, ומה עוצר אותו לפני הטופס.
//
// טעינה: תג script אחד לפני `js/main.js` בכל עמוד.

(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.shiftTel) return;

  var T = window.shiftTel;
  function safe(fn) { try { return fn(); } catch (e) { /* לא מפיל את האתר */ } }

  safe(function () {
    // באתר ציבורי מכבדים Do Not Track. במוצרים שמאחורי התחברות המדידה היא
    // חלק מהשירות; כאן המבקר לא ביקש כלום ולכן ההחלטה שלו קובעת.
    T.init({ property: 'site', honorDNT: true });

    var page = (location.pathname.split('/').pop() || 'index.html').replace('.html', '');
    var lang = document.documentElement.lang || 'he';
    T.view('site:' + (page || 'index'), { lang: lang });

    // ── ניקוז dataLayer הקיים ──────────────────────────────────────────
    // גם מה שכבר נדחף לפני שנטענו, וגם כל דחיפה עתידית.
    function forward(rec) {
      safe(function () {
        if (!rec || !rec.event) return;
        var name = String(rec.event).replace(/^shift:/, '');
        var props = {};
        for (var k in rec) {
          if (k === 'event' || !Object.prototype.hasOwnProperty.call(rec, k)) continue;
          props[k] = rec[k];
        }
        T.event(name, props);
      });
    }

    try {
      var dl = window.dataLayer = window.dataLayer || [];
      dl.forEach(forward);
      var origPush = dl.push.bind(dl);
      dl.push = function (rec) { forward(rec); return origPush(rec); };
    } catch (e) { /* ignore */ }

    // ── קישורי תשלום — הרגע הכי יקר באתר ───────────────────────────────
    // ארבעת קישורי Grow הם ניווט ב-_self: העמוד נפרק מיד, וכל שידור רגיל
    // נחתך באמצע. לכן כאן, ורק כאן, מוציאים את התור מיידית עם beacon.
    document.addEventListener('click', function (ev) {
      safe(function () {
        var a = ev.target && ev.target.closest && ev.target.closest('a[href]');
        if (!a) return;
        var href = a.getAttribute('href') || '';
        if (href.indexOf('pay.grow.link') === -1 && href.indexOf('grow.link') === -1) return;
        T.event('checkout_click', {
          href: href.slice(0, 160),
          label: (a.innerText || '').trim().slice(0, 60),
          section: (a.closest('section') && a.closest('section').id) || null,
        });
        T.flush();
      });
    }, true);

    // ── טופס הלידים ────────────────────────────────────────────────────
    // נמדדת פתיחה, נטישה והגשה. שמות שדות בלבד — לעולם לא ערכים.
    var joinOpened = false, joinSubmitted = false;
    document.addEventListener('click', function (ev) {
      safe(function () {
        var el = ev.target;
        if (!el || !el.closest) return;
        if (el.closest('[data-join]')) { joinOpened = true; T.event('lead_form_open', {}); }
        if (el.closest('[data-join-close]') && joinOpened && !joinSubmitted) {
          T.event('lead_form_abandon', {});
        }
      });
    }, true);
    document.addEventListener('submit', function (ev) {
      safe(function () {
        var f = ev.target;
        if (f && (f.id === 'joinForm' || f.classList.contains('join-form'))) {
          joinSubmitted = true;
          T.event('lead_form_submit', {});
          T.flush();
        }
      });
    }, true);

    // ── איזה חלק בעמוד באמת נצפה ───────────────────────────────────────
    // 13 מקטעים בעמוד הנחיתה. עומק גלילה באחוזים לא אומר איזה מקטע עבד;
    // צפייה במקטע כן. זה מה שיגיד אילו חלקים בעמוד מיותרים.
    if (window.IntersectionObserver) {
      var seenSections = {};
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var id = e.target.id || (e.target.className || '').split(' ')[0];
          if (!id || seenSections[id]) return;
          seenSections[id] = 1;
          safe(function () { T.event('section_view', { section: id }); });
        });
      }, { threshold: 0.4 });
      document.querySelectorAll('section, .section-light, .section-dark, .section-paper')
        .forEach(function (s) { io.observe(s); });
    }
  });
})();
