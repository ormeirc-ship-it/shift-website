// SHIFT — אינטראקציות עדינות

// המתנה לסיום מסך הפתיחה (motion.js משדר shift:reveal).
// אם motion.js לא נטען מסיבה כלשהי — ממשיכים אחרי גיבוי של 4.5 שניות.
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

// ── אנימציית הלוגו בשער הכניסה ────────────────────────────────────────
// עד היום הווידאו נחסם גורפית בכל ספארי ובכל מובייל — כלומר רוב הקהל
// (תנועה מאינסטגרם) קיבל לוגו סטטי. החסימה נבעה מבאג אמיתי: HEVC עם
// שקיפות התנגן שם על מלבן שחור.
//
// עכשיו שני מקורות — HEVC/MOV לספארי ו-WebM לכרום/פיירפוקס — אבל
// **לא סומכים על זיהוי דפדפן**. אחרי שהווידאו נטען מציירים ממנו פריים
// לקנבס ובודקים בפועל אם יש בו שקיפות אמיתית. אם הפריים אטום (כלומר
// המלבן השחור חוזר) — הווידאו נזרק והלוגו הסטטי נשאר. בדיקה אמפירית
// אחת מחליפה ניחוש על מחרוזות UA, ולא יכולה לשחזר את הרגרסיה.
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

  // האם הפריים באמת שקוף? (בודקים את הפינות — שם אמור להיות "כלום")
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
      return false; // לא הצלחנו לבדוק — לא מסתכנים
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
        // ניגון נחסם (חיסכון בסוללה וכו') — מחזירים את הלוגו הסטטי
        video.remove();
        if (img) img.style.display = '';
      });
    });
  }, { once: true });
  video.addEventListener('error', () => video.remove(), { once: true });
  video.load();
}

// אנימציות הופעה בגלילה — מתחילות רק אחרי מסך הפתיחה,
// כדי שחשיפת ההירו לא "תישרף" מאחוריו
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

// ניווט: רקע אטום אחרי גלילה (עם הגנת null — שינוי HTML לא יפיל את הקובץ)
const nav = document.getElementById('nav');
if (nav) {
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// תפריט מסך מלא
const burger = document.getElementById('navBurger');
const menu = document.getElementById('mobileMenu');
if (burger && menu) {
  menu.hidden = false;

  const setMenu = (open) => {
    menu.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    // ניהול פוקוס: בפתיחה — לקישור הראשון; בסגירה — חזרה לכפתור התפריט
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

  burger.addEventListener('click', () => {
    setMenu(!menu.classList.contains('open'));
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


// ============================================================
// טעימה מהמסלול: "כפתור ההרגעה הפנימי" — אנחה כפולה (יום 1)
// שאיפה עמוקה מהאף → שאיפה קצרה נוספת → נשיפה ארוכה מהפה.
// 1–3 סבבים לרגיעה מהירה (Balban ואחרים, 2023).
// ============================================================
(() => {
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

  const finish = () => {
    setPhase('איך זה מרגיש עכשיו?');
    counter.textContent = 'סיימתם ' + TOTAL + ' סבבים';
    btn.disabled = false;
    btn.textContent = 'עוד סיבוב';
    running = false;
  };

  const runRound = (round) => {
    counter.textContent = 'סבב ' + round + ' מתוך ' + TOTAL;
    const next = () => (round < TOTAL ? runRound(round + 1) : finish());

    if (hasGsap && !reduced) {
      const tl = gsap.timeline({ onComplete: next });
      tl.call(() => setPhase('שאיפה עמוקה מהאף'));
      tl.to(circle, { scale: 1.3, duration: 1.9, ease: 'power2.inOut' });
      tl.call(() => setPhase('ועוד שאיפה קצרה — למלא עד הסוף'));
      tl.to(circle, { scale: 1.5, duration: 1.0, ease: 'power2.out' });
      tl.call(() => setPhase('נשיפה ארוכה ואיטית מהפה…'));
      tl.to(circle, { scale: 1, duration: 5.8, ease: 'power2.inOut' });
    } else {
      // גרסה שקטה: הנחיות מתחלפות בלי אנימציה
      setPhase('שאיפה עמוקה מהאף');
      setTimeout(() => setPhase('ועוד שאיפה קצרה'), 1900);
      setTimeout(() => setPhase('נשיפה ארוכה ואיטית מהפה…'), 2900);
      setTimeout(next, 8700);
    }
  };

  btn.addEventListener('click', () => {
    if (running) return;
    running = true;
    btn.disabled = true;
    btn.textContent = 'נושמים…';
    runRound(1);
  });
})();
