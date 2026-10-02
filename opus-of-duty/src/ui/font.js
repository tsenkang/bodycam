/**
 * Procedural HUD typeface.
 *
 * No font files ship with the game, and the capture machine (like most Linux
 * boxes) resolves every "condensed" family in the stack to Liberation Sans, an
 * Arial clone. That generic grotesque was the single loudest HUD tell. So the
 * face is generated here, at load time, as a real TrueType binary handed to
 * `new FontFace()`:
 *
 *   - glyphs are monoline skeletons (polylines and rounded-rect arcs) on a
 *     condensed industrial grid, in the DIN / stencil-signage family that
 *     military shooters' HUDs are drawn from;
 *   - each skeleton is stroked into filled contours with mitred joins and
 *     per-end caps (square, or cut flat on the baseline / cap line for
 *     diagonals), overlapping contours unioned by the non-zero fill rule;
 *   - lowercase maps to small caps, digits are tabular.
 *
 * Three weights (400/600/700) are the same skeletons at three stroke widths,
 * so the cap height, numerals and spacing never drift between weights.
 * Vertical metrics match Liberation Sans so the existing layout does not move.
 */

const UPM = 1000;
const CAP = 716;
const SMALL = 556; // small-cap height
const ASC = 905;
const DESC = 212;

/* ======================================================================== */
/*  geometry                                                                 */
/* ======================================================================== */

const D2R = Math.PI / 180;

/**
 * Points around a rounded rectangle, CCW by angle, from a0 to a1 degrees
 * (a1 > a0). Corner radii per quadrant: [TR, TL, BL, BR]; 0 = sharp.
 */
function rrArc(l, b, r, t, rad, a0, a1, step = 7.5) {
  const R = Array.isArray(rad) ? rad : [rad, rad, rad, rad];
  const out = [];
  const pt = (a) => {
    const aa = ((a % 360) + 360) % 360;
    const q = aa >= 360 - 1e-9 ? 0 : Math.floor(aa / 90 + 1e-9) % 4;
    const rr = R[q];
    const cx = q === 0 || q === 3 ? r - rr : l + rr;
    const cy = q === 0 || q === 1 ? t - rr : b + rr;
    if (rr <= 0) return [cx, cy];
    return [cx + Math.cos(a * D2R) * rr, cy + Math.sin(a * D2R) * rr];
  };
  // quadrant boundaries need both neighbours' points
  let a = a0;
  out.push(pt(a));
  while (a < a1 - 1e-9) {
    const nextB = (Math.floor(a / 90 + 1e-9) + 1) * 90;
    const na = Math.min(a1, a + step, nextB);
    if (Math.abs(na - nextB) < 1e-9) {
      out.push(pt(na - 1e-6));
      if (na < a1 - 1e-9) out.push(pt(na + 1e-6));
    } else out.push(pt(na));
    a = na;
  }
  return dedupe(out);
}

/** Same walk, clockwise (a0 > a1). */
function rrArcCW(l, b, r, t, rad, a0, a1, step) {
  return rrArc(l, b, r, t, rad, a1, a0, step).reverse();
}

function dedupe(pts) {
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.5) out.push(p);
  }
  return out;
}

