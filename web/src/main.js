// ============================================================================
//  BODYCAM FPS — versão navegador (sem engine: Three.js só para desenhar)
//  Junta tudo: renderização + lente bodycam, partida (mata-mata em equipe),
//  tiros, efeitos, HUD, menus e entrada.
// ============================================================================
import * as THREE from 'three';
import { CAMERA, MATCH, SETTINGS, LIGHTING, BOT, BOT_DIFFICULTY, BOT_NAMES, DAMAGE_MULT, WEAPONS, PLAYER, WEAPON_ORDER } from './config.js';
import { clamp, lerp, rand, pick, spreadDir, rayBox, DEG } from './util.js';
import { World } from './world.js';
import { NavGrid } from './nav.js';
import { Player } from './player.js';
import { Bot, setClock } from './bots.js';
import { preloadModels } from './weapons.js';
import { initAudio, play, startAmbient, stopAmbient } from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Pós-processamento "bodycam": lente em barril, aberração, vinheta, granulação.
const post = {
  rt: new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType }),
  scene: new THREE.Scene(),
  cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
};
post.mat = new THREE.ShaderMaterial({
  uniforms: { tex: { value: null }, time: { value: 0 }, distortion: { value: CAMERA.distortion }, vignette: { value: CAMERA.vignette },
    grain: { value: CAMERA.grain }, chroma: { value: CAMERA.chromatic }, sat: { value: CAMERA.saturation }, aspect: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    uniform sampler2D tex; uniform float time, distortion, vignette, grain, chroma, sat, aspect; varying vec2 vUv;
    float rnd(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5; float r2 = dot(c, c);
      vec2 uv = 0.5 + c * (1.0 + distortion * r2) / (1.0 + distortion * 0.5);
      vec2 ca = c * chroma * (1.0 + r2 * 8.0);
      vec3 col = vec3(texture2D(tex, uv + ca).r, texture2D(tex, uv).g, texture2D(tex, uv - ca).b);
      float l = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(l), col, sat);
      col *= 1.0 - vignette * smoothstep(0.08, 0.55, r2 * 1.6);
      col += (rnd(vUv * vec2(1931.0, 1117.0) + fract(time * 7.13)) - 0.5) * grain;
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  depthTest: false, depthWrite: false,
});
post.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post.mat));

// ---------------------------------------------------------------- estado global
const keys = { _pressed: {} };
const mouse = { left: false, right: false, _pressedLeft: false };
let game = null;

