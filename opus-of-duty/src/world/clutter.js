import * as THREE from 'three';
import { Rng } from '../core/rng.js';
import { worldOf, ryOf, BOX_FINE, LL } from './kit.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { catenaryTube, fbm3, paintMasks, rockGeometry, chamferBox } from './util.js';
import { mergeSimple } from './kit.js';
import { isOpen, groundY } from './dressing.js';

/**
 * WORLD — close-range clutter.
 *
 * The pass that turns a clean blockout into a lived-in street at the 1-5 m
 * range a CoD frame is judged at:
 *
 *   - the WALL FOOT: a continuous, uneven line of grit, rubble, paper, bin bags
 *     and flattened cardboard along every facade that faces open ground. A wall
 *     that meets the street on a ruled line is the single loudest "game level"
 *     tell in a wide shot;
 *   - SERVICE CABLES: bundles of 1-2 cm cable clipped along every street
 *     facade above the ground-floor openings, dropping to meter boxes by the
 *     doors and looping between AC units — the wiring that is on every wall in
 *     the region and in every Middle-East CoD map;
 *   - TRASH: bin-bag piles in the corners, the heaviest clutter mass after the
 *     cover props.
 *
 * Everything here runs on its own fixed-seed streams, never the level rng, so
 * adding or tuning it does not re-roll a single existing placement. `density`
 * (from the quality preset) thins every pass: the chromebook tier gets about
 * half the items and the thinnest cable bundles.
 *
 * Nothing here gets collision: it is all ankle-height or on walls, and adding
 * proxies would change player movement and line of sight.
 */

const _m = new THREE.Matrix4();

// ============================================================== prototypes ==
/**
 * A black polythene bin bag: a lumpy, settled mass with a flat bottom, a
 * gathered neck with a tied tuft, and sharp creases where the film folds.
 * Smooth spheres are the beanbag tell; the creases and the knot are the read.
 */
