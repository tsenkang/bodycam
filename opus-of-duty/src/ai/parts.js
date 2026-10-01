/**
 * AI — body & clothing parts for the procedural soldier.
 *
 * Each function returns a mesh record in the actor's bind space (metres, feet
 * on y = 0, facing +Z, character's right at -X). `soldier.js` decides which
 * parts a variant wears and hands them to the CharacterBuilder along with the
 * bones they bind to.
 */

import * as THREE from 'three';
import {
  emptyMesh, loft, tube, ribbon, revolve, ellipsoid, boxRound, superEllipse,
  ellipseProfile, appendMesh, computeNormals, displace, warp, transformMesh, vcount,
} from './geo.js';

const V = (x, y, z) => [x, y, z];

/** Cylindrical wrap about the Y axis — bends flat slabs around the torso. */
export function bendY(mesh, radius, centreZ = 0) {
  return warp(mesh, (v) => {
    const r = radius + (v.z - centreZ);
    const a = v.x / radius;
    v.x = Math.sin(a) * r;
    v.z = centreZ + Math.cos(a) * r - radius;
  });
}

/** Mirror across X (right <-> left) and fix the winding. */
export function mirrorX(mesh) {
  const out = { p: mesh.p.slice(), n: mesh.n.slice(), uv: mesh.uv.slice(), i: mesh.i.slice() };
  for (let i = 0; i < out.p.length; i += 3) out.p[i] = -out.p[i];
  for (let i = 0; i < out.n.length; i += 3) out.n[i] = -out.n[i];
  for (let t = 0; t < out.i.length; t += 3) {
    const tmp = out.i[t + 1];
    out.i[t + 1] = out.i[t + 2];
    out.i[t + 2] = tmp;
  }
  return out;
}

export function place(mesh, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
    new THREE.Vector3(sx, sy, sz)
  );
  computeNormals(mesh);
  return transformMesh(mesh, m);
}

/* ================================================================== */
/* Torso                                                              */
/* ================================================================== */

/**
 * The jacket shell: lofted horizontal sections from the hem to the neck with a
 * real spinal curve, a deeper chest than back, and layered fold noise. This is
 * the silhouette everything else hangs on.
 */
export function jacketTorso(nz, p = {}) {
  const flare = p.flare ?? 1;
  const bulk = p.bulk ?? 1;
  // y, half-width, half-depth, z offset, corner exponent
  const S = [
    [0.865, 0.150 * flare, 0.107 * flare, -0.004, 3.0],
    [0.925, 0.156, 0.110, -0.008, 3.0],
    [0.985, 0.152, 0.105, -0.012, 3.1],
    [1.055, 0.146, 0.100, -0.014, 3.2],
    [1.120, 0.150, 0.104, -0.010, 3.2],
    [1.185, 0.161, 0.112, -0.004, 3.1],
    [1.250, 0.172 * bulk, 0.113 * bulk, 0.002, 3.0],
    [1.310, 0.184 * bulk, 0.117 * bulk, 0.005, 2.9],
    [1.365, 0.195 * bulk, 0.118 * bulk, 0.004, 2.8],
    [1.418, 0.198, 0.111, -0.002, 2.7],
    [1.452, 0.152, 0.096, -0.008, 2.6],
    [1.482, 0.098, 0.080, -0.010, 2.4],
    [1.505, 0.070, 0.066, -0.010, 2.3],
  ];
  const seg = 26;
  const rings = S.map(([y, hx, hz, zo, n]) => ({
    pts: superEllipse(hx, hz, n, seg),
    o: [0, y, zo],
  }));
  const m = loft(rings, { capStart: true, capEnd: false });
  computeNormals(m);

  // chest deeper at the front than the back, shoulders squared off
  warp(m, (v) => {
    const t = Math.max(0, Math.min(1, (v.y - 1.1) / 0.3));
    if (v.z > 0) v.z += 0.016 * t;
    else v.z -= 0.006 * t;
    // trapezius slope
    if (v.y > 1.40) v.y -= 0.02 * Math.min(1, Math.abs(v.x) / 0.18) ** 2;
  });
  computeNormals(m);

  // cloth folds: horizontal creases at the waist, vertical pull from the plate
  displace(m, (x, y, z, nx, ny, nz2) => {
    const fold = nz.fbm3(x * 22, y * 15, z * 22, 3);
    const crease = Math.sin(y * 38 + fold * 3.4) * 0.5 + 0.5;
    const waist = Math.exp(-((y - 1.06) ** 2) / 0.006);
    const gather = Math.exp(-((y - 0.93) ** 2) / 0.004);
    return (
      fold * 0.0026 +
      crease * (waist * 0.0022 + gather * 0.0018) +
      nz.fbm3(x * 46, y * 46, z * 46, 2) * 0.0007
    );
  });
  return m;
}

/** Pelvis / seat block so the hips read solid between jacket hem and trousers. */
export function pelvis(nz) {
  const seg = 22;
  const rings = [
    [0.845, 0.140, 0.100],
    [0.885, 0.148, 0.106],
    [0.935, 0.152, 0.108],
    [0.985, 0.150, 0.104],
    [1.030, 0.144, 0.098],
  ].map(([y, hx, hz]) => ({ pts: superEllipse(hx, hz, 3.0, seg), o: [0, y, -0.006] }));
  const m = loft(rings, { capStart: true, capEnd: true });
  computeNormals(m);
  displace(m, (x, y, z) => nz.fbm3(x * 26, y * 20, z * 26, 3) * 0.004);
  return m;
}

/** Collar: a short stand-up band around the neck. */
export function collar(nz) {
  const seg = 22;
  const rings = [
    [1.435, 0.108, 0.092],
    [1.470, 0.090, 0.082],
    [1.500, 0.082, 0.076],
    [1.516, 0.086, 0.080],
  ].map(([y, hx, hz]) => ({ pts: superEllipse(hx, hz, 2.6, seg), o: [0, y, -0.006] }));
  const m = loft(rings, { capStart: false, capEnd: true });
  computeNormals(m);
  displace(m, (x, y, z) => nz.fbm3(x * 40, y * 30, z * 40, 2) * 0.003);
  return m;
}

/* ================================================================== */
/* Limbs                                                              */
/* ================================================================== */

/**
 * Sleeve / trouser leg: a tube down a 3-point bone chain with an elliptical
 * cross-section that is wider than deep, plus fold noise at the joints.
 *
 * CLOTH FOLDS (`opts.crease`) — isotropic fbm on a tube gives a lumpy tube, not
 * cloth. Real sleeves and trousers crease in bands that run *around* the limb,
 * they bunch where the limb bends, and they gather at the cuff where the fabric
 * is stopped by a hem. So the crease field is parameterised by arc length `s`
 * down the bone chain, not by world position:
 *
 *   - transverse bands at 5-7 cm, ridged so each one is a sharp line with a soft
 *     valley either side (that is what a pressed crease looks like in light);
 *   - a x2.4 gather inside the elbow / behind the knee (`s` near the joint, on
 *     the bend side), which is the single most legible fold on a walking figure;
 *   - a x1.8 gather at the cuff, where the fabric stacks on the boot or glove.
 *
 * `opts.bend` is the direction the joint folds toward in bind space (default
 * -Z, i.e. behind the knee / inside the elbow for a figure facing +Z).
 */