class Game {
  constructor() {
    this.L = LIGHTING[SETTINGS.time];
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, innerWidth / innerHeight, 0.03, 400);
    this.vmScene = new THREE.Scene();
    this.vmCamera = new THREE.PerspectiveCamera(CAMERA.viewmodelFov, innerWidth / innerHeight, 0.01, 10);
    this.vmRoot = new THREE.Group(); this.vmScene.add(this.vmRoot);
    this.inputEnabled = true;
    this.time = 0;
    this.buildLighting();
    this.world = new World(this.scene); this.world.build();
    this.nav = new NavGrid(this.world);
    this.coverPoints = this.buildCoverPoints();
    this.effects = new Effects(this.scene);
    this.hud = new HUD(this);
    this.player = new Player(this);
    this.bots = [];
    this.teamSize = MATCH.modes[SETTINGS.mode];
    this.scoreLimit = MATCH.scoreLimits[this.teamSize];
    this.scores = [0, 0]; this.timeLeft = MATCH.timeLimit; this.running = true; this.respawns = [];
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    const own = (t) => this.world.spawns.filter((s) => s.team === t);
    const s0 = own(0)[0]; this.player.respawn(s0.pos[0], s0.pos[1], s0.yaw);
    const spawnBot = (team, i) => {
      const b = new Bot(this, team, names.pop() || 'Bot', SETTINGS.difficulty);
      const sp = own(team)[i % own(team).length];
      b.respawn(sp.pos[0], sp.pos[1] + Math.floor(i / 8) * 1.6, sp.yaw);
      this.bots.push(b);
    };
    for (let i = 1; i < this.teamSize; i++) spawnBot(0, i);
    for (let i = 0; i < this.teamSize; i++) spawnBot(1, i);
    this.hud.score(); this.recStart = performance.now();
  }

  buildLighting() {
    const L = this.L, q = SETTINGS.quality;
    this.scene.background = new THREE.Color(L.sky);
    this.scene.fog = new THREE.FogExp2(L.fog, L.fogDensity);
    renderer.toneMappingExposure = L.exposure;
    renderer.shadowMap.enabled = q !== 'baixa';
    const hemi = new THREE.HemisphereLight(L.sky, L.ground, L.hemi);
    hemi.color.lerp(new THREE.Color(L.horizon), 0.5);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(L.sunColor, L.sunIntensity);
    const d = new THREE.Vector3(...L.sunDir).normalize();
    sun.position.copy(d.clone().multiplyScalar(-80)); sun.target.position.set(0, 0, 0);
    sun.castShadow = q !== 'baixa';
    const size = q === 'alta' ? 4096 : 2048;
    sun.shadow.mapSize.set(size, size);
    Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 50, bottom: -50, near: 1, far: 200 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
    this.scene.add(sun, sun.target);
    // Céu com horizonte (esfera invertida com gradiente).
    const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(L.sky) }, hor: { value: new THREE.Color(L.horizon) } },
      vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top, hor; varying vec3 p;\nvoid main(){ float h = clamp(p.y * 1.6, 0.0, 1.0); gl_FragColor = vec4(mix(hor, top, pow(h, 0.6)), 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 12), skyMat); sky.renderOrder = -1; this.scene.add(sky);
    // Luz da arma em 1ª pessoa (cena separada).
    this.vmScene.add(new THREE.HemisphereLight(L.sky, L.ground, Math.max(0.5, L.hemi)));
    const vmSun = new THREE.DirectionalLight(L.sunColor, Math.max(0.6, L.sunIntensity * 0.6)); vmSun.position.set(-1, 2, 1); this.vmScene.add(vmSun);
    this.vmFlash = new THREE.PointLight(0xf2f7ff, 0, 3); this.vmFlash.position.set(0.1, -0.1, 0.2); this.vmScene.add(this.vmFlash);
  }

  combatants() { return [this.player, ...this.bots]; }

  // ------------------------------------------------------------ tiro
  /** Disparo hitscan compartilhado entre jogador e bots. */
  fireBullet(shooter, origin, dir, spreadDeg, w, dmgMult, muzzle) {
    const d = spreadDir(dir, spreadDeg);
    const wh = this.world.raycast(origin, d, w.maxRange);
    let best = wh ? wh.t : w.maxRange, victim = null, region = null;
    const tmp = { n: [0, 0, 0] };
    for (const a of this.combatants()) {
      if (a === shooter || !a.alive) continue;
      if (!MATCH.friendlyFire && a.team === shooter.team) continue;
      const cy = Math.cos(a.yaw), sy = Math.sin(a.yaw);
      const ox = origin[0] - a.pos[0], oz = origin[2] - a.pos[2];
      // mundo -> local (rotação -yaw)
      const lox = ox * cy - oz * sy, loz = ox * sy + oz * cy, ldx = d[0] * cy - d[2] * sy, ldz = d[0] * sy + d[2] * cy;
      for (const [name, px, py, pz, hx, hy, hz] of a.hitParts()) {
        const box = { minX: px - hx, maxX: px + hx, minY: a.pos[1] + py - hy, maxY: a.pos[1] + py + hy, minZ: pz - hz, maxZ: pz + hz };
        const t = rayBox(lox, origin[1], loz, ldx, d[1], ldz, box, best, tmp);
        if (t < best) { best = t; victim = a; region = name; }
      }
    }
    const end = [origin[0] + d[0] * best, origin[1] + d[1] * best, origin[2] + d[2] * best];
    if (victim) {
      const dist = best, falloff = dist <= w.effRange ? 1 : lerp(1, w.minDmg, clamp((dist - w.effRange) / Math.max(w.maxRange - w.effRange, 0.01), 0, 1));
      const dmg = w.damage * falloff * DAMAGE_MULT[region] * dmgMult;
      victim.lastWeapon = w.name;
      const killed = victim.damage(dmg, shooter, region);
      this.effects.impact(end, [-d[0], -d[1], -d[2]], true);
      play('flesh', { pos: end, volume: 0.5 });
      if (shooter === this.player) { this.hud.hit(killed, region === 'head'); play(killed ? 'kill' : 'hit', { volume: 0.35 }); }
    } else if (wh) {
      this.effects.impact(end, wh.n, false);
      play('impact', { pos: end, volume: 0.35, pitch: 0.2 });
    }
    if (muzzle && shooter !== this.player) this.effects.tracer(muzzle, end);
  }

  noise(pos, radius, source) { for (const b of this.bots) b.hear(pos, radius, source); }
  callout(spotter, pos) {
    for (const b of this.bots) if (b !== spotter && b.team === spotter.team && b.p.callouts && !b.targetVisible &&
      Math.hypot(b.pos[0] - spotter.pos[0], b.pos[2] - spotter.pos[2]) < 30) b.noisePos = pos.slice();
  }

  buildCoverPoints() {
    const pts = [];
    for (const b of this.world.coverSources) {
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, hx = (b.maxX - b.minX) / 2 + 0.75, hz = (b.maxZ - b.minZ) / 2 + 0.75;
      const nx = Math.max(1, Math.floor((b.maxX - b.minX) / 2)), nz = Math.max(1, Math.floor((b.maxZ - b.minZ) / 2));
      for (let i = 0; i < nz; i++) { const z = b.minZ + (b.maxZ - b.minZ) * (i + 0.5) / nz; pts.push([cx - hx, z], [cx + hx, z]); }
      for (let i = 0; i < nx; i++) { const x = b.minX + (b.maxX - b.minX) * (i + 0.5) / nx; pts.push([x, cz - hz], [x, cz + hz]); }
    }
    return pts.filter((p) => this.nav.walkablePos(p[0], p[1]));
  }
  findCover(bot, threat) {
    const c = this.coverPoints.map((p) => [Math.hypot(p[0] - bot.pos[0], p[1] - bot.pos[2]), p])
      .filter(([d, p]) => d < 16 && d > 1 && Math.hypot(p[0] - threat[0], p[1] - threat[2]) > 5).sort((a, b) => a[0] - b[0]);
    const valid = [];
    for (const [, p] of c.slice(0, 10)) {
      if (this.bots.some((o) => o !== bot && o.alive && Math.hypot(o.pos[0] - p[0], o.pos[2] - p[1]) < 1.1)) continue;
      if (!this.world.lineOfSight([p[0], 1.0, p[1]], [threat[0], 1.3, threat[2]])) valid.push(p);
      if (valid.length >= 3) break;
    }
    return valid.length ? pick(valid) : null;
  }

  // ------------------------------------------------------------ partida
  onDeath(victim, killer, weaponName, headshot) {
    if (!this.running) return;
    if (killer && killer !== victim && killer.team !== victim.team) { this.scores[killer.team]++; this.hud.score(); }
    this.hud.feed(killer && killer !== victim ? killer : null, victim, weaponName, headshot);
    if (victim === this.player) this.hud.death(killer && killer !== victim ? killer.name : '');
    this.respawns.push({ actor: victim, at: this.time + (victim === this.player ? PLAYER.respawnDelay : BOT.respawnDelay) });
    if (this.scores[0] >= this.scoreLimit || this.scores[1] >= this.scoreLimit) this.end();
  }
  findSpawn(team) {
    const enemies = this.combatants().filter((a) => a.alive && a.team !== team), friends = this.combatants().filter((a) => a.alive && a.team === team);
    let best = null, bestScore = -Infinity;
    for (const s of this.world.spawns) {
      const p = [s.pos[0], 1.6, s.pos[1]];
      let minE = Infinity; for (const e of enemies) minE = Math.min(minE, Math.hypot(e.pos[0] - p[0], e.pos[2] - p[2]));
      let sc = minE < MATCH.spawnSafeDistance ? -1000 + minE : 0;
      sc += Math.min(minE, 40) * 0.5;
      for (const e of enemies) if (Math.hypot(e.pos[0] - p[0], e.pos[2] - p[2]) < 45 && this.world.lineOfSight(p, e.eye())) sc -= 25;
      sc += s.team === team ? 12 : s.team === -1 ? 0 : -20;
      for (const f of friends) if (Math.hypot(f.pos[0] - p[0], f.pos[2] - p[2]) < 20) sc += 3;
      sc += Math.random() * 8;
      if (sc > bestScore) { bestScore = sc; best = s; }
    }
    return best;
  }
  end() {
    this.running = false; this.inputEnabled = false;
    const [a, b] = this.scores;
    showPause(a > b ? `VITÓRIA ${a} x ${b}` : a < b ? `DERROTA ${a} x ${b}` : `EMPATE ${a} x ${b}`, 'Fim da partida.', false);
  }

  interact(pressed) {
    let near = null, text = '';
    if (this.player.alive) {
      const eye = this.player.eye(), fx = -Math.sin(this.player.yaw), fz = -Math.cos(this.player.yaw);
      for (const l of this.world.lockers) {
        const dx = l.pos[0] - eye[0], dz = l.pos[2] - eye[2], d = Math.hypot(dx, dz);
        if (d < PLAYER.interactDistance && (dx * fx + dz * fz) / d > 0.6) { near = l; break; }
      }
    }
    if (near) {
      const name = WEAPONS[near.id].name, wait = near.readyAt - this.time;
      if (!this.player.hasWeapon(near.id)) text = `[E] Pegar ${name}`;
      else text = wait > 0 ? `Munição em ${Math.ceil(wait)}s` : '[E] Reabastecer munição';
      if (pressed) {
        if (!this.player.hasWeapon(near.id)) { const w = this.player.addWeapon(near.id); this.player.select(w.cfg.slot); play('pickup', { volume: 0.5 }); this.hud.message(`${name} desbloqueada [${w.cfg.slot}]`); }
        else if (wait <= 0) { for (const w of Object.values(this.player.weapons)) w.refill(); near.readyAt = this.time + 20; play('pickup', { volume: 0.5 }); this.hud.message('Munição reabastecida'); }
      }
    }
    this.hud.prompt(text);
  }

  update(dt) {
    const t = this.time;
    if (this.running) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) this.end();
      for (let i = this.respawns.length - 1; i >= 0; i--) {
        const r = this.respawns[i];
        if (t >= r.at) { this.respawns.splice(i, 1); const s = this.findSpawn(r.actor.team); r.actor.respawn(s.pos[0], s.pos[1], s.yaw); if (r.actor === this.player) this.hud.death(null); }
      }
    }
    // atualização da física em passos fixos para estabilidade
    let rem = dt;
    while (rem > 1e-5) {
      const step = Math.min(rem, 1 / 90);
      this.time += step; setClock(this.time);
      this.player.update(step, keys, mouse);
      keys._pressed = {}; mouse._pressedLeft = false;
      if (this.running) for (const b of this.bots) b.update(step);
      rem -= step;
    }
    this.interact(keys._interact); keys._interact = false;
    this.vmFlash.intensity = this.player.flashlight.visible ? 0.6 : 0;
    this.effects.update(dt);
    this.hud.update(dt);
  }

  render(time) {
    const w = renderer.domElement.width, h = renderer.domElement.height;
    if (CAMERA.postfx) {
      if (post.rt.width !== w || post.rt.height !== h) post.rt.setSize(w, h);
      renderer.setRenderTarget(post.rt);
    } else renderer.setRenderTarget(null);
    renderer.autoClear = true;
    renderer.render(this.scene, this.camera);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.vmScene, this.vmCamera);
    renderer.autoClear = true;
    if (CAMERA.postfx) {
      renderer.setRenderTarget(null);
      post.mat.uniforms.tex.value = post.rt.texture; post.mat.uniforms.time.value = time;
      renderer.render(post.scene, post.cam);
    }
  }

  dispose() {
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    stopAmbient();
  }
}

