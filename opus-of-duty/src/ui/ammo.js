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

/** Side silhouette of a carbine, drawn for this HUD (original geometry). */
function weaponIcon(parent) {
  const s = svg('svg', { viewBox: '0 0 120 40', fill: 'rgba(240,244,246,.92)' }, parent);
  svg('path', {
    d:
      'M2 14h14l3-2h20l2-3h22l1 2h18v3h22l2 1v3h-2v2h-8v-1H86l-2 2H70l-3 3h-6l-1 3' +
      'c-1 4-2 9-1 14h-9c-1-4 0-9 1-13l-2-1H41l-2 3-4 0 1-3h-4l-3 4H16l-2-6H2z',
  }, s);
  // ejection port / rail detail cut back out of the receiver
  svg('rect', { x: 44, y: 14, width: 9, height: 3, fill: 'rgba(0,0,0,.45)' }, s);
  svg('rect', { x: 64, y: 9.5, width: 20, height: 1.4, fill: 'rgba(0,0,0,.35)' }, s);
  // magazine
  svg('path', { d: 'M49 22h9l1 9c0 3-1 5-2 7h-7c1-3 1-6 0-9z', fill: 'rgba(240,244,246,.92)' }, s);
  return s;
}

/**
 * Ammo / weapon readout, bottom right, in the shipped layout of this genre:
 *
 *       M4A1
 *   [ weapon silhouette ]   26     (frag) 2  (flash) 1
 *        Auto                94
 *
 * The magazine count is the biggest glyph run on the HUD; the reserve sits
 * under it at half size. No plates, no boxes, no per-round pips.
 */
export class AmmoPanel {
  constructor(parent) {
    this.root = el('div', 'ow-ammo', parent);

    const wpn = el('div', 'ow-ammo-wpn', this.root);
    this.name = el('div', 'ow-ammo-name', wpn, 'M4A1');
    weaponIcon(wpn);
    const modeRow = el('div', 'ow-ammo-mode', wpn);
    this.mode = el('span', null, modeRow, 'Auto');

    const nums = el('div', 'ow-ammo-nums', this.root);
    this.cur = el('div', 'ow-ammo-cur', nums, '30');
    const resRow = el('div', 'ow-ammo-resrow', nums);
    const magI = svg('svg', { viewBox: '0 0 8 12', fill: 'rgba(226,232,236,.7)' }, resRow);
    svg('path', { d: 'M1 0h6v3l1 9H0l1-9z' }, magI);
    this.res = el('div', 'ow-ammo-res', resRow, '210');

    this.equip = el('div', 'ow-equip', this.root);
    this.slotL = el('div', 'ow-slot', this.equip);
    fragIcon(this.slotL);
    this.slotLn = el('span', null, this.slotL, '2');
    this.slotT = el('div', 'ow-slot', this.equip);
    flashIcon(this.slotT);
    this.slotTn = el('span', null, this.slotT, '1');

    this.reload = el('div', 'ow-reload', this.root, 'RELOADING');
    const bar = el('div', 'ow-reload-bar', this.root);
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
    const mode = String(s.fireMode ?? 'AUTO');
    if (mode !== this._lastMode) {
      this._lastMode = mode;
      setText(this.mode, mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase());
    }

    this.punch = Math.max(0, this.punch - dt * 7.5);
    const p = 1 - 0.05 * ease.outQuad(this.punch);
    // the display face is natively condensed: no horizontal squash needed
    setStyle(this.cur, 'transform', `scale(${p.toFixed(3)})`);

    const frac = ammo / magSize;
    setClass(this.root, 'ow-ammo-low', ammo > 0 && frac <= 0.25);
    setClass(this.root, 'ow-ammo-empty', ammo === 0);

    const reloading = !!s.reloading;
    const reloadP = clamp01(s.reloadProgress ?? 0);

    // --- reload state -----------------------------------------------------
    setStyle(this.reload, 'display', reloading || ammo === 0 ? '' : 'none');
    setText(this.reload, reloading ? 'Reloading' : 'Reload');
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
