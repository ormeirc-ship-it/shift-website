// SHIFT - אינטראקציות עדינות

// ── מוכנות-אנליטיקס (פריט 22) ────────────────────────────────────────
// שכבת אירועים פנימית: כותבת ל-dataLayer בלבד. שום דבר לא נשלח לשום
// שרת - חיבור לכלי אמיתי הוא החלטת OC (שורה אחת: הכלי קורא מה-dataLayer).
// הקונסול נשאר נקי (חוזה console-check); ?debug=track מדפיס בכל זאת.
window.dataLayer = window.dataLayer || [];
const track = (event, detail) => {
  const rec = Object.assign({ event: 'shift:' + event, t: Math.round((window.performance && performance.now) ? performance.now() : 0) }, detail);
  window.dataLayer.push(rec);
  if (location.search.indexOf('debug=track') > -1) console.log('[track]', rec);
};
window.__track = track; // ‏motion.js מדווח דרך זה (צימוד רופף, לא תלות)

// יעדים יוצאים - אירוע אחד לכל הקלקה החוצה (אינסטגרם / הפלטפורמה /
// וואטסאפ / מייל). ‏mailto נוסף כשנפתחו ערוצי הקשר (T13, ‏28.7).
document.addEventListener('click', (e) => {
  const a = e.target && e.target.closest
    ? e.target.closest('a[href^="http"], a[href^="mailto:"]') : null;
  if (a) track('outbound', { href: a.href });
});

// המתנה לסיום מסך הפתיחה (motion.js משדר shift:reveal).
// אם motion.js לא נטען מסיבה כלשהי - ממשיכים אחרי גיבוי של 4.5 שניות.
const afterReveal = (fn) => {
  if (!document.documentElement.classList.contains('js') ||
      document.documentElement.classList.contains('preloader-done')) {
    fn();
    return;
  }
  let done = false;
  const run = () => { if (!done) { done = true; fn(); } };
  window.addEventListener('shift:reveal', run, { once: true });
  setTimeout(run, 4500);
};

// ── גבולות כשל (פריט 36) ─────────────────────────────────────────────
// כל פיצ'ר רץ בתא עצמאי: קריסה שלו נרשמת בקונסול ולא מפילה את השכנים.
// window.__failFeature הוא וו-הזרקה לבדיקת העמידות (scripts/faults.mjs):
// הבדיקה מפילה פיצ'ר אחד בתורו ומוודאת שהשאר חיים.
const FEATURES = [];
const safe = (name, fn) => {
  FEATURES.push(name);
  try {
    if (window.__failFeature === name) throw new Error('הזרקת כשל: ' + name);
    fn();
  } catch (err) {
    if (window.console && console.error) console.error('SHIFT feature "' + name + '" קרס:', err);
  }
};
window.__features = FEATURES;

