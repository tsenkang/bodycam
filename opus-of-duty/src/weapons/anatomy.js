import * as THREE from 'three';

/**
 * Organic geometry for the first-person arms: a lofting kernel plus the body
 * parts built with it.
 *
 * The weapon kit (geometry.js) is hard-surface: chamfered boxes and lathes. A
 * hand built from those reads as a stack of blocks no matter how carefully it is
 * posed, because every silhouette edge is either dead straight or a perfect
 * circle. Everything here is a closed, smooth LOFT instead: a chain of
 * superellipse cross-sections interpolated with a Hermite spline, capped with
 * rounded domes, and optionally displaced by a function of (angle, t) for cloth
 * folds. One mesh, one smooth normal field, no seams between the parts of a
 * finger.
 *
 * Conventions match hands.js: build along -Z (distal), +Y dorsal.
 * Build-time only; nothing here runs per frame.
 */

/* -------------------------------------------------------------------------- */
/*  kernel                                                                    */
/* -------------------------------------------------------------------------- */

const FIELDS = ['x', 'y', 'z', 'w', 'wL', 'hT', 'hB', 'n', 'roll'];

/**
 * Cubic-Hermite interpolation of every numeric section field over `keys`, each
 * key carrying its own `t` in [0,1]. Tangents are finite differences over the
 * neighbours (Catmull-Rom on a non-uniform knot vector), so a list of four or
 * five sections gives a limb with no visible kinks at the keys.
 */
export function sectionAt(keys, t, out = {}) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const p = keys[i - 1] ?? a;
  const q = keys[i + 2] ?? b;
  const dt = b.t - a.t || 1;
  const u = Math.min(1, Math.max(0, (t - a.t) / dt));
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  for (const f of FIELDS) {
    const va = field(a, f);
    const vb = field(b, f);
    const vp = field(p, f);
    const vq = field(q, f);
    const ma = ((vb - vp) / Math.max(1e-6, b.t - p.t)) * dt;
    const mb = ((vq - va) / Math.max(1e-6, q.t - a.t)) * dt;
    out[f] = h00 * va + h10 * ma + h01 * vb + h11 * mb;
  }
  out.t = t;
  return out;
}

function field(s, f) {
  if (f === 'wL') return s.wL ?? s.w;
  if (f === 'hT') return s.hT ?? s.h ?? s.w;
  if (f === 'hB') return s.hB ?? s.h ?? s.w;
  if (f === 'n') return s.n ?? 2;
  if (f === 'x' || f === 'y' || f === 'roll') return s[f] ?? 0;
  return s[f];
}

/**
 * Loft a closed tube through `keys` (see sectionAt) and cap both ends.
 *
 *   w / wL      half-width on +X / -X
 *   hT / hB     half-height on +Y (dorsal) / -Y (palmar)
 *   n           superellipse exponent: 2 ellipse, >2 squarer, <2 pinched
 *   x, y        section centre
 *   roll        rotate the section about Z (radians)
 *
 * opts:
 *   rings        sections along the length
 *   seg          vertices round each section
 *   capStart     dome length at t=0 (0 = flat), extending away from t=1
 *   capEnd       dome length at t=1
 *   capRings     rings per dome
 *   disp(theta, t) -> radial multiplier offset (0 = none). Cloth folds.
 */
export function loft(keys, opts = {}) {
  const rings = opts.rings ?? 16;
  const seg = opts.seg ?? 20;
  const capRings = opts.capRings ?? 5;
  const disp = opts.disp ?? null;
  const pos = [];
  const ringStart = [];
  const s = {};
  const centres = [];

  const z0 = keys[0].z;
  const z1 = keys[keys.length - 1].z;
  const dir = Math.sign(z1 - z0) || -1;

  const pushRing = (sec, t, scale, dz) => {
    ringStart.push(pos.length / 3);
    const ex = 2 / sec.n;
    const cr = Math.cos(sec.roll);
    const sr = Math.sin(sec.roll);
    for (let j = 0; j < seg; j++) {
      const th = (j / seg) * Math.PI * 2;
      const c = Math.cos(th);
      const sn = Math.sin(th);
      let px = Math.sign(c) * Math.pow(Math.abs(c), ex) * (c >= 0 ? sec.w : sec.wL);
      let py = Math.sign(sn) * Math.pow(Math.abs(sn), ex) * (sn >= 0 ? sec.hT : sec.hB);
      if (disp) {
        const k = 1 + disp(th, t, sec);
        px *= k;
        py *= k;
      }
      const rx = px * cr - py * sr;
      const ry = px * sr + py * cr;
      pos.push(sec.x + rx * scale, sec.y + ry * scale, sec.z + dz);
    }
  };

  const secs = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const sec = sectionAt(keys, t, {});
    secs.push(sec);
  }

  // start cap (rings from pole outward, so the order is monotonic)
  const capS = opts.capStart ?? 0;
  const capE = opts.capEnd ?? 0;
  const startSec = secs[0];
  const endSec = secs[rings];
  const startPole = [startSec.x, startSec.y, startSec.z - dir * capS];
  const endPole = [endSec.x, endSec.y, endSec.z + dir * capE];
  if (capS > 0) {
    for (let k = capRings - 1; k >= 1; k--) {
      const a = (k / capRings) * Math.PI * 0.5;
      pushRing(startSec, 0, Math.cos(a), -dir * capS * Math.sin(a));
    }
  }
  const bodyFirst = ringStart.length;
  for (let i = 0; i <= rings; i++) pushRing(secs[i], i / rings, 1, 0);
  if (capE > 0) {
    for (let k = 1; k < capRings; k++) {
      const a = (k / capRings) * Math.PI * 0.5;
      pushRing(endSec, 1, Math.cos(a), dir * capE * Math.sin(a));
    }
  }
  void bodyFirst;
  void centres;

  const idx = [];
  const R = ringStart.length;
  for (let r = 0; r < R - 1; r++) {
    const a0 = ringStart[r];
    const b0 = ringStart[r + 1];
    for (let j = 0; j < seg; j++) {
      const j1 = (j + 1) % seg;
      idx.push(a0 + j, a0 + j1, b0 + j1, a0 + j, b0 + j1, b0 + j);
    }
  }
  // poles
  const sp = pos.length / 3;
  pos.push(...startPole);
  const ep = pos.length / 3;
  pos.push(...endPole);
  const f0 = ringStart[0];
  const fl = ringStart[R - 1];
  for (let j = 0; j < seg; j++) {
    const j1 = (j + 1) % seg;
    idx.push(sp, f0 + j1, f0 + j);
    idx.push(ep, fl + j, fl + j1);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  orientOutward(g);
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  return g;
}

