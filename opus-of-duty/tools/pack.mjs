#!/usr/bin/env node
/**
 * Package the game as single self-contained HTML files that open straight from
 * disk (double-click, no server), one per target:
 *
 *   opus-of-duty.html             ultra preset (the AAA build)
 *   opus-of-duty-chromebook.html  chromebook preset (integrated GPUs)
 *
 * Both come from the same source; the only difference is the default preset,
 * passed through `window.__OOD_QUALITY__`. `?q=<preset>` still overrides it.
 *
 *   node tools/pack.mjs [--out=dir]
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true];
}));
const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(args.out ?? ROOT);

const build = mkdtempSync(join(tmpdir(), 'ood-pack-'));
execFileSync(join(ROOT, 'node_modules/.bin/vite'),
  ['build', '--base=./', `--outDir=${build}`, '--sourcemap=false', '--emptyOutDir'],
  { cwd: ROOT, stdio: 'inherit' });
const jsFile = readdirSync(join(build, 'assets')).find((f) => f.endsWith('.js'));
// An inline module script ends at the first "</script", wherever it appears.
const js = readFileSync(join(build, 'assets', jsFile), 'utf8').replaceAll('</script', '<\\/script');
rmSync(build, { recursive: true, force: true });

/**
 * Boot shell: a loading line, and any error (thrown, rejected, or a lost WebGL
 * context) printed on screen. Without it a failed boot is a silent black page,
 * since the HUD is plain DOM and shows up even when the 3D never draws.
 */
const shell = (quality, label) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Opus of Duty${label ? ` — ${label}` : ''}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#000;color:#e8ecef;font-family:"Helvetica Neue",Arial,sans-serif}
#game{display:block;width:100vw;height:100vh;touch-action:none;cursor:none}
#ood-boot{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9998;font:600 15px/1.5 "Helvetica Neue",Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#c9d1d6;text-align:center;pointer-events:none}
#ood-boot small{display:block;font-weight:400;letter-spacing:0;text-transform:none;color:#7f8a91;margin-top:6px}
#ood-err{position:fixed;inset:0;z-index:9999;padding:24px;background:#0b0b0b;color:#ff8a80;font:13px/1.5 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;overflow:auto}
</style>
<script>
window.__OOD_QUALITY__ = ${JSON.stringify(quality)};
(function () {
  function show(msg) {
    var e = document.getElementById('ood-err');
    if (!e) { e = document.createElement('pre'); e.id = 'ood-err'; document.body.appendChild(e);
      e.textContent = 'O jogo encontrou um erro. Mande um print desta tela.\\n\\n'; }
    e.textContent += msg + '\\n\\n';
  }
  window.addEventListener('error', function (ev) { show(ev.error && ev.error.stack || ev.message); });
  window.addEventListener('unhandledrejection', function (ev) { show(ev.reason && ev.reason.stack || String(ev.reason)); });
  document.addEventListener('DOMContentLoaded', function () {
    var c = document.getElementById('game');
    c.addEventListener('webglcontextlost', function () {
      show('A placa de vídeo perdeu o contexto WebGL (memória insuficiente ou driver). Tente a versão Chromebook, feche outras abas e recarregue.');
    });
    var t0 = Date.now(), boot = document.getElementById('ood-boot');
    (function tick() {
      if (window.__READY__) { boot.remove(); return; }
      boot.querySelector('small').textContent = 'gerando texturas e shaders · ' + Math.round((Date.now() - t0) / 1000) + ' s';
      setTimeout(tick, 500);
    })();
  });
})();
</script>
</head><body><canvas id="game"></canvas><div id="ui"></div>
<div id="ood-boot">Carregando<small>gerando texturas e shaders</small></div>
<script type="module">
${js}
</script></body></html>`;

const targets = [
  ['opus-of-duty.html', 'ultra', ''],
  ['opus-of-duty-chromebook.html', 'chromebook', 'Chromebook'],
];
for (const [file, quality, label] of targets) {
  writeFileSync(join(OUT, file), shell(quality, label));
  console.log(`${join(OUT, file)}  (${quality})`);
}
