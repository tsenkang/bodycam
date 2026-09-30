import { box, mergeAll } from './geometry.js';

/**
 * Laser-engraved markings: real, readable text, built from a 5x7 pixel font.
 *
 * A receiver with a comb of anonymous bars where the rollmark should be reads
 * as a prop; a line of legible small caps reads as a manufactured part. Each
 * lit pixel becomes a 0.1 mm-proud tile on the side plane, merged per line and
 * assigned the light `engrave` fill material, so the text survives the AA
 * filter as a lighter grey on the black anodising exactly as a real
 * paint-filled engraving does.
 */

// 5 columns x 7 rows, top row first, '#' = lit.
const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

/**
 * Text on a plane whose normal is -X (the weapon's left flank), reading from
 * front (-Z) to rear (+Z) — the muzzle is on the viewer's left, baseline at y. `side` +1 puts it on the right flank
 * (normal +X) reading rear to front.
 *
 * Horizontal runs of lit pixels merge into one tile, so a line of 30
 * characters is a few hundred boxes rather than a thousand.
 */
export function engraveText(text, o = {}) {
  const px = (o.height ?? 0.0032) / 7;
  const depth = o.depth ?? 0.0002;
  const side = o.side ?? -1;
  const parts = [];
  let cx = 0;
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS[' '];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      let c = 0;
      while (c < 5) {
        if (row[c] !== '#') {
          c++;
          continue;
        }
        let e = c;
        while (e < 5 && row[e] === '#') e++;
        const w = (e - c) * px;
        const b = box(depth, px * 0.92, w - px * 0.08, 0, 1);
        // column advance runs along +Z on the left flank, -Z on the right
        b.translate(0, (6 - r) * px + px * 0.5, side < 0 ? cx + (c + e) * 0.5 * px : -(cx + (c + e) * 0.5 * px));
        parts.push(b);
        c = e;
      }
    }
    cx += px * 6;
  }
  const geo = mergeAll(parts);
  return { geo, length: cx - px };
}

/** Engrave a line into an Assembly on the weapon's left (or right) flank. */
export function addEngraving(asm, mat, text, o) {
  const { geo } = engraveText(text, o);
  if (!geo) return;
  asm.add(geo, mat, { x: o.x, y: o.y, z: o.z, rx: o.rx ?? 0 });
  geo.dispose();
}
