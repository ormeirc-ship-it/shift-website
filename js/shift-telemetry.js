// SHIFT Telemetry — שכבת איסוף אחת לכל הצירים
// ────────────────────────────────────────────────────────────────────────
// תג <script> אחד בכל נכס (אתר, מסלול, SHIFT+, שאלונים) ומאותו רגע יש לנו
// תמונה אחידה: מי נכנס, מאיפה, לאן הלך, על מה לחץ, מה דילג, איפה נטש.
//
// שלוש החלטות שמסבירות את כל הקובץ:
//
// 1. **אפס תלויות, אפס build, REST בלבד.** בדיוק כמו שאר הפרויקט. ה-SDK של
//    Firestore נחסם ברשתות עם VPN/חומת אש (ראה CLAUDE.md) — REST עובד תמיד.
//
// 2. **כותב לתוך `analytics/` הקיים.** הכללים ב-firestore.rules מונים קולקציות
//    במפורש; קולקציה חדשה הייתה נחסמת עד פריסת כללים, וה-CLI לא מאומת כרגע.
//    לכן: `analytics/{visitorId}` כמסמך אינדקס, והאירועים ב-subcollection
//    `events` שלו — נתיב שכבר מורשה לכתיבה. אפס שינוי בכללים, עובד מיד.
//
// 3. **אצווה, לא אירוע-לכתיבה.** מסמך אחד נושא עד 25 אירועים. בלי זה מעקב
//    קליקים היה שורף את מכסת הכתיבות היומית של Firestore תוך שעה.
//
// פרטיות: אף פעם לא נאסף ערך של שדה קלט, תוכן של textarea, או טקסט שהמשתמש
// כתב. נאספות תוויות של פקדים (טקסט כפתור, aria-label) ומזהי אלמנטים בלבד.
// כל אלמנט בתוך `[data-tel-private]` מדווח כ-"private" ותו לא.