// ── אנימציית הלוגו בשער הכניסה ────────────────────────────────────────
// עד היום הווידאו נחסם גורפית בכל ספארי ובכל מובייל - כלומר רוב הקהל
// (תנועה מאינסטגרם) קיבל לוגו סטטי. החסימה נבעה מבאג אמיתי: HEVC עם
// שקיפות התנגן שם על מלבן שחור.
//
// עכשיו שני מקורות - HEVC/MOV לספארי ו-WebM לכרום/פיירפוקס - אבל
// **לא סומכים על זיהוי דפדפן**. אחרי שהווידאו נטען מציירים ממנו פריים
// לקנבס ובודקים בפועל אם יש בו שקיפות אמיתית. אם הפריים אטום (כלומר
// המלבן השחור חוזר) - הווידאו נזרק והלוגו הסטטי נשאר. בדיקה אמפירית
// אחת מחליפה ניחוש על מחרוזות UA, ולא יכולה לשחזר את הרגרסיה.
safe('gate-logo', () => {
const gateLogo = document.querySelector('.gate-logo');
if (gateLogo && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  [['assets/video/logo-anim-1-hevc.mov', 'video/quicktime; codecs="hvc1"'],
   ['assets/video/logo-anim-1.webm', 'video/webm; codecs="vp9"']].forEach(([src, type]) => {
    const s = document.createElement('source');
    s.src = src;
    s.type = type;
    video.appendChild(s);
  });

  // האם הפריים באמת שקוף? (בודקים את הפינות - שם אמור להיות "כלום")
  const framePasses = () => {
    try {
      const c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      const cx = c.getContext('2d', { willReadFrequently: true });
      cx.drawImage(video, 0, 0, 32, 32);
      const d = cx.getImageData(0, 0, 32, 32).data;
      let opaque = 0, lit = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 24) opaque++;
        if (d[i] + d[i + 1] + d[i + 2] > 90) lit++;
      }
      const px = 32 * 32;
      // אטום כמעט לגמרי אבל חשוך = המלבן השחור. פוסלים.
      return !(opaque / px > 0.92 && lit / px < 0.1);
    } catch (e) {
      return false; // לא הצלחנו לבדוק - לא מסתכנים
    }
  };

  video.addEventListener('loadeddata', () => {
    if (!framePasses()) { video.removeAttribute('src'); video.load(); return; }
    afterReveal(() => {
      const img = gateLogo.querySelector('img');
      gateLogo.appendChild(video);
      if (img) img.style.display = 'none';
      video.currentTime = 0;
      video.play().catch(() => {
        // ניגון נחסם (חיסכון בסוללה וכו') - מחזירים את הלוגו הסטטי
        video.remove();
        if (img) img.style.display = '';
      });
    });
  }, { once: true });
  video.addEventListener('error', () => video.remove(), { once: true });
  video.load();
}
});

// אנימציות הופעה בגלילה - מתחילות רק אחרי מסך הפתיחה,
// כדי שחשיפת ההירו לא "תישרף" מאחוריו
safe('reveals', () => {
const reveals = document.querySelectorAll('.reveal');
afterReveal(() => {
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('visible'));
  }
});
});

// ניווט: רקע אטום אחרי גלילה (עם הגנת null - שינוי HTML לא יפיל את הקובץ)
safe('nav-scrolled', () => {
const nav = document.getElementById('nav');
if (nav) {
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}
});

// תפריט מסך מלא
safe('menu', () => {
const burger = document.getElementById('navBurger');
const menu = document.getElementById('mobileMenu');
if (burger && menu) {
  menu.hidden = false;

  const setMenu = (open) => {
    menu.classList.toggle('open', open);
    // ‏B1/B2: מצב-התפריט חי על <html> - סלקטור אחים (~) מעולם לא תפס
    // כי ה-nav מקדים את התפריט ב-DOM; המחלקה מכבה את נקודות-הניווט
    // (שצפו מעל התפריט וחצי-עבדו) ומלבינה את קווי ה-X בכל רקע
    document.documentElement.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    // ניהול פוקוס: בפתיחה - לקישור הראשון; בסגירה - חזרה לכפתור התפריט
    if (open) {
      const first = menu.querySelector('a');
      if (first) first.focus({ preventScroll: true });
    } else if (document.activeElement && menu.contains(document.activeElement)) {
      burger.focus({ preventScroll: true });
    }
    // פריטי הענק נכנסים בהדרגה (איזאנמי)
    if (open && typeof gsap !== 'undefined' &&
        !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(menu.querySelectorAll('a'),
        { autoAlpha: 0, y: 34 },
        { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.07,
          ease: 'power3.out', clearProps: 'transform,opacity,visibility', delay: 0.08 });
    }
  };

  // bfcache: אם העמוד שוחזר מה-cache עם תפריט פתוח - לסגור ולשחרר את
  // נעילת הגלילה, אחרת המבקר חוזר לעמוד קפוא בלי לדעת למה
  window.addEventListener('pageshow', (ev) => { if (ev.persisted) setMenu(false); });

  burger.addEventListener('click', () => {
    const opening = !menu.classList.contains('open');
    setMenu(opening);
    if (opening) track('menu_open');
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setMenu(false));
  });

  // Escape סוגר את התפריט
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('open')) setMenu(false);
  });

  // לכידת פוקוס: Tab מסתובב בתוך התפריט הפתוח ולא בורח לעמוד שמאחוריו
  menu.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const links = menu.querySelectorAll('a');
    if (!links.length) return;
    const first = links[0];
    const last = links[links.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });
}
});


