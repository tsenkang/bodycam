#!/usr/bin/env node
/**
 * DEV ONLY — screenshot src/ui/bench.html (HUD over a still backplate).
 * Run through the queue: tools/snap.sh --raw node src/ui/bench.mjs --port=5305 ...
 *
 *   --bg=/shots/fxui/bg-hud.png --mm=/shots/fxui/mm-baked.png --state=combat
 *   --frames=6 --w=1280 --h=720 --out=shots/fxui/bench.png
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import net from 'node:net';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  })
);
const PORT = Number(args.port ?? 5305);
const W = Number(args.w ?? 1280);
const H = Number(args.h ?? 720);
const OUT = resolve(args.out ?? 'shots/fxui/bench.png');
const portOpen = (port) =>
  new Promise((res) => {
    const s = net.connect({ port, host: '127.0.0.1' }, () => (s.destroy(), res(true)));
    s.on('error', () => res(false));
    s.setTimeout(400, () => (s.destroy(), res(false)));
  });
const root = resolve(import.meta.dirname, '../..');
let server = null;
if (!(await portOpen(PORT))) {
  server = spawn(resolve(root, 'node_modules/.bin/vite'), ['--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await portOpen(PORT)) break;
  }
}
const browser = await chromium.launch({ headless: true, args: ['--force-color-profile=srgb', '--hide-scrollbars', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
try {
  const q = new URLSearchParams();
  for (const k of ['bg', 'mm', 'state', 'frames']) if (args[k]) q.set(k, String(args[k]));
  await page.goto(`http://127.0.0.1:${PORT}/src/ui/bench.html?${q}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__READY__ === true', null, { timeout: 120000 });
  if (args.crop) {
    const [x, y, w, h] = String(args.crop).split(',').map(Number);
    mkdirSync(dirname(OUT), { recursive: true });
    await page.screenshot({ path: OUT, clip: { x, y, width: w, height: h } });
  } else {
    mkdirSync(dirname(OUT), { recursive: true });
    await page.screenshot({ path: OUT });
  }
  console.log(JSON.stringify({ ok: true, out: OUT }));
} catch (e) {
  console.error('FAILED', e.message);
  process.exitCode = 1;
} finally {
  if (process.exitCode || args.verbose) console.error(logs.slice(-30).join('\n'));
  await browser.close();
  server?.kill();
}
