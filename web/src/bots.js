// ============================================================================
//  BOTS — port de ai/*.gd
//  Percepção (visão/audição/dano) + máquina de estados:
//    patrol → investigate → search → patrol
//    patrol --(viu)--> combat --(perdeu)--> chase / flank --> search
//    combat <-> cover (recarregar / vida baixa / trocar de posição)
//  A dificuldade muda reação, precisão, detecção, cobertura e flanco — nunca o dano.
// ============================================================================
import * as THREE from 'three';
import { BOT, BOT_DIFFICULTY, WEAPONS, PLAYER } from './config.js';
import { clamp, lerp, rand, randInt, pick, DEG, angleDiff, rotateToward, moveToward } from './util.js';
import { moveCharacter } from './physics.js';
import { play } from './audio.js';

const TEAM_COLORS = [0x3366bf, 0xb8332b];
// Relógio do jogo (para durante a pausa). Atualizado pelo Game a cada passo.
let CLOCK = 0;
export function setClock(t) { CLOCK = t; }
const now = () => CLOCK;

export class Bot {
  constructor(game, team, name, difficulty) {
    this.game = game; this.team = team; this.name = name;
    this.p = BOT_DIFFICULTY[difficulty];
    this.pos = [0, 0, 0]; this.vel = [0, 0, 0]; this.yaw = 0;
    this.alive = true; this.health = PLAYER.maxHealth; this.invuln = 0;
    this.crouching = false; this.crouch = 0; this.running = false;
    this.path = null; this.pathIdx = 0; this.moveTarget = null; this.repathAt = 0;
    this.lookTarget = null;
    this.lastRegion = 'torso'; this.lastWeapon = '';
    this.equip(pick(this.p.weapons));
    // percepção
    this.target = null; this.targetVisible = false; this.lastKnown = [0, 0, 0]; this.lastVel = [0, 0, 0];
    this.lastSeen = -1000; this.acquired = -1000; this.awareness = new Map(); this.percTimer = Math.random() * this.p.perception;
    this.noisePos = null; this.pendingDamage = [];
    // combate
    this.cooldown = 0; this.burstLeft = 0; this.burstPause = 0; this.track = 0; this.tracked = null; this.allowFire = true;
    this.reloading = false; this.reloadTimer = 0;
    // cérebro
    this.state = null; this.stateName = ''; this.thinkTimer = Math.random() * 0.3; this.sd = {};
    this.stepAcc = 0; this.walkPhase = 0; this.deathT = 0;
    this.buildMesh();
  }

  equip(id) { this.wid = id; this.w = WEAPONS[id]; this.mag = this.w.mag; this.reloading = false; }

