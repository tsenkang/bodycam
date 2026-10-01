import * as THREE from 'three';

/**
 * Shop-sign atlas, painted on a 2D canvas at boot.
 *
 * A market street with blank boards over every shop is the loudest procedural
 * tell there is: in every reference frame the signage carries words. This is
 * the one surface in the library that is not baked from the GLSL noise stack,
 * because lettering is not noise. Everything is generic (trades, phone
 * numbers), bilingual Arabic / English the way the region's shopfronts are,
 * and weathered on the canvas: sun-bleached paint, rust weeping from the fixing
 * bolts, a dirt line along the bottom edge and scratches.
 *
 * Layout (1024 x 1024):
 *   rows 0-3  : 2 x 4 fascia boards, 512 x 192 (2.67:1)
 *   row  4    : 4 hanging / plate signs, 256 x 176
 *   remainder : unused (dark)
 *
 * `SIGN_CELLS` gives each cell's UV rectangle so the world can map a face to it.
 * Alpha is 1 everywhere: the material reads albedo.a as height.
 */

export const SIGN_ATLAS = 1024;

const BOARDS = [
  { ar: 'مخبز الأمل', en: 'AL-AMAL BAKERY', bg: '#7a2a22', fg: '#efe3c8', band: '#d9b45a' },
  { ar: 'صيدلية', en: 'PHARMACY', bg: '#2f6b55', fg: '#f2f0e6', band: '#e8e2cf', tel: '0790 114 382' },
  { ar: 'خياط', en: 'TAILOR', bg: '#e1d6b8', fg: '#2a3a6a', band: '#a3332b' },
  { ar: 'قطع غيار', en: 'AUTO PARTS', bg: '#1f3f73', fg: '#f4d24a', band: '#f4d24a', tel: '0771 52 906' },
  { ar: 'سوق النور', en: 'AL-NOOR MARKET', bg: '#c9a23a', fg: '#2b1a10', band: '#7a2a22' },
  { ar: 'حلاق', en: 'BARBER', bg: '#f0ece0', fg: '#8b1d1d', band: '#24456e' },
  { ar: 'موبايلات', en: 'MOBILE PHONES', bg: '#2d2d30', fg: '#e8c440', band: '#c03a2b', tel: '0750 338 117' },
  { ar: 'بهارات وعطارة', en: 'SPICES', bg: '#6b3a1e', fg: '#f1dfb0', band: '#3d6b3a' },
];
const PLATES = [
  { ar: 'فندق', en: 'HOTEL', bg: '#24456e', fg: '#f0ece0' },
  { ar: 'مقهى', en: 'CAFE', bg: '#8b1d1d', fg: '#f3e6c4' },
  { ar: '١٢', en: 'No. 12', bg: '#e9e3d2', fg: '#23324f' },
  { ar: 'ممنوع الوقوف', en: 'NO PARKING', bg: '#b72a22', fg: '#f6f3ea' },
];

/** UV rectangles [u0, v0, u1, v1] (v up, three.js convention) per cell. */
export const SIGN_CELLS = (() => {
  const cells = { boards: [], plates: [] };
  const S = SIGN_ATLAS;
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 2; c++) {
      const x = c * 512;
      const y = r * 192;
      cells.boards.push([x / S, 1 - (y + 192) / S, (x + 512) / S, 1 - y / S]);
    }
  for (let c = 0; c < 4; c++) {
    const x = c * 256;
    const y = 768;
    cells.plates.push([x / S, 1 - (y + 176) / S, (x + 256) / S, 1 - y / S]);
  }
  return cells;
})();