export function limbTube(nz, a, b, c, radii, opts = {}) {
  const pts = [];
  const N = opts.rings ?? 11;
  const segs = opts.seg ?? 14;
  // sample the two-segment path with a smooth blend around the joint
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), C = new THREE.Vector3(...c);
  const tmp = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    if (t <= 0.5) tmp.lerpVectors(A, B, t * 2);
    else tmp.lerpVectors(B, C, (t - 0.5) * 2);
    // round the corner slightly so the knee/elbow is not a crease
    if (t > 0.34 && t < 0.66) {
      const k = 1 - Math.abs(t - 0.5) / 0.16;
      tmp.lerp(new THREE.Vector3().addVectors(A, C).multiplyScalar(0.5), 0.06 * k);
    }
    pts.push([tmp.x, tmp.y, tmp.z]);
  }
  const flat = opts.flat ?? 0.88;
  const m = tube(
    pts,
    (t) => {
      const r = radiusAt(radii, t);
      return ellipseProfile(r, r * flat, segs);
    },
    { capStart: opts.capStart ?? false, capEnd: opts.capEnd ?? false, up: opts.up ?? [0, 0, 1] }
  );
  computeNormals(m);
  const amp = opts.fold ?? 0.0016;
  const crease = opts.crease ?? 0;
  if (crease > 0) {
    // arc-length parameterisation of the two-segment chain
    const AB = new THREE.Vector3().subVectors(B, A);
    const BC = new THREE.Vector3().subVectors(C, B);
    const lAB = AB.length(), lBC = BC.length();
    const uAB = AB.clone().divideScalar(Math.max(1e-5, lAB));
    const uBC = BC.clone().divideScalar(Math.max(1e-5, lBC));
    const total = lAB + lBC;
    const bend = new THREE.Vector3(...(opts.bend ?? [0, 0, -1])).normalize();
    const q = new THREE.Vector3();
    displace(m, (x, y, z, nx, ny, nzc) => {
      // distance along the chain, and how far out along the bend axis we are
      const tAB = Math.max(0, Math.min(lAB, q.set(x, y, z).sub(A).dot(uAB)));
      const tBC = Math.max(0, Math.min(lBC, q.set(x, y, z).sub(B).dot(uBC)));
      const s = tAB < lAB - 1e-4 ? tAB : lAB + tBC;
      const u = s / total;
      // transverse crease bands: ridged, 5.5 cm, jittered so they are not a
      // corduroy ripple
      const jit = nz.fbm3(x * 6, y * 5, z * 6, 2) - 0.5;
      const band = Math.abs(Math.sin((s / 0.055 + jit * 0.9) * Math.PI));
      const ridged = 1 - band ** 0.65;
      // where the cloth actually bunches
      const joint = Math.exp(-((u - 0.5) ** 2) / 0.012);
      const cuff = Math.exp(-((u - 0.94) ** 2) / 0.004);
      const inner = Math.max(0, bend.x * nx + bend.y * ny + bend.z * nzc);
      const gather = 1 + joint * (0.6 + 1.8 * inner) + cuff * 0.8;
      // broad fold field on top, so the limb is never a clean cylinder
      const broad = nz.fbm3(x * 9, y * 7 + u * 3.1, z * 9, 3) - 0.5;
      return crease * (ridged * gather * 0.9 + broad * 1.1);
    });
    computeNormals(m);
  }
  displace(m, (x, y, z) => {
    const f = nz.fbm3(x * 11, y * 9, z * 11, 3);
    const fine = nz.fbm3(x * 34, y * 30, z * 34, 2);
    return f * amp + fine * amp * 0.3;
  });
  return m;
}

function radiusAt(radii, t) {
  const n = radii.length - 1;
  const s = t * n;
  const i = Math.min(n - 1, Math.floor(s));
  const f = s - i;
  return radii[i] + (radii[i + 1] - radii[i]) * f;
}

/** Deltoid cap so the shoulder is round rather than a tube end. */
export function shoulderCap(nz, shoulder, side) {
  const m = ellipsoid(0.047, 0.058, 0.052, { seg: 18, rows: 12 });
  computeNormals(m);
  warp(m, (v) => {
    v.y *= 1.0;
    if (v.y < 0) v.x *= 0.9;
  });
  place(m, shoulder[0] + side * 0.012, shoulder[1] - 0.008, shoulder[2], 0, 0, -side * 0.12);
  displace(m, (x, y, z) => nz.fbm3(x * 30, y * 30, z * 30, 3) * 0.004);
  return m;
}

/* ================================================================== */
/* Head                                                              */
/* ================================================================== */

/** Skull + jaw, lofted from anatomical sections. `base` = Head bone position. */
export function headMesh(nz, base, p = {}) {
  const w = p.wide ?? 1;
  const S = [
    [0.000, 0.038 * w, 0.050, 0.020, 2.6],
    [0.020, 0.056 * w, 0.068, 0.014, 2.6],
    [0.044, 0.068 * w, 0.076, 0.007, 2.5],
    [0.070, 0.077 * w, 0.083, 0.001, 2.4],
    [0.095, 0.084 * w, 0.088, -0.002, 2.4],
    [0.119, 0.086 * w, 0.090, -0.005, 2.4],
    [0.146, 0.083 * w, 0.089, -0.009, 2.4],
    [0.176, 0.076 * w, 0.082, -0.012, 2.4],
    [0.205, 0.062 * w, 0.066, -0.014, 2.4],
    [0.230, 0.038 * w, 0.041, -0.014, 2.4],
    [0.244, 0.012 * w, 0.013, -0.014, 2.4],
  ];
  const seg = 24;
  const rings = S.map(([y, hx, hz, zo, n]) => ({
    pts: superEllipse(hx, hz, n, seg),
    o: [base[0], base[1] + y, base[2] + zo],
  }));
  const m = loft(rings, { capStart: true, capEnd: false });
  computeNormals(m);

  const bx = base[0], by = base[1], bz = base[2];
  // features, all in head-local coordinates
  warp(m, (v) => {
    const x = v.x - bx, y = v.y - by, z = v.z - bz;
    const front = Math.max(0, z / 0.09);
    // brow ridge
    const brow = Math.exp(-((y - 0.113) ** 2) / 0.00016) * front * Math.exp(-(x * x) / 0.006);
    // eye sockets
    const socket =
      Math.exp(-((Math.abs(x) - 0.033) ** 2) / 0.00035) *
      Math.exp(-((y - 0.098) ** 2) / 0.00022) * front;
    // cheekbone
    const cheek =
      Math.exp(-((Math.abs(x) - 0.055) ** 2) / 0.0009) *
      Math.exp(-((y - 0.070) ** 2) / 0.0007) * Math.max(0, z / 0.06);
    // temple flattening
    const temple = Math.exp(-((y - 0.150) ** 2) / 0.0016) * Math.exp(-((Math.abs(x) - 0.082) ** 2) / 0.0006);
    // chin
    const chin = Math.exp(-(y * y) / 0.00035) * front;
    // occiput
    const occ = Math.exp(-((y - 0.165) ** 2) / 0.0018) * Math.max(0, -z / 0.09);
    const scale = 1 + 0.05 * brow - 0.10 * socket + 0.05 * cheek - 0.06 * temple;
    v.x = bx + x * (1 - 0.05 * socket - 0.05 * temple);
    v.y = by + y;
    v.z = bz + z * scale + 0.006 * brow + 0.004 * chin + 0.008 * occ * -1;
  });
  computeNormals(m);
  displace(m, (x, y, z) => nz.fbm3(x * 70, y * 70, z * 70, 3) * 0.0012);
  return m;
}

/** Nose wedge + nostrils. */
export function nose(nz, base) {
  const bx = base[0], by = base[1], bz = base[2];
  const S = [
    [0.118, 0.075, 0.009, 0.010],
    [0.104, 0.084, 0.011, 0.016],
    [0.088, 0.093, 0.014, 0.020],
    [0.074, 0.100, 0.017, 0.021],
    [0.064, 0.100, 0.020, 0.018],
    [0.058, 0.092, 0.019, 0.012],
  ];
  const rings = S.map(([y, z, hx, hz]) => ({
    pts: superEllipse(hx, hz, 2.2, 12),
    o: [bx, by + y, bz + z],
  }));
  const m = loft(rings, { capStart: false, capEnd: true });
  computeNormals(m);
  return m;
}