  buildMesh() {
    const g = new THREE.Group(), color = TEAM_COLORS[this.team];
    const mat = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const vest = mat(color), cloth = mat(new THREE.Color(color).multiplyScalar(0.45)), skin = mat(0x8c7361), pants = mat(0x292b29), metal = mat(0x141414, 0.5);
    const box = (parent, sx, sy, sz, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); b.castShadow = true; parent.add(b); return b; };
    this.upper = new THREE.Group(); g.add(this.upper);
    box(this.upper, 0.46, 0.62, 0.28, 0, 1.19, 0, vest);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), skin); head.position.y = 1.62; head.castShadow = true; this.upper.add(head);
    box(this.upper, 0.29, 0.12, 0.3, 0, 1.73, 0, cloth);
    for (const s of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(0.27 * s, 1.44, 0); sh.rotation.set(-62 * DEG, -12 * s * DEG, 0); this.upper.add(sh);
      box(sh, 0.12, 0.6, 0.13, 0, -0.3, 0, cloth);
    }
    const gun = new THREE.Group(); gun.position.set(0.05, 1.3, -0.42); this.upper.add(gun);
    box(gun, 0.07, 0.1, 0.62, 0, 0, 0, metal); box(gun, 0.05, 0.16, 0.07, 0, -0.11, -0.08, metal);
    this.muzzleObj = new THREE.Object3D(); this.muzzleObj.position.set(0, 0.02, -0.34); gun.add(this.muzzleObj);
    this.flash = new THREE.PointLight(0xffc066, 0, 6, 2); this.muzzleObj.add(this.flash);
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(0.12 * s, 0.87, 0); g.add(hip);
      box(hip, 0.17, 0.86, 0.19, 0, -0.43, 0, pants); this.legs.push(hip);
    }
    if (this.team === 0) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 64;
      const x = c.getContext('2d'); x.font = '600 34px system-ui, sans-serif'; x.fillStyle = '#8cc8ff'; x.textAlign = 'center'; x.fillText('▼ ' + this.name, 128, 44);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
      sp.scale.set(0.9, 0.225, 1); sp.position.y = 2.15; sp.renderOrder = 10; g.add(sp); this.tag = sp;
    }
    this.mesh = g;
    this.game.scene.add(g);
  }

  // ------------------------------------------------------------ interface de combatente
  eye() { return [this.pos[0], this.pos[1] + 1.6 - 0.55 * this.crouch, this.pos[2]]; }
  chest() { return [this.pos[0], this.pos[1] + 1.2 - 0.55 * this.crouch, this.pos[2]]; }
  head() { return [this.pos[0], this.pos[1] + 1.62 - 0.55 * this.crouch, this.pos[2]]; }
  visibility() { return this.crouching ? 0.7 : 1; }
  weaponName() { return this.w.name; }
  hitParts() {
    const d = 0.55 * this.crouch;
    return [
      ['head', 0, 1.62 - d, 0, 0.13, 0.13, 0.13], ['torso', 0, 1.19 - d, 0, 0.23, 0.31, 0.14],
      ['arms', 0.28, 1.25 - d, -0.2, 0.07, 0.12, 0.28], ['arms', -0.28, 1.25 - d, -0.2, 0.07, 0.12, 0.28],
      ['legs', 0.12, 0.44, 0, 0.09, 0.43, 0.1], ['legs', -0.12, 0.44, 0, 0.09, 0.43, 0.1],
    ];
  }
  muzzleWorld() { const v = this.muzzleObj.getWorldPosition(new THREE.Vector3()); return [v.x, v.y, v.z]; }

  damage(amount, attacker, region) {
    if (!this.alive || this.invuln > 0) return false;
    this.health -= amount; this.lastRegion = region;
    if (attacker && attacker !== this) this.pendingDamage.push([this.p.damageReaction, attacker]);
    if (this.health <= 0) { this.die(attacker); return true; }
    return false;
  }
  die(killer) {
    this.alive = false; this.deathT = 0; this.path = null; this.moveTarget = null;
    if (this.tag) this.tag.visible = false;
    this.game.onDeath(this, killer, this.lastWeapon, this.lastRegion === 'head');
  }
  respawn(x, z, yaw) {
    this.pos = [x, 0, z]; this.vel = [0, 0, 0]; this.yaw = yaw; this.alive = true; this.health = PLAYER.maxHealth; this.invuln = 1;
    this.crouching = false; this.crouch = 0; this.mag = this.w.mag; this.reloading = false; this.target = null; this.targetVisible = false;
    this.awareness.clear(); this.pendingDamage = []; this.noisePos = null; this.path = null; this.moveTarget = null; this.lookTarget = null;
    this.mesh.visible = true; this.mesh.rotation.set(0, yaw, 0); this.mesh.position.set(x, 0, z);
    if (this.tag) this.tag.visible = true;
    this.change('patrol');
  }

  // ------------------------------------------------------------ movimento
  moveTo(x, z, run = true) {
    this.running = run;
    if (this.moveTarget && Math.hypot(this.moveTarget[0] - x, this.moveTarget[1] - z) < 0.5 && this.path) return;
    this.moveTarget = [x, z];
    this.path = this.game.nav.path(this.pos[0], this.pos[2], x, z);
    this.pathIdx = 1;
    if (!this.path) this.moveTarget = null;
  }
  stop() { this.path = null; this.moveTarget = null; }
  arrived() { return !this.path || this.pathIdx >= this.path.length; }
  lookAt(p) { this.lookTarget = p; }
  facing(p, tolDeg) { return Math.abs(angleDiff(this.yaw, Math.atan2(-(p[0] - this.pos[0]), -(p[2] - this.pos[2])))) <= tolDeg * DEG; }
  hspeed() { return Math.hypot(this.vel[0], this.vel[2]); }

  // ------------------------------------------------------------ loop
  update(dt) {
    if (!this.alive) {
      this.deathT += dt;
      const t = Math.min(1, this.deathT / 0.45);
      this.mesh.rotation.set(-80 * DEG * t * t, this.yaw, 0);
      this.mesh.position.set(this.pos[0], 0.15 * t, this.pos[2]);
      if (this.deathT > 2.5) this.mesh.visible = false;
      return;
    }
    this.invuln = Math.max(0, this.invuln - dt);
    this.perceive(dt);
    this.state && this.state.update && this.state.update.call(this, dt);
    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0) {
      this.thinkTimer = this.p.decision * rand(0.8, 1.2);
      if (this.targetVisible && !STATES[this.stateName].handlesEnemy) this.change('combat');
      else STATES[this.stateName].think.call(this);
    }
    this.combat(dt);
    this.moveUpdate(dt);
    this.crouch = moveToward(this.crouch, this.crouching ? 1 : 0, dt * 5);
    // visual
    this.mesh.position.set(this.pos[0], this.pos[1], this.pos[2]);
    this.mesh.rotation.set(0, this.yaw, 0);
    this.upper.position.y = -0.55 * this.crouch;
    const hs = this.hspeed();
    this.walkPhase += hs * dt * 2.2;
    const swing = Math.sin(this.walkPhase) * Math.min(1, hs / 3) * 0.6;
    this.legs[0].rotation.x = swing; this.legs[1].rotation.x = -swing;
    if (this.flash.intensity > 0) this.flash.intensity = Math.max(0, this.flash.intensity - dt * 60);
  }

  moveUpdate(dt) {
    let dx = 0, dz = 0;
    if (this.path && this.pathIdx < this.path.length) {
      const wp = this.path[this.pathIdx];
      const ex = wp[0] - this.pos[0], ez = wp[1] - this.pos[2], d = Math.hypot(ex, ez);
      if (d < (this.pathIdx === this.path.length - 1 ? 0.9 : 0.6)) { this.pathIdx++; }
      else {
        let sp = this.crouching ? BOT.crouch : this.running ? BOT.run : BOT.walk;
        sp *= this.p.speed;
        dx = ex / d * sp; dz = ez / d * sp;
      }
    }
    // separação leve entre bots
    for (const o of this.game.bots) {
      if (o === this || !o.alive) continue;
      const ox = this.pos[0] - o.pos[0], oz = this.pos[2] - o.pos[2], d2 = ox * ox + oz * oz;
      if (d2 < 1 && d2 > 1e-4) { const d = Math.sqrt(d2); dx += ox / d * 1.5; dz += oz / d * 1.5; }
    }
    const step = BOT.accel * dt;
    this.vel[0] = moveToward(this.vel[0], dx, step); this.vel[2] = moveToward(this.vel[2], dz, step);
    this.vel[1] -= 15.5 * dt;
    moveCharacter(this.game.world, this.pos, this.vel, dt, 0.35, 1.8);
    // rotação: para o alvo de mira ou para onde anda
    let ty = this.yaw;
    if (this.lookTarget) { const lx = this.lookTarget[0] - this.pos[0], lz = this.lookTarget[2] - this.pos[2]; if (lx * lx + lz * lz > 0.01) ty = Math.atan2(-lx, -lz); }
    else if (this.vel[0] * this.vel[0] + this.vel[2] * this.vel[2] > 0.3) ty = Math.atan2(-this.vel[0], -this.vel[2]);
    this.yaw = rotateToward(this.yaw, ty, this.p.turn * DEG * dt);
    // passos (só perto do jogador)
    const hs = this.hspeed();
    if (hs > 0.5) {
      this.stepAcc += hs * dt;
      if (this.stepAcc >= (this.running ? 1.2 : 0.85)) {
        this.stepAcc = 0;
        const pl = this.game.player.pos;
        if (Math.hypot(pl[0] - this.pos[0], pl[2] - this.pos[2]) < 30) play('step', { pos: this.pos, volume: this.running ? 0.45 : 0.25, pitch: 0.15 });
      }
    }
  }

  // ------------------------------------------------------------ percepção
  perceive(dt) {
    for (let i = this.pendingDamage.length - 1; i >= 0; i--) {
      this.pendingDamage[i][0] -= dt;
      if (this.pendingDamage[i][0] <= 0) {
        const a = this.pendingDamage[i][1]; this.pendingDamage.splice(i, 1);
        if (a.alive) { this.awareness.set(a, 1); if (!this.targetVisible) { this.target = a; this.lastKnown = a.pos.slice(); this.lastSeen = now() - 0.5; this.acquired = now(); } }
      }
    }
    this.percTimer -= dt;
    if (this.percTimer > 0) return;
    const scanDt = this.p.perception - this.percTimer;
    this.percTimer = this.p.perception;
    const eye = this.eye(), fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), cosHalf = Math.cos(this.p.fov / 2 * DEG);
    let best = null, bestD = Infinity; const t = now();
    for (const a of this.game.combatants()) {
      if (a.team === this.team || !a.alive) continue;
      const ch = a.chest(), tx = ch[0] - eye[0], ty = ch[1] - eye[1], tz = ch[2] - eye[2], d = Math.hypot(tx, ty, tz);
      let seen = false;
      if (d <= this.p.range) {
        const inCone = d < 3 || (fx * tx + fz * tz) / Math.max(Math.hypot(tx, tz), 1e-4) >= cosHalf;
        if (inCone && (this.game.world.lineOfSight(eye, ch) || this.game.world.lineOfSight(eye, a.head()))) seen = true;
      }
      let aw = this.awareness.get(a) || 0;
      if (seen) {
        if (a === this.target && t - this.lastSeen < 2) aw = 1;
        else aw += scanDt / this.p.detectTime * lerp(2.4, 0.5, clamp(d / this.p.range, 0, 1)) * a.visibility();
      } else aw -= scanDt * 0.3;
      aw = clamp(aw, 0, 1); this.awareness.set(a, aw);
      if (seen && aw >= 1 && d < bestD) { best = a; bestD = d; }
    }
    if (best) {
      if (best !== this.target || t - this.lastSeen > 1) this.acquired = t;
      this.target = best; this.targetVisible = true; this.lastKnown = best.pos.slice(); this.lastVel = best.vel.slice(); this.lastSeen = t; this.noisePos = null;
      if (this.p.callouts && t - (this.lastCallout || 0) > 2) { this.lastCallout = t; this.game.callout(this, best.pos); }
    } else {
      this.targetVisible = false;
      if (this.target && !this.target.alive) this.target = null;
    }
  }
  hasTarget() { return this.target && this.target.alive; }
  sinceSeen() { return now() - this.lastSeen; }
  hear(pos, radius, source) {
    if (!this.alive || source === this || source.team === this.team || this.targetVisible) return;
    if (radius >= 30 && !this.p.gunshots) return;
    if (Math.hypot(pos[0] - this.pos[0], pos[2] - this.pos[2]) > radius * this.p.hearing) return;
    const err = lerp(6, 1.5, this.p.hearing);
    this.noisePos = [pos[0] + rand(-err, err), 0, pos[2] + rand(-err, err)];
  }

  // ------------------------------------------------------------ combate
  combat(dt) {
    this.cooldown -= dt;
    if (this.reloading) { this.reloadTimer -= dt; if (this.reloadTimer <= 0) { this.reloading = false; this.mag = this.w.mag; } return; }
    if (!(this.targetVisible && this.hasTarget())) { this.track = 0; this.tracked = null; return; }
    if (this.target !== this.tracked) { this.tracked = this.target; this.track = 0; }
    this.track += dt;
    if (!this.allowFire || now() - this.acquired < this.p.reaction || this.cooldown > 0) return;
    if (this.mag <= 0) { this.startReload(); return; }
    const tg = this.target, dist = Math.hypot(tg.pos[0] - this.pos[0], tg.pos[2] - this.pos[2]);
    if (dist > this.w.maxRange * 0.9) return;
    if (this.w.pellets > 1 && dist > this.w.effRange * 2.5) return;
    if (!this.facing(tg.pos, 12)) return;
    if (this.burstLeft <= 0) {
      if (this.burstPause > 0) { this.burstPause -= dt; return; }
      this.burstLeft = randInt(this.p.burst[0], this.p.burst[1]);
      if (this.w.fireMode !== 'auto') this.burstLeft = Math.min(this.burstLeft, 3);
    }
    this.shoot(tg);
    this.burstLeft--;
    let interval = 60 / this.w.rpm;
    if (this.w.fireMode !== 'auto') interval = Math.max(interval, 0.28) * rand(1, 1.4);
    this.cooldown = interval;
    if (this.burstLeft <= 0) this.burstPause = rand(this.p.burstPause[0], this.p.burstPause[1]);
  }
  startReload() {
    if (this.reloading || this.mag >= this.w.mag) return;
    this.reloading = true;
    this.reloadTimer = this.w.shellReload ? this.w.reloadStart + this.w.reload * (this.w.mag - this.mag) : (this.mag > 0 ? this.w.reload : this.w.reloadEmpty);
    play('reload', { pos: this.pos, volume: 0.4 });
  }
  shoot(tg) {
    this.mag--;
    const o = this.eye(), aimP = Math.random() < this.p.headshot ? tg.head() : tg.chest();
    let dx = aimP[0] - o[0], dy = aimP[1] - o[1], dz = aimP[2] - o[2]; const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
    const settle = clamp(this.track / Math.max(this.p.settle, 0.01), 0, 1);
    let err = this.p.aimError * lerp(this.p.initialError, 1, settle);
    err *= 1 + this.p.movePenalty * clamp(Math.hypot(tg.vel[0], tg.vel[2]) / 6, 0, 1);
    if (this.hspeed() > 1) err *= 1.3;
    err += this.w.adsSpread;
    const muzzle = this.muzzleWorld();
    for (let i = 0; i < this.w.pellets; i++) {
      const e = this.w.pellets > 1 ? Math.max(err, this.w.pelletSpread) : err;
      this.game.fireBullet(this, o, [dx, dy, dz], e, this.w, BOT.damageMult, i === 0 ? muzzle : null);
    }
    this.flash.intensity = 3;
    play(this.w.sound, { pos: muzzle, volume: 0.9 });
    this.game.noise(this.pos, this.w.noise, this);
  }

  // ------------------------------------------------------------ cérebro
  change(name, params = {}) {
    if (this.state && this.state.exit) this.state.exit.call(this);
    this.stateName = name; this.state = STATES[name]; this.sd = {};
    this.state.enter.call(this, params);
  }
}