// ---------------------------------------------------------------- efeitos
class Effects {
  constructor(scene) {
    this.scene = scene;
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    this.puffTex = new THREE.CanvasTexture(c);
    this.puffs = []; this.tracers = []; this.marks = []; this.markIdx = 0;
    const markMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    const markGeo = new THREE.CircleGeometry(0.035, 8);
    for (let i = 0; i < 80; i++) { const m = new THREE.Mesh(markGeo, markMat); m.visible = false; scene.add(m); this.marks.push(m); }
  }
  impact(p, n, flesh) {
    const pos = new THREE.Vector3(...p);
    if (!flesh) {
      const m = this.marks[this.markIdx++ % this.marks.length];
      m.position.copy(pos).addScaledVector(new THREE.Vector3(...n), 0.01);
      m.lookAt(pos.clone().add(new THREE.Vector3(...n))); m.visible = true;
    }
    for (let i = 0; i < (flesh ? 5 : 7); i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puffTex, color: flesh ? 0x2a2626 : 0xbfb8a8, transparent: true, depthWrite: false, opacity: 0.8 }));
      s.position.copy(pos); s.scale.setScalar(0.08);
      const v = new THREE.Vector3(n[0] + rand(-0.6, 0.6), n[1] + rand(-0.2, 0.8), n[2] + rand(-0.6, 0.6)).normalize().multiplyScalar(rand(1, 3));
      this.scene.add(s); this.puffs.push({ s, v, life: 0.4 });
    }
  }
  tracer(a, b) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffd98c, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }));
    this.scene.add(l); this.tracers.push({ l, life: 0.05 });
  }
  update(dt) {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i]; p.life -= dt; p.v.y -= 6 * dt;
      p.s.position.addScaledVector(p.v, dt); p.s.scale.setScalar(0.08 + (0.4 - p.life) * 0.4); p.s.material.opacity = Math.max(0, p.life / 0.4) * 0.8;
      if (p.life <= 0) { this.scene.remove(p.s); p.s.material.dispose(); this.puffs.splice(i, 1); }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]; t.life -= dt;
      if (t.life <= 0) { this.scene.remove(t.l); t.l.geometry.dispose(); t.l.material.dispose(); this.tracers.splice(i, 1); }
    }
  }
}

