// ============================================================================
//  MAPA "Distrito 7" — mesmo layout do projeto Godot (map/map_builder.gd)
//  ~96 x 76 m, espelhado no eixo X (Oeste = equipe 0 / Leste = equipe 1).
//  Rotas: Rua Norte (longa), Rua Central + Praça (média), Armazém (curta),
//  beco sul e prédios como rotas alternativas.
//  Colisão = caixas alinhadas (AABB). Visual estático é mesclado por
//  material (poucas chamadas de desenho).
// ============================================================================
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';
import { material, plain, emissive, boxGeometry } from './textures.js';
import { rayBox, rand, pick } from './util.js';
import { LIGHTING, SETTINGS } from './config.js';

const WALL_T = 0.3;

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];     // {minX,minY,minZ,maxX,maxY,maxZ, cover}
    this.coverSources = [];  // caixas que geram pontos de cobertura
    this.spawns = [];        // {pos:[x,z], yaw, team}
    this.patrol = [];        // [x,z]
    this.lockers = [];       // {id, pos:[x,y,z], mesh, readyAt}
    this.lights = [];
    this._static = new Map();  // chave material -> {mat, geos:[], shadow}
    this.m = 1;                // espelho: 1 = Oeste, -1 = Leste
    this.lighting = LIGHTING[SETTINGS.time];
    this.lampLights = 0;
    this.maxLampLights = SETTINGS.quality === 'baixa' ? 0 : SETTINGS.quality === 'media' ? 8 : 14;
    this.maxInteriorLights = SETTINGS.quality === 'baixa' ? 4 : 12;
    this.interiorLights = 0;
  }

  build() {
    this.m = 1;
    this.buildCenter();
    for (const side of [1, -1]) { this.m = side; this.buildHalf(); }
    this.m = 1;
    this.buildSkyline();
    this.buildGroundDetails();
    this.finalize();
  }

  // ---------------------------------------------------------------- helpers
  p(x, z) { return [x * this.m, z]; }

  /** Adiciona geometria estática (mesclada depois) já posicionada. */
  addStatic(geo, mat, matrix, shadow = true) {
    geo.applyMatrix4(matrix);
    const key = mat.uuid + (shadow ? 's' : 'n');
    if (!this._static.has(key)) this._static.set(key, { mat, geos: [], shadow });
    this._static.get(key).geos.push(geo);
  }

  /** Caixa visual + colisão. rot só aceita 0 ou 90° para colisão exata. */
  box(cx, cy, cz, sx, sy, sz, mat, { collide = true, cover = false, rotY = 0, shadow = true } = {}) {
    const g = boxGeometry(sx, sy, sz, mat.userData.tile || 2);
    const m4 = new THREE.Matrix4().makeRotationY(rotY).setPosition(cx, cy, cz);
    this.addStatic(g, mat, m4, shadow);
    if (collide) {
      const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY));
      const hx = (sx * c + sz * s) / 2, hz = (sx * s + sz * c) / 2;
      const b = { minX: cx - hx, maxX: cx + hx, minY: cy - sy / 2, maxY: cy + sy / 2, minZ: cz - hz, maxZ: cz + hz, cover };
      this.colliders.push(b);
      if (cover) this.coverSources.push(b);
    }
  }

  cyl(cx, cy, cz, r, h, mat, { collide = false, top = -1, seg = 12, shadow = true } = {}) {
    const g = new THREE.CylinderGeometry(top < 0 ? r : top, r, h, seg);
    this.addStatic(g, mat, new THREE.Matrix4().setPosition(cx, cy, cz), shadow);
    if (collide) this.colliders.push({ minX: cx - r, maxX: cx + r, minY: cy - h / 2, maxY: cy + h / 2, minZ: cz - r, maxZ: cz + r, cover: false });
  }

  sphere(cx, cy, cz, r, mat, squash = 1) {
    const g = new THREE.SphereGeometry(r, 12, 8);
    const m4 = new THREE.Matrix4().makeScale(1, squash, 1).setPosition(cx, cy, cz);
    this.addStatic(g, mat, m4, true);
  }

  plane(cx, y, cz, sx, sz, mat, rotY = 0) {
    const g = new THREE.PlaneGeometry(sx, sz);
    const uv = g.attributes.uv, tile = mat.userData.tile || 2;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx / tile, uv.getY(i) * sz / tile);
    const m4 = new THREE.Matrix4().makeRotationY(rotY).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)).setPosition(cx, y, cz);
    this.addStatic(g, mat, m4, false);
  }

  /** Parede ao longo de X (coordenadas do lado Oeste; espelhada). */
  wallX(z, x0, x1, h, openings, mat) {
    for (const [a, b, y0, y1] of segments(Math.min(x0, x1), Math.max(x0, x1), h, openings)) {
      const [cx] = this.p((a + b) / 2, z);
      this.box(cx, (y0 + y1) / 2, z, b - a, y1 - y0, WALL_T, mat);
    }
  }
  wallZ(x, z0, z1, h, openings, mat) {
    for (const [a, b, y0, y1] of segments(Math.min(z0, z1), Math.max(z0, z1), h, openings)) {
      const [cx] = this.p(x, 0);
      this.box(cx, (y0 + y1) / 2, (a + b) / 2, WALL_T, y1 - y0, b - a, mat);
    }
  }

  building(x0, x1, z0, z1, h, on, os, ow, oe, mat) {
    const t = WALL_T / 2;
    this.wallX(z0, x0 - t, x1 + t, h, on, mat);
    this.wallX(z1, x0 - t, x1 + t, h, os, mat);
    this.wallZ(x0, z0 + t, z1 - t, h, ow, mat);
    this.wallZ(x1, z0 + t, z1 - t, h, oe, mat);
    const [cx, cz] = this.p((x0 + x1) / 2, (z0 + z1) / 2);
    const sx = Math.abs(x1 - x0) + 0.6, sz = Math.abs(z1 - z0) + 0.6;
    this.box(cx, h + 0.15, cz, sx, 0.3, sz, material('roof'), { collide: true });
    // Mureta do telhado.
    const pm = material('concrete', 0xccccc6);
    this.box(cx, h + 0.55, cz - sz / 2, sx, 0.5, 0.25, pm, { collide: false });
    this.box(cx, h + 0.55, cz + sz / 2, sx, 0.5, 0.25, pm, { collide: false });
    this.box(cx - sx / 2, h + 0.55, cz, 0.25, 0.5, sz, pm, { collide: false });
    this.box(cx + sx / 2, h + 0.55, cz, 0.25, 0.5, sz, pm, { collide: false });
    // Calhas nos cantos.
    const pipe = plain(0x4d4f4d, 0.5, 0.6);
    for (const px of [x0 - 0.25, x1 + 0.25]) for (const pz of [z0 - 0.25, z1 + 0.25]) {
      const [qx, qz] = this.p(px, pz); this.cyl(qx, (h + 0.3) / 2, qz, 0.05, h + 0.3, pipe, { seg: 8 });
    }
  }

  /** Ponto de luz (limitado por qualidade gráfica para manter o FPS). */
  light(x, y, z, color, intensity, dist, interior) {
    if (interior) { if (this.interiorLights >= this.maxInteriorLights) return; this.interiorLights++; }
    else { if (this.lampLights >= this.maxLampLights) return; this.lampLights++; }
    const l = new THREE.PointLight(color, intensity, dist, 2);
    l.position.set(x, y, z);
    this.scene.add(l);
    this.lights.push(l);
  }

  // ------------------------------------------------------------ objetos
  crate(x, z, size = 1.2) {
    this.box(x, size / 2, z, size, size, size, material('wood', 0xf2d9b3), { cover: true });
    const trim = material('wood', 0x8c735a);
    for (const y of [0.06, size - 0.06]) this.box(x, y, z, size + 0.02, 0.1, size + 0.02, trim, { collide: false });
  }

  jersey(x, z, sx, sz) { this.box(x, 0.55, z, sx, 1.1, sz, material('concrete', 0xe6e6e0), { cover: true }); }

  car(x, z, rotY, color) {
    const r = rotY;
    const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.45, roughness: 0.35 });
    const glass = plain(0x0c1114, 0.08, 0.8), dark = plain(0x0d0d0d, 0.6);
    const M = (lx, ly, lz) => new THREE.Matrix4().makeRotationY(r).setPosition(x, 0, z).multiply(new THREE.Matrix4().setPosition(lx, ly, lz));
    const part = (sx, sy, sz, lx, ly, lz, mat) => this.addStatic(boxGeometry(sx, sy, sz), mat, M(lx, ly, lz));
    part(4.3, 0.62, 1.8, 0, 0.62, 0, paint);
    part(1.1, 0.08, 1.74, 1.55, 0.95, 0, paint);
    part(0.8, 0.08, 1.74, -1.7, 0.95, 0, paint);
    part(2.2, 0.55, 1.62, -0.2, 1.22, 0, glass);
    part(1.9, 0.07, 1.58, -0.25, 1.52, 0, paint);
    for (const px of [0.85, -1.25]) for (const pz of [-0.79, 0.79]) part(0.12, 0.56, 0.06, px, 1.22, pz, paint);
    part(0.12, 0.3, 1.82, 2.17, 0.45, 0, dark); part(0.12, 0.3, 1.82, -2.17, 0.45, 0, dark);
    for (const s of [-0.68, 0.68]) {
      part(0.04, 0.12, 0.32, 2.21, 0.74, s, emissive(0xfff2d9, 0.5));
      part(0.04, 0.12, 0.3, -2.21, 0.78, s, emissive(0xcc0d08, 0.8));
    }
    for (const [wx, wz] of [[1.35, 0.9], [-1.35, 0.9], [1.35, -0.9], [-1.35, -0.9]]) {
      const g = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14);
      this.addStatic(g, dark, M(wx, 0.34, wz).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
    }
    // colisão: caixa alinhada que envolve o carro
    const c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
    const hx = (4.4 * c + 1.85 * s) / 2, hz = (4.4 * s + 1.85 * c) / 2;
    const b = { minX: x - hx, maxX: x + hx, minY: 0.1, maxY: 1.4, minZ: z - hz, maxZ: z + hz, cover: true };
    this.colliders.push(b); this.coverSources.push(b);
  }

  truck(x, z, flip) {
    const d = flip ? -1 : 1;
    this.box(x - 0.7 * d, 1.75, z, 5.3, 2.5, 2.4, material('corrugated', 0xd9dbd6), { cover: true });
    this.box(x + 0.1 * d, 0.42, z, 7.2, 0.25, 1.9, plain(0x0d0d0d), { collide: false });
    this.box(x + 2.9 * d, 1.25, z, 1.7, 1.9, 2.3, new THREE.MeshStandardMaterial({ color: 0xbfbfb8, metalness: 0.4, roughness: 0.4 }), { cover: true });
    this.box(x + 3.62 * d, 1.65, z, 0.3, 0.75, 2.1, plain(0x0c1114, 0.08, 0.8), { collide: false });
    for (const wx of [-2.4, -1.2, 2.9]) for (const wz of [-1, 1]) {
      const g = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 14);
      this.addStatic(g, plain(0x0d0d0d, 0.6), new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(x + wx * d, 0.45, z + wz));
    }
  }

  dumpster(x, z) {
    this.box(x, 0.72, z, 2.0, 1.1, 1.25, material('metal', 0x2a4d33), { cover: true });
    this.box(x, 1.3, z - 0.05, 2.02, 0.06, 1.3, plain(0x141414, 0.7), { collide: false });
  }

  barrel(x, z, color) {
    this.cyl(x, 0.45, z, 0.3, 0.9, material('metal', color), { collide: true, seg: 16 });
    for (const y of [0.2, 0.7]) this.cyl(x, y, z, 0.31, 0.04, plain(0x333333, 0.6, 0.4), { seg: 16 });
  }

  pallets(x, z, layers = 2) {
    this.box(x, 0.07, z, 1.2, 0.14, 1.0, material('wood', 0xf2e6cc), { collide: false });
    const card = material('cardboard');
    for (let l = 0; l < layers; l++) for (let ix = 0; ix < 2; ix++) for (let iz = 0; iz < 2; iz++)
      this.box(x - 0.29 + ix * 0.58 + rand(-0.02, 0.02), 0.39 + l * 0.5, z - 0.24 + iz * 0.48 + rand(-0.02, 0.02), 0.55, 0.49, 0.46, card, { collide: false });
    const h = 0.14 + layers * 0.5;
    const b = { minX: x - 0.6, maxX: x + 0.6, minY: 0, maxY: h, minZ: z - 0.5, maxZ: z + 0.5, cover: true };
    this.colliders.push(b); this.coverSources.push(b);
  }

  shelf(x, z, length) {
    const h = 2.4;
    const b = { minX: x - length / 2, maxX: x + length / 2, minY: 0, maxY: h, minZ: z - 0.5, maxZ: z + 0.5, cover: true };
    this.colliders.push(b); this.coverSources.push(b);
    const frame = material('metal', 0x4066a6), beam = material('metal', 0xd98026), card = material('cardboard');
    const posts = Math.floor(length / 2.2) + 1;
    for (let i = 0; i < posts; i++) {
      const px = x - length / 2 + (length * i) / (posts - 1);
      for (const pz of [-0.45, 0.45]) this.box(px, h / 2, z + pz, 0.08, h, 0.08, frame, { collide: false });
    }
    for (const y of [0.15, 1.2, 2.3]) {
      for (const pz of [-0.45, 0.45]) this.box(x, y, z + pz, length, 0.1, 0.06, beam, { collide: false });
      this.box(x, y + 0.06, z, length, 0.03, 0.95, frame, { collide: false });
    }
    for (const level of [0.2, 1.25]) {
      let px = x - length / 2 + 0.4;
      while (px < x + length / 2 - 0.4) {
        const bw = rand(0.5, 0.8), bh = rand(0.5, 0.9);
        this.box(px + bw / 2, level + bh / 2 + 0.05, z, bw, bh, 0.85, card, { collide: false });
        px += bw + 0.05;
      }
    }
  }

  lamp(x, z, yaw) {
    const metal = plain(0x2e3033, 0.5, 0.6);
    this.cyl(x, 2.9, z, 0.08, 5.8, metal, { collide: true, top: 0.06, seg: 8 });
    this.cyl(x, 0.3, z, 0.14, 0.6, metal, { seg: 8 });
    const dx = -Math.sin(yaw), dz = -Math.cos(yaw);
    this.box(x + dx * 0.6, 5.75, z + dz * 0.6, 0.08, 0.08, 1.3, metal, { collide: false, rotY: yaw });
    const hx = x + dx * 1.2, hz = z + dz * 1.2;
    this.box(hx, 5.65, hz, 0.35, 0.14, 0.6, metal, { collide: false, rotY: yaw });
    const on = this.lighting.streetLights;
    this.box(hx, 5.57, hz, 0.28, 0.02, 0.5, on ? emissive(0xffd199, 4) : plain(0x777777), { collide: false, rotY: yaw, shadow: false });
    if (on) this.light(hx, 5.3, hz, 0xffd199, 30, 16, false);
  }

  tree(x, z, s = 1) {
    this.cyl(x, 1.6 * s, z, 0.16 * s, 3.2 * s, plain(0x403024, 0.95), { collide: true, top: 0.11 * s, seg: 8 });
    this.sphere(x, 3.6 * s, z, 1.5 * s, plain(0x334d29, 0.9), 0.8);
    this.sphere(x + 0.7 * s, 3.2 * s, z + 0.3 * s, 1.0 * s, plain(0x294021, 0.9), 0.8);
    this.sphere(x - 0.6 * s, 3.3 * s, z - 0.4 * s, 1.1 * s, plain(0x294021, 0.9), 0.8);
  }

  bench(x, z, rotY) {
    const wood = material('wood'), metal = plain(0x262626, 0.5, 0.6);
    const M = (lx, ly, lz) => new THREE.Matrix4().makeRotationY(rotY).setPosition(x, 0, z).multiply(new THREE.Matrix4().setPosition(lx, ly, lz));
    this.addStatic(boxGeometry(1.8, 0.06, 0.45), wood, M(0, 0.45, 0));
    this.addStatic(boxGeometry(1.8, 0.35, 0.05), wood, M(0, 0.8, 0.2));
    for (const lx of [-0.8, 0.8]) this.addStatic(boxGeometry(0.06, 0.44, 0.45), metal, M(lx, 0.22, 0));
  }

  bin(x, z) { this.cyl(x, 0.45, z, 0.28, 0.9, plain(0x334738, 0.6, 0.3), { collide: true, top: 0.3, seg: 14 }); }
  cone(x, z) { this.cyl(x, 0.25, z, 0.14, 0.5, plain(0xf25a0d, 0.6), { top: 0.025, seg: 12 }); }
  hydrant(x, z) { this.cyl(x, 0.35, z, 0.12, 0.7, plain(0xb31a12, 0.5, 0.2), { seg: 10 }); this.sphere(x, 0.72, z, 0.13, plain(0xb31a12, 0.5, 0.2)); }
  shrub(x, y, z, len) { const n = Math.max(1, Math.floor(len / 0.8)); for (let i = 0; i < n; i++) this.sphere(x + ((i + 0.5) / n - 0.5) * len, y, z, 0.55, plain(0x2e4724, 0.95), 0.7); }

  ceilingLight(x, y, z, cool, interior = true) {
    const color = cool ? 0xd9ebff : 0xffd9a6;
    this.box(x, y, z, 1.2, 0.05, 0.3, emissive(color, 3), { collide: false, shadow: false });
    this.light(x, y - 0.3, z, color, 6 * this.lighting.interior, 9, interior);
  }

  locker(id, x, y, z, color) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.2, 0.5), plain(0x2e382e, 0.7));
    body.position.y = 0.6; body.castShadow = true; body.receiveShadow = true; g.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.52), emissive(color, 1));
    stripe.position.y = 1.0; g.add(stripe);
    this.scene.add(g);
    this.colliders.push({ minX: x - 0.55, maxX: x + 0.55, minY: y, maxY: y + 1.2, minZ: z - 0.25, maxZ: z + 0.25, cover: false });
    this.lockers.push({ id, pos: [x, y + 0.9, z], readyAt: 0 });
  }

  roadLine(x0, z0, x1, z1, w, color, dash = 0, gap = 0) {
    const mat = plain(color, 0.75);
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
    if (!dash) { this.plane((x0 + x1) / 2, 0.014, (z0 + z1) / 2, w, len, mat, yaw); return; }
    const n = Math.floor(len / (dash + gap));
    for (let i = 0; i < n; i++) {
      const t = (i * (dash + gap) + dash / 2) / len;
      this.plane(x0 + dx * t, 0.014, z0 + dz * t, w, dash, mat, yaw);
    }
  }

  // ------------------------------------------------------------ layout
  buildCenter() {
    // Chão (colisão) + asfalto.
    this.colliders.push({ minX: -60, maxX: 60, minY: -1, maxY: 0, minZ: -50, maxZ: 50, cover: false, floor: true });
    this.plane(0, 0, 0, 97, 77, material('asphalt'));
    this.plane(0, 0.012, 0, 24, 36, material('pavers'));
    this.plane(0, 0.01, 20, 64, 4, material('sidewalk'));
    // Limites: fachadas altas.
    const fac = material('facade', 0xf2ebdb);
    this.box(0, 6, -38.5, 98, 12, 1, fac); this.box(0, 6, 38.5, 98, 12, 1, fac);
    this.box(-48.5, 6, 0, 1, 12, 78, fac); this.box(48.5, 6, 0, 1, 12, 78, fac);
    // Praça: monumento no centro bloqueia a linha de visão do meio.
    this.box(0, 1.75, 0, 3.5, 3.5, 3.5, material('concrete'), { cover: true });
    this.box(0, 0.15, 0, 4.3, 0.3, 4.3, material('concrete'), { collide: false });
    this.box(0, 4.25, 0, 1, 1.5, 1, material('metal', 0x736650));
    this.car(0, -13, 0, 0xb8b39e);
    this.box(0, 0.6, 13, 5, 1.2, 0.4, material('concrete', 0xe6e6e0), { cover: true });
    this.crate(0, -27); this.crate(0.1, -28.25);
    this.roadLine(0, -34, 0, -22, 0.12, 0xd9b833);
    // Armazém: fachada norte e telhado únicos.
    const wh = material('corrugated', 0x9ea8b3);
    this.wallX(22, -30.15, 30.15, 6, [[-24, 1.6, 0, 2.4], [-16, 2, 1.2, 2.4], [-8, 1.4, 0, 2.3], [0, 3, 0, 3],
      [8, 1.4, 0, 2.3], [16, 2, 1.2, 2.4], [24, 1.6, 0, 2.4]], wh);
    this.box(0, 6.15, 30.1, 60.6, 0.3, 16.6, material('roof'));
    this.plane(0, 0.02, 30.1, 60, 15.8, material('concrete', 0xbfbfbd));
    this.shelf(0, 27, 9); this.shelf(0, 32.5, 9);
    this.pallets(-5, 35.5); this.pallets(5, 24.5);
    for (const z of [25, 29.75, 34.5]) this.ceilingLight(0, 5.9, z, false);
    // Spawns neutros e patrulha central.
    this.spawns.push({ pos: [0, -35], yaw: Math.PI, team: -1 }, { pos: [0, 35.5], yaw: 0, team: -1 });
    this.patrol.push([0, -10], [0, 10], [0, -24], [0, 29.75], [0, 35.5], [0, -33]);
  }

  buildHalf() {
    const m = this.m, team = m > 0 ? 0 : 1, P = (x, z) => this.p(x, z);
    const face = -Math.PI / 2 * m;
    // --- Spawn (estacionamento) ---
    for (const z of [-28, -20, -12, -4, 4, 12, 20, 28]) this.spawns.push({ pos: P(-43, z), yaw: face, team });
    this.spawns.push({ pos: P(-33, -24), yaw: face, team: -1 }, { pos: P(-33, 20), yaw: face, team: -1 });
    const cont = material('corrugated', team === 0 ? 0x4d7394 : 0x9e4d38);
    for (const z of [-12, 12]) { const [x] = P(-38, 0); this.box(x, 1.3, z, 2.5, 2.6, 6, cont, { cover: true }); }
    { const [x] = P(-35, 0); this.jersey(x, 0, 0.6, 3); }
    for (let z = -26; z <= 28; z += 3) { const [a] = P(-47, 0), [b] = P(-44.5, 0); this.roadLine(a, z, b, z, 0.1, 0xd9d9cc); }
    { const [x] = P(-44.5, 0); this.roadLine(x, -27, x, 27, 0.1, 0xd9d9cc); }
    { const [x] = P(-45.6, 0); this.car(x, -16.5, Math.PI / 2, 0x333338); this.car(x, 16.5, Math.PI / 2, 0xb3b3b8); }
    { const [x] = P(-40, 0); this.lamp(x, -4, face); this.lamp(x, 24, face); }
    { const [x, z] = P(-36, -34.5); this.locker('sniper', x, 0, z, 0x4d99ff); }
    // --- Rua Norte (longa distância) ---
    { const [a] = P(-34, 0), [b] = P(-1, 0);
      this.roadLine(a, -28.5, b, -28.5, 0.14, 0xd9d9d1, 3, 3); this.roadLine(a, -35.8, b, -35.8, 0.12, 0xd9d9d1); this.roadLine(a, -21.4, b, -21.4, 0.12, 0xd9d9d1); }
    { const [x] = P(-21, 0); this.car(x, -28, 0.1 * m, 0x801a14); }
    { const [x] = P(-9, 0); this.car(x, -32, -0.35 * m, 0x21335c); }
    { const [x] = P(-18, 0); this.cone(x, -26.2); this.cone(x + 0.8 * m, -26.8); }
    { const [x] = P(-15, 0); this.jersey(x, -23.5, 3, 0.6); }
    { const [x] = P(-33, 0); this.jersey(x, -27, 0.6, 3); }
    { const [x] = P(-4.5, 0); this.crate(x, -24.5); }
    { const [x] = P(-27, 0); this.box(x, 1.25, -22, 3, 2.5, 1.2, material('plaster', 0x739980), { cover: true }); this.box(x, 2.62, -22, 3.4, 0.12, 1.8, material('metal'), { collide: false }); }
    { const [x] = P(-22, 0); this.lamp(x, -20.6, Math.PI); }
    { const [x] = P(-8, 0); this.lamp(x, -36.8, 0); }
    { const [x] = P(-31, 0); this.hydrant(x, -19.6); }
    { const [x] = P(-12.6, 0); this.bin(x, -19.4); }
    // --- Prédio Norte (tijolo, 2 salas) ---
    { const [x] = P(-21, 0); this.plane(x, 0.01, -13, 22, 14.4, material('sidewalk')); this.plane(x, 0.02, -13, 17.7, 9.7, material('wood', 0xe6d9cc)); }
    this.building(-30, -12, -18, -8, 4,
      [[-26, 1.4, 0, 2.3], [-19, 2, 1.1, 2.1], [-15, 1.6, 0, 2.4]],
      [[-27, 2, 1.1, 2.1], [-24, 1.6, 0, 2.4], [-16, 2, 1.1, 2.1]],
      [[-13, 1.6, 0, 2.4]], [[-15.5, 2, 1.1, 2.1], [-11, 1.6, 0, 2.4]], material('brick'));
    this.wallZ(-21, -17.85, -8.15, 4, [[-11, 1.4, 0, 2.3]], material('plaster', 0xdbd4c2));
    { const [x] = P(-26.5, 0); this.box(x, 0.45, -12.5, 1.8, 0.9, 0.9, material('wood', 0xbfa68c), { cover: true }); }
    { const [x] = P(-14, 0); this.box(x, 1, -17.4, 2, 2, 0.5, material('metal', 0x4d6b99)); }
    { const [x] = P(-17, 0); this.crate(x, -10); }
    { const [x] = P(-29, 0); this.locker('ak47', x, 0, -9, 0xff8c33); }
    { const [x] = P(-25.5, 0); this.ceilingLight(x, 3.95, -13, false); }
    { const [x] = P(-16.5, 0); this.ceilingLight(x, 3.95, -13, true); }
    // --- Rua Central ---
    { const [x] = P(-23.6, 0); this.truck(x, 2.5, m < 0); }
    { const [x] = P(-17, 0); this.jersey(x, -3.5, 3, 0.6); }
    { const [x] = P(-29, 0); this.crate(x, -4.5); this.box(x, 1.8, -4.5, 1.2, 1.2, 1.2, material('wood', 0xf2d9b3)); }
    { const [x] = P(-13.5, 0); this.box(x, 0.55, 4.5, 0.8, 1.1, 3, material('cardboard', 0xf2ffe6), { cover: true }); }
    { const [a] = P(-34, 0), [b] = P(-14, 0); this.roadLine(a, -0.1, b, -0.1, 0.12, 0xd9b833); this.roadLine(a, 0.1, b, 0.1, 0.12, 0xd9b833); }
    { const [x] = P(-12.8, 0); for (let i = 0; i < 8; i++) this.plane(x, 0.014, (i - 3.5) * 0.9, 2.5, 0.45, plain(0xd9d9d1, 0.75)); }
    { const [x] = P(-28, 0); this.lamp(x, -6.6, 0); }
    { const [x] = P(-18, 0); this.lamp(x, 6.6, Math.PI); }
    // --- Praça ---
    for (const z of [-5, 5]) { const [x] = P(-6, 0); this.box(x, 0.55, z, 3, 1.1, 1.2, material('concrete', 0xd9d1c7), { cover: true }); this.shrub(x, 1.15, z, 2.8); }
    { const [x] = P(-9, 0); this.crate(x, 0.5); }
    { const [x] = P(-7, 0); this.pallets(x, -15); this.crate(x, 15.5); }
    { const [x] = P(-10, 0); this.tree(x, -10.5); this.tree(x, 10.5, 0.9); }
    { const [x] = P(-3.5, 0); this.bench(x, -8.2, 0); this.bench(x, 8.2, Math.PI); }
    { const [x] = P(-2, 0); this.bin(x, -8.4); }
    { const [x] = P(-11, 0); this.lamp(x, -7, face); this.lamp(x, 7, face); }
    // --- Prédio Sul (reboco, 3 salas) ---
    { const [x] = P(-21, 0); this.plane(x, 0.01, 13, 22, 14, material('sidewalk')); this.plane(x, 0.02, 13, 17.7, 9.7, material('tiles')); }
    this.building(-30, -12, 8, 18, 4,
      [[-27, 1.6, 0, 2.4], [-21, 2, 1.1, 2.1], [-15, 1.4, 0, 2.3]],
      [[-27, 2, 1.1, 2.1], [-21, 1.6, 0, 2.4], [-15, 2, 1.1, 2.1]],
      [[13, 2, 1.1, 2.1]], [[11, 1.6, 0, 2.4], [15, 2, 1.1, 2.1]], material('plaster', 0xb8c4cc));
    this.wallZ(-24, 8.15, 17.85, 4, [[15, 1.4, 0, 2.3]], material('plaster', 0xdbd4c2));
    this.wallZ(-18, 8.15, 17.85, 4, [[11, 1.4, 0, 2.3]], material('plaster', 0xdbd4c2));
    { const [x] = P(-26.5, 0); this.crate(x, 16.5); }
    { const [x] = P(-15, 0); this.crate(x, 16.3); }
    { const [x] = P(-21, 0); this.box(x, 0.45, 12, 1.6, 0.9, 1.6, material('wood', 0xbfa68c), { cover: true }); }
    for (const [lx, cool] of [[-27, true], [-21, false], [-15, true]]) { const [x] = P(lx, 0); this.ceilingLight(x, 3.95, 13, cool); }
    { const [x] = P(-28.8, 0); this.bin(x, 7.3); }
    { const [x] = P(-12.6, 0); this.hydrant(x, 7.4); }
    // --- Beco sul (flanco) ---
    { const [x] = P(-33, 0); this.crate(x, 20); }
    { const [x] = P(-8, 0); this.barrel(x, 20, 0x405980); this.barrel(x - 0.7 * m, 20.5, 0x8c3326);
      this.coverSources.push({ minX: x - 1, maxX: x + 1, minY: 0, maxY: 1.2, minZ: 19.5, maxZ: 21, cover: true }); }
    { const [x] = P(-19, 0); this.dumpster(x, 20.3); }
    { const [x] = P(-26, 0); this.lamp(x, 21.4, Math.PI); }
    // --- Armazém (curta distância) ---
    const wh = material('corrugated', 0x9ea8b3);
    this.wallZ(-30, 22.15, 38, 6, [[29, 2.4, 0, 3]], wh);
    this.wallZ(-12, 22.15, 38, 6, [[25.5, 1.4, 0, 2.3], [34, 1.6, 0, 2.4]], wh);
    this.wallX(30, -29.85, -12.15, 6, [[-21, 1.6, 0, 2.4], [-26, 2, 1.1, 2.1]], wh);
    { const [x] = P(-16, 0); this.crate(x, 26); this.pallets(x, 34.5, 3); }
    { const [x] = P(-25, 0); this.crate(x, 35.5); }
    { const [x] = P(-29, 0); this.barrel(x, 31, 0x4d664d); this.barrel(x, 31.7, 0x4d664d); }
    { const [x] = P(-28.5, 0); this.locker('shotgun', x, 0, 23, 0xe64040); }
    { const [x] = P(-21, 0); this.ceilingLight(x, 5.95, 26, true); this.ceilingLight(x, 5.95, 34, true); }
    // --- Patrulha ---
    for (const [x, z] of [[-41, -30], [-41, 0], [-41, 30], [-21, -25], [-9, -27], [-25, -13], [-16, -13], [-24, -2], [-15, 1],
      [-8, -6], [-8, 6], [-27, 13], [-21, 14], [-15, 13], [-20, 20], [-24, 26], [-24, 34], [-16, 28], [-6, 30], [-34, -30], [-34, 26]])
      this.patrol.push(P(x, z));
  }

  buildSkyline() {
    const tints = [0xf2ebdb, 0xccd1d9, 0xe6ccb3, 0xb3b8b3];
    let s = 99; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const add = (x, z, sx, sz) => { const h = 14 + r() * 18; this.box(x, h / 2, z, sx, h, sz, material('facade', tints[Math.floor(r() * 4)]), { collide: false, shadow: false }); };
    for (let x = -54; x < 60; x += 12) for (const z of [-46, 46]) add(x, z, 11.5, 12);
    for (let z = -36; z < 40; z += 12) for (const x of [-56, 56]) add(x, z, 12, 11.5);
  }

  buildGroundDetails() {
    // Poças (refletem a luz), manchas de óleo e bueiros.
    const puddle = new THREE.MeshStandardMaterial({ color: 0x0a0c0e, roughness: 0.04, metalness: 0.3, transparent: true, opacity: 0.75 });
    const oil = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.3, transparent: true, opacity: 0.55 });
    const streets = [[0, -29, 34, 7], [-23, 0, 10, 6], [23, 0, 10, 6], [-41, 0, 6, 30], [41, 0, 6, 30], [0, 20, 30, 1.6]];
    let seed = 42; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) {
      const z = streets[Math.floor(r() * streets.length)];
      const x = z[0] + (r() * 2 - 1) * z[2], y = z[1] + (r() * 2 - 1) * z[3], size = 1 + r() * 2.2;
      const g = new THREE.CircleGeometry(size / 2, 20);
      g.scale(1, 0.6 + r() * 0.4, 1);
      this.addStatic(g, i % 3 === 2 ? oil : puddle, new THREE.Matrix4().makeRotationY(r() * Math.PI).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)).setPosition(x, 0.018, y), false);
    }
    const man = plain(0x3b3a38, 0.7, 0.5);
    for (const [x, z] of [[-18, -30], [18, -30], [-30, 1.5], [30, -1.5], [-41, 8], [41, -8], [4, -34]]) {
      this.addStatic(new THREE.CircleGeometry(0.45, 20), man, new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(x, 0.016, z), false);
    }
  }

  /** Mescla a geometria estática por material e cria as malhas. */
  finalize() {
    for (const { mat, geos, shadow } of this._static.values()) {
      const merged = mergeGeometries(geos.map((g) => (g.index ? g : g)), false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = shadow; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
      geos.forEach((g) => g.dispose());
    }
    this._static.clear();
  }

  // ------------------------------------------------------------ consultas
  /** Raio contra o cenário. Retorna {t, n:[x,y,z]} ou null. */
  raycast(o, d, maxDist) {
    let best = maxDist, bestN = null;
    const tmp = { n: [0, 0, 0] };
    for (const b of this.colliders) {
      const t = rayBox(o[0], o[1], o[2], d[0], d[1], d[2], b, best, tmp);
      if (t < best) { best = t; bestN = tmp.n.slice(); }
    }
    return bestN ? { t: best, n: bestN } : null;
  }

  /** Há linha de visão livre entre a e b? */
  lineOfSight(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
    if (len < 0.01) return true;
    const d = [dx / len, dy / len, dz / len];
    for (const box of this.colliders) if (rayBox(a[0], a[1], a[2], d[0], d[1], d[2], box, len, null) < len) return false;
    return true;
  }
}

/** Divide uma parede contornando portas/janelas: [[s0,s1,y0,y1],...] */
function segments(a, b, h, openings) {
  const ops = openings.slice().sort((p, q) => p[0] - q[0]);
  const out = [];
  let cur = a;
  for (const [c, w, y0, y1] of ops) {
    const o0 = c - w / 2, o1 = c + w / 2;
    if (o0 > cur + 0.01) out.push([cur, o0, 0, h]);
    if (y0 > 0.01) out.push([o0, o1, 0, y0]);
    if (y1 < h - 0.01) out.push([o0, o1, y1, h]);
    cur = o1;
  }
  if (cur < b - 0.01) out.push([cur, b, 0, h]);
  return out;
}
