// ============================================================================
//  ARMAS — classe Weapon (port de weapons/weapon.gd) + modelos 3D
//  Weapon: munição, cadência, modos de disparo, recarga (normal e cartucho a
//  cartucho), dispersão, recuo, mira, sacar/guardar e animação procedural.
// ============================================================================
import * as THREE from 'three';
import { clone as cloneSkinned } from '../vendor/addons/utils/SkeletonUtils.js?v=8';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js?v=8';
import { WEAPONS, CAMERA, MOVE } from './config.js?v=8';
import { clamp, lerp, damp, moveToward, rand, DEG, smoothstep } from './util.js?v=8';
import { play } from './audio.js?v=8';

const SIGHT_Y = 0.06;
const loader = new GLTFLoader();
const modelCache = {};

// Texturas decodificadas direto dos bytes do modelo (createImageBitmap), sem
// fetch de "blob:" — a página publicada bloqueia esse tipo de acesso e, sem
// isso, as armas ficavam sem textura (brancas).
const WRAP = { 33071: THREE.ClampToEdgeWrapping, 33648: THREE.MirroredRepeatWrapping, 10497: THREE.RepeatWrapping };
/** Decodifica uma imagem com fallbacks (Chrome, Firefox e Safari diferem). */
async function decodeImage(blob) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); } catch {}
    try { return await createImageBitmap(blob); } catch {}
  }
  // Último recurso: <img> com URL blob: (imagens blob: são permitidas).
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

loader.register((parser) => ({
  name: 'inline_image_decoder',
  loadTexture(textureIndex) {
    const json = parser.json, tdef = json.textures[textureIndex];
    const src = json.images && json.images[tdef.source];
    if (!src || src.bufferView === undefined) return null;
    return parser.getDependency('bufferView', src.bufferView).then(async (buf) => {
      const blob = new Blob([buf], { type: src.mimeType || 'image/png' });
      const tex = new THREE.Texture(await decodeImage(blob));
      const smp = (json.samplers || [])[tdef.sampler] || {};
      tex.wrapS = WRAP[smp.wrapS] ?? THREE.RepeatWrapping;
      tex.wrapT = WRAP[smp.wrapT] ?? THREE.RepeatWrapping;
      tex.flipY = false;
      tex.anisotropy = 8;
      tex.needsUpdate = true;
      return tex;
    });
  },
}));

/**
 * Carrega um modelo salvo como glTF JSON com o buffer em base64 (formato que
 * a hospedagem serve). Remonta um .glb na memória e usa o GLTFLoader, sem
 * nenhum outro download.
 */
export async function loadModelFile(url) {
  const js = await (await fetch(url)).json();
  const uri = js.buffers[0].uri;
  delete js.buffers[0].uri;
  const b64 = uri.slice(uri.indexOf(',') + 1);
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const enc = new TextEncoder();
  let jsonBytes = enc.encode(JSON.stringify(js));
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4, binPad = (4 - (bin.length % 4)) % 4;
  const total = 12 + 8 + jsonBytes.length + jsonPad + 8 + bin.length + binPad;
  const out = new ArrayBuffer(total), dv = new DataView(out), u8 = new Uint8Array(out);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.length + jsonPad, true); dv.setUint32(16, 0x4e4f534a, true);
  u8.set(jsonBytes, 20); u8.fill(0x20, 20 + jsonBytes.length, 20 + jsonBytes.length + jsonPad);
  let o = 20 + jsonBytes.length + jsonPad;
  dv.setUint32(o, bin.length + binPad, true); dv.setUint32(o + 4, 0x004e4942, true);
  u8.set(bin, o + 8);
  return loader.parseAsync(out, '');
}

export class Weapon {
  constructor(id, owner) {
    this.id = id;
    this.cfg = WEAPONS[id];
    this.owner = owner;          // Player
    this.mag = this.cfg.mag;
    this.reserve = this.cfg.reserve;
    this.state = 'holstered';    // holstered | drawing | ready | reloading | holstering
    this.ads = 0;
    this.spread = 0;
    this.shots = 0;
    this.cooldown = 0; this.bloom = 0; this.timer = 0; this.total = 1;
    this.committed = false; this.autoReload = -1; this.triggerIdle = 0;
    this.shellPhase = 'start';
    // animação
    this.root = new THREE.Group();   // posicionado a cada frame
    this.root.visible = false;
    this.kickPos = new THREE.Vector3(); this.kickRot = new THREE.Vector3();
    this.swayX = 0; this.swayY = 0; this.sprintBlend = 0; this.reloadBlend = 0; this.crouchBlend = 0;
    this.action = 0; this.time = 0; this.flashTime = 0;
    this.sightHeight = SIGHT_Y;
    this.muzzle = new THREE.Object3D();
    this.root.add(this.muzzle);
    this.buildFallback();
    this.buildFlash();
    this.loadModel();
  }