function binBag(rng, s = 0.5) {
  // welded, so the film shades smooth between its creases instead of faceted
  const ico = new THREE.IcosahedronGeometry(0.5, 2);
  ico.deleteAttribute('normal');
  ico.deleteAttribute('uv');
  const g = mergeVertices(ico, 1e-4);
  ico.dispose();
  const pa = g.getAttribute('position');
  const v = new THREE.Vector3();
  const seed = rng.float() * 50;
  for (let i = 0; i < pa.count; i++) {
    v.fromBufferAttribute(pa, i);
    const n = fbm3(v.x * 3.2 + seed, v.y * 3.2, v.z * 3.2 + seed, 3);
    // creases: a ridged term (1 - |2n-1|) is a fold, not a bump
    const r = fbm3(v.x * 7 + seed, v.y * 7 + 3, v.z * 7, 2);
    const crease = 1 - Math.abs(r * 2 - 1);
    let f = 0.86 + n * 0.3 - crease * crease * 0.06;
    v.multiplyScalar(f);
    // settled: wide, flat-bottomed, slumped
    v.y *= 0.72;
    if (v.y < -0.18) v.y = -0.18 - (v.y + 0.18) * 0.12;
    // the neck: pinch the crown toward a point
    if (v.y > 0.12) {
      const t = (v.y - 0.12) / 0.3;
      v.x *= 1 - t * 0.55;
      v.z *= 1 - t * 0.55;
    }
    pa.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const list = [g];
  // tied tuft: two ears of film above the knot
  for (let k = 0; k < 2; k++) {
    const ear = new THREE.ConeGeometry(0.05, 0.16, 5, 1);
    ear.applyMatrix4(
      _m.makeRotationZ((k ? -1 : 1) * rng.range(0.3, 0.7)).setPosition((k ? 1 : -1) * 0.03, 0.4, 0)
    );
    list.push(ear);
  }
  const knot = new THREE.IcosahedronGeometry(0.045, 0);
  knot.translate(0, 0.33, 0);
  list.push(knot);
  const out = mergeSimple(list);
  for (const p of list) p.dispose();
  out.scale(s, s, s);
  out.computeBoundingBox();
  const lo = out.boundingBox.min.y;
  out.translate(0, -lo - 0.01, 0);
  paintMasks(out, (x, y, z, nx, ny, nz, o) => {
    // dust on the shoulders, filth where it sits on the street
    const h = y / (s * 0.6);
    o[0] = 0.15 + Math.max(0, ny) * 0.35;
    o[1] = 0.25 + Math.max(0, 1 - h * 2.2) * 0.65;
    o[2] = Math.max(0, 1 - h * 3) * 0.6;
  });
  return out;
}

/**
 * A flattened cardboard box: a sheet with two fold lines and one flap bent up,
 * lying where it was dropped. Cardboard is the most common litter in every
 * reference frame and the old litter quads were too small to register.
 */
function flatCard(rng) {
  const w = rng.range(0.55, 0.85);
  const d = rng.range(0.4, 0.6);
  const g = new THREE.PlaneGeometry(w, d, 6, 4);
  g.rotateX(-Math.PI / 2);
  const pa = g.getAttribute('position');
  const flap = rng.range(0.25, 0.5);
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i);
    const z = pa.getZ(i);
    let y = (fbm3(x * 4, z * 4, 2.2, 2) - 0.5) * 0.02;
    // one end flap lifting off the ground
    const u = (x / w + 0.5 - (1 - flap * 0.4)) / (flap * 0.4);
    if (u > 0) y += u * u * 0.06;
    pa.setY(i, y + 0.006);
  }
  g.computeVertexNormals();
  // a second sheet: a torn flap lying across it
  const t = new THREE.PlaneGeometry(w * 0.45, d * 0.6, 2, 2);
  t.rotateX(-Math.PI / 2);
  t.applyMatrix4(_m.makeRotationY(rng.range(-0.6, 0.6)).setPosition(rng.range(-0.1, 0.1), 0.016, rng.range(-0.1, 0.1)));
  const out = mergeSimple([g, t]);
  g.dispose();
  t.dispose();
  paintMasks(out, (x, y, z, nx, ny, nz, o) => {
    const n = fbm3(x * 6, z * 6, 1.3, 2);
    o[0] = 0.3 + n * 0.3;
    o[1] = 0.35 + Math.max(0, n - 0.45) * 1.2;
    o[2] = 0.15;
  });
  return out;
}

/**
 * A strip of wall-foot rubble: 1.2 m of broken render, block fragments and
 * grit piled against a wall, as ONE instance. Built along +X with the wall at
 * z = 0 and the scatter thinning out to z = 0.5. Real wall feet are a
 * continuous grade of particle sizes — a few fist-sized chunks, a lot of
 * gravel — which is exactly what separate instanced rocks never achieve.
 */
function rubbleStrip(rng) {
  const list = [];
  const n = 30;
  for (let i = 0; i < n; i++) {
    const t = rng.float();
    // size distribution: mostly grit, a few chunks
    const big = rng.float() < 0.18;
    const size = big ? rng.range(0.07, 0.14) : rng.range(0.018, 0.05);
    const g = rockGeometry(rng, size, 0, rng.range(0.45, 0.8));
    // piled against the wall: big pieces closer in, grit spread out
    const z = Math.pow(rng.float(), big ? 2.2 : 1.3) * 0.5 + 0.02;
    g.applyMatrix4(
      _m.makeRotationY(rng.float() * 6.28).setPosition((t - 0.5) * 1.2, size * 0.18, z)
    );
    list.push(g);
  }
  // flakes of fallen render: thin, pale, flat-lying shards
  for (let i = 0; i < 6; i++) {
    const s = rng.range(0.05, 0.12);
    const g = chamferBox(s, rng.range(0.008, 0.016), s * rng.range(0.5, 1.2), 0.003);
    g.applyMatrix4(
      _m
        .makeRotationFromEuler(new THREE.Euler(rng.range(-0.25, 0.25), rng.float() * 6.28, rng.range(-0.25, 0.25)))
        .setPosition(rng.range(-0.55, 0.55), 0.006, rng.range(0.03, 0.35))
    );
    list.push(g);
  }
  const out = mergeSimple(list);
  for (const p of list) p.dispose();
  paintMasks(out, (x, y, z, nx, ny, nz, o) => {
    o[0] = 0.55 + fbm3(x * 9, y * 9, z * 9, 2) * 0.4;
    o[1] = 0.35 + Math.max(0, -ny) * 0.5;
    o[2] = Math.max(0, 0.03 - y) * 12;
  });
  return out;
}

