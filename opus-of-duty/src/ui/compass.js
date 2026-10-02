import { el, svg, setText, setStyle, clamp, Pool, mmss } from './util.js';

const SPAN_DEG = 150; // degrees visible across the strip
const STRIP_W = 560; // css px at k=1, must match .ow-compass width
const PPD = STRIP_W / SPAN_DEG;
const CARD = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };

/**
 * Heading strip, top centre.
 *
 * Ticks are laid out once across two full revolutions (0-720deg) with left
 * positions written as `calc(Npx * var(--k))`, so a resolution change re-scales
 * the whole strip with zero JS work. Only the strip's translateX is touched
 * per frame — one style write for 144 ticks.
 */
export class Compass {
  constructor(parent) {
    this.root = el('div', 'ow-compass', parent);
    this.strip = el('div', 'ow-compass-strip', this.root);
    el('div', 'ow-compass-base', this.root);
    el('div', 'ow-compass-caret', this.root);
    this.hdgWrap = el('div', 'ow-compass-hdg', parent);
    this.hdg = el('span', null, this.hdgWrap, '0');
    // the tape's labels are hidden where the live heading sits
    this.gap = el('div', 'ow-compass-gap', this.root);

    for (let a = 0; a < 720; a += 5) {
      const t = el('div', 'ow-tick' + (a % 15 === 0 ? ' maj' : ''), this.strip);
      t.style.left = `calc(${(a * PPD).toFixed(2)}px * var(--k))`;
      const c = CARD[a % 360];
      if (c) {
        const l = el('div', 'ow-tick-l' + (c.length > 1 ? ' sub' : ''), this.strip, c);
        l.style.left = `calc(${(a * PPD).toFixed(2)}px * var(--k))`;
      } else if (a % 15 === 0) {
        const l = el('div', 'ow-tick-l num', this.strip, String(a % 360));
        l.style.left = `calc(${(a * PPD).toFixed(2)}px * var(--k))`;
      }
    }
    setStyle(this.strip, 'width', `calc(${(720 * PPD).toFixed(0)}px * var(--k))`);

    this.objPool = new Pool(
      5,
      () => el('div', 'ow-compass-obj'),
      this.root
    );

    this.k = 1;
    this._heading = 0;
  }

  /**
   * @param {number} heading degrees, 0 = north, clockwise
   * @param {Array} objectives [{ bearing:deg, label:'A', color }]
   */
  update(heading, objectives) {
    this.k = this.k || 1;
    const k = this.k;
    const h = ((heading % 360) + 360) % 360;
    this._heading = h;
    const x = STRIP_W * 0.5 * k - (h + 360) * PPD * k;
    setStyle(this.strip, 'transform', `translateX(${x.toFixed(2)}px)`);
    setText(this.hdg, Math.round(h) % 360);

    const half = STRIP_W * 0.5 * k;
    const items = this.objPool.items;
    let n = 0;
    if (objectives) {
      for (let i = 0; i < objectives.length && n < items.length; i++) {
        const o = objectives[i];
        let rel = o.bearing - h;
        while (rel > 180) rel -= 360;
        while (rel < -180) rel += 360;
        const it = items[n++];
        if (!it.alive) {
          it.alive = true;
          setStyle(it.node, 'display', '');
        }
        const px = clamp(rel * PPD * k, -half + 8 * k, half - 8 * k);
        setText(it.node, o.label ?? '');
        setStyle(it.node, 'left', '50%');
        setStyle(it.node, 'transform', `translateX(calc(-50% + ${px.toFixed(1)}px))`);
        setStyle(it.node, 'background', o.color ?? 'var(--cyan)');
        setStyle(it.node, 'opacity', Math.abs(rel) > SPAN_DEG * 0.5 ? '0.45' : '1');
      }
    }
    for (let i = n; i < items.length; i++) {
      if (items[i].alive) {
        items[i].alive = false;
        setStyle(items[i].node, 'display', 'none');
      }
    }
  }

  setScale(k) {
    this.k = k;
  }

  dispose() {
    this.root.remove();
    this.hdgWrap.remove();
  }
}

/**
 * Team score, bottom left (the TDM layout of the reference HUD): a faction
 * emblem, our score over theirs, and the round clock under the emblem. The
 * emblem is an original shield-and-chevron mark drawn here.
 */
export class MatchBar {
  constructor(parent) {
    this.root = el('div', 'ow-score', parent);
    const em = el('div', 'ow-sc-emblem', this.root);
    const g = svg('svg', { viewBox: '0 0 40 44' }, em);
    svg('path', { d: 'M20 1l17 6v13c0 11-7 18-17 23C10 38 3 31 3 20V7z', fill: 'rgba(70,96,118,.9)', stroke: 'rgba(225,235,242,.9)', 'stroke-width': 1.6 }, g);
    svg('path', { d: 'M9 16l11 7 11-7v5l-11 7-11-7zM9 24l11 7 11-7v5l-11 7-11-7z', fill: 'rgba(236,242,246,.95)' }, g);
    svg('circle', { cx: 20, cy: 10.5, r: 2.6, fill: 'rgba(236,242,246,.95)' }, g);
    const nums = el('div', 'ow-sc-nums', this.root);
    const row = (cls) => {
      const r = el('div', 'ow-sc-row ' + cls, nums);
      const n = el('b', cls, r, '0');
      const track = el('i', 'ow-sc-track', r);
      const fill = el('i', 'ow-sc-fill', track);
      return { n, fill };
    };
    const us = row('us');
    const them = row('them');
    this.us = us.n;
    this.them = them.n;
    this.usFill = us.fill;
    this.themFill = them.fill;
    this.clock = el('div', 'ow-sc-clock', this.root, '4:12');
    this.mode = null;
    this.limit = 50; // src/match SCORE_LIMIT
  }

  update(s) {
    const a = s.scoreUs ?? 0;
    const b = s.scoreThem ?? 0;
    const lim = s.scoreLimit ?? this.limit;
    setText(this.us, a);
    setText(this.them, b);
    setStyle(this.usFill, 'transform', `scaleX(${clamp(a / lim, 0, 1).toFixed(3)})`);
    setStyle(this.themFill, 'transform', `scaleX(${clamp(b / lim, 0, 1).toFixed(3)})`);
    setText(this.clock, mmss(s.timeLeft ?? 0));
  }

  dispose() {
    this.root.remove();
  }
}