/** Ear: a folded flattened ellipsoid. */
export function ear(nz, base, side) {
  const m = ellipsoid(0.010, 0.030, 0.020, { seg: 12, rows: 9 });
  computeNormals(m);
  warp(m, (v) => {
    v.z += v.y * 0.25;
    v.x += Math.abs(v.y) * 0.10;
  });
  place(m, base[0] + side * 0.083, base[1] + 0.098, base[2] - 0.008, 0.1, side * 0.25, 0);
  return m;
}

/** Eyeball: a small dark glossy sphere set into the socket. */
export function eyeball(base, side) {
  const m = ellipsoid(0.0125, 0.0125, 0.0125, { seg: 12, rows: 8 });
  computeNormals(m);
  place(m, base[0] + side * 0.032, base[1] + 0.0975, base[2] + 0.0665);
  return m;
}

/**
 * Balaclava / shemagh wrap over the lower face and neck.
 *
 * The wrap is not just a dome: the thing that makes a covered face read as a
 * FACE at 35 m is the hem seam along the eye line plus the bridge fold over the
 * nose. Without them the lower head is one smooth value and the figure has no
 * legible facing direction — which is exactly the "featureless void" note. Both
 * are built as geometry (a rolled hem ribbon and a centre-front seam) so they
 * survive to whatever mip the diffuse ends up at.
 */
export function faceWrap(nz, base, p = {}) {
  const bx = base[0], by = base[1], bz = base[2];
  const S = [
    [-0.075, 0.062, 0.062, -0.010, 2.6],
    [-0.040, 0.070, 0.072, -0.006, 2.6],
    [-0.010, 0.080, 0.084, 0.004, 2.5],
    [0.014, 0.070, 0.082, 0.014, 2.5],
    [0.038, 0.078, 0.086, 0.008, 2.5],
    [0.060, 0.086, 0.092, 0.002, 2.4],
    [0.076, 0.090, 0.094, -0.002, 2.4],
    [0.086, 0.090, 0.093, -0.006, 2.4],
  ];
  const seg = 22;
  const rings = S.map(([y, hx, hz, zo, n]) => ({
    pts: superEllipse(hx, hz, n, seg),
    o: [bx, by + y, bz + zo],
  }));
  const m = loft(rings, { capStart: false, capEnd: false });
  computeNormals(m);
  // cut the front open above the eye line by pulling the top ring back
  displace(m, (x, y, z) => {
    const fold = nz.fbm3(x * 30, y * 24, z * 30, 3);
    const wrap = Math.sin(y * 90 + fold * 4) * 0.5 + 0.5;
    return fold * 0.005 + wrap * 0.0035;
  });

  const out = emptyMesh();
  appendMesh(out, m);

  // --- rolled hem along the eye line -----------------------------------
  // A wrap's top edge is a doubled-over hem: 8 mm of roll that catches the key
  // light and draws the horizontal line under the eyes.
  const hem = [];
  const nHem = 26;
  for (let i = 0; i <= nHem; i++) {
    const a = (i / nHem) * Math.PI * 2;
    const sx = Math.sin(a), sz = Math.cos(a);
    // the hem rides higher over the cheeks and dips at the bridge of the nose
    const y = 0.086 + Math.max(0, sz) * 0.006 - Math.exp(-(sx * sx) / 0.06) * Math.max(0, sz) * 0.010;
    hem.push([bx + sx * 0.092, by + y, bz + sz * 0.096 - 0.004]);
  }
  const roll = ribbon(hem, 0.015, 0.008, { seg: 6, up: [0, 1, 0], upright: true });
  computeNormals(roll);
  appendMesh(out, roll);

  // --- centre-front seam from the chin to the hem ------------------------
  const seam = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    seam.push([bx, by + 0.082 - t * 0.086, bz + 0.088 - t * 0.020]);
  }
  const sm = ribbon(seam, 0.009, 0.004, { seg: 5, up: [1, 0, 0] });
  computeNormals(sm);
  appendMesh(out, sm);

  // --- bridge fold over the nose ----------------------------------------
  const bridge = ribbon(
    [
      [bx - 0.042, by + 0.070, bz + 0.070],
      [bx, by + 0.078, bz + 0.092],
      [bx + 0.042, by + 0.070, bz + 0.070],
    ],
    0.013,
    0.005,
    { seg: 6, up: [0, 1, 0] }
  );
  computeNormals(bridge);
  appendMesh(out, bridge);

  computeNormals(out);
  return out;
}

/**
 * Wrap-around dark shooting glasses for the un-helmeted fighter: a curved lens
 * plus two thin temples. This is the whole of variant #2's facing cue — a dark
 * horizontal band at the eye line, which is the one feature that survives to
 * 35 m on a bare head.
 */
export function sunglasses(base) {
  const bx = base[0], by = base[1], bz = base[2];
  const lens = boxRound(0.072, 0.0155, 0.006, { n: 3.0, seg: 18, rows: 5, roundY: 0.6 });
  place(lens, bx, by + 0.100, bz + 0.080, -0.06, 0, 0);
  bendY(lens, 0.098, 0);
  computeNormals(lens);
  const frame = emptyMesh();
  for (const side of [-1, 1]) {
    const arm = ribbon(
      [
        [bx + side * 0.070, by + 0.104, bz + 0.062],
        [bx + side * 0.083, by + 0.104, bz + 0.010],
        [bx + side * 0.080, by + 0.100, bz - 0.030],
      ],
      0.008,
      0.004,
      { seg: 5, up: [0, 1, 0], upright: true }
    );
    computeNormals(arm);
    appendMesh(frame, arm);
  }
  computeNormals(frame);
  return { lens, frame };
}

/* ================================================================== */
/* Helmet                                                             */
/* ================================================================== */

/**
 * High-cut ballistic helmet with a scalloped ear cut, a brim lip, side rails
 * and an NVG shroud. `base` is the Head bone position.
 */
export function helmet(nz, base, p = {}) {
  const out = emptyMesh();
  const bx = base[0], by = base[1], bz = base[2];
  const cy = by + 0.100; // shell centre (just above the brow)
  const rx = 0.121, ry = 0.158, rz = 0.135;

  // --- shell: revolved dome, bottom edge scalloped per angle
  const seg = 26, rows = 12;
  const rings = [];
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    // t 0 = brim, 1 = crown
    const phi = (0.5 + 0.5 * t) * Math.PI; // 90..180 deg
    const y = -Math.cos(phi) * ry;
    const s = Math.sin(phi);
    const pts = ellipseProfile(rx * Math.max(0.08, s), rz * Math.max(0.08, s), seg);
    rings.push({ pts, o: [bx, cy + y, bz - 0.006], t });
  }
  const shell = loft(rings, { capStart: false, capEnd: false });
  computeNormals(shell);
  // scallop: raise the rim over the ears, drop it at the front and back
  warp(shell, (v) => {
    const dy = v.y - cy;
    if (dy > 0.012) return;
    const ang = Math.atan2(v.x - bx, v.z - bz);
    const side = Math.abs(Math.sin(ang));
    const lift = side ** 2 * 0.042 - Math.max(0, Math.cos(ang)) * 0.010;
    const k = Math.min(1, Math.max(0, (0.012 - dy) / 0.06));
    v.y += lift * k;
  });
  computeNormals(shell);
  displace(shell, (x, y, z) => nz.fbm3(x * 40, y * 40, z * 40, 3) * 0.0016);
  appendMesh(out, shell);

  // --- brim lip: a thin band following the rim
  const lipPts = [];
  const nLip = 30;
  for (let i = 0; i <= nLip; i++) {
    const a = (i / nLip) * Math.PI * 2;
    const sx = Math.sin(a), sz = Math.cos(a);
    const side = Math.abs(sx);
    const lift = side ** 2 * 0.042 - Math.max(0, sz) * 0.010;
    lipPts.push([bx + sx * rx * 0.955, cy + lift - 0.001, bz - 0.004 + sz * rz * 0.955]);
  }
  const lip = ribbon(lipPts, 0.011, 0.006, { seg: 6, up: [0, 1, 0], upright: true });
  computeNormals(lip);
  appendMesh(out, lip);

  return out;
}

