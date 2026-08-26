// Turns a picture into a solvable puzzle.
//
// Every cell of the art is one tile — no cutting, no merging. All this file does
// is decide which way each tile points, and it peels rather than guesses:
// repeatedly take a tile with a clear straight run to an edge given whatever is
// still on the board, assign it that direction, remove it. The peel order is by
// construction a solution, so a carve that returns is a level that can be
// finished.
//
// Peeling cannot get stuck here: the topmost remaining tile in any column always
// has a clear run upward. The retry loop is belt and braces.

const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const DIRS = Object.keys(DIR);

const key = (x, y) => x + ',' + y;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];

function clearDirs(cols, rows, live, idx) {
  const [px, py] = live[idx];
  const occ = new Set();
  live.forEach((c, i) => { if (i !== idx && c) occ.add(key(c[0], c[1])); });
  return DIRS.filter((d) => {
    const [dx, dy] = DIR[d];
    for (let s = 1; s <= cols + rows + 2; s++) {
      const x = px + dx * s, y = py + dy * s;
      if (x < 0 || y < 0 || x >= cols || y >= rows) return true;
      if (occ.has(key(x, y))) return false;
    }
    return true;
  });
}

function peel(cols, rows, cells, rand) {
  const live = cells.map((c) => c.slice());
  const exits = new Array(cells.length);
  let left = cells.length;
  while (left > 0) {
    const options = [];
    live.forEach((c, i) => {
      if (!c) return;
      for (const d of clearDirs(cols, rows, live, i)) options.push([i, d]);
    });
    if (!options.length) return null;
    const [i, d] = pick(options, rand);
    exits[i] = d;
    live[i] = null;
    left--;
  }
  return exits;
}

// How many tiles can move on turn one — the only difficulty knob there is, since
// the ruleset cannot dead-end.
export function freeOnTurnOne(cols, rows, cells, exits) {
  const live = cells.map((c) => c.slice());
  return cells.filter((c, i) => clearDirs(cols, rows, live, i).includes(exits[i])).length;
}

export function carve(level, { seed = 1, tries = 50 } = {}) {
  const rows = level.art.length;
  const cols = level.art[0].length;
  if (level.art.some((r) => r.length !== cols)) {
    throw new Error(`level "${level.name}": art rows are not the same length`);
  }

  const cells = [];
  const colors = [];
  level.art.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    const color = level.palette[ch];
    if (!color) throw new Error(`level "${level.name}": no colour for '${ch}'`);
    cells.push([x, y]);
    colors.push(color);
  }));

  for (let t = 0; t < tries; t++) {
    const exits = peel(cols, rows, cells, rng(seed + t * 7919));
    if (!exits) continue;
    return {
      name: level.name,
      cols, rows,
      tries: t + 1,
      tiles: cells.map(([x, y], i) => ({ x, y, color: colors[i], dir: exits[i] })),
    };
  }
  throw new Error(`level "${level.name}": no solvable assignment in ${tries} tries`);
}