// ── קרוסלת עולמות השיטה (3ג, הוראת OC ‏29.7 ‏14:40) ──────────────────
// ‏scroll-snap נטיבי (RTL מהדפדפן); ה-JS רק מוסיף חצים, נקודות, גרירת
// עכבר ומקלדת. ניווט בשקופיות הוא תוכן ולא קישוט - לכן הוא כאן ולא
// במנוע התנועה: עובד גם בלי GSAP וגם במופחת-תנועה (שם המעבר מיידי).
// בלי JS: הרצועה נגללת נטיבית וה-nav מוסתר ב-CSS.
safe('worlds-carousel', () => {
  const track = document.getElementById('worldsTrack');
  const prev = document.getElementById('worldsPrev');
  const next = document.getElementById('worldsNext');
  const dotsWrap = document.getElementById('worldsDots');
  if (!track || !prev || !next || !dotsWrap) return;
  const slides = Array.from(track.children);
  if (!slides.length) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clampI = (i) => Math.max(0, Math.min(slides.length - 1, i));
  // ‏RTL: ‏scrollLeft שלילי בדפדפנים המודרניים - העומק הוא הערך המוחלט
  const index = () => clampI(Math.round(Math.abs(track.scrollLeft) / track.clientWidth));
  const go = (i) => {
    slides[clampI(i)].scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth', inline: 'start', block: 'nearest',
    });
  };

  const dots = slides.map((slide, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    const title = slide.querySelector('h3');
    b.setAttribute('aria-label', 'שקופית ' + (i + 1) + (title ? ': ' + title.textContent : ''));
    b.addEventListener('click', () => go(i));
    dotsWrap.appendChild(b);
    return b;
  });

  const paint = () => {
    const i = index();
    dots.forEach((d, k) => {
      d.classList.toggle('on', k === i);
      if (k === i) d.setAttribute('aria-current', 'true');
      else d.removeAttribute('aria-current');
    });
    prev.disabled = i === 0;
    next.disabled = i === slides.length - 1;
  };
  paint();
  let raf = null;
  track.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = null; paint(); });
  }, { passive: true });
  addEventListener('resize', paint, { passive: true });

  prev.addEventListener('click', () => go(index() - 1));
  next.addEventListener('click', () => go(index() + 1));

  // מקלדת על הרצועה: ב-RTL "הבא" הוא שמאלה
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index() + 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(index() - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(slides.length - 1); }
  });

  // גרירת עכבר (מגע גולל נטיבית). ‏snap כבוי בזמן הגרירה (CSS .dragging) -
  // אחרת כרום מצמיד כל כתיבת scrollLeft מיידית והגרירה קופצת; בשחרור
  // מעגנים לשקופית הקרובה. הנוסחה scrollLeft = start - dx נכונה גם
  // ב-RTL: הציר לא מתהפך, רק הטווח (0 עד מינוס-מקסימום).
  let downX = null, startLeft = 0, dragged = false;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    downX = e.clientX; startLeft = track.scrollLeft; dragged = false;
    track.classList.add('dragging');
    try { track.setPointerCapture(e.pointerId); } catch (err) { /* לא קריטי */ }
  });
  track.addEventListener('pointermove', (e) => {
    if (downX === null) return;
    const dx = e.clientX - downX;
    if (Math.abs(dx) > 4) dragged = true;
    track.scrollLeft = startLeft - dx;
  });
  const release = () => {
    if (downX === null) return;
    downX = null;
    track.classList.remove('dragging');
    go(index());
  };
  track.addEventListener('pointerup', release);
  track.addEventListener('pointercancel', release);
  // גרירה לא תיקרא כקליק על מה שבתוך השקופית
  track.addEventListener('click', (e) => {
    if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; }
  }, true);
});

