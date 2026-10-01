/**
 * AI — authored soldier body (soldier_full_tactical_gear.glb, a Character
 * Creator "CC_Base" rig with 114 joints) driven by the procedural 25-bone rig.
 *
 * The procedural skeleton in rig.js stays the source of truth for everything:
 * the animator poses it, foot IK and aim offsets act on it, physics adopts it
 * as the ragdoll on death, and hitboxes follow it. It is simply no longer
 * drawn. Each frame `SoldierSkin.sync()` copies its pose onto the authored
 * model, bone by bone, so the model inherits every behaviour for free.
 *
 * RETARGET
 *
 * The two skeletons do not share a rest pose (the procedural bind is a rifle
 * carry, the model's is a relaxed idle) or bone frames, so copying local
 * rotations would be meaningless. Instead, at build time the model is posed
 * into the procedural bind pose by swinging each mapped bone so it points the
 * same way as its procedural counterpart ("matched bind"). From then on a
 * constant per-bone offset relates the two:
 *
 *     modelWorld(t) = procWorld(t) * offset,   offset = procBind^-1 * modelMatched
 *
 * Unmapped joints (fingers, toes, twist and face bones, pouches) keep their
 * local rotation and ride along with their parents.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import soldierUrl from './assets/soldier.glb?url';

/** Reference height the procedural rig is authored at (rig.js `H`). */
const RIG_HEIGHT = 1.8;

/**
 * procedural bone -> [model joint, joint it aims at (null: no swing)].
 * Model joint names are the CC_Base names without the exporter's `_NN` suffix.
 */
const MAP = [
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

const jointName = (n) => (n.match(/^CC_Base_(.+?)(?:_\d+)?$/) ?? [])[1] ?? null;

/** Loaded once, cloned per soldier. */
let template = null;
let loading = null;

/**
 * Load and normalise the model: feet on y = 0, facing +Z, RIG_HEIGHT tall,
 * every mesh casting and receiving shadows. Resolves to null on failure so the
 * caller can fall back to the procedural body.
 */
export function loadSoldierModel() {
  if (template) return Promise.resolve(template);
  if (loading) return loading;
  loading = new GLTFLoader()
    .loadAsync(soldierUrl)
    .then((gltf) => {
      const model = gltf.scene;
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
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          // Skinned bounds come from the bind geometry; the body moves far
          // from it once posed, so never cull a part of the soldier alone.
          o.frustumCulled = false;
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

      let tris = 0;
      holder.traverse((o) => {
        if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
      });
      template = { holder, tris: tris | 0 };
      console.info(`[ai] soldier model ${template.tris} tris, scale ${s.toExponential(2)}`);
      return template;
    })
    .catch((err) => {
      console.warn('[ai] soldier model failed to load, using the procedural body', err);
      return null;
    });
  return loading;
}

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _m = new THREE.Matrix4();

/** One soldier's copy of the model, slaved to that soldier's procedural bones. */
export class SoldierSkin {
  /**
   * @param {THREE.Bone[]} procBones  the agent's procedural bones, rig order
   * @param {string[]} procNames       rig bone names, same order
   * @param {THREE.Object3D} parent    the agent group (procedural root lives here)
   */
  constructor(procBones, procNames, parent) {
    this.root = cloneSkinned(template.holder);
    parent.add(this.root);
    parent.updateMatrixWorld(true);

    const joints = new Map();
    this.root.traverse((o) => {
      if (o.isBone) {
        const n = jointName(o.name);
        if (n && !joints.has(n)) joints.set(n, o);
      }
    });
    const byName = new Map(procNames.map((n, i) => [n, procBones[i]]));

    this.pairs = [];
    for (const [pn, jn, aim] of MAP) {
      this.pairs.push({ proc: byName.get(pn), bone: joints.get(jn), aim: aim ? joints.get(aim) : null, offset: new THREE.Quaternion() });
    }

    // ---- matched bind: swing each mapped model bone onto its procedural
    // counterpart's direction, parents first (MAP is in hierarchy order).
    const procChildDir = (pb, out) => {
      // the procedural bone's own axis is local +Y (rig.js convention)
      return out.set(0, 1, 0).applyQuaternion(pb.getWorldQuaternion(_q2)).normalize();
    };
    for (const pr of this.pairs) {
      if (!pr.aim) continue;
      const head = pr.bone.getWorldPosition(_v);
      const dir = pr.aim.getWorldPosition(_v2).sub(head).normalize();
      const want = procChildDir(pr.proc, new THREE.Vector3());
      const swing = _q.setFromUnitVectors(dir, want);
      this._setWorldQuat(pr.bone, swing.multiply(pr.bone.getWorldQuaternion(new THREE.Quaternion())));
    }

    // ---- offsets, and the hips anchor in procedural-hips space -------------
    for (const pr of this.pairs) {
      const procW = pr.proc.getWorldQuaternion(new THREE.Quaternion());
      const modelW = pr.bone.getWorldQuaternion(new THREE.Quaternion());
      pr.offset.copy(procW.invert()).multiply(modelW);
    }
    const hips = this.pairs[0];
    this.hipsLocal = hips.proc.worldToLocal(hips.bone.getWorldPosition(new THREE.Vector3()));
  }

  /** Give `bone` the world rotation `q`, keeping its world position. */
  _setWorldQuat(bone, q) {
    const parentW = bone.parent.getWorldQuaternion(_q2);
    bone.quaternion.copy(parentW.invert().multiply(q));
    bone.updateMatrixWorld(true);
  }

  /** Copy the procedural pose onto the model. Call after the procedural bones
   *  (animator or ragdoll) have their final world matrices for the frame. */
  sync() {
    const hips = this.pairs[0];
    // hips position: the anchor point, carried by the procedural hips
    const target = _v.copy(this.hipsLocal);
    hips.proc.localToWorld(target);
    hips.bone.parent.updateWorldMatrix(true, false);
    hips.bone.position.copy(hips.bone.parent.worldToLocal(target));
    for (const pr of this.pairs) {
      const w = pr.proc.getWorldQuaternion(_q).multiply(pr.offset);
      this._setWorldQuat(pr.bone, w);
    }
  }

  set visible(v) {
    this.root.visible = v;
  }

  dispose() {
    this.root.parent?.remove(this.root);
  }
}
