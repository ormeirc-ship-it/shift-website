/* ============================================================
   SHIFT — motion.js
   חוקי בית לתנועה:
   - easing אחיד: power3.out (מעברי מסך: power3.inOut)
   - משכים: 0.6s–1.2s
   - כיבוד מלא של prefers-reduced-motion: reduce
   - RTL: אנימציות ציר X מוגדרות תמיד במפורש (חיובי = ימינה פיזית)
   ============================================================ */

(function () {
  'use strict';

  var docEl = document.documentElement;
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NAV_OFFSET = -72; // גובה הניווט הקבוע

  var hasGsap = typeof gsap !== 'undefined';
  var hasLenis = typeof Lenis !== 'undefined';

  // ---------- ברירות מחדל של GSAP (חוקי הבית) ----------
  if (hasGsap) {
    gsap.defaults({ ease: 'power3.out', duration: 0.9 });
    if (typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
    }
  }

  // ---------- Lenis: גלילה חלקה (מדלגים ב-reduced motion) ----------
  var lenis = null;
  if (!REDUCED && hasLenis && hasGsap) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenis.on('scroll', function () {
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.update();
    });
    gsap.ticker.add(function (time) {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
  }

  // ---------- ניווט עוגנים: גלילה חלקה עם קיזוז לניווט ----------
  function scrollToHash(hash) {
    var target = document.querySelector(hash);
    if (!target) return;
    if (lenis) {
      lenis.scrollTo(target, { offset: NAV_OFFSET, duration: 1.2 });
    } else {
      var y = target.getBoundingClientRect().top + window.scrollY + NAV_OFFSET;
      window.scrollTo({ top: y, behavior: REDUCED ? 'auto' : 'smooth' });
    }
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;
    var hash = link.getAttribute('href');
    if (hash.length < 2) return;
    e.preventDefault();
    // נותנים לתפריט המובייל רגע להיסגר לפני הגלילה
    requestAnimationFrame(function () { scrollToHash(hash); });
    if (history.pushState) history.pushState(null, '', hash);
  });

  // ---------- Preloader: פתיח קולנועי (~1.5s) ----------
  var preloader = document.getElementById('preloader');
  var revealed = false;

  function finishReveal() {
    if (revealed) return;
    revealed = true;
    docEl.classList.add('preloader-done');
    if (preloader && preloader.parentNode) preloader.parentNode.removeChild(preloader);
    document.body.style.overflow = '';
    window.dispatchEvent(new Event('shift:reveal'));
    if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
  }

  if (!preloader || REDUCED || !hasGsap) {
    // בלי אנימציה: חושפים מיד
    finishReveal();
  } else {
    document.body.style.overflow = 'hidden';
    var logo = preloader.querySelector('img');
    var heroContent = document.querySelector('.hero-content');

    var tl = gsap.timeline({ onComplete: finishReveal });

    // הלוגו מופיע
    tl.fromTo(logo,
      { opacity: 0, scale: 0.94, filter: 'blur(6px)' },
      { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.6 }
    );

    // נשימה קצרה
    tl.to(logo, { scale: 1.02, duration: 0.35, ease: 'power1.inOut' });

    // "נפתח" אל תוך ההירו: המסך עולה כמו מסך תיאטרון, הלוגו נמוג מעלה
    tl.to(logo, {
      y: -60, opacity: 0, duration: 0.7, ease: 'power3.inOut'
    }, 'open');
    tl.to(preloader, {
      yPercent: -100, duration: 0.9, ease: 'power3.inOut'
    }, 'open+=0.1');

    // ההירו מתייצב מתחת בעדינות
    if (heroContent) {
      tl.fromTo(heroContent,
        { scale: 1.03 },
        { scale: 1, duration: 1.0, ease: 'power3.out' },
        'open+=0.15'
      );
    }
  }

  // חגורת ביטחון: אם משהו נתקע — חושפים בכל מקרה אחרי 4 שניות
  setTimeout(finishReveal, 4000);
})();
