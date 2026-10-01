import * as THREE from 'three';
import { latheZ, rodZ, mergeAll, box } from './geometry.js';
import { loft, foldField, makeFolds } from './anatomy.js';

/**
 * First-person arms.
 *
 * Two bones per arm, solved analytically from the hand (which is the thing the
 * animation drives — the hands are welded to the weapon, the elbows follow).
 *
 * Every surface on the limb is a smooth closed LOFT (see anatomy.js), never a
 * box or a lathe: a hand assembled from chamfered blocks reads as a stack of
 * slabs however well it is posed, because every silhouette edge is either
 * dead straight or a perfect circle. The parts are:
 *
 *   glove    palm shell with a real transverse arch, thenar and hypothenar
 *            swell, a wrist taper; fingers as tapered capsules whose rounded
 *            ends overlap at every joint so a curled finger stays one surface.
 *   armour   a moulded four-lobed TPR knuckle guard, split back-of-hand pads,
 *            proximal/middle phalanx pads, a leather palm patch, fingertip
 *            grip pads and stitched seams down the finger flanks.
 *   cuff     neoprene glove cuff with a hook-and-loop strap and pull tab. It
 *            belongs to the FOREARM bone, not the hand: a wrist bends at the
 *            wrist, and a cuff parented to the hand swings out of the sleeve.
 *   sleeve   combat-shirt sleeve with an anatomical taper (the forearm is
 *            widest a quarter of the way down, over the brachioradialis, and
 *            flattens toward the wrist) and oblique, partial cloth folds that
 *            bunch at the hem and inside the elbow.
 *   watch    left wrist, over the glove cuff: a resin-cased field watch.
 *
 * Hand-local space: -Z along the fingers, +Y out of the back of the hand,
 * +X toward the thumb (authored as a left hand; the right is mirrored).
 */

/**
 * Humerus and forearm+wrist lengths, in metres. Cheated ~10% long, as every
 * viewmodel does, so the hand reaches a weapon held far enough out for the
 * magazine and muzzle to be in frame without locking the elbow straight.
 */
const L_UPPER = 0.33;
const L_FORE = 0.3;

/* -------------------------------------------------------------------------- */
/*  hand geometry                                                             */
/* -------------------------------------------------------------------------- */

/**
 * One finger segment: a tapered capsule, wider than deep, fuller on the palmar
 * side (the finger pad), with domed ends that sit on the joint centres so two
 * segments flexed against each other still read as one finger.
 */
function segment(len, r0, r1, distal = false) {
  const mid = (r0 + r1) * 0.5;
  return loft(
    [
      { t: 0, z: 0, w: r0, hT: r0 * 0.82, hB: r0 * 0.9, n: 2.3 },
      { t: 0.5, z: -len * 0.5, w: mid * 1.02, hT: mid * 0.8, hB: mid * 0.97, n: 2.3 },
      {
        t: 1,
        z: -len,
        w: r1,
        hT: r1 * (distal ? 0.7 : 0.82),
        hB: r1 * (distal ? 0.95 : 0.9),
        y: distal ? -r1 * 0.08 : 0,
        n: 2.3,
      },
    ],
    { rings: 8, seg: 18, capStart: r0 * 0.8, capEnd: distal ? r1 * 1.2 : r1 * 0.82, capRings: 5 }
  );
}

/** Moulded TPR pad on the dorsal side of a phalanx. */
function segmentPad(len, r) {
  return loft(
    [
      { t: 0, z: -len * 0.18, y: r * 0.66, w: r * 0.62, hT: r * 0.26, hB: r * 0.12, n: 2.6 },
      { t: 0.5, z: -len * 0.45, y: r * 0.7, w: r * 0.72, hT: r * 0.3, hB: r * 0.12, n: 2.6 },
      { t: 1, z: -len * 0.74, y: r * 0.66, w: r * 0.6, hT: r * 0.25, hB: r * 0.12, n: 2.6 },
    ],
    { rings: 4, seg: 14, capStart: r * 0.18, capEnd: r * 0.18, capRings: 3 }
  );
}

/** Palmar grip pad on a fingertip. */
function tipPad(len, r) {
  return loft(
    [
      { t: 0, z: -len * 0.15, y: -r * 0.66, w: r * 0.7, hT: r * 0.12, hB: r * 0.3, n: 2.4 },
      { t: 1, z: -len * 0.85, y: -r * 0.6, w: r * 0.62, hT: r * 0.12, hB: r * 0.28, n: 2.4 },
    ],
    { rings: 3, seg: 12, capStart: r * 0.2, capEnd: r * 0.35, capRings: 3 }
  );
}

/**
 * Stitched seam down the flank of a finger segment: a 1 mm proud bead. At the
 * distances the hands sit these are the lines that keep four fingers from
 * merging into one paddle.
 */
function segmentSeam(len, r0, r1, sx) {
  const rm = (r0 + r1) * 0.5;
  return loft(
    [
      { t: 0, z: -len * 0.06, x: sx * r0 * 0.97, y: r0 * 0.12, w: 0.0007, hT: r0 * 0.34, hB: r0 * 0.34 },
      { t: 0.5, z: -len * 0.5, x: sx * rm * 0.99, y: rm * 0.12, w: 0.0007, hT: rm * 0.34, hB: rm * 0.34 },
      { t: 1, z: -len * 0.94, x: sx * r1 * 0.97, y: r1 * 0.12, w: 0.0007, hT: r1 * 0.34, hB: r1 * 0.34 },
    ],
    { rings: 4, seg: 8 }
  );
}

/**
 * Build one finger as three nested joints so it can curl.
 * @returns {{root: THREE.Object3D, joints: THREE.Object3D[]}}
 */
function buildFinger(materials, spec) {
  const { lengths, radii, curl } = spec;
  const root = new THREE.Object3D();
  const joints = [];
  let parent = root;
  for (let i = 0; i < 3; i++) {
    const j = new THREE.Object3D();
    j.rotation.x = -curl[i];
    parent.add(j);
    j.add(new THREE.Mesh(segment(lengths[i], radii[i], radii[i + 1], i === 2), materials.glove));
    if (i < 2) {
      j.add(
        new THREE.Mesh(
          mergeAll([
            segmentSeam(lengths[i], radii[i], radii[i + 1], 1),
            segmentSeam(lengths[i], radii[i], radii[i + 1], -1),
          ]),
          materials.seam ?? materials.glove
        )
      );
      j.add(new THREE.Mesh(segmentPad(lengths[i], radii[i] * (i === 0 ? 1 : 0.92)), materials.pad));
    } else {
      j.add(new THREE.Mesh(tipPad(lengths[i], radii[i]), materials.pad));
    }
    const next = new THREE.Object3D();
    next.position.z = -lengths[i];
    j.add(next);
    parent = next;
    joints.push(j);
  }
  return { root, joints };
}

/**
 * Glove: palm shell, knuckle guard, back-of-hand pads, palm patch.
 * Fingers and the thumb are added as children by the Arm so they can be posed.
 */
