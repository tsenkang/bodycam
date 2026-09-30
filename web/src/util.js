// Utilitários matemáticos e de colisão.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** Suavização independente de FPS: aproxima a de b com "velocidade" rate. */
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const moveToward = (a, b, step) => (Math.abs(b - a) <= step ? b : a + Math.sign(b - a) * step);
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const DEG = Math.PI / 180;
export const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export function angleDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
export function rotateToward(a, b, step) { const d = angleDiff(a, b); return Math.abs(d) <= step ? b : a + Math.sign(d) * step; }

/**
 * Raio contra caixa alinhada (slab test). box = {minX,minY,minZ,maxX,maxY,maxZ}.
 * Retorna distância t (ou Infinity) e escreve a normal em out.n (array 3).
 */
export function rayBox(ox, oy, oz, dx, dy, dz, b, tMax, out) {
  let tmin = 0, tmax = tMax, axis = -1, sign = 0;
  // X
  if (Math.abs(dx) < 1e-9) { if (ox < b.minX || ox > b.maxX) return Infinity; }
  else {
    let t1 = (b.minX - ox) / dx, t2 = (b.maxX - ox) / dx, s = -1;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
    if (t1 > tmin) { tmin = t1; axis = 0; sign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  // Y
  if (Math.abs(dy) < 1e-9) { if (oy < b.minY || oy > b.maxY) return Infinity; }
  else {
    let t1 = (b.minY - oy) / dy, t2 = (b.maxY - oy) / dy, s = -1;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
    if (t1 > tmin) { tmin = t1; axis = 1; sign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  // Z
  if (Math.abs(dz) < 1e-9) { if (oz < b.minZ || oz > b.maxZ) return Infinity; }
  else {
    let t1 = (b.minZ - oz) / dz, t2 = (b.maxZ - oz) / dz, s = -1;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
    if (t1 > tmin) { tmin = t1; axis = 2; sign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  if (out) { out.n[0] = axis === 0 ? sign : 0; out.n[1] = axis === 1 ? sign : 0; out.n[2] = axis === 2 ? sign : 0; }
  return tmin;
}

/** Direção aleatória num cone (graus) em volta de dir (array 3 normalizado). */
export function spreadDir(dir, degrees) {
  if (degrees <= 0.001) return dir.slice();
  const ang = degrees * DEG * Math.sqrt(Math.random());
  const th = Math.random() * Math.PI * 2;
  // base ortonormal em volta de dir
  const up = Math.abs(dir[1]) < 0.98 ? [0, 1, 0] : [1, 0, 0];
  let rx = up[1] * dir[2] - up[2] * dir[1], ry = up[2] * dir[0] - up[0] * dir[2], rz = up[0] * dir[1] - up[1] * dir[0];
  const rl = Math.hypot(rx, ry, rz); rx /= rl; ry /= rl; rz /= rl;
  const ux = dir[1] * rz - dir[2] * ry, uy = dir[2] * rx - dir[0] * rz, uz = dir[0] * ry - dir[1] * rx;
  const s = Math.sin(ang), c = Math.cos(ang), cs = Math.cos(th) * s, sn = Math.sin(th) * s;
  const x = dir[0] * c + rx * cs + ux * sn, y = dir[1] * c + ry * cs + uy * sn, z = dir[2] * c + rz * cs + uz * sn;
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

/** Ruído de valor 2D periódico (para texturas procedurais). */
export function makeNoise(seed = 1) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const perm = new Float32Array(256 * 256);
  for (let i = 0; i < perm.length; i++) perm[i] = rnd();
  const sm = (t) => t * t * (3 - 2 * t);
  function value(x, y, period) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const p = period, g = (a, b) => perm[(((a % p) + p) % p) * 256 + (((b % p) + p) % p)];
    const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
    const u = sm(xf), v = sm(yf);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }
  /** fbm periódico: u,v em [0,1) */
  return function fbm(u, v, baseFreq = 4, octaves = 4) {
    let sum = 0, amp = 0.5, f = baseFreq, norm = 0;
    for (let o = 0; o < octaves; o++) { sum += amp * value(u * f, v * f, f); norm += amp; amp *= 0.5; f *= 2; }
    return sum / norm;
  };
}