function area(c) {
  let s = 0;
  for (let i = 0; i < c.length; i++) {
    const a = c[i];
    const b = c[(i + 1) % c.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s * 0.5;
}

/**
 * Stroke a skeleton into closed contours.
 * @param {number[][]} pts
 * @param {object} o { closed, w, cap0, cap1 }  caps: 'sq' | 'butt' | 'h' | 'v'
 */
function strokeContours(ptsIn, o) {
  const pts = dedupe(ptsIn);
  const h = o.w / 2;
  const closed = !!o.closed;
  if (closed && pts.length > 2) {
    const f = pts[0];
    const l = pts[pts.length - 1];
    if (Math.hypot(f[0] - l[0], f[1] - l[1]) < 0.5) pts.pop();
  }
  const n = pts.length;
  if (n < 2) return [];
  const segs = closed ? n : n - 1;
  const dir = [];
  for (let i = 0; i < segs; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    dir.push([(b[0] - a[0]) / L, (b[1] - a[1]) / L]);
  }
  const nrm = dir.map((d) => [-d[1], d[0]]);
  const LIMIT = 2.2;

  /** offset point(s) at vertex i on side s (+1 left, -1 right) */
  const joint = (i, s, outL) => {
    const p = pts[i];
    const d0 = dir[(i - 1 + segs) % segs];
    const d1 = dir[i % segs];
    const n0 = nrm[(i - 1 + segs) % segs];
    const n1 = nrm[i % segs];
    let mx = n0[0] + n1[0];
    let my = n0[1] + n1[1];
    const ml = Math.hypot(mx, my);
    if (ml < 1e-6) {
      outL.push([p[0] + n1[0] * h * s, p[1] + n1[1] * h * s]);
      return;
    }
    mx /= ml;
    my /= ml;
    const cosHalf = mx * n1[0] + my * n1[1];
    const len = h / Math.max(cosHalf, 1e-3);
    const cross = d0[0] * d1[1] - d0[1] * d1[0]; // >0: left turn
    const outer = cross * s < 0; // this side is the outside of the turn
    if (outer && len > LIMIT * h) {
      outL.push([p[0] + n0[0] * h * s, p[1] + n0[1] * h * s]);
      outL.push([p[0] + n1[0] * h * s, p[1] + n1[1] * h * s]);
    } else {
      const ll = Math.min(len, 6 * h);
      outL.push([p[0] + mx * ll * s, p[1] + my * ll * s]);
    }
  };

  const capPoint = (i, s, end) => {
    const p = pts[i];
    const k = end ? segs - 1 : 0;
    const d = dir[k];
    const nn = nrm[k];
    const cap = end ? o.cap1 ?? 'sq' : o.cap0 ?? 'sq';
    let x = p[0] + nn[0] * h * s;
    let y = p[1] + nn[1] * h * s;
    const sgn = end ? 1 : -1;
    if (cap === 'sq') {
      x += d[0] * h * sgn;
      y += d[1] * h * sgn;
    } else if (cap === 'h' && Math.abs(d[1]) > 1e-3) {
      const u = (p[1] - y) / d[1];
      x += d[0] * u;
      y = p[1];
    } else if (cap === 'v' && Math.abs(d[0]) > 1e-3) {
      const u = (p[0] - x) / d[0];
      y += d[1] * u;
      x = p[0];
    }
    return [x, y];
  };

  if (closed) {
    const L = [];
    const R = [];
    for (let i = 0; i < n; i++) {
      joint(i, 1, L);
      joint(i, -1, R);
    }
    const aL = area(L);
    const aR = area(R);
    const outer = Math.abs(aL) > Math.abs(aR) ? L : R;
    const inner = outer === L ? R : L;
    if (area(outer) > 0) outer.reverse(); // outer clockwise (negative area)
    if (area(inner) < 0) inner.reverse(); // hole counter-clockwise
    return [outer, inner];
  }
  const L = [capPoint(0, 1, false)];
  const R = [capPoint(0, -1, false)];
  for (let i = 1; i < n - 1; i++) {
    joint(i, 1, L);
    joint(i, -1, R);
  }
  L.push(capPoint(n - 1, 1, true));
  R.push(capPoint(n - 1, -1, true));
  const c = L.concat(R.reverse());
  if (area(c) > 0) c.reverse();
  return [c];
}

/* ======================================================================== */
/*  glyph skeletons                                                          */
/* ======================================================================== */

/**
 * Each glyph: { adv, draw(g) } where g = { l, r, b, t, m, cx, w, H, path(),
 * loop(), ... } in stroke-centre coordinates. `adv` is in units of the
 * caps advance (1 = a normal capital).
 */
function glyphTable() {
  const G = {};
  const def = (ch, adv, draw) => (G[ch] = { adv, draw });

  // ---- digits (tabular) ----
  def('0', 1, (g) => g.loop(rrArc(g.l, g.b, g.r, g.t, g.R, 0, 360)));
  def('1', 1, (g) => {
    const x = g.cx + g.wd * 0.12;
    g.path([[x - g.wd * 0.36, g.t - g.H * 0.2], [x, g.t + g.w * 0.02], [x, g.b]], 'sq', 'sq');
  });
  def('2', 1, (g) => {
    const Rt = Math.min(g.R, (g.t - g.b) * 0.3);
    const top = rrArcCW(g.l, g.t - 2 * Rt, g.r, g.t, Rt, 168, -18);
    g.path([...top, [g.l, g.b], [g.r, g.b]], 'sq', 'sq');
  });
  def('3', 1, (g) => {
    const ym = g.b + (g.t - g.b) * 0.56;
    const low = rrArcCW(g.l, g.b, g.r, ym, g.R * 0.98, 90, -158);
    g.path([[g.l, g.t], [g.r - g.wd * 0.04, g.t], [g.cx - g.wd * 0.08, ym], ...low], 'sq', 'sq');
  });
  def('4', 1, (g) => {
    const x = g.r - g.wd * 0.2;
    const y = g.b + g.H * 0.27;
    g.path([[x, g.b], [x, g.t], [g.l, y], [g.r + g.w * 0.25, y]], 'sq', 'sq');
  });
  def('5', 1, (g) => {
    const ym = g.b + (g.t - g.b) * 0.6;
    const bowl = rrArcCW(g.l, g.b, g.r, ym, [g.R, g.R * 0.25, g.R, g.R], 100, -152);
    g.path([[g.r, g.t], [g.l + g.wd * 0.04, g.t], [g.l, ym + g.w * 0.1], ...bowl], 'sq', 'sq');
  });
  def('6', 1, (g) => {
    const ym = g.b + (g.t - g.b) * 0.6;
    g.loop(rrArc(g.l, g.b, g.r, ym, g.R, 0, 360));
    g.path([[g.l, ym - g.R * 0.5], [g.l, g.t - g.R], ...rrArcCW(g.l, g.b, g.r, g.t, g.R, 180, 40).slice(1)], 'butt', 'sq');
  });
  def('7', 1, (g) => {
    g.path([[g.l, g.t - g.H * 0.08], [g.l, g.t], [g.r, g.t], [g.cx - g.wd * 0.12, 0]], 'sq', 'h');
  });
  def('8', 1, (g) => {
    const ym = g.b + (g.t - g.b) * 0.55;
    const inset = g.wd * 0.05;
    g.loop(rrArc(g.l + inset, ym, g.r - inset, g.t, g.R * 0.92, 0, 360));
    g.loop(rrArc(g.l, g.b, g.r, ym, g.R, 0, 360));
  });
  def('9', 1, (g) => {
    const ym = g.b + (g.t - g.b) * 0.4;
    g.loop(rrArc(g.l, ym, g.r, g.t, g.R, 0, 360));
    g.path([[g.r, ym + g.R * 0.5], [g.r, g.b + g.R], ...rrArcCW(g.l, g.b, g.r, g.t, g.R, 360, 220).slice(1)], 'butt', 'sq');
  });

  // ---- capitals ----
  def('A', 1.04, (g) => {
    const a = g.wd * 0.1;
    g.path([[g.l - g.w * 0.25, 0], [g.cx - a, g.t], [g.cx + a, g.t], [g.r + g.w * 0.25, 0]], 'h', 'h');
    const y = g.b + g.H * 0.26;
    g.path([[g.l + g.wd * 0.16, y], [g.r - g.wd * 0.16, y]], 'butt', 'butt');
  });
  def('B', 1, (g) => {
    const ym = g.b + (g.t - g.b) * 0.53;
    g.loop(rrArc(g.l, ym, g.r - g.wd * 0.06, g.t, [g.R * 0.85, 0, 0, g.R * 0.85], 0, 360));
    g.loop(rrArc(g.l, g.b, g.r, ym, [g.R, 0, 0, g.R], 0, 360));
  });
  def('C', 1, (g) => g.path(rrArc(g.l, g.b, g.r, g.t, g.R, 28, 332), 'butt', 'butt'));
  def('D', 1, (g) => g.loop(rrArc(g.l, g.b, g.r, g.t, [g.R, 0, 0, g.R], 0, 360)));
  def('E', 0.9, (g) => {
    g.path([[g.r, g.t], [g.l, g.t], [g.l, g.b], [g.r, g.b]], 'sq', 'sq');
    g.path([[g.l, g.m], [g.r - g.wd * 0.1, g.m]], 'butt', 'sq');
  });
  def('F', 0.88, (g) => {
    g.path([[g.r, g.t], [g.l, g.t], [g.l, g.b]], 'sq', 'sq');
    g.path([[g.l, g.m], [g.r - g.wd * 0.12, g.m]], 'butt', 'sq');
  });
  def('G', 1, (g) => {
    const arc = rrArc(g.l, g.b, g.r, g.t, g.R, 30, 360);
    const ym = g.b + (g.t - g.b) * 0.46;
    g.path([...arc, [g.r, ym], [g.cx + g.wd * 0.02, ym]], 'butt', 'sq');
  });
  def('H', 1, (g) => {
    g.path([[g.l, g.b], [g.l, g.t]], 'sq', 'sq');
    g.path([[g.r, g.b], [g.r, g.t]], 'sq', 'sq');
    g.path([[g.l, g.m], [g.r, g.m]], 'butt', 'butt');
  });
  def('I', 0.36, (g) => g.path([[g.cx, g.b], [g.cx, g.t]], 'sq', 'sq'));
  def('J', 0.86, (g) => {
    const arc = rrArc(g.l, g.b, g.r, g.t, g.R, 180, 360);
    g.path([[g.l, g.b + g.R + g.H * 0.04], ...arc, [g.r, g.t]], 'sq', 'sq');
  });
  def('K', 1, (g) => {
    g.path([[g.l, g.b], [g.l, g.t]], 'sq', 'sq');
    const y = g.b + g.H * 0.36;
    g.path([[g.l, y], [g.r + g.w * 0.2, g.t + g.w / 2]], 'butt', 'h');
    g.path([[g.l + g.wd * 0.3, g.b + g.H * 0.5], [g.r + g.w * 0.25, 0]], 'butt', 'h');
  });
  def('L', 0.86, (g) => g.path([[g.l, g.t], [g.l, g.b], [g.r, g.b]], 'sq', 'sq'));
  def('M', 1.3, (g) => {
    g.path([[g.l, g.b], [g.l, g.t], [g.cx, g.b + g.H * 0.3], [g.r, g.t], [g.r, g.b]], 'sq', 'sq');
  });
  def('N', 1.06, (g) => g.path([[g.l, g.b], [g.l, g.t], [g.r, g.b], [g.r, g.t]], 'sq', 'sq'));
  def('O', 1.04, (g) => g.loop(rrArc(g.l, g.b, g.r, g.t, g.R, 0, 360)));
  def('P', 0.98, (g) => {
    const ym = g.b + (g.t - g.b) * 0.44;
    g.loop(rrArc(g.l, ym, g.r, g.t, [g.R * 0.9, 0, 0, g.R * 0.9], 0, 360));
    g.path([[g.l, ym], [g.l, g.b]], 'butt', 'sq');
  });
  def('Q', 1.04, (g) => {
    g.loop(rrArc(g.l, g.b, g.r, g.t, g.R, 0, 360));
    g.path([[g.cx + g.wd * 0.08, g.b + g.H * 0.22], [g.r + g.w * 0.3, 0]], 'butt', 'h');
  });
  def('R', 1, (g) => {
    const ym = g.b + (g.t - g.b) * 0.46;
    g.loop(rrArc(g.l, ym, g.r, g.t, [g.R * 0.9, 0, 0, g.R * 0.9], 0, 360));
    g.path([[g.l, ym], [g.l, g.b]], 'butt', 'sq');
    g.path([[g.cx - g.wd * 0.04, ym], [g.r + g.w * 0.2, 0]], 'butt', 'h');
  });
  def('S', 1, (g) => {
    const ym = g.b + (g.t - g.b) * 0.53;
    const R1 = Math.min(g.R, (g.t - ym) * 0.5);
    const R2 = Math.min(g.R, (ym - g.b) * 0.5);
    const up = rrArc(g.l + g.wd * 0.02, ym, g.r - g.wd * 0.02, g.t, R1, 22, 270);
    const lo = rrArcCW(g.l, g.b, g.r, ym, R2, 90, -158);
    g.path([...up, ...lo], 'butt', 'butt');
  });
  def('T', 0.94, (g) => {
    g.path([[g.l - g.w * 0.1, g.t], [g.r + g.w * 0.1, g.t]], 'sq', 'sq');
    g.path([[g.cx, g.t], [g.cx, g.b]], 'butt', 'sq');
  });
  def('U', 1, (g) => g.path([[g.l, g.t], ...rrArc(g.l, g.b, g.r, g.t, g.R, 180, 360), [g.r, g.t]], 'sq', 'sq'));
  def('V', 1.02, (g) => {
    const a = g.wd * 0.07;
    g.path([[g.l - g.w * 0.2, CAP_T(g)], [g.cx - a, g.b], [g.cx + a, g.b], [g.r + g.w * 0.2, CAP_T(g)]], 'h', 'h');
  });
  def('W', 1.46, (g) => {
    const q = g.wd * 0.24;
    g.path(
      [[g.l - g.w * 0.15, CAP_T(g)], [g.l + q, g.b], [g.cx, g.t - g.H * 0.12], [g.r - q, g.b], [g.r + g.w * 0.15, CAP_T(g)]],
      'h',
      'h'
    );
  });
  def('X', 1, (g) => {
    g.path([[g.l - g.w * 0.15, CAP_T(g)], [g.r + g.w * 0.15, 0]], 'h', 'h');
    g.path([[g.r + g.w * 0.15, CAP_T(g)], [g.l - g.w * 0.15, 0]], 'h', 'h');
  });
  def('Y', 1, (g) => {
    const y = g.b + g.H * 0.44;
    g.path([[g.l - g.w * 0.15, CAP_T(g)], [g.cx, y], [g.r + g.w * 0.15, CAP_T(g)]], 'h', 'h');
    g.path([[g.cx, y], [g.cx, g.b]], 'butt', 'sq');
  });
  def('Z', 0.94, (g) => g.path([[g.l, g.t], [g.r, g.t], [g.l, g.b], [g.r, g.b]], 'sq', 'sq'));

  // ---- punctuation ----
  const dot = (g, x, y) => g.path([[x, y], [x, y + g.w * 0.95]], 'butt', 'butt');
  def(' ', 0.5, () => {});
  def('.', 0.4, (g) => dot(g, g.cx, 0));
  def(',', 0.4, (g) => g.path([[g.cx + g.w * 0.1, g.w * 0.9], [g.cx + g.w * 0.1, 0], [g.cx - g.w * 0.5, -g.H * 0.14]], 'butt', 'butt'));
  def(':', 0.4, (g) => {
    dot(g, g.cx, 0);
    dot(g, g.cx, g.b + g.H * 0.46);
  });
  def(';', 0.4, (g) => {
    g.path([[g.cx + g.w * 0.1, g.w * 0.9], [g.cx + g.w * 0.1, 0], [g.cx - g.w * 0.5, -g.H * 0.14]], 'butt', 'butt');
    dot(g, g.cx, g.b + g.H * 0.46);
  });
  def('-', 0.66, (g) => g.path([[g.l, g.b + g.H * 0.4], [g.r, g.b + g.H * 0.4]], 'sq', 'sq'));
  def('–', 0.9, (g) => g.path([[g.l, g.b + g.H * 0.4], [g.r, g.b + g.H * 0.4]], 'sq', 'sq'));
  def('—', 1.4, (g) => g.path([[g.l, g.b + g.H * 0.4], [g.r, g.b + g.H * 0.4]], 'sq', 'sq'));
  def('_', 0.9, (g) => g.path([[g.l, -g.H * 0.08], [g.r, -g.H * 0.08]], 'sq', 'sq'));
  def('+', 0.9, (g) => {
    const y = g.b + g.H * 0.4;
    const s = Math.min(g.wd * 0.5, g.H * 0.26);
    g.path([[g.cx - s, y], [g.cx + s, y]], 'sq', 'sq');
    g.path([[g.cx, y - s], [g.cx, y + s]], 'sq', 'sq');
  });
  def('/', 0.72, (g) => g.path([[g.l - g.w * 0.2, -g.H * 0.04], [g.r + g.w * 0.2, CAP_T(g) + g.H * 0.04]], 'h', 'h'));
  def('\\', 0.72, (g) => g.path([[g.l - g.w * 0.2, CAP_T(g) + g.H * 0.04], [g.r + g.w * 0.2, -g.H * 0.04]], 'h', 'h'));
  def('|', 0.4, (g) => g.path([[g.cx, -g.H * 0.12], [g.cx, g.t + g.H * 0.1]], 'sq', 'sq'));
  def("'", 0.36, (g) => g.path([[g.cx, g.t], [g.cx, g.t - g.H * 0.22]], 'sq', 'butt'));
  def('’', 0.36, (g) => g.path([[g.cx, g.t], [g.cx, g.t - g.H * 0.14], [g.cx - g.w * 0.6, g.t - g.H * 0.26]], 'sq', 'butt'));
  def('"', 0.6, (g) => {
    g.path([[g.l, g.t], [g.l, g.t - g.H * 0.22]], 'sq', 'butt');
    g.path([[g.r, g.t], [g.r, g.t - g.H * 0.22]], 'sq', 'butt');
  });
  def('!', 0.4, (g) => {
    dot(g, g.cx, 0);
    g.path([[g.cx, g.t], [g.cx, g.b + g.H * 0.3]], 'sq', 'butt');
  });
  def('?', 0.9, (g) => {
    dot(g, g.cx, 0);
    const Rt = Math.min(g.R, g.H * 0.22);
    const top = rrArcCW(g.l, g.t - 2 * Rt, g.r, g.t, Rt, 165, -60);
    g.path([...top, [g.cx, g.b + g.H * 0.4], [g.cx, g.b + g.H * 0.3]], 'sq', 'butt');
  });
  def('(', 0.5, (g) => g.path(rrArc(g.l, g.b - g.H * 0.1, g.r + g.wd * 2, g.t + g.H * 0.06, g.wd * 1.2, 100, 260, 5), 'butt', 'butt'));
  def(')', 0.5, (g) => g.path(rrArcCW(g.l - g.wd * 2, g.b - g.H * 0.1, g.r, g.t + g.H * 0.06, g.wd * 1.2, 80, -80, 5), 'butt', 'butt'));
  def('[', 0.5, (g) => g.path([[g.r, g.t + g.H * 0.06], [g.l, g.t + g.H * 0.06], [g.l, g.b - g.H * 0.1], [g.r, g.b - g.H * 0.1]], 'sq', 'sq'));
  def(']', 0.5, (g) => g.path([[g.l, g.t + g.H * 0.06], [g.r, g.t + g.H * 0.06], [g.r, g.b - g.H * 0.1], [g.l, g.b - g.H * 0.1]], 'sq', 'sq'));
  def('%', 1.3, (g) => {
    const s = g.wd * 0.36;
    g.loop(rrArc(g.l, g.t - g.H * 0.4, g.l + s, g.t, s * 0.5, 0, 360));
    g.loop(rrArc(g.r - s, g.b, g.r, g.b + g.H * 0.4, s * 0.5, 0, 360));
    g.path([[g.l + g.wd * 0.1, 0], [g.r - g.wd * 0.1, CAP_T(g)]], 'h', 'h');
  });
  def('#', 1.1, (g) => {
    const y0 = g.b + g.H * 0.28;
    const y1 = g.b + g.H * 0.64;
    g.path([[g.l, y0], [g.r, y0]], 'sq', 'sq');
    g.path([[g.l, y1], [g.r, y1]], 'sq', 'sq');
    g.path([[g.l + g.wd * 0.3, g.b], [g.l + g.wd * 0.36, g.t]], 'sq', 'sq');
    g.path([[g.r - g.wd * 0.36, g.b], [g.r - g.wd * 0.3, g.t]], 'sq', 'sq');
  });
  def('<', 0.8, (g) => g.path([[g.r, g.b + g.H * 0.68], [g.l, g.b + g.H * 0.4], [g.r, g.b + g.H * 0.12]], 'butt', 'butt'));
  def('>', 0.8, (g) => g.path([[g.l, g.b + g.H * 0.68], [g.r, g.b + g.H * 0.4], [g.l, g.b + g.H * 0.12]], 'butt', 'butt'));
  def('=', 0.9, (g) => {
    g.path([[g.l, g.b + g.H * 0.28], [g.r, g.b + g.H * 0.28]], 'sq', 'sq');
    g.path([[g.l, g.b + g.H * 0.54], [g.r, g.b + g.H * 0.54]], 'sq', 'sq');
  });
  def('×', 0.9, (g) => {
    const y = g.b + g.H * 0.4;
    const s = Math.min(g.wd * 0.45, g.H * 0.22);
    g.path([[g.cx - s, y - s], [g.cx + s, y + s]], 'sq', 'sq');
    g.path([[g.cx - s, y + s], [g.cx + s, y - s]], 'sq', 'sq');
  });
  def('·', 0.4, (g) => dot(g, g.cx, g.b + g.H * 0.36));
  def('•', 0.5, (g) => g.path([[g.cx, g.b + g.H * 0.3], [g.cx, g.b + g.H * 0.3 + g.w * 1.6]], 'butt', 'butt', 1.7));
  def('°', 0.56, (g) => g.loop(rrArc(g.l, g.t - g.wd, g.r, g.t, g.wd * 0.5, 0, 360)));
  return G;
}

/** Outer cap line for diagonals cut flat at the top. */
function CAP_T(g) {
  return g.capTop;
}

/** Accents for the composed Latin-1 letters (VOCÊ, À, Ç ...). */
const ACCENTS = {
  'À': ['A', 'grave'], 'Á': ['A', 'acute'], 'Â': ['A', 'circ'], 'Ã': ['A', 'tilde'], 'Ä': ['A', 'uml'],
  'Ç': ['C', 'cedilla'],
  'È': ['E', 'grave'], 'É': ['E', 'acute'], 'Ê': ['E', 'circ'], 'Ë': ['E', 'uml'],
  'Ì': ['I', 'grave'], 'Í': ['I', 'acute'], 'Î': ['I', 'circ'], 'Ï': ['I', 'uml'],
  'Ñ': ['N', 'tilde'],
  'Ò': ['O', 'grave'], 'Ó': ['O', 'acute'], 'Ô': ['O', 'circ'], 'Õ': ['O', 'tilde'], 'Ö': ['O', 'uml'],
  'Ù': ['U', 'grave'], 'Ú': ['U', 'acute'], 'Û': ['U', 'circ'], 'Ü': ['U', 'uml'],
};

function drawAccent(g, kind, top) {
  const y0 = top + g.H * 0.09;
  const y1 = y0 + g.H * 0.16;
  const s = Math.min(g.wd * 0.34, g.H * 0.2);
  const ww = g.w * 0.8;
  switch (kind) {
    case 'acute':
      g.path([[g.cx - s * 0.4, y0], [g.cx + s * 0.6, y1]], 'butt', 'butt', ww / g.w);
      break;
    case 'grave':
      g.path([[g.cx + s * 0.4, y0], [g.cx - s * 0.6, y1]], 'butt', 'butt', ww / g.w);
      break;
    case 'circ':
      g.path([[g.cx - s, y0], [g.cx, y1], [g.cx + s, y0]], 'butt', 'butt', ww / g.w);
      break;
    case 'tilde':
      g.path([[g.cx - s, y0], [g.cx - s * 0.4, y1], [g.cx + s * 0.4, y0], [g.cx + s, y1]], 'butt', 'butt', ww / g.w);
      break;
    case 'uml':
      g.path([[g.cx - s * 0.6, y0], [g.cx - s * 0.6, y0 + g.w]], 'butt', 'butt', ww / g.w);
      g.path([[g.cx + s * 0.6, y0], [g.cx + s * 0.6, y0 + g.w]], 'butt', 'butt', ww / g.w);
      break;
    case 'cedilla':
      g.path([[g.cx, 0], [g.cx, -g.H * 0.08], [g.cx + s * 0.5, -g.H * 0.14], [g.cx - s * 0.4, -g.H * 0.24]], 'butt', 'butt', ww / g.w);
      break;
  }
}

/* ======================================================================== */
/*  outline build                                                            */
/* ======================================================================== */

const BASE_ADV = 520; // advance of a regular capital
const SB = 52; // side bearing

function buildGlyph(G, ch, w, small) {
  let base = ch;
  let accent = null;
  if (ACCENTS[ch]) [base, accent] = ACCENTS[ch];
  const spec = G[base];
  if (!spec) return null;
  const H = small ? SMALL : CAP;
  const adv = Math.round(BASE_ADV * spec.adv * (small ? 0.92 : 1));
  const contours = [];
  const l = SB + w / 2;
  const r = adv - SB - w / 2;
  const b = w / 2;
  const t = H - w / 2;
  const g = {
    w,
    H,
    l,
    r,
    b,
    t,
    m: b + (t - b) * 0.52,
    cx: (l + r) / 2,
    wd: r - l,
    R: Math.min((r - l) * 0.5, (t - b) * 0.5) * 0.92,
    capTop: H,
    path(pts, c0, c1, wmul = 1) {
      for (const c of strokeContours(pts, { w: w * wmul, cap0: c0, cap1: c1 })) contours.push(c);
    },
    loop(pts) {
      for (const c of strokeContours(pts, { w, closed: true })) contours.push(c);
    },
  };
  spec.draw(g);
  if (accent) drawAccent(g, accent, H);
  return { adv, contours };
}

/* ======================================================================== */
/*  TrueType writer                                                          */
/* ======================================================================== */

class Buf {
  constructor() {
    this.a = [];
  }
  u8(v) {
    this.a.push(v & 255);
  }
  u16(v) {
    this.a.push((v >> 8) & 255, v & 255);
  }
  i16(v) {
    this.u16(v < 0 ? v + 65536 : v);
  }
  u32(v) {
    this.a.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  }
  tag(s) {
    for (let i = 0; i < 4; i++) this.u8(s.charCodeAt(i));
  }
  pad4() {
    while (this.a.length % 4) this.a.push(0);
  }
  get length() {
    return this.a.length;
  }
}

function checksum(bytes) {
  let s = 0;
  for (let i = 0; i < bytes.length; i += 4) {
    const v = ((bytes[i] ?? 0) << 24) | ((bytes[i + 1] ?? 0) << 16) | ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0);
    s = (s + (v >>> 0)) >>> 0;
  }
  return s >>> 0;
}

function charset() {
  const cs = [];
  for (let c = 32; c < 127; c++) cs.push(String.fromCharCode(c));
  cs.push('°', '·', '×', '–', '—', '’', '•');
  for (const k in ACCENTS) {
    cs.push(k);
    cs.push(k.toLowerCase());
  }
  return cs;
}

function buildFont(weight, w, family) {
  const G = glyphTable();
  const glyphs = [{ adv: 500, contours: [] }]; // .notdef
  const cmap = [];
  for (const ch of charset()) {
    const lower = ch !== ch.toUpperCase() && ch.toUpperCase().length === 1;
    const g = buildGlyph(G, lower ? ch.toUpperCase() : ch, w, lower);
    if (!g) continue;
    cmap.push([ch.codePointAt(0), glyphs.length]);
    glyphs.push(g);
  }
  cmap.sort((a, b) => a[0] - b[0]);

  // ---- glyf + loca + hmtx ----
  const glyf = new Buf();
  const loca = [];
  const hm = [];
  let maxPts = 0;
  let maxCont = 0;
  let gxMin = 1e9, gyMin = 1e9, gxMax = -1e9, gyMax = -1e9;
  let minLsb = 1e9, minRsb = 1e9, maxExtent = 0, advMax = 0;
  for (const g of glyphs) {
    loca.push(glyf.length);
    const cs = g.contours.map((c) => c.map((p) => [Math.round(p[0]), Math.round(p[1])])).filter((c) => c.length >= 3);
    advMax = Math.max(advMax, g.adv);
    if (!cs.length) {
      hm.push([g.adv, 0]);
      continue;
    }
    let xMin = 1e9, yMin = 1e9, xMax = -1e9, yMax = -1e9, nPts = 0;
    for (const c of cs) {
      nPts += c.length;
      for (const [x, y] of c) {
        if (x < xMin) xMin = x;
        if (y < yMin) yMin = y;
        if (x > xMax) xMax = x;
        if (y > yMax) yMax = y;
      }
    }
    maxPts = Math.max(maxPts, nPts);
    maxCont = Math.max(maxCont, cs.length);
    gxMin = Math.min(gxMin, xMin);
    gyMin = Math.min(gyMin, yMin);
    gxMax = Math.max(gxMax, xMax);
    gyMax = Math.max(gyMax, yMax);
    minLsb = Math.min(minLsb, xMin);
    minRsb = Math.min(minRsb, g.adv - xMax);
    maxExtent = Math.max(maxExtent, xMax);
    hm.push([g.adv, xMin]);
    glyf.i16(cs.length);
    glyf.i16(xMin);
    glyf.i16(yMin);
    glyf.i16(xMax);
    glyf.i16(yMax);
    let end = -1;
    for (const c of cs) {
      end += c.length;
      glyf.u16(end);
    }
    glyf.u16(0); // no instructions
    for (let i = 0; i < nPts; i++) glyf.u8(1); // on-curve, 16-bit deltas
    let px = 0;
    for (const c of cs) for (const [x] of c) (glyf.i16(x - px), (px = x));
    let py = 0;
    for (const c of cs) for (const [, y] of c) (glyf.i16(y - py), (py = y));
    glyf.pad4();
  }
  loca.push(glyf.length);
  if (gxMin > gxMax) (gxMin = 0), (gyMin = 0), (gxMax = 0), (gyMax = 0);

  const tables = {};

  const head = new Buf();
  head.u16(1); head.u16(0);
  head.u32(0x00010000);
  head.u32(0); // checkSumAdjustment, patched below
  head.u32(0x5f0f3cf5);
  head.u16(0x000b);
  head.u16(UPM);
  head.u32(0); head.u32(0); head.u32(0); head.u32(0);
  head.i16(gxMin); head.i16(gyMin); head.i16(gxMax); head.i16(gyMax);
  head.u16(weight >= 700 ? 1 : 0);
  head.u16(8);
  head.i16(2);
  head.i16(1); // long loca
  head.i16(0);
  tables.head = head;

  const hhea = new Buf();
  hhea.u32(0x00010000);
  hhea.i16(ASC); hhea.i16(-DESC); hhea.i16(33);
  hhea.u16(advMax);
  hhea.i16(minLsb); hhea.i16(minRsb); hhea.i16(maxExtent);
  hhea.i16(1); hhea.i16(0); hhea.i16(0);
  hhea.i16(0); hhea.i16(0); hhea.i16(0); hhea.i16(0);
  hhea.i16(0);
  hhea.u16(glyphs.length);
  tables.hhea = hhea;

  const maxp = new Buf();
  maxp.u32(0x00010000);
  maxp.u16(glyphs.length);
  maxp.u16(maxPts); maxp.u16(maxCont);
  maxp.u16(0); maxp.u16(0);
  maxp.u16(2);
  for (let i = 0; i < 9; i++) maxp.u16(0);
  tables.maxp = maxp;

  const hmtx = new Buf();
  for (const [a, l] of hm) (hmtx.u16(a), hmtx.i16(l));
  tables.hmtx = hmtx;

  const locaB = new Buf();
  for (const o of loca) locaB.u32(o);
  tables.loca = locaB;
  tables.glyf = glyf;

  // cmap format 4, one segment per code point
  const cm = new Buf();
  const segs = cmap.map(([c, gid]) => [c, c, gid]);
  segs.push([0xffff, 0xffff, 0]);
  const segX2 = segs.length * 2;
  const sr = 2 * 2 ** Math.floor(Math.log2(segs.length));
  cm.u16(0); cm.u16(1);
  cm.u16(3); cm.u16(1); cm.u32(12);
  const sub = new Buf();
  sub.u16(4);
  sub.u16(16 + segs.length * 8);
  sub.u16(0);
  sub.u16(segX2);
  sub.u16(sr);
  sub.u16(Math.log2(sr / 2));
  sub.u16(segX2 - sr);
  for (const s of segs) sub.u16(s[1]);
  sub.u16(0);
  for (const s of segs) sub.u16(s[0]);
  for (const s of segs) sub.u16(s[0] === 0xffff ? 1 : (s[2] - s[0] + 65536) % 65536);
  for (let i = 0; i < segs.length; i++) sub.u16(0);
  for (const v of sub.a) cm.a.push(v);
  tables.cmap = cm;

  const sub0 = weight >= 700 ? 'Bold' : weight >= 600 ? 'SemiBold' : 'Regular';
  const names = [
    [1, family],
    [2, weight >= 700 ? 'Bold' : 'Regular'],
    [3, `${family} ${sub0}`],
    [4, `${family} ${sub0}`],
    [5, 'Version 1.0'],
    [6, `${family.replace(/\s+/g, '')}-${sub0}`],
  ];
  const nm = new Buf();
  nm.u16(0);
  nm.u16(names.length);
  nm.u16(6 + 12 * names.length);
  const strs = new Buf();
  for (const [id, s] of names) {
    nm.u16(3); nm.u16(1); nm.u16(0x409); nm.u16(id);
    nm.u16(s.length * 2);
    nm.u16(strs.length);
    for (const ch of s) strs.u16(ch.charCodeAt(0));
  }
  for (const v of strs.a) nm.a.push(v);
  tables.name = nm;

  const os2 = new Buf();
  os2.u16(4);
  os2.i16(Math.round(BASE_ADV * 0.95));
  os2.u16(weight);
  os2.u16(3); // condensed
  os2.u16(0);
  os2.i16(650); os2.i16(600); os2.i16(0); os2.i16(75);
  os2.i16(650); os2.i16(600); os2.i16(0); os2.i16(350);
  os2.i16(Math.round(w)); os2.i16(300);
  os2.i16(0);
  for (let i = 0; i < 10; i++) os2.u8(0);
  os2.u32(1); os2.u32(0); os2.u32(0); os2.u32(0);
  os2.tag('OWHD');
  os2.u16(weight >= 700 ? 0x20 : 0x40);
  os2.u16(cmap[0][0]);
  os2.u16(Math.min(0xffff, cmap[cmap.length - 1][0]));
  os2.i16(ASC); os2.i16(-DESC); os2.i16(33);
  os2.u16(ASC); os2.u16(DESC);
  os2.u32(1); os2.u32(0);
  os2.i16(SMALL); os2.i16(CAP);
  os2.u16(0); os2.u16(32); os2.u16(1);
  tables['OS/2'] = os2;

  const post = new Buf();
  post.u32(0x00030000);
  post.u32(0);
  post.i16(-100); post.i16(50);
  post.u32(0); post.u32(0); post.u32(0); post.u32(0); post.u32(0);
  tables.post = post;

  // ---- assemble ----
  const tags = Object.keys(tables).sort();
  const nT = tags.length;
  const out = new Buf();
  const tsr = 16 * 2 ** Math.floor(Math.log2(nT));
  out.u32(0x00010000);
  out.u16(nT);
  out.u16(tsr);
  out.u16(Math.floor(Math.log2(nT)));
  out.u16(nT * 16 - tsr);
  let off = 12 + nT * 16;
  const recs = [];
  for (const tg of tags) {
    const t = tables[tg];
    const len = t.length;
    t.pad4();
    recs.push([tg, checksum(t.a), off, len]);
    off += t.a.length;
  }
  for (const [tg, cs, o, len] of recs) (out.tag(tg), out.u32(cs), out.u32(o), out.u32(len));
  let headOff = 0;
  for (const tg of tags) {
    if (tg === 'head') headOff = out.length;
    for (const v of tables[tg].a) out.a.push(v);
  }
  const bytes = new Uint8Array(out.a);
  const adj = (0xb1b0afba - checksum(bytes)) >>> 0;
  bytes[headOff + 8] = adj >>> 24;
  bytes[headOff + 9] = (adj >>> 16) & 255;
  bytes[headOff + 10] = (adj >>> 8) & 255;
  bytes[headOff + 11] = adj & 255;
  return bytes;
}

/** Family name the stylesheet puts first in every stack. */
export const HUD_FAMILY = 'OW Tactical';

/** Stroke width per CSS weight, in font units (cap height 716). */
export const WEIGHTS = { 400: 64, 600: 84, 700: 104 };

export function buildHudFontBytes(weight = 400) {
  return buildFont(weight, WEIGHTS[weight] ?? 64, HUD_FAMILY);
}

let installedFaces = null;

/**
 * Register the generated faces with `document.fonts`. Synchronous enough for
 * the HUD: a FontFace built from an ArrayBuffer is parsed immediately, and
 * text laid out before it settles re-lays out once it does.
 */
export function installHudFont() {
  if (installedFaces || typeof FontFace === 'undefined' || typeof document === 'undefined') return installedFaces;
  installedFaces = [];
  for (const wt of [400, 600, 700]) {
    try {
      const face = new FontFace(HUD_FAMILY, buildHudFontBytes(wt).buffer, { weight: String(wt), style: 'normal' });
      document.fonts.add(face);
      face.load().catch((e) => console.warn('[ui] hud font rejected', wt, e?.message ?? e));
      installedFaces.push(face);
    } catch (e) {
      console.warn('[ui] hud font build failed', e);
    }
  }
  return installedFaces;
}

export function removeHudFont() {
  if (!installedFaces) return;
  for (const f of installedFaces) {
    try {
      document.fonts.delete(f);
    } catch {
      /* already gone */
    }
  }
  installedFaces = null;
}
