/**
 * AI — retargeting the procedural 25-bone rig onto the authored soldier
 * (a Character Creator "CC_Base" rig, 114 joints). Pure three.js: no loader,
 * no DOM, so the same code runs in the game and in node-side pose tooling.
 * src/ai/glbsoldier.js loads the file and hands the scene to `prepareTemplate`.
 *
 * WHAT IS COPIED, AND HOW
 *
 * The two skeletons share neither a rest pose nor proportions: the model's arms
 * are ~18% shorter than the procedural ones and its legs ~10% shorter. Copying
 * rotations alone therefore leaves the hands 8-10 cm off the rifle and the feet
 * hanging in the air whenever the knees bend. So the copy is split by job:
 *
 *  - TRUNK, HEAD, CLAVICLES, FEET: rotation copy through a constant per-bone
 *    offset found at build time from a matched bind (the model swung, bone by
 *    bone, onto the procedural bind directions):
 *        modelWorld(t) = procWorld(t) * offset
 *  - LEGS: two-bone IK on the model's own segment lengths, putting each ankle
 *    where the procedural ankle is (feet planted, foot IK honoured) with the
 *    knee on the procedural knee's side. The hips drop if a leg cannot reach.
 *  - ARMS: two-bone IK to a HAND TARGET, not to the procedural wrist. The right
 *    hand's target is a grip frame authored in the rifle's own frame (palm on
 *    the pistol grip, trigger finger in the guard); the support hand's is a
 *    frame on the handguard, falling back to following the procedural hand
 *    whenever that leaves the rifle (reload, ragdoll).
 *    Both limbs are solved hinge-aware: each segment's elbow/knee axis, read
 *    from the model's own rest pose, is laid on the bend plane, so the joint
 *    bends where the skin was weighted to bend instead of twisting sideways.
 *  - FOREARM TWIST: the wrist's roll relative to the forearm is spread over the
 *    two forearm twist joints, so the glove cuff does not candy-wrap.
 *  - FINGERS: curled once, at build, into a grip around the rifle. They are
 *    plain local rotations nothing else touches, so they cost nothing per frame.
 *
 * Every per-frame step works on preallocated scratch and writes local
 * quaternions/positions only; world matrices of the chain are tracked by hand
 * (no recursive updateMatrixWorld per bone). The renderer's scene update
 * refreshes the rest.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { RIG } from './rig.js';

/** Reference height the procedural rig is authored at (rig.js `H`). */
const RIG_HEIGHT = 1.8;

/**
 * procedural bone -> [model joint, joint it aims at (null: no swing)].
 * Model joint names are the CC_Base names without the exporter's `_NN` suffix.
 */
export const MAP = [
  ['Hips', 'Hip', 'Waist'],
  ['Spine', 'Waist', 'Spine01'],
  ['Spine1', 'Spine01', 'Spine02'],
  ['Spine2', 'Spine02', 'NeckTwist01'],
  ['Neck', 'NeckTwist01', 'Head'],
  ['Head', 'Head', null],
  ['ClavicleR', 'R_Clavicle', 'R_Upperarm'],
  ['UpperArmR', 'R_Upperarm', 'R_Forearm'],
  ['ForearmR', 'R_Forearm', 'R_Hand'],
  ['HandR', 'R_Hand', 'R_Mid1'],
  ['ClavicleL', 'L_Clavicle', 'L_Upperarm'],
  ['UpperArmL', 'L_Upperarm', 'L_Forearm'],
  ['ForearmL', 'L_Forearm', 'L_Hand'],
  ['HandL', 'L_Hand', 'L_Mid1'],
  ['UpLegR', 'R_Thigh', 'R_Calf'],
  ['LegR', 'R_Calf', 'R_Foot'],
  ['FootR', 'R_Foot', 'R_ToeBase'],
  ['ToeR', 'R_ToeBase', null],
  ['UpLegL', 'L_Thigh', 'L_Calf'],
  ['LegL', 'L_Calf', 'L_Foot'],
  ['FootL', 'L_Foot', 'L_ToeBase'],
  ['ToeL', 'L_ToeBase', null],
];

export const jointName = (n) => (n.match(/^CC_Base_(.+?)(?:_\d+)?$/) ?? [])[1] ?? null;

/* ------------------------------------------------------------------ */
/* Grip design, in the rifle's own frame (src/ai/weapon.js):           */
/* origin at the pistol grip, +Z down the bore, +Y up, +X the shooter's */
/* left. Units are metres.                                              */
/* ------------------------------------------------------------------ */

