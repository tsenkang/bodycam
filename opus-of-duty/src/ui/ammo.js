import { el, svg, setText, setStyle, setClass, clamp01, damp, ease } from './util.js';

function fragIcon(parent) {
  const s = svg('svg', { viewBox: '0 0 16 20', fill: 'rgba(255,255,255,.92)' }, parent);
  svg('path', { d: 'M6.4 0h3.2v2.1h1.5l1.1 2H3.8l1.1-2h1.5z' }, s);
  svg(
    'path',
    {
      d:
        'M8 4.6c3.1 0 5.6 2.9 5.6 7.1S11.1 20 8 20 2.4 15.9 2.4 11.7 4.9 4.6 8 4.6z',
    },
    s
  );
  const g = svg('g', { stroke: 'rgba(0,0,0,.5)', 'stroke-width': 0.9 }, s);
  for (const y of [9.5, 13, 16.2]) svg('line', { x1: 3, y1: y, x2: 13, y2: y }, g);
  svg('line', { x1: 8, y1: 5, x2: 8, y2: 19.6 }, g);
  return s;
}

function flashIcon(parent) {
  const s = svg('svg', { viewBox: '0 0 16 20', fill: 'rgba(255,255,255,.92)' }, parent);
  svg('path', { d: 'M6.2 0h3.6v2.4H6.2z' }, s);
  svg('path', { d: 'M4.2 3.1h7.6c.5 0 .9.4.9.9v13.4c0 1.4-1.1 2.6-2.6 2.6H5.9c-1.4 0-2.6-1.2-2.6-2.6V4c0-.5.4-.9.9-.9z' }, s);
  svg('rect', { x: 4.6, y: 6.2, width: 6.8, height: 1.2, fill: 'rgba(0,0,0,.45)' }, s);
  svg('rect', { x: 4.6, y: 9.1, width: 6.8, height: 1.2, fill: 'rgba(0,0,0,.45)' }, s);
  return s;
}

/** Three stacked rounds: the fire-mode glyph (auto = 3, burst = 2, semi = 1). */
function modeIcon(parent) {
  const s = svg('svg', { viewBox: '0 0 14 10' }, parent);
  const rounds = [];
  for (let i = 0; i < 3; i++) {
    rounds.push(svg('path', { d: `M${i * 4.6} 10V3.2c0-1.4.8-2.6 1.6-3.2.8.6 1.6 1.8 1.6 3.2V10z` }, s));
  }
  return rounds;
}

/**
 * Ammo / weapon readout, bottom right.
 *
 *    (frag) 2  |          M4A1
 *   (flash) 1  |    26   94
 *              |         ||| AUTO
 *
 * Equipment is a narrow column to the left of a hairline rule; the weapon
 * name, the magazine count (the biggest glyphs on the HUD) and the reserve sit
 * right-aligned to the safe margin. No boxes, no per-round pips: shipped
 * shooters of this generation show the count and nothing else.
 */
export class AmmoPanel {
  constructor(parent) {
    this.root = el('div', 'ow-ammo', parent);

    this.equip = el('div', 'ow-equip', this.root);
    this.slotL = el('div', 'ow-slot', this.equip);
    fragIcon(this.slotL);
    this.slotLn = el('span', null, this.slotL, '2');
    this.slotT = el('div', 'ow-slot', this.equip);
    flashIcon(this.slotT);
    this.slotTn = el('span', null, this.slotT, '1');
    el('div', 'ow-ammo-rule', this.root);

    const main = el('div', 'ow-ammo-main', this.root);
    this.name = el('div', 'ow-ammo-name', main, 'M4A1');
    const row = el('div', 'ow-ammo-row', main);
    this.cur = el('div', 'ow-ammo-cur', row, '30');
    const side = el('div', 'ow-ammo-side', row);
    this.res = el('div', 'ow-ammo-res', side, '210');
    const modeRow = el('div', 'ow-ammo-mode', side);
    this.modeRounds = modeIcon(modeRow);
    this.mode = el('span', null, modeRow, 'AUTO');

    this.reload = el('div', 'ow-reload', main, 'RELOADING');
    const bar = el('div', 'ow-reload-bar', main);
    this.reloadFill = el('i', null, bar);
    this.reloadBar = bar;

    this.punch = 0;
    this._lastAmmo = -1;
    this._lastName = null;
    this._lastMode = null;
    setStyle(this.reload, 'display', 'none');
    setStyle(this.reloadBar, 'display', 'none');
  }

  /**
   * @param {object} s { name, mode, ammo, reserve, magSize, reloading,
   *                     reloadProgress, lethal, lethalCount, tacticalCount }
   */
  update(dt, s) {
    const ammo = Math.max(0, s.ammo | 0);
    const magSize = Math.max(1, s.magSize | 0 || 30);

    if (this._lastAmmo !== ammo) {
      if (this._lastAmmo >= 0 && ammo < this._lastAmmo) this.punch = 1;
      this._lastAmmo = ammo;
      setText(this.cur, ammo);
    }
    setText(this.res, Math.max(0, s.reserve | 0));
    const name = String(s.weaponName ?? s.name ?? 'M4A1');
    if (name !== this._lastName) {
      this._lastName = name;
      setText(this.name, name);
    }
    const mode = String(s.fireMode ?? 'AUTO').toUpperCase();
    if (mode !== this._lastMode) {
      this._lastMode = mode;
      setText(this.mode, mode);
      const n = mode.startsWith('AUTO') || mode.startsWith('FULL') ? 3 : mode.startsWith('BURST') ? 2 : 1;
      for (let i = 0; i < 3; i++) this.modeRounds[i].setAttribute('opacity', i >= 3 - n ? '1' : '0.28');
    }

    this.punch = Math.max(0, this.punch - dt * 7.5);
    const p = 1 - 0.05 * ease.outQuad(this.punch);
    // 0.82 horizontal: the condensed display cut (see .ow-cx in style.js)
    setStyle(this.cur, 'transform', `scale(${(p * 0.82).toFixed(3)},${p.toFixed(3)})`);

    const frac = ammo / magSize;
    setClass(this.root, 'ow-ammo-low', ammo > 0 && frac <= 0.25);
    setClass(this.root, 'ow-ammo-empty', ammo === 0);

    const reloading = !!s.reloading;
    const reloadP = clamp01(s.reloadProgress ?? 0);

    // --- reload state -----------------------------------------------------
    setStyle(this.reload, 'display', reloading || ammo === 0 ? '' : 'none');
    setText(this.reload, reloading ? 'RELOADING' : 'RELOAD');
    if (!reloading && ammo === 0) {
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin((s.time ?? 0) * 3.8));
      setStyle(this.reload, 'opacity', pulse.toFixed(3));
    } else {
      setStyle(this.reload, 'opacity', '1');
    }
    setStyle(this.reloadBar, 'display', reloading ? '' : 'none');
    if (reloading) setStyle(this.reloadFill, 'transform', `scaleX(${reloadP.toFixed(3)})`);

    // --- equipment --------------------------------------------------------
    const lc = s.lethalCount ?? 0;
    const tc = s.tacticalCount ?? 0;
    setText(this.slotLn, lc);
    setText(this.slotTn, tc);
    setClass(this.slotL, 'empty', lc <= 0);
    setClass(this.slotT, 'empty', tc <= 0);
  }

  dispose() {
    this.root.remove();
  }
}