/**
 * Dust and grit fillet against a wall foot: a long low ridge, wall at z = 0,
 * feathering out to ~0.35 m, with a scalloped toe. Unit length 1.5 m.
 */
function footFillet(rng) {
  const nx = 10;
  const nz = 3;
  const len = 1.5;
  const pos = [];
  const idx = [];
  const seed = rng.float() * 20;
  for (let i = 0; i <= nx; i++) {
    const u = i / nx;
    const x = (u - 0.5) * len;
    const taper = Math.min(1, Math.min(u, 1 - u) * 5);
    const ch = 0.045 * (0.5 + fbm3(x * 1.7 + seed, 1.1, seed, 2)) * taper;
    const cw = 0.35 * (0.6 + 0.8 * fbm3(x * 1.3 + seed, 4.2, 2.1, 2));
    for (let j = 0; j <= nz; j++) {
      const v = j / nz;
      pos.push(x, Math.max(0, ch * Math.cos((v * Math.PI) / 2) ** 1.6) + 0.004, 0.01 + v * cw);
    }
  }
  const row = nz + 1;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const a = i * row + j;
      idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  paintMasks(g, (x, y, z, nx2, ny, nz2, o) => {
    o[0] = 0.05;
    o[1] = 0.55 + 0.4 * Math.max(0, 1 - z / 0.2);
    o[2] = 0.35 + 0.5 * Math.max(0, 1 - z / 0.15);
  });
  return g;
}

/**
 * A wall-mounted electricity meter box with a cable gland under it — the
 * anchor every service drop on a facade runs to.
 */
function meterBox() {
  const list = [];
  const body = chamferBox(0.32, 0.42, 0.14, 0.012);
  list.push(body);
  const lid = chamferBox(0.28, 0.36, 0.015, 0.004);
  lid.translate(0, 0.01, 0.075);
  list.push(lid);
  const win = chamferBox(0.1, 0.07, 0.01, 0.002);
  win.translate(0, 0.08, 0.085);
  list.push(win);
  const hood = chamferBox(0.36, 0.03, 0.18, 0.006);
  hood.translate(0, 0.225, 0.01);
  list.push(hood);
  const gland = new THREE.CylinderGeometry(0.025, 0.03, 0.06, 6, 1);
  gland.translate(0, -0.24, 0);
  list.push(gland);
  const g = mergeSimple(list);
  for (const p of list) p.dispose();
  paintMasks(g, (x, y, z, nx, ny, nz, o) => {
    o[0] = 0.8;
    o[1] = 0.45 + Math.max(0, -y) * 1.2 + Math.max(0, -ny) * 0.3;
    o[2] = 0.1;
  });
  return g;
}

export function registerClutterProps(A) {
  const rng = new Rng(0xc1077e5);
  const P = (id, key, geo, opts = {}) => A.proto(id, { geo, key, ...opts });
  const LOOSE = (tilt, sink) => ({ tilt, sink });
  P('bin_bag_a', 'plastic_black', binBag(rng, 0.62), { maxDist: 70, ...LOOSE(0.1, 0.02) });
  P('bin_bag_b', 'plastic_black', binBag(rng, 0.5), { maxDist: 70, ...LOOSE(0.12, 0.02) });
  P('bin_bag_w', 'plastic_white', binBag(rng, 0.46), { maxDist: 70, ...LOOSE(0.12, 0.02) });
  P('card_flat', 'cardboard', flatCard(rng), { maxDist: 55, castShadow: false });
  P('card_flat_b', 'cardboard', flatCard(rng), { maxDist: 55, castShadow: false });
  P('rubble_strip', 'concrete_dark', rubbleStrip(rng), { maxDist: 60, castShadow: false });
  P('rubble_strip_b', 'concrete_prop', rubbleStrip(rng), { maxDist: 60, castShadow: false });
  P('foot_fillet', 'dust_skirt', footFillet(rng), { maxDist: 70, castShadow: false });
  P('meter_box', 'metal_painted_grey', meterBox(), { maxDist: 60 });
}