function buildGlove(materials, opts = {}) {
  const s = opts.scale ?? 1;
  const root = new THREE.Object3D();

  /**
   * Palm shell. The superellipse exponent climbs from 2.2 at the wrist to 2.8
   * at the knuckles: the wrist is round, the metacarpal row is a flattened arch.
   * The thumb side (+X) is fuller than the little-finger side through the
   * thenar, and the palmar half is deeper than the dorsal half everywhere.
   */
  const palm = loft(
    [
      { t: 0, z: 0.008 * s, y: -0.001 * s, w: 0.028 * s, wL: 0.028 * s, hT: 0.0145 * s, hB: 0.016 * s, n: 2.2 },
      { t: 0.2, z: -0.013 * s, x: 0.002 * s, w: 0.036 * s, wL: 0.033 * s, hT: 0.015 * s, hB: 0.0205 * s, n: 2.3 },
      { t: 0.5, z: -0.045 * s, x: 0.001 * s, w: 0.0415 * s, wL: 0.04 * s, hT: 0.0138 * s, hB: 0.0185 * s, n: 2.6 },
      { t: 0.8, z: -0.074 * s, w: 0.0445 * s, wL: 0.0435 * s, hT: 0.0128 * s, hB: 0.0162 * s, n: 2.8 },
      { t: 1, z: -0.093 * s, y: -0.001 * s, w: 0.0445 * s, wL: 0.0432 * s, hT: 0.0122 * s, hB: 0.0142 * s, n: 2.8 },
    ],
    { rings: 20, seg: 36, capStart: 0.004 * s, capEnd: 0.0105 * s, capRings: 6 }
  );
  root.add(new THREE.Mesh(palm, materials.glove));

  const pads = [];
  /**
   * Knuckle guard: ONE moulded part with four lobes over the metacarpal heads
   * and flex valleys between them, following the knuckle arch. Lofted across
   * the hand (along X) and turned into place.
   */
  const KX = [-0.0298, -0.0104, 0.0102, 0.0298];
  const kkeys = [];
  const xs = [-0.041, -0.0298, -0.02, -0.0104, 0, 0.0102, 0.02, 0.0298, 0.04];
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const lobe = KX.some((k) => Math.abs(k - x) < 1e-4);
    const end = i === 0 || i === xs.length - 1;
    // arch: the palm's dorsal surface at the knuckle row, minus a millimetre
    const u = Math.min(0.98, Math.abs(x) / 0.0445);
    const top = 0.0126 * Math.pow(1 - Math.pow(u, 2.8), 1 / 2.8);
    kkeys.push({
      t: i / (xs.length - 1),
      z: x * s,
      y: (top - 0.0012) * s,
      w: (end ? 0.0068 : lobe ? 0.0102 : 0.0078) * s,
      hT: (end ? 0.0022 : lobe ? 0.0048 : 0.0029) * s,
      hB: 0.0028 * s,
      n: 2.4,
    });
  }
  const guard = loft(kkeys, { rings: 40, seg: 16, capStart: 0.003 * s, capEnd: 0.003 * s, capRings: 3 });
  guard.rotateY(Math.PI / 2); // loft z -> hand x
  guard.translate(0, 0, -0.087 * s);
  pads.push(guard);

  // Back-of-hand pads: two panels with a flex gap between them.
  for (const [za, zb] of [
    [-0.024, -0.046],
    [-0.051, -0.071],
  ]) {
    const zm = (za + zb) * 0.5;
    const topAt = (z) => (z > -0.045 ? 0.0145 : 0.0135);
    pads.push(
      loft(
        [
          { t: 0, z: za * s, y: (topAt(za) - 0.0014) * s, w: 0.019 * s, hT: 0.0028 * s, hB: 0.0015 * s, n: 3 },
          { t: 0.5, z: zm * s, y: (topAt(zm) - 0.0012) * s, w: 0.0215 * s, hT: 0.0032 * s, hB: 0.0015 * s, n: 3 },
          { t: 1, z: zb * s, y: (topAt(zb) - 0.0016) * s, w: 0.022 * s, hT: 0.0028 * s, hB: 0.0015 * s, n: 3 },
        ],
        { rings: 6, seg: 18, capStart: 0.0025 * s, capEnd: 0.0025 * s, capRings: 3 }
      )
    );
  }
  // Leather palm patch, following the palmar surface.
  pads.push(
    loft(
      [
        { t: 0, z: -0.018 * s, x: 0.001 * s, y: -0.0188 * s, w: 0.03 * s, hT: 0.0014 * s, hB: 0.0024 * s, n: 3 },
        { t: 0.5, z: -0.05 * s, y: -0.0168 * s, w: 0.037 * s, hT: 0.0014 * s, hB: 0.0026 * s, n: 3 },
        { t: 1, z: -0.083 * s, y: -0.0142 * s, w: 0.038 * s, hT: 0.0014 * s, hB: 0.0022 * s, n: 3 },
      ],
      { rings: 8, seg: 20, capStart: 0.003 * s, capEnd: 0.003 * s, capRings: 3 }
    )
  );
  root.add(new THREE.Mesh(mergeAll(pads), materials.pad));

  // Seams: down both edges of the hand where the palm and back panels meet.
  const seams = [];
  for (const sx of [-1, 1]) {
    seams.push(
      loft(
        [
          { t: 0, z: -0.006 * s, x: sx * 0.03 * s, y: 0.0005 * s, w: 0.0008 * s, hT: 0.0035 * s, hB: 0.0035 * s },
          { t: 0.5, z: -0.045 * s, x: sx * 0.0405 * s, y: 0.001 * s, w: 0.0008 * s, hT: 0.004 * s, hB: 0.004 * s },
          { t: 1, z: -0.086 * s, x: sx * 0.0445 * s, y: 0.0 * s, w: 0.0008 * s, hT: 0.0035 * s, hB: 0.0035 * s },
        ],
        { rings: 8, seg: 8 }
      )
    );
  }
  root.add(new THREE.Mesh(mergeAll(seams), materials.seam ?? materials.pad));
  return root;
}

/**
 * Glove cuff, strap and (optionally) a watch — in FOREARM bone space, at the
 * wrist end. `len` is the forearm length; the wrist sits at z = -len.
 * @param {number} radialSign  +1 if bone +X is the thumb side
 */
function buildCuff(materials, len, s, opts = {}) {
  const root = new THREE.Object3D();
  const zw = -len;
  // neoprene cuff: from the wrist back 70 mm, slightly flared at the open end
  const cuff = loft(
    [
      { t: 0, z: zw + 0.004 * s, w: 0.0295 * s, hT: 0.0158 * s, hB: 0.0172 * s, n: 2.2 },
      { t: 0.35, z: zw + 0.026 * s, w: 0.0322 * s, hT: 0.0195 * s, hB: 0.0205 * s, n: 2.2 },
      { t: 1, z: zw + 0.072 * s, w: 0.0345 * s, hT: 0.0228 * s, hB: 0.0238 * s, n: 2.2 },
    ],
    {
      rings: 18,
      seg: 32,
      capStart: 0.004 * s,
      capEnd: 0.002 * s,
      disp: foldField(makeFolds(7, [{ count: 3, from: 0.1, to: 0.6, amp: 0.035, width: 0.07, tilt: 0.05, arc: 3.4 }]), 0.008, 3),
    }
  );
  root.add(new THREE.Mesh(cuff, materials.glove));

  // hook-and-loop strap round the cuff plus its pull tab
  const strapZ0 = zw + (opts.watch ? 0.046 : 0.03) * s;
  const strapZ1 = strapZ0 + 0.02 * s;
  const tS = (strapZ0 - zw) / (0.072 * s);
  const wAt = (t) => 0.0322 + (0.0345 - 0.0322) * Math.max(0, (t - 0.35) / 0.65);
  const hAt = (t) => 0.0195 + (0.0228 - 0.0195) * Math.max(0, (t - 0.35) / 0.65);
  const pad = [];
  pad.push(
    loft(
      [
        { t: 0, z: strapZ0, w: (wAt(tS) + 0.0022) * s, hT: (hAt(tS) + 0.0022) * s, hB: (hAt(tS) + 0.0032) * s, n: 2.2 },
        { t: 1, z: strapZ1, w: (wAt(tS + 0.28) + 0.0022) * s, hT: (hAt(tS + 0.28) + 0.0022) * s, hB: (hAt(tS + 0.28) + 0.0032) * s, n: 2.2 },
      ],
      { rings: 3, seg: 32, capStart: 0.0015 * s, capEnd: 0.0015 * s, capRings: 3 }
    )
  );
  // pull tab, on the ulnar-dorsal side
  const tab = box(0.016 * s, 0.004 * s, 0.022 * s, 0.0018 * s, 2);
  tab.rotateZ(-0.9 * (opts.radialSign ?? 1));
  tab.translate(-(opts.radialSign ?? 1) * 0.029 * s, 0.017 * s, (strapZ0 + strapZ1) * 0.5);
  pad.push(tab);
  root.add(new THREE.Mesh(mergeAll(pad), materials.pad));

  if (opts.watch && materials.watch) root.add(buildWatch(materials, zw + 0.022 * s, s, opts.radialSign ?? 1));
  return root;
}

