// ============================================================================
//  CONFIGURAÇÃO CENTRAL (versão navegador)
//  Todos os números de "sensação" do jogo ficam aqui. Mesmos valores do
//  projeto Godot (config/*.gd), adaptados para o navegador.
// ============================================================================

export const CAMERA = {
  fov: 88,                 // campo de visão base (graus)
  headBob: 1.0,            // multiplicador do balanço da cabeça
  sway: 1.0,               // multiplicador da inércia/balanço
  recoil: 1.0,             // multiplicador geral do recuo
  smoothing: 10,           // maior = efeitos mais rápidos
  sensitivity: 0.12,       // graus por pixel do mouse
  adsSensitivity: 0.85,
  sprintFovBoost: 4,
  maxRoll: 3,              // limite de inclinação (graus) — evita enjoo
  adsMotion: 0.3,          // quanto do movimento sobra ao mirar
  bobWalk: [0.022, 0.030, 0.45],   // lateral m, vertical m, inclinação graus
  bobSprint: [0.045, 0.055, 1.0],
  bobCrouch: [0.012, 0.016, 0.25],
  strafeTilt: 1.6,
  turnInertia: 0.010,
  turnInertiaMax: 2.2,
  turnRoll: 0.6,
  idleBreath: 0.004,
  landingImpact: 1.0,
  recoilSnap: 28,
  shakeMax: 0.6,
  viewmodelFov: 62,
  // Lente bodycam
  postfx: true,
  distortion: 0.14,
  vignette: 0.45,
  grain: 0.035,
  chromatic: 0.0015,
  saturation: 0.85,
};

export const MOVE = {
  walk: 4.3, sprint: 6.6, crouch: 2.3,
  backMult: 0.75, strafeMult: 0.9, adsMult: 0.62,
  accel: 26, decel: 30, sprintAccel: 14, airAccel: 5,
  jump: 4.8, gravity: 15.5,
  height: 1.8, crouchHeight: 1.15, radius: 0.35,
  eyeStand: 1.62, eyeCrouch: 1.02,
  stepWalk: 0.85, stepSprint: 1.25, stepCrouch: 0.65,
  weaponBobWalk: [0.010, 0.008], weaponBobSprint: [0.028, 0.020], weaponBobCrouch: [0.006, 0.005],
  weaponSway: 0.00012, weaponSwayMax: 0.035,
};

export const PLAYER = {
  maxHealth: 100, regenDelay: 5, regenRate: 30, respawnDelay: 4,
  startWeapons: ['mp4', 'glock'],
  interactDistance: 2.4,
};

export const DAMAGE_MULT = { head: 2.0, torso: 1.0, arms: 0.8, legs: 0.75 };

