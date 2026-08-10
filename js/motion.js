/* ============================================================
   SHIFT - motion.js
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
  // (הגוף נשאר בהזחה המקורית - העטיפה נוספה בדיעבד ובכוונה לא הוזח מחדש)
  try {

  var docEl = document.documentElement;
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 🟢: נגזר מ---nav-h במקום מספר-קסם כפול (main.js כבר קורא מה-CSS)
  var NAV_OFFSET = -(parseFloat(getComputedStyle(docEl).getPropertyValue('--nav-h')) || 72);
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
  // ‏dive-hush הוצהר אופטימית ב-head (הסרגל שקט מהמסך הראשון). כשהמנוע
  // לא ירוץ אין מי שיסיר אותה בהמשך - משחררים כאן. במצב מופחת-תנועה
  // זה ליתר ביטחון (ה-CSS ממילא עוקף), בלי-GSAP זה קריטי.
  if (!FULL) docEl.classList.remove('dive-hush');

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
    // ההירו דביק (cover-stage) - מיקומו על המסך לא משקף את מקומו במסמך,
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
  // כפתור Back/Forward של הדפדפן מזיז באמת בין העוגנים -
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

  // מפעיל את יציאת מסך הפתיחה. היציאה עצמה ב-CSS, כדי שתתרחש גם כשחבילת
  // התנועה עדיין בדרך - זה בדיוק המצב ברשת איטית.
  // T11: אין כאן נגיעה ב-overflow - מאז T9 היחיד שנועל גלילה הוא התפריט,
  // ושחרור עיוור היה מוחק את הנעילה שלו מתחת לידיים.
  function dismissPreloader() {
    docEl.classList.add('preloader-done');
  }

  // ניקוי אחרי שהיציאה הסתיימה: מוציא את האלמנט ומודיע לשאר האתר.
  function finishReveal() {
    if (revealed) return;
    revealed = true;
    dismissPreloader();
    if (preloader && preloader.parentNode) preloader.parentNode.removeChild(preloader);
    window.dispatchEvent(new Event('shift:reveal'));
    if (hasST) ScrollTrigger.refresh();
    if (location.hash && location.hash.length > 1 && document.querySelector(location.hash)) {
      requestAnimationFrame(function () { scrollToHash(location.hash); });
    }
  }

  /* ---------- הכניסה דרך המוח ----------
     הגלילה מניעה צלילה מהחושך אל האור. הקלט מגיע מ-ScrollTrigger (אין מאזין
     scroll מקביל - Lenis כבר מנהל את הגלילה), אבל ההחלקה נשמרת מאב-הטיפוס:
     `eased += (target - eased) * 0.14` על טיקר GSAP. זה מה שגורם לצלילה
     להרגיש כמו נשימה במקום כמו קפיצות של גלגלת העכבר.

     המדידות נחשפות ל-window.__dive לצורכי דיווח ובדיקות. */
  var dive = (function initBrainDive() {
    var section = document.querySelector('.dive');
    var canvas = document.getElementById('brainCanvas');
    // אין צלילה ב-DOM - אין מי שינהל את שקט-הסרגל; משחררים את ההצהרה
    // האופטימית מה-head כדי שהסרגל לא יישאר נעול-נסתר
    if (!section || !canvas) { docEl.classList.remove('dive-hush'); return null; }

    var MOBILE = !DESKTOP.matches;
    // B2: הרצף דולל 97→60 (החלטת OC, 27.7) - פחות החלפות תמונה לצעד
    // גלילה ופחות בייטים ברשת איטית. המקור המלא שמור ב-_build/brain-seq-d97.
    var DIR = 'assets/brain-seq/' + (MOBILE ? 'm/' : 'd/');
    var COUNT = MOBILE ? 65 : 60;
    // פריט 40: מקבילות AVIF (חיסכון מדוד 16.5%). הפריים הראשון נשאר WebP -
    // הוא כבר preloaded מה-head ומשומש מהמטמון; הרצף (2..N) נבחר לפי
    // בדיקת-יכולת אמפירית (AVIF של פיקסל אחד), לא לפי זיהוי דפדפן.
    var seqDir = DIR, seqExt = '.webp';
    var avifProbe = new Promise(function (res) {
      var t = new Image();
      t.onload = function () { res(t.width === 1); };
      t.onerror = function () { res(false); };
      t.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAABcAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB9tZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=';
    });
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

    // ציור בכיסוי מלא - שקול ל-object-fit: cover
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

    // טעינה בשלבים, לא הכל בבת אחת.
    //
    // הגרסה הקודמת ירתה 97 בקשות במקביל. על localhost זה נראה מצוין
    // (פריים ראשון תוך 30ms), אבל במדידה על Slow 4G התברר שהפריים הראשון
    // מתחרה על רוחב הפס עם 96 אחרים - והמבקר מסתכל על מסך פתיחה שניות.
    //
    // עכשיו: הפריים הראשון לבדו, ורק כשהוא בפנים מתחילים את השאר -
    // לפי הסדר, בחלון צר. הסדר חשוב כי המבקר גולל מלמעלה למטה, כלומר
    // צורך את הפריימים בדיוק בסדר הזה.
    var WINDOW = 6;
    function loadFrame(idx, done) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = img.onerror = function () {
        loaded++;
        if (loaded >= COUNT) {
          stats.allFramesMs = Math.round(((window.performance && performance.now) ? performance.now() : 0) - t0);
          window.dispatchEvent(new Event('shift:dive-ready'));
        }
        if (done) done();
      };
      img.src = idx === 1 ? DIR + 'f' + pad(idx) + '.webp'
                          : seqDir + 'f' + pad(idx) + seqExt;
      frames[idx - 1] = img;
    }

    function preload() {
      var next = 2;
      function pump() {
        if (next > COUNT) return;
        var idx = next++;
        loadFrame(idx, pump);
      }
      loadFrame(1, function () {
        onFirstFrame();
        // הרצף יוצא רק אחרי בדיקת ה-AVIF - היא data-URI (מילישניות),
        // לא ממתינים לרשת. חלון צר של בקשות מקבילות: מספיק כדי לרוות
        // את החיבור, מעט מספיק כדי שהסדר יישמר בפועל
        avifProbe.then(function (ok) {
          if (ok) { seqDir = DIR.slice(0, -1) + '-avif/'; seqExt = '.avif'; stats.dir = seqDir; }
          for (var k = 0; k < WINDOW; k++) pump();
        });
      });
    }

    var gate = document.getElementById('diveGate');
    var passing = document.getElementById('divePassing');
    var arrival = document.getElementById('diveArrival');
    var veil = document.getElementById('diveVeil');
    var curtain = document.getElementById('diveCurtain');
    var lines = passing ? Array.prototype.slice.call(passing.querySelectorAll('p')) : [];

    // מצב מופחת-תנועה: פריים מייצג אחד, הכותרת מיד, בלי צלילה
    if (REDUCED || !FULL) {
      var still = new Image();
      still.onload = function () { frames[0] = still; onFirstFrame(); };
      still.src = DIR + 'f' + pad(COUNT) + '.webp'; // הפריים המואר - שם הכותרת חיה
      window.addEventListener('resize', fit, { passive: true });
      return stats;
    }

    var target = 0, eased = 0, hushOn = false, litOn = false, onScreen = true;
    // ‏T18 (רעיון OC ‏3.8): הגלילה חושפת, לא הזמן. תחנות-p עם נעילה
    // חד-כיוונית - מה שנחשף לא מוסתר בגלילה למעלה.
    var liveOn = false, scrubOn = false;
    var STATIONS = [0.62, 0.70, 0.80, 0.88];
    var latched = [false, false, false, false];
    var skipTick = null, lastP = -1, diveTracked = false;

    function render() {
      eased += (target - eased) * 0.14;
      if (Math.abs(target - eased) < 0.0004) eased = target;
      var p = eased;

      // ‏T18: הרצף מסתיים ב-0.60 - משם הבמה שייכת לסצנת-ההגעה
      draw(Math.round(Math.min(p / 0.60, 1) * (COUNT - 1)));

      // ── מצב הסרגל - לפני כל early-return ────────────────────────────
      // זה תלוי גם ב-onScreen, שמשתנה מבחוץ (טריגר הנראוּת) בלי שההתקדמות
      // זזה. כשהיה מתחת לשער "כתיבה רק בשינוי", מבקר שנעצר רגע באור נעל
      // את eased על 1, ואז יציאה מהסקשן לא עודכנה לעולם - סרגל בהיר מעל
      // #products הכהה. אותו באג שכבר תוקן פעם וחזר דרך אופטימיזציית
      // הכתיבות; הפעם הוא מעל הקו ולא מתחתיו.
      var aIn = Math.max(0, Math.min((p - 0.86) / 0.14, 1));
      // הסרגל שקט מהפיקסל הראשון ועד עזיבת הצלילה (OC ‏29.7 ‏14:15:
      // הרושם הראשון הוא הזמנה, לא ממשק). קודם היה כאן p>0.06 - כלומר
      // הסרגל נראה על שער הכניסה ונעלם רק משהתחלת לצלול; עכשיו החלון
      // מכסה גם את המסך הראשון, ונקודת ההופעה לא זזה: ההצהרה. מנגנון
      // אחד - אותו טריגר נראוּת שאומת ב-29.7 (מופיע כשהפיקסל האחרון
      // של הצלילה יוצא = המסך המלא הראשון של ההצהרה).
      var hush = onScreen;
      if (hush !== hushOn) { hushOn = hush; docEl.classList.toggle('dive-hush', hush); }
      var lit = onScreen && aIn > 0.5;
      if (lit !== litOn && window.__navTone) { litOn = lit; window.__navTone.set('dive', lit); }
      // ‏T18: הסצנה מתעוררת בחפיפה 0.55→0.62 - לא כמתג. ‏wake מוזרם
      // כמשתנה-CSS (הרמפה של השכבות), והקנבס מתחיל לרוץ כבר ב-0.55
      // (עדיין שקוף) כדי שהרשת תהיה בתנועה כשרואים אותה.
      var wake = Math.max(0, Math.min((p - 0.55) / 0.07, 1));
      var live = onScreen && p >= 0.55;
      if (live !== liveOn) {
        liveOn = live;
        docEl.classList.toggle('arrival-live', live);
        if (net) net.toggle(live);
      }
      // המסתיר (arrival-scrub) נוסף רק כשהמנוע מוכח-חי (render רץ) -
      // בלי מנוע אין מחלקה ואין הסתרה (חוזה A1 נשמר).
      if (!scrubOn) { scrubOn = true; docEl.classList.add('arrival-scrub'); }
      for (var si = 0; si < STATIONS.length; si++) {
        if (!latched[si] && p >= STATIONS[si]) {
          latched[si] = true;
          docEl.classList.add('ar-s' + (si + 1));
        }
      }
      if (skipTick) skipTick(p);
      // אנליטיקס-מוכנות: מי שהשלים את הצלילה עד האור - פעם אחת לביקור
      if (!diveTracked && aIn > 0.9 && window.__track) {
        diveTracked = true;
        window.__track('dive_complete');
      }

      // ── מכאן והלאה: כתיבות סגנון בלבד ───────────────────────────────
      // אלה תלויות אך ורק ב-p, ולכן בטוח לדלג עליהן כשהוא לא זז.
      if (Math.abs(p - lastP) < 0.0008) return;
      lastP = p;

      // שער הפתיחה נסוג פנימה
      var gOut = Math.min(p / 0.18, 1);
      if (gate) {
        gate.style.opacity = String(1 - gOut);
        gate.style.transform = 'scale(' + (1 + gOut * 0.35) + ') translateZ(0)';
        gate.style.pointerEvents = gOut > 0.9 ? 'none' : '';
      }

      // מילות המסע - כל אחת נדלקת סביב הנקודה שלה
      for (var i = 0; i < lines.length; i++) {
        var el = lines[i];
        var at = parseFloat(el.dataset.at);
        var vis = Math.max(0, 1 - Math.abs(p - at) / 0.1);
        el.style.opacity = String(vis);
        el.style.transform = 'translateY(' + (-50 + (p - at) * 90) + '%) scale(' + (0.96 + vis * 0.06) + ')';
      }
      // ההגעה אל האור - ‏T18: הכול רוכב על רמפת-ההתעוררות (wake),
      // לא על ‏aIn; ‏aIn ממשיך לשרת את הסרגל ואת dive_complete בלבד
      section.style.setProperty('--ar-wake', wake.toFixed(3));
      if (arrival) {
        arrival.style.opacity = String(wake);
        arrival.style.pointerEvents = p > 0.62 ? 'auto' : 'none';
      }
      if (veil) veil.style.opacity = String(1 - wake);
      // הווילון של הסיום עולה עם ההתעוררות - חלון הפתיחה חוזר (B3-א)
      if (curtain) curtain.style.opacity = String(wake);
    }

    gsap.ticker.add(render);

    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: function (self) { target = self.progress; },
      onRefresh: function (self) { target = eased = self.progress; render(); }
      // ברגע שההצהרה מכסה את הצלילה, היא כבר לא מה שיושב מאחורי הסרגל -
      // בלי זה מצב ה"בהיר" של ההגעה נדבק והופך גם סקשנים כהים לבהירים

    });

    // כפתור דילוג נראה - מופיע אחרי 2.5 שניות של שהות בצלילה, ונעלם
    // ברגע שמתחילים להתקדם באמת או כשמגיעים לאור. המקלדת מקבלת את
    // .skip-dive שקופץ בפוקוס; זה כאן בשביל עכבר ומגע.
    (function initDiveSkip() {
      var btn = document.getElementById('diveSkip');
      if (!btn || REDUCED) return;
      btn.hidden = false;
      var shown = false;
      var timer = setTimeout(function () {
        if (eased > 0.25) return;      // כבר צולל - לא מפריעים
        shown = true;
        btn.classList.add('show');
      }, 2500);
      btn.addEventListener('click', function () {
        clearTimeout(timer);
        btn.classList.add('gone');
        if (window.__track) window.__track('dive_skip');
        var target = document.getElementById('products');
        if (!target) return;
        if (lenis) lenis.scrollTo(target, { offset: NAV_OFFSET, duration: 1.4 });
        else target.scrollIntoView({ behavior: 'smooth' });
      });
      skipTick = function (p) {
        if (!shown) return;
        // אחרי שההגעה מתחילה, או אחרי שיצאנו מהסקשן - אין מה לדלג עליו
        btn.classList.toggle('gone', p > 0.8);
      };
    })();

    // האם הצלילה על המסך בכלל - נמדד ב-IntersectionObserver ולא ב-ScrollTrigger.
    //
    // טריגר ההתקדמות מסתיים ב-'bottom bottom', ושם ההגעה אל האור עדיין
    // מלאה על המסך, אז ה-isActive שלו לא מתאים. אבל גם טריגר נראוּת נפרד
    // לא הספיק: בקפיצת עוגן (לחיצה על "מה אנחנו עושים", או טעינה עם #hash)
    // הגלילה מדלגת על כל הטווח בבת אחת וה-onToggle לא נורה - כלומר
    // הצלילה נשארה מסומנת "על המסך" ומצב האור נדבק על סקשן כהה.
    // IO לא תלוי במעבר דרך טווח: הוא מדווח מצב, לא אירוע חצייה.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        render();
      }, { threshold: 0 }).observe(section);
    } else {
      ScrollTrigger.create({
        trigger: section, start: 'top top', end: 'bottom top',
        onToggle: function (self) { onScreen = self.isActive; render(); }
      });
    }

    // ── 🧬 הרשת שנפתחה (OC ‏3.8, מאב-הטיפוס; חיה=25 → ‏26 נקודות,
    // קשרים עד ‏138px). דסקטופ בלבד; רצה רק כשהצלילה על המסך (דרך
    // ‏toggle מ-render) והטאב גלוי. ‏PRNG זרוע - פריסה זהה בכל טעינה,
    // ו-VR מקפיא פריים ‏t=0 דטרמיניסטי דרך ‏window.__netFreeze.
    var net = null;
    if (!matchMedia('(max-width: 899px)').matches) net = (function () {
      var cv = document.getElementById('arrivalField');
      if (!cv) return null;
      var ctx2 = cv.getContext('2d');
      var stage2 = cv.parentElement;
      var ALIVE = 0.50;                       // ‏T19 (OC ‏3.8): "שכבה חיה ב-50" - 50 על הכל עד הכרעת linkLock
      var COUNT2 = Math.round(14 + ALIVE * 46);  // = 26
      var LINK = 128 + ALIVE * 40;               // = 138
      var SEED = 20260803;
      var W2 = 0, H2 = 0, nodes = [], raf2 = null, on = false, frozen = false;
      // ‏mulberry32 - מחולל זרוע קטן; אותו זרע = אותה רשת התחלתית
      var rng;
      function reseedRng() {
        var s = SEED;
        rng = function () {
          s |= 0; s = (s + 0x6D2B79F5) | 0;
          var t = Math.imul(s ^ (s >>> 15), 1 | s);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }
      reseedRng();
      function seedNodes() {
        nodes = [];
        for (var i = 0; i < COUNT2; i++) {
          // צפוף סביב המרכז (pow 1.7) - משם מתפזרים החוצה
          var a = rng() * Math.PI * 2;
          var r = Math.pow(rng(), 1.7) * Math.min(W2, H2) * 0.42;
          nodes.push({
            x: W2 / 2 + Math.cos(a) * r,
            y: H2 / 2 + Math.sin(a) * r * 0.8,
            vx: Math.cos(a) * (0.06 + rng() * 0.10),
            vy: Math.sin(a) * (0.05 + rng() * 0.08),
            r: 0.7 + rng() * 1.6,
            ph: rng() * Math.PI * 2
          });
        }
      }
      function fit2() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        W2 = stage2.offsetWidth; H2 = stage2.offsetHeight;
        cv.width = W2 * dpr; cv.height = H2 * dpr;
        cv.style.width = W2 + 'px'; cv.style.height = H2 + 'px';
        ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
        reseedRng(); seedNodes();
      }
      function advance() {
        for (var i = 0; i < nodes.length; i++) {
          var n = nodes[i];
          n.x += n.vx; n.y += n.vy;
          // יצא מהמסגרת - נולד מחדש קרוב למרכז; הרשת חיה תמיד
          if (n.x < -60 || n.x > W2 + 60 || n.y < -60 || n.y > H2 + 60) {
            var a = rng() * Math.PI * 2, r = rng() * Math.min(W2, H2) * 0.12;
            n.x = W2 / 2 + Math.cos(a) * r; n.y = H2 / 2 + Math.sin(a) * r * 0.8;
            n.vx = Math.cos(a) * (0.06 + rng() * 0.10);
            n.vy = Math.sin(a) * (0.05 + rng() * 0.08);
          }
        }
      }
      function drawFrame(t) {
        ctx2.clearRect(0, 0, W2, H2);
        ctx2.lineWidth = 1;
        for (var i = 0; i < nodes.length; i++) {
          for (var j = i + 1; j < nodes.length; j++) {
            var dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
            var d2 = dx * dx + dy * dy;
            if (d2 < LINK * LINK) {
              var o = (1 - Math.sqrt(d2) / LINK) * 0.16 * ALIVE;
              ctx2.strokeStyle = 'rgba(168, 222, 255, ' + o.toFixed(3) + ')';
              ctx2.beginPath(); ctx2.moveTo(nodes[i].x, nodes[i].y);
              ctx2.lineTo(nodes[j].x, nodes[j].y); ctx2.stroke();
            }
          }
        }
        for (var k = 0; k < nodes.length; k++) {
          var n2 = nodes[k];
          var tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t / 1400 + n2.ph));
          ctx2.fillStyle = 'rgba(200, 236, 255, ' + (tw * 0.7 * ALIVE).toFixed(3) + ')';
          ctx2.beginPath(); ctx2.arc(n2.x, n2.y, n2.r, 0, 6.2832); ctx2.fill();
        }
      }
      function tick2(t) {
        raf2 = null;
        if (window.__netFreeze) {
          // ‏VR: פריים קבוע - זריעה מחדש וציור ב-t=0, בלי המשך לולאה
          if (!frozen) { frozen = true; reseedRng(); seedNodes(); drawFrame(0); }
          return;
        }
        advance();
        drawFrame(t);
        if (on && !document.hidden) raf2 = requestAnimationFrame(tick2);
      }
      function start() {
        if (!raf2 && !W2) fit2();
        if (!raf2) raf2 = requestAnimationFrame(tick2);
      }
      function stop() { if (raf2) { cancelAnimationFrame(raf2); raf2 = null; } }
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop();
        else if (on) start();
      });
      window.addEventListener('resize', function () { if (W2) fit2(); }, { passive: true });
      return {
        toggle: function (v) { on = v; if (v) start(); else stop(); }
      };
    })();

    // חשוף לבדיקות אוטומטיות, כמו window.__lenis - בסביבת בדיקה ה-rAF
    // קפוא ולכן צריך דרך להריץ את הפריים ידנית ולקרוא את המצב.
    stats.render = render;
    stats.state = function () { return { target: target, eased: eased, frame: current }; };

    preload();
    fit();
    window.addEventListener('resize', fit, { passive: true });
    return stats;
  })();

  /* מסך הפתיחה - מי סוגר אותו, ולמה לא כאן.
     היה כאן טקס של GSAP: הלוגו נכנס, ואז וילון עולה. מדידה ב-27.7 בשלוש
     מהירויות רשת הראתה שהוא **לא הוצג מעולם** - ה-onload של תמונת הגיבוי
     ב-HTML תמיד הקדים את חבילת התנועה (175KB), הוסיף `preloader-done`,
     וה-CSS העלים את המסך. הטקס רץ על אלמנט מוסתר.
     גרוע מזה: הנעילה `overflow:hidden` שישבה כאן הוחלה **אחרי** שהמסך כבר
     נסגר - כלומר עמוד גלוי לגמרי שהגלילה בו מתה ל-800ms בלי שום סימן.
     ב-Slow 4G זה נחת ב-7.3ש', אחרי שהמבקר כבר חיכה שבע שניות.
     לכן: היציאה עברה ל-CSS (רצה גם בלי חבילת התנועה), ואין כאן נעילת
     גלילה בכלל. הקוד הזה רק מנקה אחרי שהיציאה נגמרה. */
  if (!preloader || !FULL) {
    finishReveal();
  } else {
    var still = document.getElementById('brainStill');
    var closing = false;
    var closeNow = function () {
      if (closing) return;
      closing = true;
      dismissPreloader();
      setTimeout(finishReveal, 620);   // אורך אנימציית היציאה ב-CSS
    };
    if (docEl.classList.contains('preloader-done') || (still && still.complete)) closeNow();
    else if (still) {
      still.addEventListener('load', closeNow, { once: true });
      still.addEventListener('error', closeNow, { once: true });
    }
    setTimeout(closeNow, 2200);        // רשת ביטחון אם התמונה לא מגיעה
  }
  setTimeout(finishReveal, 3000);

  /* ---------- המעבר מהישרדות ליצירה, כמערכת לאורך העמוד ----------
     הפלטה והטיפוגרפיה נעולות, ולכן ההבחנה בין שני המצבים נישאת ע"י הקצב
     והמרחב בלבד. שלושה פרמטרים נעים יחד לאורך הגלילה, מ-0 (הישרדות)
     ל-1 (יצירה) - לא כאפקטים מקומיים אלא כמערכת אחת:

       רוחב העמודה   צר ודחוס  →  נפתח
       מרווח אנכי    מכווץ     →  נדיב
       משך הכניסות   0.6ש'     →  1.2ש'

     ה-JS רק מסמן לכל סקשן את מיקומו בסולם (--j). כל השאר CSS, כך שגם
     בלי מנוע התנועה (ובמצב מופחת-תנועה) המרחב והקצב עדיין מספרים את הסיפור. */
  (function initJourney() {
    // הסדר נגזר מה-DOM, לא מרשימה קשיחה: סקשן חדש שנוסף ל-HTML מקבל
    // את מקומו בסולם אוטומטית. קודם הייתה כאן רשימת סלקטורים, ומי
    // שהוסיף סקשן בלי לעדכן אותה קיבל מרווח ורוחב שבורים - בשקט.
    //
    // הכלל: כל <section> ישיר של body, פלוס הסקשנים שבתוך במת הכיסוי
    // וסצנת הסיום (שם ה-<section> עטוף ב-div). הצלילה עצמה לא נכללת -
    // היא לא נושאת תוכן זורם.
    // ‏B9: הסקשנים עטופים כעת ב-<main> (ציון-דרך לנגישות) - הגזירה
    // עודכנה יחד עם העטיפה; ‏body > section נשאר לרשת-ביטחון אם
    // סקשן עתידי יתווסף מחוץ ל-main
    var els = Array.prototype.filter.call(
      document.querySelectorAll('main > section, body > section, .cover-stage > section, .closing'),
      function (el) { return !el.classList.contains('dive'); }
    );
    els.forEach(function (el, i) {
      el.style.setProperty('--j', (els.length < 2 ? 1 : i / (els.length - 1)).toFixed(3));
    });
    docEl.classList.add('journey-on');
    window.__journey = els.map(function (el) {
      return { id: el.id || el.className.split(' ')[0], j: +el.style.getPropertyValue('--j') };
    });
  })();

  // משך הכניסה של אלמנט לפי מיקומו במסע: 0.6ש' למעלה, 1.2ש' למטה
  function jOf(el) {
    var node = el;
    while (node && node !== document.body) {
      var v = node.style && node.style.getPropertyValue('--j');
      if (v) return parseFloat(v) || 0;
      node = node.parentElement;
    }
    return 0;
  }
  function jDur(el, min, max) {
    return (min || 0.6) + ((max || 1.2) - (min || 0.6)) * jOf(el);
  }

  if (!FULL) return; // מכאן והלאה - רק כשמנוע התנועה המלא פעיל

  /* ---------- במת הכיסוי: ההגעה נסוגה בזמן שההצהרה מחליקה מעליה ----------
     ההירו הישן (רקע, אורורה, שדה נוירונים, פרלקסת עכבר) הוסר יחד עם
     המרקאפ שלו - הצלילה אל המוח תופסת את מקומו ועושה את אותה עבודה,
     רק שהיא מונעת מהגלילה של המבקר ולא רצה מעצמה. */
  (function initCoverStage() {
    var statement = document.querySelector('.cover-stage .statement');
    // חשוב: על .arrival עצמו רץ ה-opacity של הצלילה (render). שני כותבים
    // לאותה תכונה נלחמים זה בזה - ובפועל הכותרת נעלמה לגמרי. לכן הנסיגה
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
    // ‏B11: היה gsap.to חדש בכל mousemove - מאות אובייקטי-tween בשנייה.
    // ‏quickTo ממחזר tween אחד, והכתיבה נורית רק כשמצב-הריחוף מתחלף.
    var qs = gsap.quickTo(dot, 'scale', { duration: 0.25, ease: 'power2.out' });
    var qo = gsap.quickTo(dot, 'opacity', { duration: 0.25, ease: 'power2.out' });
    var shown = false, overInteractive = null;
    document.addEventListener('mousemove', function (e) {
      if (!shown) { shown = true; gsap.to(dot, { autoAlpha: 1, duration: 0.3 }); }
      qx(e.clientX); qy(e.clientY);
      var interactive = !!e.target.closest('a, button, .btn');
      if (interactive !== overInteractive) {
        overInteractive = interactive;
        qs(interactive ? 2.6 : 1);
        qo(interactive ? 0.55 : 1);
      }
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
        yPercent: 115, duration: jDur(head, 0.75, 1.25), ease: 'power3.out',
        scrollTrigger: { trigger: head, start: 'top 80%' }
      });
    }
    // אחרי הסרת הלייבלים (שלב 2) יש סקשנים שבהם ה-head מכיל רק כותרת;
    // tween על מערך ריק מייצר אזהרת GSAP ולא עושה כלום
    var rest = Array.prototype.filter.call(head.children, function (c) { return c !== h2; });
    if (!rest.length) return;
    gsap.from(rest, {
      autoAlpha: 0, y: 26, duration: jDur(head), stagger: 0.12, clearProps: CLEAR,
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
      stagger: { each: 0.05, from: 'start' } // כמו הקראה - לפי סדר הקריאה
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

  /* השיטה: הבמה הנעוצה הוסרה עם המעבר לקרוסלה (3ג, הוראת OC ‏29.7
     ‏14:40) - הניווט בשקופיות הוא תוכן, לא קישוט, ולכן הוא חי ב-main.js
     (תא worlds-carousel) ועובד גם בלי המנוע ובמופחת-תנועה. */

  /* ---------- רשתות קלפים (סל המוצרים + הרגלים) ---------- */
  gsap.utils.toArray('.cards-3').forEach(function (grid) {
    gsap.from(grid.children, {
      autoAlpha: 0, y: 44, duration: jDur(grid), stagger: 0.13, clearProps: CLEAR,
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
      // הכותרת, הפסקה והציטוט נכנסים אחד אחרי השני לפי סדר ה-DOM, בכניסה
      // חלקה (ease). בעבר הציטוט היה בטריגר נפרד וה"קפיצה" לא הרגישה מסודרת.
      // בלוק המייסדים מקבל טריגר משלו כדי שלא ירוץ מחוץ למסך באותו רצף.
      var intro = body.querySelectorAll(':scope > .label, :scope > h2, :scope > p, :scope > blockquote');
      gsap.from(intro, {
        // D2: משך הכניסה נמתח עם המסע (--j) - הישרדות נכנסת מהר, יצירה נושמת.
        autoAlpha: 0, y: 24, duration: jDur(body, 0.7, 1.1), ease: 'power3.out',
        stagger: 0.16, clearProps: CLEAR,
        scrollTrigger: { trigger: body, start: 'top 80%' }
      });
      var founders = body.querySelector('.founders');
      if (founders) {
        gsap.from(founders.querySelectorAll('.founders-label, .founder'), {
          autoAlpha: 0, y: 30, duration: jDur(founders, 0.7, 1.1), ease: 'power3.out',
          stagger: 0.14, clearProps: CLEAR,
          scrollTrigger: { trigger: founders, start: 'top 84%' }
        });
      }
    }
  })();

  /* ---------- מה נפתח: פריט-פריט, ואז הרגע של אהבה ---------- */
  gsap.from('.chips li', {
    autoAlpha: 0, y: 22, duration: jDur(document.querySelector('.chips'), 0.5, 0.9), clearProps: CLEAR,
    stagger: { each: 0.05, from: 'start' },
    scrollTrigger: { trigger: '.chips', start: 'top 82%' }
  });
  (function initLove() {
    var love = document.querySelector('.love-card');
    if (!love) return;
    gsap.from(love, {
      autoAlpha: 0, y: 36, duration: jDur(love, 0.9, 1.3), delay: 0.35, clearProps: CLEAR,
      scrollTrigger: {
        trigger: love, start: 'top 85%',
        onEnter: function () {
          setTimeout(function () { love.classList.add('glow'); }, 900);
        }
      }
    });
  })();

  /* ---------- הגישה: שלבים נדלקים + הבמה החיה ----------
     (ענף #pathLine של הקו הישן הוסר - קוד מת מאז D12) */
  (function initPath() {
    var steps = gsap.utils.toArray('.step');
    // ‏D12: הבמה (ספרת-ענק + סיב) רוכבת על אותו סיגנל הדלקה - ‏data-step
    // על הסקשן, וה-CSS עושה את השאר. במצב שקט המנוע לא רץ → מצב-המנוחה
    // הסטטי של ה-CSS (ספרה 1 עמומה, סיב בסיסי) - בדיוק התנאי.
    var pathSec = document.querySelector('.path');
    steps.forEach(function (step, i) {
      gsap.from(step, {
        autoAlpha: 0, y: 34, duration: 0.8, clearProps: CLEAR,
        scrollTrigger: {
          trigger: step, start: 'top 82%',
          onEnter: function () {
            setTimeout(function () { step.classList.add('lit'); }, 250 + i * 120);
            if (pathSec) pathSec.dataset.step = String(i + 1);
          },
          onLeaveBack: function () {
            step.classList.remove('lit');
            if (pathSec) pathSec.dataset.step = String(i);
          }
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
    // מילת הענק SHIFT עולה מתחתית הסצנה - חתימה איזאנמית
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

    // הרקע נוסע מהישרדות (כהה) ליצירה (בהיר) לאורך הסקשן.
    // --card-bg נוסע איתו: זה הצבע האטום של הקלפים (B1) - ההרכבה של
    // הזכוכית הישנה מעל הרקע הנוכחי - כך שהם נראים זכוכית אבל לא מגלים
    // טקסט של קלף מכוסה.
    // ‏2ב (OC ‏2.8: "שבוע 2 נבלע") - האזור המת נמדד: בין ‏40% ל-55% של
    // מעבר-הרקע הרציף אף צבע טקסט לא עמד ב-AA (‏4.16/3.44 בשיא). התיקון
    // בשלושה חלקים: (א) משטח הקלפים יצא מהאנימציה הרציפה - קלף הוא
    // תמיד כהה-מוגדר או נייר-מוגדר (.lit פר-קלף, למטה), הניגודיות
    // מובטחת מבנית; (ב) רקע הסקשן ממשיך לנסוע אבל בעקומת S -
    // ‏power2.inOut שוהה בכהה, חוצה את האמצע מהר ומתייצב על נייר;
    // (ג) הטקסט בקלף מתהפך יחד עם המשטח שלו, לא עם הסקשן.
    gsap.fromTo(prog, { backgroundColor: '#121234' }, {
      backgroundColor: '#F6F5F2', ease: 'power2.inOut',
      scrollTrigger: { trigger: prog, start: 'top 30%', end: 'bottom 110%', scrub: true }
    });
    // מצב הסקשן (כותרת, אינטרו, שדרה, תווית-צד) - כמו שהיה
    ScrollTrigger.create({
      trigger: prog, start: '52% center', end: 'bottom -10%',
      onToggle: function (self) { prog.classList.toggle('lit', self.isActive); }
    });
    // מצב פר-קלף: כל קלף מתהפך כשהוא עצמו מגיע - אין רגע שבו קלף
    // יושב על משטח-ביניים אפור. זה מה שמבטל את האזור המת של שבוע 2.
    gsap.utils.toArray('.week-card').forEach(function (card) {
      ScrollTrigger.create({
        trigger: card, start: 'top 55%', end: 'bottom -10%',
        onToggle: function (self) { card.classList.toggle('lit', self.isActive); }
      });
    });

    // B1: הערימה (סטיקי + עמעום הקלף המכוסה) רצה רק כשנמדד שהקלף הגבוה
    // ביותר נכנס במסך במלואו. בלי המדידה, קלף גבוה מהחלון ננעץ בראשו
    // והימים התחתונים שלו לא מקבלים אף רגע קריא - נמדד ב-27.7: על
    // 1440×900 ימים 4–7 עומעמו לפני שהספיקו להיראות; על 1280×600 רק
    // 7 מ-21 ימים היו קריאים. עמידות לפני אפקט: לא נכנס - רשימה סטטית.
    var cards = gsap.utils.toArray('.week-card');
    var stackOn = false, dimTweens = [];
    function stackFits() {
      if (!DESKTOP.matches || !cards.length) return false;
      var navH = parseFloat(getComputedStyle(docEl).getPropertyValue('--nav-h')) || 72;
      var tallest = 0;
      for (var i = 0; i < cards.length; i++) tallest = Math.max(tallest, cards[i].offsetHeight);
      // 60 - היסט הסטיקי הגדול ביותר; 24 - נשימה מתחת לקלף
      return tallest + navH + 60 + 24 <= window.innerHeight;
    }
    function setStack(on) {
      if (on === stackOn) return;
      stackOn = on;
      docEl.classList.toggle('stack-on', on);
      if (on) {
        cards.forEach(function (card, i) {
          if (i === 0) return;
          // העמעום על *תוכן* הקלף, לא על הקלף: opacity על הקלף עצמו
          // הופך גם את הרקע האטום לשקוף, וברגע ששלושה קלפים חופפים
          // (2 מכסה את 1 בזמן ש-3 מתקרב) הטקסט של המכוסה נראה דרך
          // המכסה. נמדד ב-27.7 על 1440×1600 - קלף 2 עמד על 0.906
          // כשהוא מעל קלף 1. הרקע חייב להישאר אטום תמיד.
          var prev = cards[i - 1];
          var tl = gsap.timeline({
            scrollTrigger: { trigger: card, start: 'top 85%', end: 'top ' + (72 + 30 + i * 16) + 'px', scrub: true }
          });
          tl.to(prev, { scale: 0.96, ease: 'none' }, 0)
            .to(gsap.utils.toArray(prev.children), { autoAlpha: 0.45, ease: 'none' }, 0);
          dimTweens.push(tl);
        });
      } else {
        dimTweens.forEach(function (t) {
          if (t.scrollTrigger) t.scrollTrigger.kill();
          t.kill();
        });
        dimTweens = [];
        gsap.set(cards, { clearProps: 'transform' });
        cards.forEach(function (card) {
          gsap.set(gsap.utils.toArray(card.children), { clearProps: 'opacity,visibility' });
        });
      }
      ScrollTrigger.refresh();
    }
    setStack(stackFits());
    // גובה הקלפים משתנה כשהפונטים מגיעים וכשהחלון משתנה - מודדים שוב
    window.addEventListener('load', function () { setStack(stackFits()); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { setStack(stackFits()); });
    }
    var stackTimer;
    window.addEventListener('resize', function () {
      clearTimeout(stackTimer);
      stackTimer = setTimeout(function () { setStack(stackFits()); }, 180);
    }, { passive: true });

    // שורות הימים נחשפות בהדרגה
    gsap.utils.toArray('.day-item').forEach(function (row) {
      gsap.from(row, {
        autoAlpha: 0, y: 18, duration: jDur(row, 0.55, 0.95), clearProps: CLEAR,
        scrollTrigger: { trigger: row, start: 'top 90%' }
      });
    });

  })();

  /* ---------- אירועים: וידאו העיניים - scrub בגלילה + כניסות + פרלקסה ---------- */
  (function initEvents() {
    var section = document.querySelector('.events');
    if (!section) return;
    var video = document.getElementById('eventsVideo');
    if (video && DESKTOP.matches) {
      // ‏T15 (אושר 28.7): במקום לולאה עיוורת - הזמן של הסרטון נע עם
      // הגלילה דרך הסקשן. בלי pin, בלי לצרוך גלילה, אפס נכסים חדשים.
      // דגל הסרה: ‏data-scrub="off" על הווידאו מחזיר את הלולאה הישנה.
      // הטעינה נשארת עצלה בטריגר אחד - עמיד גם בקפיצות עוגן שמדלגות
      // על הטווח כולו (once:true נהרג בקפיצה כזו בלי לטעון כלל).
      var scrub = video.dataset.scrub !== 'off';
      var evTarget = 0, evEased = 0, evOn = false, evDur = 0;
      // ‏getter דיבוג - כמו __dive; נקרא רק ידנית/מכלי המדידה
      window.__eyes = function () {
        return { target: evTarget, eased: evEased, on: evOn, dur: evDur };
      };
      var evTick = function () {
        if (!evOn) return;
        // הקפאת-VR (‏vr.mjs מציב __videoFreeze) גוברת - דטרמיניזם הצילום
        if (!window.__videoFreeze && evDur && video.readyState >= 1) {
          // מרחק גדול (קפיצת עוגן / היפוך חד) - seek יחיד במקום שובל
          // seek-ים ביניים, שכל אחד מהם פענוח-מ-keyframe (נמדד: השובל
          // עלה ‏~1.3ש' תקיעה; ה-snap מוריד אותה)
          if (Math.abs(evTarget - evEased) > 0.5) evEased = evTarget;
          else evEased += (evTarget - evEased) * 0.12;
          if (Math.abs(evTarget - evEased) < 0.002) evEased = evTarget;
          var t = evEased * evDur;
          // סף פריים (~30fps) - בלי להציף seek-ים תת-פריימיים
          if (Math.abs(video.currentTime - t) > 0.034) video.currentTime = t;
        }
        requestAnimationFrame(evTick);
      };
      ScrollTrigger.create({
        trigger: section, start: 'top 95%', end: 'bottom top',
        onUpdate: scrub ? function (self) { evTarget = self.progress; } : undefined,
        onToggle: function (self) {
          if (self.isActive) {
            if (!video.src) {
              // ‏preload="none" בסימון - בלולאה הישנה play() משך את הקובץ;
              // ‏scrub לא מנגן, אז בלי ההעלאה ל-auto שום בייט לא יגיע
              // (נמדד: ‏readyState נשאר 0 לנצח והזמן קפוא)
              video.preload = 'auto';
              video.src = video.dataset.src;
              video.load();
              video.addEventListener('loadedmetadata', function () {
                // שוליים קטנים מהסוף - seek לקצה המוחלט מחזיר לעיתים פריים שחור
                evDur = Math.max(0, video.duration - 0.08);
              }, { once: true });
            }
            if (scrub) {
              if (!evOn) { evOn = true; evTick(); }
            } else if (!document.hidden) {
              video.play().catch(function () {});
            }
          } else if (video.src) {
            if (scrub) evOn = false;
            else video.pause();
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

  /* (פרלקסת הכדור הצף הוסרה יחד איתו - הוראת OC ‏29.7) */

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
    var LIGHT = { '#method': 1, '#story': 1, '#breathe': 1 };
    dots.forEach(function (dot) {
      var hash = dot.getAttribute('href');
      // '#top' הוא ההירו הדביק - עוקבים אחרי במת הכיסוי הסטטית במקומו
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

  /* הגופנים משוחררים רק אחרי השער (פריט 18) - כלומר אחרי שהטריגרים כבר
     חושבו על מטריקות של גופן-מערכת. ה-reflow מכווץ את העמוד (נמדד:
     ‎-982px במובייל!) והטריגרים של הסיום זזים אל מעבר לקצה הגלילה.
     ‏fonts.ready לא מתאים כאן - ברגע האתחול אין עדיין טעינות והוא
     resolved מיד; ‏loadingdone יורה אחרי כל אצוות-טעינה אמיתית.
     (נתפס ע"י הרגרסיה הוויזואלית - m-closing ריק.) */
  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', function () { ScrollTrigger.refresh(); });
  }

  /* ---------- bfcache ----------
     אין לנו unload/beforeunload (הם פוסלים את העמוד מה-cache), אז חזרה
     עם Back מחזירה עמוד חי. הרענון כאן מיישר את ScrollTrigger למיקום
     הגלילה המשוחזר - בלעדיו הצלילה עלולה לצייר פריים לא-נכון רגע אחד. */
  window.addEventListener('pageshow', function (ev) {
    if (ev.persisted) ScrollTrigger.refresh();
  });

  } catch (err) {
    // המנוע קרס באתחול - משחררים את מסך הפתיחה כדי שהאתר יישאר שמיש.
    // T11: בלי לגעת ב-overflow - אף אחד לא נועל גלילה לפני החשיפה, ואין מה לשחרר.
    try {
      document.documentElement.classList.add('preloader-done');
      var deadPl = document.getElementById('preloader');
      if (deadPl && deadPl.parentNode) deadPl.parentNode.removeChild(deadPl);
      window.dispatchEvent(new Event('shift:reveal'));
    } catch (e2) { /* אין יותר מה לעשות */ }
    if (window.console && console.error) console.error('SHIFT motion init failed:', err);
  }
})();
