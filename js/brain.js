/* ============================================================
   SHIFT — brain.js · המסע בגוף האדם
   מנוע חלקיקים אחד, גוף שלם: אותם 2,300 חלקיקים משנים צורה
   בין מערכות הגוף — מוח, ריאות, לב, DNA, גוף מלא, גרעין —
   ובהירו: המצלמה צוללת אל תוך המוח.
   API: window.SHIFT_BRAIN = { ready, goTo, assemble, setInteractive, setDive }
   ============================================================ */

(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DESKTOP = window.matchMedia('(min-width: 900px)');
  var MOBILE = !DESKTOP.matches;
  if (REDUCED) return;
  if (typeof THREE === 'undefined' || typeof gsap === 'undefined') return;

  var layer = document.getElementById('brainLayer');
  var labelEl = document.getElementById('brainLabel');
  var labelText = document.getElementById('brainLabelText');
  if (!layer) return;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (e) { return; } // אין WebGL — האתר ממשיך כרגיל בלעדיו

  /* ---------- פלטת מותג ---------- */
  var COL = {
    skyBase: new THREE.Color(0x3a5f8a),
    skyGlow: new THREE.Color(0x5cbbf0),
    skyBright: new THREE.Color(0x9ad6f8),
    navyBase: new THREE.Color(0x18163b),
    navyGlow: new THREE.Color(0x3a5f8a)
  };

  var N = MOBILE ? 1200 : 2300;

  /* ============================================================
     צורה 1: המוח — אנטומיה סכמטית עם אזורים אמיתיים
     ============================================================ */
  var brainPos = new Float32Array(N * 3);
  var region = new Uint8Array(N);

  var REGION_DATA = [
    { he: 'האונה המצחית', en: 'Frontal Lobe',
      role: 'חשיבה, תכנון, שפה ויוזמה — מרכז הפיקוד של פעולה מכוונת.' },
    { he: 'הקליפה הקדם-מצחית', en: 'Prefrontal Cortex',
      role: 'תפקודים ניהוליים: קבלת החלטות, ויסות עצמי, קשב ובחירה מודעת.' },
    { he: 'האונה העורפית', en: 'Occipital Lobe',
      role: 'עיבוד ראייה — כאן הופך האור שנקלט בעיניים לתמונה ולפרשנות.' },
    { he: 'המוחון', en: 'Cerebellum',
      role: 'קואורדינציה, שיווי משקל ולמידה מוטורית — וגם תרומה לוויסות קוגניטיבי.' },
    { he: 'גזע המוח', en: 'Brainstem',
      role: 'נשימה, דופק, עוררות — מערכות החיים הבסיסיות ומסלולי ההישרדות.' },
    { he: 'המערכת הלימבית', en: 'Limbic System',
      role: 'רגש, זיכרון ותגובת לחץ — האמיגדלה וההיפוקמפוס יושבים כאן.' },
    { he: 'הקליפה המוטורית', en: 'Motor Cortex',
      role: 'תכנון וביצוע תנועה רצונית — מהחלטה לפעולה בשריר.' },
    { he: 'האונה הקודקודית', en: 'Parietal Lobe',
      role: 'אינטגרציה של תחושה, מרחב וגוף — היכן שאתם נמצאים בעולם.' },
    { he: 'האונה הרקתית', en: 'Temporal Lobe',
      role: 'שמיעה, שפה וזיכרון — עיבוד משמעות של מה שנשמע ונחווה.' }
  ];

  function wrinkle(x, y, z) {
    return 0.055 * (Math.sin(7.1 * x + 1.3) * Math.sin(6.3 * y - 0.7) +
                    Math.sin(5.7 * z + 2.9) * Math.sin(8.3 * x * y));
  }

  (function makeBrain() {
    var i = 0, px, py, pz;
    var HEMI = Math.floor(N * 0.8);
    while (i < HEMI) {
      var side = i % 2 === 0 ? 1 : -1;
      var u = Math.random() * Math.PI * 2;
      var v = Math.acos(2 * Math.random() - 1);
      var rr = 0.86 + 0.14 * Math.pow(Math.random(), 0.35);
      px = Math.sin(v) * Math.cos(u) * 0.60 * rr;
      py = Math.cos(v) * 0.74 * rr;
      pz = Math.sin(v) * Math.sin(u) * 1.08 * rr;
      if (py < -0.42 && pz < -0.15) continue;
      var w = wrinkle(px, py, pz);
      px += px * w; py += py * w; pz += pz * w;
      px = px * 0.92 + side * 0.34;
      if (Math.abs(px) < 0.05) continue;
      var k = i * 3;
      brainPos[k] = px; brainPos[k + 1] = py; brainPos[k + 2] = pz;
      if (pz > 0.62 && py > -0.1) region[i] = 1;
      else if (pz < -0.66 && py > 0.02) region[i] = 2;
      else if (py > 0.5 && pz > -0.05 && pz < 0.4) region[i] = 6;
      else if (py > 0.42 && pz <= -0.05 && pz > -0.66) region[i] = 7;
      else if (py < 0.08 && Math.abs(px) > 0.5 && pz > -0.45 && pz < 0.5) region[i] = 8;
      else region[i] = 0;
      i++;
    }
    var CB_END = Math.floor(N * 0.93);
    while (i < CB_END) {
      var s2 = i % 2 === 0 ? 1 : -1;
      var u2 = Math.random() * Math.PI * 2;
      var v2 = Math.acos(2 * Math.random() - 1);
      var r2 = 0.85 + 0.15 * Math.pow(Math.random(), 0.4);
      px = Math.sin(v2) * Math.cos(u2) * 0.30 * r2 + s2 * 0.20;
      py = Math.cos(v2) * 0.22 * r2 - 0.58;
      pz = Math.sin(v2) * Math.sin(u2) * 0.34 * r2 - 0.72;
      var k2 = i * 3;
      brainPos[k2] = px; brainPos[k2 + 1] = py; brainPos[k2 + 2] = pz;
      region[i] = 3;
      i++;
    }
    while (i < N) {
      var k3 = i * 3;
      if (i % 2 === 0) {
        var t = Math.random();
        px = (Math.random() - 0.5) * 0.14;
        py = -0.35 - t * 0.55;
        pz = -0.25 - t * 0.22 + (Math.random() - 0.5) * 0.1;
        region[i] = 4;
      } else {
        var u3 = Math.random() * Math.PI * 2;
        var v3 = Math.acos(2 * Math.random() - 1);
        var r3 = 0.30 * Math.cbrt(Math.random());
        px = Math.sin(v3) * Math.cos(u3) * r3 * 1.1;
        py = Math.cos(v3) * r3 * 0.7 - 0.08;
        pz = Math.sin(v3) * Math.sin(u3) * r3 * 1.2 + 0.05;
        region[i] = 5;
      }
      brainPos[k3] = px; brainPos[k3 + 1] = py; brainPos[k3 + 2] = pz;
      i++;
    }
  })();

  /* ============================================================
     צורות הגוף: ריאות, לב, DNA, גוף מלא, גרעין
     כולן מנורמלות לרדיוס ~1.1 כדי שהתחנות ישמרו על קנה מידה
     ============================================================ */
  function alloc() { return new Float32Array(N * 3); }

  // עזר: נקודה על קפסולה (קו עם רדיוס) בין שתי נקודות
  function capsulePoint(out, k, ax, ay, az, bx, by, bz, r) {
    var t = Math.random();
    var ang = Math.random() * Math.PI * 2;
    var rad = r * Math.sqrt(Math.random() * 0.4 + 0.6); // הטיה לקליפה
    var cx = ax + (bx - ax) * t, cy = ay + (by - ay) * t, cz = az + (bz - az) * t;
    // מסגרת ניצבת גסה לציר
    var dx = bx - ax, dy = by - ay, dz = bz - az;
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    dx /= len; dy /= len; dz /= len;
    var ux = -dy, uy = dx, uz = 0;
    var ul = Math.sqrt(ux * ux + uy * uy) || 1; ux /= ul; uy /= ul;
    var vx2 = dy * uz - dz * uy, vy2 = dz * ux - dx * uz, vz2 = dx * uy - dy * ux;
    out[k] = cx + (ux * Math.cos(ang) + vx2 * Math.sin(ang)) * rad;
    out[k + 1] = cy + (uy * Math.cos(ang) + vy2 * Math.sin(ang)) * rad;
    out[k + 2] = cz + (uz * Math.cos(ang) + vz2 * Math.sin(ang)) * rad;
  }

  // הלב — משטח סתום של משוואת הלב הקלאסית
  var heartPos = (function () {
    var out = alloc(), i = 0, guard = 0;
    while (i < N && guard < 400000) {
      guard++;
      var x = (Math.random() * 2 - 1) * 1.5;
      var y = (Math.random() * 2 - 1) * 1.4;
      var z = (Math.random() * 2 - 1) * 1.1;
      // ציר Y למעלה: מחליפים תפקידים בנוסחה (x², 9/4·z², y²)
      var a = x * x + 2.25 * z * z + y * y - 1;
      var f = a * a * a - x * x * y * y * y - 0.1125 * z * z * y * y * y;
      if (Math.abs(f) < 0.08) {
        var k = i * 3;
        out[k] = x * 0.78;
        out[k + 1] = y * 0.82 + 0.05;
        out[k + 2] = z * 0.9;
        i++;
      }
    }
    // אם הדגימה לא התמלאה (נדיר) — ממלאים בכפילויות עם רעש
    for (; i < N; i++) {
      var src = ((i * 7919) % Math.max(1, i)) * 3;
      var k4 = i * 3;
      out[k4] = out[src] + (Math.random() - 0.5) * 0.05;
      out[k4 + 1] = out[src + 1] + (Math.random() - 0.5) * 0.05;
      out[k4 + 2] = out[src + 2] + (Math.random() - 0.5) * 0.05;
    }
    return out;
  })();

  // הריאות — שתי אונות נושמות + קנה וסמפונות
  var lungsPos = (function () {
    var out = alloc();
    var lungQ = Math.floor(N * 0.44);
    var i = 0;
    function lung(cx, count) {
      var made = 0;
      while (made < count) {
        var u = Math.random() * Math.PI * 2;
        var v = Math.acos(2 * Math.random() - 1);
        var rr = 0.86 + 0.14 * Math.pow(Math.random(), 0.4);
        var px = Math.sin(v) * Math.cos(u) * 0.36 * rr;
        var py = Math.cos(v) * 0.62 * rr;
        var pz = Math.sin(v) * Math.sin(u) * 0.30 * rr;
        // פסגה מחודדת למעלה, בסיס רחב
        px *= 1 - Math.max(0, py) * 0.45;
        pz *= 1 - Math.max(0, py) * 0.35;
        var k = i * 3;
        out[k] = px + cx; out[k + 1] = py - 0.1; out[k + 2] = pz;
        i++; made++;
      }
    }
    lung(-0.46, lungQ);
    lung(0.46, lungQ);
    while (i < N) {
      var k2 = i * 3;
      var r = Math.random();
      if (r < 0.5) { // קנה
        capsulePoint(out, k2, 0, 1.0, 0, 0, 0.42, 0, 0.055);
      } else if (r < 0.75) { // סמפון שמאל
        capsulePoint(out, k2, 0, 0.42, 0, -0.42, 0.28, 0, 0.045);
      } else { // סמפון ימין
        capsulePoint(out, k2, 0, 0.42, 0, 0.42, 0.28, 0, 0.045);
      }
      i++;
    }
    return out;
  })();

  // DNA — סליל כפול עם שלבים
  var helixPos = (function () {
    var out = alloc();
    var TURNS = 3.1, R = 0.46, H = 2.15;
    var strandQ = Math.floor(N * 0.37);
    var i = 0;
    function strand(phase, count) {
      for (var s = 0; s < count; s++, i++) {
        var t = (s / count) * TURNS * Math.PI * 2;
        var y = -H / 2 + (s / count) * H;
        var k = i * 3;
        out[k] = Math.cos(t + phase) * R + (Math.random() - 0.5) * 0.03;
        out[k + 1] = y + (Math.random() - 0.5) * 0.02;
        out[k + 2] = Math.sin(t + phase) * R + (Math.random() - 0.5) * 0.03;
      }
    }
    strand(0, strandQ);
    strand(Math.PI, strandQ);
    var rungs = 16;
    while (i < N) {
      var ri = Math.floor(Math.random() * rungs);
      var t2 = (ri / rungs) * TURNS * Math.PI * 2;
      var y2 = -H / 2 + (ri / rungs) * H;
      var m = Math.random();
      var k2 = i * 3;
      out[k2] = Math.cos(t2) * R * (1 - 2 * m) + (Math.random() - 0.5) * 0.02;
      out[k2 + 1] = y2 + (Math.random() - 0.5) * 0.02;
      out[k2 + 2] = Math.sin(t2) * R * (1 - 2 * m) + (Math.random() - 0.5) * 0.02;
      i++;
    }
    return out;
  })();

  // הגוף המלא — צללית אנושית מסוגננת
  var bodyPos = (function () {
    var out = alloc();
    var i = 0;
    var quota = [
      ['head', 0.09], ['torso', 0.30], ['pelvis', 0.09],
      ['armL', 0.10], ['armR', 0.10], ['legL', 0.16], ['legR', 0.16]
    ];
    quota.forEach(function (q) {
      var count = Math.floor(N * q[1]);
      for (var s = 0; s < count && i < N; s++, i++) {
        var k = i * 3;
        switch (q[0]) {
          case 'head': {
            var u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1);
            var rr = 0.16 * (0.85 + 0.15 * Math.random());
            out[k] = Math.sin(v) * Math.cos(u) * rr;
            out[k + 1] = 0.92 + Math.cos(v) * rr * 1.1;
            out[k + 2] = Math.sin(v) * Math.sin(u) * rr;
            break;
          }
          case 'torso': capsulePoint(out, k, 0, 0.68, 0, 0, 0.16, 0, 0.27); break;
          case 'pelvis': capsulePoint(out, k, -0.1, 0.1, 0, 0.1, 0.1, 0, 0.17); break;
          case 'armL': capsulePoint(out, k, -0.3, 0.62, 0, -0.5, 0.02, 0.05, 0.065); break;
          case 'armR': capsulePoint(out, k, 0.3, 0.62, 0, 0.5, 0.02, 0.05, 0.065); break;
          case 'legL': capsulePoint(out, k, -0.13, 0.06, 0, -0.17, -1.0, 0.02, 0.085); break;
          case 'legR': capsulePoint(out, k, 0.13, 0.06, 0, 0.17, -1.0, 0.02, 0.085); break;
        }
      }
    });
    while (i < N) { // שאריות עיגול — לפלג הגוף העליון
      capsulePoint(out, i * 3, 0, 0.6, 0, 0, 0.2, 0, 0.26);
      i++;
    }
    return out;
  })();

  // הגרעין — ספירת אנרגיה (פיבונאצ'י) עם ליבה
  var corePos = (function () {
    var out = alloc();
    var shell = Math.floor(N * 0.72);
    var GA = Math.PI * (3 - Math.sqrt(5));
    for (var s = 0; s < shell; s++) {
      var y = 1 - (s / (shell - 1)) * 2;
      var rad = Math.sqrt(1 - y * y);
      var th = GA * s;
      var k = s * 3;
      out[k] = Math.cos(th) * rad * 0.95;
      out[k + 1] = y * 0.95;
      out[k + 2] = Math.sin(th) * rad * 0.95;
    }
    for (var i2 = shell; i2 < N; i2++) {
      var u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1);
      var rr = 0.38 * Math.cbrt(Math.random());
      var k2 = i2 * 3;
      out[k2] = Math.sin(v) * Math.cos(u) * rr;
      out[k2 + 1] = Math.cos(v) * rr;
      out[k2 + 2] = Math.sin(v) * Math.sin(u) * rr;
    }
    return out;
  })();

  var SHAPES = { brain: brainPos, heart: heartPos, lungs: lungsPos, helix: helixPos, body: bodyPos, core: corePos };

  /* ---------- מאגרי מורף ---------- */
  var scatter = alloc();
  var live = alloc();
  var fromBuf = alloc();
  var targetBuf = brainPos;
  var currentShapeName = 'brain';
  var colors = new Float32Array(N * 3);

  for (var si = 0; si < N; si++) {
    var k5 = si * 3;
    var rs = 2.6 + Math.random() * 2.4;
    var us = Math.random() * Math.PI * 2;
    var vs = Math.acos(2 * Math.random() - 1);
    scatter[k5] = Math.sin(vs) * Math.cos(us) * rs;
    scatter[k5 + 1] = Math.cos(vs) * rs * 0.7;
    scatter[k5 + 2] = Math.sin(vs) * Math.sin(us) * rs;
    live[k5] = scatter[k5]; live[k5 + 1] = scatter[k5 + 1]; live[k5 + 2] = scatter[k5 + 2];
    fromBuf[k5] = brainPos[k5]; fromBuf[k5 + 1] = brainPos[k5 + 1]; fromBuf[k5 + 2] = brainPos[k5 + 2];
  }

  /* ---------- חיבורים סינפטיים (למוח בלבד) ---------- */
  var linkIdx = [];
  var MAXD2 = 0.24 * 0.24;
  var counts = new Uint8Array(N);
  for (var li = 0; li < N; li++) {
    if (counts[li] >= 2) continue;
    var bi = li * 3;
    for (var lj = li + 1; lj < N && counts[li] < 2; lj++) {
      if (counts[lj] >= 2) continue;
      var bj = lj * 3;
      var ddx = brainPos[bi] - brainPos[bj];
      var ddy = brainPos[bi + 1] - brainPos[bj + 1];
      var ddz = brainPos[bi + 2] - brainPos[bj + 2];
      var dd2 = ddx * ddx + ddy * ddy + ddz * ddz;
      if (dd2 < MAXD2 && dd2 > 0.003) {
        linkIdx.push(li, lj);
        counts[li]++; counts[lj]++;
      }
    }
  }

  /* ---------- סצנה ---------- */
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, 1, 0.08, 50);
  camera.position.set(0, 0.1, 4.2);

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(live, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  var ptsMat = new THREE.PointsMaterial({
    size: 0.028, vertexColors: true, transparent: true, opacity: 0.95,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });
  var points = new THREE.Points(geo, ptsMat);

  var lineGeo = new THREE.BufferGeometry();
  var linePos = new Float32Array(linkIdx.length * 3);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  var lineMat = new THREE.LineBasicMaterial({
    color: COL.skyBase, transparent: true, opacity: 0.22,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  var lines = new THREE.LineSegments(lineGeo, lineMat);

  var group = new THREE.Group();
  group.add(points); group.add(lines);
  scene.add(group);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  layer.appendChild(renderer.domElement);

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  /* ---------- מצב חי ---------- */
  var state = {
    assembled: 0,
    shapeMix: 1,           // 0 צורה קודמת → 1 צורת יעד
    brainness: 1,          // כמה "מוח" מוצג (קווים/אזורים)
    dive: 0,               // צלילה אל תוך המוח בהירו
    activeRegion: -1,
    regionGlow: 0,
    lightMode: 0,
    sparkle: 0,
    pulse: 0,
    open: 0,
    baseOpacity: 0.95,
    rotY: 0.35, rotX: -0.06,
    posX: 0, posY: -0.55, scale: 1.35,
    leanX: 0, leanY: 0,
    hoverRegion: -1,
    hoverGlow: 0,
    interactive: false
  };

  var tmpA = new THREE.Color(), tmpB = new THREE.Color();

  function paint(time) {
    var base = tmpA.copy(COL.skyBase).lerp(COL.navyBase, state.lightMode);
    var glow = tmpB.copy(COL.skyGlow).lerp(COL.navyGlow, state.lightMode);
    var brainF = state.brainness;
    for (var p = 0; p < N; p++) {
      var c = p * 3;
      var r = base.r, g = base.g, b = base.b;
      var depth = (live[c + 2] + 1.2) / 2.4;
      var lum = 0.75 + depth * 0.45;
      if (brainF > 0.05 && state.regionGlow > 0.01 && region[p] === state.activeRegion) {
        var gl = state.regionGlow * brainF;
        r += (COL.skyBright.r - r) * gl;
        g += (COL.skyBright.g - g) * gl;
        b += (COL.skyBright.b - b) * gl;
        lum += gl * 0.9;
      }
      if (state.sparkle > 0.01) {
        var tw = 0.5 + 0.5 * Math.sin(time * 2.2 + p * 12.9898);
        tw = tw * tw * state.sparkle;
        r += (COL.skyBright.r - r) * tw;
        g += (COL.skyBright.g - g) * tw;
        b += (COL.skyBright.b - b) * tw;
      }
      if (state.pulse > 0.01) {
        var wave = Math.sin(time * 1.6 - (live[c + 2] + live[c]) * 2.4);
        wave = Math.max(0, wave); wave *= wave * state.pulse;
        lum += wave * 0.8;
      }
      if (state.hoverGlow > 0.01 && brainF > 0.5) {
        if (region[p] === state.hoverRegion) {
          var hg = state.hoverGlow;
          r += (COL.skyBright.r - r) * hg;
          g += (COL.skyBright.g - g) * hg;
          b += (COL.skyBright.b - b) * hg;
          lum += hg * 1.1;
        } else {
          lum *= 1 - state.hoverGlow * 0.45;
        }
      }
      colors[c] = r * lum; colors[c + 1] = g * lum; colors[c + 2] = b * lum;
    }
    geo.attributes.color.needsUpdate = true;
  }

  function morph() {
    var t = state.assembled, eA = t * t * (3 - 2 * t);
    var m = state.shapeMix, eM = m * m * (3 - 2 * m);
    var openF = 1 + state.open * 0.55;
    for (var p = 0; p < N; p++) {
      var c = p * 3;
      var bx = fromBuf[c] + (targetBuf[c] - fromBuf[c]) * eM;
      var by = fromBuf[c + 1] + (targetBuf[c + 1] - fromBuf[c + 1]) * eM;
      var bz = fromBuf[c + 2] + (targetBuf[c + 2] - fromBuf[c + 2]) * eM;
      live[c] = (scatter[c] + (bx - scatter[c]) * eA) * openF;
      live[c + 1] = (scatter[c + 1] + (by - scatter[c + 1]) * eA) * openF;
      live[c + 2] = (scatter[c + 2] + (bz - scatter[c + 2]) * eA) * openF;
    }
    geo.attributes.position.needsUpdate = true;
    for (var l = 0; l < linkIdx.length; l++) {
      var src = linkIdx[l] * 3, dst = l * 3;
      linePos[dst] = live[src]; linePos[dst + 1] = live[src + 1]; linePos[dst + 2] = live[src + 2];
    }
    lineGeo.attributes.position.needsUpdate = true;
    lineMat.opacity = 0.22 * eA * state.brainness *
      (1 - state.open * 0.7) * (1 - state.lightMode * 0.35) * (1 - state.dive * 0.9);
  }

  function setShape(name) {
    if (!SHAPES[name] || name === currentShapeName) return;
    // מקבעים את הצורה הנוכחית כנקודת מוצא — גם באמצע מורף
    var m = state.shapeMix, eM = m * m * (3 - 2 * m);
    for (var p = 0; p < N * 3; p++) {
      fromBuf[p] = fromBuf[p] + (targetBuf[p] - fromBuf[p]) * eM;
    }
    targetBuf = SHAPES[name];
    currentShapeName = name;
    state.shapeMix = 0;
    gsap.to(state, { shapeMix: 1, duration: 1.7, ease: 'power3.inOut', overwrite: 'auto' });
    gsap.to(state, {
      brainness: name === 'brain' ? 1 : 0,
      duration: 0.5, ease: 'power2.out', overwrite: false
    });
  }

  /* ---------- מגע במוח ---------- */
  var raycaster = new THREE.Raycaster();
  raycaster.params.Points = { threshold: MOBILE ? 0.14 : 0.09 };
  var pointerNDC = new THREE.Vector2(-2, -2);
  var pointerDirty = false;
  var cardName = document.getElementById('brainCardName');
  var cardEn = document.getElementById('brainCardEn');
  var cardRole = document.getElementById('brainCardRole');
  var card = document.getElementById('brainCard');

  function updateCard(idx) {
    if (!card) return;
    if (idx >= 0 && REGION_DATA[idx]) {
      cardName.textContent = REGION_DATA[idx].he;
      cardEn.textContent = REGION_DATA[idx].en;
      cardRole.textContent = REGION_DATA[idx].role;
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  }

  function onPointer(e) {
    pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
    pointerDirty = true;
  }
  layer.addEventListener('pointermove', onPointer);
  layer.addEventListener('pointerdown', onPointer);

  function raycastRegion() {
    raycaster.setFromCamera(pointerNDC, camera);
    var hits = raycaster.intersectObject(points);
    return hits.length ? region[hits[0].index] : -1;
  }

  /* ---------- לולאת הפריימים ---------- */
  var running = false, lastMorphKey = -1;
  function frame(tMs) {
    if (!running) return;
    var time = tMs * 0.001;

    // סיבוב — DNA מסתובב מהר יותר, בגוף מלא לאט
    var spin = 0.05 + (currentShapeName === 'helix' ? 0.22 : 0) * state.shapeMix;
    group.rotation.y = state.rotY + time * spin + state.leanX;
    group.rotation.x = state.rotX + state.leanY;
    group.position.set(state.posX, state.posY, 0);

    // תנועת חיים לפי צורה: פעימת לב / נשימת ריאות
    var s = state.scale;
    var sy = s, sx = s;
    if (currentShapeName === 'heart') {
      var ph = time * 7.2;
      var beat = Math.pow(Math.max(0, Math.sin(ph)), 10) * 0.6 +
                 Math.pow(Math.max(0, Math.sin(ph - 0.5)), 22) * 0.4;
      var bs = 1 + 0.055 * beat * state.shapeMix;
      s *= bs; sy = s; sx = s;
    } else if (currentShapeName === 'lungs') {
      var br = Math.sin(time * 0.8) * state.shapeMix;
      sy = s * (1 + 0.06 * br);
      sx = s * (1 - 0.02 * br);
    }
    group.scale.set(sx, sy, s);

    // הצלילה אל תוך המוח: המצלמה נכנסת, הנקודות גדלות, הקווים נמוגים
    camera.position.z = 4.2 - state.dive * 3.55;
    ptsMat.size = 0.028 * (1 + state.dive * 1.6);
    ptsMat.opacity = state.baseOpacity;

    var mKey = state.assembled * 1000 + state.shapeMix * 100 + state.open * 10 + state.dive;
    if (mKey !== lastMorphKey) { morph(); lastMorphKey = mKey; }

    if (state.interactive && pointerDirty) {
      pointerDirty = false;
      if (currentShapeName === 'brain' && state.shapeMix > 0.7) {
        group.updateMatrixWorld(true);
        var hovered = raycastRegion();
        if (hovered !== state.hoverRegion) {
          state.hoverRegion = hovered;
          updateCard(hovered);
        }
      }
    }
    var hoverTarget = (state.interactive && state.hoverRegion >= 0) ? 1 : 0;
    state.hoverGlow += (hoverTarget - state.hoverGlow) * 0.12;

    paint(time);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  function setRunning(on) {
    if (on && !running) { running = true; requestAnimationFrame(frame); }
    else if (!on) running = false;
  }
  document.addEventListener('visibilitychange', function () { setRunning(!document.hidden); });

  /* ---------- הטיה עם העכבר ---------- */
  var leanToX = gsap.quickTo(state, 'leanX', { duration: 1.4, ease: 'power2.out' });
  var leanToY = gsap.quickTo(state, 'leanY', { duration: 1.4, ease: 'power2.out' });
  document.addEventListener('mousemove', function (e) {
    leanToX((e.clientX / window.innerWidth - 0.5) * 0.22);
    leanToY((e.clientY / window.innerHeight - 0.5) * 0.12);
  });

  /* ---------- תחנות המסע בגוף ----------
     כל תחנה: מיקום בטוח שלא מכסה תוכן + צורת הגוף + נתון ביומטרי אמיתי.
     RTL: posX חיובי = ימינה פיזית. */
  var WAYPOINTS = {
    hero:      { shape: 'brain', posX: 0,     posY: -0.15, scale: 1.2,  rotY: 0.35, region: -1, lightMode: 0, sparkle: 0,   pulse: 0,   open: 0,   baseOpacity: 0.95, label: '' },
    statement: { shape: 'brain', posX: -2.05, posY: 0.05,  scale: 0.5,  rotY: 2.35, region: 2,  lightMode: 1, sparkle: 0,   pulse: 0,   open: 0,   baseOpacity: 0.45, label: 'האונה העורפית · כאן נבנית הפרשנות' },
    world1:    { shape: 'brain', posX: 2.1,   posY: -0.6,  scale: 0.42, rotY: -0.9, region: 1,  lightMode: 1, sparkle: 0,   pulse: 0,   open: 0,   baseOpacity: 0.4,  label: 'המוח · ‎86 מיליארד נוירונים' },
    world2:    { shape: 'lungs', posX: 2.1,   posY: -0.6,  scale: 0.48, rotY: 0.15, region: -1, lightMode: 1, sparkle: 0,   pulse: 0,   open: 0,   baseOpacity: 0.45, label: 'הריאות · ‎22,000 נשימות ביום' },
    world3:    { shape: 'core',  posX: 2.1,   posY: -0.6,  scale: 0.45, rotY: 0.6,  region: -1, lightMode: 1, sparkle: 1,   pulse: 0,   open: 0,   baseOpacity: 0.45, label: 'הרשת · ‎כ-100 טריליון סינפסות' },
    brainmap:  { shape: 'brain', posX: -0.85, posY: -0.05, scale: 1.55, rotY: 0.5,  region: -1, lightMode: 0, sparkle: 0,   pulse: 0,   open: 0,   baseOpacity: 1,    label: '' },
    habits:    { shape: 'heart', posX: 0,     posY: 0,     scale: 1.15, rotY: 0.1,  region: -1, lightMode: 0, sparkle: 0,   pulse: 0.7, open: 0,   baseOpacity: 0.42, label: 'הלב · ‎100,000 פעימות ביום' },
    story:     { shape: 'body',  posX: -2.55, posY: 0,     scale: 0.55, rotY: 0.35, region: -1, lightMode: 1, sparkle: 0,   pulse: 0,   open: 0,   baseOpacity: 0.5,  label: 'הגוף כולו · הבית של הסיפור' },
    outcomes:  { shape: 'helix', posX: -1.8,  posY: 0.05,  scale: 0.5,  rotY: 0,    region: -1, lightMode: 1, sparkle: 0.3, pulse: 0,   open: 0,   baseOpacity: 0.45, label: 'DNA · אפיגנטיקה — ביטוי שאפשר לשנות' },
    path:      { shape: 'body',  posX: -1.9,  posY: -1.15, scale: 0.42, rotY: -0.3, region: -1, lightMode: 1, sparkle: 0,   pulse: 0.6, open: 0,   baseOpacity: 0.35, label: 'מהמוח לשריר · מהחלטה לתנועה' },
    cta:       { shape: 'core',  posX: 0,     posY: 0.05,  scale: 1.3,  rotY: -0.3, region: -1, lightMode: 0, sparkle: 0.5, pulse: 0,   open: 0.5, baseOpacity: 0.75, label: '' }
  };

  if (MOBILE) {
    WAYPOINTS.hero = Object.assign({}, WAYPOINTS.hero, { scale: 0.9, posY: -0.35, baseOpacity: 0.9 });
    WAYPOINTS.brainmap = Object.assign({}, WAYPOINTS.brainmap, { posX: 0, posY: 0.5, scale: 0.55 });
    WAYPOINTS.habits = Object.assign({}, WAYPOINTS.habits, { scale: 1.0, baseOpacity: 0.25 });
    WAYPOINTS.cta = Object.assign({}, WAYPOINTS.cta, { scale: 1.0 });
    ['statement', 'world1', 'world2', 'world3', 'story', 'outcomes', 'path'].forEach(function (k) {
      WAYPOINTS[k] = Object.assign({}, WAYPOINTS[k], { baseOpacity: 0, scale: 0.5, label: '' });
    });
  }

  var currentKey = null;
  function goTo(key) {
    var wp = WAYPOINTS[key];
    if (!wp) return;
    // בכוונה אין דדופ על key זהה: קריאה חוזרת מרפאת מצב תקוע
    currentKey = key;
    setShape(wp.shape || 'brain');
    gsap.to(state, {
      posX: wp.posX, posY: wp.posY, scale: wp.scale, rotY: wp.rotY,
      lightMode: wp.lightMode, sparkle: wp.sparkle, pulse: wp.pulse,
      open: wp.open, baseOpacity: wp.baseOpacity,
      duration: 1.4, ease: 'power3.inOut', overwrite: 'auto'
    });
    gsap.killTweensOf(state, 'regionGlow');
    gsap.to(state, {
      regionGlow: 0, duration: 0.4, ease: 'power2.in',
      onComplete: function () {
        state.activeRegion = wp.region;
        if (wp.region >= 0) {
          gsap.to(state, { regionGlow: 1, duration: 0.9, ease: 'power3.out' });
        }
      }
    });
    if (labelEl && labelText) {
      gsap.killTweensOf(labelEl);
      if (wp.label) {
        gsap.to(labelEl, {
          autoAlpha: 0, y: 8, duration: 0.3, onComplete: function () {
            labelText.textContent = wp.label;
            labelEl.classList.toggle('on-light', wp.lightMode === 1);
            gsap.to(labelEl, { autoAlpha: 1, y: 0, duration: 0.5 });
          }
        });
      } else {
        gsap.to(labelEl, { autoAlpha: 0, y: 8, duration: 0.3 });
      }
    }
  }

  function assemble() {
    gsap.to(state, { assembled: 1, duration: 2.4, ease: 'power2.inOut' });
  }

  function setInteractive(on) {
    state.interactive = !!on;
    layer.classList.toggle('interactive', state.interactive);
    if (!on) {
      state.hoverRegion = -1;
      updateCard(-1);
    }
  }

  // הצלילה אל תוך המוח (הירו): scrub מעדכן ישירות; יציאה — ריכוך חזרה
  function setDive(p, smooth) {
    if (smooth) {
      gsap.to(state, { dive: p, duration: 0.8, ease: 'power2.out', overwrite: 'auto' });
    } else {
      gsap.killTweensOf(state, 'dive'); // ה-scrub תמיד גובר על ריכוך יציאה פעיל
      state.dive = p;
    }
  }

  paint(0); morph(); setRunning(true);

  window.SHIFT_BRAIN = {
    ready: true, goTo: goTo, assemble: assemble,
    setInteractive: setInteractive, setDive: setDive,
    _qa: {
      frame: frame, state: state, region: region, count: N,
      shape: function () { return currentShapeName; },
      shapes: Object.keys(SHAPES),
      buffers: SHAPES,
      forceRun: function () { running = true; }
    }
  };
})();
