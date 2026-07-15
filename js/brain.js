/* ============================================================
   SHIFT — brain.js · המוח החי
   מוח זוהר בצפיפות גבוהה: ~9,000 חלקיקים רכים שמתמזגים לרקמה,
   קפלים קורטיקליים מאורגנים, הילה נושמת — שכבה קבועה שחיה
   לאורך כל הדף ומדליקה אזור אמיתי בכל סקשן.
   בהירו: המוח נגרר למרכז ואז המצלמה נכנסת אל תוכו.
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
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
  } catch (e) { return; }

  var COL = {
    skyBase: new THREE.Color(0x3a5f8a),
    skyGlow: new THREE.Color(0x5cbbf0),
    skyBright: new THREE.Color(0x9ad6f8),
    navyBase: new THREE.Color(0x18163b),
    navyGlow: new THREE.Color(0x3a5f8a)
  };

  var N = MOBILE ? 3500 : 9000;

  /* ---------- טקסטורת חלקיק רך — הנקודות מתמזגות לרקמה זוהרת ---------- */
  function makeGlowTexture(inner, mid) {
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,' + inner + ')');
    g.addColorStop(0.35, 'rgba(255,255,255,' + mid + ')');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    var tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }
  var dotTex = makeGlowTexture(1, 0.5);
  var haloTex = makeGlowTexture(0.55, 0.18);

  /* ---------- אנטומיה: מוח עם קפלים מאורגנים ---------- */
  var positions = new Float32Array(N * 3);
  var scatter = new Float32Array(N * 3);
  var live = new Float32Array(N * 3);
  var colors = new Float32Array(N * 3);
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

  // קפלים (גירי) מאורגנים: רכסים שרצים מלפנים לאחור ומתעקלים סביב הצדדים
  function gyri(x, y, z) {
    var theta = Math.atan2(y, Math.abs(x) * 0.75 + 0.15);
    var ridge = Math.sin(theta * 7.2 + Math.sin(z * 2.6) * 1.9 + z * 1.4);
    var fine = Math.sin(z * 11.0 + theta * 3.0) * 0.25;
    var r = Math.sign(ridge) * Math.pow(Math.abs(ridge), 0.65);
    return r * 0.055 + fine * 0.016;
  }

  (function makeBrain() {
    var i = 0, px, py, pz;
    var HEMI = Math.floor(N * 0.78);
    while (i < HEMI) {
      var side = i % 2 === 0 ? 1 : -1;
      var u = Math.random() * Math.PI * 2;
      var v = Math.acos(2 * Math.random() - 1);
      // הטיה חזקה לפני השטח — הקליפה נקראת כרקמה מלאה
      var rr = 0.90 + 0.10 * Math.pow(Math.random(), 0.22);
      px = Math.sin(v) * Math.cos(u) * 0.62 * rr;
      py = Math.cos(v) * 0.76 * rr;
      pz = Math.sin(v) * Math.sin(u) * 1.10 * rr;
      // צורת סילואטה: מצח מלא, עורף מתחדד מעט, בסיס שטוח יותר
      if (pz < -0.2) py *= 0.96;
      if (py < -0.45 && pz < -0.1) continue;           // מקום למוחון
      if (py < -0.62) continue;                         // בסיס
      // בליטת האונה הרקתית בצדדים
      if (py < 0.05 && py > -0.45 && Math.abs(px) > 0.3 && pz > -0.3 && pz < 0.55) {
        px *= 1.12; py -= 0.04;
      }
      var w = gyri(px, py, pz);
      var nl = Math.sqrt(px * px + py * py + pz * pz) || 1;
      px += (px / nl) * w; py += (py / nl) * w; pz += (pz / nl) * w;
      px = px * 0.92 + side * 0.335;
      if (Math.abs(px) < 0.045) continue;               // החריץ האורכי
      var k = i * 3;
      positions[k] = px; positions[k + 1] = py; positions[k + 2] = pz;
      if (pz > 0.62 && py > -0.1) region[i] = 1;
      else if (pz < -0.66 && py > 0.02) region[i] = 2;
      else if (py > 0.5 && pz > -0.05 && pz < 0.4) region[i] = 6;
      else if (py > 0.42 && pz <= -0.05 && pz > -0.66) region[i] = 7;
      else if (py < 0.08 && Math.abs(px) > 0.5 && pz > -0.45 && pz < 0.5) region[i] = 8;
      else region[i] = 0;
      i++;
    }
    // המוחון — מרקם פסים אופייני
    var CB_END = Math.floor(N * 0.92);
    while (i < CB_END) {
      var s2 = i % 2 === 0 ? 1 : -1;
      var u2 = Math.random() * Math.PI * 2;
      var v2 = Math.acos(2 * Math.random() - 1);
      var r2 = 0.88 + 0.12 * Math.pow(Math.random(), 0.3);
      px = Math.sin(v2) * Math.cos(u2) * 0.31 * r2 + s2 * 0.21;
      py = Math.cos(v2) * 0.23 * r2 - 0.60;
      pz = Math.sin(v2) * Math.sin(u2) * 0.35 * r2 - 0.74;
      // פסי המוחון האופקיים
      py += 0.012 * Math.sin(py * 40);
      var k2 = i * 3;
      positions[k2] = px; positions[k2 + 1] = py; positions[k2 + 2] = pz;
      region[i] = 3;
      i++;
    }
    // גזע המוח + הליבה הלימבית
    while (i < N) {
      var k3 = i * 3;
      if (i % 2 === 0) {
        var t = Math.random();
        px = (Math.random() - 0.5) * 0.15;
        py = -0.38 - t * 0.55;
        pz = -0.26 - t * 0.2 + (Math.random() - 0.5) * 0.1;
        region[i] = 4;
      } else {
        var u3 = Math.random() * Math.PI * 2;
        var v3 = Math.acos(2 * Math.random() - 1);
        var r3 = 0.32 * Math.cbrt(Math.random());
        px = Math.sin(v3) * Math.cos(u3) * r3 * 1.1;
        py = Math.cos(v3) * r3 * 0.7 - 0.08;
        pz = Math.sin(v3) * Math.sin(u3) * r3 * 1.2 + 0.05;
        region[i] = 5;
      }
      positions[k3] = px; positions[k3 + 1] = py; positions[k3 + 2] = pz;
      i++;
    }
    // פיזור התחלתי
    for (var s = 0; s < N; s++) {
      var k4 = s * 3;
      var rs = 2.6 + Math.random() * 2.4;
      var us = Math.random() * Math.PI * 2;
      var vs = Math.acos(2 * Math.random() - 1);
      scatter[k4] = Math.sin(vs) * Math.cos(us) * rs;
      scatter[k4 + 1] = Math.cos(vs) * rs * 0.7;
      scatter[k4 + 2] = Math.sin(vs) * Math.sin(us) * rs;
      live[k4] = scatter[k4]; live[k4 + 1] = scatter[k4 + 1]; live[k4 + 2] = scatter[k4 + 2];
    }
  })();

  /* ---------- סינפסות: על מדגם — טעינה מהירה גם ב-9K ---------- */
  var linkIdx = [];
  (function makeLinks() {
    var STRIDE = MOBILE ? 3 : 4;
    var MAXD2 = 0.2 * 0.2;
    var cand = [];
    for (var i = 0; i < N; i += STRIDE) cand.push(i);
    var counts = new Uint8Array(N);
    for (var a = 0; a < cand.length; a++) {
      var ia = cand[a];
      if (counts[ia] >= 2) continue;
      var bi = ia * 3;
      for (var b = a + 1; b < cand.length && counts[ia] < 2; b++) {
        var ib = cand[b];
        if (counts[ib] >= 2) continue;
        var bj = ib * 3;
        var dx = positions[bi] - positions[bj];
        var dy = positions[bi + 1] - positions[bj + 1];
        var dz = positions[bi + 2] - positions[bj + 2];
        var d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < MAXD2 && d2 > 0.004) {
          linkIdx.push(ia, ib);
          counts[ia]++; counts[ib]++;
        }
      }
    }
  })();

  /* ---------- סצנה ---------- */
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, 1, 0.08, 50);
  camera.position.set(0, 0.1, 4.2);

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(live, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  var ptsMat = new THREE.PointsMaterial({
    size: MOBILE ? 0.05 : 0.042,
    map: dotTex,
    vertexColors: true, transparent: true, opacity: 0.9,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });
  var points = new THREE.Points(geo, ptsMat);

  var lineGeo = new THREE.BufferGeometry();
  var linePos = new Float32Array(linkIdx.length * 3);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  var lineMat = new THREE.LineBasicMaterial({
    color: COL.skyBase, transparent: true, opacity: 0.1,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  var lines = new THREE.LineSegments(lineGeo, lineMat);

  // הילה נושמת — המוח "חי" גם במנוחה
  var haloMat = new THREE.SpriteMaterial({
    map: haloTex, color: COL.skyGlow, transparent: true, opacity: 0.14,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  var halo = new THREE.Sprite(haloMat);
  halo.scale.set(3.4, 3.0, 1);

  var group = new THREE.Group();
  group.add(halo); group.add(points); group.add(lines);
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
    dive: 0,
    activeRegion: -1,
    regionGlow: 0,
    lightMode: 0,
    sparkle: 0,
    pulse: 0,
    open: 0,
    baseOpacity: 0.9,
    rotY: 0.35, rotX: -0.06,
    posX: 0, posY: -0.15, scale: 1.2,
    leanX: 0, leanY: 0,
    hoverRegion: -1,
    hoverGlow: 0,
    interactive: false
  };
  var currentKey = null;

  var tmpA = new THREE.Color(), tmpB = new THREE.Color();

  function paint(time) {
    var base = tmpA.copy(COL.skyBase).lerp(COL.navyBase, state.lightMode);
    for (var p = 0; p < N; p++) {
      var c = p * 3;
      var r = base.r, g = base.g, b = base.b;
      var depth = (live[c + 2] + 1.2) / 2.4;
      var lum = 0.6 + depth * 0.55;
      if (state.regionGlow > 0.01 && region[p] === state.activeRegion) {
        var gl = state.regionGlow;
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
      if (state.hoverGlow > 0.01) {
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
    var openF = 1 + state.open * 0.55;
    for (var p = 0; p < N; p++) {
      var c = p * 3;
      live[c] = (scatter[c] + (positions[c] - scatter[c]) * eA) * openF;
      live[c + 1] = (scatter[c + 1] + (positions[c + 1] - scatter[c + 1]) * eA) * openF;
      live[c + 2] = (scatter[c + 2] + (positions[c + 2] - scatter[c + 2]) * eA) * openF;
    }
    geo.attributes.position.needsUpdate = true;
    for (var l = 0; l < linkIdx.length; l++) {
      var src = linkIdx[l] * 3, dst = l * 3;
      linePos[dst] = live[src]; linePos[dst + 1] = live[src + 1]; linePos[dst + 2] = live[src + 2];
    }
    lineGeo.attributes.position.needsUpdate = true;
  }

  /* ---------- מגע במוח ---------- */
  var raycaster = new THREE.Raycaster();
  raycaster.params.Points = { threshold: MOBILE ? 0.12 : 0.06 };
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

  function smoothstep(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

  /* ---------- לולאת פריימים ---------- */
  var running = false, lastMorphKey = -1;
  function frame(tMs) {
    if (!running) return;
    var time = tMs * 0.001;

    // ההירו: שלב 1 — נגרר למרכז; שלב 2 — המצלמה נכנסת פנימה
    var dragT = 0, diveIn = 0;
    if (currentKey === 'hero' || currentKey === null) {
      dragT = smoothstep(state.dive / 0.38);
      diveIn = smoothstep((state.dive - 0.35) / 0.65);
    }
    var rx = state.posX * (1 - dragT);
    var ry = state.posY * (1 - dragT * 0.6);
    var rs = state.scale * (1 + dragT * 0.28);

    group.rotation.y = state.rotY + time * 0.05 + state.leanX + dragT * 0.5;
    group.rotation.x = state.rotX + state.leanY;
    group.position.set(rx, ry, 0);
    // נשימה מיקרוסקופית — המוח חי גם במנוחה
    var breathe = 1 + 0.006 * Math.sin(time * 1.05);
    group.scale.setScalar(rs * breathe);

    camera.position.z = 4.2 - diveIn * 3.55;
    ptsMat.size = (MOBILE ? 0.05 : 0.042) * (1 + diveIn * 1.5);
    ptsMat.opacity = state.baseOpacity;
    lineMat.opacity = 0.1 * state.assembled * (1 - state.open * 0.7) *
      (1 - state.lightMode * 0.4) * (1 - diveIn * 0.95);
    haloMat.opacity = (0.14 + 0.05 * Math.sin(time * 0.7)) *
      state.assembled * state.baseOpacity * (1 - state.lightMode * 0.65) * (1 - diveIn);

    var mKey = state.assembled * 100 + state.open;
    if (mKey !== lastMorphKey) { morph(); lastMorphKey = mKey; }

    if (state.interactive && pointerDirty) {
      pointerDirty = false;
      group.updateMatrixWorld(true);
      var hovered = raycastRegion();
      if (hovered !== state.hoverRegion) {
        state.hoverRegion = hovered;
        updateCard(hovered);
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

  /* ---------- תחנות המסע ----------
     RTL: הטקסט בהירו מימין — המוח חי משמאל (posX שלילי). */
  var WAYPOINTS = {
    hero:      { posX: -1.15, posY: -0.05, scale: 1.05, rotY: 0.45,  region: -1, lightMode: 0, sparkle: 0,   pulse: 0,   open: 0,   baseOpacity: 0.95, label: '' },
    statement: { posX: -2.05, posY: 0.05,  scale: 0.5,  rotY: 2.35,  region: 2,  lightMode: 1, sparkle: 0,   pulse: 0,   open: 0,   baseOpacity: 0.45, label: 'האונה העורפית · כאן נבנית הפרשנות' },
    world1:    { posX: 2.1,   posY: -0.6,  scale: 0.42, rotY: -0.9,  region: 1,  lightMode: 1, sparkle: 0,   pulse: 0,   open: 0,   baseOpacity: 0.4,  label: 'הקליפה הקדם-מצחית · מודעות ובחירה' },
    world2:    { posX: 2.1,   posY: -0.6,  scale: 0.42, rotY: 2.75,  region: 3,  lightMode: 1, sparkle: 0,   pulse: 0,   open: 0,   baseOpacity: 0.4,  label: 'המוחון וגזע המוח · חוכמת הגוף' },
    world3:    { posX: 2.1,   posY: -0.6,  scale: 0.42, rotY: 0.6,   region: -1, lightMode: 1, sparkle: 1,   pulse: 0,   open: 0,   baseOpacity: 0.4,  label: 'הרשת כולה · ‎כ-100 טריליון סינפסות' },
    brainmap:  { posX: -0.85, posY: -0.05, scale: 1.55, rotY: 0.5,   region: -1, lightMode: 0, sparkle: 0,   pulse: 0,   open: 0,   baseOpacity: 1,    label: '' },
    habits:    { posX: 0,     posY: 0,     scale: 1.4,  rotY: 0.2,   region: -1, lightMode: 0, sparkle: 0,   pulse: 1,   open: 0,   baseOpacity: 0.3,  label: 'מסלולים עצביים · הרגל שמתחזק' },
    story:     { posX: -2.6,  posY: 0,     scale: 0.45, rotY: 1.5,   region: 5,  lightMode: 1, sparkle: 0,   pulse: 0,   open: 0,   baseOpacity: 0.5,  label: 'המערכת הלימבית · הלב של הרגש' },
    outcomes:  { posX: -1.8,  posY: 0.1,   scale: 0.5,  rotY: -2.2,  region: -1, lightMode: 1, sparkle: 0.4, pulse: 0,   open: 0,   baseOpacity: 0.42, label: 'סנכרון כלל-מוחי · תודעה חדשה' },
    path:      { posX: -1.9,  posY: -1.15, scale: 0.4,  rotY: 0.9,   region: 6,  lightMode: 1, sparkle: 0,   pulse: 0.6, open: 0,   baseOpacity: 0.35, label: 'הקליפה המוטורית · מהחלטה לפעולה' },
    cta:       { posX: 0,     posY: 0.05,  scale: 1.3,  rotY: -0.3,  region: -1, lightMode: 0, sparkle: 0.5, pulse: 0,   open: 0.5, baseOpacity: 0.75, label: '' }
  };

  if (MOBILE) {
    WAYPOINTS.hero = Object.assign({}, WAYPOINTS.hero, { posX: 0, posY: -0.35, scale: 0.85, baseOpacity: 0.9 });
    WAYPOINTS.brainmap = Object.assign({}, WAYPOINTS.brainmap, { posX: 0, posY: 0.5, scale: 0.55 });
    WAYPOINTS.habits = Object.assign({}, WAYPOINTS.habits, { scale: 1.0, baseOpacity: 0.22 });
    WAYPOINTS.cta = Object.assign({}, WAYPOINTS.cta, { scale: 1.0 });
    ['statement', 'world1', 'world2', 'world3', 'story', 'outcomes', 'path'].forEach(function (k) {
      WAYPOINTS[k] = Object.assign({}, WAYPOINTS[k], { baseOpacity: 0, scale: 0.5, label: '' });
    });
  }

  function goTo(key) {
    var wp = WAYPOINTS[key];
    if (!wp) return;
    // בכוונה אין דדופ: קריאה חוזרת מרפאת מצב תקוע אחרי גלילה מהירה
    currentKey = key;
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

  function setDive(p, smooth) {
    if (smooth) {
      gsap.to(state, { dive: p, duration: 0.8, ease: 'power2.out', overwrite: 'auto' });
    } else {
      gsap.killTweensOf(state, 'dive');
      state.dive = p;
    }
  }

  paint(0); morph(); setRunning(true);

  window.SHIFT_BRAIN = {
    ready: true, goTo: goTo, assemble: assemble,
    setInteractive: setInteractive, setDive: setDive,
    _qa: {
      frame: frame, state: state, region: region, count: N,
      links: linkIdx.length / 2,
      currentKey: function () { return currentKey; },
      forceRun: function () { running = true; }
    }
  };
})();