/** Side rails, NVG shroud and rear counterweight pouch — the helmet hardware. */
export function helmetHardware(nz, base) {
  const out = emptyMesh();
  const bx = base[0], by = base[1], bz = base[2];
  const cy = by + 0.100;

  // NVG shroud on the brow
  const shroud = boxRound(0.030, 0.012, 0.022, { n: 4, seg: 12, rows: 5, roundY: 0.5 });
  place(shroud, bx, cy + 0.062, bz + 0.120, -0.50, 0, 0);
  appendMesh(out, shroud);
  const lug = boxRound(0.009, 0.016, 0.007, { n: 4, seg: 8, rows: 4, roundY: 0.4 });
  place(lug, bx, cy + 0.086, bz + 0.126, -0.50, 0, 0);
  appendMesh(out, lug);

  // ARC rails: a slotted strip down each side
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      const a = (-0.55 + t * 1.1) * side;
      pts.push([
        bx + side * 0.114 * Math.cos(a * 0.6),
        cy + 0.052 + Math.sin(t * Math.PI) * 0.016,
        bz - 0.004 + Math.sin(a) * 0.118,
      ]);
    }
    const rail = ribbon(pts, 0.016, 0.009, { seg: 6, up: [0, 1, 0], upright: true });
    computeNormals(rail);
    appendMesh(out, rail);
  }

  // rear counterweight pouch
  const cw = boxRound(0.058, 0.034, 0.026, { n: 4, seg: 14, rows: 6, roundY: 0.5 });
  place(cw, bx, cy + 0.075, bz - 0.128, 0.28, 0, 0);
  computeNormals(cw);
  displace(cw, (x, y, z) => nz.fbm3(x * 40, y * 40, z * 40, 2) * 0.002);
  appendMesh(out, cw);
  return out;
}

/** Chin strap + nape pad. */
export function chinStrap(base) {
  const out = emptyMesh();
  const bx = base[0], by = base[1], bz = base[2];
  const cy = by + 0.100;
  for (const side of [-1, 1]) {
    const pts = [
      [bx + side * 0.104, cy + 0.004, bz + 0.036],
      [bx + side * 0.086, cy - 0.058, bz + 0.056],
      [bx + side * 0.048, cy - 0.104, bz + 0.062],
      [bx + side * 0.014, cy - 0.118, bz + 0.054],
    ];
    const s = ribbon(pts, 0.016, 0.005, { seg: 6, up: [0, 0, 1] });
    computeNormals(s);
    appendMesh(out, s);
    const rear = [
      [bx + side * 0.106, cy + 0.000, bz - 0.024],
      [bx + side * 0.090, cy - 0.058, bz - 0.058],
      [bx + side * 0.040, cy - 0.078, bz - 0.082],
    ];
    const r = ribbon(rear, 0.014, 0.005, { seg: 6, up: [0, 1, 0] });
    computeNormals(r);
    appendMesh(out, r);
  }
  return out;
}

/** Goggles: pushed up on the shell, or pulled down over the eyes. */
export function goggles(base, down = false) {
  if (down) return gogglesDown(base);
  const frame = boxRound(0.082, 0.026, 0.024, { n: 3.2, seg: 20, rows: 6, roundY: 0.5 });
  const bx = base[0], by = base[1], bz = base[2];
  place(frame, bx, by + 0.176, bz + 0.098, -0.95, 0, 0);
  bendY(frame, 0.15, 0);
  computeNormals(frame);
  const strap = ribbon(
    [
      [bx - 0.098, by + 0.176, bz + 0.078],
      [bx - 0.118, by + 0.198, bz - 0.020],
      [bx - 0.072, by + 0.226, bz - 0.116],
      [bx + 0.072, by + 0.226, bz - 0.116],
      [bx + 0.118, by + 0.198, bz - 0.020],
      [bx + 0.098, by + 0.176, bz + 0.078],
    ],
    0.024,
    0.007,
    { seg: 6, up: [0, 1, 0], upright: true }
  );
  computeNormals(strap);
  return { frame, strap };
}

function gogglesDown(base) {
  const bx = base[0], by = base[1], bz = base[2];
  const frame = boxRound(0.078, 0.028, 0.026, { n: 3.2, seg: 20, rows: 6, roundY: 0.5 });
  place(frame, bx, by + 0.098, bz + 0.072, -0.10, 0, 0);
  bendY(frame, 0.115, 0);
  computeNormals(frame);
  const strap = ribbon(
    [
      [bx - 0.084, by + 0.100, bz + 0.058],
      [bx - 0.106, by + 0.108, bz - 0.030],
      [bx - 0.062, by + 0.116, bz - 0.108],
      [bx + 0.062, by + 0.116, bz - 0.108],
      [bx + 0.106, by + 0.108, bz - 0.030],
      [bx + 0.084, by + 0.100, bz + 0.058],
    ],
    0.026,
    0.008,
    { seg: 6, up: [0, 1, 0], upright: true }
  );
  computeNormals(strap);
  return { frame, strap, down: true };
}

/** Goggle lens — a curved slab of smoked glass. */
export function goggleLens(base, down = false) {
  if (down) {
    const bx = base[0], by = base[1], bz = base[2];
    const lens = boxRound(0.071, 0.020, 0.008, { n: 3.0, seg: 18, rows: 5, roundY: 0.6 });
    place(lens, bx, by + 0.098, bz + 0.090, -0.10, 0, 0);
    bendY(lens, 0.105, 0);
    computeNormals(lens);
    return lens;
  }
  const lens = boxRound(0.074, 0.019, 0.008, { n: 3.0, seg: 18, rows: 5, roundY: 0.6 });
  const bx = base[0], by = base[1], bz = base[2];
  place(lens, bx, by + 0.176, bz + 0.115, -0.95, 0, 0);
  bendY(lens, 0.14, 0);
  computeNormals(lens);
  return lens;
}

/**
 * Wrapped head scarf for the un-helmeted variant: a skull-hugging dome with a
 * rolled brim and a tail hanging off the back, so the silhouette reads as a
 * fighter in a shemagh rather than a bald mannequin.
 */
export function headScarf(nz, base) {
  const out = emptyMesh();
  const bx = base[0], by = base[1], bz = base[2];
  // The skull crown sits at +0.244 in head-local space, so the dome has to reach
  // +0.250 or the bare scalp pokes through the top of the wrap — which is exactly
  // what it looked like: a pink patch on the crown at every distance.
  const dome = ellipsoid(0.102, 0.146, 0.112, { seg: 22, rows: 12, v0: 0.34, v1: 1 });
  computeNormals(dome);
  place(dome, bx, by + 0.104, bz - 0.008);
  displace(dome, (x, y, z) => {
    const f = nz.fbm3(x * 26, y * 22, z * 26, 3);
    return f * 0.006 + Math.sin(y * 70 + f * 4) * 0.0022;
  });
  appendMesh(out, dome);
  // rolled brim
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    pts.push([bx + Math.sin(a) * 0.099, by + 0.118 - Math.max(0, Math.cos(a)) * 0.012, bz - 0.008 + Math.cos(a) * 0.109]);
  }
  const brim = ribbon(pts, 0.030, 0.016, { seg: 7, up: [0, 1, 0], upright: true });
  computeNormals(brim);
  appendMesh(out, brim);
  // tail down the back
  const tail = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    tail.push([
      bx + 0.028 * t,
      by + 0.115 - t * 0.20,
      bz - 0.085 - Math.sin(t * 2.2) * 0.03,
    ]);
  }
  const tl = tube(tail, (t) => superEllipse(0.052 - t * 0.012, 0.020 + t * 0.006, 3, 12), {
    capStart: false,
    capEnd: true,
  });
  computeNormals(tl);
  displace(tl, (x, y, z) => nz.fbm3(x * 30, y * 26, z * 30, 3) * 0.006);
  appendMesh(out, tl);
  return out;
}