/** Flip the winding if the signed volume says the faces point inward. */
export function orientOutward(g) {
  const p = g.getAttribute('position').array;
  const ix = g.getIndex().array;
  let vol = 0;
  for (let i = 0; i < ix.length; i += 3) {
    const a = ix[i] * 3;
    const b = ix[i + 1] * 3;
    const c = ix[i + 2] * 3;
    vol +=
      p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) -
      p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) +
      p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  if (vol < 0) {
    for (let i = 0; i < ix.length; i += 3) {
      const t = ix[i];
      ix[i] = ix[i + 2];
      ix[i + 2] = t;
    }
  }
  return g;
}

/** Deterministic hash noise in [-1,1], for per-fold jitter without an RNG. */
export function hash1(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/**
 * Cloth fold displacement for a sleeve.
 *
 * A real sleeve does not fold in rings. It bunches in OBLIQUE, PARTIAL ridges:
 * each one wraps 150-280 degrees of the limb, is tilted 10-25 degrees off
 * perpendicular, and dies out on the far side. Compression folds stack up where
 * the fabric is pushed (the wrist, over a glove cuff; the inside of the elbow),
 * and the long run between them only carries a couple of shallow drag lines.
 *
 * @param {object[]} folds  { t, amp, width, tilt, phase, arc } — t along the
 *                          limb, amp as a fraction of radius, arc in radians
 */
export function foldField(folds, lumpAmp = 0.012, lumpSeed = 1) {
  return (th, t) => {
    let d = 0;
    for (let i = 0; i < folds.length; i++) {
      const f = folds[i];
      const tc = f.t + f.tilt * Math.sin(th - f.phase);
      const x = (t - tc) / f.width;
      if (x > 3 || x < -3) continue;
      // arc window: 1 at the fold's middle, fading out over its ends
      let da = Math.abs(((th - f.phase + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const half = f.arc * 0.5;
      const win = da > half ? 0 : 0.5 + 0.5 * Math.cos((da / half) * Math.PI);
      // a ridge with a slightly sharper crest than a gaussian, and a trough ahead
      d += f.amp * win * (Math.exp(-x * x * 1.6) - 0.35 * Math.exp(-(x - 1.2) * (x - 1.2) * 2.2));
    }
    // low-frequency lumpiness so no stretch of fabric is a perfect cone
    d +=
      lumpAmp *
      (Math.sin(th * 2 + t * 9 + lumpSeed) * 0.6 +
        Math.sin(th * 3 - t * 14 + lumpSeed * 2.3) * 0.4 +
        Math.sin(th * 5 + t * 23 + lumpSeed * 4.1) * 0.25);
    return d;
  };
}

/** Generate a deterministic fold list. */
export function makeFolds(seed, specs) {
  const out = [];
  let k = 0;
  for (const s of specs) {
    for (let i = 0; i < s.count; i++, k++) {
      const h = (m) => hash1(seed * 13.7 + k * 7.31 + m);
      const t = s.from + ((i + 0.5 + h(1) * 0.3) / s.count) * (s.to - s.from);
      out.push({
        t,
        amp: s.amp * (0.7 + 0.3 * h(2)),
        width: s.width * (0.8 + 0.25 * h(3)),
        tilt: s.tilt * h(4),
        phase: (s.phase ?? 0) + h(5) * (s.phaseJitter ?? 1.2),
        arc: s.arc * (0.85 + 0.2 * h(6)),
      });
    }
  }
  return out;
}
