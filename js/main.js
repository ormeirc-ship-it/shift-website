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

// אנימציית הלוגו בהירו — שדרוג מלוגו סטטי לווידאו רק בדפדפנים
// שמנגנים WebM עם שקיפות באופן אמין (דסקטופ כרום/פיירפוקס).
// בספארי ובמובייל הווידאו עלול להתנגן על רקע שחור — נשארים עם הלוגו הסטטי.
const heroLogo = document.getElementById('heroLogo');
if (heroLogo) {
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const canWebm = document.createElement('video')
    .canPlayType('video/webm; codecs="vp9"') === 'probably';
  if (canWebm && !isSafari && !isMobile) {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('aria-label', 'אנימציית הלוגו של SHIFT');
    const src = document.createElement('source');
    src.src = 'assets/video/logo-anim-1.webm';
    src.type = 'video/webm';
    video.appendChild(src);
    video.addEventListener('canplay', () => {
      // מחכים שמסך הפתיחה ייפתח — ואז ציור הלוגו מתחיל מאפס
      afterReveal(() => {
        heroLogo.replaceChildren(video);
        video.currentTime = 0;
        video.play().catch(() => {});
      });
    }, { once: true });
    video.load();
  }
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