/**
 * A resin-cased field watch, face on the back of the wrist rolled 25 degrees
 * toward the thumb so it faces the shooter over a C-clamp.
 */
function buildWatch(materials, zc, s, radialSign) {
  const g = new THREE.Object3D();
  // strap: a band hugging the cuff (cuff half-axes at this z are ~32 x 20 mm)
  const strap = loft(
    [
      { t: 0, z: zc - 0.011 * s, w: 0.0336 * s, hT: 0.0212 * s, hB: 0.0222 * s, n: 2.2 },
      { t: 1, z: zc + 0.011 * s, w: 0.0346 * s, hT: 0.0226 * s, hB: 0.0234 * s, n: 2.2 },
    ],
    { rings: 3, seg: 36, capStart: 0.0014 * s, capEnd: 0.0014 * s, capRings: 3 }
  );
  g.add(new THREE.Mesh(strap, materials.strap ?? materials.pad));

  const head = new THREE.Object3D();
  // case: 44 x 42 mm, 13 mm tall, with lugs; axis +Y out of the wrist
  const parts = [];
  const caseG = loft(
    [
      { t: 0, z: -0.0215 * s, y: 0.0045 * s, w: 0.0165 * s, hT: 0.004 * s, hB: 0.0035 * s, n: 3.2 },
      { t: 0.5, z: 0, y: 0.0055 * s, w: 0.0212 * s, hT: 0.0062 * s, hB: 0.0045 * s, n: 3.2 },
      { t: 1, z: 0.0215 * s, y: 0.0045 * s, w: 0.0165 * s, hT: 0.004 * s, hB: 0.0035 * s, n: 3.2 },
    ],
    { rings: 10, seg: 28, capStart: 0.003 * s, capEnd: 0.003 * s, capRings: 3 }
  );
  parts.push(caseG);
  // bezel: a knurled ring standing on the case
  const bezel = latheZ(
    [
      [0, 0.0128 * s],
      [0, 0.0182 * s],
      [0.0012 * s, 0.0192 * s],
      [0.0034 * s, 0.0186 * s],
      [0.0038 * s, 0.0165 * s],
      [0.0032 * s, 0.0128 * s],
    ],
    40
  );
  bezel.rotateX(-Math.PI / 2);
  bezel.translate(0, 0.0105 * s, 0);
  parts.push(bezel);
  // crown and pushers on the side
  for (const [dz, r] of [
    [0, 0.0026],
    [-0.009, 0.0019],
    [0.009, 0.0019],
  ]) {
    const c = rodZ(r * s, r * s, 0.004 * s, 12, 0.0005 * s);
    c.rotateY(Math.PI / 2);
    c.translate(0.0228 * s, 0.0068 * s, dz * s);
    parts.push(c);
  }
  head.add(new THREE.Mesh(mergeAll(parts), materials.watch));
  // dial: recessed, under the bezel
  const dial = rodZ(0.0132 * s, 0.0132 * s, 0.001 * s, 32, 0.0002 * s);
  dial.rotateX(-Math.PI / 2);
  dial.translate(0, 0.0112 * s, 0);
  const hands = [];
  const hand1 = box(0.0009 * s, 0.0004 * s, 0.009 * s, 0.0001, 1);
  hand1.translate(0, 0.0122 * s, -0.004 * s);
  hands.push(hand1);
  const hand2 = box(0.0009 * s, 0.0004 * s, 0.0065 * s, 0.0001, 1);
  hand2.translate(0, 0, -0.003 * s);
  hand2.rotateY(1.9);
  hand2.translate(0, 0.0124 * s, 0);
  hands.push(hand2);
  for (let i = 0; i < 12; i++) {
    const m = box(0.0008 * s, 0.0003 * s, (i % 3 === 0 ? 0.0026 : 0.0014) * s, 0.0001, 1);
    m.translate(0, 0.0119 * s, -0.0115 * s);
    m.rotateY((i / 12) * Math.PI * 2);
    hands.push(m);
  }
  head.add(new THREE.Mesh(dial, materials.watchFace ?? materials.watch));
  if (materials.seam) head.add(new THREE.Mesh(mergeAll(hands), materials.seam));
  // seat on the dorsal surface, rolled toward the thumb
  // 40 mm class case: the 44 mm authoring read as a wrist computer at 0.3 m.
  head.scale.setScalar(0.84);
  const pivot = new THREE.Object3D();
  pivot.rotation.z = -0.42 * radialSign;
  head.position.set(0, 0.0212 * s, zc);
  pivot.add(head);
  g.add(pivot);
  return g;
}

/**
 * Thumb: two segments on the +X side, angled across the grip. The proximal
 * segment stands in for the metacarpal as well as the proximal phalanx (50 mm),
 * and carries the thenar swell that blends it into the palm.
 */
function buildThumb(materials, scale = 1, spec = THUMB) {
  const s = scale;
  const root = new THREE.Object3D();
  const j1 = new THREE.Object3D();
  root.add(j1);
  const l0 = spec.l0 * s;
  const l1 = spec.l1 * s;
  const seg1 = loft(
    [
      { t: 0, z: 0.004 * s, y: -0.002 * s, w: spec.r0 * 1.45 * s, hT: spec.r0 * 1.05 * s, hB: spec.r0 * 1.35 * s, n: 2.2 },
      { t: 0.45, z: -l0 * 0.45, y: -0.001 * s, w: spec.r0 * 1.12 * s, hT: spec.r0 * 0.84 * s, hB: spec.r0 * 1.02 * s, n: 2.3 },
      { t: 1, z: -l0, w: spec.r1 * s, hT: spec.r1 * 0.82 * s, hB: spec.r1 * 0.9 * s, n: 2.3 },
    ],
    { rings: 10, seg: 20, capStart: spec.r0 * 1.1 * s, capEnd: spec.r1 * 0.82 * s, capRings: 5 }
  );
  j1.add(new THREE.Mesh(seg1, materials.glove));
  j1.add(new THREE.Mesh(segmentPad(l0 * 0.8, spec.r1 * s).translate(0, 0, -l0 * 0.28), materials.pad));
  j1.add(
    new THREE.Mesh(
      mergeAll([
        segmentSeam(l0, spec.r0 * s, spec.r1 * s, 1),
        segmentSeam(l0, spec.r0 * s, spec.r1 * s, -1),
      ]),
      materials.seam ?? materials.glove
    )
  );
  const j2 = new THREE.Object3D();
  j2.position.z = -l0;
  j1.add(j2);
  j2.add(new THREE.Mesh(segment(l1, spec.r1 * s, spec.r2 * s, true), materials.glove));
  j2.add(new THREE.Mesh(tipPad(l1, spec.r2 * s * 1.15), materials.pad));
  return { root, joints: [j1, j2] };
}

/** Thumb dimensions, shared by the mesh and the contact solve. */
const THUMB = { l0: 0.05, l1: 0.032, r0: 0.0115, r1: 0.0102, r2: 0.0078 };

/**
 * Sleeve over one bone. Bone space: the joint at z=0, the limb along -Z.
 *
 *   kind 'upper'  shoulder -> elbow. Mostly off screen; a fuller tube with a
 *                 domed elbow and compression folds on the inside of the bend.
 *   kind 'fore'   elbow -> wrist. The part the camera sees. Widest over the
 *                 brachioradialis a quarter of the way down, flattening to an
 *                 oval at the wrist, ending in a hemmed cuff 45 mm short of the
 *                 wrist so the glove cuff shows, with the fabric bunched in
 *                 oblique partial folds above it.
 */
