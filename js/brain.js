/* ============================================================
   SHIFT — brain.js · המסע במוח
   מוח-קונסטלציה תלת-ממדי פרוצדורלי: אלפי חלקיקים וסינפסות,
   שכבה קבועה שחיה לאורך כל הדף. כל סקשן מדליק אזור מוח אחר.
   API: window.SHIFT_BRAIN = { ready, goTo(key), assemble() }
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

  /* ---------- גיאומטריה: מוח פרוצדורלי ----------
     במובייל: פחות חלקיקים — אותו מוח, חצי מהעומס */
  var N = MOBILE ? 1200 : 2300;
  var positions = new Float32Array(N * 3);   // יעד סופי
  var scatter = new Float32Array(N * 3);     // פיזור התחלתי (לפני ההתגבשות)
  var live = new Float32Array(N * 3);        // מצב נוכחי
  var colors = new Float32Array(N * 3);
  var region = new Uint8Array(N);

  /* ---------- מפת אזורים — אנטומיה מוחית מקובלת (מפה סכמטית) ----------
     0 קליפה מצחית | 1 קדם-מצחית | 2 עורפית (ראייה) | 3 מוחון | 4 גזע המוח
     5 המערכת הלימבית | 6 קליפה מוטורית | 7 קליפה קודקודית | 8 אונה רקתית */
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

  var i = 0, px, py, pz;
  // שתי המיספרות
  var HEMI = Math.floor(N * 0.8);
  while (i < HEMI) {
    var side = i % 2 === 0 ? 1 : -1;
    // דגימה על פני אליפסואיד עם הטיה החוצה (מרקם קליפה)
    var u = Math.random() * Math.PI * 2;
    var v = Math.acos(2 * Math.random() - 1);
    var rr = 0.86 + 0.14 * Math.pow(Math.random(), 0.35);
    px = Math.sin(v) * Math.cos(u) * 0.60 * rr;
    py = Math.cos(v) * 0.74 * rr;
    pz = Math.sin(v) * Math.sin(u) * 1.08 * rr;
    if (py < -0.42 && pz < -0.15) continue;          // מפנים מקום למוחון
    var w = wrinkle(px, py, pz);
    px += px * w; py += py * w; pz += pz * w;
    px = px * 0.92 + side * 0.34;                     // הפרדת המיספרות
    if (Math.abs(px) < 0.05) continue;                // החריץ הבין-המיספרי
    var k = i * 3;
    positions[k] = px; positions[k + 1] = py; positions[k + 2] = pz;
    // שיוך אזורים — לפי מיקום אנטומי (z חיובי = קדמת המוח)
    if (pz > 0.62 && py > -0.1) region[i] = 1;                        // קדם-מצחית
    else if (pz < -0.66 && py > 0.02) region[i] = 2;                  // עורפית (ראייה)
    else if (py > 0.5 && pz > -0.05 && pz < 0.4) region[i] = 6;       // מוטורית (רצועה קדם-מרכזית)
    else if (py > 0.42 && pz <= -0.05 && pz > -0.66) region[i] = 7;   // קודקודית
    else if (py < 0.08 && Math.abs(px) > 0.5 && pz > -0.45 && pz < 0.5) region[i] = 8; // רקתית
    else region[i] = 0;                                               // מצחית כללית / קליפה
    i++;
  }
  // מוחון
  var CB_END = Math.floor(N * 0.93);
  while (i < CB_END) {
    var side2 = i % 2 === 0 ? 1 : -1;
    var u2 = Math.random() * Math.PI * 2;
    var v2 = Math.acos(2 * Math.random() - 1);
    var r2 = 0.85 + 0.15 * Math.pow(Math.random(), 0.4);
    px = Math.sin(v2) * Math.cos(u2) * 0.30 * r2 + side2 * 0.20;
    py = Math.cos(v2) * 0.22 * r2 - 0.58;
    pz = Math.sin(v2) * Math.sin(u2) * 0.34 * r2 - 0.72;
    var k2 = i * 3;
    positions[k2] = px; positions[k2 + 1] = py; positions[k2 + 2] = pz;
    region[i] = 3;
    i++;
  }
  // גזע המוח + ליבה לימבית
  while (i < N) {
    var k3 = i * 3;
    if (i % 2 === 0) { // גזע
      var t = Math.random();
      px = (Math.random() - 0.5) * 0.14;
      py = -0.35 - t * 0.55;
      pz = -0.25 - t * 0.22 + (Math.random() - 0.5) * 0.1;
      region[i] = 4;
    } else {           // ליבה לימבית
      var u3 = Math.random() * Math.PI * 2;
      var v3 = Math.acos(2 * Math.random() - 1);
      var r3 = 0.30 * Math.cbrt(Math.random());
      px = Math.sin(v3) * Math.cos(u3) * r3 * 1.1;
      py = Math.cos(v3) * r3 * 0.7 - 0.08;
      pz = Math.sin(v3) * Math.sin(u3) * r3 * 1.2 + 0.05;
      region[i] = 5;
    }
    positions[k3] = px; positions[k3 + 1] = py; positions[k3 + 2] = pz;
    i++;
  }

  // פיזור התחלתי — אבק כוכבים שממנו המוח מתגבש
  for (i = 0; i < N; i++) {
    var k4 = i * 3;
    var rs = 2.6 + Math.random() * 2.4;
    var us = Math.random() * Math.PI * 2;
    var vs = Math.acos(2 * Math.random() - 1);
    scatter[k4] = Math.sin(vs) * Math.cos(us) * rs;
    scatter[k4 + 1] = Math.cos(vs) * rs * 0.7;
    scatter[k4 + 2] = Math.sin(vs) * Math.sin(us) * rs;
    live[k4] = scatter[k4]; live[k4 + 1] = scatter[k4 + 1]; live[k4 + 2] = scatter[k4 + 2];
  }

  /* ---------- חיבורים סינפטיים (שכנים קרובים) ---------- */
  var linkIdx = [];
  var MAXD2 = 0.24 * 0.24;
  var counts = new Uint8Array(N);
  for (i = 0; i < N; i += 1) {
    if (counts[i] >= 2) continue;
    var bi = i * 3;
    for (var j = i + 1; j < N && counts[i] < 2; j++) {
      if (counts[j] >= 2) continue;
      var bj = j * 3;
      var dx = positions[bi] - positions[bj];
      var dy = positions[bi + 1] - positions[bj + 1];
      var dz = positions[bi + 2] - positions[bj + 2];
      var d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < MAXD2 && d2 > 0.003) {
        linkIdx.push(i, j);
        counts[i]++; counts[j]++;
      }
    }
  }

  /* ---------- סצנה ---------- */
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
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
    assembled: 0,          // 0 אבק → 1 מוח
    activeRegion: -1,      // אזור מודלק (מסע)
    regionGlow: 0,         // עוצמת ההדלקה
    lightMode: 0,          // 0 כהה (תכלת) → 1 בהיר (נייבי)
    sparkle: 0,            // נצנוץ כלל-רשתי (AI)
    pulse: 0,              // גלי מסלולים (הרגלים)
    open: 0,               // התרחבות (CTA)
    baseOpacity: 0.95,
    rotY: 0.35, rotX: -0.06,
    posX: 0, posY: -0.55, scale: 1.35,
    leanX: 0, leanY: 0,
    hoverRegion: -1,       // אזור תחת הסמן (מפת המוח)
    hoverGlow: 0,          // עוצמת ההדגשה של המגע
    interactive: false
  };

  var tmpA = new THREE.Color(), tmpB = new THREE.Color();

  function paint(time) {
    var base = tmpA.copy(COL.skyBase).lerp(COL.navyBase, state.lightMode);
    var glow = tmpB.copy(COL.skyGlow).lerp(COL.navyGlow, state.lightMode);
    for (var p = 0; p < N; p++) {
      var c = p * 3;
      var r = base.r, g = base.g, b = base.b;
      var depth = (positions[c + 2] + 1.2) / 2.4; // עומק קדמי בהיר יותר
      var lum = 0.75 + depth * 0.45;
      if (state.regionGlow > 0.01 && region[p] === state.activeRegion) {
        var gl = state.regionGlow;
        r = r + (COL.skyBright.r - r) * gl;
        g = g + (COL.skyBright.g - g) * gl;
        b = b + (COL.skyBright.b - b) * gl;
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
        var wave = Math.sin(time * 1.6 - (positions[c + 2] + positions[c]) * 2.4);
        wave = Math.max(0, wave); wave *= wave * state.pulse;
        lum += wave * 0.8;
      }
      // מפת המוח: האזור שתחת הסמן בוער, השאר מתעמעמים מעט
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
    var t = state.assembled, ease = t * t * (3 - 2 * t);
    var openF = 1 + state.open * 0.55;
    for (var p = 0; p < N; p++) {
      var c = p * 3;
      live[c] = (scatter[c] + (positions[c] - scatter[c]) * ease) * openF;
      live[c + 1] = (scatter[c + 1] + (positions[c + 1] - scatter[c + 1]) * ease) * openF;
      live[c + 2] = (scatter[c + 2] + (positions[c + 2] - scatter[c + 2]) * ease) * openF;
    }
    geo.attributes.position.needsUpdate = true;
    for (var l = 0; l < linkIdx.length; l++) {
      var src = linkIdx[l] * 3, dst = l * 3;
      linePos[dst] = live[src]; linePos[dst + 1] = live[src + 1]; linePos[dst + 2] = live[src + 2];
    }
    lineGeo.attributes.position.needsUpdate = true;
    lineMat.opacity = 0.22 * ease * (1 - state.open * 0.7) * (1 - state.lightMode * 0.35);
  }

  /* ---------- מגע במוח: זיהוי אזור תחת הסמן ---------- */
  var raycaster = new THREE.Raycaster();
  raycaster.params.Points = { threshold: MOBILE ? 0.14 : 0.09 }; // אצבע רחבה מסמן
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

  layer.addEventListener('pointermove', function (e) {
    pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
    pointerDirty = true;
  });
  layer.addEventListener('pointerdown', function (e) {
    pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
    pointerDirty = true;
  });

  function raycastRegion() {
    raycaster.setFromCamera(pointerNDC, camera);
    var hits = raycaster.intersectObject(points);
    if (hits.length) {
      var idx = hits[0].index;
      return region[idx];
    }
    return -1;
  }

  var running = false, lastMorphT = -1;
  function frame(tMs) {
    if (!running) return;
    var time = tMs * 0.001;
    group.rotation.y = state.rotY + time * 0.05 + state.leanX;
    group.rotation.x = state.rotX + state.leanY;
    group.position.set(state.posX, state.posY, 0);
    group.scale.setScalar(state.scale);
    ptsMat.opacity = state.baseOpacity;
    // מעדכנים גיאומטריה רק כשמשהו זז (התגבשות/פתיחה)
    var mk = state.assembled * 1000 + state.open;
    if (mk !== lastMorphT) { morph(); lastMorphT = mk; }
    // מפת המוח: בדיקת אזור תחת הסמן (רק כשהמפה פעילה והסמן זז)
    if (state.interactive && pointerDirty) {
      pointerDirty = false;
      group.updateMatrixWorld(true); // המטריצה עדכנית גם לפני הרינדור הראשון
      var hovered = raycastRegion();
      if (hovered !== state.hoverRegion) {
        state.hoverRegion = hovered;
        updateCard(hovered);
      }
    }
    // ריכוך עוצמת ההדגשה
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

  /* ---------- הטיה עדינה עם העכבר ---------- */
  var leanToX = gsap.quickTo(state, 'leanX', { duration: 1.4, ease: 'power2.out' });
  var leanToY = gsap.quickTo(state, 'leanY', { duration: 1.4, ease: 'power2.out' });
  document.addEventListener('mousemove', function (e) {
    leanToX((e.clientX / window.innerWidth - 0.5) * 0.22);
    leanToY((e.clientY / window.innerHeight - 0.5) * 0.12);
  });

  /* ---------- תחנות המסע ----------
     RTL: posX חיובי = ימינה פיזית. הטקסט ברוב הסקשנים מיושר ימינה,
     לכן המוח נודד לצד שמאל (posX שלילי) כשצריך לפנות מקום. */
  /* המיקומים חושבו מול פריסת הסקשנים כך שהמוח לעולם לא מכסה תוכן:
     בסקשנים בהירים הוא ווטרמארק קטן בשולי העמוד; את הבמה המלאה
     הוא מקבל בהירו, במפת המוח וב-CTA (רקעים כהים, מאחורי טקסט קצר). */
  var WAYPOINTS = {
    hero:      { posX: 0,     posY: -0.55, scale: 1.35, rotY: 0.35,  region: -1, lightMode: 0, sparkle: 0, pulse: 0, open: 0, baseOpacity: 0.95, label: '' },
    statement: { posX: -2.05, posY: 0.05,  scale: 0.5,  rotY: 2.35,  region: 2,  lightMode: 1, sparkle: 0, pulse: 0, open: 0, baseOpacity: 0.45, label: 'האונה העורפית · כאן נבנית הפרשנות' },
    world1:    { posX: 2.1,   posY: -0.6,  scale: 0.42, rotY: -0.9,  region: 1,  lightMode: 1, sparkle: 0, pulse: 0, open: 0, baseOpacity: 0.4,  label: 'הקליפה הקדם-מצחית · מודעות ובחירה' },
    world2:    { posX: 2.1,   posY: -0.6,  scale: 0.42, rotY: 2.75,  region: 3,  lightMode: 1, sparkle: 0, pulse: 0, open: 0, baseOpacity: 0.4,  label: 'המוחון וגזע המוח · חוכמת הגוף' },
    world3:    { posX: 2.1,   posY: -0.6,  scale: 0.42, rotY: 0.6,   region: -1, lightMode: 1, sparkle: 1, pulse: 0, open: 0, baseOpacity: 0.4,  label: 'הרשת כולה · חיבורים חדשים' },
    brainmap:  { posX: -0.85, posY: -0.05, scale: 1.55, rotY: 0.5,   region: -1, lightMode: 0, sparkle: 0, pulse: 0, open: 0, baseOpacity: 1,    label: '' },
    habits:    { posX: 0,     posY: 0,     scale: 1.4,  rotY: 0.2,   region: -1, lightMode: 0, sparkle: 0, pulse: 1, open: 0, baseOpacity: 0.3,  label: 'מסלולים עצביים · הרגל שמתחזק' },
    story:     { posX: -2.6,  posY: 0,     scale: 0.45, rotY: 1.5,   region: 5,  lightMode: 1, sparkle: 0, pulse: 0, open: 0, baseOpacity: 0.5,  label: 'המערכת הלימבית · הלב של הרגש' },
    outcomes:  { posX: -1.75, posY: 0.1,   scale: 0.5,  rotY: -2.2,  region: -1, lightMode: 1, sparkle: 0.4, pulse: 0, open: 0, baseOpacity: 0.42, label: 'סנכרון כלל-מוחי · תודעה חדשה' },
    path:      { posX: -1.9,  posY: -1.15, scale: 0.4,  rotY: 0.9,   region: 6,  lightMode: 1, sparkle: 0, pulse: 0.6, open: 0, baseOpacity: 0.35, label: 'הקליפה המוטורית · מהחלטה לפעולה' },
    cta:       { posX: 0,     posY: 0.05,  scale: 1.35, rotY: -0.3,  region: -1, lightMode: 0, sparkle: 0.5, pulse: 0, open: 0.5, baseOpacity: 0.75, label: '' }
  };

  /* מובייל: מסך צר — המוח מופיע רק ברגעים הגדולים (הירו, מפת המוח,
     הרגלים כרקע עדין, CTA); בשאר הסקשנים הוא מתפוגג כדי לא להפריע לתוכן */
  if (MOBILE) {
    WAYPOINTS.hero = Object.assign({}, WAYPOINTS.hero, { scale: 0.95, posY: -0.45, baseOpacity: 0.9 });
    // קנה מידה שנכנס כולו ברוחב מסך צר — כדי שאפשר יהיה לגעת בכל אזור
    WAYPOINTS.brainmap = Object.assign({}, WAYPOINTS.brainmap, { posX: 0, posY: 0.5, scale: 0.55 });
    WAYPOINTS.habits = Object.assign({}, WAYPOINTS.habits, { scale: 1.15, baseOpacity: 0.2 });
    WAYPOINTS.cta = Object.assign({}, WAYPOINTS.cta, { scale: 1.05 });
    ['statement', 'world1', 'world2', 'world3', 'story', 'outcomes', 'path'].forEach(function (k) {
      WAYPOINTS[k] = Object.assign({}, WAYPOINTS[k], { baseOpacity: 0, scale: 0.5, label: '' });
    });
  }

  var currentKey = null;
  function goTo(key) {
    var wp = WAYPOINTS[key];
    if (!wp) return;
    // בכוונה אין דדופ על key זהה: קריאה חוזרת מרפאת מצב תקוע
    // אחרי גלילה מהירה שמערבבת סדר אירועים; overwrite מסדר את השאר
    currentKey = key;
    gsap.to(state, {
      posX: wp.posX, posY: wp.posY, scale: wp.scale, rotY: wp.rotY,
      lightMode: wp.lightMode, sparkle: wp.sparkle, pulse: wp.pulse,
      open: wp.open, baseOpacity: wp.baseOpacity,
      duration: 1.4, ease: 'power3.inOut', overwrite: 'auto'
    });
    // החלפת אזור: מכבים, מחליפים, מדליקים — הריגת טווינים קודמים מונעת מרוץ
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
    // תווית האזור — גם כאן: מעברים מהירים בין סקשנים לא מצטברים
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

  // מפת המוח: הפעלת מגע — השכבה תופסת אירועי סמן רק שם,
  // כדי לא לחסום קליקים בשאר האתר
  function setInteractive(on) {
    state.interactive = !!on;
    layer.classList.toggle('interactive', state.interactive);
    if (!on) {
      state.hoverRegion = -1;
      updateCard(-1);
    }
  }

  paint(0); morph(); setRunning(true);

  window.SHIFT_BRAIN = {
    ready: true, goTo: goTo, assemble: assemble, setInteractive: setInteractive,
    // צוהר לבדיקות אוטומטיות בסביבות ללא rAF (טאב מוסתר)
    _qa: { frame: frame, state: state, region: region, count: N, forceRun: function () { running = true; } }
  };
})();