/* ================================================================== */
/* Load-bearing gear                                                  */
/* ================================================================== */

/** One plate: a curved slab with a soft edge. */
function plate(hx, hy, hz, y, z, tilt, radius) {
  const m = boxRound(hx, hy, hz, { n: 3.6, seg: 22, rows: 11, roundY: 0.24 });
  // taper: a real plate narrows toward the waist and wraps in at the bottom
  warp(m, (v) => {
    const t = Math.max(0, -v.y / hy);
    v.x *= 1 - 0.20 * t * t;
    v.z *= 1 - 0.35 * t * t;
  });
  computeNormals(m);
  place(m, 0, y, z, tilt, 0, 0);
  bendY(m, radius, z);
  computeNormals(m);
  return m;
}

/** A pouch: rounded box with a lid, a pull tab and compression stitching. */
export function pouch(nz, o) {
  const out = emptyMesh();
  const hx = o.hx ?? 0.038, hy = o.hy ?? 0.055, hz = o.hz ?? 0.030;
  const body = boxRound(hx, hy, hz, { n: 5.5, seg: 18, rows: 8, roundY: 0.18 });
  computeNormals(body);
  displace(body, (x, y, z) => nz.fbm3(x * 40, y * 40, z * 40, 3) * 0.0022);
  appendMesh(out, body);
  // lid
  const lid = boxRound(hx * 1.03, 0.010, hz * 0.98, { n: 5.5, seg: 18, rows: 4, roundY: 0.5 });
  place(lid, 0, hy - 0.004, (o.lidTilt ? hz * 0.35 : 0) + hz * 0.10, (o.lidTilt ?? 0) - 0.18, 0, 0);
  computeNormals(lid);
  appendMesh(out, lid);
  // pull tab
  const tab = ribbon(
    [
      [0, hy + 0.004, hz * 0.7],
      [0, hy - 0.010, hz * 1.16],
      [0, hy - 0.034, hz * 1.10],
    ],
    0.014,
    0.004,
    { seg: 5, up: [1, 0, 0] }
  );
  computeNormals(tab);
  appendMesh(out, tab);
  place(out, o.x ?? 0, o.y ?? 0, o.z ?? 0, o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
  if (o.bend) bendY(out, o.bend, o.z ?? 0);
  computeNormals(out);
  return out;
}

/** Plate carrier: front & back plates, cummerbund, shoulder straps, buckles. */
export function plateCarrier(nz, p = {}) {
  const out = emptyMesh();
  // 38 / 34 mm, not 30 / 26: MW-era carriers are BULKY, and torso mass is the
  // first thing that reads at 15 m (refs: MW2019 TDM)
  const front = plate(0.156, 0.142, 0.038, 1.298, 0.130, -0.05, 0.20);
  displace(front, (x, y, z) => nz.fbm3(x * 34, y * 34, z * 34, 3) * 0.0026);
  appendMesh(out, front);
  const back = plate(0.158, 0.150, 0.034, 1.300, -0.120, 0.05, 0.21);
  displace(back, (x, y, z) => nz.fbm3(x * 34, y * 34, z * 34, 3) * 0.0026);
  appendMesh(out, back);

  // cummerbund wrapping the waist
  const cb = [];
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    cb.push([Math.sin(a) * 0.168, 1.152 + Math.cos(a * 2) * 0.005, Math.cos(a) * 0.121 - 0.004]);
  }
  const band = ribbon(cb, 0.100, 0.022, { seg: 8, up: [0, 1, 0], upright: true });
  computeNormals(band);
  displace(band, (x, y, z) => nz.fbm3(x * 34, y * 34, z * 34, 3) * 0.002);
  appendMesh(out, band);

  // shoulder straps
  for (const side of [-1, 1]) {
    const pts = [
      [side * 0.082, 1.418, 0.144],
      [side * 0.100, 1.468, 0.040],
      [side * 0.104, 1.462, -0.036],
      [side * 0.092, 1.418, -0.120],
    ];
    const s = ribbon(pts, 0.076, 0.030, { seg: 8, up: [0, 1, 0] });
    computeNormals(s);
    displace(s, (x, y, z) => nz.fbm3(x * 34, y * 34, z * 34, 3) * 0.002);
    appendMesh(out, s);
  }
  return out;
}

/** Webbing: drag handle, elastic retention, admin panel loops. */
export function carrierWebbing() {
  const out = emptyMesh();
  // PALS rows across the front plate
  for (let r = 0; r < 2; r++) {
    const y = 1.322 + r * 0.046;
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const x = (t - 0.5) * 0.150;
      pts.push([x, y, 0.164 - (x * x) / 0.20]);
    }
    const row = ribbon(pts, 0.013, 0.0035, { seg: 5, up: [0, 1, 0], upright: true });
    computeNormals(row);
    appendMesh(out, row);
  }
  // drag handle on the back
  const drag = ribbon(
    [
      [-0.052, 1.432, -0.132],
      [-0.022, 1.458, -0.152],
      [0.022, 1.458, -0.152],
      [0.052, 1.432, -0.132],
    ],
    0.028,
    0.010,
    { seg: 6, up: [0, 1, 0], upright: true }
  );
  computeNormals(drag);
  appendMesh(out, drag);
  return out;
}

/** Two-point sling routed across the chest. */
export function sling(gripPoint, stockPoint) {
  const pts = [
    [stockPoint[0], stockPoint[1] + 0.02, stockPoint[2]],
    [-0.130, 1.395, -0.010],
    [-0.120, 1.430, -0.090],
    [0.020, 1.430, -0.118],
    [0.120, 1.330, -0.070],
    [0.150, 1.250, 0.040],
    [0.110, 1.235, 0.135],
    [gripPoint[0] + 0.02, gripPoint[1] + 0.03, gripPoint[2] + 0.02],
  ];
  const m = ribbon(pts, 0.032, 0.009, { seg: 6, up: [0, 1, 0] });
  computeNormals(m);
  return m;
}

/** Belt with a buckle and a holster. */
export function belt(nz) {
  const out = emptyMesh();
  const pts = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([Math.sin(a) * 0.158, 0.902, Math.cos(a) * 0.113 - 0.008]);
  }
  const b = ribbon(pts, 0.056, 0.018, { seg: 7, up: [0, 1, 0], upright: true });
  computeNormals(b);
  displace(b, (x, y, z) => nz.fbm3(x * 40, y * 40, z * 40, 2) * 0.0018);
  appendMesh(out, b);
  return out;
}

/** Dump pouch / canteen hanging off the belt at the back. */
export function hipPouch(nz, side) {
  const m = pouch(nz, {
    hx: 0.048, hy: 0.062, hz: 0.038,
    x: side * 0.142, y: 0.878, z: -0.070,
    rz: side * 0.12, ry: side * 0.5,
  });
  return m;
}

/** Knee pad: a curved cap with two elastic straps. */
export function kneePad(nz, knee, side) {
  const out = emptyMesh();
  const cap = boxRound(0.064, 0.080, 0.026, { n: 4.5, seg: 18, rows: 9, roundY: 0.42 });
  place(cap, 0, 0, 0.052, 0, 0, 0);
  bendY(cap, 0.075, 0.052);
  computeNormals(cap);
  displace(cap, (x, y, z) => nz.fbm3(x * 60, y * 60, z * 60, 3) * 0.0018);
  appendMesh(out, cap);
  for (const dy of [-0.056, 0.052]) {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      pts.push([Math.sin(a) * 0.066, dy, Math.cos(a) * 0.058 + 0.006]);
    }
    const s = ribbon(pts, 0.016, 0.006, { seg: 6, up: [0, 1, 0], upright: true });
    computeNormals(s);
    appendMesh(out, s);
  }
  place(out, knee[0], knee[1] + 0.012, knee[2] + 0.004, 0.06, 0, 0);
  computeNormals(out);
  return out;
}

/* ================================================================== */
/* Boots, gloves                                                      */
/* ================================================================== */

