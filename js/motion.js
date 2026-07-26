/* ============================================================
   SHIFT — motion.js
   חוקי בית לתנועה:
   - easing אחיד: power3.out (מעברי מסך: power3.inOut)
   - משכים: 0.6s–1.2s (פידבק מיידי קצר יותר)
   - כיבוד מלא של prefers-reduced-motion: reduce
   - RTL: כיווני ציר X תמיד מפורשים; קווי התקדמות נמתחים מימין
   - כניסות חד-פעמיות מנקות אחריהן inline styles (clearProps)
     כדי לא להרוג hover של CSS
   ============================================================ */

(function () {
  'use strict';
  // כל גוף המנוע עטוף ב-try אחד: אם משהו קורס באתחול, ה-catch בתחתית
  // הקובץ משחרר את מסך הפתיחה במקום להשאיר את המבקר מול מסך ריק.
  // (הגוף נשאר בהזחה המקורית — העטיפה נוספה בדיעבד ובכוונה לא הוזח מחדש)
  try {

  var docEl = document.documentElement;
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NAV_OFFSET = -72;
  var DESKTOP = window.matchMedia('(min-width: 900px)');
  var FINE_POINTER = window.matchMedia('(hover: hover) and (pointer: fine)');
  var CLEAR = 'transform,opacity,visibility';

  var hasGsap = typeof gsap !== 'undefined';
  var hasST = typeof ScrollTrigger !== 'undefined';
  var hasLenis = typeof Lenis !== 'undefined';
  var FULL = hasGsap && hasST && !REDUCED;

  if (hasGsap) {
    gsap.defaults({ ease: 'power3.out', duration: 0.9 });
    if (hasST) gsap.registerPlugin(ScrollTrigger);
  }
  // המחלקה הוכרזה אופטימית ב-head; מאשררים או מבטלים לפי מה שבאמת נטען
  if (FULL) docEl.classList.add('gsap-on');
  else docEl.classList.remove('gsap-on');

  /* ---------- Lenis: גלילה חלקה ---------- */
  var lenis = null;
  if (!REDUCED && hasLenis && hasGsap) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenis.on('scroll', function () { if (hasST) ScrollTrigger.update(); });
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis; // חשוף לצורכי בדיקות אוטומטיות
  }

  /* ---------- ניווט עוגנים ---------- */
  function scrollToHash(hash) {
    // ההירו דביק (cover-stage) — מיקומו על המסך לא משקף את מקומו במסמך,
    // אז "לראש העמוד" הוא תמיד גלילה ל-0
    if (hash === '#top') {
      if (lenis) lenis.scrollTo(0, { duration: 1.2 });
      else window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
      return;
    }
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
    requestAnimationFrame(function () { scrollToHash(hash); });
    if (history.pushState) history.pushState(null, '', hash);
  });
  // כפתור Back/Forward של הדפדפן מזיז באמת בין העוגנים —
  // בלי זה pushState משנה URL אבל העמוד נשאר במקום
  window.addEventListener('popstate', function () {
    scrollToHash(location.hash || '#top');
  });

  /* ---------- עזרים: פיצול טקסט ---------- */
  function splitWords(el, wordClass) {
    var nodes = Array.prototype.slice.call(el.childNodes);
    nodes.forEach(function (node) {
      if (node.nodeType === 3) {
        var frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(' '));
          } else {
            var s = document.createElement('span');
            s.className = wordClass || 'w';
            s.textContent = part;
            frag.appendChild(s);
          }
        });
        el.replaceChild(frag, node);
      } else if (node.nodeType === 1 && node.tagName !== 'BR') {
        splitWords(node, wordClass);
      }
    });
  }

  function splitChars(el) {
    var text = el.textContent;
    el.textContent = '';
    var out = [];
    text.split('').forEach(function (ch) {
      if (ch === ' ') { el.appendChild(document.createTextNode(' ')); return; }
      var s = document.createElement('span');
      s.className = 'ch';
      s.style.display = 'inline-block';
      s.textContent = ch;
      el.appendChild(s);
      out.push(s);
    });
    return out;
  }

  /* ---------- Preloader + הכניסה דרך המוח ---------- */
  var preloader = document.getElementById('preloader');
  var revealed = false;

  function finishReveal() {
    if (revealed) return;
    revealed = true;
    docEl.classList.add('preloader-done');
    if (preloader && preloader.parentNode) preloader.parentNode.removeChild(preloader);
    document.body.style.overflow = '';
    window.dispatchEvent(new Event('shift:reveal'));
    if (hasST) ScrollTrigger.refresh();
    if (location.hash && location.hash.length > 1 && document.querySelector(location.hash)) {
      requestAnimationFrame(function () { scrollToHash(location.hash); });
    }
  }

  /* ---------- הכניסה דרך המוח ----------
     הגלילה מניעה צלילה מהחושך אל האור. הקלט מגיע מ-ScrollTrigger (אין מאזין
     scroll מקביל — Lenis כבר מנהל את הגלילה), אבל ההחלקה נשמרת מאב-הטיפוס:
     `eased += (target - eased) * 0.14` על טיקר GSAP. זה מה שגורם לצלילה
     להרגיש כמו נשימה במקום כמו קפיצות של גלגלת העכבר.

     המדידות נחשפות ל-window.__dive לצורכי דיווח ובדיקות. */
  var dive = (function initBrainDive() {
    var section = document.querySelector('.dive');
    var canvas = document.getElementById('brainCanvas');
    if (!section || !canvas) return null;

    var MOBILE = !DESKTOP.matches;
    var DIR = 'assets/brain-seq/' + (MOBILE ? 'm/' : 'd/');
    var COUNT = MOBILE ? 65 : 97;
    var ctx = canvas.getContext('2d', { alpha: false });
    var frames = [];
    var loaded = 0;
    var current = -1;
    var t0 = (window.performance && performance.now) ? performance.now() : 0;
    var stats = { count: COUNT, dir: DIR, firstFrameMs: null, allFramesMs: null };
    window.__dive = stats;

    function pad(n) { return String(n).length >= 3 ? String(n) : ('00' + n).slice(-3); }

    function fit() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      draw(current < 0 ? 0 : current, true);
    }

    // ציור בכיסוי מלא — שקול ל-object-fit: cover
    function draw(i, force) {
      if (i === current && !force) return;
      var img = frames[i];
      if (!img || !img.complete || !img.naturalWidth) return;
      current = i;
      var cw = canvas.width, ch = canvas.height;
      var s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      var w = img.naturalWidth * s, h = img.naturalHeight * s;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    }

    function onFirstFrame() {
      stats.firstFrameMs = Math.round(((window.performance && performance.now) ? performance.now() : 0) - t0);
      docEl.classList.add('dive-live'); // מסתיר את תמונת הגיבוי
      fit();
      window.dispatchEvent(new Event('shift:dive-first-frame'));
    }

    function preload() {
      for (var i = 1; i <= COUNT; i++) {
        (function (idx) {
          var img = new Image();
          img.decoding = 'async';
          img.onload = img.onerror = function () {
            loaded++;
            if (idx === 1) onFirstFrame();
            if (loaded >= COUNT) {
              stats.allFramesMs = Math.round(((window.performance && performance.now) ? performance.now() : 0) - t0);
              window.dispatchEvent(new Event('shift:dive-ready'));
            }
          };
          img.src = DIR + 'f' + pad(idx) + '.webp';
          frames[idx - 1] = img;
        })(i);
      }
    }

    var gate = document.getElementById('diveGate');
    var passing = document.getElementById('divePassing');
    var arrival = document.getElementById('diveArrival');
    var veil = document.getElementById('diveVeil');
    var lines = passing ? Array.prototype.slice.call(passing.querySelectorAll('p')) : [];

    // מצב מופחת-תנועה: פריים מייצג אחד, הכותרת מיד, בלי צלילה
    if (REDUCED || !FULL) {
      var still = new Image();
      still.onload = function () { frames[0] = still; onFirstFrame(); };
      still.src = DIR + 'f' + pad(COUNT) + '.webp'; // הפריים המואר — שם הכותרת חיה
      window.addEventListener('resize', fit, { passive: true });
      return stats;
    }

    var target = 0, eased = 0;

    function render() {
      eased += (target - eased) * 0.14;
      if (Math.abs(target - eased) < 0.0004) eased = target;
      var p = eased;

      draw(Math.min(COUNT - 1, Math.round(p * (COUNT - 1))));

      // שער הפתיחה נסוג פנימה
      var gOut = Math.min(p / 0.18, 1);
      if (gate) {
        gate.style.opacity = String(1 - gOut);
        gate.style.transform = 'scale(' + (1 + gOut * 0.35) + ') translateZ(0)';
        gate.style.pointerEvents = gOut > 0.9 ? 'none' : '';
      }

      // מילות המסע — כל אחת נדלקת סביב הנקודה שלה
      for (var i = 0; i < lines.length; i++) {
        var el = lines[i];
        var at = parseFloat(el.dataset.at);
        var vis = Math.max(0, 1 - Math.abs(p - at) / 0.1);
        el.style.opacity = String(vis);
        el.style.transform = 'translateY(' + (-50 + (p - at) * 90) + '%) scale(' + (0.96 + vis * 0.06) + ')';
      }

      // ההגעה אל האור
      var aIn = Math.max(0, Math.min((p - 0.86) / 0.14, 1));
      if (arrival) {
        arrival.style.opacity = String(aIn);
        arrival.style.pointerEvents = aIn > 0.6 ? 'auto' : 'none';
      }
      if (veil) veil.style.opacity = String(1 - aIn);
    }

    gsap.ticker.add(render);

    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: function (self) { target = self.progress; },
      onRefresh: function (self) { target = eased = self.progress; render(); }
    });

    // חשוף לבדיקות אוטומטיות, כמו window.__lenis — בסביבת בדיקה ה-rAF
    // קפוא ולכן צריך דרך להריץ את הפריים ידנית ולקרוא את המצב.
    stats.render = render;
    stats.state = function () { return { target: target, eased: eased, frame: current }; };

    preload();
    fit();
    window.addEventListener('resize', fit, { passive: true });
    return stats;
  })();

  if (!preloader || !FULL) {
    finishReveal();
  } else {
    document.body.style.overflow = 'hidden';
    var plLogo = preloader.querySelector('img');
    var plLine = document.getElementById('preloaderLine');

    // הלוגו נבנה, והמסך נפתח ברגע שהפריים הראשון של המוח מוכן —
    // לא כשכל 97 הפריימים טעונים. שאר הרצף ממשיך להיטען ברקע.
    var openTl = gsap.timeline({ onComplete: finishReveal });
    openTl.fromTo(plLogo,
      { opacity: 0, scale: 0.94, filter: 'blur(6px)' },
      { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.7 }, 0);
    if (plLine) openTl.fromTo(plLine, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 0.35);
    openTl.addPause();

    var opened = false;
    function openCurtain() {
      if (opened) return;
      opened = true;
      var out = gsap.timeline({ onComplete: finishReveal });
      if (plLine) out.to(plLine, { autoAlpha: 0, y: -20, duration: 0.4, ease: 'power2.in' }, 0);
      out.to(plLogo, { y: -50, opacity: 0, duration: 0.6, ease: 'power3.inOut' }, 0.05);
      out.to(preloader, { yPercent: -100, duration: 0.9, ease: 'power3.inOut' }, 0.15);
    }
    // הפריים הראשון מוכן → נפתחים. רשת ביטחון: לא מחכים לו יותר מ-2.5 שניות.
    if (dive && dive.firstFrameMs !== null) openCurtain();
    else window.addEventListener('shift:dive-first-frame', openCurtain, { once: true });
    setTimeout(openCurtain, 2500);
  }
  setTimeout(finishReveal, 4000);

  if (!FULL) return; // מכאן והלאה — רק כשמנוע התנועה המלא פעיל

  /* ---------- במת הכיסוי: ההגעה נסוגה בזמן שההצהרה מחליקה מעליה ----------
     ההירו הישן (רקע, אורורה, שדה נוירונים, פרלקסת עכבר) הוסר יחד עם
     המרקאפ שלו — הצלילה אל המוח תופסת את מקומו ועושה את אותה עבודה,
     רק שהיא מונעת מהגלילה של המבקר ולא רצה מעצמה. */
  (function initCoverStage() {
    var statement = document.querySelector('.cover-stage .statement');
    // חשוב: על .arrival עצמו רץ ה-opacity של הצלילה (render). שני כותבים
    // לאותה תכונה נלחמים זה בזה — ובפועל הכותרת נעלמה לגמרי. לכן הנסיגה
    // מוחלת על העטיפה הפנימית, וה-opacity של השתיים מוכפל בטבעיות.
    var inner = document.querySelector('.arrival-in');
    if (!statement || !inner) return;
    gsap.to(inner, {
      scale: 0.96, autoAlpha: 0.25, ease: 'none',
      scrollTrigger: { trigger: statement, start: 'top bottom', end: 'top top', scrub: true }
    });
  })();


  /* ---------- נקודת עכבר זוהרת ---------- */
  (function initCursor() {
    if (!FINE_POINTER.matches || !DESKTOP.matches) return;
    var dot = document.getElementById('cursorDot');
    if (!dot) return;
    var qx = gsap.quickTo(dot, 'x', { duration: 0.18, ease: 'power2.out' });
    var qy = gsap.quickTo(dot, 'y', { duration: 0.18, ease: 'power2.out' });
    var shown = false;
    document.addEventListener('mousemove', function (e) {
      if (!shown) { shown = true; gsap.to(dot, { autoAlpha: 1, duration: 0.3 }); }
      qx(e.clientX); qy(e.clientY);
      var interactive = e.target.closest('a, button, .btn');
      gsap.to(dot, { scale: interactive ? 2.6 : 1, opacity: interactive ? 0.55 : 1, duration: 0.25 });
    });
    document.addEventListener('mouseleave', function () {
      shown = false;
      gsap.to(dot, { autoAlpha: 0, duration: 0.25 });
    });
  })();

  /* ---------- כניסות כלליות: כותרת במסכה, השאר בפייד ---------- */
  gsap.utils.toArray('.section-head').forEach(function (head) {
    var h2 = head.querySelector('h2');
    if (h2 && !h2.querySelector('.mask-reveal')) {
      var outer = document.createElement('span');
      outer.className = 'mask-reveal';
      var inner = document.createElement('span');
      inner.innerHTML = h2.innerHTML;
      outer.appendChild(inner);
      h2.innerHTML = '';
      h2.appendChild(outer);
      gsap.from(inner, {
        yPercent: 115, duration: 1.05, ease: 'power3.out',
        scrollTrigger: { trigger: head, start: 'top 80%' }
      });
    }
    var rest = Array.prototype.filter.call(head.children, function (c) { return c !== h2; });
    gsap.from(rest, {
      autoAlpha: 0, y: 26, duration: 0.9, stagger: 0.12, clearProps: CLEAR,
      scrollTrigger: { trigger: head, start: 'top 78%' }
    });
  });

  /* ---------- הצהרה: חשיפה מילה-מילה, ההדגשה מאוחרת ---------- */
  (function initStatement() {
    var title = document.querySelector('.statement-title');
    var text = document.querySelector('.statement-text');
    if (!title) return;
    var em = title.querySelector('em');
    splitWords(title);
    var words = title.querySelectorAll('.w');
    var emWords = em ? em.querySelectorAll('.w') : [];

    var label = document.querySelector('.statement .label');
    if (label) {
      gsap.from(label, {
        autoAlpha: 0, y: 16, duration: 0.6, clearProps: CLEAR,
        scrollTrigger: { trigger: title, start: 'top 78%' }
      });
    }

    var tl = gsap.timeline({
      scrollTrigger: { trigger: title, start: 'top 72%' }
    });
    tl.from(words, {
      autoAlpha: 0, y: 22, duration: 0.7, clearProps: CLEAR,
      stagger: { each: 0.05, from: 'start' } // כמו הקראה — לפי סדר הקריאה
    });
    if (em && emWords.length) {
      em.classList.add('em-underline');
      tl.from(emWords, { color: 'rgba(24,22,59,0.3)', duration: 0.5, stagger: 0.05, clearProps: 'color' }, '-=0.3');
      tl.to(em, { backgroundSize: '100% 2px', duration: 0.9, ease: 'power3.inOut' }, '-=0.2');
    }
    if (text) {
      gsap.from(text, {
        autoAlpha: 0, y: 26, duration: 0.9, clearProps: CLEAR,
        scrollTrigger: { trigger: text, start: 'top 82%' }
      });
    }
  })();

  /* ---------- השיטה: הבמה הנעוצה (האפקט המרכזי) ---------- */
  ScrollTrigger.matchMedia({
    '(min-width: 900px)': function () {
      var section = document.querySelector('.worlds');
      var stage = document.getElementById('worldStage');
      if (!section || !stage) return;
      docEl.classList.add('worlds-pinned');
      var rows = gsap.utils.toArray('.world-row');
      var roll = document.querySelector('.world-bignum-roll');

      rows.forEach(function (row, i) {
        gsap.set(row, { autoAlpha: i === 0 ? 1 : 0 });
      });

      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=220%',
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
          refreshPriority: 1
        }
      });

      function swap(from, to, pos) {
        var toImg = rows[to].querySelector('.world-media img');
        tl.to(rows[from], { autoAlpha: 0, y: -46, duration: 0.45, ease: 'power2.in' }, pos);
        tl.set(rows[from], { y: 0 });
        tl.fromTo(rows[to],
          { autoAlpha: 0, y: 60 },
          { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power3.out' }, pos + 0.45);
        if (toImg) {
          tl.fromTo(toImg, { scale: 1.08 }, { scale: 1, duration: 0.7, ease: 'power3.out' }, pos + 0.45);
        }
        if (roll) {
          tl.to(roll, { yPercent: -33.334 * to, duration: 0.6, ease: 'power3.inOut' }, pos + 0.2);
        }
      }
      swap(0, 1, 0);
      swap(1, 2, 1);

      return function () { docEl.classList.remove('worlds-pinned'); };
    },
    '(max-width: 899px)': function () {
      gsap.utils.toArray('.world-row').forEach(function (row) {
        gsap.from(row, {
          autoAlpha: 0, y: 40, duration: 0.9, clearProps: CLEAR,
          scrollTrigger: { trigger: row, start: 'top 80%' }
        });
      });
    }
  });

  /* ---------- רשתות קלפים (סל המוצרים + הרגלים) ---------- */
  gsap.utils.toArray('.cards-3').forEach(function (grid) {
    gsap.from(grid.children, {
      autoAlpha: 0, y: 44, duration: 0.9, stagger: 0.13, clearProps: CLEAR,
      scrollTrigger: { trigger: grid, start: 'top 80%' }
    });
  });

  /* ---------- הסיפור: פרלקסה + הציטוט אחרון ---------- */
  (function initStory() {
    var img = document.querySelector('.story-media img');
    var body = document.querySelector('.story-body');
    if (img) {
      // התמונה מוגדלת מעט כדי שהפרלקסה לא תחשוף שוליים
      gsap.fromTo(img, { yPercent: -7, scale: 1.16 }, {
        yPercent: 7, scale: 1.16, ease: 'none',
        scrollTrigger: { trigger: '.story', start: 'top bottom', end: 'bottom top', scrub: true }
      });
      gsap.from('.story-media', {
        autoAlpha: 0, scale: 0.96, duration: 1.1,
        scrollTrigger: { trigger: '.story', start: 'top 75%' }
      });
    }
    if (body) {
      var parts = body.querySelectorAll('.label, h2, p');
      gsap.from(parts, {
        autoAlpha: 0, y: 28, duration: 0.8, stagger: 0.12, clearProps: CLEAR,
        scrollTrigger: { trigger: body, start: 'top 75%' }
      });
      var quote = body.querySelector('blockquote');
      if (quote) {
        gsap.from(quote, {
          autoAlpha: 0, y: 26, duration: 1.0, delay: 0.15, clearProps: CLEAR,
          scrollTrigger: { trigger: quote, start: 'top 85%' }
        });
      }
    }
  })();

  /* ---------- מה נפתח: פריט-פריט, ואז הרגע של אהבה ---------- */
  gsap.from('.chips li', {
    autoAlpha: 0, y: 22, duration: 0.55, clearProps: CLEAR,
    stagger: { each: 0.05, from: 'start' },
    scrollTrigger: { trigger: '.chips', start: 'top 82%' }
  });
  (function initLove() {
    var love = document.querySelector('.love-card');
    if (!love) return;
    gsap.from(love, {
      autoAlpha: 0, y: 36, duration: 1.0, delay: 0.35, clearProps: CLEAR,
      scrollTrigger: {
        trigger: love, start: 'top 85%',
        onEnter: function () {
          setTimeout(function () { love.classList.add('glow'); }, 900);
        }
      }
    });
  })();

  /* ---------- המסלול: קו שמצייר את עצמו + שלבים נדלקים ---------- */
  (function initPath() {
    var line = document.getElementById('pathLine');
    var steps = gsap.utils.toArray('.step');
    if (line) {
      var from = DESKTOP.matches ? { scaleX: 0 } : { scaleY: 0 };
      var to = DESKTOP.matches ? { scaleX: 1 } : { scaleY: 1 };
      gsap.fromTo(line, from, Object.assign({}, to, {
        ease: 'none',
        scrollTrigger: { trigger: '.steps', start: 'top 75%', end: 'bottom 60%', scrub: true }
      }));
    }
    steps.forEach(function (step, i) {
      gsap.from(step, {
        autoAlpha: 0, y: 34, duration: 0.8, clearProps: CLEAR,
        scrollTrigger: {
          trigger: step, start: 'top 82%',
          onEnter: function () {
            setTimeout(function () { step.classList.add('lit'); }, 250 + i * 120);
          },
          onLeaveBack: function () { step.classList.remove('lit'); }
        }
      });
    });
  })();

  /* ---------- סצנת הסיום: הגעה, זוהר, מילת הענק והפוטר ---------- */
  (function initClosing() {
    var closing = document.querySelector('.closing');
    var cta = document.querySelector('.cta');
    if (cta) {
      gsap.from('.cta-content > *', {
        autoAlpha: 0, y: 30, duration: 0.9, stagger: 0.15, clearProps: CLEAR,
        scrollTrigger: { trigger: cta, start: 'top 70%' }
      });
    }
    if (!closing) return;
    // הזוהר עולה מהאופק ככל שמתקרבים לסוף
    gsap.fromTo(closing, { '--cta-glow': 0 }, {
      '--cta-glow': 1, ease: 'none',
      scrollTrigger: { trigger: closing, start: 'top 80%', end: 'bottom bottom', scrub: true }
    });
    // מילת הענק SHIFT עולה מתחתית הסצנה — חתימה איזאנמית
    var word = closing.querySelector('.closing-word');
    if (word) {
      gsap.fromTo(word, { yPercent: 60, autoAlpha: 0 }, {
        yPercent: 0, autoAlpha: 1, ease: 'none',
        scrollTrigger: { trigger: closing, start: 'top 70%', end: 'bottom bottom', scrub: true }
      });
    }
    // הפוטר נכנס בעדינות אחרון
    var footerBits = closing.querySelectorAll('.footer-grid > *, .footer-bottom');
    if (footerBits.length) {
      gsap.from(footerBits, {
        autoAlpha: 0, y: 22, duration: 0.8, stagger: 0.1, clearProps: CLEAR,
        scrollTrigger: { trigger: '.footer', start: 'top 96%' }
      });
    }
  })();


  /* ---------- המסלול: ציר, נקודות, רקע כהה→בהיר, ערימת שבועות ---------- */
  (function initProgram() {
    var prog = document.querySelector('.program');
    if (!prog) return;
    var fill = document.getElementById('spineFill');
    var dots = prog.querySelectorAll('.program-spine i');
    var weeksWrap = document.getElementById('programWeeks');

    if (weeksWrap && (fill || dots.length)) {
      ScrollTrigger.create({
        trigger: weeksWrap, start: 'top 70%', end: 'bottom 45%', scrub: 0.4,
        onUpdate: function (self) {
          if (fill) fill.style.height = (self.progress * 100).toFixed(1) + '%';
          var n = Math.round(self.progress * 21);
          dots.forEach(function (d, i) { d.classList.toggle('on', i < n); });
        }
      });
    }

    // הרקע נוסע מהישרדות (כהה) ליצירה (בהיר) לאורך הסקשן
    gsap.fromTo(prog, { backgroundColor: '#121234' }, {
      backgroundColor: '#F6F5F2', ease: 'none',
      scrollTrigger: { trigger: prog, start: 'top 30%', end: 'bottom 110%', scrub: true }
    });
    ScrollTrigger.create({
      trigger: prog, start: '52% center', end: 'bottom -10%',
      onToggle: function (self) { prog.classList.toggle('lit', self.isActive); }
    });

    // דסקטופ: שבוע חדש שנערם מעמעם את הקודם מאחור
    if (DESKTOP.matches) {
      var cards = gsap.utils.toArray('.week-card');
      cards.forEach(function (card, i) {
        if (i === 0) return;
        gsap.to(cards[i - 1], {
          scale: 0.96, autoAlpha: 0.45, ease: 'none',
          scrollTrigger: { trigger: card, start: 'top 85%', end: 'top ' + (72 + 30 + i * 16) + 'px', scrub: true }
        });
      });
    }

    // שורות הימים נחשפות בהדרגה
    gsap.utils.toArray('.day-item').forEach(function (row) {
      gsap.from(row, {
        autoAlpha: 0, y: 18, duration: 0.6, clearProps: CLEAR,
        scrollTrigger: { trigger: row, start: 'top 90%' }
      });
    });

    // צ'יפים צפים
    gsap.from('.prog-chip', {
      autoAlpha: 0, y: 20, duration: 0.8, stagger: 0.2,
      scrollTrigger: { trigger: prog, start: 'top 70%' }
    });
  })();

  /* ---------- אירועים: וידאו-לופ (דסקטופ) + כניסות + פרלקסת תמונות ---------- */
  (function initEvents() {
    var section = document.querySelector('.events');
    if (!section) return;
    var video = document.getElementById('eventsVideo');
    if (video && DESKTOP.matches) {
      // טעינה עצלה + נגן/עצור בטריגר אחד — עמיד גם בקפיצות עוגן שמדלגות
      // על הטווח כולו (once:true נהרג בקפיצה כזו בלי לטעון כלל)
      ScrollTrigger.create({
        trigger: section, start: 'top 95%', end: 'bottom top',
        onToggle: function (self) {
          if (self.isActive) {
            if (!video.src) video.src = video.dataset.src;
            if (!document.hidden) video.play().catch(function () {});
          } else if (video.src) {
            video.pause();
          }
        }
      });
    }
    gsap.utils.toArray('.event-card').forEach(function (card, i) {
      gsap.from(card, {
        autoAlpha: 0, y: 54, duration: 1.0, clearProps: CLEAR,
        scrollTrigger: { trigger: card, start: 'top 85%' }
      });
      var img = card.querySelector('.event-media img');
      if (img) {
        gsap.fromTo(img, { yPercent: -7, scale: 1.15 }, {
          yPercent: 7, scale: 1.15, ease: 'none',
          scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      }
    });
  })();

  /* ---------- פרלקסה לכדור הצף של העולמות ---------- */
  gsap.to('.worlds-sphere', {
    yPercent: -22, ease: 'none',
    scrollTrigger: { trigger: '.worlds', start: 'top bottom', end: 'bottom top', scrub: true }
  });

  /* ---------- פס התקדמות עליון ---------- */
  gsap.set('#scrollProgress', { scaleX: 0 });
  gsap.to('#scrollProgress', {
    scaleX: 1, ease: 'none',
    scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 }
  });

  /* ---------- ניווט נקודות ---------- */
  (function initDotNav() {
    var nav = document.getElementById('dotNav');
    if (!nav) return;
    var dots = nav.querySelectorAll('a');
    var LIGHT = { '#method': 1, '#story': 1 };
    dots.forEach(function (dot) {
      var hash = dot.getAttribute('href');
      // '#top' הוא ההירו הדביק — עוקבים אחרי במת הכיסוי הסטטית במקומו
      var target = hash === '#top'
        ? document.querySelector('.cover-stage')
        : document.querySelector(hash);
      if (!target) return;
      ScrollTrigger.create({
        trigger: target,
        start: 'top center',
        end: 'bottom center',
        onToggle: function (self) {
          if (self.isActive) {
            dots.forEach(function (d) { d.classList.remove('active'); });
            dot.classList.add('active');
            nav.classList.toggle('on-light', !!LIGHT[hash]);
          }
        }
      });
    });
  })();

  /* ---------- כפתורים מגנטיים (עכבר בלבד) ---------- */
  if (FINE_POINTER.matches) {
    gsap.utils.toArray('.btn-primary, .btn-ghost').forEach(function (btn) {
      var qx = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3.out' });
      var qy = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3.out' });
      btn.addEventListener('mousemove', function (e) {
        var r = btn.getBoundingClientRect();
        qx((e.clientX - r.left - r.width / 2) * 0.18);
        qy((e.clientY - r.top - r.height / 2) * 0.3);
      });
      btn.addEventListener('mouseleave', function () { qx(0); qy(0); });
    });
  }

  /* ---------- רענון אחרי טעינת תמונות ---------- */
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });

  } catch (err) {
    // המנוע קרס באתחול — משחררים את מסך הפתיחה כדי שהאתר יישאר שמיש
    try {
      document.documentElement.classList.add('preloader-done');
      var deadPl = document.getElementById('preloader');
      if (deadPl && deadPl.parentNode) deadPl.parentNode.removeChild(deadPl);
      document.body.style.overflow = '';
      window.dispatchEvent(new Event('shift:reveal'));
    } catch (e2) { /* אין יותר מה לעשות */ }
    if (window.console && console.error) console.error('SHIFT motion init failed:', err);
  }
})();