  // ------------------------------------------------------------ modelo
  buildFallback() {
    // Modelo simples (caixas) enquanto o .glb carrega ou se ele falhar.
    const g = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: 0x222326, roughness: 0.5, metalness: 0.5 });
    const L = this.cfg.model.length;
    const add = (sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), dark); m.position.set(x, y, z); g.add(m); };
    add(0.06, 0.08, L * 0.45, 0, SIGHT_Y - 0.05, -L * 0.1);
    add(0.025, 0.025, L * 0.4, 0, SIGHT_Y - 0.03, -L * 0.5);
    add(0.045, 0.14, 0.06, 0, SIGHT_Y - 0.14, -L * 0.1);
    if (L > 0.4) add(0.045, 0.08, L * 0.3, 0, SIGHT_Y - 0.07, L * 0.25);
    this.muzzle.position.set(0, SIGHT_Y - 0.03, -L * 0.7);
    this.model = g;
    this.root.add(g);
  }

  loadModel() {
    const url = this.cfg.model.url;
    const done = (gltf) => {
      const scene = gltf.scene.clone(true);
      // clone perde o vínculo do esqueleto em malhas com skin; usa o original se preciso
      const src = hasSkin(gltf.scene) ? gltf.scene : scene;
      this.applyModel(src);
    };
    if (modelCache[url]) { modelCache[url].then(done).catch(() => {}); return; }
    modelCache[url] = loadModelFile(url);
    modelCache[url].then(done).catch((e) => console.warn('Modelo não carregou, usando o simples:', url, e));
  }

  applyModel(scene) {
    const mc = this.cfg.model;
    const pivot = new THREE.Group();
    pivot.add(scene);
    scene.traverse((o) => {
      if (o.isBone && mc.hideBones && mc.hideBones.includes(o.name)) o.scale.setScalar(1e-4);
      if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; }
    });
    pivot.rotation.y = mc.rotY * DEG;
    pivot.updateMatrixWorld(true);
    scene.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.update(); });
    const box = new THREE.Box3().setFromObject(pivot, true);
    const s = mc.length / Math.max(box.max.z - box.min.z, 1e-6);
    const sight = box.max.y * s - mc.sightDrop;
    const off = [-(box.min.x + box.max.x) / 2 * s + mc.offset[0], SIGHT_Y - sight + mc.offset[1], mc.length * mc.rear - box.max.z * s + mc.offset[2]];
    pivot.scale.setScalar(s);
    pivot.position.set(off[0], off[1], off[2]);
    this.sightHeight = SIGHT_Y + mc.offset[1];
    this.muzzle.position.set(0, this.sightHeight - mc.length * 0.035, box.min.z * s + off[2]);
    this.root.remove(this.model);
    this.model = pivot;
    this.root.add(pivot);
  }

  buildFlash() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.3, 'rgba(255,180,80,0.8)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flash.scale.setScalar(0.16);
    this.flash.visible = false;
    this.muzzle.add(this.flash);
  }

  // ------------------------------------------------------------ API
  draw() {
    this.root.visible = true; this.state = 'drawing'; this.total = this.timer = this.cfg.draw; this.sprintBlend = 0;
    play('draw', { volume: 0.5 });
  }
  holster() {
    if (this.state === 'holstered') return;
    if (this.state === 'reloading') this.cancelReload();
    this.state = 'holstering'; this.total = this.timer = this.cfg.holster; this.ads = Math.min(this.ads, 0.5);
  }
  forceHolster() { this.cancelReload(); this.state = 'holstered'; this.root.visible = false; this.ads = 0; }
  isScoped() { return this.cfg.sight === 'scope' && this.ads >= 0.85 && this.state !== 'reloading'; }
  resetAmmo() { this.mag = this.cfg.mag; this.reserve = this.cfg.reserve; }
  refill() { this.reserve = this.cfg.maxReserve; }
  reloadProgress() { return this.state === 'reloading' ? clamp(1 - this.timer / Math.max(this.total, 1e-3), 0, 1) : 0; }

  /** Lógica: cadência, recarga, mira. ctx = estado do jogador. */
  tick(dt, ctx) {
    const c = this.cfg;
    this.bloom = moveToward(this.bloom, 0, c.bloomRec * dt);
    if (ctx.triggerHeld) this.triggerIdle = 0; else { this.triggerIdle += dt; if (this.triggerIdle > 0.25) this.shots = 0; }
    if (this.state === 'drawing') { this.timer -= dt; if (this.timer <= 0) this.state = 'ready'; }
    else if (this.state === 'holstering') { this.timer -= dt; if (this.timer <= 0) { this.state = 'holstered'; this.root.visible = false; } }
    else if (this.state === 'reloading') this.processReload(dt);

    const canAds = ctx.wantsAds && !ctx.sprinting && this.state !== 'holstering' && this.state !== 'holstered';
    this.ads = moveToward(this.ads, canAds ? 1 : 0, dt / Math.max(c.adsTime, 0.01));
    this.sprintBlend = moveToward(this.sprintBlend, ctx.sprinting && this.state !== 'reloading' ? 1 : 0, dt / 0.18);
    this.spread = this.computeSpread(ctx);
    if (ctx.reloadPressed) this.startReload();
    if (this.autoReload >= 0) { this.autoReload -= dt; if (this.autoReload < 0 && this.mag === 0) this.startReload(); }
    this.cooldown -= dt;
    if (this.cooldown < 0 && !ctx.triggerHeld) this.cooldown = 0;
    this.handleTrigger(ctx);
  }

  handleTrigger(ctx) {
    const c = this.cfg;
    if (!(ctx.triggerHeld || ctx.triggerPressed)) return;
    if (this.state !== 'ready' && this.state !== 'reloading') return;
    if (this.sprintBlend > 0.35) return;
    if (this.mag <= 0) { if (ctx.triggerPressed) { play('empty', { volume: 0.6 }); this.startReload(); } return; }
    if (this.state === 'reloading') {
      const canFire = c.shellReload ? this.mag > 0 : this.committed;
      if (!canFire) return;
      this.cancelReload();
    }
    const auto = c.fireMode === 'auto';
    if (!auto && !ctx.triggerPressed) return;
    if (this.cooldown > 0) return;
    let guard = 0;
    while (this.cooldown <= 0 && this.mag > 0 && guard++ < 3) {
      this.fire(ctx);
      this.cooldown += 60 / c.rpm;
      if (!auto) break;
    }
  }

  fire(ctx) {
    const c = this.cfg;
    this.mag--; this.shots++;
    const aim = this.owner.aim();  // {origin, dir}
    for (let i = 0; i < c.pellets; i++) {
      let sp = this.spread;
      if (c.pellets > 1) sp = Math.max(sp, c.pelletSpread * lerp(1, 0.8, this.ads));
      this.owner.game.fireBullet(this.owner, aim.origin, aim.dir, sp, c, 1, i === 0 ? this.muzzleWorld() : null);
    }
    this.bloom = Math.min(this.bloom + c.bloom, c.maxBloom);
    // recuo (câmera)
    let v = c.recoilV * rand(0.85, 1.15), h = c.recoilH * (rand(-1, 1) + c.recoilBias);
    if (c.climb) { v *= 1 + Math.min(this.shots, 10) * 0.06; h += (this.shots < 8 ? 0.35 : -0.45) * c.recoilH; }
    if (this.id === 'mp4' && this.shots <= 3) v *= 1.2;
    let mult = lerp(1, c.adsRecoil, this.ads) * CAMERA.recoil * (ctx.crouching ? 0.85 : 1);
    this.owner.applyRecoil(v * mult, h * mult, c);
    // recuo visual da arma
    const km = lerp(1, 0.55, this.ads) * CAMERA.recoil;
    this.kickPos.x += rand(-0.004, 0.004) * km; this.kickPos.y += 0.004 * km; this.kickPos.z += c.kick * km;
    this.kickRot.x += c.kickRot * km; this.kickRot.y += rand(-1, 1) * c.kickRot * 0.3 * km; this.kickRot.z += rand(-1, 1) * c.kickRot * 0.4 * km;
    this.flashTime = 0.045; this.flash.visible = !this.isScoped(); this.flash.material.rotation = Math.random() * 6.28;
    this.flash.scale.setScalar(0.16 * rand(0.8, 1.3) * (c.pellets > 1 ? 1.6 : 1));
    play(c.sound, { volume: 0.9 });
    this.owner.game.noise(this.owner.pos, c.noise, this.owner);
    if (c.fireMode === 'pump' || c.fireMode === 'bolt') {
      this.action = 1;
      setTimeout(() => play(c.fireMode === 'pump' ? 'pump' : 'bolt', { volume: 0.5 }), c.fireMode === 'pump' ? 220 : 350);
    }
    if (this.id === 'glock') this.action = 1;
    this.owner.onFired(this);
    if (this.mag === 0 && this.reserve > 0) this.autoReload = 0.3;
  }

  muzzleWorld() { return this.owner.muzzleWorld(); }

  computeSpread(ctx) {
    const c = this.cfg;
    const base = lerp(c.hipSpread, c.adsSpread, this.ads);
    let move = c.moveSpread * clamp(ctx.moveRatio, 0, 1.5) * lerp(1, 0.35, this.ads);
    if (!ctx.grounded) move += c.moveSpread * 1.5;
    const bloom = this.bloom * lerp(1, 0.5, this.ads);
    return (base + move + bloom) * (ctx.crouching ? 0.85 : 1) * (1 + (1 - clamp(c.accuracy, 0, 1)));
  }

  // ------------------------------------------------------------ recarga
  startReload() {
    if (this.state !== 'ready' || this.mag >= this.cfg.mag || this.reserve <= 0) return false;
    this.state = 'reloading'; this.committed = false; this.autoReload = -1;
    if (this.cfg.shellReload) { this.shellPhase = 'start'; this.total = this.timer = this.cfg.reloadStart; }
    else { this.total = this.timer = this.mag === 0 ? this.cfg.reloadEmpty : this.cfg.reload; play('reload', { volume: 0.7 }); }
    return true;
  }
  processReload(dt) {
    const c = this.cfg;
    this.timer -= dt;
    if (c.shellReload) {
      if (this.timer > 0) return;
      if (this.shellPhase === 'start') { this.shellPhase = 'shells'; this.total = this.timer = c.reload; }
      else if (this.shellPhase === 'shells') {
        this.mag++; this.reserve--; this.committed = true; play('shell', { volume: 0.6 });
        if (this.mag >= c.mag || this.reserve <= 0) { this.shellPhase = 'end'; this.total = this.timer = c.reloadEnd; }
        else this.timer = c.reload;
      } else this.state = 'ready';
      return;
    }
    if (!this.committed && this.reloadProgress() >= c.commit) {
      const take = Math.min(c.mag - this.mag, this.reserve);
      this.mag += take; this.reserve -= take; this.committed = true;
    }
    if (this.timer <= 0) this.state = 'ready';
  }
  cancelReload() { if (this.state === 'reloading') this.state = 'ready'; }

  // ------------------------------------------------------------ animação
  /** Pose procedural: quadril↔mira, balanço, sway, corrida, recarga, troca. */
  animate(dt, ctx) {
    const c = this.cfg;
    this.time += dt;
    const wf = 0.8 + c.weight * 0.08;
    const adsE = smoothstep(0, 1, this.ads), notAds = 1 - adsE * 0.9;
    this.reloadBlend = moveToward(this.reloadBlend, this.state === 'reloading' ? 1 : 0, dt * 5);
    this.crouchBlend = moveToward(this.crouchBlend, ctx.crouching ? 1 : 0, dt * 5);
    const ret = 1 - Math.exp(-(16 / wf) * dt);
    this.kickPos.lerp(new THREE.Vector3(), ret); this.kickRot.lerp(new THREE.Vector3(), ret);
    this.action = moveToward(this.action, 0, dt * 2.2);
    // sway ao virar (graus/s -> metros)
    const rx = ctx.lookDX / Math.max(dt, 1e-4), ry = ctx.lookDY / Math.max(dt, 1e-4);
    let tx = -rx * MOVE.weaponSway * CAMERA.sway * wf * notAds, ty = -ry * MOVE.weaponSway * CAMERA.sway * wf * notAds;
    const tl = Math.hypot(tx, ty); if (tl > MOVE.weaponSwayMax) { tx *= MOVE.weaponSwayMax / tl; ty *= MOVE.weaponSwayMax / tl; }
    const sr = 1 - Math.exp(-(9 / wf) * dt);
    this.swayX = lerp(this.swayX, tx, sr); this.swayY = lerp(this.swayY, ty, sr);
    // balanço ao andar (padrão muda com andar / correr / agachar)
    const amp = ctx.state === 'sprint' ? MOVE.weaponBobSprint : ctx.state === 'crouch' ? MOVE.weaponBobCrouch : MOVE.weaponBobWalk;
    const k = clamp(ctx.moveRatio, 0, 1.4) * notAds * CAMERA.headBob, ph = ctx.stepPhase;
    const pos = new THREE.Vector3(c.hip[0], c.hip[1], c.hip[2]).lerp(new THREE.Vector3(0, -this.sightHeight, -c.adsDist), adsE);
    const rot = new THREE.Vector3();
    pos.x += Math.sin(ph) * amp[0] * wf * k; pos.y += -Math.abs(Math.sin(ph)) * amp[1] * wf * k;
    rot.z += Math.sin(ph) * 1.2 * k;
    if (ctx.state === 'sprint') { rot.x += Math.sin(ph * 2) * 3 * this.sprintBlend; rot.y += Math.sin(ph) * 4 * this.sprintBlend; }
    pos.y += Math.sin(this.time * 1.6) * 0.002 * notAds;
    pos.x += this.swayX; pos.y += this.swayY;
    rot.x += this.swayY * 60; rot.y += this.swayX * 60; rot.z += -this.swayX * 40;
    const sp = smoothstep(0, 1, this.sprintBlend);
    pos.add(new THREE.Vector3(-0.04, -0.05, 0.04).multiplyScalar(sp));
    rot.x += c.sprintRot[0] * sp; rot.y += c.sprintRot[1] * sp; rot.z += c.sprintRot[2] * sp;
    rot.z += 4 * this.crouchBlend * notAds;
    const rl = smoothstep(0, 1, this.reloadBlend), rattle = Math.sin(this.time * 22) * 1.5 * rl;
    pos.add(new THREE.Vector3(-0.02, -0.07, 0.03).multiplyScalar(rl));
    rot.x += (-18 + rattle) * rl; rot.y += 12 * rl; rot.z += 28 * rl;
    let sw = 0;
    if (this.state === 'drawing') sw = Math.pow(clamp(this.timer / this.total, 0, 1), 2);
    else if (this.state === 'holstering') sw = Math.pow(clamp(1 - this.timer / this.total, 0, 1), 2);
    else if (this.state === 'holstered') sw = 1;
    pos.add(new THREE.Vector3(0, -0.32, 0.08).multiplyScalar(sw)); rot.x += -45 * sw; rot.z += 10 * sw;
    // ferrolho/bomba: pequeno "tranco" da arma
    if (this.action > 0 && this.id !== 'glock') { const a = Math.sin(clamp((1 - this.action) * 1.5, 0, 1) * Math.PI); rot.z += a * 8; pos.y -= a * 0.01; }
    pos.add(this.kickPos); rot.add(this.kickRot);
    this.root.position.copy(pos);
    this.root.rotation.set(rot.x * DEG, rot.y * DEG, rot.z * DEG, 'YXZ');
    this.model.visible = !this.isScoped();
    if (this.flashTime > 0) { this.flashTime -= dt; if (this.flashTime <= 0) this.flash.visible = false; }
  }
}