// ---------------------------------------------------------------------------
//  ESTADOS (cada um: enter / think / update / exit). Adicionar um tipo de
//  inimigo novo = criar estados aqui ou outro perfil em BOT_DIFFICULTY.
// ---------------------------------------------------------------------------
function lateral(bot, target, dist) {
  const tx = target[0] - bot.pos[0], tz = target[2] - bot.pos[2], l = Math.hypot(tx, tz) || 1;
  const s = Math.random() < 0.5 ? 1 : -1;
  return bot.game.nav.snap(bot.pos[0] + (-tz / l) * s * dist, bot.pos[2] + (tx / l) * s * dist);
}

const STATES = {
  patrol: {
    enter() { this.allowFire = true; this.crouching = false; this.lookTarget = null; this.sd.moving = false; this.sd.wait = 0; STATES.patrol.next.call(this); },
    think() {
      if (this.noisePos) return this.change('investigate', { pos: this.noisePos });
      if (this.hasTarget() && this.sinceSeen() < 3) return this.change('chase');
      if (!this.reloading && this.mag < this.w.mag * 0.5) this.startReload();
      if (this.sd.moving && this.arrived()) {
        this.sd.moving = false; this.sd.wait = now() + rand(0.3, 1.6) * (1.2 - this.p.aggression);
        const r = this.game.nav.randomNear(this.pos[0], this.pos[2], 12); this.lookAt([r[0], 1.5, r[1]]);
      } else if (!this.sd.moving && now() >= this.sd.wait) { this.lookTarget = null; STATES.patrol.next.call(this); }
    },
    next() {
      const pts = this.game.world.patrol;
      let t = pick(pts);
      if (Math.random() < this.p.aggression * 0.6) {
        const enemies = this.game.combatants().filter((a) => a.team !== this.team && a.alive);
        if (enemies.length) { const e = pick(enemies); let bd = Infinity; for (const p of pts) { const d = (p[0] - e.pos[0]) ** 2 + (p[1] - e.pos[2]) ** 2 + Math.random() * 60; if (d < bd) { bd = d; t = p; } } }
      }
      this.moveTo(t[0], t[1], Math.random() < 0.25 + this.p.aggression * 0.6);
      this.sd.moving = true;
    },
  },
  investigate: {
    enter(pr) { this.sd.pos = this.game.nav.snap(pr.pos[0], pr.pos[2]); this.noisePos = null; this.sd.timeout = now() + 12; this.crouching = false; this.lookTarget = null; this.moveTo(this.sd.pos[0], this.sd.pos[1], Math.random() < 0.3 + this.p.aggression * 0.6); },
    think() {
      if (this.noisePos) { this.sd.pos = this.game.nav.snap(this.noisePos[0], this.noisePos[2]); this.noisePos = null; this.moveTo(this.sd.pos[0], this.sd.pos[1], true); }
      if (this.arrived() || now() > this.sd.timeout) this.change('search', { center: [this.sd.pos[0], 0, this.sd.pos[1]], duration: this.p.search * 0.6 });
    },
  },
  search: {
    enter(pr) { this.sd.center = pr.center || this.lastKnown; this.sd.end = now() + (pr.duration ?? this.p.search); this.crouching = false; STATES.search.go.call(this); },
    think() {
      if (now() > this.sd.end) { this.target = null; return this.change('patrol'); }
      if (this.noisePos) return this.change('investigate', { pos: this.noisePos });
      if (!this.reloading && this.mag < this.w.mag * 0.5) this.startReload();
      if (this.sd.moving && this.arrived()) {
        this.sd.moving = false; this.sd.wait = now() + rand(0.5, 1.3);
        const r = this.game.nav.randomNear(this.pos[0], this.pos[2], 8); this.lookAt([r[0], 1.4, r[1]]);
      } else if (!this.sd.moving && now() >= this.sd.wait) STATES.search.go.call(this);
    },
    go() { this.lookTarget = null; const r = this.game.nav.randomNear(this.sd.center[0], this.sd.center[2], 9); this.moveTo(r[0], r[1], false); this.sd.moving = true; },
  },
  combat: {
    handlesEnemy: true,
    enter() {
      this.allowFire = true; this.stop();
      this.sd.reposAt = this.p.reposition > 0 ? now() + this.p.reposition * rand(0.7, 1.3) : Infinity;
      this.sd.nextStrafe = now(); this.sd.crouchUntil = 0;
    },
    exit() { this.crouching = false; },
    update() {
      if (!this.hasTarget()) return;
      this.lookAt(this.targetVisible ? this.target.chest() : [this.lastKnown[0], 1.3, this.lastKnown[2]]);
    },
    think() {
      if (!this.hasTarget()) return this.change('patrol');
      if (!this.targetVisible) {
        if (this.sinceSeen() > 0.8) {
          if (this.p.flank > 0 && Math.random() < this.p.flank) return this.change('flank');
          return this.change(this.p.maxChase > 0 ? 'chase' : 'search');
        }
        return;
      }
      const tg = this.target, dist = Math.hypot(tg.pos[0] - this.pos[0], tg.pos[2] - this.pos[2]);
      if (this.mag === 0 && !this.reloading) { if (Math.random() < this.p.cover) return this.change('cover', { reason: 'reload' }); this.startReload(); return; }
      if (this.health < 50 && Math.random() < this.p.cover * 0.6) return this.change('cover', { reason: 'hurt' });
      if (now() >= this.sd.reposAt) {
        this.sd.reposAt = now() + this.p.reposition * rand(0.7, 1.3);
        if (Math.random() < this.p.cover) return this.change('cover', { reason: 'reposition' });
        const p = lateral(this, tg.pos, rand(5, 9)); this.moveTo(p[0], p[1], true); return;
      }
      const pref = clamp(this.w.effRange * 1.2, 6, 40);
      if (dist > pref * 1.4) { this.moveTo(tg.pos[0], tg.pos[2], this.p.aggression > 0.5); return; }
      if (now() >= this.sd.nextStrafe) {
        this.sd.nextStrafe = now() + rand(0.8, 1.8);
        if (Math.random() < this.p.strafe) { const p = lateral(this, tg.pos, rand(1.5, 3.5)); this.moveTo(p[0], p[1], false); this.crouching = false; }
        else { this.stop(); if (Math.random() < this.p.strafe * 0.5) { this.crouching = true; this.sd.crouchUntil = now() + rand(0.8, 1.6); } }
      }
      if (this.crouching && now() > this.sd.crouchUntil) this.crouching = false;
    },
  },
  cover: {
    handlesEnemy: true,
    enter(pr) {
      const threat = this.lastKnown, pt = this.game.findCover(this, threat);
      if (!pt) { if (pr.reason === 'reload') this.startReload(); return this.change('combat'); }
      this.sd.threat = threat; this.sd.phase = 'moving'; this.sd.timeout = now() + 6;
      this.crouching = false; this.allowFire = true; this.moveTo(pt[0], pt[1], true);
    },
    exit() { this.crouching = false; this.allowFire = true; },
    update() {
      if (this.targetVisible && this.hasTarget()) this.lookAt(this.target.chest());
      else if (this.sd.phase === 'hiding') this.lookAt([this.sd.threat[0], 1.3, this.sd.threat[2]]);
      else this.lookTarget = null;
    },
    think() {
      if (this.sd.phase === 'moving') {
        if (this.arrived() || now() > this.sd.timeout) {
          this.sd.phase = 'hiding'; this.stop(); this.crouching = true; this.allowFire = false;
          if (this.mag < this.w.mag * 0.5) this.startReload();
          this.sd.hideUntil = now() + rand(1.2, 2.6);
        }
      } else {
        if (this.targetVisible && !this.reloading) return this.change('combat');
        if (now() >= this.sd.hideUntil && !this.reloading) return this.change(this.hasTarget() ? (this.sinceSeen() < 4 ? 'combat' : 'search') : 'patrol');
      }
    },
  },
  chase: {
    enter() {
      this.sd.start = this.pos.slice();
      const g = this.game.nav.snap(this.lastKnown[0] + this.lastVel[0] * this.p.predict, this.lastKnown[2] + this.lastVel[2] * this.p.predict);
      this.sd.timeout = now() + 10; this.crouching = false; this.lookTarget = null; this.moveTo(g[0], g[1], true);
    },
    think() {
      if (Math.hypot(this.pos[0] - this.sd.start[0], this.pos[2] - this.sd.start[2]) > this.p.maxChase) return this.change('search', { duration: this.p.search * 0.5 });
      if (this.arrived() || now() > this.sd.timeout) this.change('search');
    },
  },
  flank: {
    enter() {
      const t = this.lastKnown, tx = t[0] - this.pos[0], tz = t[2] - this.pos[2], l = Math.hypot(tx, tz) || 1;
      let side = Math.random() < 0.5 ? 1 : -1, ok = null;
      for (let i = 0; i < 2 && !ok; i++, side = -side) {
        const d = rand(8, 12), cx = t[0] + (-tz / l) * side * d - tx / l * 2, cz = t[2] + (tx / l) * side * d - tz / l * 2;
        const s = this.game.nav.snap(cx, cz);
        if (Math.hypot(s[0] - cx, s[1] - cz) < 3) ok = s;
      }
      if (!ok) return this.change('chase');
      this.sd.timeout = now() + 9; this.crouching = false; this.lookTarget = null; this.moveTo(ok[0], ok[1], true);
    },
    think() { if (this.arrived() || now() > this.sd.timeout) this.change('chase'); },
  },
};
