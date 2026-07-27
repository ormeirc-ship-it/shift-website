// מפענח PNG מינימלי (RGB/RGBA 8-bit, לא-interlaced — מה שכרום מייצר) +
// השוואת פיקסלים. קודם חי בבדיקת הניגודיות של B3; קודם לכאן כשנעשה
// תשתית לרגרסיה הוויזואלית (פריט 9). בלי תלות חיצונית — node:zlib בלבד.
import { inflateSync } from 'node:zlib';

export function decodePNG(buf) {
  let pos = 8; const idat = []; let w = 0, h = 0, colorType = 6;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); colorType = data[9]; }
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = px.subarray(y * stride);
    const prev = y ? px.subarray((y - 1) * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = x >= bpp && prev ? prev[x - bpp] : 0;
      let v = row[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[x] = v & 255;
    }
  }
  return { w, h, bpp, px };
}

/**
 * השוואת שני PNG. פיקסל נחשב שונה אם ערוץ צבע כלשהו סוטה ביותר מ-tolerance
 * (ברירת מחדל 24 — סופג anti-aliasing ודחיסה, תופס שינוי אמיתי).
 * מחזיר {diffPct, diffCount, total} או {sizeMismatch: true}.
 */
export function comparePNG(bufA, bufB, { tolerance = 24 } = {}) {
  const a = decodePNG(bufA), b = decodePNG(bufB);
  if (a.w !== b.w || a.h !== b.h) {
    return { sizeMismatch: true, a: `${a.w}×${a.h}`, b: `${b.w}×${b.h}` };
  }
  const total = a.w * a.h;
  let diff = 0;
  for (let i = 0; i < total; i++) {
    const ia = i * a.bpp, ib = i * b.bpp;
    if (Math.abs(a.px[ia] - b.px[ib]) > tolerance ||
        Math.abs(a.px[ia + 1] - b.px[ib + 1]) > tolerance ||
        Math.abs(a.px[ia + 2] - b.px[ib + 2]) > tolerance) diff++;
  }
  return { diffPct: (diff / total) * 100, diffCount: diff, total };
}
