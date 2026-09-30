// ============================================================================
//  JOGADOR — movimento (PlayerMovement), câmera bodycam (BodycamCamera),
//  armas (WeaponManager/Inventory), vida e interação. Port do projeto Godot.
// ============================================================================
import * as THREE from 'three';
import { CAMERA, MOVE, PLAYER, WEAPONS, LIGHTING, SETTINGS } from './config.js?v=8';
import { clamp, lerp, damp, moveToward, DEG, rand } from './util.js?v=8';
import { moveCharacter } from './physics.js?v=8';
import { Weapon } from './weapons.js?v=8';
import { play, setListener } from './audio.js?v=8';

export class Player {
  constructor(game) {
    this.game = game;
    this.team = 0;
    this.name = 'Você';
    this.pos = [0, 0, 0];
    this.vel = [0, 0, 0];
    this.yaw = 0; this.pitch = 0;
    this.grounded = true; this.wasGrounded = true; this.fallSpeed = 0;
    this.crouch = 0; this.crouching = false; this.crouchToggle = false;
    this.sprinting = false; this.sprintBlocked = false; this.sprintAmount = 0;
    this.stepPhase = 0; this.moveState = 'idle';
    this.health = PLAYER.maxHealth; this.sinceDamage = 0; this.invuln = 0;
    this.alive = true; this.lastRegion = 'torso'; this.lastWeapon = '';
    this.visibilityBoost = 0;
    // câmera
    this.camera = game.camera;
    this.fx = { lookX: 0, lookY: 0, lagX: 0, lagY: 0, bobW: 0, strafeRoll: 0, recoilTX: 0, recoilTY: 0, recoilX: 0, recoilY: 0,
      recoilRec: 8, land: 0, landVel: 0, shake: 0, t: 0, death: 0, deathRoll: 0 };
    // armas
    this.weapons = {};  // slot -> Weapon
    this.current = null; this.pending = null; this.previous = null;
    for (const id of PLAYER.startWeapons) this.addWeapon(id);
    this.equipImmediate(1);
    // lanterna (tecla F)
    this.flashlight = new THREE.SpotLight(0xf2f7ff, 40, 30, 26 * DEG, 0.6, 1.4);
    this.flashlight.visible = LIGHTING[SETTINGS.time].flashlight;
    this.flashlight.castShadow = SETTINGS.quality === 'alta';
    this.flashlight.shadow.mapSize.set(512, 512);
    game.scene.add(this.flashlight, this.flashlight.target);
    this.input = { lookDX: 0, lookDY: 0 };
  }

  // ------------------------------------------------------------ armas
  addWeapon(id) {
    const slot = WEAPONS[id].slot;
    if (this.weapons[slot]) { this.weapons[slot].refill(); return this.weapons[slot]; }
    const w = new Weapon(id, this);
    this.weapons[slot] = w;
    this.game.vmRoot.add(w.root);
    return w;
  }
  hasWeapon(id) { return !!this.weapons[WEAPONS[id].slot]; }
  slots() { return Object.keys(this.weapons).map(Number).sort((a, b) => a - b); }
  equipImmediate(slot) {
    const w = this.weapons[slot]; if (!w) return;
    for (const o of Object.values(this.weapons)) o.forceHolster();
    this.pending = null; this.current = w; w.draw();
  }
  select(slot) { const w = this.weapons[slot]; if (w) this.request(w); }
  cycle(dir) {
    const s = this.slots(); if (s.length < 2) return;
    const cur = (this.pending || this.current).cfg.slot;
    this.request(this.weapons[s[(s.indexOf(cur) + dir + s.length) % s.length]]);
  }
  quickSwitch() { if (this.previous && this.previous !== this.current) this.request(this.previous); }
  request(w) {
    if (!w) return;
    if (w === this.current) { if (this.pending) { this.pending = null; w.draw(); } return; }
    this.pending = w;
    if (!this.current || this.current.state === 'holstered') this.activate(w); else this.current.holster();
  }
  activate(w) {
    if (this.current && this.current !== w) { this.previous = this.current; this.current.forceHolster(); }
    this.current = w; this.pending = null; w.draw();
  }