// ================================================================== passes ==
/** Is a panel-space x on this facade in front of a door or shop opening? */
function inOpening(fa, x, pad = 0.2) {
  for (const o of fa.openings) {
    if ((o.kind === 'door' || o.kind === 'shop' || o.kind === 'balconyDoor') && Math.abs(x - o.x) < o.w / 2 + pad) {
      return true;
    }
  }
  return false;
}

/**
 * Litter, grit and rubble along the foot of every ground-floor facade that
 * faces open ground.
 */
function wallFoot(A, rng, infos, density) {
  for (const info of infos) {
    for (const fa of info.facades) {
      if (fa.f !== 0) continue;
      const ry = ryOf(fa.pm) + Math.PI;
      const half = fa.len / 2;
      // street fronts are swept now and then; side walls and backs are not
      const dirt = fa.street ? 0.8 : fa.openFace ? 1.0 : 1.15;
      // 1) the dust fillet: near-continuous, it is what kills the ruled line
      for (let x = -half + 0.5; x < half - 0.4; x += rng.range(1.0, 1.5)) {
        if (rng.float() > 0.85 * density + 0.1) continue;
        const wp = worldOf(fa.pm, x, 0, -0.06);
        if (!isOpen(wp[0], wp[2], 0.05)) continue;
        if (inOpening(fa, x, -0.2) && rng.float() < 0.7) continue;
        A.putS('foot_fillet', wp[0], groundY(wp[0], wp[2]), wp[2], ry, rng.range(0.8, 1.15), rng.range(0.7, 1.4), rng.range(0.7, 1.3), [1, rng.range(0.9, 1.4), 1]);
      }
      // 2) rubble, paper, bags and singles, walking the wall
      let x = -half + rng.range(0.2, 0.9);
      while (x < half - 0.3) {
        const step = rng.range(0.55, 1.6) / (density * dirt);
        const pick = rng.float();
        const door = inOpening(fa, x);
        const off = 0.06 + Math.abs(rng.gauss()) * 0.22;
        const wp = worldOf(fa.pm, x, 0, -off);
        const px = wp[0];
        const pz = wp[2];
        x += step;
        if (!isOpen(px, pz, 0.08)) continue;
        const y = groundY(px, pz);
        const yaw = rng.float() * 6.28;
        if (pick < 0.3) {
          if (door) continue;
          // strips lie along the wall
          const w0 = worldOf(fa.pm, x - step, 0, -0.04);
          A.putS(rng.float() < 0.6 ? 'rubble_strip' : 'rubble_strip_b', w0[0], groundY(w0[0], w0[2]) - 0.004, w0[2], ry + rng.range(-0.12, 0.12), rng.range(0.7, 1.2), rng.range(0.7, 1.3), rng.range(0.6, 1.1), [1, rng.range(1, 1.5), 1]);
        } else if (pick < 0.5) {
          A.put('litter', px, y + 0.012, pz, yaw, rng.range(0.8, 1.4), [1, rng.range(1.0, 1.6), 1]);
          if (rng.float() < 0.6) {
            const w2 = worldOf(fa.pm, x - step * 0.5, 0, -off * 1.6);
            if (isOpen(w2[0], w2[2], 0.05)) A.put('litter', w2[0], groundY(w2[0], w2[2]) + 0.012, w2[2], rng.float() * 6.28, rng.range(0.7, 1.2), [1, 1.4, 1]);
          }
        } else if (pick < 0.62) {
          A.put(rng.float() < 0.5 ? 'card_flat' : 'card_flat_b', px, y + 0.004, pz, ry + rng.range(-0.5, 0.5), rng.range(0.8, 1.15), [1, rng.range(1.0, 1.6), 1]);
        } else if (pick < 0.72) {
          if (door) continue;
          // a bag pile: 1-4, leaning on the wall and on each other
          const n = 1 + Math.floor(rng.float() * rng.float() * 4);
          for (let k = 0; k < n; k++) {
            const bw = worldOf(fa.pm, x - step + rng.range(-0.35, 0.35), 0, -rng.range(0.25, 0.45));
            if (!isOpen(bw[0], bw[2], 0.05)) continue;
            const id = rng.float() < 0.78 ? (rng.float() < 0.5 ? 'bin_bag_a' : 'bin_bag_b') : 'bin_bag_w';
            A.put(id, bw[0], groundY(bw[0], bw[2]) + (k > 1 ? 0.18 : 0), bw[2], rng.float() * 6.28, rng.range(0.85, 1.15), [1, rng.range(1.0, 1.5), 1]);
          }
        } else if (pick < 0.84) {
          A.put(rng.pick(['can', 'bottle', 'can']), px, y + 0.01, pz, yaw, 1, [1, 1.3, 1]);
        } else if (pick < 0.94) {
          A.put(rng.pick(['brick_a', 'brick_b', 'rock_b', 'cinder']), px, y + 0.01, pz, yaw, rng.range(0.6, 1.0), [1, 1.4, 1]);
        } else {
          A.put(rng.pick(['plank_b', 'box_card_b', 'bucket', 'tyre_small']), px, y + 0.01, pz, yaw, rng.range(0.8, 1.0), [1, 1.4, 1]);
        }
      }
    }
  }
}

