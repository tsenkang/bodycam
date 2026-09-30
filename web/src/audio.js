// Áudio 100% gerado por código (WebAudio). Sem arquivos externos.
import { rand } from './util.js?v=7';

let ctx = null, master = null, sfx = null, ambientGain = null;
const buffers = {};
const listener = { x: 0, y: 0, z: 0 };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  sfx = ctx.createGain(); sfx.connect(master);
  ambientGain = ctx.createGain(); ambientGain.gain.value = 0.18; ambientGain.connect(master);
  build();
}

function buf(len, fn) {
  const n = Math.floor(len * ctx.sampleRate), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  let state = { lp: 0, brown: 0 };
  for (let i = 0; i < n; i++) d[i] = fn(i / ctx.sampleRate, state);
  return b;
}
const noise = () => Math.random() * 2 - 1;

function gunshot(len, freq, decay, bright, tail) {
  return buf(len, (t, s) => {
    const n = noise();
    s.lp += (n - s.lp) * (0.15 + 0.5 * bright);
    const crack = (s.lp + (n - s.lp) * bright * 0.5) * Math.exp(-t * decay * 1.6);
    const boom = Math.sin(2 * Math.PI * freq * t * (1 - t * 0.8)) * Math.exp(-t * decay * 0.7);
    return (crack * 0.8 + boom * 0.9 + s.lp * tail * Math.exp(-t * 4) * 0.4) * 0.85;
  });
}
function clicks(times, len, freq = 1600) {
  const b = buf(len, () => 0), d = b.getChannelData(0), sr = ctx.sampleRate;
  for (const st of times) {
    const f = freq * rand(0.8, 1.2), s0 = Math.floor(st * sr);
    for (let j = 0; j < 0.035 * sr && s0 + j < d.length; j++) {
      const t = j / sr; d[s0 + j] += (noise() * 0.6 + Math.sin(2 * Math.PI * f * t) * 0.5) * Math.exp(-t * 120) * 0.7;
    }
  }
  return b;
}
const thud = (len, f, n) => buf(len, (t, s) => { s.lp += (noise() - s.lp) * 0.08; return (Math.sin(2 * Math.PI * f * t) * 0.7 + s.lp * n * 3) * Math.exp(-t * 30); });
const tone = (len, f, v) => buf(len, (t) => Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 40) * v);

function build() {
  buffers.mp4 = gunshot(0.28, 150, 22, 0.75, 0.25);
  buffers.glock = gunshot(0.22, 190, 26, 0.85, 0.18);
  buffers.shotgun = gunshot(0.6, 75, 9, 0.55, 0.45);
  buffers.ak47 = gunshot(0.35, 110, 16, 0.65, 0.35);
  buffers.sniper = gunshot(0.95, 62, 7, 0.6, 0.6);
  buffers.reload = clicks([0, 0.08, 0.55, 0.62, 1.2], 1.4);
  buffers.shell = clicks([0, 0.06], 0.25);
  buffers.pump = clicks([0, 0.18], 0.35, 900);
  buffers.bolt = clicks([0, 0.2, 0.42], 0.6, 1200);
  buffers.draw = buf(0.25, (t, s) => { s.lp += (noise() - s.lp) * 0.25; return s.lp * Math.sin(Math.PI * t / 0.25) * 0.35; });
  buffers.empty = clicks([0], 0.08, 3000);
  buffers.step = thud(0.11, 90, 0.35);
  buffers.land = thud(0.2, 70, 0.5);
  buffers.impact = buf(0.09, (t) => noise() * 0.9 * Math.exp(-t * 55) * 0.6);
  buffers.flesh = thud(0.1, 140, 0.2);
  buffers.hit = tone(0.05, 2400, 0.35);
  buffers.kill = tone(0.09, 1800, 0.45);
  buffers.pickup = buf(0.18, (t) => Math.sin(2 * Math.PI * (t < 0.08 ? 880 : 1320) * t) * 0.3 * Math.exp(-(t % 0.08) * 20));
  // Ambiente: ruído marrom lento (vento / cidade distante), em loop.
  buffers.ambient = buf(6, (t, s) => { s.brown = Math.max(-1, Math.min(1, s.brown + noise() * 0.02)) * 0.998; return s.brown * (0.6 + 0.4 * Math.sin(2 * Math.PI * t / 6)) * 0.8; });
}

export function setListener(x, y, z, yaw) { listener.x = x; listener.y = y; listener.z = z; listener.yaw = yaw; }

/** Toca um som. pos = [x,y,z] para som posicional (atenuação + pan simples). */
export function play(name, { pos = null, volume = 1, pitch = 0.05, maxDist = 90 } = {}) {
  if (!ctx || !buffers[name]) return;
  let gain = volume, pan = 0;
  if (pos) {
    const dx = pos[0] - listener.x, dy = pos[1] - listener.y, dz = pos[2] - listener.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > maxDist) return;
    gain *= 1 / (1 + d / 6);
    // pan pela direção relativa ao olhar
    const yaw = listener.yaw || 0;
    const rx = Math.cos(yaw), rz = -Math.sin(yaw); // vetor "direita" do jogador
    pan = d > 0.5 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) * 0.8 : 0;
  }
  if (gain < 0.01) return;
  const src = ctx.createBufferSource();
  src.buffer = buffers[name];
  src.playbackRate.value = 1 + rand(-pitch, pitch);
  const g = ctx.createGain(); g.gain.value = gain;
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) { p.pan.value = pan; src.connect(g).connect(p).connect(sfx); } else src.connect(g).connect(sfx);
  src.start();
}

let ambientSrc = null;
export function startAmbient() {
  if (!ctx || ambientSrc) return;
  ambientSrc = ctx.createBufferSource(); ambientSrc.buffer = buffers.ambient; ambientSrc.loop = true;
  ambientSrc.connect(ambientGain); ambientSrc.start();
}
export function stopAmbient() { if (ambientSrc) { ambientSrc.stop(); ambientSrc = null; } }
