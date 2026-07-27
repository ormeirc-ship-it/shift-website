#!/usr/bin/env node
/**
 * drift-check.mjs — מוניטור סחיפת תוכן (פריט T5).
 *
 * ב-26.7 ביקורת שלמה התבססה על סנפשוט מת: עותק של `data.js` שהיה 12 ימי
 * פיתוח מאחור, וכל 21 הימים "נמצאו שגויים" בזמן שהאתר היה נכון. הכלי הזה
 * קיים כדי שזה לא יקרה שוב.
 *
 * משווה שלושה מקורות ומדווח מה נסחף:
 *   1. Firestore החי (מה שהמשתתפים באמת רואים) — מקור האמת
 *   2. `data.js` בריפו הפלטפורמה (אם קיים מקומית)
 *   3. סקשן 21 הימים ב-`index.html` (מה שהאתר מבטיח)
 *
 * שימוש:  npm run drift   ·   node scripts/drift-check.mjs --json
 *         --data <path>   נתיב מפורש ל-data.js
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { ROOT, pad } from './lib/env.mjs';

const JSON_OUT = process.argv.includes('--json');
const argPath = (() => { const i = process.argv.indexOf('--data'); return i > -1 ? process.argv[i + 1] : null; })();

const PROJECT = 'shift-21-day-course-ceos';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const norm = (s) => String(s || '')
  .replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/[‎‏]/g, '').replace(/[""]/g, '"').replace(/\s+/g, ' ').trim();

// ── 1. Firestore החי ─────────────────────────────────────────────────
async function fromFirestore() {
  const res = await fetch(`${FS_BASE}/days?pageSize=40`);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  const out = new Map();
  let newest = null;
  (data.documents || []).forEach((d) => {
    const day = Number(d.name.split('/').pop());
    const t = d.fields?.title?.stringValue;
    if (t) out.set(day, norm(t));
    if (d.updateTime && (!newest || d.updateTime > newest)) newest = d.updateTime;
  });
  return { titles: out, updated: newest };
}

// ── 2. data.js בריפו הפלטפורמה ───────────────────────────────────────
const DATA_CANDIDATES = [
  argPath,
  process.env.SHIFT_DATA_JS,
  join(homedir(), 'Desktop/SHIFT/shift platform main /shift-platform/קבצי קוד/data.js'),
  join(homedir(), 'Documents/Claude/Projects/SHIFT/app/data.js'),
].filter(Boolean);

function fromDataJs() {
  const p = DATA_CANDIDATES.find((x) => existsSync(x));
  if (!p) return null;
  const ctx = createContext({ localStorage: { getItem: () => null, setItem: () => {} }, console });
  runInContext(readFileSync(p, 'utf8') + '\n;globalThis.__D = DEFAULT_DAYS;', ctx);
  const out = new Map();
  ctx.__D.forEach((d) => out.set(d.day, norm(d.title)));
  return { titles: out, path: p, mtime: statSync(p).mtime.toISOString() };
}

// ── 3. האתר ──────────────────────────────────────────────────────────
function fromSite() {
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  const re = /<li[^>]*class="[^"]*day-item[^"]*"[\s\S]*?<span[^>]*class="day-no"[^>]*>(\d+)<\/span>[\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>/g;
  const out = new Map();
  let m;
  while ((m = re.exec(html)) !== null) out.set(Number(m[1]), norm(m[2]));
  return { titles: out };
}

// ── השוואה ───────────────────────────────────────────────────────────
const live = await fromFirestore().catch((e) => ({ error: e.message, titles: new Map() }));
const file = (() => { try { return fromDataJs(); } catch (e) { return { error: e.message, titles: new Map() }; } })();
const site = fromSite();

const days = [...new Set([...live.titles.keys(), ...(file?.titles.keys() || []), ...site.titles.keys()])].sort((a, b) => a - b);
const rows = days.map((d) => {
  const l = live.titles.get(d) || null;
  const f = file?.titles.get(d) || null;
  const s = site.titles.get(d) || null;
  return { day: d, live: l, file: f, site: s,
    siteVsLive: l && s ? (l === s ? 'ok' : 'drift') : 'missing',
    fileVsLive: l && f ? (l === f ? 'ok' : 'drift') : (file ? 'missing' : 'n/a') };
});

const siteDrift = rows.filter((r) => r.siteVsLive !== 'ok');
const fileDrift = rows.filter((r) => r.fileVsLive === 'drift');

if (JSON_OUT) {
  console.log(JSON.stringify({ live: { updated: live.updated, error: live.error },
    file: file ? { path: file.path, error: file.error } : null, rows, siteDrift: siteDrift.length, fileDrift: fileDrift.length }, null, 1));
  process.exit(siteDrift.length ? 1 : 0);
}

console.log('\n=== סחיפת תוכן — 21 ימי המסלול ===');
console.log('מקור האמת: Firestore החי' + (live.updated ? ` (עודכן לאחרונה ${live.updated.slice(0, 10)})` : ''));
if (live.error) console.log('⚠ לא הצלחתי לקרוא מ-Firestore: ' + live.error);
console.log('data.js:    ' + (file && file.path ? file.path.replace(homedir(), '~') +
  (file.mtime ? ' (נשמר ' + file.mtime.slice(0, 10) + ')' : '') : 'לא נמצא מקומית — מדלג'));
console.log('האתר:       index.html · ' + site.titles.size + ' ימים\n');

if (!siteDrift.length && !fileDrift.length) {
  console.log(`✓ שלושת המקורות תואמים בכל ${rows.length} הימים.`);
} else {
  if (siteDrift.length) {
    console.log(`✗ האתר נסחף מהמסד החי ב-${siteDrift.length} ימים:\n`);
    siteDrift.forEach((r) => console.log(`  יום ${pad(r.day, 3)} האתר: ${r.site || '—'}\n         החי:  ${r.live || '—'}`));
  }
  if (fileDrift.length) {
    console.log(`\n⚠ data.js נסחף מהמסד החי ב-${fileDrift.length} ימים — הריצו סנכרון בריפו הפלטפורמה.`);
    fileDrift.slice(0, 5).forEach((r) => console.log(`  יום ${r.day}: ${r.file} ≠ ${r.live}`));
  }
}
process.exit(siteDrift.length ? 1 : 0);