// ── סרגל הביקורות: מילוי הלולאה + עצירה (B10) ────────────────────────
// כל ביקורת כתובה ב-HTML פעם אחת (נגישות + הוספה בשורה). כאן:
// משכפלים את הסט עד שהרצועה רחבה מהחלון (השכפולים aria-hidden),
// בונים את הרצועה השנייה ללולאה חלקה, וקובעים משך לפי רוחב -
// מהירות קבועה (~55px/ש') במקום משך קבוע שמאיץ כשמוסיפים ביקורות.
// ── מנוע רצועה-נעה משותף (D17 + בקשת Cowork ב-REQUESTS) ─────────────
// שתי רצועות חיות באתר (ביקורות · גלריית-העבר) - מנוע אחד, לא שני
// עותקים שיסחפו. משמר במדויק: לולאת-השכפול עם guard, ה-twin,
// ‏aria-hidden על שכפולים, ‏animationDuration מ-scrollWidth (מהירות
// קבועה פר-רצועה), ‏filled שמדליק אנימציה רק כשהלולאה שלמה, כפתור
// ‏B10, ואחיזת-מגע (touch-hold) עם חסד 1.6ש'.
function runMarquee(cfg) {
  const marquee = document.querySelector(cfg.root);
  const run = marquee && marquee.querySelector(cfg.run);
  const strip = run && run.querySelector(cfg.strip);
  if (!marquee || !run || !strip || !strip.children.length) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduced) {
    const originals = Array.from(strip.children);
    let guard = 0;
    while (strip.scrollWidth < innerWidth * 1.25 && guard < 40) {
      originals.forEach((card) => {
        const clone = card.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        strip.appendChild(clone);
      });
      guard++;
    }
    const twin = strip.cloneNode(true);
    twin.setAttribute('aria-hidden', 'true');
    run.appendChild(twin);
    run.style.animationDuration = Math.round(strip.scrollWidth / cfg.speed) + 's';
    marquee.classList.add('filled'); // האנימציה נדלקת רק כשהלולאה שלמה
  }

  const btn = document.getElementById(cfg.pauseBtn);
  if (btn) {
    btn.addEventListener('click', () => {
      const paused = marquee.classList.toggle('paused');
      btn.setAttribute('aria-pressed', String(paused));
      btn.setAttribute('aria-label', paused ? cfg.labels.resume : cfg.labels.pause);
    });
  }

  // ‏B10 המשך (Cowork): במגע אין hover - אחיזה על הרצועה עוצרת אותה,
  // ואחרי עזיבה יש חסד קצר לקריאה לפני שהתנועה חוזרת. מחלקה נפרדת
  // (‏touch-hold) כדי לא להתנגש במצב הכפתור (paused).
  let touchTimer = 0;
  marquee.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    clearTimeout(touchTimer);
    marquee.classList.add('touch-hold');
  });
  const touchRelease = (e) => {
    if (e.pointerType === 'mouse') return;
    clearTimeout(touchTimer);
    touchTimer = setTimeout(() => marquee.classList.remove('touch-hold'), 1600);
  };
  marquee.addEventListener('pointerup', touchRelease);
  marquee.addEventListener('pointercancel', touchRelease);
}

safe('reviews-marquee', () => runMarquee({
  root: '.reviews-marquee', run: '.reviews-run', strip: '.reviews-strip',
  pauseBtn: 'reviewsPause', speed: 55,
  labels: { pause: 'השהיית סרגל הביקורות', resume: 'המשך סרגל הביקורות' },
}));

// ‏D17: גלריית-העבר - תמונות רחבות מקלפי-טקסט, מהירות מעט איטית יותר
safe('past-marquee', () => runMarquee({
  root: '.past-marquee', run: '.past-run', strip: '.past-strip',
  pauseBtn: 'pastPause', speed: 45,
  labels: { pause: 'השהיית גלריית התמונות', resume: 'המשך גלריית התמונות' },
}));

