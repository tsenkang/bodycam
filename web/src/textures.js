// Texturas procedurais (canvas) — mesmo espírito de map/map_materials.gd.
// Cada material tem cor, relevo (bumpMap) e rugosidade variável.
import * as THREE from 'three';
import { makeNoise, clamp, smoothstep } from './util.js';

const SIZE = 256;
// Materiais que aparecem de perto ganham o dobro de resolução.
const HI_RES = new Set(['asphalt', 'brick', 'pavers', 'sidewalk', 'wood', 'tiles', 'plaster', 'concrete']);
const cache = {};

// tipo: [metros cobertos pela textura, rugosidade base, metálico, força do relevo]
const DEFS = {
  asphalt: [4, 0.92, 0, 0.6], sidewalk: [2, 0.85, 0, 0.8], pavers: [2, 0.8, 0, 1.0],
  brick: [2, 0.88, 0, 1.2], plaster: [3, 0.9, 0, 0.4], concrete: [3.3, 0.85, 0, 0.5],
  corrugated: [2, 0.55, 0.5, 1.4], tiles: [2, 0.35, 0, 0.8], wood: [1.6, 0.7, 0, 0.8],
  facade: [6, 0.6, 0.1, 0.6], roof: [3, 0.95, 0, 0.5], metal: [2, 0.45, 0.6, 0.3],
  cardboard: [1.2, 0.9, 0, 0.3],
};

const cellRand = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h & 1023) / 1023; };

/** Um pixel: retorna [r,g,b, altura, rugosidade] (0..1). u,v em pixels de 0..255 */
function pixel(kind, x, y, a, b) {
  switch (kind) {
    case 'asphalt': {
      let v = 0.22 + (a - 0.5) * 0.08 + (b - 0.5) * 0.1;
      if (b > 0.72) v += 0.07;
      const wet = smoothstep(0.34, 0.24, a);
      v -= wet * 0.05;
      return [v, v, v * 1.02, 0.5 + (b - 0.5) * 0.8, 0.9 - wet * 0.6];
    }
    case 'sidewalk': {
      const seam = x % 128 < 2 || y % 128 < 2;
      if (seam) return [0.26, 0.26, 0.25, 0.1, 0.9];
      const t = 0.5 + (a - 0.5) * 0.12 + (b - 0.5) * 0.05 + cellRand(x >> 7, y >> 7) * 0.04;
      return [t, t * 0.98, t * 0.95, 0.6, 0.85];
    }
    case 'pavers': {
      const bw = 26, bh = 13, row = Math.floor(y / bh), off = (bw >> 1) * (row % 2);
      const col = Math.floor((x + off) / bw), ix = (x + off) % bw, iy = y % bh;
      if (ix < 2 || iy < 2) return [0.3, 0.29, 0.27, 0.15, 0.9];
      const r = cellRand(col, row), d = (0.5 - a) * 0.2 + (b - 0.5) * 0.1;
      return [0.52 - r * 0.1 - d, 0.48 - r * 0.08 - d, 0.44 - r * 0.06 - d, 0.7, 0.8];
    }
    case 'brick': {
      const bw = 28, bh = 9, row = Math.floor(y / bh), off = (bw >> 1) * (row % 2);
      const col = Math.floor((x + off) / bw), ix = (x + off) % bw, iy = y % bh;
      if (ix < 2 || iy < 2) { const m = 0.62 + (b - 0.5) * 0.1; return [m, m * 0.97, m * 0.92, 0.2, 0.95]; }
      const r = cellRand(col, row);
      let c = [0.52 - r * 0.14, 0.24 - r * 0.04, 0.17 - r * 0.02];
      if (r > 0.85) c = [0.3, 0.16, 0.12];
      const k = 1 - ((0.5 - a) * 0.3 + (b - 0.5) * 0.15);
      return [c[0] * k, c[1] * k, c[2] * k, 0.75 + (b - 0.5) * 0.2, 0.85];
    }
    case 'plaster': {
      const v = 0.82 + (a - 0.5) * 0.08 + (b - 0.5) * 0.05 - smoothstep(0.35, 0.15, a) * 0.05;
      return [v, v, v, 0.5 + (b - 0.5) * 0.4, 0.9];
    }
    case 'concrete': {
      const line = y % 154 < 2;
      const v = 0.6 + (a - 0.5) * 0.12 + (b - 0.5) * 0.07 - (line ? 0.12 : 0);
      return [v, v * 0.99, v * 0.97, line ? 0.3 : 0.55 + (b - 0.5) * 0.3, 0.85];
    }
    case 'corrugated': {
      const w = Math.sin((x / 16) * Math.PI * 2) * 0.5 + 0.5;
      let v = 0.55 + w * 0.12 + (a - 0.5) * 0.1;
      if (a < 0.25) { v -= 0.12; return [v * 1.1, v * 0.8, v * 0.6, w, 0.8]; }
      return [v, v, v, w, 0.55];
    }
    case 'tiles': {
      if (x % 64 < 2 || y % 64 < 2) return [0.35, 0.34, 0.32, 0.1, 0.8];
      const t = 0.72 + cellRand(x >> 6, y >> 6) * 0.05 + (a - 0.5) * 0.08;
      return [t, t * 0.98, t * 0.94, 0.8, 0.25 + (1 - a) * 0.15];
    }
    case 'wood': {
      const plank = Math.floor(y / 32), iy = y % 32;
      const g = Math.sin(x * 0.08 + a * 12 + plank * 3) * 0.5 + 0.5, r = cellRand(plank, (x + plank * 50) >> 7);
      const k = 1 - g * 0.15 - (b - 0.5) * 0.1;
      let c = [(0.45 - r * 0.12) * k, (0.31 - r * 0.09) * k, (0.19 - r * 0.06) * k];
      if (iy < 2) c = c.map((q) => q * 0.5);
      return [...c, iy < 2 ? 0.1 : 0.6 + g * 0.2, 0.7];
    }
    case 'facade': {
      const cx = x % 128, cy = y % 128;
      const win = cx > 40 && cx < 90 && cy > 30 && cy < 98, frame = cx > 36 && cx < 94 && cy > 26 && cy < 102;
      if (win) {
        const lit = cellRand((x >> 7) + 3, (y >> 7) + 7) > 0.8;
        return lit ? [0.35, 0.3, 0.2, 0.2, 0.2] : [0.06, 0.065, 0.07, 0.2, 0.1];
      }
      if (frame) return [0.25, 0.25, 0.25, 0.8, 0.6];
      const f = 0.66 + (a - 0.5) * 0.14;
      return [f, f * 0.96, f * 0.9, 0.5, 0.85];
    }
    case 'roof': { const v = 0.2 + (a - 0.5) * 0.06 + (b - 0.5) * 0.06; return [v, v, v, 0.5 + (b - 0.5) * 0.5, 0.95]; }
    case 'metal': { const v = 0.5 + (a - 0.5) * 0.12 + (b - 0.5) * 0.04; return [v, v, v * 1.02, 0.5, 0.4 + (1 - a) * 0.2]; }
    case 'cardboard': { const v = 0.55 + (a - 0.5) * 0.1 + (b - 0.5) * 0.05; return [v, v * 0.78, v * 0.52, 0.5, 0.9]; }
  }
  return [0.5, 0.5, 0.5, 0.5, 0.8];
}