/**
 * Each hand is placed by the surface of its palm on a cylinder of the rifle:
 *   axis    a point on the cylinder's axis the palm centre faces
 *   r       how far the palm surface sits from that axis
 *   n       palm normal (out of the palm, toward the axis)
 *   t       the knuckle line, pinky -> index
 * The finger direction follows from n and t and the hand's chirality.
 * `curl` is the flexion of each finger joint (MCP, PIP, DIP) in degrees,
 * measured from straight. The thumb's entry is [opposition, MCP, IP].
 */
export const GRIPS = {
  R: {
    // pistol grip: raked 26 deg; the palm wraps its right rear quarter, the
    // web of the hand high under the tang
    axis: [0, -0.002, -0.050],
    r: 0.021,
    n: [1, 0.0, 0.45],
    t: [0, 0.898, 0.44],
    palm: 0.82,
    // elbow: down and out to the right (actor frame, as the animator's pole)
    pole: [-0.75, -0.65, -0.15],
    curl: {
      Index: [22, 48, 22],
      Mid: [78, 92, 40],
      Ring: [84, 90, 40],
      Pinky: [88, 84, 38],
      Thumb: [75, 20, 30],
    },
  },
  L: {
    // handguard: palm cupping its lower left, fingers up the right side,
    // thumb along the left
    axis: [0, 0.093, 0.105],
    r: 0.027,
    n: [-0.45, 1, 0],
    t: [0.6, 0.3, 0.75],
    palm: 0.54,
    pole: [0.6, -1, -0.25],
    curl: {
      Index: [52, 58, 30],
      Mid: [60, 62, 32],
      Ring: [62, 62, 32],
      Pinky: [64, 60, 30],
      Thumb: [18, 14, 12],
    },
  },
};

const FINGERS = ['Index', 'Mid', 'Ring', 'Pinky'];
const SIDES = ['R', 'L'];
const TRUNK = ['Spine', 'Spine1', 'Spine2', 'Neck'];

/** Arm segment lengthening, see SoldierSkin. */
const ARM_STRETCH = 1.07;

/* ------------------------------------------------------------------ */
/* template                                                            */
/* ------------------------------------------------------------------ */

/**
 * Normalise a loaded model (feet on y = 0, facing +Z, RIG_HEIGHT tall), merge
 * its meshes per material (23 skinned meshes -> 10 draws) and give each a
 * fixed body-sized bound so it can be frustum-culled without a per-frame
 * skinned bounds pass. Returns { holder, tris }.
 */
export function prepareTemplate(model) {
  const holder = new THREE.Group();
  holder.name = 'soldierModel';
  holder.add(model);
  holder.updateMatrixWorld(true);

  const joints = new Map();
  model.traverse((o) => {
    if (o.isBone) {
      const n = jointName(o.name);
      if (n && !joints.has(n)) joints.set(n, o);
    }
  });
  for (const [, j] of MAP) if (!joints.has(j)) throw new Error(`soldier model: no joint ${j}`);

  // ---- facing: toes in front of the ankles means +Z forward ------------
  const p = (n) => joints.get(n).getWorldPosition(new THREE.Vector3());
  const fwd = p('R_ToeBase').sub(p('R_Foot')).add(p('L_ToeBase').sub(p('L_Foot')));
  fwd.y = 0;
  holder.rotation.y = Math.atan2(fwd.x, fwd.z) * -1;
  holder.updateMatrixWorld(true);

  // ---- scale and ground: head top at RIG_HEIGHT, soles on y = 0 --------
  const box = new THREE.Box3().setFromObject(model, true);
  const s = RIG_HEIGHT / Math.max(1e-6, box.max.y - box.min.y);
  holder.scale.setScalar(s);
  holder.updateMatrixWorld(true);
  box.setFromObject(model, true);
  holder.position.y -= box.min.y;
  holder.updateMatrixWorld(true);

  // Character right must be -X (rig.js). A mirrored export would put the
  // rifle in the wrong hand; say so loudly rather than ship it.
  if (p('R_Thigh').x > 0) console.warn('[ai] soldier model: right side is +X; arms will be swapped');

  // ---- merge per material ---------------------------------------------
  // Every primitive shares the one skin, and skinning ignores the mesh's own
  // node transform (attached bind, identity bind matrix), so meshes sharing a
  // material concatenate losslessly into one draw.
  const groups = new Map();
  model.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const k = o.material;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(o);
  });
  const holderInv = new THREE.Matrix4().copy(holder.matrixWorld).invert();
  const bound = new THREE.Sphere(new THREE.Vector3(0, 0.95, 0), 2.6).applyMatrix4(holderInv);
  let tris = 0;
  let order = 0;
  for (const [mat, meshes] of groups) {
    let mesh = meshes[0];
    if (meshes.length > 1) {
      const g = mergeGeometries(meshes.map((m) => m.geometry), false);
      if (g) {
        mesh = new THREE.SkinnedMesh(g, mat);
        mesh.name = `soldier_${mat.name}`;
        mesh.bind(meshes[0].skeleton, meshes[0].bindMatrix);
        for (const m of meshes) {
          m.parent.remove(m);
          m.geometry.dispose();
        }
        holder.add(mesh);
      }
    }
    if (mesh.parent !== holder) {
      // re-home under the holder: transform-free for skinning, and it gives
      // every part the same simple local space for the cull bound below
      mesh.parent.remove(mesh);
      holder.add(mesh);
    }
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1, 1, 1);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    mesh.boundingSphere = bound.clone();
    mesh.renderOrder = order++;
    tris += (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count) / 3;
  }
  holder.updateMatrixWorld(true);
  const materials = [...groups.keys()];
  return { holder, tris: tris | 0, scale: s, materials };
}

