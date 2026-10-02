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
      tuneMaterials(template);
      console.info(`[ai] soldier model ${template.tris} tris, ${template.materials.length} draws, scale ${template.scale.toExponential(2)}`);
      return template;
    })
    .catch((err) => {
      console.warn('[ai] soldier model failed to load, using the procedural body', err);
      return null;
    });
  return loading;
}

/**
 * Albedo calibration under the game's exposure. The file's colour maps average
 * 0.012-0.045 linear (sRGB 34-63): charcoal, not olive. Under the street's
 * light that made every enemy a dark lump at 10-25 m, with no separation
 * between helmet, carrier, shirt and trousers. Real olive drab / ranger green
 * nylon sits at 0.07-0.12 linear. Each factor below multiplies the map (so
 * its detail is kept) and lands its mean in that band, keeping the parts a
 * step apart in value so the silhouette reads as kit, not one blob. The
 * balaclava is pulled away from the map's yellow-green toward a neutral
 * grey-olive: on the flat-lit chromebook preset it read as green paint.
 */
const ALBEDO = {
  Mark_Kitel_1: [2.5, 2.5, 2.7], // shirt: lightest fabric, ~0.075
  Mark_Pants_1: [2.3, 2.3, 2.5], // trousers
  Mark_Plate_1: [1.75, 1.75, 1.85], // carrier, a step darker than the shirt
  Mark_Pouches_1: [1.7, 1.65, 1.75],
  Mark_Helmet1: [2.3, 2.3, 2.4],
  Mark_Gloves_1: [1.35, 1.3, 1.35],
  Mark_Boots_2: [2.6, 2.5, 2.4],
  Mark_HeadMasked: [2.0, 1.85, 3.0],
};
const ROUGH = {
  // no roughness map on the mask; knit wool is not a 0.95 diffuser at grazing
  Mark_HeadMasked: 0.86,
};

function tuneMaterials(t) {
  for (const m of t.materials) {
    const k = ALBEDO[m.name];
    if (k && m.color) m.color.setRGB(m.color.r * k[0], m.color.g * k[1], m.color.b * k[2]);
    if (ROUGH[m.name] !== undefined) m.roughness = ROUGH[m.name];
    // the normal maps carry the weave and the stitching; a touch more relief
    // keeps it from flattening under overcast light
    if (m.normalMap && m.normalScale) m.normalScale.multiplyScalar(1.25);
  }
}

/** The loaded template (null before loadSoldierModel resolves). */
export const soldierTemplate = () => template;

/** One soldier's copy of the model, slaved to that soldier's procedural bones. */
export class SoldierSkin extends Skin {
  constructor(procBones, procNames, parent, opts) {
    super(template, procBones, procNames, parent, opts);
  }
}