// ============================================================
// טעימה מהמסלול: "כפתור ההרגעה הפנימי" - אנחה כפולה (יום 1)
// שאיפה עמוקה מהאף → שאיפה קצרה נוספת → נשיפה ארוכה מהפה.
// 1–3 סבבים לרגיעה מהירה (Balban ואחרים, 2023).
// ============================================================
safe('breath', () => {
  const btn = document.getElementById('breathStart');
  const circle = document.getElementById('breathCircle');
  const phase = document.getElementById('breathPhase');
  const counter = document.getElementById('breathCounter');
  if (!btn || !circle || !phase) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof gsap !== 'undefined';
  const TOTAL = 3;
  let running = false;

  const setPhase = (t) => { phase.textContent = t; };

  const breathEl = document.getElementById('breath');
  const after = document.getElementById('breathAfter');
  const setAir = (dir) => {
    // הטבעת נושמת עם ההנחיה - משהו שמחזיק את העין גם בנשיפה הארוכה
    if (!breathEl) return;
    breathEl.classList.toggle('inhale', dir === 'in');
    breathEl.classList.toggle('exhale', dir === 'out');
  };

  const finish = () => {
    setPhase('איך זה מרגיש עכשיו?');
    if (counter) counter.textContent = 'סיימתם ' + TOTAL + ' סבבים'; // 🟢: שאר האחים כבר מוגנים
    btn.disabled = false;
    btn.textContent = 'עוד סיבוב';
    running = false;
    setAir(null);
    // הרגע שאחרי: החוויה הצביעה על משהו - נותנים לה לאן להוביל
    if (after) after.hidden = false;
    track('breath_done', { rounds: TOTAL });
  };

  const runRound = (round) => {
    if (counter) counter.textContent = 'סבב ' + round + ' מתוך ' + TOTAL;
    const next = () => (round < TOTAL ? runRound(round + 1) : finish());

    // מספרי OC (עודכן ‏30.7 בצפייה חיה): שאיפה ‏5.0 · השלמה ‏1.5 · נשיפה ‏7.0
    // (מחזור ‏13.5ש'). שני המסלולים - המונפש והשקט - חיים על אותם מספרים.
    if (hasGsap && !reduced) {
      const tl = gsap.timeline({ onComplete: next });
      tl.call(() => { setPhase('שאיפה עמוקה מהאף'); setAir('in'); });
      tl.to(circle, { scale: 1.3, duration: 5.0, ease: 'power2.inOut' });
      tl.call(() => setPhase('ועוד שאיפה קצרה - למלא עד הסוף'));
      tl.to(circle, { scale: 1.5, duration: 1.5, ease: 'power2.out' });
      tl.call(() => { setPhase('נשיפה ארוכה ואיטית מהפה…'); setAir('out'); });
      tl.to(circle, { scale: 1, duration: 7.0, ease: 'power2.inOut' });
    } else {
      // גרסה שקטה: הנחיות מתחלפות בלי אנימציה
      setPhase('שאיפה עמוקה מהאף');
      setTimeout(() => setPhase('ועוד שאיפה קצרה'), 5000);
      setTimeout(() => setPhase('נשיפה ארוכה ואיטית מהפה…'), 6500);
      setTimeout(next, 13500);
    }
  };

  btn.addEventListener('click', () => {
    if (running) return;
    running = true;
    btn.disabled = true;
    btn.textContent = 'נושמים…';
    runRound(1);
  });
});