/** Boot: sole, upper, ankle cuff, tongue and laces. `ankle` = FootR/L bone. */
export function boot(nz, ankle, side) {
  const out = emptyMesh();
  const ax = ankle[0], ay = ankle[1], az = ankle[2];
  // upper: lofted sections front to back
  const S = [
    [-0.078, 0.036, 0.030, 0.052],
    [-0.052, 0.044, 0.038, 0.062],
    [-0.016, 0.048, 0.044, 0.058],
    [0.030, 0.049, 0.046, 0.048],
    [0.076, 0.046, 0.042, 0.038],
    [0.112, 0.040, 0.034, 0.030],
    [0.134, 0.028, 0.022, 0.024],
  ];
  const seg = 18;
  const rings = S.map(([z, hx, hy, cy]) => ({
    pts: superEllipse(hx, hy, 2.8, seg),
    o: [ax, ay - 0.088 + cy, az + z],
    q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2),
  }));
  const upper = loft(rings, { capStart: true, capEnd: true });
  computeNormals(upper);
  displace(upper, (x, y, z) => nz.fbm3(x * 44, y * 44, z * 44, 3) * 0.0022);
  appendMesh(out, upper);

  // ankle cuff up the shin
  const cuff = tube(
    [
      [ax, ay + 0.010, az - 0.004],
      [ax, ay + 0.070, az - 0.002],
      [ax, ay + 0.125, az + 0.002],
    ],
    (t) => ellipseProfile(0.056 - 0.004 * t, 0.050 - 0.002 * t, 16),
    { capStart: false, capEnd: false }
  );
  computeNormals(cuff);
  displace(cuff, (x, y, z) => nz.fbm3(x * 44, y * 44, z * 44, 3) * 0.0025);
  appendMesh(out, cuff);
  return out;
}

/** Boot sole + heel block, rubber. */
export function bootSole(ankle) {
  const S = [
    [-0.082, 0.033, 0.018],
    [-0.055, 0.043, 0.020],
    [-0.020, 0.047, 0.014],
    [0.030, 0.049, 0.013],
    [0.080, 0.046, 0.013],
    [0.118, 0.038, 0.013],
    [0.140, 0.024, 0.012],
  ];
  const ax = ankle[0], ay = ankle[1], az = ankle[2];
  const rings = S.map(([z, hx, hy]) => ({
    pts: superEllipse(hx, hy, 3.6, 16),
    o: [ax, ay - 0.088 + hy + 0.001, az + z],
    q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2),
  }));
  const m = loft(rings, { capStart: true, capEnd: true });
  computeNormals(m);
  // heel block
  const heel = boxRound(0.036, 0.011, 0.030, { n: 4, seg: 12, rows: 4, roundY: 0.4 });
  place(heel, ax, ay - 0.082, az - 0.056);
  appendMesh(m, heel);
  computeNormals(m);
  return m;
}

/** Laces: cross-over ribbons up the boot tongue. */
export function bootLaces(ankle) {
  const out = emptyMesh();
  const ax = ankle[0], ay = ankle[1], az = ankle[2];
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const z = az + 0.088 - t * 0.076;
    const y = ay - 0.028 + t * 0.070;
    const w = 0.030 - t * 0.004;
    const s = ribbon(
      [
        [ax - w, y - 0.006, z + 0.006],
        [ax, y + 0.004, z],
        [ax + w, y - 0.006, z + 0.006],
      ],
      0.008,
      0.004,
      { seg: 5, up: [0, 1, 0] }
    );
    computeNormals(s);
    appendMesh(out, s);
  }
  return out;
}

/**
 * Gloved hand curled around a grip. `wrist` is the hand bone position, `dir`
 * the direction the fingers wrap about, `axis` the grip axis.
 */
export function glove(nz, wrist, gripAxis, palmNormal, side) {
  const out = emptyMesh();
  const W = new THREE.Vector3(...wrist);
  const A = new THREE.Vector3(...gripAxis).normalize(); // along the grip
  const N = new THREE.Vector3(...palmNormal).normalize(); // out of the palm
  const S = new THREE.Vector3().crossVectors(A, N).normalize(); // across the hand

  // palm block
  const palm = boxRound(0.030, 0.048, 0.022, { n: 3.2, seg: 16, rows: 7, roundY: 0.4 });
  const m = new THREE.Matrix4().makeBasis(S, A, N);
  const pos = W.clone().addScaledVector(A, 0.030).addScaledVector(N, -0.006);
  m.setPosition(pos);
  computeNormals(palm);
  transformMesh(palm, m);
  appendMesh(out, palm);

  // finger mass: a tube curling around the grip axis
  for (let f = 0; f < 4; f++) {
    const t = f / 3;
    const pts = [];
    const startY = 0.052 - t * 0.030;
    for (let i = 0; i <= 4; i++) {
      const u = i / 4;
      const ang = u * 2.2;
      const r = 0.030 - u * 0.004;
      const p = W.clone()
        .addScaledVector(A, startY - 0.004 + Math.sin(ang) * r * 0.55)
        .addScaledVector(N, -0.020 - (1 - Math.cos(ang)) * r * 0.9)
        .addScaledVector(S, side * (0.020 - t * 0.019));
      pts.push([p.x, p.y, p.z]);
    }
    const fin = tube(pts, (u) => ellipseProfile(0.0115 - u * 0.002, 0.0105 - u * 0.002, 10), {
      capStart: true,
      capEnd: true,
    });
    computeNormals(fin);
    appendMesh(out, fin);
  }
  // thumb across the top
  const tp = [];
  for (let i = 0; i <= 4; i++) {
    const u = i / 4;
    const p = W.clone()
      .addScaledVector(A, 0.030 + u * 0.036)
      .addScaledVector(N, 0.006 - u * 0.026)
      .addScaledVector(S, side * (-0.026 - u * 0.004));
    tp.push([p.x, p.y, p.z]);
  }
  const thumb = tube(tp, (u) => ellipseProfile(0.014 - u * 0.003, 0.013 - u * 0.003, 10), {
    capStart: true,
    capEnd: true,
  });
  computeNormals(thumb);
  appendMesh(out, thumb);

  computeNormals(out);
  displace(out, (x, y, z) => nz.fbm3(x * 90, y * 90, z * 90, 3) * 0.0012);
  return out;
}

/** Knuckle guard on the back of the glove. */
export function knuckleGuard(wrist, gripAxis, palmNormal) {
  const W = new THREE.Vector3(...wrist);
  const A = new THREE.Vector3(...gripAxis).normalize();
  const N = new THREE.Vector3(...palmNormal).normalize();
  const S = new THREE.Vector3().crossVectors(A, N).normalize();
  const g = boxRound(0.026, 0.024, 0.007, { n: 3.4, seg: 14, rows: 5, roundY: 0.5 });
  const m = new THREE.Matrix4().makeBasis(S, A, N);
  m.setPosition(W.clone().addScaledVector(A, 0.050).addScaledVector(N, 0.020));
  computeNormals(g);
  transformMesh(g, m);
  return g;
}

/* ================================================================== */
/* Silhouette break-up kit                                            */
/* ================================================================== */
/*
 * Everything below exists for one reason: at 15-30 m a soldier is ~100 px tall,
 * and what separates a real operator from a mannequin at that size is the
 * OUTLINE — ear cups widening the head, a stowed NVG breaking the helmet dome,
 * a pack deepening the torso in profile, pouches and a holster breaking the
 * smooth line of the waist and thigh. Surface detail is sub-pixel by then.
 */

/** Short capped cylinder between two points. */
function rod(a, b, r0, r1 = r0, seg = 12, caps = true) {
  const pts = [];
  for (let i = 0; i <= 3; i++) {
    const t = i / 3;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  }
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  // any up vector not parallel to the axis
  const up = Math.abs(dy) > 0.9 * Math.hypot(dx, dy, dz) ? [0, 0, 1] : [0, 1, 0];
  const m = tube(pts, (t) => ellipseProfile(r0 + (r1 - r0) * t, r0 + (r1 - r0) * t, seg), {
    capStart: caps,
    capEnd: caps,
    up,
  });
  computeNormals(m);
  return m;
}