// ---------------------------------------------------------------------------
//  ARMAS — mesma lógica de config/weapon_config.gd
//  fireMode: auto | semi | pump | bolt
// ---------------------------------------------------------------------------
export const WEAPONS = {
  mp4: {
    name: 'MP4', slot: 1, fireMode: 'auto', damage: 25, rpm: 780, pellets: 1,
    mag: 30, reserve: 120, maxReserve: 180, reload: 2.0, reloadEmpty: 2.45, commit: 0.72,
    effRange: 20, maxRange: 150, minDmg: 0.65, accuracy: 0.8,
    hipSpread: 2.4, adsSpread: 0.35, moveSpread: 1.2, bloom: 0.3, maxBloom: 2.2, bloomRec: 7,
    recoilV: 0.75, recoilH: 0.35, recoilBias: 0.1, recoilRec: 9, carry: 0.35, adsRecoil: 0.8,
    kick: 0.028, kickRot: 2.5, shake: 0.18, adsZoom: 1.25, adsTime: 0.2, weight: 2.9,
    moveMult: 0.98, draw: 0.45, holster: 0.3, noise: 45, sight: 'iron',
    hip: [0.17, -0.19, -0.42], adsDist: 0.42, sprintRot: [-12, 38, 14],
    model: { url: 'models/mp4_m4_free.gltf.json', rotY: 180, length: 0.84, rear: 0.42, sightDrop: 0.012, offset: [0, 0, 0] },
    sound: 'mp4',
  },
  glock: {
    name: 'GL-9', slot: 2, fireMode: 'semi', damage: 21, rpm: 420, pellets: 1,
    mag: 17, reserve: 68, maxReserve: 102, reload: 1.45, reloadEmpty: 1.75, commit: 0.7,
    effRange: 14, maxRange: 100, minDmg: 0.6, accuracy: 0.85,
    hipSpread: 1.8, adsSpread: 0.3, moveSpread: 0.8, bloom: 0.45, maxBloom: 2.0, bloomRec: 8,
    recoilV: 1.1, recoilH: 0.35, recoilBias: 0, recoilRec: 12, carry: 0.2, adsRecoil: 0.85,
    kick: 0.03, kickRot: 6, shake: 0.12, adsZoom: 1.15, adsTime: 0.14, weight: 0.9,
    moveMult: 1.04, draw: 0.3, holster: 0.2, noise: 38, sight: 'iron',
    hip: [0.14, -0.16, -0.40], adsDist: 0.42, sprintRot: [22, 10, 6],
    model: { url: 'models/glock_scifi_pistol.gltf.json', rotY: -90, length: 0.22, rear: 0.3, sightDrop: 0.004, offset: [0, 0, 0] },
    sound: 'glock',
  },
  shotgun: {
    name: 'Escopeta M12', slot: 3, fireMode: 'pump', damage: 17, rpm: 70, pellets: 8, pelletSpread: 5,
    mag: 6, reserve: 30, maxReserve: 42, reload: 0.5, reloadEmpty: 0.5, commit: 0.6,
    reloadStart: 0.35, reloadEnd: 0.4, shellReload: true,
    effRange: 8, maxRange: 45, minDmg: 0.1, accuracy: 0.7,
    hipSpread: 5, adsSpread: 3.6, moveSpread: 1, bloom: 0, maxBloom: 0, bloomRec: 10,
    recoilV: 5.5, recoilH: 1.2, recoilBias: 0, recoilRec: 10, carry: 0.25, adsRecoil: 0.85,
    kick: 0.075, kickRot: 11, shake: 0.55, adsZoom: 1.15, adsTime: 0.24, weight: 3.6,
    moveMult: 0.95, draw: 0.5, holster: 0.35, noise: 50, sight: 'iron',
    hip: [0.17, -0.2, -0.44], adsDist: 0.55, sprintRot: [-14, 40, 16],
    model: { url: 'models/shotgun_escopeta.gltf.json', rotY: -90, length: 0.98, rear: 0.4, sightDrop: -0.03, offset: [0, 0, 0] },
    sound: 'shotgun',
  },
  ak47: {
    name: 'AK-47', slot: 4, fireMode: 'auto', damage: 33, rpm: 600, pellets: 1,
    mag: 30, reserve: 90, maxReserve: 150, reload: 2.4, reloadEmpty: 2.9, commit: 0.7,
    effRange: 35, maxRange: 200, minDmg: 0.75, accuracy: 0.7,
    hipSpread: 3.2, adsSpread: 0.3, moveSpread: 1.8, bloom: 0.45, maxBloom: 3, bloomRec: 5,
    recoilV: 1.3, recoilH: 0.75, recoilBias: 0.35, recoilRec: 6.5, carry: 0.55, adsRecoil: 0.85,
    kick: 0.04, kickRot: 3.5, shake: 0.3, adsZoom: 1.35, adsTime: 0.27, weight: 3.9,
    moveMult: 0.93, draw: 0.55, holster: 0.35, noise: 55, sight: 'iron', climb: true,
    hip: [0.17, -0.2, -0.44], adsDist: 0.38, sprintRot: [-14, 40, 16],
    model: { url: 'models/ak47.gltf.json', rotY: 0, length: 0.88, rear: 0.42, sightDrop: 0.025, offset: [-0.12, 0, 0], hideBones: ['Bone002_01'] },
    sound: 'ak47',
  },
  sniper: {
    name: 'Rifle SR-7', slot: 5, fireMode: 'bolt', damage: 110, rpm: 44, pellets: 1,
    mag: 5, reserve: 20, maxReserve: 30, reload: 3.0, reloadEmpty: 3.4, commit: 0.75,
    effRange: 120, maxRange: 300, minDmg: 0.9, accuracy: 1.0,
    hipSpread: 7, adsSpread: 0, moveSpread: 3, bloom: 0, maxBloom: 0, bloomRec: 5,
    recoilV: 5, recoilH: 0.8, recoilBias: 0, recoilRec: 2.6, carry: 0.3, adsRecoil: 1,
    kick: 0.08, kickRot: 9, shake: 0.6, adsZoom: 4, adsTime: 0.38, weight: 5.8,
    moveMult: 0.88, draw: 0.65, holster: 0.4, noise: 70, sight: 'scope',
    hip: [0.17, -0.2, -0.44], adsDist: 0.32, sprintRot: [-14, 42, 16],
    model: { url: 'models/sniper_sr.gltf.json', rotY: 180, length: 1.18, rear: 0.42, sightDrop: 0.03, offset: [0, 0, 0] },
    sound: 'sniper',
  },
};
export const WEAPON_ORDER = ['mp4', 'glock', 'shotgun', 'ak47', 'sniper'];