// ── גוון הניווט לפי מה שיושב מתחתיו ─────────────────────────────────
// סרגל נייבי אטום על רקע בהיר נראה כמו רכיב מדף שהודבק מעל חוויה.
// מיושם ב-IntersectionObserver ולא ב-ScrollTrigger, כדי שיעבוד גם כשמנוע
// התנועה כבוי (prefers-reduced-motion) - שם הבעיה זהה ולא פחות חמורה.
//
// rootMargin חותך את המסך לפס דק בדיוק מתחת לסרגל, כך שהתצפית עונה על
// השאלה "מה נמצא *מאחורי* הניווט" ולא "מה במרכז המסך". הפס תלוי בגובה
// החלון, ולכן התצפיתנים נבנים מחדש בכל שינוי גודל - סיבוב מסך או קריסת
// שורת ה-URL במובייל מזיזים אותו, ובלי בנייה מחדש הוא מצביע על מקום אחר.
//
// מקורות בהירים יכולים לחפוף (ההגעה לאור וההצהרה מיד אחריה), ולכן
// נספרים במפה ולא בדגל בוליאני.
safe('nav-tone', () => {
  const docEl = document.documentElement;
  const active = Object.create(null);
  const apply = () => docEl.classList.toggle('nav-light', Object.values(active).some(Boolean));
  window.__navTone = { set: (key, on) => { active[key] = !!on; apply(); }, active };

  if (!('IntersectionObserver' in window)) return;
  const LIGHT = ['.statement', '#method', '#breathe', '#path', '#story', '#outcomes'];
  const prog = document.querySelector('.program');
  let ios = [];

  const band = () => {
    const navH = parseInt(getComputedStyle(docEl).getPropertyValue('--nav-h'), 10) || 72;
    return { navH, rootMargin: `-${navH}px 0px -${Math.max(0, innerHeight - navH - 4)}px 0px` };
  };

  // מצב המסלול מורכב משני דגלים: הוא מתחת לסרגל, והוא כבר עבר לבהיר
  let progUnderNav = false;
  let progLit = prog ? prog.classList.contains('lit') : false;
  const pushProg = () => window.__navTone.set('#program', progUnderNav && progLit);

  const build = () => {
    ios.forEach((io) => io.disconnect());
    ios = [];
    const { rootMargin } = band();

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => window.__navTone.set(e.target.dataset.navKey, e.isIntersecting));
    }, { rootMargin });
    LIGHT.forEach((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.dataset.navKey = sel;
      io.observe(el);
    });
    ios.push(io);

    if (prog) {
      const pio = new IntersectionObserver(([e]) => { progUnderNav = e.isIntersecting; pushProg(); },
        { rootMargin });
      pio.observe(prog);
      ios.push(pio);
    }
  };

  build();

  // המחלקה .lit מסומנת ע"י מנוע התנועה - עוקבים אחריה בלי לגעת בפריסה
  if (prog && 'MutationObserver' in window) {
    new MutationObserver(() => { progLit = prog.classList.contains('lit'); pushProg(); })
      .observe(prog, { attributes: true, attributeFilter: ['class'] });
  }

  // בנייה מחדש בשינוי גודל/סיבוב, עם השהיה קצרה כדי לא לבנות עשרות פעמים
  let t = null;
  addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(build, 180);
  }, { passive: true });
});