  // ------------------------------------------------------------ interface p/ armas
  aim() {
    const o = this.camera.getWorldPosition(new THREE.Vector3());
    const d = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion()));
    return { origin: [o.x, o.y, o.z], dir: [d.x, d.y, d.z] };
  }
  muzzleWorld() {
    // Aproximação do cano no mundo: um pouco à direita/abaixo da câmera.
    const v = new THREE.Vector3(0.12, -0.12, -0.6).applyQuaternion(this.camera.quaternion).add(this.camera.position);
    return [v.x, v.y, v.z];
  }
  applyRecoil(v, h, cfg) {
    const carry = cfg.carry;
    this.pitch = clamp(this.pitch + v * carry * DEG, -88 * DEG, 88 * DEG);
    this.yaw += h * carry * DEG;
    this.fx.recoilTX += v * (1 - carry); this.fx.recoilTY += h * (1 - carry);
    this.fx.recoilRec = cfg.recoilRec;
    this.fx.shake = Math.min(this.fx.shake + cfg.shake * CAMERA.recoil, 1);
    this.visibilityBoost = 1.5;
    if (this.sprinting) this.sprintBlocked = true;
  }
  onFired() {}

  // ------------------------------------------------------------ interface de "combatente"
  eye() { return [this.pos[0], this.pos[1] + lerp(MOVE.eyeStand, MOVE.eyeCrouch, this.crouch), this.pos[2]]; }
  chest() { return [this.pos[0], this.pos[1] + lerp(1.2, 0.75, this.crouch), this.pos[2]]; }
  head() { return [this.pos[0], this.pos[1] + lerp(1.62, 1.1, this.crouch), this.pos[2]]; }
  visibility() { let f = 1; if (this.crouching) f *= 0.65; if (this.sprinting) f *= 1.25; return f + this.visibilityBoost; }
  weaponName() { return this.current ? this.current.cfg.name : ''; }
  /** Hitboxes no espaço local (x,z em volta dos pés; y absoluto). */
  hitParts() {
    const drop = 0.55 * this.crouch * 0.9;
    return [
      ['head', 0, 1.62 - drop, 0, 0.13, 0.13, 0.13],
      ['torso', 0, 1.19 - drop, 0, 0.23, 0.31, 0.16],
      ['arms', 0.3, 1.2 - drop, -0.15, 0.08, 0.28, 0.2],
      ['arms', -0.3, 1.2 - drop, -0.15, 0.08, 0.28, 0.2],
      ['legs', 0.12, 0.44, 0, 0.09, 0.43, 0.1],
      ['legs', -0.12, 0.44, 0, 0.09, 0.43, 0.1],
    ];
  }

  damage(amount, attacker, region) {
    if (!this.alive || this.invuln > 0) return false;
    this.health = Math.max(0, this.health - amount);
    this.sinceDamage = 0; this.lastRegion = region;
    this.game.hud.damageFlash(amount);
    if (attacker && attacker.pos) this.game.hud.damageFrom(Math.atan2(attacker.pos[0] - this.pos[0], attacker.pos[2] - this.pos[2]) - this.yaw);
    if (this.health <= 0) { this.die(attacker); return true; }
    return false;
  }
  die(killer) {
    this.alive = false; this.fx.death = 0; this.fx.deathRoll = rand(-1, 1);
    if (this.current) this.current.forceHolster();
    this.game.onDeath(this, killer, this.lastWeapon, this.lastRegion === 'head');
  }
  respawn(x, z, yaw) {
    this.pos = [x, 0, z]; this.vel = [0, 0, 0]; this.yaw = yaw; this.pitch = 0;
    this.alive = true; this.health = PLAYER.maxHealth; this.invuln = 1.0; this.crouch = 0; this.crouching = false; this.crouchToggle = false;
    for (const k in this.fx) if (typeof this.fx[k] === 'number' && k !== 'recoilRec') this.fx[k] = 0;
    for (const w of Object.values(this.weapons)) w.resetAmmo();
    this.equipImmediate(this.slots()[0]);
  }

  // ------------------------------------------------------------ atualização
  update(dt, keys, mouse) {
    const cfgM = MOVE;
    this.invuln = Math.max(0, this.invuln - dt);
    this.visibilityBoost = Math.max(0, this.visibilityBoost - dt);
    if (!this.alive) {
      this.vel[0] *= 0.9; this.vel[2] *= 0.9; this.vel[1] -= cfgM.gravity * dt;
      this.grounded = moveCharacter(this.game.world, this.pos, this.vel, dt, cfgM.radius, 0.6);
      this.updateCamera(dt);
      return;
    }
    // regeneração
    this.sinceDamage += dt;
    if (this.sinceDamage > PLAYER.regenDelay && this.health < PLAYER.maxHealth) this.health = Math.min(PLAYER.maxHealth, this.health + PLAYER.regenRate * dt);

    const active = this.game.inputEnabled;
    let ix = 0, iz = 0;
    if (active) { if (keys.KeyW) iz -= 1; if (keys.KeyS) iz += 1; if (keys.KeyA) ix -= 1; if (keys.KeyD) ix += 1; }
    const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
    const fireHeld = active && mouse.left, adsHeld = active && mouse.right, sprintHeld = active && keys.ShiftLeft;
    if (!sprintHeld) this.sprintBlocked = false;
    if ((fireHeld || adsHeld) && this.sprinting) this.sprintBlocked = true;
    const wantsSprint = sprintHeld && !this.sprintBlocked && !adsHeld;

    // --- agachar ---
    if (active && keys._pressed.KeyC) this.crouchToggle = !this.crouchToggle;
    let wantsCrouch = (active && keys.ControlLeft) || this.crouchToggle;
    const forward = iz < -0.3;
    this.sprinting = wantsSprint && forward && (this.grounded || this.sprinting);
    if (this.sprinting && wantsCrouch) { if (keys._pressed.KeyC || keys.ControlLeft) this.sprinting = false; else { this.crouchToggle = false; wantsCrouch = false; } }
    if (this.sprinting) { this.crouchToggle = false; wantsCrouch = false; }
    if (wantsCrouch) this.crouching = true;
    else if (this.crouching && this.canStand()) this.crouching = false;
    if (this.crouching) this.sprinting = false;
    this.crouch = moveToward(this.crouch, this.crouching ? 1 : 0, dt * 7);
    const height = lerp(cfgM.height, cfgM.crouchHeight, this.crouch);

    // --- pulo e gravidade ---
    if (!this.grounded) { this.vel[1] -= cfgM.gravity * dt; this.fallSpeed = Math.max(this.fallSpeed, -this.vel[1]); }
    else if (active && keys._pressed.Space) { if (this.crouching) this.crouchToggle = false; else this.vel[1] = cfgM.jump; }

    // --- velocidade alvo com peso ---
    let speed = this.crouching ? cfgM.crouch : this.sprinting ? cfgM.sprint : cfgM.walk;
    const w = this.current;
    speed *= w ? w.cfg.moveMult * lerp(1, cfgM.adsMult, w.ads) : 1;
    let lx = ix * cfgM.strafeMult, lz = iz * (iz > 0 ? cfgM.backMult : 1);
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    // frente = (-sin yaw, -cos yaw); direita = (cos yaw, -sin yaw)
    const wx = (lx * c + lz * s) * speed, wz = (-lx * s + lz * c) * speed;
    let hx = this.vel[0], hz = this.vel[2];
    let accel = !this.grounded ? cfgM.airAccel : (wx * wx + wz * wz < 0.01 ? cfgM.decel : this.sprinting ? cfgM.sprintAccel : cfgM.accel);
    if (this.grounded && hx * hx + hz * hz > 1 && wx * wx + wz * wz > 0.01 && hx * wx + hz * wz < 0) accel *= 0.8;
    const dx = wx - hx, dz = wz - hz, dl = Math.hypot(dx, dz), step = accel * dt;
    if (dl <= step) { hx = wx; hz = wz; } else { hx += dx / dl * step; hz += dz / dl * step; }
    this.vel[0] = hx; this.vel[2] = hz;
    const prevVy = this.vel[1];
    this.grounded = moveCharacter(this.game.world, this.pos, this.vel, dt, cfgM.radius, height);
    if (this.grounded && !this.wasGrounded) {
      const fs = Math.max(this.fallSpeed, -prevVy);
      if (fs > 2.5) { this.fx.landVel -= Math.min(1, Math.max(0.15, (fs - 2.5) / 9)) * 1.1 * CAMERA.landingImpact; play('land', { pos: this.pos, volume: 0.5 }); this.game.noise(this.pos, 10, this); }
      this.fallSpeed = 0;
    }
    this.wasGrounded = this.grounded;

    // --- passos ---
    const hs = Math.hypot(this.vel[0], this.vel[2]);
    this.moveState = !this.grounded ? 'air' : this.crouching ? 'crouch' : hs < 0.3 ? 'idle' : this.sprinting ? 'sprint' : 'walk';
    if (this.grounded && hs > 0.3) {
      const stepLen = this.moveState === 'sprint' ? cfgM.stepSprint : this.moveState === 'crouch' ? cfgM.stepCrouch : cfgM.stepWalk;
      const prev = Math.floor(this.stepPhase / Math.PI);
      this.stepPhase += hs * dt / stepLen * Math.PI;
      if (Math.floor(this.stepPhase / Math.PI) !== prev) {
        const vol = this.moveState === 'sprint' ? 0.55 : this.moveState === 'crouch' ? 0.12 : 0.3;
        play('step', { pos: this.pos, volume: vol, pitch: 0.12 });
        const r = this.moveState === 'sprint' ? 15 : this.moveState === 'crouch' ? 0 : 7;
        if (r) this.game.noise(this.pos, r, this);
      }
    } else this.stepPhase = moveToward(this.stepPhase, Math.round(this.stepPhase / Math.PI) * Math.PI, dt * 3);
    this.sprintAmount = moveToward(this.sprintAmount, this.moveState === 'sprint' ? 1 : 0, dt * 4);

    // --- arma ---
    const ctx = {
      triggerHeld: fireHeld, triggerPressed: active && mouse._pressedLeft, wantsAds: adsHeld,
      reloadPressed: active && keys._pressed.KeyR, sprinting: this.sprinting, grounded: this.grounded,
      crouching: this.crouching, moveRatio: hs / cfgM.walk, state: this.moveState, stepPhase: this.stepPhase,
      lookDX: this.input.lookDX, lookDY: this.input.lookDY,
    };
    if (this.current) {
      this.current.tick(dt, ctx);
      if (this.pending && this.current.state === 'holstered') this.activate(this.pending);
    }
    this.lastCtx = ctx;
    this.updateCamera(dt);
    if (this.current) this.current.animate(dt, ctx);
    this.input.lookDX = 0; this.input.lookDY = 0;
  }

  canStand() {
    const h = MOVE.height;
    for (const b of this.game.world.colliders) {
      if (this.pos[0] + MOVE.radius <= b.minX || this.pos[0] - MOVE.radius >= b.maxX || this.pos[2] + MOVE.radius <= b.minZ || this.pos[2] - MOVE.radius >= b.maxZ) continue;
      if (this.pos[1] + h > b.minY && this.pos[1] + 0.1 < b.minY) return false;
    }
    return true;
  }

  /** Mira com o mouse (graus). */
  look(dxPx, dyPx) {
    if (!this.alive) return;
    const w = this.current;
    let sens = CAMERA.sensitivity;
    if (w) sens *= lerp(1, CAMERA.adsSensitivity / w.cfg.adsZoom, w.ads);
    const dYaw = -dxPx * sens, dPitch = -dyPx * sens;
    const np = clamp(this.pitch / DEG + dPitch, -88, 88);
    const realPitch = np - this.pitch / DEG;
    this.yaw += dYaw * DEG; this.pitch = np * DEG;
    this.fx.lookX += dYaw; this.fx.lookY += realPitch;
    this.input.lookDX += dYaw; this.input.lookDY += realPitch;
  }

  /** Efeitos de câmera bodycam (port de bodycam_camera.gd). */
  updateCamera(dt) {
    const f = this.fx, C = CAMERA;
    f.t += dt;
    const eye = this.eye();
    const cam = this.camera;
    if (!this.alive) {
      f.death = moveToward(f.death, 1, dt * 2.5);
      const e = 1 - Math.pow(1 - f.death, 2);
      cam.position.set(this.pos[0], this.pos[1] + 1.62 - 1.2 * e, this.pos[2]);
      cam.rotation.set((this.pitch / DEG - 25 * e) * DEG, this.yaw, 35 * f.deathRoll * e * DEG, 'YXZ');
      return;
    }
    const w = this.current, ads = w ? w.ads : 0, calm = lerp(1, C.adsMotion, ads);
    const smooth = 1 - Math.exp(-C.smoothing * dt);
    // head bob sincronizado com os passos
    const hs = Math.hypot(this.vel[0], this.vel[2]);
    f.bobW = damp(f.bobW, this.grounded ? clamp(hs / MOVE.walk, 0, 1.4) : 0, 8, dt);
    const amp = this.moveState === 'sprint' ? C.bobSprint : this.moveState === 'crouch' ? C.bobCrouch : C.bobWalk;
    const k = f.bobW * C.headBob * calm, ph = this.stepPhase;
    const bobX = Math.sin(ph) * amp[0] * k, bobY = -(1 - Math.cos(2 * ph)) * 0.5 * amp[1] * k;
    const bobRoll = Math.sin(ph) * amp[2] * k, bobPitch = Math.sin(2 * ph) * amp[2] * 0.35 * k;
    const breath = Math.sin(f.t * 1.5) * C.idleBreath * (1 - clamp(f.bobW, 0, 1)) * calm;
    // inércia ao virar
    const rateX = f.lookX / Math.max(dt, 1e-4), rateY = f.lookY / Math.max(dt, 1e-4);
    f.lookX = 0; f.lookY = 0;
    let tx = -rateX * C.turnInertia * C.sway * calm, ty = -rateY * C.turnInertia * C.sway * calm;
    const tl = Math.hypot(tx, ty); if (tl > C.turnInertiaMax) { tx *= C.turnInertiaMax / tl; ty *= C.turnInertiaMax / tl; }
    f.lagX = lerp(f.lagX, tx, smooth); f.lagY = lerp(f.lagY, ty, smooth);
    // inclinação lateral
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const lateral = (this.vel[0] * c - this.vel[2] * s) / MOVE.sprint;
    f.strafeRoll = damp(f.strafeRoll, -lateral * C.strafeTilt * calm, 6, dt);
    // recuo
    f.recoilTX = moveToward(f.recoilTX, 0, f.recoilRec * dt); f.recoilTY = moveToward(f.recoilTY, 0, f.recoilRec * dt);
    const rs = 1 - Math.exp(-C.recoilSnap * dt);
    f.recoilX = lerp(f.recoilX, f.recoilTX, rs); f.recoilY = lerp(f.recoilY, f.recoilTY, rs);
    // pouso (mola)
    const acc = -160 * f.land - 16 * f.landVel;
    f.landVel += acc * dt; f.land = clamp(f.land + f.landVel * dt, -0.16, 0.05);
    // tremor
    f.shake = moveToward(f.shake, 0, dt * 3.5);
    const sh = f.shake * f.shake * C.shakeMax;
    const shX = Math.sin(f.t * 41) * sh, shY = Math.sin(f.t * 37 + 1.3) * sh, shZ = Math.sin(f.t * 29 + 2.1) * sh;
    // composição: posição (no espaço da cabeça) + rotação
    const pitch = this.pitch / DEG + f.recoilX + bobPitch + f.lagY + shX + f.land * 18;
    const yaw = this.yaw / DEG + f.recoilY + f.lagX + shY;
    const roll = clamp(bobRoll + f.strafeRoll - f.lagX * C.turnRoll + shZ, -C.maxRoll, C.maxRoll);
    const right = [c, -s];
    cam.position.set(eye[0] + right[0] * bobX, eye[1] + bobY + f.land + breath, eye[2] + right[1] * bobX);
    cam.rotation.set(pitch * DEG, yaw * DEG, roll * DEG, 'YXZ');
    // FOV (mira e corrida)
    const zoom = w ? w.cfg.adsZoom : 1;
    const target = C.fov / lerp(1, zoom, ads) + C.sprintFovBoost * this.sprintAmount;
    cam.fov = damp(cam.fov, target, 14, dt);
    cam.updateProjectionMatrix();
    // lanterna presa ao peito
    this.flashlight.position.copy(cam.position).add(new THREE.Vector3(0.12, -0.25, 0).applyQuaternion(cam.quaternion));
    this.flashlight.target.position.copy(cam.position).add(new THREE.Vector3(0, 0, -10).applyQuaternion(cam.quaternion));
    setListener(cam.position.x, cam.position.y, cam.position.z, this.yaw);
  }
}