function buildSleeve(material, len, kind, s = 1, seed = 1) {
  let geo;
  if (kind === 'upper') {
    const folds = makeFolds(seed, [
      { count: 3, from: 0.62, to: 0.95, amp: 0.09, width: 0.035, tilt: 0.05, arc: 3.2, phase: -Math.PI / 2, phaseJitter: 0.4 },
      { count: 3, from: 0.15, to: 0.6, amp: 0.05, width: 0.06, tilt: 0.1, arc: 2.6 },
    ]);
    geo = loft(
      [
        { t: 0, z: 0.0, w: 0.058 * s, hT: 0.054 * s, hB: 0.054 * s },
        { t: 0.45, z: -len * 0.45, w: 0.056 * s, hT: 0.052 * s, hB: 0.05 * s },
        { t: 1, z: -len, w: 0.05 * s, hT: 0.046 * s, hB: 0.046 * s },
      ],
      { rings: 48, seg: 36, capStart: 0.04 * s, capEnd: 0.044 * s, capRings: 7, disp: foldField(folds, 0.018, seed) }
    );
  } else {
    const hemT = 1;
    const zEnd = -(len - 0.046 * s);
    const folds = makeFolds(seed, [
      // compression folds bunched above the hem
      { count: 4, from: 0.66, to: 0.93, amp: 0.075, width: 0.028, tilt: 0.045, arc: 4.2, phaseJitter: 2.5 },
      // long drag folds down the middle
      { count: 3, from: 0.22, to: 0.6, amp: 0.04, width: 0.05, tilt: 0.09, arc: 3.0, phaseJitter: 2.5 },
      // inside of the elbow
      { count: 2, from: 0.02, to: 0.16, amp: 0.07, width: 0.035, tilt: 0.04, arc: 2.6, phase: -Math.PI / 2, phaseJitter: 0.5 },
    ]);
    const fold = foldField(folds, 0.014, seed);
    // hem: a rolled, stitched edge — flat band, then a lip
    const disp = (th, t, sec) => {
      let d = fold(th, t, sec);
      const hem = Math.max(0, (t - 0.965) / 0.035);
      d *= 1 - Math.min(1, hem * 1.6);
      d += 0.05 * Math.min(1, hem * 2.5) - 0.01 * Math.max(0, hem - 0.8) * 5;
      // flat-felled seam down the underside of the sleeve: a narrow raised
      // ridge that the curvature bake turns into a worn stitched line
      const da = Math.abs(((th + Math.PI * 0.62 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const s0 = da / 0.09;
      d += 0.014 * Math.exp(-s0 * s0);
      return d;
    };
    geo = loft(
      [
        { t: 0, z: 0.012 * s, w: 0.046 * s, hT: 0.041 * s, hB: 0.043 * s },
        { t: 0.22, z: zEnd * 0.22, w: 0.0485 * s, hT: 0.04 * s, hB: 0.0445 * s, n: 2.1 },
        { t: 0.55, z: zEnd * 0.55, w: 0.0415 * s, hT: 0.032 * s, hB: 0.0355 * s, n: 2.2 },
        { t: 0.85, z: zEnd * 0.85, w: 0.0375 * s, hT: 0.0285 * s, hB: 0.0305 * s, n: 2.2 },
        { t: hemT, z: zEnd, w: 0.0385 * s, hT: 0.0292 * s, hB: 0.031 * s, n: 2.2 },
      ],
      { rings: 96, seg: 40, capStart: 0.036 * s, capEnd: 0.004 * s, capRings: 6, disp }
    );
  }
  return new THREE.Mesh(geo, material);
}

/* -------------------------------------------------------------------------- */
/*  arm rig                                                                   */
/* -------------------------------------------------------------------------- */

const _t = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _perp = new THREE.Vector3();
const _elbow = new THREE.Vector3();
const _up = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _hp = new THREE.Vector3();
const _bx = new THREE.Vector3();
const _by = new THREE.Vector3();
const _bz = new THREE.Vector3();
const _bm = new THREE.Matrix4();
// contact-fit scratch (build time only, but the no-allocation rule holds anyway)
const _fitInv = new THREE.Matrix4();
const _fitP = new THREE.Vector3();
const _fitD = new THREE.Vector3();
const _fitAxis = new THREE.Vector3();
const _fitAx0 = new THREE.Vector3();
const _fitM = new THREE.Matrix4();

/**
 * Orient a bone whose geometry runs along its local -Z so that -Z points along
 * `dir`, with local +Y rolled toward `up`.
 *
 * This deliberately does NOT use Object3D.lookAt(): for non-camera objects
 * lookAt aims local **+Z** at the target (so a -Z bone would point backwards),
 * and it interprets the target in WORLD space, which is wrong here because
 * every joint position is authored in the rig's local space.
 */
function aimBone(quat, dir, up) {
  _bz.copy(dir).multiplyScalar(-1).normalize(); // local +Z is opposite the bone
  _by.copy(up);
  _by.addScaledVector(_bz, -_by.dot(_bz));
  if (_by.lengthSq() < 1e-9) {
    // Degenerate roll reference: pick any axis that is not parallel to the bone.
    _by.set(0, 1, 0).addScaledVector(_bz, -_bz.y);
    if (_by.lengthSq() < 1e-9) _by.set(1, 0, 0).addScaledVector(_bz, -_bz.x);
  }
  _by.normalize();
  _bx.crossVectors(_by, _bz).normalize();
  _bm.makeBasis(_bx, _by, _bz);
  return quat.setFromRotationMatrix(_bm);
}

/**
 * One arm: shoulder -> upper -> fore -> hand, solved from the hand target.
 * All positions are expressed in the arm root's parent space (the viewmodel
 * rig's space), which is what makes the maths trivial.
 */
export class Arm {
  constructor(side, materials, opts = {}) {
    this.side = side; // -1 left, +1 right
    this.scale = opts.scale ?? 1;
    this.l1 = (opts.upper ?? L_UPPER) * this.scale;
    this.l2 = (opts.fore ?? L_FORE) * this.scale;

    this.root = new THREE.Object3D();
    this.root.name = side < 0 ? 'arm-left' : 'arm-right';
    /** Kept so `bakeSurfaceMasks` can classify a mesh by which surface it wears. */
    this._mats = materials;

    this.shoulder = new THREE.Vector3(
      side * (opts.shoulderX ?? 0.19),
      opts.shoulderY ?? -0.19,
      opts.shoulderZ ?? 0.12
    );
    /**
     * Elbow swing direction, in the ARM ROOT's space (= the viewmodel rig's
     * space), NOT in hand space.
     *
     * Expressing the pole in hand space is the intuitive choice and it is wrong:
     * the support hand is rolled palm-up on the handguard, so its local "down"
     * points at the sky and the elbow swings UP — straight through the near
     * plane, filling half the screen with forearm. Elbows go down and outboard,
     * always, exactly as they do on a real shooter.
     */
    this.pole = new THREE.Vector3(side * 0.46, -0.86, 0.22).normalize();

    // Bones. Geometry extends along -Z from each joint.
    // Sleeves: lofted cloth over each bone (see buildSleeve). Different fold
    // seeds per bone and per side, so the two arms never mirror each other.
    this.upper = buildSleeve(materials.sleeve, this.l1, 'upper', this.scale, side < 0 ? 11 : 23);
    this.fore = buildSleeve(materials.sleeve, this.l2, 'fore', this.scale, side < 0 ? 5 : 17);
    this.upperPivot = new THREE.Object3D();
    this.forePivot = new THREE.Object3D();
    this.upperPivot.add(this.upper);
    this.forePivot.add(this.fore);
    // Glove cuff (+ watch on the support wrist) rides the forearm bone. The
    // bone's +X is the thumb side on the left arm and the little-finger side on
    // the right, because only the right HAND is mirrored.
    this.cuff = buildCuff(materials, this.l2, this.scale, { watch: side < 0, radialSign: side < 0 ? 1 : -1 });
    this.forePivot.add(this.cuff);
    this.root.add(this.upperPivot);
    this.root.add(this.forePivot);

    // Hand.
    this.hand = new THREE.Object3D();
    this.hand.name = side < 0 ? 'hand-left' : 'hand-right';
    this.handInner = new THREE.Object3D();
    /**
     * CHIRALITY. The basis built by handBasis is right-handed with X = Y cross Z,
     * so for a hand whose fingers run along -Z and whose palm faces -Y, +X points
     * AWAY from the thumb on a right hand and TOWARD it on a left hand. The
     * geometry below puts the thumb at +X, which makes the authored mesh a LEFT
     * hand — so it is the RIGHT arm that needs the mirror, not the left.
     *
     * With this the wrong way round the shooting hand was a left hand on the
     * right side of the grip: the index (which setTrigger drives) came out at the
     * bottom-rear of the grip instead of on the trigger, and no choice of target
     * frame could fix it, because putting the thumb at the top of the grip forced
     * the fingers to wrap backwards around the back strap.
     */
    this.handInner.scale.x = side < 0 ? 1 : -1;
    this.hand.add(this.handInner);
    this.glove = buildGlove(materials, { scale: this.scale });
    this.handInner.add(this.glove);
    this.root.add(this.hand);

    // Fingers: index is separate so it can work the trigger.
    const fingerSpecs = [
      { x: 0.0298, len: [0.045, 0.028, 0.022], r: [0.0102, 0.0096, 0.0086, 0.0062] }, // index
      { x: 0.0102, len: [0.049, 0.031, 0.023], r: [0.0104, 0.0098, 0.0088, 0.0064] },
      { x: -0.0104, len: [0.046, 0.029, 0.022], r: [0.01, 0.0094, 0.0084, 0.006] },
      { x: -0.0298, len: [0.038, 0.024, 0.02], r: [0.0092, 0.0086, 0.0078, 0.0056] },
    ];
    this.fingers = [];
    // Per-segment dimensions, kept so `fitToCylinder` can walk the chain without
    // re-deriving them.
    this._segRadius = fingerSpecs.map((s) => s.r.map((v) => v * this.scale));
    this._segLength = fingerSpecs.map((s) => s.len.map((v) => v * this.scale));
    for (let i = 0; i < 4; i++) {
      const sp = fingerSpecs[i];
      const f = buildFinger(materials, {
        lengths: sp.len.map((v) => v * this.scale),
        radii: sp.r.map((v) => v * this.scale),
        curl: [0, 0, 0],
      });
      // The metacarpophalangeal joints sit on the PALMAR half of the hand, not on
      // its centre line. 3.5 mm dorsal put every finger's axis 10 mm further from
      // whatever the hand was gripping than the palm's own contact surface, so a
      // palm placed flush on a handguard still left the fingers hovering 8-14 mm
      // clear of it — the daylight the critique measured. -6 mm puts the finger
      // axis 8 mm off the palm's contact plane, which is one finger radius.
      f.root.position.set(sp.x * this.scale, -0.006 * this.scale, -0.096 * this.scale);
      // fingers fan out very slightly
      f.root.rotation.y = -sp.x * 2.2;
      this.glove.add(f.root);
      this.fingers.push(f);
    }
    this.thumb = buildThumb(materials, this.scale, THUMB);
    // The carpometacarpal joint is palmar and a little further into the hand than
    // the old placement: a thumb rooted on the hand's centre plane rotates in the
    // plane of the back of the hand, which is why the old one read as a spur.
    this.thumb.root.position.set(0.037 * this.scale, -0.009 * this.scale, -0.04 * this.scale);
    this.thumb.root.rotation.set(0.2, -0.95, -0.5);
    this.glove.add(this.thumb.root);

    // Same rule as the weapon: receive the world sun shadow, cast nothing.
    this.root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = true;
        o.frustumCulled = false;
      }
    });

    /**
     * Per-weapon pose overrides, written by `fitToCylinder`. `setPose` looks here
     * first, so a pose solved against one weapon's handguard cannot leak onto
     * another's — and, critically, a clip that swaps the support hand to 'open'
     * and back to 'clamp' restores the FITTED clamp, not the authored one.
     */
    this.poses = {};

    this.setPose(opts.pose ?? 'wrap');
  }

  /**
   * BUILD-TIME CONTACT SOLVE: clamp every fingertip onto a cylinder.
   *
   * The authored `clamp` curls were derived analytically from a 47 mm tube and
   * one nominal contact clock angle, and on paper they put the PIP, DIP and tip
   * all 8.2 mm off the surface. On screen they did not: in hero, detail, weapon
   * and ads the distal segments visibly stood clear of the handguard, because the
   * analytic solve ignored (a) the 0.88 Y-scale on the finger capsules, (b) the
   * -6 mm palmar offset of the MCP row, (c) the fan-out rotation on each finger
   * root and (d) the fact that the four fingers start at four different X, so
   * they meet the cylinder at four different clock angles.
   *
   * Rather than push more algebra at it, MEASURE it: pose the hand, walk the real
   * transform chain to each fingertip's contact patch, and search the distal
   * joint's own rotation for the value that lands the patch on the surface. That
   * is a raycast against the collision profile in all but name, and it is exact
   * by construction because it uses the same matrices the renderer will.
   *
   * The thumb is fitted the same way but wraps to the OPPOSITE side of the tube:
   * a C-clamp whose thumb is on the same side as the fingers is a fist held next
   * to the gun, not a grip on it.
   *
   * @param {THREE.Vector3}  handPos    wrist target, arm-root space
   * @param {THREE.Quaternion} handQuat wrist orientation
   * @param {number[]} axisPoint  a point on the cylinder axis, arm-root space
   * @param {number[]} axisDir    the cylinder axis direction
   * @param {number}   radius     cylinder radius
   * @param {object}   opts       { clearance, poseName }
   * @returns {THREE.Vector3[]}   contact points, arm-root space (for baked AO)
   */
  fitToCylinder(handPos, handQuat, axisPoint, axisDir, radius, opts = {}) {
    const clearance = opts.clearance ?? 0.001;
    const poseName = opts.poseName ?? this.pose;
    const base = this.poses[poseName] ?? HAND_POSES[poseName] ?? HAND_POSES.clamp;

    this.hand.position.copy(handPos);
    this.hand.quaternion.copy(handQuat);
    this.root.updateMatrixWorld(true);
    // Everything is measured in the ARM ROOT's space, so the result is
    // independent of wherever the rig happens to be this frame.
    _fitInv.copy(this.root.matrixWorld).invert();
    _fitAxis.set(axisDir[0], axisDir[1], axisDir[2]).normalize();
    const ax0 = _fitAx0.set(axisPoint[0], axisPoint[1], axisPoint[2]);

    /** Signed distance from a joint-local point to the cylinder surface. */
    const gapAt = (joint, lx, ly, lz, out) => {
      joint.updateWorldMatrix(true, true);
      _fitP.set(lx, ly, lz).applyMatrix4(joint.matrixWorld).applyMatrix4(_fitInv);
      if (out) out.copy(_fitP);
      _fitD.copy(_fitP).sub(ax0);
      _fitD.addScaledVector(_fitAxis, -_fitD.dot(_fitAxis));
      return _fitD.length() - radius;
    };

    /**
     * Scan a joint's flexion for the angle that puts `local` on the surface.
     *
     * A scan, not a bisection: the gap is not monotonic in curl (past ~110 deg
     * the tip starts coming back OUT the far side of the tube), so a bisection
     * can converge on the wrong root. 40 samples over the anatomical range is
     * 2.5 deg of resolution, which is 0.4 mm at the fingertip.
     */
    const fitJoint = (joint, local, lo, hi, standoff = 0) => {
      let best = joint.rotation.x;
      let bestCost = Infinity;
      for (let i = 0; i <= 48; i++) {
        const a = lo + ((hi - lo) * i) / 48;
        joint.rotation.x = a;
        const g = gapAt(joint, local[0], local[1], local[2]) - standoff;
        // Target: on the surface, up to `clearance` proud, at most 1.5 mm buried.
        const cost = Math.abs(g - clearance * 0.5) + (g < -0.0015 ? (-g - 0.0015) * 8 : 0);
        if (cost < bestCost) {
          bestCost = cost;
          best = a;
        }
      }
      joint.rotation.x = best;
      return best;
    };

    /**
     * Wrap all three joints, PROXIMAL FIRST.
     *
     * Fitting only the distal joint cannot wrap a cylinder: if the MCP and PIP
     * are authored for a different contact clock angle the finger traces the
     * wrong spiral, and the distal joint is then asked to close a gap it is 22 mm
     * long and physically cannot reach. Solving the chain outward — each joint
     * placing the NEXT joint's origin one finger-radius off the surface, then the
     * distal joint placing the actual contact patch on it — is what a finger does,
     * and it is stable because each stage only has one degree of freedom.
     */
    const fingers = [];
    const contacts = [];
    const skip = opts.skip ?? [];
    let triggerRest = null;
    for (let i = 0; i < 4; i++) {
      const f = this.fingers[i];
      const curl = base.fingers[i].slice();
      for (let j = 0; j < 3; j++) f.joints[j].rotation.x = -curl[j];
      if (skip.includes(i)) {
        /**
         * The trigger finger does not wrap: its distal pad goes ON the trigger
         * face. Same two-parameter search, scored by distance to that point.
         */
        if (opts.trigger && i === 0) {
          const ll0 = this._segLength[0];
          const rr0 = this._segRadius[0];
          const tp = new THREE.Vector3().fromArray(opts.trigger); // build time only
          let best = [0.55, 0.72, 0.34];
          let bestD = Infinity;
          for (let km = 0; km <= 30; km++) {
            const m = -0.2 + (km / 30) * 1.4;
            f.joints[0].rotation.x = -m;
            for (let k = 0; k <= 30; k++) {
              const a = (k / 30) * 1.6;
              f.joints[1].rotation.x = -a;
              f.joints[2].rotation.x = -a * 0.6;
              f.joints[2].updateWorldMatrix(true, false);
              _fitP.set(0, -rr0[3] * 1.05, -ll0[2] * 0.5).applyMatrix4(f.joints[2].matrixWorld).applyMatrix4(_fitInv);
              const d = _fitP.distanceTo(tp) + Math.abs(m - a * 0.6) * 0.002;
              if (d < bestD) {
                bestD = d;
                best = [m, a, a * 0.6];
              }
            }
          }
          triggerRest = best;
          for (let j = 0; j < 3; j++) f.joints[j].rotation.x = -best[j];
          fingers.push(best.slice());
        } else {
          fingers.push(curl);
        }
        continue;
      }
      const rr = this._segRadius?.[i] ?? [0.01, 0.0094, 0.0084, 0.006];
      const ll = this._segLength?.[i] ?? [0.046, 0.029, 0.022];
      /**
       * Wrap search. A finger closes on a tube with the PIP and DIP coupled
       * (DIP ~0.7 x PIP) and the MCP free, so scan those two parameters and
       * score the whole chain: every sample along the finger wants to
       * be one local radius off the surface, burying is punished hard, and the
       * fingertip pad counts double. Fitting the joints one at a time instead
       * converges on kinked, anatomically impossible curls.
       */
      const local = [0, -rr[3] * 1.05, -ll[2] * 0.5];
      let bestM = 0;
      let bestA = 0;
      let bestC = Infinity;
      const N = 36;
      for (let km = 0; km <= N; km++) {
        const m = (km / N) * 1.5;
        f.joints[0].rotation.x = -m;
        for (let k = 0; k <= N; k++) {
          const a = (k / N) * 1.6;
          f.joints[1].rotation.x = -a;
          f.joints[2].rotation.x = -a * 0.7;
          let cost = 0;
          for (let j = 0; j < 3; j++) {
            for (const u of [0.5, 1]) {
              const g = gapAt(f.joints[j], 0, 0, -ll[j] * u) - rr[j + (u === 1 ? 1 : 0)] * 0.95;
              cost += g < 0 ? -g * 12 : g * (j === 0 ? 0.4 : 1);
            }
          }
          const gt = gapAt(f.joints[2], local[0], local[1], local[2]);
          cost += gt < -0.001 ? (-gt - 0.001) * 12 : Math.abs(gt) * 2;
          // mild preference for a relaxed, even curl
          cost += Math.abs(m - a * 0.8) * 0.002;
          if (cost < bestC) {
            bestC = cost;
            bestM = m;
            bestA = a;
          }
        }
      }
      const R = [bestM, bestA, bestA * 0.7];
      for (let j = 0; j < 3; j++) {
        curl[j] = R[j];
        f.joints[j].rotation.x = -curl[j];
      }
      fingers.push(curl);
      const p = new THREE.Vector3();
      gapAt(f.joints[2], local[0], local[1], local[2], p);
      contacts.push(p);
    }

    /**
     * ---- thumb: over the top and down the FAR side --------------------------
     *
     * THE THUMB BASE IS SOLVED TOO, and it has to be.
     *
     * MEASURED on the shipped build by walking the real transform chain: the four
     * fingertips landed 0.4-0.7 mm off the handguard — a genuine grip — and the
     * THUMB TIP was 13.5 mm clear of it. The thumb is the part of the support hand
     * that lies across the top of the handguard and therefore the part the camera
     * sees most of in the hipfire pose, so that 13.5 mm was most of "fingers do not
     * wrap the grip, they float beside it with a visible gap".
     *
     * The cause is that the two flexion joints were being fitted against a base
     * rotation that was AUTHORED, not solved. The thumb's carpometacarpal joint is
     * a saddle with two useful degrees of freedom and the authored abduction was
     * aimed for a different contact clock angle; with the metacarpal pointing past
     * the tube, 68 mm of thumb flexing on two hinges cannot reach it, and the scan
     * just parks both joints at their limits.
     *
     * So the base's Y (abduction — the axis that swings the thumb across the palm)
     * is scanned first, coarsely, for the value that brings the tip closest, and
     * only then are the two flexion joints fitted. One extra degree of freedom,
     * 24 samples, build time only.
     */
    const thumbBase = (base.thumbBase ?? [0, 0, 0]).slice();
    const thumb = (base.thumb ?? [0.3, 0.24]).slice();
    this.thumb.root.rotation.fromArray(thumbBase);
    this.thumb.joints[0].rotation.x = -thumb[0];
    this.thumb.joints[1].rotation.x = -thumb[1];
    const tr = THUMB.r2 * this.scale;
    const tlen = THUMB.l1 * this.scale;
    const tLocal = [0, -tr * 1.05, -tlen * 0.55];
    {
      // Mid-flex the two hinges while the base is searched, so the scan measures
      // where a naturally curled thumb would land rather than where a straight
      // one would.
      this.thumb.joints[0].rotation.x = -0.55;
      this.thumb.joints[1].rotation.x = -0.45;
      const y0 = thumbBase[1];
      const z0 = thumbBase[2];
      let bestY = y0;
      let bestZ = z0;
      let bestCost = Infinity;
      // Two axes, not one. MEASURED: scanning abduction alone still left the tip
      // 13.2 mm clear, because from a metacarpal root sitting 40-55 mm off a 54 mm
      // tube a 68 mm thumb only reaches if it is aimed at the surface in BOTH the
      // across-the-palm and the up-off-the-palm sense. 21 x 15 samples, build time.
      for (let i = 0; i <= 20; i++) {
        const yy = y0 - 1.3 + (2.6 * i) / 20;
        for (let k = 0; k <= 14; k++) {
          const zz = z0 - 0.9 + (1.8 * k) / 14;
          this.thumb.root.rotation.y = yy;
          this.thumb.root.rotation.z = zz;
          const g = gapAt(this.thumb.joints[1], tLocal[0], tLocal[1], tLocal[2]);
          // Prefer just-touching; punish burying much harder than standing off, and
          // add a small pull toward the authored pose so the solve stays plausible.
          const cost =
            Math.abs(g - clearance) +
            (g < -0.002 ? (-g - 0.002) * 10 : 0) +
            (Math.abs(yy - y0) + Math.abs(zz - z0)) * 0.0009;
          if (cost < bestCost) {
            bestCost = cost;
            bestY = yy;
            bestZ = zz;
          }
        }
      }
      this.thumb.root.rotation.y = bestY;
      this.thumb.root.rotation.z = bestZ;
      thumbBase[1] = bestY;
      thumbBase[2] = bestZ;
    }
    const a0 = fitJoint(
      this.thumb.joints[0],
      [0, 0, -THUMB.l0 * this.scale],
      -1.45,
      -0.02,
      THUMB.r1 * this.scale
    );
    thumb[0] = -a0;
    const a1 = fitJoint(this.thumb.joints[1], tLocal, -1.6, -0.05, 0);
    thumb[1] = -a1;
    const tp = new THREE.Vector3();
    gapAt(this.thumb.joints[1], tLocal[0], tLocal[1], tLocal[2], tp);
    contacts.push(tp);

    this.poses[poseName] = { fingers, thumb, thumbBase, triggerRest };
    this.pose = poseName;
    return contacts;
  }

  /**
   * BAKE CURVATURE MASKS ON THE WHOLE LIMB.
   *
   * This is the fix for "a huge UNTEXTURED tan tube" and "a rounded mitten of
   * stacked extruded ring segments".
   *
   * Every weapon mesh has had wear/grime/AO vertex masks baked since the first
   * build (see Viewmodel.addWeapon) — the arms never did. Their `color`
   * attribute was absent, so the shader read vColor = (0,0,0) and the wear,
   * grime and cavity-AO layers of `sleeve`, `glove`, `glove_pad` and
   * `glove_seam` were ALL switched off. Every one of those materials carries a
   * carefully tuned wear amplitude, a grime colour and an AO term that had
   * literally no effect on a single pixel: the arm was a flat albedo under a
   * smooth specular lobe, which is exactly what "untextured tube" means.
   *
   * Amplitudes are per surface class, because cloth, moulded TPR and a stitched
   * seam weather in completely different ways:
   *   cloth   broad, soft. The exponent stays LOW (1.6) so the mask spreads off
   *           the fold crease and dusts the whole crown — on fabric the dirt is
   *           not confined to the outer millimetre the way it is on a chamfer.
   *   pads    harder: a TPR knuckle cap polishes on its dome and collects grime
   *           in the flex gap around it, so wear is high and tight.
   *   seams   a proud sewn edge is the FIRST thing to go pale, so it takes the
   *           most wear of anything on the hand at the tightest exponent.
   *
   * @param {(geo: THREE.BufferGeometry, o: object) => void} bake   materials.bakeMasks
   * @param {(geo: THREE.BufferGeometry, o: object) => void} shape  mask re-shaper
   * @param {object} rng
   */
  bakeSurfaceMasks(bake, shape, rng = null) {
    if (!bake) return this;
    const m = this._mats ?? {};
    const CLOTH = { wearAmp: 0.5, wearExp: 1.6, grimeAmp: 1.0, grimeExp: 1.15, aoAmp: 0.9, aoExp: 1.1 };
    const SLEEVE = { wearAmp: 0.62, wearExp: 1.5, grimeAmp: 1.0, grimeExp: 1.0, aoAmp: 0.95, aoExp: 1.0 };
    const PAD = { wearAmp: 0.85, wearExp: 2.2, grimeAmp: 0.95, grimeExp: 1.4, aoAmp: 1.0, aoExp: 1.2 };
    const SEAM = { wearAmp: 1.0, wearExp: 2.6, grimeAmp: 0.7, grimeExp: 1.6, aoAmp: 0.8, aoExp: 1.2 };
    const done = new Set();
    this.root.traverse((o) => {
      if (!o.isMesh || done.has(o.geometry)) return;
      done.add(o.geometry);
      const prof =
        o.material === m.sleeve ? SLEEVE
          : o.material === m.pad ? PAD
            : o.material === m.seam ? SEAM
              : CLOTH;
      // A lower edge threshold than the weapon's 0.16: the limb is all lathes and
      // blobs, so its creases are gentle and a hard-edge threshold finds nothing.
      bake(o.geometry, { wear: 1, grime: 1, ao: 1, edgeThreshold: 0.09, rng });
      shape(o.geometry, prof);
    });
    return this;
  }

  /**
   * Bake a contact-AO gradient into the GLOVE side of each contact.
   *
   * Geometric contact alone does not read as contact: two surfaces can be 0.5 mm
   * apart and still look like two floating objects, because nothing in the
   * lighting says they occlude each other. The cheap, correct cue is ambient
   * occlusion in the crevice — so the glove gets the same 0.55 multiply over a
   * 12 mm falloff that the handguard gets (see Viewmodel.addWeapon).
   *
   * The mask goes in vColor.b, which `materials/shader.js` uses as
   * `orm.r *= 1.0 - vColor.b * wear[2]`. The glove geometry carries no colour
   * attribute today, so the shader sees (0,0,0) — wear and grime OFF. Writing
   * (0, 0, ao) preserves that exactly and only lights up the AO term.
   *
   * @param {THREE.Vector3[]} contacts  contact points in arm-root space
   */
  bakeContactAO(contacts, radius = 0.012, peak = 0.9) {
    if (!contacts?.length) return this;
    this.root.updateMatrixWorld(true);
    _fitInv.copy(this.root.matrixWorld).invert();
    const r2 = radius * radius;
    this.glove.traverse((o) => {
      if (!o.isMesh) return;
      const geo = o.geometry;
      const pos = geo.getAttribute('position');
      if (!pos) return;
      let col = geo.getAttribute('color');
      if (!col || col.itemSize !== 3) {
        col = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
        geo.setAttribute('color', col);
      }
      _fitM.multiplyMatrices(_fitInv, o.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        _fitP.fromBufferAttribute(pos, i).applyMatrix4(_fitM);
        let closest = Infinity;
        for (const c of contacts) {
          const d2 = _fitP.distanceToSquared(c);
          if (d2 < closest) closest = d2;
        }
        if (closest > r2) continue;
        const t = 1 - Math.sqrt(closest) / radius;
        // smootherstep so the gradient has no visible terminator
        const s = t * t * t * (t * (t * 6 - 15) + 10);
        col.array[i * 3 + 2] = Math.max(col.array[i * 3 + 2], peak * s);
      }
      col.needsUpdate = true;
    });
    return this;
  }

  /** Static finger poses. The trigger finger is driven separately. */
  setPose(name) {
    const P = this.poses?.[name] ?? HAND_POSES[name] ?? HAND_POSES.wrap;
    for (let i = 0; i < 4; i++) {
      const curl = P.fingers[i];
      for (let j = 0; j < 3; j++) this.fingers[i].joints[j].rotation.x = -curl[j];
    }
    this.thumb.joints[0].rotation.x = -P.thumb[0];
    this.thumb.joints[1].rotation.x = -P.thumb[1];
    if (P.thumbBase) this.thumb.root.rotation.fromArray(P.thumbBase);
    this.pose = name;
    return this;
  }

  /** Trigger-finger curl, 0 = off the trigger, 1 = fully pressed. */
  setTrigger(t) {
    const f = this.fingers[0];
    // Rest pose: solved onto the trigger face per weapon (fitToCylinder with a
    // `trigger` target), else the authored grip value. Pressing curls from it.
    const r = this.poses?.[this.pose]?.triggerRest ?? TRIGGER_REST;
    f.joints[0].rotation.x = -(r[0] + t * 0.12);
    f.joints[1].rotation.x = -(r[1] + t * 0.3);
    f.joints[2].rotation.x = -(r[2] + t * 0.22);
  }

  /**
   * Solve the two-bone chain so the hand lands exactly on `targetPos` with
   * orientation `targetQuat`, elbow swung toward the pole.
   */
  solve(targetPos, targetQuat) {
    this.hand.position.copy(targetPos);
    this.hand.quaternion.copy(targetQuat);

    _t.copy(targetPos).sub(this.shoulder);
    let d = _t.length();
    const maxD = (this.l1 + this.l2) * 0.995;
    const minD = Math.abs(this.l1 - this.l2) * 1.05 + 1e-4;
    if (d > maxD) {
      _t.multiplyScalar(maxD / d);
      d = maxD;
    } else if (d < minD) {
      if (d < 1e-5) _t.set(0, 0, -minD);
      else _t.multiplyScalar(minD / d);
      d = minD;
    }
    _dir.copy(_t).divideScalar(d);

    // Circle of possible elbow positions; pick the point toward the pole.
    const a = (this.l1 * this.l1 - this.l2 * this.l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, this.l1 * this.l1 - a * a));
    _pole.copy(this.pole);
    _perp.copy(_pole).addScaledVector(_dir, -_pole.dot(_dir));
    if (_perp.lengthSq() < 1e-8) {
      _perp.set(this.side, -1, 0).addScaledVector(_dir, 0);
      _perp.addScaledVector(_dir, -_perp.dot(_dir));
    }
    _perp.normalize();
    _elbow.copy(this.shoulder).addScaledVector(_dir, a).addScaledVector(_perp, h);

    // Upper arm: shoulder -> elbow. The elbow pad sits on the bone's +Y, which
    // must end up on the OUTSIDE of the bend — that is the pole side.
    this.upperPivot.position.copy(this.shoulder);
    _hp.copy(_elbow).sub(this.shoulder);
    if (_hp.lengthSq() > 1e-12) aimBone(this.upperPivot.quaternion, _hp, _perp);

    // Forearm: elbow -> wrist, rolled with the back of the hand so the cuff and
    // the wrist line up with the glove.
    this.forePivot.position.copy(_elbow);
    _up.set(0, 1, 0).applyQuaternion(targetQuat);
    _hp.copy(targetPos).sub(_elbow);
    if (_hp.lengthSq() > 1e-12) aimBone(this.forePivot.quaternion, _hp, _up);
    return this;
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
    });
  }
}