function hasSkin(obj) { let s = false; obj.traverse((o) => { if (o.isSkinnedMesh) s = true; }); return s; }

/** Pré-carrega todos os modelos (para não travar ao trocar de arma). */
export function preloadModels() {
  return Promise.allSettled(Object.values(WEAPONS).map((w) => {
    if (!modelCache[w.model.url]) modelCache[w.model.url] = loadModelFile(w.model.url);
    return modelCache[w.model.url].then((g) => { loaded[w.model.url] = g; return g; });
  }));
}
const loaded = {};

/**
 * Arma em "terceira pessoa" (nas mãos dos bots): o modelo já carregado,
 * com o cano para -Z, cabo na origem. Retorna { root, muzzle } ou null.
 */
export function buildWorldGun(id) {
  const mc = WEAPONS[id].model, gltf = loaded[mc.url];
  if (!gltf) return null;
  const scene = cloneSkinned(gltf.scene);
  const pivot = new THREE.Group(); pivot.add(scene);
  scene.traverse((o) => {
    if (o.isBone && mc.hideBones && mc.hideBones.includes(o.name)) o.scale.setScalar(1e-4);
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; }
  });
  pivot.rotation.y = mc.rotY * DEG;
  pivot.updateMatrixWorld(true);
  scene.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.update(); });
  const box = new THREE.Box3().setFromObject(pivot, true);
  const s = mc.length / Math.max(box.max.z - box.min.z, 1e-6);
  pivot.scale.setScalar(s);
  // cabo (≈ 35% a partir de trás) na origem
  pivot.position.set(-(box.min.x + box.max.x) / 2 * s, -(box.min.y + box.max.y) / 2 * s, -(box.max.z * s - mc.length * 0.3));
  const root = new THREE.Group(); root.add(pivot);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.02, box.min.z * s + pivot.position.z); root.add(muzzle);
  return { root, muzzle };
}