// ---------------------------------------------------------------- HUD
class HUD {
  constructor(game) {
    this.g = game; this.flash = 0; this.msgT = 0; this.deathT = 0; this.deathKiller = null; this.hitT = 0; this.dirT = 0;
    $('feed').innerHTML = '';
  }
  score() { $('s0').textContent = this.g.scores[0]; $('s1').textContent = this.g.scores[1]; }
  hit(kill, head) { const h = $('hitm'); h.className = kill ? 'kill' : head ? 'head' : ''; h.style.opacity = 1; this.hitT = kill ? 0.25 : 0.14; }
  damageFlash(a) { this.flash = Math.min(0.7, this.flash + a / 60); }
  damageFrom(angle) { const i = $('dmgdir').firstElementChild; i.style.transform = `rotate(${-angle}rad)`; this.dirT = 1; }
  prompt(t) { if (this._p !== t) { this._p = t; $('prompt').textContent = t; } }
  message(t) { $('msg').textContent = t; this.msgT = 2.5; }
  death(killer) { if (killer === null) { $('death').innerHTML = ''; this.deathT = 0; this.flash = 0; return; } this.deathKiller = killer; this.deathT = PLAYER.respawnDelay; }
  feed(killer, victim, weapon, head) {
    const el = document.createElement('div');
    const cls = (a) => (a.team === 0 ? 'k-blue' : 'k-red');
    el.innerHTML = killer ? `<span class="${cls(killer)}">${killer.name}</span> <span class="w">[${weapon}${head ? ' ◎' : ''}]</span> <span class="${cls(victim)}">${victim.name}</span>`
      : `<span class="${cls(victim)}">${victim.name}</span> <span class="w">foi eliminado</span>`;
    const f = $('feed'); f.appendChild(el); while (f.children.length > 5) f.firstChild.remove();
    setTimeout(() => el.remove(), 5000);
  }
  update(dt) {
    const p = this.g.player, w = p.current;
    // vida
    $('hpn').textContent = Math.ceil(p.health); $('hpf').style.width = p.health + '%';
    $('health').classList.toggle('low', p.health < 35);
    const low = 1 - p.health / 100;
    this.flash = Math.max(0, this.flash - dt * 1.8);
    $('vignette').style.opacity = clamp(this.flash + low * low * 0.8, 0, 1);
    this.dirT = Math.max(0, this.dirT - dt); $('dmgdir').firstElementChild.style.opacity = this.dirT;
    // arma e munição
    if (w) {
      $('wname').textContent = w.cfg.name; $('mag').textContent = w.mag; $('res').textContent = w.reserve;
      const lowAmmo = w.mag <= Math.floor(w.cfg.mag * 0.25);
      $('ammo').classList.toggle('low', lowAmmo);
      $('astatus').textContent = w.mag === 0 && w.reserve === 0 ? 'SEM MUNIÇÃO' : lowAmmo && w.reserve > 0 && w.state !== 'reloading' ? '[R] RECARREGAR' : '';
      const rl = w.state === 'reloading'; $('rbar').hidden = !rl; if (rl) $('rfill').style.width = (w.reloadProgress() * 100) + '%';
      $('slots').textContent = p.slots().map((s) => (s === w.cfg.slot ? `[${s}]` : s)).join(' ');
      // mira dinâmica (abre com a dispersão real)
      const halfH = innerHeight / 2, gap = Math.max(4, Math.tan(w.spread * DEG) / Math.tan(this.g.camera.fov / 2 * DEG) * halfH);
      const cross = $('cross');
      cross.className = !p.alive || p.sprinting || w.state === 'reloading' || w.isScoped() ? 'hide' : w.ads > 0.6 ? 'ads' : '';
      const [t, b, l, r] = cross.children;
      t.style.top = (-gap - 7) + 'px'; b.style.top = gap + 'px'; l.style.left = (-gap - 7) + 'px'; r.style.left = gap + 'px';
      $('scope').style.display = w.isScoped() && p.alive ? 'block' : 'none';
    }
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) $('hitm').style.opacity = 0; }
    if (this.msgT > 0) { this.msgT -= dt; $('msg').style.opacity = clamp(this.msgT, 0, 1); }
    if (!p.alive && this.deathKiller !== null) {
      this.deathT -= dt;
      $('death').innerHTML = `ELIMINADO${this.deathKiller ? ' POR ' + this.deathKiller.toUpperCase() : ''}<small>renascendo em ${Math.max(0, Math.ceil(this.deathT))}</small>`;
    }
    const s = Math.max(0, Math.ceil(this.g.timeLeft));
    $('stime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · meta ${this.g.scoreLimit}`;
    const e = Math.floor((performance.now() - this.g.recStart) / 1000);
    $('rect').textContent = [e / 3600, (e / 60) % 60, e % 60].map((v) => String(Math.floor(v)).padStart(2, '0')).join(':');
    $('rec').firstElementChild.style.visibility = e % 2 ? 'hidden' : 'visible';
  }
}