/**
 * Finger curls per pose, in radians per joint (proximal, middle, distal).
 * These are read straight off reference photos of a firing grip: the little
 * finger curls hardest, the index rides the trigger, the thumb wraps high.
 */
const TRIGGER_REST = [0.55, 0.72, 0.34];

export const HAND_POSES = {
  /** Firing grip on a pistol grip. */
  grip: {
    /**
     * Firing grip on the pistol grip. The three lower fingers wrap ~180 deg of a
     * 31 x 34 mm grip section, which is 2.9-3.2 rad of total flexion — with the
     * MCP carrying the most, because that is the joint that gets the finger round
     * the front strap. The index is the trigger finger and is driven separately
     * by setTrigger(); the value here is its rest pose, taking up the slack on
     * the trigger face.
     */
    fingers: [
      [0.55, 0.72, 0.34],
      [1.15, 1.2, 0.62],
      [1.2, 1.25, 0.65],
      [1.22, 1.28, 0.66],
    ],
    thumb: [0.5, 0.34],
    thumbBase: [0.15, -1.02, -0.62],
  },
  /** Support hand wrapped around a handguard. */
  wrap: {
    fingers: [
      [1.18, 1.05, 0.45],
      [1.26, 1.12, 0.5],
      [1.3, 1.16, 0.55],
      [1.34, 1.2, 0.6],
    ],
    thumb: [0.42, 0.3],
    thumbBase: [0.1, -1.15, -0.35],
  },
  /**
   * C-clamp on a handguard: the modern support grip, and the only one whose
   * knuckle line turns toward the camera.
   *
   * The proximal curls are what decide whether the hand CLOSES. Summed over the
   * three joints each finger has to sweep the arc from the contact clock angle,
   * round the tube, to the far side: for a 47 mm handguard gripped 14 mm off the
   * surface that is 150-165 deg, i.e. 2.6-2.9 rad total. Anything less and the
   * fingertips stop in mid-air short of the far side, which is the "detached grey
   * slabs with daylight between them and the handguard" failure.
   *
   * The little finger curls hardest (it is shortest and has the least tube to
   * cross); the index sits proudest because it is closest to the thumb web.
   */
  clamp: {
    /**
     * SOLVED, per joint, against the rifle's 47 mm handguard.
     *
     * A uniform curl ratio cannot wrap a cylinder: it traces a spiral, so if the
     * middle joint touches, the fingertip stands 20 mm off. These numbers come
     * out of a per-joint bisection that puts the PIP, the DIP and the fingertip
     * all exactly 8.2 mm from the handguard surface — one finger radius, i.e. the
     * glove skin in contact with a 0-1 mm interpenetration the whole way round.
     *
     * The distribution that falls out (MCP ~0.6, PIP ~1.2, DIP ~0.8) is also what
     * a real hand does on a tube: the middle joint carries most of the wrap. And
     * the LONGEST finger curls most, not the little one — the "little finger
     * curls hardest" rule is a tapered-pistol-grip rule and is wrong here.
     */
    fingers: [
      [0.612, 1.059, 0.797],
      [0.731, 1.286, 0.863],
      [0.73, 1.268, 0.808],
      [0.601, 1.105, 0.684],
    ],
    // Thumb laid ACROSS the top of the handguard rather than forward into space.
    // The thumb root sits at the heel of the palm, which on a C-clamp stands ~50
    // mm off a 47 mm tube (unavoidable: a 98 mm palm tangent to a 23.5 mm radius
    // diverges), so a forward-pointing thumb hangs in mid-air. Aimed at the tube
    // it bridges that gap and closes the silhouette.
    thumb: [0.3, 0.24],
    thumbBase: [0.04, 0.76, -0.05],
  },
  /** Two-handed pistol grip: support hand cups the shooting hand. */
  cup: {
    fingers: [
      [1.05, 0.95, 0.4],
      [1.12, 1.0, 0.44],
      [1.16, 1.04, 0.48],
      [1.2, 1.08, 0.52],
    ],
    thumb: [0.28, 0.2],
    thumbBase: [0.0, -1.25, -0.2],
  },
  /** Open hand: mag grab, charging handle, inspect. */
  open: {
    fingers: [
      [0.35, 0.28, 0.14],
      [0.32, 0.26, 0.12],
      [0.34, 0.28, 0.14],
      [0.4, 0.32, 0.16],
    ],
    thumb: [0.12, 0.1],
    thumbBase: [0.1, -0.8, -0.35],
  },
  /** Pinch: holding the charging handle or a magazine by its spine. */
  pinch: {
    fingers: [
      [0.95, 0.85, 0.55],
      [1.0, 0.9, 0.6],
      [0.7, 0.6, 0.35],
      [0.6, 0.5, 0.3],
    ],
    thumb: [0.62, 0.55],
    thumbBase: [0.25, -0.75, -0.7],
  },
};