/* ------------------------------------------------------------------ */
/* scratch                                                              */
/* ------------------------------------------------------------------ */

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _v5 = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();

/** Rotation taking local basis (a, b, a x b) to world basis (A, B, A x B). */
const _bc = new THREE.Vector3();
function basisQuat(out, A, B, invLocal) {
  // A, B are orthonormal world vectors; invLocal is the transposed local basis
  _bc.crossVectors(A, B);
  _m.makeBasis(A, B, _bc);
  _m.multiply(invLocal);
  return out.setFromRotationMatrix(_m);
}

/** Orthonormal local basis matrix (a, b', a x b') transposed, for basisQuat. */
function localBasisInv(a, b) {
  const A = a.clone().normalize();
  const B = b.clone().addScaledVector(A, -b.dot(A)).normalize();
  const C = new THREE.Vector3().crossVectors(A, B);
  return new THREE.Matrix4().makeBasis(A, B, C).transpose();
}

/** World quaternion of an object from its (possibly scaled) matrixWorld. */
const _dp = new THREE.Vector3();
const _ds = new THREE.Vector3();
function worldQuat(o, out) {
  o.matrixWorld.decompose(_dp, out, _ds);
  return out;
}


const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/* ------------------------------------------------------------------ */
/* per-soldier skin                                                    */
/* ------------------------------------------------------------------ */