// ---------------------------------------------------------------- menus
function segmented(id, options, current, onPick) {
  const el = $(id); el.innerHTML = '';
  for (const [value, label] of options) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.id = `${id}-${value}`;
    b.className = value === current ? 'on' : '';
    b.onclick = () => { [...el.children].forEach((c) => (c.className = '')); b.className = 'on'; onPick(value); };
    el.appendChild(b);
  }
}
segmented('opt-diff', Object.entries(BOT_DIFFICULTY).map(([k, v]) => [k, v.label]), SETTINGS.difficulty, (v) => (SETTINGS.difficulty = v));
segmented('opt-mode', Object.keys(MATCH.modes).map((k) => [k, k]), SETTINGS.mode, (v) => (SETTINGS.mode = v));
segmented('opt-time', Object.entries(LIGHTING).map(([k, v]) => [k, v.label]), SETTINGS.time, (v) => (SETTINGS.time = v));
segmented('opt-quality', [['baixa', 'Baixa'], ['media', 'Média'], ['alta', 'Alta']], SETTINGS.quality, (v) => (SETTINGS.quality = v));
const fov = $('opt-fov'), sens = $('opt-sens'), fx = $('opt-fx');
fov.value = CAMERA.fov; sens.value = CAMERA.sensitivity; $('out-fov').textContent = CAMERA.fov; $('out-sens').textContent = CAMERA.sensitivity;
fov.oninput = () => { CAMERA.fov = +fov.value; $('out-fov').textContent = fov.value; };
sens.oninput = () => { CAMERA.sensitivity = +sens.value; $('out-sens').textContent = (+sens.value).toFixed(2); };
fx.onchange = () => { CAMERA.postfx = fx.checked; };
if (matchMedia('(pointer: coarse)').matches) $('touchnote').hidden = false;

