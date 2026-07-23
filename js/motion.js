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

  /* ---------- Preloader + כניסת הירו ---------- */
  var preloader = document.getElementById('preloader');
  var revealed = false;
  var heroChars = [];
  var heroGrad = null;

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

  function buildHeroIntro() {
    if (!FULL) return null;
    var label = document.querySelector('.hero-label');
    var h1 = document.querySelector('.hero h1');
    var sub = document.querySelector('.hero-sub');
    var ctas = document.querySelectorAll('.hero-ctas .btn');
    var scrollHint = document.querySelector('.hero-scroll');
    if (!h1) return null;

    heroGrad = h1.querySelector('.grad-text');
    Array.prototype.slice.call(h1.childNodes).forEach(function (node) {
      if (node.nodeType === 3 && node.textContent.trim()) {
        var span = document.createElement('span');
        span.className = 'h1-word';
        span.style.display = 'inline-block';
        span.textContent = node.textContent.trim();
        h1.insertBefore(span, node);
        h1.removeChild(node);
        h1.insertBefore(document.createTextNode(' '), span.nextSibling);
        heroChars = splitChars(span);
      }
    });

    // הכנת הגרדיאנט להברקה: חלון רחב שנוכל להזיז לרוחבו
    if (heroGrad) {
      gsap.set(heroGrad, { backgroundSize: '250% 100%', backgroundPosition: '85% 50%' });
    }

    var tl = gsap.timeline({
      paused: true,
      onComplete: function () {
        // קיבוע מצב סופי נקי: גם אם tween בודד נהרג בסביבה חריגה,
        // כל רכיבי ההירו מסיימים גלויים לפי הסטייל-שיט
        gsap.set([label, sub, scrollHint], { clearProps: 'all' });
        // הברקה חד-פעמית על "ליצירה" — מימין לשמאל, כמו כיוון הקריאה
        if (heroGrad) {
          gsap.to(heroGrad, {
            backgroundPosition: '15% 50%', duration: 1.4, ease: 'power2.inOut'
          });
        }
        initHeroScrollDrift();
      }
    });
    if (label) tl.from(label, { autoAlpha: 0, y: 18, duration: 0.6 }, 0);
    if (heroChars.length) {
      tl.from(heroChars, {
        autoAlpha: 0,
        y: '0.55em',
        duration: 0.7,
        stagger: { each: 0.045, from: 'start' } // RTL: לפי סדר הקריאה בעברית
      }, 0.15);
    }
    if (heroGrad) {
      tl.from(heroGrad, {
        autoAlpha: 0, y: 36, scale: 0.96, filter: 'blur(8px)', duration: 0.9,
        clearProps: 'filter'
      }, 0.6);
    }
    if (sub) tl.from(sub, { autoAlpha: 0, y: 24, duration: 0.8 }, 0.95);
    if (ctas.length) {
      tl.from(ctas, { autoAlpha: 0, y: 20, duration: 0.6, stagger: 0.1, clearProps: CLEAR }, 1.15);
    }
    if (scrollHint) tl.from(scrollHint, { autoAlpha: 0, duration: 0.6 }, 1.4);
    return tl;
  }

  // בגלילה החוצה מההירו: האותיות "נפרדות" — חצי מרחפות מעלה, חצי שוקעות
  function initHeroScrollDrift() {
    if (!heroChars.length) return;
    gsap.to(heroChars, {
      yPercent: function (i) { return i % 2 ? -70 : 45; },
      autoAlpha: 0.12,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: '70% top', scrub: true }
    });
    if (heroGrad) {
      gsap.to(heroGrad, {
        yPercent: 30, autoAlpha: 0.2, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: '70% top', scrub: true }
      });
    }
  }

  if (!preloader || !FULL) {
    finishReveal();
  } else {
    document.body.style.overflow = 'hidden';
    var plLogo = preloader.querySelector('img');
    var plLine = document.getElementById('preloaderLine');
    var heroIntro = buildHeroIntro();

    // המשפט מופיע מילה-מילה, הלוגו נבנה, והמסך נפתח אל ההירו
    var plWords = [];
    if (plLine) {
      splitWords(plLine);
      plWords = plLine.querySelectorAll('.w');
      gsap.set(plLine, { opacity: 1 });
    }

    var tl = gsap.timeline({
      onComplete: function () {
        finishReveal();
        if (heroIntro) heroIntro.play();
        // "צילום פתיחה": הרקע מתקרב לאט אל מנוחה
        gsap.fromTo('.hero-bg', { scale: 1.14 }, {
          scale: 1, duration: 8, ease: 'power2.out'
        });
      }
    });
    if (plWords.length) {
      tl.from(plWords, { autoAlpha: 0, y: 22, duration: 0.7, stagger: 0.22 }, 0);
    }
    tl.fromTo(plLogo,
      { opacity: 0, scale: 0.94, filter: 'blur(6px)' },
      { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.6 }, plWords.length ? 0.85 : 0);
    tl.to(plLogo, { scale: 1.02, duration: 0.35, ease: 'power1.inOut' });
    tl.to(plLine, { autoAlpha: 0, y: -30, duration: 0.5, ease: 'power2.in' }, 'open');
    tl.to(plLogo, { y: -60, opacity: 0, duration: 0.7, ease: 'power3.inOut' }, 'open+=0.05');
    tl.to(preloader, { yPercent: -100, duration: 0.9, ease: 'power3.inOut' }, 'open+=0.15');
  }
  setTimeout(finishReveal, 4000);

  if (!FULL) return; // מכאן והלאה — רק כשמנוע התנועה המלא פעיל

  /* ---------- הירו: שדה נוירונים חי + מגיב לעכבר ---------- */
  (function initNeurons() {
    if (!DESKTOP.matches) return;
    var canvas = document.getElementById('heroNeurons');
    var hero = document.querySelector('.hero');
    if (!canvas || !hero) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var running = false, W, H, nodes = [];
    var COUNT = 42, LINK = 150;
    var mouse = { x: -9999, y: -9999, active: false };

    function resize() {
      W = hero.offsetWidth; H = hero.offsetHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function seed() {
      nodes = [];
      for (var i = 0; i < COUNT; i++) {
        nodes.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18,
          r: 1 + Math.random() * 1.4
        });
      }
    }
    function tick() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      var i, j, a, b;

      // הילת אור עדינה סביב הסמן — כמו סינפסה שמתעוררת
      if (mouse.active) {
        var g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 200);
        g.addColorStop(0, 'rgba(92, 187, 240, 0.10)');
        g.addColorStop(1, 'rgba(92, 187, 240, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(mouse.x - 200, mouse.y - 200, 400, 400);
      }

      for (i = 0; i < COUNT; i++) {
        a = nodes[i];
        // דחייה עדינה מהסמן — השדה "מפנה מקום"
        if (mouse.active) {
          var mdx = a.x - mouse.x, mdy = a.y - mouse.y;
          var md2 = mdx * mdx + mdy * mdy;
          if (md2 < 36100 && md2 > 400) {
            var md = Math.sqrt(md2);
            var f = (190 - md) / 190 * 0.028;
            a.vx -= (mdx / md) * f; // משיכה עדינה אל הסמן
            a.vy -= (mdy / md) * f;
          }
        }
        // ריסון כדי שהשדה יישאר רגוע
        a.vx *= 0.985; a.vy *= 0.985;
        var sp = Math.abs(a.vx) + Math.abs(a.vy);
        if (sp < 0.08) { a.vx += (Math.random() - 0.5) * 0.02; a.vy += (Math.random() - 0.5) * 0.02; }
        a.x += a.vx; a.y += a.vy;
        if (a.x < -20) a.x = W + 20; if (a.x > W + 20) a.x = -20;
        if (a.y < -20) a.y = H + 20; if (a.y > H + 20) a.y = -20;
      }
      for (i = 0; i < COUNT; i++) {
        a = nodes[i];
        for (j = i + 1; j < COUNT; j++) {
          b = nodes[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            var alpha = (1 - Math.sqrt(d2) / LINK) * 0.16;
            ctx.strokeStyle = 'rgba(92, 187, 240, ' + alpha.toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (i = 0; i < COUNT; i++) {
        a = nodes[i];
        ctx.fillStyle = 'rgba(154, 214, 248, 0.5)';
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.2832); ctx.fill();
      }
      requestAnimationFrame(tick);
    }
    function setRunning(on) {
      if (on && !running) { running = true; requestAnimationFrame(tick); }
      else if (!on) running = false;
    }
    resize(); seed(); setRunning(true);
    window.addEventListener('resize', resize);
    hero.addEventListener('mousemove', function (e) {
      var r = hero.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.active = true;
    });
    hero.addEventListener('mouseleave', function () { mouse.active = false; });
    ScrollTrigger.create({
      trigger: hero, start: 'top bottom', end: 'bottom top',
      onToggle: function (self) { setRunning(self.isActive && !document.hidden); }
    });
    document.addEventListener('visibilitychange', function () {
      setRunning(!document.hidden);
    });
  })();

  /* ---------- הירו: פרלקסת עכבר תלת-שכבתית ---------- */
  (function initHeroPointer() {
    if (!DESKTOP.matches || !FINE_POINTER.matches) return;
    var hero = document.querySelector('.hero');
    var bg = document.getElementById('heroBg');
    var content = document.querySelector('.hero-content');
    if (!hero || !bg || !content) return;
    var bx = gsap.quickTo(bg, 'x', { duration: 1.1, ease: 'power3.out' });
    var by = gsap.quickTo(bg, 'y', { duration: 1.1, ease: 'power3.out' });
    var cx = gsap.quickTo(content, 'x', { duration: 0.9, ease: 'power3.out' });
    var cy = gsap.quickTo(content, 'y', { duration: 0.9, ease: 'power3.out' });
    hero.addEventListener('mousemove', function (e) {
      var r = hero.getBoundingClientRect();
      var nx = (e.clientX - r.left) / r.width - 0.5;
      var ny = (e.clientY - r.top) / r.height - 0.5;
      bx(nx * 22); by(ny * 14);        // הרקע נע עם העכבר
      cx(nx * -12); cy(ny * -8);       // התוכן נע הפוך — תחושת עומק
    });
    hero.addEventListener('mouseleave', function () { bx(0); by(0); cx(0); cy(0); });
  })();

  /* ---------- הירו: דעיכת אינדיקטור הגלילה ---------- */
  gsap.to('.hero-scroll', {
    autoAlpha: 0, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: '5% top', end: '20% top', scrub: true }
  });


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

  /* ---------- CTA: תחושת הגעה ---------- */
  (function initCTA() {
    var cta = document.querySelector('.cta');
    if (!cta) return;
    gsap.fromTo(cta, { '--cta-glow': 0 }, {
      '--cta-glow': 1, ease: 'none',
      scrollTrigger: { trigger: cta, start: 'top 80%', end: 'center center', scrub: true }
    });
    gsap.from('.cta-content > *', {
      autoAlpha: 0, y: 30, duration: 0.9, stagger: 0.15, clearProps: CLEAR,
      scrollTrigger: { trigger: cta, start: 'top 70%' }
    });
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
      ScrollTrigger.create({
        trigger: section, start: 'top 90%', once: true,
        onEnter: function () {
          video.src = video.dataset.src;
          video.play().catch(function () {});
        }
      });
      ScrollTrigger.create({
        trigger: section, start: 'top bottom', end: 'bottom top',
        onToggle: function (self) {
          if (!video.src) return;
          if (self.isActive && !document.hidden) video.play().catch(function () {});
          else video.pause();
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
      var target = document.querySelector(hash);
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
})();