export class SoldierSkin {
  /**
   * @param {object} template          from prepareTemplate
   * @param {THREE.Bone[]} procBones   the agent's procedural bones, rig order
   * @param {string[]} procNames       rig bone names, same order
   * @param {THREE.Object3D} parent    the agent group (procedural root lives here)
   * @param {object} [opts]
   *   weaponMatrix  Matrix4, the rifle frame -> actor bind space (def.weapon.matrix)
   *   foregrip      [x,y,z] bind-space point the procedural support hand holds
   */
  constructor(template, procBones, procNames, parent, opts = {}) {
    this.root = cloneSkinned(template.holder);
    parent.add(this.root);
    parent.updateMatrixWorld(true);
    this.meshes = [];
    this.root.traverse((o) => {
      if (o.isSkinnedMesh) this.meshes.push(o);
    });

    const joints = new Map();
    this.root.traverse((o) => {
      if (o.isBone) {
        const n = jointName(o.name);
        if (n && !joints.has(n)) joints.set(n, o);
      }
    });
    this.joints = joints;
    const J = (n) => joints.get(n);
    const byName = new Map(procNames.map((n, i) => [n, procBones[i]]));
    const P = (n) => byName.get(n);
    const V = () => new THREE.Vector3();
    const Q = () => new THREE.Quaternion();
    const wpos = (o) => o.getWorldPosition(V());
    const wq = (o) => o.getWorldQuaternion(Q());

    this.pairs = [];
    this.pair = {};
    for (const [pn, jn, aim] of MAP) {
      const pr = { proc: P(pn), bone: J(jn), aim: aim ? J(aim) : null, offset: Q() };
      this.pairs.push(pr);
      this.pair[pn] = pr;
    }
    this._ws = new THREE.Vector3().setFromMatrixScale(procBones[0].matrixWorld).x;

    // ---- the skin's bind pose (inverse bind matrices): the reference the
    // twist joints are measured from
    const skel = this.meshes[0].skeleton;
    const bindWorld = (b) => {
      const i = skel.bones.indexOf(b);
      return i < 0 ? null : skel.boneInverses[i].clone().invert();
    };
    const bindLocalQ = (b) => {
      const w = bindWorld(b), pw = bindWorld(b.parent);
      if (!w || !pw) return b.quaternion.clone();
      const m = pw.invert().multiply(w);
      const q = Q();
      m.decompose(V(), q, V());
      return q;
    };

    // ---- limb hinges, read from the model's rest pose before the matched
    // bind touches anything: the bend-plane normal in each segment's frame
    const restDir = (a, b) => wpos(J(b)).sub(wpos(J(a))).normalize();
    // a segment's axis is the direction to its child joint in its own frame:
    // CC bones do not agree on which local axis runs down the bone
    const hingeLocal = (bone, child, n) =>
      localBasisInv(child.position.clone().normalize(), n.clone().applyQuaternion(wq(bone).invert()));
    const lateral = new THREE.Vector3(1, 0, 0).transformDirection(this.root.matrixWorld);
    const limb = (side, arm) => {
      const up = J(arm ? `${side}_Upperarm` : `${side}_Thigh`);
      const lo = J(arm ? `${side}_Forearm` : `${side}_Calf`);
      const en = J(arm ? `${side}_Hand` : `${side}_Foot`);
      const du = wpos(lo).sub(wpos(up)).normalize();
      const dl = wpos(en).sub(wpos(lo)).normalize();
      let n = new THREE.Vector3().crossVectors(du, dl);
      if (!arm || n.length() < 0.15) {
        // knees bend about the body's lateral axis; the rest bend is too
        // small to define the plane, but its sign is good
        const sgn = Math.sign(n.dot(lateral)) || 1;
        n = lateral.clone().multiplyScalar(sgn);
      }
      n.normalize();
      return {
        upper: up, lower: lo, end: en,
        hU: hingeLocal(up, lo, n), hL: hingeLocal(lo, en, n),
        pU: P(arm ? `UpperArm${side}` : `UpLeg${side}`),
        pL: P(arm ? `Forearm${side}` : `Leg${side}`),
        pE: P(arm ? `Hand${side}` : `Foot${side}`),
        l1: 0, l2: 0, endLocal: V(), target: V(), pole: V(),
      };
    };
    void restDir;
    this.arms = { R: limb('R', true), L: limb('L', true) };
    this.legs = { R: limb('R', false), L: limb('L', false) };
    for (const s of ['R', 'L']) {
      this.arms[s].clav = J(`${s}_Clavicle`);
      this.arms[s].clavPair = this.pair[`Clavicle${s}`];
      this.legs[s].footPair = this.pair[`Foot${s}`];
      this.legs[s].toePair = this.pair[`Toe${s}`];
    }

    // ---- matched bind: swing each mapped model bone onto its procedural
    // counterpart's direction, parents first (MAP is in hierarchy order)
    for (const pr of this.pairs) {
      if (!pr.aim) continue;
      const dir = wpos(pr.aim).sub(wpos(pr.bone)).normalize();
      const want = new THREE.Vector3(0, 1, 0).applyQuaternion(wq(pr.proc)).normalize();
      const swing = Q().setFromUnitVectors(dir, want);
      const q = swing.multiply(wq(pr.bone));
      pr.bone.quaternion.copy(wq(pr.bone.parent).invert().multiply(q));
      pr.bone.updateMatrixWorld(true);
    }

    // ---- offsets, and the hips anchor in procedural-hips space -------------
    for (const pr of this.pairs) pr.offset.copy(wq(pr.proc).invert()).multiply(wq(pr.bone));
    const hips = this.pairs[0];
    this.hipsLocal = hips.proc.worldToLocal(wpos(hips.bone));

    // ---- arm length: the model's arms are ~18% shorter than the rig the
    // rifle carry was authored for, which leaves the support hand straining
    // at full extension for the handguard. Lengthen both segments a little by
    // sliding the child joints out along the bone (the skin stretches across
    // the elbow and wrist blends; invisible at this amount).
    for (const side of ['R', 'L']) {
      for (const n of [`${side}_Forearm`, `${side}_Hand`, `${side}_UpperarmTwist02`, `${side}_ForearmTwist02`]) {
        const b = J(n);
        if (b) b.position.multiplyScalar(ARM_STRETCH);
      }
    }
    this.root.updateMatrixWorld(true);

    // ---- limb lengths and end anchors (where the model's ankle/wrist sits
    // in the procedural end bone's frame, at the matched bind)
    for (const L of [this.arms.R, this.arms.L, this.legs.R, this.legs.L]) {
      const a = wpos(L.upper), b = wpos(L.lower), c = wpos(L.end);
      L.l1 = a.distanceTo(b);
      L.l2 = b.distanceTo(c);
      L.endLocal.copy(L.pE.worldToLocal(c.clone()));
    }

    // unmapped joints between mapped ones, refreshed by hand each frame
    this.pelvis = J('Pelvis') ?? null;
    this.neck2 = J('NeckTwist02') ?? null;

    // ---- hands
    const iHR = RIG.index('HandR');
    const handBindInv = new THREE.Matrix4()
      .compose(RIG.bindPos[iHR], RIG.bindQuat[iHR], new THREE.Vector3(1, 1, 1))
      .invert();
    const W2H = opts.weaponMatrix ? handBindInv.clone().multiply(opts.weaponMatrix) : null;
    this.foregripH = opts.foregrip ? new THREE.Vector3(...opts.foregrip).applyMatrix4(handBindInv) : null;
    this.procHandR = P('HandR');
    this.procHandL = P('HandL');
    this.hands = {};
    for (const side of ['R', 'L']) this.hands[side] = this._buildHand(side, W2H, P);

    // ---- forearm twist joints, measured from the skin's bind pose
    for (const side of ['R', 'L']) {
      const A = this.arms[side];
      A.twist1 = J(`${side}_ForearmTwist01`) ?? null;
      A.twist2 = J(`${side}_ForearmTwist02`) ?? null;
      A.twist1Rest = A.twist1 ? bindLocalQ(A.twist1) : null;
      A.twist2Rest = A.twist2 ? bindLocalQ(A.twist2) : null;
      A.handBindInv = bindLocalQ(A.end).invert();
      A.axF = A.end.position.clone().normalize(); // forearm axis, forearm frame
      A.ax1 = A.twist2 ? A.twist2.position.clone().normalize() : null; // same, twist1 frame
    }

    // ---- fingers: a fixed grip, set once
    if (W2H) for (const side of ['R', 'L']) this._curlFingers(side, GRIPS[side].curl);

    // grip poles live in the procedural chest's frame, so they stay right in a
    // ragdoll too (the actor frame does not follow a body on the floor)
    this.procChest = P('Spine2');
    const chestBindInv = RIG.bindQuat[RIG.index('Spine2')].clone().invert();
    for (const side of ['R', 'L']) {
      this.arms[side].gripPole = new THREE.Vector3(...GRIPS[side].pole).normalize().applyQuaternion(chestBindInv);
    }

    this.hasGrip = !!W2H;
    this.supportOn = 1;
    this.root.updateMatrixWorld(true);
  }

