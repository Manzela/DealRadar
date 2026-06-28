// Produce a label-free radar by RADIUS, not connectivity: find the dish circle
// and erase everything outside it (the labels live in the corners/margins).
// This keeps the WHOLE dish — including faint rim pixels that are technically
// a separate component — so the circle stays symmetric.
// Output: public/hero-radar.png (RGBA).
const fs = require('fs'), zlib = require('zlib');
const INP = 'public/hero-illustration.png', OUT = 'public/hero-radar.png';
const MARGIN = 14; // keep this many px beyond the dish radius (smooth edge)

function decodeRGBA(file) {
  const b = fs.readFileSync(file);
  const W = b.readUInt32BE(16), H = b.readUInt32BE(20), ct = b[25];
  let p = 8, idat = [];
  while (p < b.length) { const len = b.readUInt32BE(p), t = b.toString('ascii', p + 4, p + 8), d = b.slice(p + 8, p + 8 + len); if (t === 'IDAT') idat.push(d); else if (t === 'IEND') break; p += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = ct === 6 ? 4 : 3, stride = W * bpp, px = Buffer.alloc(H * stride);
  const pae = (a, bb, c) => { const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c); return pa <= pb && pa <= pc ? a : pb <= pc ? bb : c; };
  for (let y = 0; y < H; y++) { const ft = raw[y * (stride + 1)], ir = y * (stride + 1) + 1, or = y * stride, pr = or - stride; for (let i = 0; i < stride; i++) { const x = raw[ir + i], a = i >= bpp ? px[or + i - bpp] : 0, bb = y > 0 ? px[pr + i] : 0, c = (y > 0 && i >= bpp) ? px[pr + i - bpp] : 0; let v; switch (ft) { case 0: v = x; break; case 1: v = x + a; break; case 2: v = x + bb; break; case 3: v = x + ((a + bb) >> 1); break; case 4: v = x + pae(a, bb, c); break; } px[or + i] = v & 255; } }
  if (bpp === 3) { const out = Buffer.alloc(W * H * 4); for (let i = 0; i < W * H; i++) { out[i * 4] = px[i * 3]; out[i * 4 + 1] = px[i * 3 + 1]; out[i * 4 + 2] = px[i * 3 + 2]; out[i * 4 + 3] = 255; } return { W, H, px: out }; }
  return { W, H, px };
}

const { W, H, px } = decodeRGBA(INP);
const N = W * H;
const A = new Uint8Array(N);
for (let i = 0; i < N; i++) A[i] = px[i * 4 + 3] > 16 ? 1 : 0;

// largest connected component = main dish mass (vertical extent + right edge are
// intact there); derive the true circle from its bbox.
const label = new Int32Array(N).fill(-1), stack = new Int32Array(N);
let best = -1, bestSize = 0, comp = 0, bb = null;
for (let s = 0; s < N; s++) {
  if (!A[s] || label[s] !== -1) continue;
  let sp = 0; stack[sp++] = s; label[s] = comp; let size = 0, minx = W, maxx = 0, miny = H, maxy = 0;
  while (sp > 0) { const i = stack[--sp]; size++; const x = i % W, y = (i / W) | 0; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
    if (x > 0 && A[i - 1] && label[i - 1] === -1) { label[i - 1] = comp; stack[sp++] = i - 1; }
    if (x < W - 1 && A[i + 1] && label[i + 1] === -1) { label[i + 1] = comp; stack[sp++] = i + 1; }
    if (y > 0 && A[i - W] && label[i - W] === -1) { label[i - W] = comp; stack[sp++] = i - W; }
    if (y < H - 1 && A[i + W] && label[i + W] === -1) { label[i + W] = comp; stack[sp++] = i + W; } }
  if (size > bestSize) { bestSize = size; best = comp; bb = { minx, maxx, miny, maxy }; }
  comp++;
}
const Rv = (bb.maxy - bb.miny) / 2;
const cy = (bb.miny + bb.maxy) / 2;
const cx = bb.maxx - Rv;            // right edge is intact -> derive center x
const R = Math.max(Rv, bb.maxx - cx) + MARGIN;

// erase everything outside the circle
let erased = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const dx = x - cx, dy = y - cy;
  if (dx * dx + dy * dy > R * R) { const i = y * W + x; if (px[i * 4 + 3] !== 0) erased++; px[i * 4 + 3] = 0; }
}

// encode RGBA (adaptive filter)
let crc32 = zlib.crc32 || (() => { const T = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; } return (buf, s = 0) => { let c = (s ^ 0xFFFFFFFF) >>> 0; for (let i = 0; i < buf.length; i++) c = T[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }; })();
const rowLen = W * 4, filtered = Buffer.alloc(H * (rowLen + 1));
const cand = [Buffer.alloc(rowLen), Buffer.alloc(rowLen), Buffer.alloc(rowLen), Buffer.alloc(rowLen), Buffer.alloc(rowLen)];
const pae2 = (a, b, c) => { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
for (let y = 0; y < H; y++) { const cur = y * rowLen, prev = cur - rowLen; for (let i = 0; i < rowLen; i++) { const x = px[cur + i], a = i >= 4 ? px[cur + i - 4] : 0, b = y > 0 ? px[prev + i] : 0, c = (y > 0 && i >= 4) ? px[prev + i - 4] : 0; cand[0][i] = x; cand[1][i] = (x - a) & 255; cand[2][i] = (x - b) & 255; cand[3][i] = (x - ((a + b) >> 1)) & 255; cand[4][i] = (x - pae2(a, b, c)) & 255; } let bf = 0, bs = Infinity; for (let f = 0; f < 5; f++) { let su = 0; const cbf = cand[f]; for (let i = 0; i < rowLen; i++) { const v = cbf[i]; su += v < 128 ? v : 256 - v; } if (su < bs) { bs = su; bf = f; } } const o = y * (rowLen + 1); filtered[o] = bf; cand[bf].copy(filtered, o + 1); }
const compd = zlib.deflateSync(filtered, { level: 9 });
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0); const tb = Buffer.from(type, 'ascii'); const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, data])) >>> 0, 0); return Buffer.concat([len, tb, data, cb]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync(OUT, Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', compd), chunk('IEND', Buffer.alloc(0))]));
console.log(JSON.stringify({ center: [Math.round(cx), Math.round(cy)], radius: Math.round(R), bbox: bb, erasedPixels: erased, out: OUT }));