// ---------------------------------------------------------------------------
//  BOTS — dificuldade NÃO muda o dano (ver config/bot_config.gd)
// ---------------------------------------------------------------------------
export const BOT_DIFFICULTY = {
  easy: {
    label: 'Fácil', reaction: 0.85, damageReaction: 1.1, range: 30, detectTime: 1.3, fov: 95,
    hearing: 0.35, gunshots: false, aimError: 5.5, initialError: 2.2, settle: 1.6, movePenalty: 1.2,
    headshot: 0.02, burst: [2, 4], burstPause: [0.5, 1.0], turn: 130, decision: 0.6, perception: 0.3,
    cover: 0.12, flank: 0, strafe: 0.15, reposition: 0, maxChase: 12, search: 3, predict: 0,
    aggression: 0.25, callouts: false, speed: 0.9, weapons: ['mp4', 'mp4', 'glock', 'ak47'],
  },
  medium: {
    label: 'Médio', reaction: 0.45, damageReaction: 0.55, range: 42, detectTime: 0.75, fov: 110,
    hearing: 0.7, gunshots: true, aimError: 3.2, initialError: 1.8, settle: 1.0, movePenalty: 0.8,
    headshot: 0.08, burst: [3, 6], burstPause: [0.3, 0.65], turn: 220, decision: 0.4, perception: 0.2,
    cover: 0.4, flank: 0.15, strafe: 0.55, reposition: 6, maxChase: 35, search: 6, predict: 0.5,
    aggression: 0.5, callouts: true, speed: 1.0, weapons: ['mp4', 'ak47', 'ak47', 'shotgun'],
  },
  hard: {
    label: 'Difícil', reaction: 0.24, damageReaction: 0.22, range: 58, detectTime: 0.4, fov: 125,
    hearing: 1.0, gunshots: true, aimError: 1.8, initialError: 1.6, settle: 0.6, movePenalty: 0.5,
    headshot: 0.18, burst: [4, 9], burstPause: [0.15, 0.4], turn: 340, decision: 0.25, perception: 0.12,
    cover: 0.7, flank: 0.5, strafe: 0.9, reposition: 4, maxChase: 999, search: 10, predict: 1.0,
    aggression: 0.8, callouts: true, speed: 1.05, weapons: ['mp4', 'ak47', 'ak47', 'shotgun', 'sniper'],
  },
};
export const BOT = { walk: 3.0, run: 5.6, crouch: 1.8, accel: 18, damageMult: 0.85, respawnDelay: 3.5 };
export const BOT_NAMES = ['Falcão', 'Vulto', 'Ranger', 'Coruja', 'Tanque', 'Raio', 'Sombra', 'Lince',
  'Brasa', 'Cobra', 'Nômade', 'Granito', 'Eco', 'Faísca', 'Trovão', 'Cinza', 'Areia', 'Corvo'];

export const MATCH = {
  modes: { '1v1': 1, '2v2': 2, '4v4': 4, '6v6': 6, '8v8': 8 },
  scoreLimits: { 1: 15, 2: 25, 4: 40, 6: 55, 8: 70 },
  timeLimit: 600,
  spawnSafeDistance: 16,
  spawnProtection: 1.0,
  friendlyFire: false,
};

export const LIGHTING = {
  dia: {
    label: 'Dia', sunDir: [-0.45, -0.75, 0.35], sunColor: 0xfff5e6, sunIntensity: 2.6,
    sky: 0x9fb3c8, horizon: 0xb9c0c6, ground: 0x4a4640, hemi: 1.1, fog: 0xb4b9be, fogDensity: 0.006,
    exposure: 1.0, streetLights: false, interior: 0.8, flashlight: false,
  },
  entardecer: {
    label: 'Entardecer', sunDir: [-0.8, -0.42, -0.3], sunColor: 0xffa46a, sunIntensity: 2.2,
    sky: 0x3b4660, horizon: 0xc4845c, ground: 0x2a2420, hemi: 0.8, fog: 0x8c7468, fogDensity: 0.009,
    exposure: 1.05, streetLights: true, interior: 1.0, flashlight: false,
  },
  noite: {
    label: 'Noite', sunDir: [0.3, -0.7, 0.4], sunColor: 0x8ca4e0, sunIntensity: 0.25,
    sky: 0x05070d, horizon: 0x141822, ground: 0x050505, hemi: 0.18, fog: 0x0e1016, fogDensity: 0.02,
    exposure: 1.25, streetLights: true, interior: 1.0, flashlight: true,
  },
};

// Escolhas do menu (alteradas em tempo de execução).
export const SETTINGS = {
  mode: '2v2',
  difficulty: 'medium',
  time: 'entardecer',
  quality: 'media',   // baixa | media | alta
};
