#!/usr/bin/env node
/**
 * LOOK probe (dev tool, not shipped). Captures shots like tools/shotset.mjs AND
 * reads the lighting numbers straight out of the HDR buffers:
 *
 *   - normal frame: exposure, world radiance percentiles, viewmodel radiance
 *   - white frame (every surface albedo-1 Lambert, no specular): irradiance
 *     per unit albedo, pi * radiance, for the world and for the viewmodel.
 *     This is the number the viewmodel lighting contract is written in.
 *
 * Always run through the capture queue:
 *   tools/snap.sh --raw node src/render/lookprobe.mjs --port=5301 \
 *       --shots=hero,weapon --out=shots/look/probe0
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import net from 'node:net';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  })
);
const PORT = Number(args.port ?? 5301);
const W = Number(args.w ?? 1280);
const H = Number(args.h ?? 720);
const SETTLE = Number(args.settle ?? 6);
const OUT = resolve(args.out ?? 'shots/look/probe');
const SHOTS = String(args.shots ?? 'hero,weapon').split(',');
const WHITE = args.white !== '0';
const ROOT = resolve(import.meta.dirname, '../..');
const TIMEOUT = 1800000;
// Extra query string, e.g. --query=q=chromebook (no leading ? or &).
const QUERY = args.query ? '&' + String(args.query).replace(/^[?&]/, '') : '';

const portOpen = (p) =>
  new Promise((res) => {
    const s = net.connect({ port: p, host: '127.0.0.1' }, () => (s.destroy(), res(true)));
    s.on('error', () => res(false));
    s.setTimeout(400, () => (s.destroy(), res(false)));
  });

let server = null;
if (!(await portOpen(PORT))) {
  server = spawn(resolve(ROOT, 'node_modules/.bin/vite'), ['--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
    env: { ...process.env, OW_NO_HMR: '1' },
  });
  for (let i = 0; i < 160; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await portOpen(PORT)) break;
  }
}

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
    '--disable-frame-rate-limit',
    '--force-color-profile=srgb',
    '--hide-scrollbars',
    '--mute-audio',
  ],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.setDefaultTimeout(TIMEOUT);
const logs = [];
page.on('console', (m) => m.type() !== 'debug' && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
mkdirSync(OUT, { recursive: true });

const fmt = (s) =>
  !s || !s.n
    ? 'n=0'
    : `n=${s.n} p10=${s.p10.toFixed(4)} p25=${s.p25.toFixed(4)} p50=${s.p50.toFixed(4)} ` +
      `p75=${s.p75.toFixed(4)} p90=${s.p90.toFixed(4)} mean=${s.mean.r.toFixed(4)}/${s.mean.g.toFixed(4)}/${s.mean.b.toFixed(4)}`;
const PI = Math.PI;
const scale = (s, k) =>
  !s || !s.n
    ? s
    : {
        ...s,
        p10: s.p10 * k,
        p25: s.p25 * k,
        p50: s.p50 * k,
        p75: s.p75 * k,
        p90: s.p90 * k,
        mean: { r: s.mean.r * k, g: s.mean.g * k, b: s.mean.b * k },
      };

const results = {};
try {
  await page.goto(`http://127.0.0.1:${PORT}/?capture=1&lockstep=1${QUERY}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  await page.waitForFunction('window.__READY__ === true', null, { timeout: TIMEOUT });
  for (const name of SHOTS) {
    await page.evaluate(({ s, settle }) => window.__APPLY_SHOT__(s, { grabFrame: settle }), { s: name, settle: SETTLE });
    const t0 = Date.now();
    await page.evaluate((n) => window.__PUMP__(n), SETTLE);
    const msPerFrame = Math.round((Date.now() - t0) / SETTLE);
    await page.evaluate(() => window.__PRESENT__(2));
    await page.screenshot({ path: `${OUT}/${name}.png`, type: 'png' });
    const normal = await page.evaluate(() => {
      const r = window.__ENGINE__.ctx.get('render');
      return { ex: r.debugExposure(), world: r.probeWorldStats(), view: r.probeViewStats(), sun: r.activeSun.intensity };
    });
    let white = null;
    if (WHITE) {
      await page.evaluate(() => (window.__ENGINE__.ctx.get('render').debugWhite = true));
      await page.evaluate((n) => window.__PUMP__(n), 2);
      white = await page.evaluate(() => {
        const r = window.__ENGINE__.ctx.get('render');
        return { world: r.probeWorldStats(1e-5), view: r.probeViewStats() };
      });
      await page.evaluate(() => (window.__ENGINE__.ctx.get('render').debugWhite = false));
    }
    results[name] = { msPerFrame, normal, white };
    console.log(`\n== ${name}  ${msPerFrame} ms/frame  sun=${normal.sun.toFixed(3)}  ev100=${normal.ex.ev100.toFixed(2)} exposure=${normal.ex.exposure.toFixed(4)}`);
    console.log(`   radiance world  ${fmt(normal.world)}`);
    console.log(`   radiance view   ${fmt(normal.view)}`);
    if (white) {
      console.log(`   E/albedo world  ${fmt(scale(white.world, PI))}`);
      console.log(`   E/albedo view   ${fmt(scale(white.view, PI))}`);
      if (white.view?.n && white.world?.n) {
        console.log(
          `   view/world irradiance: vs world p50 ${(white.view.p50 / white.world.p50).toFixed(2)}x, ` +
            `vs world p90 (sunlit) ${(white.view.p50 / white.world.p90).toFixed(2)}x, vs p10 (shade) ${(white.view.p50 / white.world.p10).toFixed(2)}x`
        );
      }
    }
  }
} catch (e) {
  console.log('FATAL', e.message);
} finally {
  const errs = logs.filter((l) => l.startsWith('[pageerror]') || l.startsWith('[error]'));
  if (errs.length) console.log('\nERRORS:\n' + errs.slice(0, 20).join('\n'));
  writeFileSync(`${OUT}/probe.json`, JSON.stringify({ results, logs: logs.filter((l) => /\[render\]|\[sky\]|error/i.test(l)).slice(-60) }, null, 2));
  await browser.close();
  if (server) server.kill();
}