function generate(kind) {
  const fbm = makeNoise(kind.length * 977 + kind.charCodeAt(0) * 31);
  const N = HI_RES.has(kind) ? SIZE * 2 : SIZE, k = N / SIZE;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; };
  const ca = mk(), ch = mk(), cr = mk();
  const ia = ca.getContext('2d').createImageData(N, N);
  const ih = ch.getContext('2d').createImageData(N, N);
  const ir = cr.getContext('2d').createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N;
      const a = fbm(u, v, 3, 4), b = fbm(u + 0.37, v + 0.71, 16, 3) * 0.75 + fbm(u + 0.11, v + 0.53, 64, 2) * 0.25;
      const p = pixel(kind, (x / k) | 0, (y / k) | 0, a, b);
      const i = (y * N + x) * 4;
      ia.data[i] = clamp(p[0], 0, 1) * 255; ia.data[i + 1] = clamp(p[1], 0, 1) * 255; ia.data[i + 2] = clamp(p[2], 0, 1) * 255; ia.data[i + 3] = 255;
      const h = clamp(p[3], 0, 1) * 255; ih.data[i] = ih.data[i + 1] = ih.data[i + 2] = h; ih.data[i + 3] = 255;
      const r = clamp(p[4] + (b - 0.5) * 0.1, 0.03, 1) * 255; ir.data[i] = ir.data[i + 1] = ir.data[i + 2] = r; ir.data[i + 3] = 255;
    }
  }
  ca.getContext('2d').putImageData(ia, 0, 0);
  ch.getContext('2d').putImageData(ih, 0, 0);
  cr.getContext('2d').putImageData(ir, 0, 0);
  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: tex(ca, true), bump: tex(ch, false), rough: tex(cr, false) };
}

const materials = {};
/** Material de um tipo com uma cor multiplicada. */
export function material(kind, tint = 0xffffff) {
  const key = kind + '_' + tint;
  if (materials[key]) return materials[key];
  const def = DEFS[kind] || DEFS.concrete;
  if (!cache[kind]) cache[kind] = generate(kind);
  const t = cache[kind];
  const m = new THREE.MeshStandardMaterial({
    color: tint, map: t.map, bumpMap: t.bump, bumpScale: def[3] * 1.5,
    roughnessMap: t.rough, roughness: 1, metalness: def[2],
  });
  m.userData.tile = def[0];
  materials[key] = m;
  return m;
}

export function plain(color, roughness = 0.8, metalness = 0) {
  const key = `p_${color}_${roughness}_${metalness}`;
  if (!materials[key]) materials[key] = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  return materials[key];
}
export function emissive(color, intensity = 3) {
  const key = `e_${color}_${intensity}`;
  if (!materials[key]) materials[key] = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity });
  return materials[key];
}

/**
 * Caixa com UVs em escala do mundo (a textura não estica): cada face usa
 * suas dimensões reais divididas pelo tamanho do "tile" do material.
 */
export function boxGeometry(sx, sy, sz, tile = 2) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  const uv = g.attributes.uv;
  // Ordem das faces: +x, -x, +y, -y, +z, -z (4 vértices cada)
  const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
    }
  }
  return g;
}
