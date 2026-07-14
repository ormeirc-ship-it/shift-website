/* ============================================================
   SHIFT — motion.js
   חוקי בית לתנועה:
   - easing אחיד: power3.out (מעברי מסך: power3.inOut)
   - משכים: 0.6s–1.2s (פידבק מיידי קצר יותר)
   - כיבוד מלא של prefers-reduced-motion: reduce
   - RTL: כיווני ציר X תמיד מפורשים; קווי התקדמות נמתחים מימין
   ============================================================ */

(function () {
  'use strict';

  var docEl = document.documentElement;
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NAV_OFFSET = -72;
  var DESKTOP = window.matchMedia('(min-width: 900px)');
  var FINE_POINTER = window.matchMedia('(hover: hover) and (pointer: fine)');

  var hasGsap = typeof gsap !== 'undefined';
  var hasST = typeof ScrollTrigger !== 'undefined';
  var hasLenis = typeof Lenis !== 'undefined';
  var FULL = hasGsap && hasST && !REDUCED;

  if (hasGsap) {
    gsap.defaults({ ease: 'power3.out', duration: 0.9 });
    if (hasST) gsap.registerPlugin(ScrollTrigger);
  }
  if (FULL) docEl.classList.add('gsap-on');

  /* ---------- Lenis: גלילה חלקה ---------- */
  var lenis = null;
  if (!REDUCED && hasLenis && hasGsap) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenis.on('scroll', function () { if (hasST) ScrollTrigger.update(); });
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
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

  /* ---------- עזרים: פיצול טקסט למילים/אותיות ---------- */
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

  function finishReveal() {
    if (revealed) return;
    revealed = true;
    docEl.classList.add('preloader-done');
    if (preloader && preloader.parentNode) preloader.parentNode.removeChild(preloader);
    document.body.style.overflow = '';
    window.dispatchEvent(new Event('shift:reveal'));
    if (hasST) ScrollTrigger.refresh();
    // קישור עמוק (#hash) שנטען תוך כדי מסך הפתיחה — גוללים אליו עכשיו,
    // אחרי שה-pin וה-triggers קיבלו מידות סופיות
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

    // "מהישרדות" — אות-אות; "ליצירה" (הגרדיאנט) — יחידה אחת עם טשטוש שמתבהר
    var grad = h1.querySelector('.grad-text');
    var chars = [];
    Array.prototype.slice.call(h1.childNodes).forEach(function (node) {
      if (node.nodeType === 3 && node.textContent.trim()) {
        var span = document.createElement('span');
        span.className = 'h1-word';
        span.style.display = 'inline-block';
        span.textContent = node.textContent.trim();
        h1.insertBefore(span, node);
        h1.removeChild(node);
        h1.insertBefore(document.createTextNode(' '), span.nextSibling);
        chars = splitChars(span);
      }
    });

    var tl = gsap.timeline({ paused: true });
    if (label) tl.from(label, { autoAlpha: 0, y: 18, duration: 0.6 }, 0);
    if (chars.length) {
      tl.from(chars, {
        autoAlpha: 0,
        y: '0.55em',
        duration: 0.7,
        stagger: { each: 0.045, from: 'start' } // RTL: לפי סדר הקריאה בעברית
      }, 0.15);
    }
    if (grad) {
      tl.from(grad, {
        autoAlpha: 0, y: 36, scale: 0.96, filter: 'blur(8px)', duration: 0.9
      }, 0.6);
    }
    if (sub) tl.from(sub, { autoAlpha: 0, y: 24, duration: 0.8 }, 0.95);
    if (ctas.length) {
      tl.from(ctas, { autoAlpha: 0, y: 20, duration: 0.6, stagger: 0.1 }, 1.15);
    }
    if (scrollHint) tl.from(scrollHint, { autoAlpha: 0, duration: 0.6 }, 1.4);
    return tl;
  }

  if (!preloader || !FULL) {
    finishReveal();
  } else {
    document.body.style.overflow = 'hidden';
    var plLogo = preloader.querySelector('img');
    var heroIntro = buildHeroIntro();

    var tl = gsap.timeline({
      onComplete: function () {
        finishReveal();
        if (heroIntro) heroIntro.play();
      }
    });
    tl.fromTo(plLogo,
      { opacity: 0, scale: 0.94, filter: 'blur(6px)' },
      { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.6 });
    tl.to(plLogo, { scale: 1.02, duration: 0.35, ease: 'power1.inOut' });
    tl.to(plLogo, { y: -60, opacity: 0, duration: 0.7, ease: 'power3.inOut' }, 'open');
    tl.to(preloader, { yPercent: -100, duration: 0.9, ease: 'power3.inOut' }, 'open+=0.1');
  }
  setTimeout(finishReveal, 4000);

  if (!FULL) return; // מכאן והלאה — רק כשמנוע התנועה המלא פעיל

  /* ---------- הירו: רקע נוירונים חי ---------- */
  (function initNeurons() {
    if (!DESKTOP.matches) return;
    var canvas = document.getElementById('heroNeurons');
    var hero = document.querySelector('.hero');
    if (!canvas || !hero) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var running = false, W, H, nodes = [];
    var COUNT = 42, LINK = 150;

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
      var i, j, a, b, d2;
      for (i = 0; i < COUNT; i++) {
        a = nodes[i];
        a.x += a.vx; a.y += a.vy;
        if (a.x < -20) a.x = W + 20; if (a.x > W + 20) a.x = -20;
        if (a.y < -20) a.y = H + 20; if (a.y > H + 20) a.y = -20;
      }
      for (i = 0; i < COUNT; i++) {
        a = nodes[i];
        for (j = i + 1; j < COUNT; j++) {
          b = nodes[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          d2 = dx * dx + dy * dy;
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
    window.addEventListener('resize', function () { resize(); });
    ScrollTrigger.create({
      trigger: hero, start: 'top bottom', end: 'bottom top',
      onToggle: function (self) { setRunning(self.isActive && !document.hidden); }
    });
    document.addEventListener('visibilitychange', function () {
      setRunning(!document.hidden);
    });
  })();

  /* ---------- הירו: פרלקסה עדינה + דעיכת אינדיקטור ---------- */
  gsap.to('.hero-content', {
    yPercent: -14, autoAlpha: 0.25, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
  });
  gsap.to('.hero-scroll', {
    autoAlpha: 0, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: '5% top', end: '20% top', scrub: true }
  });

  /* ---------- כניסות כלליות: כותרות סקשן ---------- */
  gsap.utils.toArray('.section-head').forEach(function (head) {
    gsap.from(head.children, {
      autoAlpha: 0, y: 30, duration: 0.9, stagger: 0.12,
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
        autoAlpha: 0, y: 16, duration: 0.6,
        scrollTrigger: { trigger: title, start: 'top 78%' }
      });
    }

    var tl = gsap.timeline({
      scrollTrigger: { trigger: title, start: 'top 72%' }
    });
    tl.from(words, {
      autoAlpha: 0, y: 22, duration: 0.7,
      stagger: { each: 0.05, from: 'start' } // כמו הקראה — לפי סדר הקריאה
    });
    if (em && emWords.length) {
      em.classList.add('em-underline');
      tl.from(emWords, { color: 'rgba(24,22,59,0.3)', duration: 0.5, stagger: 0.05 }, '-=0.3');
      tl.to(em, { backgroundSize: '100% 2px', duration: 0.9, ease: 'power3.inOut' }, '-=0.2');
    }
    if (text) {
      gsap.from(text, {
        autoAlpha: 0, y: 26, duration: 0.9,
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
        var img = row.querySelector('.world-media img');
        if (img && i === 0) gsap.set(img, { scale: 1 });
      });

      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=220%',
          pin: true,
          scrub: 0.6,
          snap: { snapTo: [0, 0.5, 1], duration: 0.45, ease: 'power3.out' },
          anticipatePin: 1
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
          autoAlpha: 0, y: 40, duration: 0.9,
          scrollTrigger: { trigger: row, start: 'top 80%' }
        });
      });
    }
  });

  /* ---------- הרגלים: קלפים בהדרגה ---------- */
  gsap.from('.cards-3 .card', {
    autoAlpha: 0, y: 44, duration: 0.9, stagger: 0.13,
    scrollTrigger: { trigger: '.cards-3', start: 'top 80%' }
  });

  /* ---------- הסיפור: פרלקסה + הציטוט אחרון ---------- */
  (function initStory() {
    var img = document.querySelector('.story-media img');
    var body = document.querySelector('.story-body');
    if (img) {
      gsap.fromTo(img, { yPercent: -8 }, {
        yPercent: 8, ease: 'none',
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
        autoAlpha: 0, y: 28, duration: 0.8, stagger: 0.12,
        scrollTrigger: { trigger: body, start: 'top 75%' }
      });
      var quote = body.querySelector('blockquote');
      if (quote) {
        gsap.from(quote, {
          autoAlpha: 0, y: 26, duration: 1.0, delay: 0.15,
          scrollTrigger: { trigger: quote, start: 'top 85%' }
        });
      }
    }
  })();

  /* ---------- מה נפתח: פריט-פריט, ואז הרגע של אהבה ---------- */
  gsap.from('.chips li', {
    autoAlpha: 0, y: 22, duration: 0.55, stagger: { each: 0.05, from: 'start' },
    scrollTrigger: { trigger: '.chips', start: 'top 82%' }
  });
  (function initLove() {
    var love = document.querySelector('.love-card');
    if (!love) return;
    gsap.from(love, {
      autoAlpha: 0, y: 36, duration: 1.0, delay: 0.35,
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
        autoAlpha: 0, y: 34, duration: 0.8,
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
      autoAlpha: 0, y: 30, duration: 0.9, stagger: 0.15,
      scrollTrigger: { trigger: cta, start: 'top 70%' }
    });
  })();

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
    var LIGHT = { '#method': 1, '#story': 1, '#outcomes': 1, '#path': 1 };
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