/**
 * Service cable runs on the street facades: a bundle clipped along the wall
 * above the ground-floor openings, sagging a few centimetres between clips,
 * with drops to a meter box beside each door and the odd loop to an upper
 * floor. Merged into the static 'cable' batch: no draw calls per run.
 */
function facadeCables(A, rng, infos, density) {
  for (const info of infos) {
    for (const fa of info.facades) {
      if (!fa.openFace) continue;
      if (fa.f > 1) continue;
      if (rng.float() > 0.55 + 0.35 * density) continue;
      const half = fa.len / 2;
      // height of the run: above the shop heads / door lintels on the ground
      // floor, at sill level on the first floor
      const yRun = fa.f === 0 ? rng.range(2.95, 3.2) : rng.range(0.15, 0.35);
      const nCables = density < 0.75 ? rng.int(1, 2) : rng.int(2, 4);
      const x0 = -half + rng.range(0.25, 1.5);
      const x1 = half - rng.range(0.25, 1.5);
      if (x1 - x0 < 2) continue;
      const clip = rng.range(0.7, 1.1);
      for (let c = 0; c < nCables; c++) {
        const r = rng.range(0.005, 0.009);
        const dy = -c * rng.range(0.018, 0.03);
        const dz = -0.015 - r - c * 0.006;
        let a = x0;
        while (a < x1 - 0.05) {
          const b = Math.min(x1, a + clip * rng.range(0.85, 1.15));
          const p0 = worldOf(fa.pm, a, yRun + dy, dz).slice();
          const p1 = worldOf(fa.pm, b, yRun + dy + rng.range(-0.01, 0.01), dz).slice();
          const sag = (0.012 + c * 0.006) * rng.range(0.6, 1.6);
          const g = catenaryTube(p0, p1, sag, r, { seg: 4, radial: 4 });
          A.addOnce('cable', g, null, { masks: [0.1, 0.5, 0.2] });
          a = b;
        }
        // the free end droops off the last clip
        if (rng.float() < 0.5) {
          const p0 = worldOf(fa.pm, x1, yRun + dy, dz).slice();
          const p1 = worldOf(fa.pm, x1 + rng.range(0.2, 0.6), yRun + dy - rng.range(0.3, 0.9), dz - 0.03).slice();
          A.addOnce('cable', catenaryTube(p0, p1, 0.1, r, { seg: 6, radial: 4 }), null, { masks: [0.1, 0.5, 0.2] });
        }
      }
      // clips over the bundle
      for (let a = x0; a < x1; a += clip) {
        A.add('metal_dark', BOX_FINE(A), LL(fa.pm, a, yRun - 0.02, -0.02, 0, 0.02, 0.07, 0.035), { masks: [0.6, 0.5, 0.2] });
      }
      if (fa.f !== 0) continue;
      // drops to meter boxes beside the doors and shops
      for (const o of fa.openings) {
        if (o.kind !== 'door' && o.kind !== 'shop') continue;
        if (rng.float() > 0.75) continue;
        const sx = o.x + (rng.float() < 0.5 ? -1 : 1) * (o.w / 2 + rng.range(0.3, 0.5));
        if (Math.abs(sx) > half - 0.3) continue;
        const my = rng.range(1.55, 1.85);
        const mw = worldOf(fa.pm, sx, my, -0.07);
        A.put('meter_box', mw[0], mw[1], mw[2], ryOf(fa.pm) + Math.PI, rng.range(0.9, 1.1), [1, rng.range(1, 1.5), 1]);
        // the drop: from the run, down the wall to the gland, slightly slack
        const top = worldOf(fa.pm, sx + rng.range(-0.1, 0.1), yRun, -0.025).slice();
        const bot = worldOf(fa.pm, sx, my + 0.23, -0.035).slice();
        A.addOnce('cable', catenaryTube(top, bot, 0.0, 0.008, { seg: 4, radial: 4, jitter: 0.02 }), null, { masks: [0.1, 0.5, 0.2] });
        // and the tail out of the bottom, into the wall or down to the ground
        const g0 = worldOf(fa.pm, sx, my - 0.27, -0.06).slice();
        const g1 = worldOf(fa.pm, sx + rng.range(-0.3, 0.3), rng.range(0.4, 1.0), -0.02).slice();
        A.addOnce('cable', catenaryTube(g0, g1, 0.06, 0.007, { seg: 5, radial: 4 }), null, { masks: [0.1, 0.5, 0.2] });
      }
    }
  }
}