/** Small deterministic LCG — Math.random() is banned in visuals. */
function lcg(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function fitText(ctx, text, maxW, px, font) {
  let size = px;
  ctx.font = `bold ${size}px ${font}`;
  while (ctx.measureText(text).width > maxW && size > 8) {
    size -= 2;
    ctx.font = `bold ${size}px ${font}`;
  }
  return size;
}

function weather(ctx, x, y, w, h, rnd) {
  // sun-bleach: big soft pale blotches
  for (let i = 0; i < 6; i++) {
    const cx = x + rnd() * w;
    const cy = y + rnd() * h;
    const r = (0.2 + rnd() * 0.5) * w * 0.5;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(235,228,210,${0.10 + rnd() * 0.16})`);
    g.addColorStop(1, 'rgba(235,228,210,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  // grime gradient up from the bottom edge and down from the top
  let g = ctx.createLinearGradient(0, y + h, 0, y + h * 0.45);
  g.addColorStop(0, 'rgba(40,32,22,0.55)');
  g.addColorStop(1, 'rgba(40,32,22,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  g = ctx.createLinearGradient(0, y, 0, y + h * 0.25);
  g.addColorStop(0, 'rgba(30,25,18,0.35)');
  g.addColorStop(1, 'rgba(30,25,18,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // rust weeping from the fixing bolts in the corners
  for (const bx of [x + w * 0.06, x + w * 0.94]) {
    for (const by of [y + h * 0.12, y + h * 0.62]) {
      ctx.fillStyle = 'rgba(60,45,35,0.9)';
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(2, h * 0.025), 0, Math.PI * 2);
      ctx.fill();
      const len = h * (0.15 + rnd() * 0.35);
      const rg = ctx.createLinearGradient(0, by, 0, by + len);
      rg.addColorStop(0, 'rgba(110,55,25,0.55)');
      rg.addColorStop(1, 'rgba(110,55,25,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(bx - h * 0.015 - rnd() * 2, by, h * 0.03 + rnd() * 3, len);
    }
  }
  // dirty runs down the face
  for (let i = 0; i < 9; i++) {
    const rx = x + rnd() * w;
    const ry = y + rnd() * h * 0.5;
    const len = h * (0.2 + rnd() * 0.6);
    const rg = ctx.createLinearGradient(0, ry, 0, ry + len);
    rg.addColorStop(0, `rgba(45,38,28,${0.12 + rnd() * 0.2})`);
    rg.addColorStop(1, 'rgba(45,38,28,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(rx, ry, 1 + rnd() * 4, len);
  }
  // scratches and paint flakes
  for (let i = 0; i < 40; i++) {
    const sx = x + rnd() * w;
    const sy = y + rnd() * h;
    if (rnd() < 0.6) {
      ctx.strokeStyle = `rgba(${rnd() < 0.5 ? '230,225,210' : '40,35,30'},${0.15 + rnd() * 0.3})`;
      ctx.lineWidth = 0.6 + rnd();
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (rnd() - 0.5) * w * 0.12, sy + (rnd() - 0.5) * h * 0.08);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(150,140,125,${0.4 + rnd() * 0.4})`;
      ctx.beginPath();
      const r = 1 + rnd() * h * 0.03;
      ctx.ellipse(sx, sy, r * (1 + rnd()), r, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // fine grain over everything so a sign never reads as vector art
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 18;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    d[i + 3] = 255;
  }
  ctx.putImageData(img, x, y);
}

function drawSign(ctx, x, y, w, h, s, rnd, plate) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = s.bg;
  ctx.fillRect(x, y, w, h);
  // painted border band
  const bw = Math.round(h * 0.06);
  ctx.strokeStyle = s.band ?? s.fg;
  ctx.lineWidth = bw;
  ctx.strokeRect(x + bw * 1.2, y + bw * 1.2, w - bw * 2.4, h - bw * 2.4);
  ctx.fillStyle = s.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const inner = w - bw * 6;
  if (plate) {
    fitText(ctx, s.ar, inner, Math.round(h * 0.34), 'DejaVu Sans, sans-serif');
    ctx.fillText(s.ar, x + w / 2, y + h * 0.38);
    fitText(ctx, s.en, inner, Math.round(h * 0.2), 'DejaVu Sans, Liberation Sans, sans-serif');
    ctx.fillText(s.en, x + w / 2, y + h * 0.72);
  } else {
    fitText(ctx, s.ar, inner, Math.round(h * 0.42), 'DejaVu Sans, sans-serif');
    ctx.fillText(s.ar, x + w / 2, y + h * (s.tel ? 0.34 : 0.38));
    fitText(ctx, s.en, inner * 0.9, Math.round(h * 0.2), 'Liberation Sans, DejaVu Sans, sans-serif');
    ctx.fillText(s.en, x + w / 2, y + h * (s.tel ? 0.64 : 0.72));
    if (s.tel) {
      fitText(ctx, s.tel, inner * 0.6, Math.round(h * 0.12), 'DejaVu Sans Mono, monospace');
      ctx.fillText(s.tel, x + w / 2, y + h * 0.84);
    }
  }
  weather(ctx, x, y, w, h, rnd);
  ctx.restore();
}

/** Paint the atlas and return a CanvasTexture (sRGB, mipmapped). */
export function buildSignAtlas(anisotropy = 8) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIGN_ATLAS;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#2a2622';
  ctx.fillRect(0, 0, SIGN_ATLAS, SIGN_ATLAS);
  const rnd = lcg(0x51a7);
  BOARDS.forEach((s, i) => {
    const c = i % 2;
    const r = Math.floor(i / 2);
    drawSign(ctx, c * 512, r * 192, 512, 192, s, rnd, false);
  });
  PLATES.forEach((s, i) => drawSign(ctx, i * 256, 768, 256, 176, s, rnd, true));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}
