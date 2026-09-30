// ============================================================================
//  SOLDADOS 3D dos bots — modelo "3 soldier low poly" (CC-BY 4.0, buh/Sketchfab)
//  O modelo vem em pose de "A", sem animações. Aqui a pose é feita por código:
//   - braços: IK de 2 ossos até a arma (segurando o fuzil)
//   - pernas: balanço ao andar e joelhos dobrados ao agachar
//  Identificação das equipes: aliados = camuflagem verde + braçadeira azul;
//  inimigos = camuflagem deserto + braçadeira vermelha.
// ============================================================================
import * as THREE from 'three';
import { clone as cloneSkinned } from '../vendor/addons/utils/SkeletonUtils.js?v=7';
import { loadModelFile } from './weapons.js?v=7';

const HEIGHT = 1.8;               // altura final do soldado (m)
export const CROUCH_DROP = 0.33;  // quanto o quadril desce agachado (m)
const VARIANTS = { R: 0, S: 1, A: 2 }; // ordem dos filhos do nó "Root"
let source = null;

export async function loadSoldiers() {
  if (source) return source;
  try {
    const gltf = await loadModelFile('models/soldiers.gltf.json');
    source = gltf.scene.getObjectByName('Root') || gltf.scene.children[0];
  } catch (e) { console.warn('Soldados não carregaram, usando bonecos simples', e); source = null; }
  return source;
}
export const soldiersReady = () => !!source;

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

/** Gira um osso (no mundo) para que a direção até "child" aponte para target. */
function aim(bone, child, target) {
  bone.updateWorldMatrix(true, false);
  child.updateWorldMatrix(false, false);
  const p = bone.getWorldPosition(new THREE.Vector3());
  const cur = child.getWorldPosition(new THREE.Vector3()).sub(p).normalize();
  const want = target.clone().sub(p).normalize();
  const delta = _q.setFromUnitVectors(cur, want);
  const worldQ = bone.getWorldQuaternion(new THREE.Quaternion());
  const parentQ = bone.parent.getWorldQuaternion(_q2);
  bone.quaternion.copy(parentQ.invert().multiply(delta.multiply(worldQ)));
  bone.updateWorldMatrix(false, true);
}

/** IK de 2 ossos: ombro→cotovelo→mão até target, cotovelo puxado para pole. */
function twoBone(upper, lower, hand, target, pole) {
  const s = upper.getWorldPosition(new THREE.Vector3());
  const l1 = s.distanceTo(lower.getWorldPosition(_v)), l2 = lower.getWorldPosition(_v).distanceTo(hand.getWorldPosition(_v2));
  const toT = target.clone().sub(s); const d = Math.min(toT.length(), (l1 + l2) * 0.999); toT.normalize();
  const a = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), ang = Math.acos(Math.max(-1, Math.min(1, a)));
  const side = pole.clone().sub(s); side.sub(toT.clone().multiplyScalar(side.dot(toT))).normalize();
  const elbow = s.clone().add(toT.clone().multiplyScalar(Math.cos(ang) * l1)).add(side.multiplyScalar(Math.sin(ang) * l1));
  aim(upper, lower, elbow);
  aim(lower, hand, target);
}

/**
 * Cria um soldado. Retorna null se o modelo não carregou.
 * { root: Group (pés na origem, olhando para -Z), pose(dt, speed, crouch) }
 */
