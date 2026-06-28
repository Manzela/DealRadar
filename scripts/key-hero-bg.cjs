// One-off: remove the baked-in checkerboard background from the hero PNG and
// re-encode with a real alpha channel. Flood-fills gray/white from the borders
// so interior light areas (radar hub, grid lines) are preserved.
// Usage: node scripts/key-hero-bg.cjs <in.png> <out.png>
const fs = require('fs');
const zlib = require('zlib');

const [, , INP, OUT] = process.argv;
if (!INP || !OUT) { console.error('usage: node key-hero-bg.cjs <in> <out>'); process.exit(1); }

// ---- CRC32 (use zlib.crc32 if available, else table) ----
let crc32 = zlib.crc32;
if (typeof crc32 !== 'function') {
  const T = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
  crc32 = (buf, seed = 0) => { let c = (seed ^ 0xFFFFFFFF) >>> 0; for (let i = 0; i < buf.length; i++) c = T[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
}

// ---- read & parse chunks ----
const buf = fs.readFileSync(INP);
let p = 8; // skip signature
let W = 0, H = 0, bitDepth = 0, colorType = 0, interlace = 0;
const idat = [];
while (p < buf.length) {
  const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8);
  const data = buf.slice(p + 8, p + 8 + len);
  if (type === 'IHDR') {
    W = data.readUInt32BE(0); H = data.readUInt32BE(4);
    bitDepth = data[8]; colorType = data[9]; interlace = data[12];
  } else if (type === 'IDAT') idat.push(data);
  else if (type === 'IEND') break;
  p += 12 + len;
}
if (bitDepth !== 8 || colorType !== 2 || interlace !== 0) {
  console.error(`unsupported: bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`); process.exit(1);
}

// ---- inflate & un-filter (RGB, bpp=3) ----
const raw = zlib.inflateSync(Buffer.concat(idat));
const bpp = 3, stride = W * bpp;
const rgb = Buffer.alloc(H * stride);
const paeth = (a, b, c) => { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
for (let y = 0; y < H; y++) {
  const ft = raw[y * (stride + 1)];
  const inRow = y * (stride + 1) + 1;
  const outRow = y * stride, prevRow = outRow - stride;
  for (let i = 0; i < stride; i++) {
    const x = raw[inRow + i];
    const a = i >= bpp ? rgb[outRow + i - bpp] : 0;
    const b = y > 0 ? rgb[prevRow + i] : 0;
    const c = (y > 0 && i >= bpp) ? rgb[prevRow + i - bpp] : 0;
    let v;
    switch (ft) {
      case 0: v = x; break;
      case 1: v = x + a; break;
      case 2: v = x + b; break;
      case 3: v = x + ((a + b) >> 1); break;
      case 4: v = x + paeth(a, b, c); break;
      default: console.error('bad filter ' + ft); process.exit(1);
    }
    rgb[outRow + i] = v & 0xFF;
  }
}

// ---- build RGBA, flood-fill background from borders ----
const N = W * H;
const out = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) { out[i * 4] = rgb[i * 3]; out[i * 4 + 1] = rgb[i * 3 + 1]; out[i * 4 + 2] = rgb[i * 3 + 2]; out[i * 4 + 3] = 255; }

const isBg = (i) => { const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2]; const mn = Math.min(r, g, b), mx = Math.max(r, g, b); return mn >= 190 && (mx - mn) <= 40; };
const visited = new Uint8Array(N);
const stack = new Int32Array(N); let sp = 0;
const push = (i) => { if (!visited[i] && isBg(i)) { visited[i] = 1; stack[sp++] = i; } };
for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
let keyed = 0;
while (sp > 0) {
  const i = stack[--sp];
  out[i * 4 + 3] = 0; keyed++;
  const x = i % W, y = (i / W) | 0;
  if (x > 0) push(i - 1);
  if (x < W - 1) push(i + 1);
  if (y > 0) push(i - W);
  if (y < H - 1) push(i + W);
}

// ---- defringe: erode light, low-saturation antialiased pixels touching the
// transparent edge (orange dish/label edges are saturated, so untouched) ----
const isLight = (i) => { const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2]; const mn = Math.min(r, g, b), mx = Math.max(r, g, b); return mn >= 165 && (mx - mn) <= 50; };
let defringed = 0;
for (let pass = 0; pass < 2; pass++) {
  const clear = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (out[i * 4 + 3] !== 255 || !isLight(i)) continue;
    const t = (x > 0 && out[(i - 1) * 4 + 3] === 0) || (x < W - 1 && out[(i + 1) * 4 + 3] === 0) ||
      (y > 0 && out[(i - W) * 4 + 3] === 0) || (y < H - 1 && out[(i + W) * 4 + 3] === 0);
    if (t) clear.push(i);
  }
  for (const i of clear) { out[i * 4 + 3] = 0; defringed++; }
}

// ---- encode RGBA PNG with adaptive per-row filtering (min sum-of-abs heuristic) ----
const bppA = 4, rowLen = W * 4;
const filtered = Buffer.alloc(H * (rowLen + 1));
const cand = [Buffer.alloc(rowLen), Buffer.alloc(rowLen), Buffer.alloc(rowLen), Buffer.alloc(rowLen), Buffer.alloc(rowLen)];
const pae = (a, b, c) => { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
for (let y = 0; y < H; y++) {
  const cur = y * rowLen, prev = cur - rowLen;
  for (let i = 0; i < rowLen; i++) {
    const x = out[cur + i];
    const a = i >= bppA ? out[cur + i - bppA] : 0;
    const b = y > 0 ? out[prev + i] : 0;
    const c = (y > 0 && i >= bppA) ? out[prev + i - bppA] : 0;
    cand[0][i] = x;
    cand[1][i] = (x - a) & 0xFF;
    cand[2][i] = (x - b) & 0xFF;
    cand[3][i] = (x - ((a + b) >> 1)) & 0xFF;
    cand[4][i] = (x - pae(a, b, c)) & 0xFF;
  }
  let best = 0, bestSum = Infinity;
  for (let f = 0; f < 5; f++) { let s = 0; const cb = cand[f]; for (let i = 0; i < rowLen; i++) { const v = cb[i]; s += v < 128 ? v : 256 - v; } if (s < bestSum) { bestSum = s; best = f; } }
  const o = y * (rowLen + 1);
  filtered[o] = best;
  cand[best].copy(filtered, o + 1);
}
const comp = zlib.deflateSync(filtered, { level: 9 });
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', comp), chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync(OUT, png);
console.log(JSON.stringify({ W, H, keyedPixels: keyed, defringed, pctKeyed: (100 * keyed / N).toFixed(1) + '%', outKB: Math.round(png.length / 1024) }));