// ── טופס השארת פרטים להצטרפות (join-form) ────────────────────────────
// כפתור "להצטרפות למסלול" פותח <dialog> נייטיבי עם 4 שדות; השליחה נכתבת
// ל-Firestore ב-REST (אותה שכבה שהאפליקציה החיה משתמשת בה - עובד בכל רשת,
// בלי SDK). היעד: קולקציה נפרדת websiteLeads בפרויקט המסלול. append-only.
//
// ⚠️ כלל Firestore חובה: הקולקציה websiteLeads מוצהרת ב-firestore.rules
// של פרויקט המסלול (create:true, בלי read/update/delete). בלי פריסת הכללים
// הכתיבה מוחזרת 403 והטופס מציג הודעת שגיאה עם נפילה לאפליקציה.
//
// נגישות: <dialog> מטפל בלכידת-פוקוס/ESC. בלי JS או בלי showModal - הכפתור
// נשאר קישור ישיר לאפליקציה (data-join, href), ההרשמה לא נשברת.
safe('join-form', () => {
  const dialog = document.getElementById('joinDialog');
  const form = document.getElementById('joinForm');
  const status = document.getElementById('joinStatus');
  const triggers = document.querySelectorAll('[data-join]');
  if (!dialog || !form || !triggers.length || typeof dialog.showModal !== 'function') return;

  const PROJECT = 'shift-21-day-course-ceos';
  const COLLECTION = 'websiteLeads';
  const ENDPOINT = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${COLLECTION}`;
  const appHref = triggers[0].getAttribute('href') || 'https://shift-21-day-course-ceos.web.app';

  const submitBtn = form.querySelector('.join-submit');
  let sending = false;

  const setStatus = (msg, kind) => {
    status.textContent = msg || '';
    status.classList.toggle('is-error', kind === 'error');
    status.classList.toggle('is-ok', kind === 'ok');
  };

  const open = (e) => {
    if (e) e.preventDefault();
    setStatus('');
    dialog.showModal();
    track('join_open');
    const first = form.querySelector('input[name="name"]');
    if (first) setTimeout(() => first.focus(), 60);
  };
  const close = () => { if (dialog.open) dialog.close(); };

  triggers.forEach((btn) => btn.addEventListener('click', open));
  form.querySelector('[data-join-close]').addEventListener('click', close);
  // לחיצה על ה-backdrop (מחוץ לטופס) סוגרת
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });

  // סימון שדה כלא-תקין להצגה חזותית + קורא-מסך
  const markInvalid = (el, bad) => {
    if (bad) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
  };

  const validate = () => {
    const name = form.name.value.trim();
    const ageRaw = form.age.value.trim();
    const age = parseInt(ageRaw, 10);
    const gender = form.gender.value;
    const phoneDigits = form.phone.value.replace(/\D/g, '');

    markInvalid(form.name, name.length < 2);
    markInvalid(form.age, !(age >= 14 && age <= 120));
    markInvalid(form.gender, !gender);
    markInvalid(form.phone, phoneDigits.length < 9);

    if (name.length < 2) return { ok: false, msg: 'נא למלא שם מלא.' };
    if (!(age >= 14 && age <= 120)) return { ok: false, msg: 'נא למלא גיל תקין.' };
    if (!gender) return { ok: false, msg: 'נא לבחור מין.' };
    if (phoneDigits.length < 9) return { ok: false, msg: 'נא למלא מספר טלפון תקין.' };

    return { ok: true, data: { name, age, gender, phone: phoneDigits } };
  };

  // קידוד ערכי Firestore REST (זהה לשכבת firebase.js של האפליקציה)
  const toFields = (obj) => {
    const fields = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'number' && Number.isInteger(v)) fields[k] = { integerValue: String(v) };
      else fields[k] = { stringValue: String(v) };
    }
    return { fields };
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (sending) return;

    const res = validate();
    if (!res.ok) { setStatus(res.msg, 'error'); return; }

    sending = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'שולח…';
    setStatus('');

    const payload = Object.assign({}, res.data, {
      source: 'website',
      createdAt: new Date().toISOString(),
    });

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toFields(payload)),
    })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        track('join_submit', { ok: true });
        setStatus('קיבלנו! נחזור אליכם בהקדם 🙏', 'ok');
        form.reset();
        submitBtn.textContent = 'נשלח ✓';
        setTimeout(close, 1800);
      })
      .catch((err) => {
        track('join_submit', { ok: false });
        if (window.console) console.error('join-form שליחה נכשלה:', err);
        setStatus('משהו השתבש בשליחה. אפשר להצטרף ישירות דרך האפליקציה.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'שליחת פרטים';
        // נפילה חיננית: קישור ישיר לאפליקציה מתחת להודעה
        if (!status.querySelector('a')) {
          const a = document.createElement('a');
          a.href = appHref; a.target = '_blank'; a.rel = 'noopener';
          a.textContent = 'למעבר לאפליקציה ←';
          a.style.cssText = 'display:block;margin-top:8px;color:var(--sky);';
          status.appendChild(a);
        }
      })
      .finally(() => { sending = false; });
  });
});