export function createSoldier(team, index) {
  if (!source) return null;
  const variant = team === 0 ? (index % 2 === 0 ? 'S' : 'R') : 'A';
  const src = source.children[VARIANTS[variant]];
  const model = cloneSkinned(src);
  // Herda a transformação dos nós pais (o arquivo converte Z-up → Y-up no "Root").
  source.parent && source.parent.updateMatrixWorld(true);
  src.updateMatrixWorld(true);
  src.matrixWorld.decompose(model.position, model.quaternion, model.scale);
  model.position.set(0, 0, 0);
  const holder = new THREE.Group();   // gira 180° (o modelo olha para +Z)
  holder.add(model);
  holder.rotation.y = Math.PI;
  const root = new THREE.Group();
  root.add(holder);
  // Centraliza e escala para HEIGHT com os pés no chão.
  root.updateMatrixWorld(true);
  model.traverse((o) => { if (o.isSkinnedMesh) { o.skeleton.update(); o.castShadow = true; o.frustumCulled = false; o.layers.set(0); } });
  const box = new THREE.Box3().setFromObject(model, true);
  const sc = HEIGHT / (box.max.y - box.min.y);
  holder.scale.setScalar(sc);
  const c = box.getCenter(new THREE.Vector3());
  model.position.set(c.x, -box.min.y, c.z); // holder gira 180°: x/z invertem
  root.updateMatrixWorld(true);

  const bones = {};
  model.traverse((o) => { if (o.isBone) { const m = /^Bone(\d{3})_/.exec(o.name); if (m) bones[m[1]] = o; } });
  const B = (n) => bones[n];
  const ok = ['007', '008', '009', '010', '011', '012', '013', '014', '015', '036', '037', '038'].every((n) => B(n));
  const rest = {};
  for (const k in bones) rest[k] = bones[k].quaternion.clone();

  // Braços segurando a arma (espaço do bot: frente = -Z, direita = +X).
  const gunGrip = new THREE.Vector3(0.14, 1.2, -0.22), gunFore = new THREE.Vector3(-0.02, 1.26, -0.52);
  function poseArms() {
    if (!ok) return;
    root.updateMatrixWorld(true);
    const W = (v) => v.clone().applyMatrix4(root.matrixWorld);
    twoBone(B('036'), B('037'), B('038'), W(gunGrip), W(new THREE.Vector3(0.5, 0.9, 0.1)));   // braço direito
    twoBone(B('013'), B('014'), B('015'), W(gunFore), W(new THREE.Vector3(-0.5, 0.9, -0.1))); // braço esquerdo
  }
  poseArms();

  // Braçadeiras da equipe (bem visíveis de lado) + faixa no capacete.
  const bandMat = new THREE.MeshStandardMaterial({ color: team === 0 ? 0x2f7bff : 0xff3322, emissive: team === 0 ? 0x0a2a66 : 0x661008, roughness: 0.6 });
  const addBand = (bone, child, w, h) => {
    if (!bone || !child) return;
    const mid = bone.getWorldPosition(new THREE.Vector3()).lerp(child.getWorldPosition(new THREE.Vector3()), 0.45);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(w, w, h, 10), bandMat);
    const ws = bone.getWorldScale(new THREE.Vector3()).x;
    band.scale.setScalar(1 / ws);
    bone.add(band);
    band.position.copy(bone.worldToLocal(mid.clone()));
    // alinha o cilindro com o osso
    const dir = child.position.clone().normalize();
    band.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    band.castShadow = true;
  };
  addBand(B('013'), B('014'), 0.062, 0.1);
  addBand(B('036'), B('037'), 0.062, 0.1);
  if (B('005') && B('004')) {
    const head = B('005');
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.018, 6, 20), bandMat);
    const ws = head.getWorldScale(new THREE.Vector3()).x;
    band.scale.setScalar(1 / ws);
    head.add(band);
    band.position.copy(head.worldToLocal(head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.12, 0))));
    const up = head.worldToLocal(head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1, 0))).sub(head.worldToLocal(head.getWorldPosition(new THREE.Vector3()))).normalize();
    band.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
  }

  let phase = 0;
  const legs = [['007', '008', '009', 1], ['010', '011', '012', -1]];
  /** Pose por quadro: balanço das pernas e agachar. */
  function pose(dt, speed, crouch) {
    if (!ok) { holder.scale.y = holder.scale.x * (1 - 0.3 * crouch); return; }
    phase += speed * dt * 2.3;
    const swingAmt = Math.min(1, speed / 3.5) * 0.55 * (1 - crouch * 0.7);
    holder.position.y = -CROUCH_DROP * crouch;
    for (const [t, k, a, side] of legs) {
      B(t).quaternion.copy(rest[t]); B(k).quaternion.copy(rest[k]);
    }
    root.updateMatrixWorld(true);
    for (const [t, k, a, side] of legs) {
      const sw = Math.sin(phase) * swingAmt * side;
      // Coxa: vertical -> à frente (agachado) + balanço da passada.
      const thighAng = sw + crouch * 1.45;
      const hip = B(t).getWorldPosition(new THREE.Vector3());
      const dirT = new THREE.Vector3(0, -Math.cos(thighAng), -Math.sin(thighAng)).applyQuaternion(root.quaternion);
      aim(B(t), B(k), hip.clone().add(dirT));
      // Canela: quase vertical; dobra mais na passada para trás.
      const kneeBend = crouch * 0.15 + Math.max(0, -sw) * 0.9;
      const knee = B(k).getWorldPosition(new THREE.Vector3());
      const shinAng = thighAng - (crouch * 1.45 + kneeBend);
      const dirS = new THREE.Vector3(0, -Math.cos(shinAng), -Math.sin(shinAng)).applyQuaternion(root.quaternion);
      aim(B(k), B(a), knee.clone().add(dirS));
    }
  }

  // Pontos para a arma e o cano (no espaço do bot).
  return { root, pose, gunGrip, gunFore };
}