/**
 * Corners where the trash goes: the inside corner of every setback and the
 * ends of each street facade get a bag pile, cardboard and a drift of paper.
 */
function trashCorners(A, rng, infos, density) {
  for (const info of infos) {
    for (const fa of info.facades) {
      if (fa.f !== 0 || !fa.openFace) continue;
      for (const end of [-1, 1]) {
        if (rng.float() > 0.4 * density + 0.1) continue;
        const ex = end * (fa.len / 2 - rng.range(0.4, 0.9));
        if (inOpening(fa, ex, 0.3)) continue;
        const n = rng.int(2, 5);
        for (let k = 0; k < n; k++) {
          const w = worldOf(fa.pm, ex + rng.range(-0.5, 0.5), 0, -rng.range(0.2, 0.7));
          if (!isOpen(w[0], w[2], 0.1)) continue;
          const id = rng.float() < 0.75 ? (rng.float() < 0.5 ? 'bin_bag_a' : 'bin_bag_b') : 'bin_bag_w';
          A.put(id, w[0], groundY(w[0], w[2]) + (k > 2 ? 0.2 : 0), w[2], rng.float() * 6.28, rng.range(0.85, 1.2), [1, rng.range(1.0, 1.5), 1]);
        }
        for (let k = 0; k < rng.int(1, 3); k++) {
          const w = worldOf(fa.pm, ex + rng.range(-0.8, 0.8), 0, -rng.range(0.3, 1.0));
          if (!isOpen(w[0], w[2], 0.05)) continue;
          A.put(rng.pick(['card_flat', 'card_flat_b', 'litter', 'box_card_a']), w[0], groundY(w[0], w[2]) + 0.006, w[2], rng.float() * 6.28, 1, [1, 1.4, 1]);
        }
      }
    }
  }
}

/** Run every clutter pass. `density` 0..1 scales item counts, not positions. */
export function dressClutter(A, infos, density = 1) {
  // separate streams per pass: tuning one never re-rolls another
  wallFoot(A, new Rng(0x7a11f007), infos, density);
  facadeCables(A, new Rng(0xca81e5), infos, density);
  trashCorners(A, new Rng(0x7ea5b1), infos, density);
}