function lockPointer() {
  try { const r = canvas.requestPointerLock({ unadjustedMovement: true }); if (r && r.catch) r.catch(() => { try { canvas.requestPointerLock(); } catch {} }); } catch {}
}
function showPause(title, sub, canResume = true) {
  $('pause-title').textContent = title; $('pause-sub').textContent = sub; $('resume').hidden = !canResume;
  $('pause').hidden = false;
}

async function startGame() {
  initAudio();
  $('menu').hidden = true; $('pause').hidden = true; $('loading').hidden = false;
  if (game) { game.dispose(); game = null; }
  $('load-bar').style.width = '15%';
  await new Promise((r) => setTimeout(r, 30));
  const models = preloadModels();
  let done = 0; const total = WEAPON_ORDER.length;
  WEAPON_ORDER.forEach(() => {});
  models.then(() => { done = total; });
  $('load-text').textContent = 'Gerando o mapa…';
  await new Promise((r) => setTimeout(r, 30));
  game = new Game();
  $('load-bar').style.width = '60%'; $('load-text').textContent = 'Carregando os modelos das armas…';
  await models;
  $('load-bar').style.width = '100%';
  onResize();
  // compila shaders antes do primeiro quadro
  try { renderer.compile(game.scene, game.camera); } catch {}
  $('loading').hidden = true; $('hud').hidden = false;
  startAmbient();
  lockPointer();
}

