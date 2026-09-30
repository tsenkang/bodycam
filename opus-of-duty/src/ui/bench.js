/**
 * DEV ONLY — the HUD on a still backplate, no WebGL game boot.
 *
 * `src/ui/preview.mjs --bgout=... --mmout=...` writes a HUD-free game frame and
 * the baked minimap; this page lays the live HUD over them in ~1 s instead of
 * the ~4 min full boot. Driven by src/ui/bench.mjs.
 *
 *   ?bg=/shots/fxui/bg-hud.png&mm=/shots/fxui/mm-baked.png&state=combat&frames=90
 */
import * as THREE from 'three';
import { Rng } from '../core/rng.js';
import { UiSystem } from './index.js';

const params = new URLSearchParams(location.search);
const bg = document.getElementById('bg');
if (params.get('bg')) bg.src = params.get('bg');

const canvas = document.getElementById('c');
const camera = new THREE.PerspectiveCamera(80, innerWidth / innerHeight, 0.05, 500);
camera.position.set(12, 1.75, 18);
camera.lookAt(-4, 2.2, -6);
camera.updateMatrixWorld();

const listeners = new Map();
const events = {
  on(t, fn) {
    if (!listeners.has(t)) listeners.set(t, new Set());
    listeners.get(t).add(fn);
    return () => listeners.get(t)?.delete(fn);
  },
  emit(t, p) {
    for (const fn of listeners.get(t) ?? []) fn(p);
  },
};
const time = { elapsed: 16.5, raw: 0, dt: 1 / 60, fixed: 1 / 120, alpha: 0, scale: 1, frame: 0 };
const ctx = {
  scene: new THREE.Scene(),
  camera,
  canvas,
  config: { fov: 80, sensitivity: 1, invertY: false, setQuality() {}, q: {} },
  events,
  input: { enabled: false, frozen: true, pointerLocked: false, ads: false, actionPressed: () => false },
  time,
  rng: new Rng(0x5305),
  get: (id) => systems[id] ?? null,
  peek: (id) => systems[id] ?? null,
  has: (id) => !!systems[id],
};
const systems = {};
const ui = new UiSystem();
await ui.init(ctx);
systems.ui = ui;
window.__UI__ = ui;

const loadImg = (src) =>
  new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
if (params.get('mm')) {
  const img = await loadImg(params.get('mm'));
  if (img) {
    const cv = document.createElement('canvas');
    cv.width = img.width;
    cv.height = img.height;
    cv.getContext('2d').drawImage(img, 0, 0);
    ui.minimap.baked = cv;
    ui.minimap.bakeDone = true;
  }
}
if (bg.src && !bg.complete) await new Promise((r) => (bg.onload = bg.onerror = r));

ui.debugState(params.get('state') ?? 'combat');
const FRAMES = Number(params.get('frames') ?? 6);
for (let i = 0; i < FRAMES; i++) {
  time.frame++;
  time.elapsed += time.dt;
  time.raw += time.dt;
  ui.lateUpdate(time.dt, ctx);
}
requestAnimationFrame(() => requestAnimationFrame(() => (window.__READY__ = true)));