(function (global) {
  'use strict';

  var VERSION = 2;
  var PROJECT = 'shift-21-day-course-ceos';
  var BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents';

  var LS_VISITOR = 'shift_tel_vid';
  var LS_QUEUE   = 'shift_tel_q';
  var LS_OFF     = 'shift_tel_off';
  var SS_SESSION = 'shift_tel_sid';
  var SS_SEEN    = 'shift_tel_seen';

  var BATCH_MAX = 25;
  var FLUSH_MS = 15000;
  var SESSION_GAP_MS = 30 * 60 * 1000;
  var LABEL_MAX = 70;
  var QUEUE_MAX = 300;          // תקרה לתור המקומי — לא מצטבר לנצח באוף-ליין

  // ── עזרים קטנים ──────────────────────────────────────────────────────

  function uid(prefix) {
    var r = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    return (prefix || '') + Date.now().toString(36) + r;
  }
  function now() { return Date.now(); }
  function iso() { return new Date().toISOString(); }
  function clamp(s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n) + '…' : s;
  }
  function safeLS(fn, fallback) {
    try { return fn(); } catch (e) { return fallback; }
  }

  // ── קידוד ל-Firestore REST ───────────────────────────────────────────

  function enc(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') {
      if (!isFinite(v)) return { nullValue: null };
      return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    }
    if (typeof v === 'string') return { stringValue: clamp(v, 500) };
    if (Array.isArray(v)) return { arrayValue: { values: v.slice(0, 60).map(enc) } };
    if (typeof v === 'object') {
      var f = {};
      for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) f[k] = enc(v[k]);
      return { mapValue: { fields: f } };
    }
    return { stringValue: String(v) };
  }
  function encDoc(obj) {
    var f = {};
    for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) f[k] = enc(obj[k]);
    return { fields: f };
  }

  // ── זהות ─────────────────────────────────────────────────────────────

  function getVisitor() {
    var v = safeLS(function () { return localStorage.getItem(LS_VISITOR); }, null);
    if (!v) {
      v = uid('v_');
      safeLS(function () { localStorage.setItem(LS_VISITOR, v); });
    }
    return v;
  }

  // מזהה סשן חי בין טאבים של אותו ביקור, ונחתך אחרי 30 דקות שקט.
  function getSession() {
    var raw = safeLS(function () { return sessionStorage.getItem(SS_SESSION); }, null);
    var s = null;
    if (raw) { try { s = JSON.parse(raw); } catch (e) { s = null; } }
    if (!s || (now() - s.last) > SESSION_GAP_MS) {
      s = { id: uid('s_'), start: now(), last: now(), isNew: true };
    } else {
      s.isNew = false;
      s.last = now();
    }
    safeLS(function () { sessionStorage.setItem(SS_SESSION, JSON.stringify(s)); });
    return s;
  }
  function touchSession(s) {
    s.last = now();
    safeLS(function () { sessionStorage.setItem(SS_SESSION, JSON.stringify(s)); });
  }

  // ── הקשר הביקור ──────────────────────────────────────────────────────

  function utm() {
    var out = {};
    try {
      var q = new URLSearchParams(location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'fbclid', 'gclid']
        .forEach(function (k) { var v = q.get(k); if (v) out[k] = clamp(v, 80); });
    } catch (e) { /* דפדפן ישן */ }
    return out;
  }

  function deviceInfo() {
    var d = {};
    try {
      d.w = window.innerWidth; d.h = window.innerHeight;
      d.dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100;
      d.lang = (navigator.language || '').slice(0, 8);
      d.tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').slice(0, 40);
      d.mobile = d.w < 768;
      d.pwa = !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || !!navigator.standalone;
      d.touch = (navigator.maxTouchPoints || 0) > 0;
      var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (c && c.effectiveType) d.net = c.effectiveType;
      d.ua = clamp(navigator.userAgent, 160);
    } catch (e) { /* ignore */ }
    return d;
  }

  // ── תווית יציבה לאלמנט ───────────────────────────────────────────────
  // זו הפונקציה שקובעת אם דוח "על מה לחצו" יהיה קריא או אשפה. סדר העדיפות:
  // תווית מפורשת שהמפתח שם → מזהה → תפקיד נגישות → טקסט הפקד → מבנה.

  function labelOf(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.closest && el.closest('[data-tel-private]')) return 'private';

    var explicit = el.closest && el.closest('[data-tel]');
    if (explicit) return clamp(explicit.getAttribute('data-tel'), LABEL_MAX);

    var actionable = el.closest && el.closest('button,a,[role="button"],input,select,label,summary,[data-act],[data-tab],[data-view]');
    var t = actionable || el;

    var byAria = t.getAttribute && (t.getAttribute('aria-label') || t.getAttribute('title'));
    if (byAria) return clamp(byAria, LABEL_MAX);

    var byData = t.getAttribute && (t.getAttribute('data-act') || t.getAttribute('data-tab') || t.getAttribute('data-view'));
    if (byData) return clamp(byData, LABEL_MAX);

    if (t.id) return clamp('#' + t.id, LABEL_MAX);

    // טקסט הפקד — אבל לא של מכולה ענקית: רק אם הוא קצר וממוקד
    var txt = (t.innerText || t.textContent || '').trim();
    if (txt && txt.length <= 60) return clamp(txt, LABEL_MAX);

    var tag = (t.tagName || '').toLowerCase();
    var cls = (typeof t.className === 'string' ? t.className : '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    return clamp(tag + (cls ? '.' + cls : ''), LABEL_MAX);
  }

  // נתיב DOM קצר — מאפשר לאחד "אותו כפתור" בין רינדורים גם כשהטקסט משתנה.
  function pathOf(el) {
    var parts = [], node = el, depth = 0;
    while (node && node.nodeType === 1 && depth < 4) {
      var tag = node.tagName.toLowerCase();
      if (node.id) { parts.unshift('#' + node.id); break; }
      var cls = (typeof node.className === 'string' ? node.className : '').split(/\s+/).filter(Boolean)[0];
      parts.unshift(tag + (cls ? '.' + cls : ''));
      node = node.parentElement; depth++;
    }
    return clamp(parts.join('>'), 120);
  }

  function kindOf(el) {
    var t = el.closest && el.closest('button,a,input,select,textarea,[role="button"]');
    if (!t) return 'other';
    var tag = t.tagName.toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'input') return 'input:' + (t.type || 'text');
    if (tag === 'select') return 'select';
    if (tag === 'textarea') return 'textarea';
    return 'button';
  }

  // ── הליבה ────────────────────────────────────────────────────────────

  function Telemetry() {
    this.ready = false;
    this.property = 'unknown';
    this.queue = [];
    this.visitor = null;
    this.session = null;
    this.userKey = null;
    this.view = null;
    this.viewStart = 0;
    this.viewSeq = 0;
    this.scrollMarks = {};
    this.clickMemo = { label: null, t: 0, n: 0 };
    this.flushTimer = null;
    this.disabled = false;
    this.sentCount = 0;
    this.failCount = 0;
  }

  Telemetry.prototype.init = function (opts) {
    opts = opts || {};
    if (this.ready) return this;

    // מתג כיבוי מקומי + כיבוד Do Not Track באתר הציבורי בלבד. במוצרים
    // שמאחורי התחברות המדידה היא חלק מהשירות, ושם DNT לא מכבה.
    var off = safeLS(function () { return localStorage.getItem(LS_OFF); }, null);
    var dnt = (navigator.doNotTrack === '1' || window.doNotTrack === '1');
    this.property = opts.property || 'unknown';
    if (off || (dnt && opts.honorDNT !== false && this.property === 'site')) {
      this.disabled = true;
      return this;
    }

    this.visitor = getVisitor();
    this.session = getSession();
    this.ready = true;

    if (opts.userKey) this.userKey = String(opts.userKey);

    var ctx = { property: this.property, ref: clamp(document.referrer || '', 200), path: clamp(location.pathname + location.search, 200) };
    var u = utm();
    for (var k in u) ctx[k] = u[k];

    if (this.session.isNew) {
      this.push('session_start', Object.assign(ctx, deviceInfo()));
      this.writeIndex();
    } else {
      this.push('session_resume', ctx);
    }

    this.bind();
    this.startTimer();

    // ניסיון לשחרר תור שנתקע מביקור קודם (אוף-ליין / סגירת טאב)
    this.drainStored();

    if (opts.autoView !== false) this.setView(opts.view || document.title || location.pathname);
    return this;
  };

  Telemetry.prototype.push = function (name, props) {
    if (!this.ready || this.disabled) return;
    var e = {
      n: name,
      t: iso(),
      s: this.session.id,
      v: this.view || null,
      seq: ++this.viewSeq,
    };
    if (props) {
      for (var k in props) {
        if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
        var val = props[k];
        if (val === undefined || val === null || val === '') continue;
        e[k] = val;
      }
    }
    this.queue.push(e);
    touchSession(this.session);
    if (this.queue.length >= BATCH_MAX) this.flush();
  };

  // ── תצוגות ───────────────────────────────────────────────────────────

  Telemetry.prototype.setView = function (name, props) {
    if (!this.ready || this.disabled) return;
    name = clamp(name || 'unknown', 80);
    if (name === this.view) return;

    if (this.view) {
      this.push('view_leave', Object.assign({ dwell_ms: now() - this.viewStart }, this.deepestScroll()));
    }
    this.view = name;
    this.viewStart = now();
    this.scrollMarks = {};

    // "נראה בפעם הראשונה" — מבדיל בין גילוי לבין חזרה, וזה ההבדל בין
    // "המסך לא מובן" לבין "המסך שימושי וחוזרים אליו".
    var seen = safeLS(function () { return JSON.parse(sessionStorage.getItem(SS_SEEN) || '{}'); }, {}) || {};
    var first = !seen[name];
    if (first) { seen[name] = 1; safeLS(function () { sessionStorage.setItem(SS_SEEN, JSON.stringify(seen)); }); }

    this.push('view', Object.assign({ first: first, path: clamp(location.pathname, 120) }, props || {}));
  };

  Telemetry.prototype.deepestScroll = function () {
    var marks = Object.keys(this.scrollMarks).map(Number);
    return marks.length ? { scroll_max: Math.max.apply(null, marks) } : {};
  };

  // ── API מפורש ────────────────────────────────────────────────────────

  Telemetry.prototype.event = function (name, props) { this.push(clamp(name, 60), props); };

  Telemetry.prototype.identify = function (userKey, traits) {
    if (!this.ready || this.disabled || !userKey) return;
    this.userKey = String(userKey);
    this.push('identify', traits || {});
    this.writeIndex();
  };

  // דילוג הוא האירוע החשוב שאף אחד לא מודד. פונקציה ייעודית כדי שיהיה קל
  // לזכור לקרוא לה, ושכל הדילוגים יגיעו תחת שם אחד וניתן לספירה.
  Telemetry.prototype.skip = function (what, props) {
    this.push('skip', Object.assign({ what: clamp(what, 80) }, props || {}));
  };

  Telemetry.prototype.off = function () {
    safeLS(function () { localStorage.setItem(LS_OFF, '1'); });
    this.disabled = true;
    this.queue = [];
  };
  Telemetry.prototype.on = function () {
    safeLS(function () { localStorage.removeItem(LS_OFF); });
    this.disabled = false;
  };

  // ── האזנות אוטומטיות ─────────────────────────────────────────────────

  Telemetry.prototype.bind = function () {
    var self = this;

    document.addEventListener('click', function (ev) {
      var el = ev.target;
      if (!el || el.nodeType !== 1) return;
      var label = labelOf(el);
      if (!label) return;

      var props = {
        label: label,
        kind: kindOf(el),
        path: pathOf(el),
      };
      // מיקום יחסי — מאפשר מפת חום בלי לשמור קואורדינטות מוחלטות של המסך
      try {
        props.x = Math.round((ev.clientX / window.innerWidth) * 100);
        props.y = Math.round((ev.clientY / window.innerHeight) * 100);
      } catch (e) { /* ignore */ }

      var link = el.closest && el.closest('a[href]');
      if (link) {
        var href = link.getAttribute('href') || '';
        props.href = clamp(href, 160);
        props.external = /^https?:\/\//.test(href) && href.indexOf(location.host) === -1;
      }

      // לחיצות זעם: אותו פקד שלוש פעמים בשנייה. סימן מובהק לתקלה או לבלבול.
      var m = self.clickMemo;
      if (m.label === label && (now() - m.t) < 1000) {
        m.n++;
        if (m.n === 3) self.push('rage_click', props);
      } else {
        m.label = label; m.n = 1;
      }
      m.t = now();

      self.push('click', props);

      // לחיצה מתה: פקד שנלחץ ולא קרה כלום — לא ניווט, לא שינוי ב-DOM.
      self.watchDead(el, props);
    }, true);

    // גלילה — נמדדת בסף ולא ברצף, אחרת התור מתפוצץ
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      setTimeout(function () {
        ticking = false;
        var doc = document.documentElement;
        var max = Math.max(doc.scrollHeight - window.innerHeight, 1);
        var pctScrolled = Math.min(100, Math.round((window.scrollY / max) * 100));
        [25, 50, 75, 100].forEach(function (mark) {
          if (pctScrolled >= mark && !self.scrollMarks[mark]) {
            self.scrollMarks[mark] = 1;
            self.push('scroll', { depth: mark });
          }
        });
      }, 400);
    }, { passive: true });

    // טפסים — שמות שדות בלבד, לעולם לא ערכים
    document.addEventListener('focusin', function (ev) {
      var el = ev.target;
      if (!el || !/^(input|textarea|select)$/i.test(el.tagName)) return;
      if (el.closest && el.closest('[data-tel-private]')) return;
      self.push('field_focus', { field: clamp(el.name || el.id || el.type || 'field', 60) });
    }, true);

    document.addEventListener('submit', function (ev) {
      var f = ev.target;
      self.push('form_submit', { form: clamp((f && (f.name || f.id)) || 'form', 60) });
    }, true);

    // שגיאות — הדרך היחידה לדעת שמשתמש נתקל בקיר
    window.addEventListener('error', function (ev) {
      self.push('js_error', {
        msg: clamp(ev.message || 'error', 180),
        src: clamp((ev.filename || '').split('/').pop() + ':' + (ev.lineno || 0), 80),
      });
    });
    window.addEventListener('unhandledrejection', function (ev) {
      var r = ev.reason;
      self.push('js_error', { msg: clamp((r && (r.message || r)) || 'rejection', 180), src: 'promise' });
    });

    // מעברי נראות + יציאה
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        self.push('hide', { dwell_ms: now() - self.viewStart });
        self.flush(true);
      } else {
        self.push('show', {});
      }
    });

    window.addEventListener('pagehide', function () {
      self.push('exit', Object.assign({
        session_ms: now() - self.session.start,
        dwell_ms: now() - self.viewStart,
      }, self.deepestScroll()));
      self.writeIndex(true);
      self.flush(true);
    });

    // ביצועים — פעם אחת, כשהמידע כבר קיים
    if (window.performance && performance.getEntriesByType) {
      setTimeout(function () {
        try {
          var nav = performance.getEntriesByType('navigation')[0];
          if (!nav) return;
          var paint = performance.getEntriesByType('paint')
            .filter(function (p) { return p.name === 'first-contentful-paint'; })[0];
          self.push('perf', {
            ttfb: Math.round(nav.responseStart),
            load: Math.round(nav.loadEventEnd || nav.duration),
            fcp: paint ? Math.round(paint.startTime) : null,
            type: nav.type,
          });
        } catch (e) { /* ignore */ }
      }, 2500);
    }
  };

  // לחיצה מתה: אם אחרי 700ms לא היה ניווט ולא השתנה כלום ב-DOM — הפקד לא עשה כלום.
  //
  // ⚠️ שדות טופס מוחרגים לחלוטין. לחיצה על תיבת טקסט רק ממקדת אותה: אין ניווט
  // ואין שינוי ב-DOM, ולכן היא נראית בדיוק כמו לחיצה מתה. זה נתפס בפועל —
  // הלוח דיווח על "#intention-text נלחץ ולא עושה כלום" ב-SHIFT+, כשכל מה
  // שקרה הוא שמישהו לחץ על תיבת הכתיבה כדי להתחיל להקליד. ממצא שקרי אחד כזה
  // מספיק כדי שיפסיקו להאמין לכל הדוח.
  var DEAD_CLICK_IGNORE = /^(input:|textarea|select)/;

  Telemetry.prototype.watchDead = function (el, props) {
    var self = this;
    if (!window.MutationObserver) return;
    if (DEAD_CLICK_IGNORE.test(props.kind || '')) return;
    if (el && el.closest && el.closest('input,textarea,select,label,[contenteditable]')) return;
    var url = location.href;
    var changed = false;
    var obs = new MutationObserver(function () { changed = true; });
    try { obs.observe(document.body, { childList: true, subtree: true, attributes: true }); }
    catch (e) { return; }
    setTimeout(function () {
      obs.disconnect();
      if (!changed && location.href === url) {
        self.push('dead_click', { label: props.label, path: props.path });
      }
    }, 700);
  };

  // ── שידור ────────────────────────────────────────────────────────────

  Telemetry.prototype.startTimer = function () {
    var self = this;
    if (this.flushTimer) return;
    this.flushTimer = setInterval(function () { self.flush(); }, FLUSH_MS);
  };

  Telemetry.prototype.flush = function (useBeacon) {
    if (!this.ready || this.disabled || !this.queue.length) return;
    var batch = this.queue.splice(0, BATCH_MAX);
    var body = JSON.stringify(encDoc({
      v: VERSION,
      kind: 'batch',
      property: this.property,
      session: this.session.id,
      visitor: this.visitor,
      user: this.userKey || null,
      at: iso(),
      count: batch.length,
      events: batch,
    }));
    var url = BASE + '/analytics/' + encodeURIComponent(this.visitor) + '/events';
    var self = this;

    if (useBeacon && navigator.sendBeacon) {
      var ok = false;
      try { ok = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' })); }
      catch (e) { ok = false; }
      if (ok) { this.sentCount += batch.length; return; }
    }

    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        self.sentCount += batch.length;
      })
      .catch(function () {
        self.failCount++;
        self.store(batch);   // לא מאבדים אירועים בגלל רשת
      });
  };

  Telemetry.prototype.store = function (batch) {
    safeLS(function () {
      var cur = [];
      try { cur = JSON.parse(localStorage.getItem(LS_QUEUE) || '[]'); } catch (e) { cur = []; }
      cur = cur.concat(batch).slice(-QUEUE_MAX);
      localStorage.setItem(LS_QUEUE, JSON.stringify(cur));
    });
  };

  Telemetry.prototype.drainStored = function () {
    var stored = safeLS(function () {
      var s = localStorage.getItem(LS_QUEUE);
      if (s) localStorage.removeItem(LS_QUEUE);
      return s ? JSON.parse(s) : [];
    }, []);
    if (stored && stored.length) {
      this.queue = stored.concat(this.queue);
      this.flush();
    }
  };

  // מסמך האינדקס: מה שמאפשר לחדר המצב לגלות מבקרים אנונימיים בכלל.
  // Firestore לא יודע לרשום תת-קולקציות בלי מסמך אב, ולכן בלי זה כל
  // התנועה האנונימית הייתה נכתבת ונשארת בלתי נראית.
  Telemetry.prototype.writeIndex = function (useBeacon) {
    if (!this.ready || this.disabled) return;
    var url = BASE + '/analytics/' + encodeURIComponent(this.visitor) +
      '?updateMask.fieldPaths=v&updateMask.fieldPaths=property&updateMask.fieldPaths=lastSeen' +
      '&updateMask.fieldPaths=user&updateMask.fieldPaths=lastView&updateMask.fieldPaths=lastSession';
    var body = JSON.stringify(encDoc({
      v: VERSION,
      property: this.property,
      lastSeen: iso(),
      user: this.userKey || null,
      lastView: this.view || null,
      lastSession: this.session.id,
    }));
    if (useBeacon && navigator.sendBeacon) {
      // sendBeacon שולח POST בלבד; PATCH דורש fetch עם keepalive
      try { fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }); }
      catch (e) { /* ignore */ }
      return;
    }
    fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: body })
      .catch(function () { /* אינדקס הוא נוחות, לא נתון — כישלון לא מפיל כלום */ });
  };

  Telemetry.prototype.status = function () {
    return {
      ready: this.ready, disabled: this.disabled, property: this.property,
      visitor: this.visitor, session: this.session && this.session.id,
      user: this.userKey, view: this.view,
      queued: this.queue.length, sent: this.sentCount, failed: this.failCount,
    };
  };

  // ── ייצוא ────────────────────────────────────────────────────────────

  var instance = new Telemetry();

  var api = {
    init: function (o) { return instance.init(o); },
    event: function (n, p) { instance.event(n, p); },
    view: function (n, p) { instance.setView(n, p); },
    identify: function (u, t) { instance.identify(u, t); },
    skip: function (w, p) { instance.skip(w, p); },
    flush: function () { instance.flush(); },
    off: function () { instance.off(); },
    on: function () { instance.on(); },
    status: function () { return instance.status(); },
    _instance: instance,
    _internals: { labelOf: labelOf, pathOf: pathOf, kindOf: kindOf, enc: enc, encDoc: encDoc, clamp: clamp },
    VERSION: VERSION,
  };

  global.shiftTel = api;

  // אתחול אוטומטי לפי data-property על תג ה-script — כך שאתר סטטי צריך
  // שורה אחת בלבד ובלי קוד נוסף בכלל.
  try {
    var tag = document.currentScript;
    if (tag && tag.getAttribute('data-property')) {
      var boot = function () {
        api.init({
          property: tag.getAttribute('data-property'),
          view: tag.getAttribute('data-view') || undefined,
        });
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
      else boot();
    }
  } catch (e) { /* ignore */ }

  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : globalThis);