$('play').onclick = startGame;
$('restart').onclick = startGame;
$('tomenu').onclick = () => { if (game) { game.dispose(); game = null; } $('pause').hidden = true; $('hud').hidden = true; $('menu').hidden = false; };
$('resume').onclick = () => { $('pause').hidden = true; lockPointer(); };

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement) lockSettle = 2;
  if (!document.pointerLockElement && game && game.running && $('loading').hidden) showPause('PAUSADO', 'Clique em continuar para voltar ao jogo.');
});

// ---------------------------------------------------------------- entrada
addEventListener('keydown', (e) => {
  if (!game) return;
  if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  if (!keys[e.code]) keys._pressed[e.code] = true;
  keys[e.code] = true;
  const p = game.player;
  if (!game.inputEnabled || !p.alive) return;
  if (/^Digit[1-5]$/.test(e.code)) p.select(+e.code.slice(5));
  else if (e.code === 'KeyQ') p.quickSwitch();
  else if (e.code === 'KeyE') keys._interact = true;
  else if (e.code === 'KeyF') { p.flashlight.visible = !p.flashlight.visible; play('empty', { volume: 0.3 }); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) if (k !== '_pressed') keys[k] = false; mouse.left = mouse.right = false; });
canvas.addEventListener('mousedown', (e) => {
  if (!game) return;
  if (!document.pointerLockElement) { lockPointer(); return; }
  if (e.button === 0) { mouse.left = true; mouse._pressedLeft = true; }
  if (e.button === 2) mouse.right = true;
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouse.left = false; if (e.button === 2) mouse.right = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
// Ignora o "salto" que alguns navegadores enviam logo após travar o mouse.
let lockSettle = 0;
addEventListener('mousemove', (e) => {
  if (!game || document.pointerLockElement !== canvas) return;
  if (lockSettle > 0) { lockSettle--; return; }
  if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
  game.player.look(e.movementX, e.movementY);
});
addEventListener('wheel', (e) => { if (game && document.pointerLockElement) game.player.cycle(e.deltaY > 0 ? 1 : -1); }, { passive: true });

function onResize() {
  renderer.setSize(innerWidth, innerHeight, false);
  if (game) { game.camera.aspect = game.vmCamera.aspect = innerWidth / innerHeight; game.camera.updateProjectionMatrix(); game.vmCamera.updateProjectionMatrix(); }
}
addEventListener('resize', onResize);
onResize();

// ---------------------------------------------------------------- loop
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!game) return;
  const paused = !$('pause').hidden && game.running;
  if (!paused) game.update(dt);
  game.render(now / 1000);
}
requestAnimationFrame(frame);

// Gancho de teste (usado só para verificação automática).
window.__bodycam = { get game() { return game; }, startGame, keys, mouse };