/**
 * Electronic hearing protection (ComTac-style) worn under the helmet: two fat
 * ear cups proud of the helmet's ear cut plus a boom mic on the left. The cups
 * are the single biggest width cue on a helmeted head.
 */
export function headset(nz, base) {
  const out = emptyMesh();
  const bx = base[0], by = base[1], bz = base[2];
  for (const side of [-1, 1]) {
    const cup = ellipsoid(0.024, 0.043, 0.038, { seg: 16, rows: 10 });
    computeNormals(cup);
    warp(cup, (v) => {
      // flat against the head, domed outward
      if (v.x * side < 0) v.x *= 0.35;
    });
    place(cup, bx + side * 0.098, by + 0.098, bz - 0.004, 0, 0, side * 0.08);
    displace(cup, (x, y, z) => nz.fbm3(x * 60, y * 60, z * 60, 2) * 0.0008);
    appendMesh(out, cup);
    // volume knob / stem up into the helmet rail
    appendMesh(out, rod(
      [bx + side * 0.112, by + 0.128, bz + 0.004],
      [bx + side * 0.112, by + 0.150, bz + 0.004], 0.009, 0.008, 8));
  }
  // boom mic on the left cup, swept forward to the mouth
  const boom = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    boom.push([
      bx + 0.108 - t * 0.060,
      by + 0.084 - t * 0.050,
      bz + 0.020 + Math.sin(t * 1.4) * 0.090,
    ]);
  }
  const bm = tube(boom, () => ellipseProfile(0.0042, 0.0042, 8), { capStart: true, capEnd: true, up: [0, 1, 0] });
  computeNormals(bm);
  appendMesh(out, bm);
  const mic = ellipsoid(0.010, 0.009, 0.013, { seg: 10, rows: 6 });
  computeNormals(mic);
  place(mic, bx + 0.048, by + 0.034, bz + 0.106);
  appendMesh(out, mic);
  return out;
}

/**
 * Night-vision device stowed UP on the helmet shroud: J-arm mount plus either
 * a single PVS-14 style tube or a dual-tube binocular. Stowed NVGs are the
 * defining outline of a modern CoD helmet — they turn the dome into a shape.
 */
export function nvgStowed(nz, base, kind = 'mono') {
  const out = emptyMesh();
  const bx = base[0], by = base[1], bz = base[2];
  const cy = by + 0.100;
  // mount arm off the shroud, folded up over the brow
  const arm = boxRound(0.018, 0.030, 0.012, { n: 4, seg: 10, rows: 5, roundY: 0.4 });
  place(arm, bx, cy + 0.080, bz + 0.146, -0.35, 0, 0);
  appendMesh(out, arm);
  const hinge = rod([bx - 0.022, cy + 0.100, bz + 0.150], [bx + 0.022, cy + 0.100, bz + 0.150], 0.010, 0.010, 10);
  appendMesh(out, hinge);
  // tubes: lie back along the helmet front, objective lens up, eyepiece forward
  const tubes = kind === 'bino' ? [-0.033, 0.033] : [0.0];
  for (const x of tubes) {
    const eye = [bx + x, cy + 0.102, bz + 0.182];
    const obj = [bx + x * 1.08, cy + 0.172, bz + 0.128];
    appendMesh(out, rod(eye, obj, kind === 'bino' ? 0.019 : 0.022, kind === 'bino' ? 0.021 : 0.024, 14));
    // eyecup and objective bell
    appendMesh(out, rod(
      [eye[0], eye[1] - 0.012, eye[2] + 0.010], eye, 0.017, 0.020, 12));
    appendMesh(out, rod(
      obj, [obj[0], obj[1] + 0.016, obj[2] - 0.012], 0.025, 0.026, 14));
  }
  if (kind === 'bino') {
    const bridge = boxRound(0.030, 0.018, 0.016, { n: 4, seg: 10, rows: 5, roundY: 0.4 });
    place(bridge, bx, cy + 0.132, bz + 0.160, -0.9, 0, 0);
    appendMesh(out, bridge);
  }
  // battery pack on the back of the helmet (the counterweight pouch already
  // exists; this is the hard box on top of it) with a cable over the crown
  const batt = boxRound(0.030, 0.018, 0.016, { n: 4, seg: 10, rows: 5, roundY: 0.4 });
  place(batt, bx, cy + 0.108, bz - 0.148, 0.55, 0, 0);
  appendMesh(out, batt);
  const cable = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const a = -0.95 + t * 2.1; // from the back over the crown to the brow
    cable.push([bx + 0.030, cy + Math.cos(a) * 0.166, bz - 0.004 + Math.sin(a) * 0.146]);
  }
  const cb = tube(cable, () => ellipseProfile(0.004, 0.004, 6), { capStart: true, capEnd: true, up: [1, 0, 0] });
  computeNormals(cb);
  appendMesh(out, cb);
  return out;
}

/**
 * Bungee "cat-eye" band around the covered helmet, a Velcro patch on each side
 * and an IR strobe on the crown. Breaks the smooth dome into bands of value.
 */
export function helmetBand(nz, base) {
  const out = emptyMesh();
  const bx = base[0], by = base[1], bz = base[2];
  const cy = by + 0.100;
  const pts = [];
  const n = 30;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const sx = Math.sin(a), sz = Math.cos(a);
    // rides lower at the back than the front
    const y = cy + 0.066 - Math.max(0, -sz) * 0.018 + Math.max(0, sz) * 0.006;
    const k = 1.035;
    pts.push([bx + sx * 0.1105 * k, y, bz - 0.006 + sz * 0.1225 * k]);
  }
  const band = ribbon(pts, 0.017, 0.005, { seg: 6, up: [0, 1, 0], upright: true });
  computeNormals(band);
  displace(band, (x, y, z) => nz.fbm3(x * 50, y * 50, z * 50, 2) * 0.0012);
  appendMesh(out, band);
  for (const side of [-1, 1]) {
    const patch = boxRound(0.004, 0.022, 0.032, { n: 5, seg: 10, rows: 4, roundY: 0.3 });
    place(patch, bx + side * 0.120, cy + 0.098, bz - 0.030, 0, 0, side * -0.55);
    appendMesh(out, patch);
  }
  return out;
}

/** IR strobe on the back of the crown (hard polymer). */
export function helmetStrobe(base) {
  const bx = base[0], by = base[1], bz = base[2];
  const s = boxRound(0.017, 0.012, 0.022, { n: 4, seg: 10, rows: 5, roundY: 0.5 });
  place(s, bx - 0.030, by + 0.100 + 0.150, bz - 0.070, 0.6, 0, 0);
  return s;
}

/**
 * Back load. `kind`:
 *   'assault'   — 20 L assault pack with a lid pocket and compression straps
 *   'hydration' — slim bladder carrier zipped to the back plate, drink tube
 *                 routed over the right shoulder
 *   'daypack'   — soft civilian-ish pack for the irregular, riding low
 * Returns { body (gear), tube (rubber or null) }.
 */
