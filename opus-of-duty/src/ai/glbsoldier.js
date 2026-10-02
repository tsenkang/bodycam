/**
 * AI — authored soldier body (soldier_full_tactical_gear.glb, a Character
 * Creator "CC_Base" rig with 114 joints) driven by the procedural 25-bone rig.
 *
 * This file only loads the model. Everything else (normalising, merging the
 * meshes per material, the retarget, grip and finger curl) lives in
 * src/ai/glbrig.js, which is plain three.js so pose tooling can run it in node.
 */

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import soldierUrl from './assets/soldier.glb?url';
import { prepareTemplate, SoldierSkin as Skin } from './glbrig.js';

/** Loaded once, cloned per soldier. */
let template = null;
let loading = null;

/** Resolves to the template, or null on failure (caller falls back to the procedural body). */
export function loadSoldierModel() {
  if (template) return Promise.resolve(template);
  if (loading) return loading;
  loading = new GLTFLoader()
    .loadAsync(soldierUrl)
    .then((gltf) => {
      template = prepareTemplate(gltf.scene);
      console.info(`[ai] soldier model ${template.tris} tris, ${template.materials.length} draws, scale ${template.scale.toExponential(2)}`);
      return template;
    })
    .catch((err) => {
      console.warn('[ai] soldier model failed to load, using the procedural body', err);
      return null;
    });
  return loading;
}

/** The loaded template (null before loadSoldierModel resolves). */
export const soldierTemplate = () => template;

/** One soldier's copy of the model, slaved to that soldier's procedural bones. */
export class SoldierSkin extends Skin {
  constructor(procBones, procNames, parent, opts) {
    super(template, procBones, procNames, parent, opts);
  }
}
