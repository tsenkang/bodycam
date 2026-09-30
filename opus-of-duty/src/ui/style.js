import { FONT_STACK, FONT_DISPLAY, FONT_MONO } from './util.js';

/**
 * All HUD styling lives here as one injected stylesheet.
 *
 * Design system
 * -------------
 *  scale     every dimension is `calc(N * var(--k))` where --k is set from the
 *            viewport height (1080p == 1.0). The HUD therefore holds its
 *            proportions from 720p to 4K without re-authoring.
 *  spacing   4px grid: --u. Screen margins are 6u (24px @1080p), the same
 *            margin CoD uses (~2.2% of height).
 *  type      one condensed system stack, uppercase, tabular figures, three
 *            ink levels (94% / 58% / 30%) and one accent per semantic:
 *            amber = caution, red = threat, cyan = friendly/objective.
 *  contrast  every text run carries a two-stop shadow (tight dark + wide
 *            dark bloom) so it survives a blown-out sky *and* a black
 *            interior without a scrim behind it.
 */

const CSS = `
.ow-hud, .ow-hud * { margin:0; padding:0; box-sizing:border-box; }

.ow-hud {
  --k: 1;
  --u: calc(4px * var(--k));
  --pad: calc(var(--u) * 7.5);

  --ink:   rgba(238,244,247,.95);
  --ink-2: rgba(214,227,234,.60);
  --ink-3: rgba(196,210,219,.30);
  --hair:  rgba(255,255,255,.15);
  --hair-2:rgba(255,255,255,.07);

  --amber: #ffb02a;
  --red:   #ff3f31;
  --blood: #8d0f0a;
  --cyan:  #79d2ff;
  --friend:#8fc8ff;
  --enemy: #ff7a63;
  --ok:    #a8e86a;

  --sh: 0 calc(1px * var(--k)) calc(2px * var(--k)) rgba(0,0,0,.55), 0 0 calc(7px * var(--k)) rgba(0,0,0,.28);
  --sh-hard: 0 1px 1px rgba(0,0,0,.95);

  /* Symmetric synthesized outlines. An offset drop-shadow is a web-overlay
     tell and it fights whatever direction the scene key light comes from; a
     ring of eight equal-radius hard shadows reads as a drawn outline and is
     direction-free. Each is paired with one tight soft shadow for the seat. */
  --oc: #080c10;
  --o1:
    calc(1.5px * var(--k)) 0 0 var(--oc), calc(-1.5px * var(--k)) 0 0 var(--oc),
    0 calc(1.5px * var(--k)) 0 var(--oc), 0 calc(-1.5px * var(--k)) 0 var(--oc),
    calc(1.1px * var(--k)) calc(1.1px * var(--k)) 0 var(--oc),
    calc(-1.1px * var(--k)) calc(1.1px * var(--k)) 0 var(--oc),
    calc(1.1px * var(--k)) calc(-1.1px * var(--k)) 0 var(--oc),
    calc(-1.1px * var(--k)) calc(-1.1px * var(--k)) 0 var(--oc);
  --o2:
    calc(2px * var(--k)) 0 0 var(--oc), calc(-2px * var(--k)) 0 0 var(--oc),
    0 calc(2px * var(--k)) 0 var(--oc), 0 calc(-2px * var(--k)) 0 var(--oc),
    calc(1.45px * var(--k)) calc(1.45px * var(--k)) 0 var(--oc),
    calc(-1.45px * var(--k)) calc(1.45px * var(--k)) 0 var(--oc),
    calc(1.45px * var(--k)) calc(-1.45px * var(--k)) 0 var(--oc),
    calc(-1.45px * var(--k)) calc(-1.45px * var(--k)) 0 var(--oc);
  /* outline + tight soft seat, no directional offset */
  --sh-o1: var(--o1), 0 0 calc(4px * var(--k)) rgba(3,6,9,.8);
  --sh-o2: var(--o2), 0 0 calc(5px * var(--k)) rgba(3,6,9,.85);

  --ff: ${FONT_STACK};
  --fd: ${FONT_DISPLAY};
  --fm: ${FONT_MONO};

  position: fixed; inset: 0;
  pointer-events: none;
  z-index: 10;
  font-family: var(--ff);
  font-weight: 600;
  color: var(--ink);
  letter-spacing: .03em;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "lnum" 1;
  -webkit-font-smoothing: antialiased;
  text-transform: uppercase;
  overflow: hidden;
  contain: layout style;
  user-select: none;
}

.ow-hud .lbl {
  font-size: calc(10.5px * var(--k));
  letter-spacing: .2em;
  color: var(--ink-2);
  text-shadow: var(--sh);
}
.ow-layer { position:absolute; inset:0; }

/* ============================================================== crosshair */
.ow-cross { position:absolute; left:50%; top:50%; width:0; height:0; }
.ow-blade {
  position:absolute; left:0; top:0;
  width: calc(1.6px * var(--k));
  height: calc(8px * var(--k));
  margin-left: calc(-0.8px * var(--k));
  margin-top: calc(-4px * var(--k));
  background: linear-gradient(to top, rgba(255,255,255,.62), #fff 62%);
  box-shadow: 0 0 0 1px rgba(0,0,0,.55), 0 0 calc(3px * var(--k)) rgba(0,0,0,.75);
  transform-origin: 50% 50%;
  will-change: transform, opacity;
}
.ow-dot {
  position:absolute; left:0; top:0;
  width: calc(2.2px * var(--k)); height: calc(2.2px * var(--k));
  margin-left: calc(-1.1px * var(--k)); margin-top: calc(-1.1px * var(--k));
  background:#fff; border-radius:50%;
  box-shadow: 0 0 0 1px rgba(0,0,0,.6), 0 0 calc(4px * var(--k)) rgba(0,0,0,.7);
  will-change: opacity, transform;
}
/* thin lower "shotgun" reference tick — reads as a real reticle, not a plus */
.ow-cross-ads { position:absolute; left:0; top:0; }

/* ============================================================ hitmarkers */
.ow-hit {
  position:absolute; left:50%; top:50%;
  width: calc(56px * var(--k)); height: calc(56px * var(--k));
  margin-left: calc(-28px * var(--k)); margin-top: calc(-28px * var(--k));
  will-change: transform, opacity;
}
.ow-hit svg { width:100%; height:100%; display:block; overflow:visible; }

/* =============================================== directional damage arcs */
.ow-dmg {
  position:absolute; left:50%; top:50%;
  width: calc(340px * var(--k)); height: calc(340px * var(--k));
  margin-left: calc(-170px * var(--k)); margin-top: calc(-170px * var(--k));
  will-change: transform, opacity;
}
.ow-dmg svg { width:100%; height:100%; display:block; overflow:visible; }

/* ============================================================ hurt state */
.ow-blood { position:absolute; inset:-7%; will-change: opacity, transform; }
.ow-blood-a {
  position:absolute; inset:0;
  background:
    radial-gradient(ellipse 78% 74% at 50% 50%, rgba(0,0,0,0) 62%, rgba(122,14,10,.30) 86%, rgba(74,8,5,.60) 100%);
  filter: url(#ow-warp);
}
.ow-blood-b {
  position:absolute; inset:0; opacity:.5; mix-blend-mode:multiply;
  background:
    radial-gradient(circle at 2% 22%,  rgba(96,10,8,.75) 0, rgba(96,10,8,0) 17%),
    radial-gradient(circle at 99% 58%, rgba(96,10,8,.7) 0, rgba(96,10,8,0) 15%),
    radial-gradient(circle at 26% 101%,rgba(88,10,8,.75) 0, rgba(88,10,8,0) 19%),
    radial-gradient(circle at 74% -2%, rgba(88,10,8,.7) 0, rgba(88,10,8,0) 18%);
  filter: url(#ow-warp);
}
.ow-desat { position:absolute; inset:0; backdrop-filter: saturate(.6) contrast(1.04) brightness(.97); }
.ow-hitflash { position:absolute; inset:0;
  background: radial-gradient(ellipse 90% 86% at 50% 50%, rgba(150,16,10,.22) 40%, rgba(160,18,12,.62) 100%);
  mix-blend-mode:screen; }
.ow-lowbeat {
  position:absolute; inset:0;
  background: radial-gradient(ellipse 76% 70% at 50% 50%, rgba(0,0,0,0) 64%, rgba(150,14,10,.34) 100%);
}

/* ====================================================== vitals (bottom left)
   Only shown in modes that carry health/armour (`.ow-hud.vitals`); team
   deathmatch shows none, like the games this is measured against. */
.ow-vitals {
  position:absolute; left:var(--pad); bottom:calc(var(--pad) + 2px * var(--k));
  width: calc(250px * var(--k)); display:none;
}
.ow-hud.vitals .ow-vitals { display:block; }
.ow-vt-row { display:flex; align-items:center; gap: calc(9px * var(--k)); }
.ow-vt-num {
  font-family: var(--fd); font-size: calc(22px * var(--k)); font-weight:700;
  letter-spacing:0; line-height:1; color: var(--ink);
  min-width: calc(34px * var(--k)); text-align:right;
  text-shadow: var(--sh); transform-origin: right center;
}
.ow-vt-num i { display:none; }
.ow-vt-track { position:relative; flex:1; height: calc(7px * var(--k));
  background: rgba(10,14,17,.45); overflow:hidden; }
.ow-vt-track > i { position:absolute; left:0; top:0; bottom:0; width:100%;
  transform-origin:left center; background: rgba(244,247,248,.94); }
.ow-vitals.low .ow-vt-track > i { background: #f3c14b; }
.ow-vitals.crit .ow-vt-track > i { background: #f0402f; }
.ow-armour { margin-bottom: calc(4px * var(--k)); padding-right: calc(43px * var(--k)); }
.ow-arm-plates { display:flex; gap: calc(3px * var(--k)); }
.ow-plate { flex:1; height: calc(5px * var(--k)); background: rgba(10,14,17,.45); position:relative; overflow:hidden; }
.ow-plate i { position:absolute; left:0; top:0; bottom:0; width:100%; background: #8ec9ee; transform-origin: left center; }

/* Condensed display numerals. No font files ship with the game, so the
   display face is the system grotesque compressed to 82% width — the same
   construction the classic "narrow" cuts of those faces use. */
.ow-cx { display:inline-block; transform: scaleX(.82); }

/* ================================================================== ammo
   Bottom right. Equipment column | hairline | name over count + reserve. */
.ow-ammo {
  position:absolute; right:var(--pad); bottom:var(--pad);
  display:flex; align-items:flex-end; gap: calc(14px * var(--k));
  line-height:1;
}
.ow-ammo-main { display:flex; flex-direction:column; align-items:flex-end; }
.ow-ammo-name {
  font-family: var(--fd); font-size: calc(21px * var(--k)); font-weight:700; letter-spacing:.02em;
  color: var(--ink); text-shadow: var(--sh); white-space:nowrap;
  margin-bottom: calc(5px * var(--k));
  transform: scaleX(.86); transform-origin: right center;
}
.ow-ammo-row { display:flex; align-items:flex-end; gap: calc(6px * var(--k)); }
.ow-ammo-cur {
  font-family: var(--fd);
  font-size: calc(76px * var(--k)); font-weight:700; letter-spacing:-.02em;
  line-height:.74; color: var(--ink);
  text-shadow: 0 calc(1px * var(--k)) calc(3px * var(--k)) rgba(0,0,0,.5), 0 0 calc(14px * var(--k)) rgba(0,0,0,.25);
  transform-origin: right bottom;
  margin-right: calc(-4px * var(--k));
}
.ow-ammo-side { display:flex; flex-direction:column; align-items:flex-start; gap: calc(7px * var(--k)); }
.ow-ammo-res { font-family: var(--fd); font-size: calc(29px * var(--k)); font-weight:700; line-height:.74;
  color: rgba(226,232,236,.72); text-shadow: var(--sh); transform: scaleX(.82); transform-origin: left bottom; }
.ow-ammo-mode { display:flex; align-items:center; gap: calc(5px * var(--k));
  font-size: calc(12px * var(--k)); font-weight:700; letter-spacing:.06em; color: rgba(226,232,236,.72); text-shadow: var(--sh); }
.ow-ammo-mode svg { width: calc(15px * var(--k)); height: calc(11px * var(--k)); fill: var(--ink); display:block;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,.6)); }
.ow-ammo-low .ow-ammo-cur { color: #f7cf6a; }
.ow-ammo-empty .ow-ammo-cur { color: #ff5a48; }
.ow-ammo-rule { width: calc(1.5px * var(--k)); align-self:stretch; margin: calc(4px * var(--k)) 0;
  background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,.3) 30%, rgba(255,255,255,.3) 70%, rgba(255,255,255,0)); }
.ow-reload {
  margin-top: calc(8px * var(--k));
  font-size: calc(14px * var(--k)); font-weight:700; letter-spacing:.08em; color: #f7cf6a; text-shadow: var(--sh);
}
.ow-reload-bar { margin-top: calc(4px * var(--k)); width: calc(96px * var(--k)); height: calc(3px * var(--k)); background: rgba(10,14,17,.45); }
.ow-reload-bar i { display:block; height:100%; width:100%; background: #f7cf6a; transform-origin:left; transform:scaleX(0); }

.ow-equip { display:flex; flex-direction:column; gap: calc(9px * var(--k)); padding-bottom: calc(2px * var(--k)); }
.ow-slot { display:flex; align-items:center; gap: calc(7px * var(--k)); }
.ow-slot svg { width: calc(17px * var(--k)); height: calc(21px * var(--k)); display:block;
  filter: drop-shadow(0 1px 1.5px rgba(0,0,0,.6)); }
.ow-slot span { font-family: var(--fd); font-size: calc(19px * var(--k)); font-weight:700; color: var(--ink);
  text-shadow: var(--sh); min-width: calc(10px * var(--k)); }
.ow-slot.empty { opacity:.35; }

/* ============================================================== killfeed
   Lower left, stacked upward. */
.ow-killfeed {
  position:absolute; left:var(--pad); bottom:calc(var(--pad) + 150px * var(--k));
  display:flex; flex-direction:column; align-items:flex-start;
  gap: calc(4px * var(--k));
  text-transform:none;
}
.ow-hud.vitals .ow-killfeed { bottom:calc(var(--pad) + 200px * var(--k)); }
.ow-kf-row {
  position:relative;
  display:flex; align-items:center; gap: calc(9px * var(--k));
  font-size: calc(18px * var(--k)); font-weight:700; letter-spacing:0;
  padding: calc(4px * var(--k)) calc(34px * var(--k)) calc(4px * var(--k)) calc(9px * var(--k));
  background: linear-gradient(to right, rgba(8,11,14,.5) 0%, rgba(8,11,14,.38) 60%, rgba(8,11,14,0) 100%);
  text-shadow: 0 1px 1px rgba(0,0,0,.55);
  will-change: transform, opacity;
}
.ow-kf-row.mine { background: linear-gradient(to right, rgba(46,36,10,.6) 0%, rgba(36,28,8,.42) 60%, rgba(36,28,8,0) 100%); }
.ow-kf-a, .ow-kf-v { display:inline-block; }
.ow-kf-a { color: #7fc4ff; }
.ow-kf-v { color: #ff6a55; }
.ow-kf-row.mine .ow-kf-a { color: #f5d46b; }
.ow-kf-w { display:flex; align-items:center; gap:calc(5px * var(--k)); }
.ow-kf-w svg { width: calc(44px * var(--k)); height: calc(17px * var(--k)); display:block;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,.6)); }
.ow-kf-hs svg { width: calc(15px * var(--k)); height: calc(15px * var(--k)); display:block;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,.6)); }

/* =============================================================== compass
   Top centre: a tape on a soft dark band, ticks every 5 deg, bearings every
   15, the heading in a plate under the centre notch. */
.ow-compass {
  position:absolute; left:50%; top:calc(var(--pad) * .6);
  width: calc(560px * var(--k)); height: calc(42px * var(--k));
  transform: translateX(-50%);
  -webkit-mask-image: linear-gradient(to right, transparent, #000 14%, #000 86%, transparent);
          mask-image: linear-gradient(to right, transparent, #000 14%, #000 86%, transparent);
  overflow:hidden;
}
.ow-compass::before {
  content:''; position:absolute; left:0; right:0; top:0; height: calc(34px * var(--k));
  background: linear-gradient(to bottom, rgba(6,9,12,.0), rgba(6,9,12,.34) 25%, rgba(6,9,12,.34) 75%, rgba(6,9,12,0));
}
/* NO will-change:transform on the strip — rasterisation must be a pure
   function of heading for deterministic captures. */
.ow-compass-strip { position:absolute; left:0; top:0; height:100%; }
.ow-tick {
  position:absolute; top: calc(26px * var(--k));
  width: calc(1.5px * var(--k)); background: rgba(255,255,255,.6);
  height: calc(5px * var(--k));
  box-shadow: 0 0 calc(2px * var(--k)) rgba(0,0,0,.6);
}
.ow-tick.maj { height: calc(9px * var(--k)); top: calc(23px * var(--k)); background: rgba(255,255,255,.9); }
.ow-tick-l {
  position:absolute; top: calc(1px * var(--k)); transform: translateX(-50%) scaleX(.86);
  font-family: var(--fd); font-size: calc(21px * var(--k)); letter-spacing:0; font-weight:700;
  color: #fff; text-shadow: var(--sh);
}
.ow-tick-l.sub { font-size: calc(16px * var(--k)); top: calc(4px * var(--k)); color: rgba(240,244,246,.94); }
.ow-tick-l.num { font-size: calc(14px * var(--k)); top: calc(6px * var(--k)); color: rgba(232,238,242,.78); }
.ow-compass-base { display:none; }
.ow-compass-caret {
  position:absolute; left:50%; top:calc(35px * var(--k)); transform:translateX(-50%);
  width:0; height:0;
  border-left: calc(5px * var(--k)) solid transparent;
  border-right: calc(5px * var(--k)) solid transparent;
  border-bottom: calc(6px * var(--k)) solid #fff;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,.6));
}
.ow-compass-hdg {
  position:absolute; left:50%; top:calc(var(--pad) * .6 + 43px * var(--k));
  transform: translateX(-50%);
  font-family: var(--fd); font-size: calc(17px * var(--k)); font-weight:700; line-height:1;
  color: var(--ink); text-shadow: var(--sh);
  padding: calc(3px * var(--k)) calc(7px * var(--k));
  background: rgba(8,11,14,.45);
  min-width: calc(42px * var(--k)); text-align:center;
}
.ow-compass-obj {
  position:absolute; top: calc(2px * var(--k)); transform:translateX(-50%);
  font-size: calc(13px * var(--k)); font-weight:700;
  width: calc(20px * var(--k)); height: calc(20px * var(--k));
  display:flex; align-items:center; justify-content:center;
  color:#fff; background: rgba(40,130,210,.9); border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(255,255,255,.7), 0 1px 2px rgba(0,0,0,.6);
  will-change: transform;
}

/* ============================================================= score
   Under the minimap: a solid plate per team, score chip + progress rule,
   mode and round clock to the right. */
.ow-score {
  position:absolute; left:var(--pad); top:calc(var(--pad) + 250px * var(--k) + 8px * var(--k));
  width: calc(250px * var(--k));
  display:grid; grid-template-columns: 1fr auto; column-gap: calc(10px * var(--k)); row-gap: calc(4px * var(--k));
  padding: calc(6px * var(--k)) calc(8px * var(--k));
  background: linear-gradient(to right, rgba(8,11,14,.55), rgba(8,11,14,.38));
}
.ow-sc-row { grid-column:1; display:flex; align-items:center; gap: calc(8px * var(--k)); }
.ow-sc-row b {
  font-family: var(--fd); font-size: calc(21px * var(--k)); font-weight:700; line-height:1;
  min-width: calc(40px * var(--k)); text-align:center;
  padding: calc(2px * var(--k)) calc(4px * var(--k));
  color:#fff; text-shadow: 0 1px 1px rgba(0,0,0,.4);
}
.ow-sc-row.us b { background: rgba(38,120,196,.9); }
.ow-sc-row.them b { background: rgba(196,52,38,.9); }
.ow-sc-bar { flex:1; height: calc(4px * var(--k)); background: rgba(255,255,255,.1); }
.ow-sc-bar i { display:block; height:100%; width:100%; transform-origin:left; }
.ow-sc-row.us .ow-sc-bar i { background:#5fb2ff; }
.ow-sc-row.them .ow-sc-bar i { background:#ff5a44; }
.ow-sc-meta {
  grid-column:2; grid-row:1 / span 2;
  display:flex; flex-direction:column; align-items:flex-end; justify-content:center; gap: calc(3px * var(--k));
  font-size: calc(12px * var(--k)); font-weight:700; letter-spacing:.05em; color: rgba(226,232,236,.78); text-shadow: var(--sh);
}
.ow-sc-meta .clock { font-family: var(--fd); font-size: calc(24px * var(--k)); font-weight:700; color: var(--ink); letter-spacing:0; line-height:1; }
.ow-match { display:none; }

/* =============================================================== minimap */
.ow-minimap {
  position:absolute; left:var(--pad); top:var(--pad);
  width: calc(250px * var(--k)); height: calc(250px * var(--k));
}
.ow-minimap canvas {
  position:absolute; inset:0; width:100%; height:100%; display:block;
  border-radius: calc(3px * var(--k));
  opacity: .94;
  box-shadow: 0 0 0 1px rgba(255,255,255,.16), 0 calc(1px * var(--k)) calc(6px * var(--k)) rgba(0,0,0,.35);
}
.ow-mm-corner { display:none; }
.ow-mm-n {
  position:absolute; left:50%; top:50%;
  font-family: var(--fd); font-size: calc(14px * var(--k)); font-weight:700; color: var(--ink); text-shadow: 0 0 calc(3px * var(--k)) rgba(0,0,0,.9);
}
.ow-mm-tag { display:none; }

/* ========================================================= world markers */
.ow-mk {
  position:absolute; left:0; top:0;
  display:flex; flex-direction:column; align-items:center;
  will-change: transform, opacity;
}
.ow-mk-glyph { position:relative; width:calc(16px * var(--k)); height:calc(16px * var(--k)); }
.ow-mk-glyph svg { position:absolute; inset:0; width:100%; height:100%; display:block; overflow:visible;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,.85)); }
.ow-mk-letter {
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  font-size: calc(9.5px * var(--k)); color:#08161c; font-weight:700;
}
.ow-mk-dist {
  margin-top: calc(var(--u) * .6);
  font-size: calc(10px * var(--k)); letter-spacing:.12em; color: var(--ink);
  text-shadow: var(--sh);
}
.ow-mk-name { font-size: calc(9px * var(--k)); letter-spacing:.18em; color: var(--ink-2); text-shadow:var(--sh); }
.ow-mk.threat .ow-mk-dist { color: var(--red); }

/* grenade danger */
.ow-nade { position:absolute; left:0; top:0; will-change: transform, opacity; }
.ow-nade-ring {
  position:absolute; left:50%; top:50%; width:calc(30px * var(--k)); height:calc(30px * var(--k));
  margin:calc(-15px * var(--k)) 0 0 calc(-15px * var(--k));
  border: calc(1.5px * var(--k)) solid var(--red); border-radius:50%;
  will-change: transform, opacity;
}
.ow-nade-core {
  position:absolute; left:50%; top:50%; width:calc(15px * var(--k)); height:calc(15px * var(--k));
  margin:calc(-7.5px * var(--k)) 0 0 calc(-7.5px * var(--k));
}
.ow-nade-core svg { width:100%; height:100%; display:block; filter:drop-shadow(0 1px 2px rgba(0,0,0,.9)); }
.ow-nade-label {
  position:absolute; left:50%; top:calc(13px * var(--k)); transform:translateX(-50%);
  font-size: calc(9px * var(--k)); letter-spacing:.24em; color:var(--red); white-space:nowrap;
  text-shadow: var(--sh);
}

/* ======================================================== damage numbers */
.ow-dn {
  position:absolute; left:0; top:0; font-family: var(--fd);
  font-size: calc(17px * var(--k)); font-weight:700; letter-spacing:.03em;
  color: var(--ink); text-shadow: 0 1px 2px rgba(0,0,0,.95), 0 0 calc(8px * var(--k)) rgba(0,0,0,.6);
  will-change: transform, opacity;
}
.ow-dn.hs   { color: var(--amber); font-size: calc(21px * var(--k)); }
.ow-dn.kill { color: var(--red);   font-size: calc(23px * var(--k)); }
.ow-dn.armour { color: var(--cyan); }

/* ================================================================ prompt */
.ow-prompt {
  position:absolute; left:50%; top:66%;
  transform: translate(-50%,-50%);
  display:flex; align-items:center; gap: calc(9px * var(--k));
  padding: calc(6px * var(--k)) calc(14px * var(--k));
  background: linear-gradient(to right, rgba(8,11,14,0), rgba(8,11,14,.55) 18%, rgba(8,11,14,.55) 82%, rgba(8,11,14,0));
  text-transform:none; white-space:nowrap;
  will-change: opacity, transform;
}
.ow-key {
  min-width: calc(28px * var(--k)); height: calc(28px * var(--k));
  padding: 0 calc(6px * var(--k));
  display:flex; align-items:center; justify-content:center;
  font-size: calc(16px * var(--k)); font-weight:700; color:#101315;
  background: rgba(240,243,245,.95); border-radius: calc(3px * var(--k));
  box-shadow: 0 1px 3px rgba(0,0,0,.45);
}
.ow-prompt-txt { font-size: calc(19px * var(--k)); font-weight:600; letter-spacing:0; text-shadow: var(--sh); }
.ow-prompt-sub { display:none !important; }
.ow-prompt-arc { position:absolute; left:calc(-6px * var(--k)); top:50%; }

/* ================================================================ banner
   Score popup under the reticle: "+100" over the event name. */
.ow-banner {
  position:absolute; left:50%; top:57%;
  transform: translate(-50%,-50%);
  display:flex; flex-direction:column-reverse; align-items:center; gap: calc(1px * var(--k));
  text-align:center;
  will-change: opacity, transform;
}
.ow-banner-t {
  font-size: calc(16px * var(--k)); letter-spacing:.06em; font-weight:700;
  color: var(--ink); text-shadow: var(--sh);
}
.ow-banner-s {
  font-family: var(--fd);
  font-size: calc(30px * var(--k)); letter-spacing:0; font-weight:700; line-height:1;
  color: #f6d25e; text-shadow: var(--sh);
}
.ow-banner-rule { display:none; }

/* ================================================================== menu */
.ow-menu {
  position:absolute; inset:0; pointer-events:auto;
  background: linear-gradient(105deg, rgba(4,6,8,.90) 0%, rgba(4,6,8,.72) 46%, rgba(4,6,8,.42) 100%);
  backdrop-filter: blur(calc(9px * var(--k))) saturate(.7) brightness(.8);
  opacity:0; will-change: opacity;
}
.ow-menu-inner {
  position:absolute; left: calc(var(--u) * 22); top:50%;
  transform: translateY(-50%);
  width: calc(430px * var(--k));
  padding-left: calc(var(--u) * 4.5);
  border-left: calc(2px * var(--k)) solid var(--amber);
}
.ow-menu h1 {
  font-family: var(--fd);
  font-size: calc(46px * var(--k)); font-weight:700; letter-spacing:.3em;
  text-shadow: 0 2px 6px rgba(0,0,0,.8);
}
.ow-menu .sub {
  margin-top: calc(var(--u) * 1.2); font-size: calc(10px * var(--k));
  letter-spacing:.28em; color: var(--ink-3);
}
.ow-menu .rule {
  margin: calc(var(--u) * 5) 0 calc(var(--u) * 2); height:1px;
  background: linear-gradient(to right, rgba(255,255,255,.28), rgba(255,255,255,0));
}
.ow-row {
  display:flex; align-items:center; justify-content:space-between;
  gap: calc(var(--u) * 4); padding: calc(var(--u) * 3.2) 0;
  border-bottom: 1px solid var(--hair-2);
}
.ow-row > .name { font-size: calc(11.5px * var(--k)); letter-spacing:.2em; color: var(--ink); }
.ow-row > .val { font-family: var(--fm); font-size: calc(11px * var(--k)); color: var(--amber);
  letter-spacing:.04em; min-width: calc(46px * var(--k)); text-align:right; }
.ow-seg { display:flex; gap:0; }
.ow-seg button {
  appearance:none; border:1px solid var(--hair); border-right:0; background:rgba(255,255,255,.03);
  color: var(--ink-2); font-family:var(--ff); font-weight:600; text-transform:uppercase;
  font-size: calc(10px * var(--k)); letter-spacing:.16em;
  padding: calc(var(--u) * 1.3) calc(var(--u) * 2.2);
  cursor:pointer; position:relative; transition: color .12s, background .12s;
}
.ow-seg button:last-child { border-right:1px solid var(--hair); }
.ow-seg button:hover { color: var(--ink); background: rgba(255,255,255,.07); }
.ow-seg button.on { color:#0b0d0f; background: var(--ink); }
.ow-slider { position:relative; width: calc(190px * var(--k)); height: calc(18px * var(--k)); }
.ow-slider .track {
  position:absolute; left:0; right:0; top:50%; height: calc(2px * var(--k));
  transform: translateY(-50%); background: rgba(255,255,255,.16);
}
.ow-slider .fill {
  position:absolute; left:0; top:50%; height: calc(2px * var(--k));
  transform: translateY(-50%); background: var(--amber);
}
.ow-slider .knob {
  position:absolute; top:50%; width: calc(9px * var(--k)); height: calc(9px * var(--k));
  background: var(--amber); transform: translate(-50%,-50%) rotate(45deg);
  box-shadow: 0 0 calc(6px * var(--k)) rgba(255,176,42,.5);
}
.ow-slider input {
  position:absolute; inset:0; width:100%; height:100%; margin:0;
  appearance:none; background:transparent; cursor:pointer; opacity:0;
}
.ow-btns { margin-top: calc(var(--u) * 5); display:flex; gap: calc(var(--u) * 2.5); }
.ow-btn {
  appearance:none; border:1px solid var(--hair); background: rgba(255,255,255,.04);
  color: var(--ink); font-family: var(--ff); font-weight:600; text-transform:uppercase;
  font-size: calc(11px * var(--k)); letter-spacing:.2em;
  padding: calc(var(--u) * 2.2) calc(var(--u) * 5);
  cursor:pointer; transition: background .12s, border-color .12s;
}
.ow-btn:hover { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.4); }
.ow-btn.primary { background: var(--amber); border-color: var(--amber); color:#100b02; }
.ow-btn.primary:hover { background:#ffc251; }
.ow-menu .hint {
  margin-top: calc(var(--u) * 4); font-size: calc(9.5px * var(--k));
  letter-spacing:.2em; color: var(--ink-3);
}

/* ============================================================== fadeouts */
.ow-hidden { display:none !important; }
`;

const DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <!-- organic edge for the blood vignette: banded turbulence displacing the
         gradient so the hurt overlay never reads as a clean radial ramp -->
    <filter id="ow-warp" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves="4" seed="17" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>
</svg>`;

let installed = false;

export function installStyles() {
  if (installed && document.getElementById('ow-ui-style')) return;
  const s = document.createElement('style');
  s.id = 'ow-ui-style';
  s.textContent = CSS;
  document.head.appendChild(s);
  const d = document.createElement('div');
  d.id = 'ow-ui-defs';
  d.innerHTML = DEFS;
  document.body.appendChild(d);
  installed = true;
}

export function removeStyles() {
  document.getElementById('ow-ui-style')?.remove();
  document.getElementById('ow-ui-defs')?.remove();
  installed = false;
}
