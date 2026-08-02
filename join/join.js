// SHIFT /join - מכונת-המצבים של שער ההרשמה (פריט 🚪, NEXT 2.8).
// שני מתגים קובעים את הזרימה; שינוי אחד = מעבר שלב, בלי לגעת בזרימה:
//
//   FREE_MODE  = true  → פרטים → אישור ("הקישור בדרך למייל")
//   FREE_MODE  = false → פרטים → הפניה לספק סליקה → חזרה → אישור
//   LEAD_WIRED = false → מצב-החזקה: הוולידציה חיה אבל שום דבר לא
//                        נשמר, והמבקר מקבל את האמת + קישור ישיר.
//                        נהפך ל-true כש-OC מכריע על יעד-ליד.
//
// בלי שדות תשלום כאן - לעולם. הסליקה, כשתגיע, בדף מאוחסן אצל הספק.
'use strict';

const FREE_MODE = true;
const LEAD_WIRED = false;

// ── אנליטיקס - אותו חוזה dataLayer כמו בעמוד הראשי ──────────────────
window.dataLayer = window.dataLayer || [];
const track = (event, detail) => {
  const rec = Object.assign({ event: 'shift:' + event, t: Math.round(performance.now()) }, detail);
  window.dataLayer.push(rec);
  if (location.search.indexOf('debug=track') > -1) console.log('[track]', rec);
};

// ── שכבת ספק-סליקה מופשטת (מימוש-דמה; ספק טרם נבחר) ─────────────────
// כשייבחר ספק (Grow / משולם / Stripe / PayPal): מחליפים את שני
// המימושים האלה בלבד. החתימה נשארת.
const checkout = {
  async createCheckout(order) {
    // דמה: אין ספק - אין לאן להפנות. הזרימה מדלגת לשלב האישור.
    void order;
    return { redirectUrl: null };
  },
  async verifyReturn(params) {
    void params;
    return { ok: true };
  },
};

// ── יעד הליד - מופשט; יעד אמיתי טרם הוכרע (הכרעת OC פתוחה) ──────────
async function submitLead(lead) {
  if (!LEAD_WIRED) {
    if (location.search.indexOf('debug=track') > -1) console.log('[lead:dry-run]', lead);
    return { stored: false };
  }
  // כאן יתחבר היעד שייבחר: Firestore / שירות טפסים / מייל.
  return { stored: true };
}

// ── ולידציה נגישה ───────────────────────────────────────────────────
const form = document.getElementById('joinForm');
const fields = [
  { input: document.getElementById('jName'), err: document.getElementById('jNameErr'),
    valid: (v) => v.trim().length >= 2 },
  { input: document.getElementById('jEmail'), err: document.getElementById('jEmailErr'),
    valid: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) },
  { input: document.getElementById('jPhone'), err: document.getElementById('jPhoneErr'),
    valid: (v) => { const d = v.replace(/\D/g, ''); return /^0\d{8,9}$/.test(d); } },
  { input: document.getElementById('jConsent'), err: document.getElementById('jConsentErr'),
    valid: (_, el) => el.checked },
];

for (const f of fields) {
  f.input.setAttribute('aria-describedby', f.err.id);
  f.input.addEventListener('input', () => setFieldState(f, true));
}

function setFieldState(f, ok) {
  f.input.setAttribute('aria-invalid', String(!ok));
  f.err.classList.toggle('on', !ok);
}

// ‏join_start - פעם אחת, במיקוד הראשון בטופס
let started = false;
form.addEventListener('focusin', () => {
  if (started) return;
  started = true;
  track('join_start');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  let firstBad = null;
  for (const f of fields) {
    const ok = f.valid(f.input.value || '', f.input);
    setFieldState(f, ok);
    if (!ok && !firstBad) firstBad = f.input;
  }
  if (firstBad) { firstBad.focus(); return; }

  const btn = document.getElementById('jSubmit');
  btn.disabled = true;
  const lead = {
    name: document.getElementById('jName').value.trim(),
    email: document.getElementById('jEmail').value.trim(),
    phone: document.getElementById('jPhone').value.replace(/\D/g, ''),
    consent: true,
    ts: Date.now(),
  };
  track('join_submit');

  const saved = await submitLead(lead);
  if (!saved.stored) {
    // מצב-החזקה: אמת מלאה למבקר, בלי הבטחת-שווא
    track('join_holding');
    form.hidden = true;
    document.getElementById('jHolding').hidden = false;
    return;
  }

  if (!FREE_MODE) {
    const { redirectUrl } = await checkout.createCheckout({ lead, product: 'program-21' });
    if (redirectUrl) { location.assign(redirectUrl); return; }
  }

  track('join_success');
  form.hidden = true;
  document.getElementById('jSuccess').hidden = false;
});

// ‏חזרה מספק-סליקה (כשיהיה): ?return=1&... → אימות והצגת אישור
if (location.search.indexOf('return=1') > -1) {
  checkout.verifyReturn(location.search).then(({ ok }) => {
    if (!ok) return;
    track('join_success');
    form.hidden = true;
    document.getElementById('jSuccess').hidden = false;
  });
}
