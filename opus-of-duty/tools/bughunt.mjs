#!/usr/bin/env node
/**
 * Gameplay bug hunt: boots the real game and plays it through the input layer,
 * then checks every core loop a player hits in the first minutes. Each check
 * prints PASS/FAIL with the evidence. Exits 1 if anything fails.
 *
 *   node tools/bughunt.mjs [--port=5399] [--q=chromebook] [--w=480 --h=270]
 *
 * Input is injected into `engine.input` (the same queues the DOM handlers
 * feed), so it works headless without pointer lock.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import net from 'node:net';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true];
}));
const PORT = Number(args.port ?? 5399);
const Q = args.q ?? 'chromebook';
const ROOT = resolve(import.meta.dirname, '..');
// --from=N skips checks before step N (each step is numbered below).
const FROM = Number(args.from ?? 1);

const portOpen = (p) => new Promise((res) => {
  const s = net.connect({ port: p, host: '127.0.0.1' }, () => (s.destroy(), res(true)));
  s.on('error', () => res(false));
});
let server = null;
if (!(await portOpen(PORT))) {
  server = spawn(resolve(ROOT, 'node_modules/.bin/vite'), ['--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, OW_NO_HMR: '1' } });
  for (let i = 0; i < 120 && !(await portOpen(PORT)); i++) await new Promise((r) => setTimeout(r, 250));
}

const browser = await chromium.launch({
  args: [...(process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
    '--ignore-gpu-blocklist', '--mute-audio', '--disable-frame-rate-limit'],
});
const page = await browser.newPage({ viewport: { width: Number(args.w ?? 480), height: Number(args.h ?? 270) } });
page.setDefaultTimeout(1800000);
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 300)}`); });

await page.goto(`http://127.0.0.1:${PORT}/?q=${Q}`);
await page.waitForFunction('window.__READY__ === true');

// ---- helpers living in the page ------------------------------------------
await page.evaluate(() => {
  const e = window.__ENGINE__;
  const ctx = e.ctx;
  const H = (window.__HUNT__ = {});
  H.frames = (n) => new Promise((done) => {
    const f0 = e.time.frame;
    const t = () => (e.time.frame - f0 >= n ? done(e.time.frame) : requestAnimationFrame(t));
    requestAnimationFrame(t);
  });
  H.down = (code) => e.input._pendingDown.add(code);
  H.up = (code) => e.input._pendingUp.add(code);
  H.tap = async (code, n = 2) => { H.down(code); await H.frames(n); H.up(code); await H.frames(1); };
  H.player = () => ctx.peek('player');
  H.weapons = () => ctx.peek('weapons');
  H.ai = () => ctx.peek('ai');
  H.ui = () => ctx.peek('ui');
  H.events = [];
  for (const t of ['weapon:fire', 'weapon:reload', 'damage:dealt', 'damage:taken', 'actor:death', 'player:death', 'player:respawn'])
    e.events.on(t, (p) => H.events.push({ t, f: e.time.frame, killed: !!p?.killed, target: p?.target?.isPlayer ? 'player' : p?.target?.id }));
  H.count = (t, since = 0) => H.events.filter((x) => x.t === t && x.f >= since).length;
  H.aim = (target) => {
    const p = H.player(); const cam = e.camera.position;
    const dx = target.x - cam.x, dy = target.y - cam.y, dz = target.z - cam.z;
    p.movement.yaw = Math.atan2(-dx, -dz);
    p.movement.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  };
});
const hunt = (fn, arg) => page.evaluate(fn, arg);
const frames = (n) => hunt((n) => window.__HUNT__.frames(n), n);

const results = [];
const check = (name, ok, evidence) => {
  results.push({ name, ok, evidence });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(evidence)}`);
};

// Hand the player to the input layer (capture mode leaves it frozen).
await hunt(() => { const e = window.__ENGINE__; e.input.enabled = true; e.input.frozen = false; window.__HUNT__.player().setControlEnabled(true); });
await frames(5);

// 1. movement ------------------------------------------------------------
if (FROM <= 1) {
  const a = await hunt(() => window.__HUNT__.player().movement.position.toArray());
  await hunt(() => window.__HUNT__.down('KeyW'));
  await frames(40);
  await hunt(() => window.__HUNT__.up('KeyW'));
  const b = await hunt(() => window.__HUNT__.player().movement.position.toArray());
  const d = Math.hypot(b[0] - a[0], b[2] - a[2]);
  check('walk forward moves the player', d > 0.5, { metres: +d.toFixed(2) });
}

// 2. fire / ammo --------------------------------------------------------
if (FROM <= 2) {
  const before = await hunt(() => ({ mag: window.__HUNT__.weapons().state.mag, f: window.__ENGINE__.time.frame }));
  await hunt(() => window.__HUNT__.down('Mouse0'));
  await frames(20);
  await hunt(() => window.__HUNT__.up('Mouse0'));
  await frames(2);
  const after = await hunt((f) => ({ mag: window.__HUNT__.weapons().state.mag, shots: window.__HUNT__.count('weapon:fire', f), hudAmmo: document.querySelector('.ow-ammo-mag, .ow-ammo .mag, [class*=ammo] [class*=mag]')?.textContent ?? null }), before.f);
  check('holding fire shoots and spends ammo', after.shots > 0 && after.mag < before.mag, { ...after, magBefore: before.mag });
}

// 3. reload --------------------------------------------------------------
if (FROM <= 3) {
  await hunt(() => window.__HUNT__.tap('KeyR'));
  await frames(240);
  const s = await hunt(() => { const w = window.__HUNT__.weapons().state; return { mag: w.mag, magSize: w.def.magSize, reserve: w.reserve }; });
  check('reload refills the magazine', s.mag >= s.magSize - 1, s);
}

// 4. weapon switch -------------------------------------------------------
if (FROM <= 4) {
  const a = await hunt(() => window.__HUNT__.weapons().activeId);
  await hunt(() => window.__HUNT__.tap('Digit2'));
  await frames(60);
  let b = await hunt(() => window.__HUNT__.weapons().activeId);
  if (a === b) { await hunt(() => { window.__ENGINE__.input._pendingWheel += 1; }); await frames(60); b = await hunt(() => window.__HUNT__.weapons().activeId); }
  check('weapon switch changes the active weapon', a !== b, { from: a, to: b });
  await hunt(() => window.__HUNT__.tap('Digit1'));
  await frames(60);
}

// 5. ADS ------------------------------------------------------------------
if (FROM <= 5) {
  await hunt(() => window.__HUNT__.down('Mouse2'));
  await frames(40);
  const ads = await hunt(() => window.__HUNT__.weapons().adsProgress ?? window.__HUNT__.player().adsAmount);
  await hunt(() => window.__HUNT__.up('Mouse2'));
  await frames(20);
  check('right mouse aims down sights', ads > 0.5, { ads });
}

// 6. jump / crouch ---------------------------------------------------------
if (FROM <= 6) {
  const y0 = await hunt(() => window.__HUNT__.player().movement.position.y);
  await hunt(() => window.__HUNT__.down('Space'));
  let peak = y0;
  for (let i = 0; i < 12; i++) { await frames(2); peak = Math.max(peak, await hunt(() => window.__HUNT__.player().movement.position.y)); }
  await hunt(() => window.__HUNT__.up('Space'));
  await frames(60);
  check('space jumps', peak - y0 > 0.2, { rise: +(peak - y0).toFixed(2) });
  await hunt(() => window.__HUNT__.tap('KeyC', 2));
  await frames(30);
  const st = await hunt(() => window.__HUNT__.player().movement.stance);
  check('C toggles crouch', st === 'crouch', { stance: st });
  await hunt(() => window.__HUNT__.tap('KeyC', 2));
  await frames(30);
}

// 7. shoot an enemy dead ---------------------------------------------------
if (FROM <= 7) {
  const setup = await hunt(() => {
    const H = window.__HUNT__; const e = window.__ENGINE__;
    const ai = H.ai(); const ph = e.ctx.peek('physics');
    const alive = ai.agents.filter((a) => a.alive);
    if (!alive.length) return { error: 'no live enemies at start', agents: ai.agents.length };
    // stand 7 m from the first enemy on a side with clear line of sight
    for (const a of alive) {
      for (let k = 0; k < 16; k++) {
        const ang = (k / 16) * Math.PI * 2;
        const x = a.position.x + Math.cos(ang) * 7, z = a.position.z + Math.sin(ang) * 7;
        const gy = ph.groundHeight(x, z, a.position.y + 3);
        if (!Number.isFinite(gy) || Math.abs(gy - a.position.y) > 0.6) continue;
        const eye = { x, y: gy + 1.65, z };
        const chest = { x: a.position.x, y: a.position.y + 1.3, z: a.position.z };
        if (!ph.lineOfSight(eye, chest)) continue;
        H.player().teleport(new e.camera.position.constructor(x, gy + 1.65, z), 0);
        H.target = a;
        return { ok: true, id: a.id, alive: alive.length };
      }
    }
    return { error: 'no clear line of sight to any enemy', alive: alive.length };
  });
  if (setup.error) check('can find and shoot an enemy', false, setup);
  else {
    const f0 = await hunt(() => window.__ENGINE__.time.frame);
    const scoreBefore = await hunt(() => window.__HUNT__.ui().state.scoreUs);
    let dead = false;
    for (let i = 0; i < 40 && !dead; i++) {
      await hunt(() => { const H = window.__HUNT__; const a = H.target; H.aim({ x: a.position.x, y: a.position.y + 1.3, z: a.position.z }); H.down('Mouse0'); });
      await frames(6);
      await hunt(() => window.__HUNT__.up('Mouse0'));
      await frames(2);
      dead = await hunt(() => !window.__HUNT__.target.alive);
      if (!dead && i % 8 === 7) await hunt(() => window.__HUNT__.tap('KeyR')).then(() => frames(200));
    }
    const ev = await hunt((f) => ({ hits: window.__HUNT__.count('damage:dealt', f), deaths: window.__HUNT__.count('actor:death', f), score: window.__HUNT__.ui().state.scoreUs, feed: document.querySelector('.ow-killfeed')?.innerText.slice(0, 120) ?? null }), f0);
    check('shooting an enemy kills it', dead, ev);
    check('a kill raises our score', ev.score > scoreBefore, { before: scoreBefore, after: ev.score });
  }
}

// 8. enemies come back after the garrison is wiped -------------------------
if (FROM <= 8) {
  await hunt(() => {
    const ai = window.__HUNT__.ai();
    for (const a of ai.agents) if (a.alive) a.applyDamage(1000, 'head', a.position.clone(), null);
  });
  let s = null;
  for (let i = 0; i < 40; i++) {
    await frames(30);
    s = await hunt(() => ({ alive: window.__HUNT__.ai().agents.filter((a) => a.alive).length, total: window.__HUNT__.ai().agents.length, gameS: +window.__ENGINE__.time.elapsed.toFixed(1) }));
    if (s.alive > 0) break;
  }
  check('enemies respawn after all are killed', s.alive > 0, s);
}

// 9. match clock -------------------------------------------------------------
if (FROM <= 9) {
  const t0 = await hunt(() => ({ left: window.__HUNT__.ui().state.timeLeft, el: window.__ENGINE__.time.elapsed }));
  await frames(120);
  const t1 = await hunt(() => ({ left: window.__HUNT__.ui().state.timeLeft, el: window.__ENGINE__.time.elapsed }));
  check('match clock counts down', t1.left < t0.left, { before: t0.left, after: t1.left, gameSeconds: +(t1.el - t0.el).toFixed(1) });
}

// 10. dying: enemy score, death screen, respawn --------------------------------
if (FROM <= 10) {
  const them0 = await hunt(() => window.__HUNT__.ui().state.scoreThem);
  await hunt(() => window.__HUNT__.player().health.damage(1000, null));
  await frames(3);
  const shown = await hunt(() => !document.querySelector('.ow-death')?.hidden);
  await frames(330);
  const s = await hunt(() => ({ dead: window.__HUNT__.player().dead, hp: Math.round(window.__HUNT__.player().health.value), them: window.__HUNT__.ui().state.scoreThem, screen: !document.querySelector('.ow-death')?.hidden }));
  check('death screen shows', shown, { shown });
  check('player respawns with full health', !s.dead && s.hp === 100 && !s.screen, s);
  check('our death raises the enemy score', s.them > them0, { before: them0, after: s.them });
}

// 11. end of match: results screen, then a fresh match ------------------------
if (FROM <= 11) {
  await hunt(() => { window.__ENGINE__.ctx.peek('match').timeLeft = 0.5; });
  await frames(20);
  const end = await hunt(() => ({ shown: document.querySelector('.ow-match-end')?.style.display === 'flex', text: document.querySelector('.ow-match-end')?.innerText.replace(/\n/g, ' | ') }));
  check('match ends with a results screen', end.shown, end);
  let s = null;
  for (let i = 0; i < 30; i++) {
    await frames(20);
    s = await hunt(() => ({ hidden: document.querySelector('.ow-match-end')?.style.display === 'none', left: Math.round(window.__ENGINE__.ctx.peek('match').timeLeft), us: window.__HUNT__.ui().state.scoreUs, them: window.__HUNT__.ui().state.scoreThem }));
    if (s.hidden) break;
  }
  check('a new match starts after the results', s.hidden && s.left > 590 && s.us === 0 && s.them === 0, s);
}

check('no page errors during play', errors.length === 0, errors.slice(0, 8));

await browser.close();
server?.kill();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