export function backPack(nz, kind = 'assault') {
  const body = emptyMesh();
  let drink = null;
  if (kind === 'hydration') {
    const m = boxRound(0.108, 0.150, 0.030, { n: 4.2, seg: 18, rows: 9, roundY: 0.3 });
    computeNormals(m);
    displace(m, (x, y, z) => nz.fbm3(x * 30, y * 30, z * 30, 3) * 0.003);
    place(m, 0, 1.275, -0.186, 0.06, 0, 0);
    bendY(m, 0.26, -0.186);
    appendMesh(body, m);
    // PALS rows across it
    for (let r = 0; r < 3; r++) {
      const row = boxRound(0.100, 0.007, 0.004, { n: 5, seg: 12, rows: 3, roundY: 0.5 });
      place(row, 0, 1.225 + r * 0.045, -0.217 + r * 0.003, 0.06, 0, 0);
      appendMesh(body, row);
    }
    // drink tube: out of the top, over the right shoulder, clipped to the strap
    const pts = [
      [-0.050, 1.425, -0.170],
      [-0.085, 1.470, -0.100],
      [-0.100, 1.485, 0.000],
      [-0.095, 1.455, 0.100],
      [-0.085, 1.395, 0.160],
      [-0.080, 1.340, 0.172],
    ];
    drink = tube(pts, () => ellipseProfile(0.0065, 0.0065, 8), { capStart: true, capEnd: true, up: [0, 1, 0] });
    computeNormals(drink);
    return { body, tube: drink };
  }
  const daypack = kind === 'daypack';
  const hx = daypack ? 0.122 : 0.135, hy = daypack ? 0.155 : 0.190, hz = daypack ? 0.068 : 0.080;
  const cy = daypack ? 1.125 : 1.215, cz = daypack ? -0.228 : -0.250;
  const m = boxRound(hx, hy, hz, { n: daypack ? 2.8 : 4.0, seg: 20, rows: 10, roundY: daypack ? 0.45 : 0.3 });
  computeNormals(m);
  // soft pack: bulges at the bottom, sags, never a clean box
  warp(m, (v) => {
    const t = Math.max(0, -v.y / hy);
    v.z *= 1 + 0.18 * t;
    v.x *= 1 + 0.05 * t;
  });
  displace(m, (x, y, z) => nz.fbm3(x * 22, y * 18, z * 22, 3) * (daypack ? 0.007 : 0.004));
  place(m, 0.004, cy, cz, daypack ? 0.16 : 0.10, 0.03, daypack ? -0.05 : 0.02);
  appendMesh(body, m);
  // lid / front pocket
  const lid = boxRound(hx * 0.86, hy * 0.40, 0.024, { n: 3.6, seg: 16, rows: 6, roundY: 0.4 });
  computeNormals(lid);
  displace(lid, (x, y, z) => nz.fbm3(x * 30, y * 30, z * 30, 2) * 0.003);
  place(lid, 0.004, cy - hy * 0.35, cz - hz - 0.016, daypack ? 0.16 : 0.10, 0.03, 0);
  appendMesh(body, lid);
  // top grab handle
  const handle = ribbon(
    [
      [-0.030, cy + hy - 0.004, cz + 0.02],
      [0, cy + hy + 0.024, cz + 0.02],
      [0.030, cy + hy - 0.004, cz + 0.02],
    ],
    0.020,
    0.006,
    { seg: 5, up: [0, 0, 1] }
  );
  computeNormals(handle);
  appendMesh(body, handle);
  // side compression straps
  for (const side of [-1, 1]) {
    for (const dy of [-0.06, 0.05]) {
      const pts = [
        [side * (hx - 0.03), cy + dy, cz + hz + 0.00],
        [side * (hx + 0.008), cy + dy, cz],
        [side * (hx - 0.03), cy + dy - 0.004, cz - hz - 0.010],
      ];
      const s = ribbon(pts, 0.020, 0.005, { seg: 5, up: [0, 1, 0], upright: true });
      computeNormals(s);
      appendMesh(body, s);
    }
  }
  if (daypack) {
    // shoulder straps over the front of the chest rig
    for (const side of [-1, 1]) {
      const pts = [
        [side * 0.070, cy + hy - 0.02, cz + hz - 0.02],
        [side * 0.100, 1.470, -0.070],
        [side * 0.112, 1.482, 0.030],
        [side * 0.118, 1.420, 0.130],
        [side * 0.128, 1.300, 0.150],
      ];
      const s = ribbon(pts, 0.050, 0.012, { seg: 6, up: [0, 1, 0] });
      computeNormals(s);
      appendMesh(body, s);
    }
  }
  return { body, tube: null };
}

/** Frag + smoke pouches on the cummerbund, one per side. */
export function sidePouches(nz) {
  const out = emptyMesh();
  for (const side of [-1, 1]) {
    // cylindrical frag/smoke pouch hanging off the cummerbund flank
    const x = side * 0.178, z = 0.038;
    const p = rod([x, 1.105, z], [x, 1.205, z], 0.030, 0.029, 14);
    displace(p, (px, py, pz) => nz.fbm3(px * 40, py * 40, pz * 40, 2) * 0.0015);
    appendMesh(out, p);
    const lid = rod([x, 1.200, z], [x, 1.218, z + 0.004], 0.032, 0.031, 14);
    appendMesh(out, lid);
    // second, boxy pouch further back on the right: radio/utility
    if (side < 0) {
      const u = pouch(nz, {
        hx: 0.030, hy: 0.052, hz: 0.026,
        x: side * 0.170, y: 1.150, z: -0.058, ry: side * 1.35,
      });
      appendMesh(out, u);
    }
  }
  return out;
}

/** Tourniquet in a rubber-banded pouch on the left shoulder strap. */
export function tourniquet(nz) {
  const t = boxRound(0.019, 0.040, 0.015, { n: 3.2, seg: 10, rows: 6, roundY: 0.45 });
  computeNormals(t);
  displace(t, (x, y, z) => nz.fbm3(x * 70, y * 70, z * 70, 2) * 0.0012);
  place(t, 0.088, 1.395, 0.172, -0.35, 0.1, 0.05);
  return t;
}

/**
 * Faction armband: a band of coloured tape round the upper arm, 35 % of the
 * way from shoulder to elbow. `sh`, `el` = bind positions.
 */
export function armband(sh, el, r = 0.060, width = 0.042, at = 0.36) {
  const d = [el[0] - sh[0], el[1] - sh[1], el[2] - sh[2]];
  const l = Math.hypot(d[0], d[1], d[2]);
  const u = [d[0] / l, d[1] / l, d[2] / l];
  const c = [sh[0] + d[0] * at, sh[1] + 0.03 + d[1] * at, sh[2] + d[2] * at];
  const a = [c[0] - u[0] * width * 0.5, c[1] - u[1] * width * 0.5, c[2] - u[2] * width * 0.5];
  const b = [c[0] + u[0] * width * 0.5, c[1] + u[1] * width * 0.5, c[2] + u[2] * width * 0.5];
  return rod(a, b, r, r * 0.985, 16, false);
}

/** Drop-leg pistol holster on the right thigh with its two leg straps. */
export function thighHolster(nz, hip, knee) {
  const out = emptyMesh();
  const x = hip[0] - 0.110, y = hip[1] - 0.20, z = hip[2] + 0.012;
  const shell = boxRound(0.020, 0.078, 0.046, { n: 3.4, seg: 12, rows: 8, roundY: 0.35 });
  computeNormals(shell);
  displace(shell, (px, py, pz) => nz.fbm3(px * 50, py * 50, pz * 50, 2) * 0.0015);
  place(shell, x, y, z, 0.12, 0, 0.05);
  appendMesh(out, shell);
  // pistol grip poking out of the top
  const grip = boxRound(0.014, 0.036, 0.018, { n: 3.2, seg: 10, rows: 5, roundY: 0.4 });
  place(grip, x + 0.002, y + 0.094, z - 0.018, 0.35, 0, 0.05);
  appendMesh(out, grip);
  // hanger from the belt
  const hanger = boxRound(0.014, 0.050, 0.008, { n: 4, seg: 8, rows: 4, roundY: 0.4 });
  place(hanger, x + 0.010, y + 0.118, z + 0.004, 0, 0, 0.12);
  appendMesh(out, hanger);
  // leg straps
  for (const dy of [-0.035, 0.040]) {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      pts.push([hip[0] - 0.002 + Math.sin(a) * 0.094, y + dy, hip[2] + 0.008 + Math.cos(a) * 0.082]);
    }
    const s = ribbon(pts, 0.022, 0.005, { seg: 5, up: [0, 1, 0], upright: true });
    computeNormals(s);
    appendMesh(out, s);
  }
  return out;
}