  _buildHand(side, W2H, P) {
    const J = (n) => this.joints.get(n);
    const hand = J(`${side}_Hand`);
    hand.updateMatrixWorld(true);
    const inv = hand.matrixWorld.clone().invert();
    const loc = (n) => J(n).getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const mid1 = loc(`${side}_Mid1`);
    const f = mid1.clone().normalize();
    const t = loc(`${side}_Index1`).sub(loc(`${side}_Pinky1`));
    t.addScaledVector(f, -t.dot(f)).normalize();
    // palm side: where the fingertips curl to (the rest pose is a loose fist)
    const tip = loc(`${side}_Mid3`).sub(mid1);
    const n = new THREE.Vector3().crossVectors(t, f);
    if (n.dot(tip) < 0) n.negate();
    n.normalize();
    // chirality: +1 when (f, n, t) is right-handed
    const chir = Math.sign(new THREE.Vector3().crossVectors(f, n).dot(t)) || 1;
    const G = GRIPS[side];
    const len = mid1.length();
    // palm surface point in hand-local units: along the metacarpals, out to
    // the glove's palm (about a sixth of the hand length from the bone line)
    const palmLocal = f.clone().multiplyScalar(len * G.palm).addScaledVector(n, len * 0.17);
    const handScale = new THREE.Vector3().setFromMatrixScale(hand.matrixWorld).x;

    const localInvM = localBasisInv(f, n);
    const out = {
      hand,
      f, n, chir,
      localQ: new THREE.Quaternion().setFromRotationMatrix(localInvM), // hand-local -> (f,n) basis
      palmOffset: palmLocal.clone().multiplyScalar(handScale), // world units, hand-local axes
      gripQ: new THREE.Quaternion(), // the (f,n) basis, in the proc HandR frame
      gripP: new THREE.Vector3(), // palm surface point, proc HandR frame
      followQ: null,
      followP: new THREE.Vector3(),
      len: len * handScale,
    };
    if (W2H) {
      const nW = new THREE.Vector3(...G.n).normalize();
      const tW = new THREE.Vector3(...G.t);
      tW.addScaledVector(nW, -tW.dot(nW)).normalize();
      // (f, n, t) right-handed when chir = +1: f = n x t; else f = t x n
      const fW = new THREE.Vector3().crossVectors(nW, tW).multiplyScalar(chir);
      const qW2H = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(W2H));
      const mW = new THREE.Matrix4().makeBasis(fW, nW, new THREE.Vector3().crossVectors(fW, nW));
      out.gripQ.setFromRotationMatrix(mW).premultiply(qW2H);
      out.gripP.copy(new THREE.Vector3(...G.axis).addScaledVector(nW, -G.r)).applyMatrix4(W2H);
    }
    // follow mode (support hand off the rifle): keep the hand's matched-bind
    // orientation relative to the procedural hand, palm a little past its joint
    const pe = P(`Hand${side}`);
    const qHand = hand.getWorldQuaternion(new THREE.Quaternion());
    const basisW = new THREE.Quaternion().copy(qHand).multiply(out.localQ.clone().invert());
    out.followQ = pe.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(basisW);
    const palmW = palmLocal.clone().applyMatrix4(hand.matrixWorld);
    out.followP.copy(pe.worldToLocal(palmW));
    return out;
  }

  /** Curl one hand's fingers into its grip. Angles are absolute flexion (deg). */
  _curlFingers(side, curl) {
    const J = (n) => this.joints.get(n);
    const H = this.hands[side];
    const hand = H.hand;
    hand.updateMatrixWorld(true);
    const qh = hand.getWorldQuaternion(new THREE.Quaternion());
    const nW = H.n.clone().applyQuaternion(qh).normalize();
    const fW = H.f.clone().applyQuaternion(qh).normalize();
    const D = Math.PI / 180;
    for (const name of [...FINGERS, 'Thumb']) {
      const ang = curl[name];
      const bones = [1, 2, 3].map((k) => J(`${side}_${name}${k}`));
      if (!ang || bones.some((b) => !b)) continue;
      for (let k = 0; k < 3; k++) {
        const b = bones[k];
        b.updateMatrixWorld(true);
        const qp = b.parent.getWorldQuaternion(new THREE.Quaternion());
        const qb = b.getWorldQuaternion(new THREE.Quaternion());
        const segDir = new THREE.Vector3(0, 1, 0).applyQuaternion(qb);
        const prevDir = k === 0
          ? b.getWorldPosition(new THREE.Vector3()).sub(hand.getWorldPosition(new THREE.Vector3())).normalize()
          : new THREE.Vector3(0, 1, 0).applyQuaternion(qp);
        let axis, delta;
        if (name === 'Thumb' && k === 0) {
          // opposition: roll the thumb across the palm about the hand's long axis
          axis = fW.clone();
          const s = Math.sign(new THREE.Vector3().crossVectors(axis, segDir).dot(nW)) || 1;
          axis.multiplyScalar(s);
          delta = ang[0] * D;
        } else {
          axis = new THREE.Vector3().crossVectors(prevDir, nW);
          if (axis.lengthSq() < 1e-6) axis.crossVectors(fW, nW);
          axis.normalize();
          const cur = Math.atan2(new THREE.Vector3().crossVectors(prevDir, segDir).dot(axis), prevDir.dot(segDir));
          delta = ang[k] * D - cur;
        }
        const nw = new THREE.Quaternion().setFromAxisAngle(axis, delta).multiply(qb);
        b.quaternion.copy(qp.invert().multiply(nw));
        b.updateMatrixWorld(true);
      }
    }
  }

  /* ---------------- per-frame ---------------- */

  /** bone.matrix from its TRS, then world = parent world * local. */
  _refresh(bone) {
    bone.matrix.compose(bone.position, bone.quaternion, bone.scale);
    bone.matrixWorld.multiplyMatrices(bone.parent.matrixWorld, bone.matrix);
  }

  /** Give a bone the world rotation `q` (its parent's world must be current). */
  _setWorldQuat(bone, q) {
    worldQuat(bone.parent, _q3);
    bone.quaternion.copy(_q3.invert()).multiply(q);
    this._refresh(bone);
  }

  /**
   * Hinge-aware two-bone solve on a model limb. Returns how far short of the
   * target the limb fell (>= 0, world units).
   */
  _limb(L, target, pole) {
    this._refresh(L.upper);
    const A = _v.setFromMatrixPosition(L.upper.matrixWorld);
    const l1 = L.l1, l2 = L.l2;
    const dir = _v2.copy(target).sub(A);
    let d = dir.length();
    if (d < 1e-5) return 0;
    dir.multiplyScalar(1 / d);
    const short = Math.max(0, d - (l1 + l2));
    d = Math.min(l1 + l2 - 1e-4, Math.max(Math.abs(l1 - l2) + 1e-4, d));
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const perp = _v3.copy(pole).addScaledVector(dir, -pole.dot(dir));
    if (perp.lengthSq() < 1e-10) perp.set(0, -1, 0).addScaledVector(dir, dir.y);
    perp.normalize();
    // bend-plane normal, oriented like the rest hinge: (E-A) x (T-E) ~ perp x dir
    const n = _v4.crossVectors(perp, dir).normalize();
    // upper segment toward the elbow/knee
    const du = _v5.copy(dir).multiplyScalar(a).addScaledVector(perp, h).normalize();
    this._setWorldQuat(L.upper, basisQuat(_q, du, n, L.hU));
    // lower segment from where the joint actually landed
    this._refresh(L.lower);
    const dl = _v5.copy(target).sub(_v.setFromMatrixPosition(L.lower.matrixWorld));
    if (dl.lengthSq() > 1e-10) {
      dl.normalize();
      n.addScaledVector(dl, -n.dot(dl)).normalize();
      this._setWorldQuat(L.lower, basisQuat(_q, dl, n, L.hL));
    }
    return short;
  }

  /** Pole for a limb: the procedural middle joint's side of its root-end line. */
  _pole(L, out) {
    const a = _v.setFromMatrixPosition(L.pU.matrixWorld);
    const e = _v2.setFromMatrixPosition(L.pE.matrixWorld);
    const m = _v3.setFromMatrixPosition(L.pL.matrixWorld);
    return out.copy(m).sub(a.add(e).multiplyScalar(0.5));
  }

  /** Copy the procedural pose onto the model. Call after the procedural bones
   *  (animator or ragdoll) have their final world matrices for the frame. */
  sync() {
    const hips = this.pairs[0];
    const hb = hips.bone;
    hb.parent.updateWorldMatrix(true, false);

    // ---- leg targets: the model's ankle where the procedural ankle anchor is
    for (const k of SIDES) {
      const L = this.legs[k];
      L.target.copy(L.endLocal).applyMatrix4(L.pE.matrixWorld);
    }

    // ---- hips: rotation copy, position anchored in proc-hips space
    const hipT = _v4.copy(this.hipsLocal);
    hips.proc.localToWorld(hipT);
    const hipY = hipT.y;
    hb.position.copy(hb.parent.worldToLocal(hipT));
    worldQuat(hips.proc, _q2).multiply(hips.offset);
    this._setWorldQuat(hb, _q2);
    if (this.pelvis) this._refresh(this.pelvis);
    // a leg that cannot reach its ankle pulls the hips straight down
    let drop = 0;
    for (const k of SIDES) {
      const L = this.legs[k];
      this._refresh(L.upper);
      const th = _v.setFromMatrixPosition(L.upper.matrixWorld);
      const reach = (L.l1 + L.l2) * 0.999;
      const dx = th.x - L.target.x, dy = th.y - L.target.y, dz = th.z - L.target.z;
      const h2 = dx * dx + dz * dz;
      if (h2 + dy * dy > reach * reach && h2 < reach * reach) {
        const need = dy - Math.sqrt(reach * reach - h2);
        if (need > drop) drop = need;
      }
    }
    drop = Math.min(drop, 0.1 * this._ws);
    if (drop > 1e-4) {
      hips.proc.localToWorld(hipT.copy(this.hipsLocal));
      hipT.y = hipY - drop;
      hb.position.copy(hb.parent.worldToLocal(hipT));
      this._refresh(hb);
      if (this.pelvis) this._refresh(this.pelvis);
    }

    // ---- trunk, head, clavicles: rotation copy
    const p = this.pair;
    for (const name of TRUNK) {
      const pr = p[name];
      this._setWorldQuat(pr.bone, worldQuat(pr.proc, _q2).multiply(pr.offset));
    }
    if (this.neck2) this._refresh(this.neck2);
    this._setWorldQuat(p.Head.bone, worldQuat(p.Head.proc, _q2).multiply(p.Head.offset));

    // ---- legs
    for (const k of SIDES) {
      const L = this.legs[k];
      this._limb(L, L.target, this._pole(L, L.pole));
      this._setWorldQuat(L.footPair.bone, worldQuat(L.footPair.proc, _q2).multiply(L.footPair.offset));
      this._setWorldQuat(L.toePair.bone, worldQuat(L.toePair.proc, _q2).multiply(L.toePair.offset));
    }

    // ---- arms
    for (const k of SIDES) this._arm(k);
  }

  _arm(k) {
    const A = this.arms[k];
    const H = this.hands[k];
    const cp = A.clavPair;
    this._setWorldQuat(cp.bone, worldQuat(cp.proc, _q2).multiply(cp.offset));

    // hand target: palm point + (f, n) basis in world
    const palm = _v4;
    const qb = this._qb ?? (this._qb = new THREE.Quaternion());
    if (this.hasGrip) {
      const hr = this.procHandR;
      palm.copy(H.gripP).applyMatrix4(hr.matrixWorld);
      worldQuat(hr, qb).multiply(H.gripQ);
      if (k === 'L') {
        // off the handguard (reload, ragdoll): follow the procedural hand
        const pl = this.procHandL;
        let w = 1;
        if (this.foregripH) {
          const fg = _v.copy(this.foregripH).applyMatrix4(hr.matrixWorld);
          w = smooth(0.06 * this._ws, 0.14 * this._ws, fg.distanceTo(_v2.setFromMatrixPosition(pl.matrixWorld)));
        }
        this.supportOn = 1 - w;
        if (w > 0) {
          const fp = _v.copy(H.followP).applyMatrix4(pl.matrixWorld);
          palm.lerp(fp, w);
          const fq = worldQuat(pl, _q2).multiply(H.followQ);
          qb.slerp(fq, w);
        }
      }
    } else {
      const pe = A.pE;
      palm.copy(H.followP).applyMatrix4(pe.matrixWorld);
      worldQuat(pe, qb).multiply(H.followQ);
    }
    // hand bone world rotation, and the wrist it implies
    const qh = this._qh ?? (this._qh = new THREE.Quaternion());
    qh.copy(qb).multiply(H.localQ);
    const wrist = this._wrist ?? (this._wrist = new THREE.Vector3());
    wrist.copy(H.palmOffset).applyQuaternion(qh).multiplyScalar(this._ws);
    wrist.subVectors(palm, wrist);

    // shrug: a clavicle that leaves the wrist out of reach swings toward it
    this._refresh(A.upper);
    const sh = _v.setFromMatrixPosition(A.upper.matrixWorld);
    const reach = (A.l1 + A.l2) * 0.985;
    const dist = sh.distanceTo(wrist);
    if (dist > reach) {
      const cl = _v2.setFromMatrixPosition(cp.bone.matrixWorld);
      const arm = _v3.copy(sh).sub(cl);
      const clLen = arm.length();
      const toW = _v5.copy(wrist).sub(cl);
      const axis = _v.crossVectors(arm, toW);
      if (axis.lengthSq() > 1e-12 && clLen > 1e-5) {
        axis.normalize();
        const ang = Math.min(0.32, (dist - reach) / clLen);
        _q.setFromAxisAngle(axis, ang);
        worldQuat(cp.bone, _q2).premultiply(_q);
        this._setWorldQuat(cp.bone, _q2);
      }
    }

    // elbow: the grip's designed side while holding the rifle, the procedural
    // elbow's side once the hand is off it
    const on = this.hasGrip ? (k === 'L' ? this.supportOn : 1) : 0;
    const pole = A.pole;
    if (on > 0) {
      pole.copy(A.gripPole).applyQuaternion(worldQuat(this.procChest, _q2));
      if (on < 1) pole.multiplyScalar(on).addScaledVector(this._pole(A, _v5).normalize(), 1 - on);
    } else this._pole(A, pole);
    this._limb(A, wrist, pole);
    this._setWorldQuat(A.end, qh);

    // spread the wrist's roll over the forearm twist joints
    if (A.twist1 || A.twist2) {
      // deviation of the hand from its skin-bind orientation, forearm frame
      const dev = _q.copy(A.end.quaternion).multiply(A.handBindInv);
      const ax = A.axF;
      const tw = 2 * Math.atan2(dev.x * ax.x + dev.y * ax.y + dev.z * ax.z, dev.w);
      const t = tw > Math.PI ? tw - 2 * Math.PI : tw < -Math.PI ? tw + 2 * Math.PI : tw;
      this.twist = t;
      if (A.twist1) A.twist1.quaternion.copy(A.twist1Rest).premultiply(_q2.setFromAxisAngle(ax, t * 0.25));
      if (A.twist2 && A.ax1) A.twist2.quaternion.copy(A.twist2Rest).premultiply(_q2.setFromAxisAngle(A.ax1, t * 0.4));
    }
  }

  /** Shadow casting on/off for every part (render honours owNoShadow). */
  set castShadow(v) {
    for (let i = 0; i < this.meshes.length; i++) this.meshes[i].userData.owNoShadow = !v;
  }

  set visible(v) {
    this.root.visible = v;
  }

  get visible() {
    return this.root.visible;
  }

  dispose() {
    this.root.parent?.remove(this.root);
  }
}
