// Turns a picture into a solvable puzzle.
//
// Levels are authored as art only. This file cuts the silhouette into polyomino
// pieces and assigns each one an exit — both derived at load from a fixed seed,
// so the puzzle is identical every play but no exit table has to be kept in sync
// with the art by hand.
//
// Exits are peeled, never guessed: repeatedly take a piece that has a clear
// straight run to an edge given whatever is still on the board, assign it that
// direction, and remove it. The peel order is by construction a solution, so a
// carve that returns at all is a level that can be finished.

const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const DIRS = Object.keys(DIR);

const key = (x, y) => x + ',' + y;
const unkey = (k) => k.split(',').map(Number);

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];

// Grow blobs of 4–6 cells from random seeds. Smaller than this and the white
// seams chop the picture into confetti; larger and a single tap clears too much
// of the animal at once. Leftovers pinched off by earlier blobs come out small,
// which is fine — a one-cell piece still reads.
function cut(cellKeys, rand) {
  const free = new Set(cellKeys);
  const pieces = [];
  while (free.size) {
    const start = pick([...free], rand);
    free.delete(start);
    const blob = [start];
    const target = 4 + Math.floor(rand() * 3);
    while (blob.length < target) {
      const edge = [];
      for (const k of blob) {
        const [x, y] = unkey(k);
        for (const [dx, dy] of Object.values(DIR)) {
          const n = key(x + dx, y + dy);
          if (free.has(n)) edge.push(n);
        }
      }
      if (!edge.length) break;
      const next = pick(edge, rand);
      free.delete(next);
      blob.push(next);
    }
    pieces.push(blob.map(unkey));
  }
  return pieces;
}

// Random growth strands single cells behind it. Left alone they show up as
// confetti in the picture and as fiddly one-cell tap targets, so anything under
// `min` is folded into its smallest neighbour.
function mergeStrays(pieces, min = 3, cap = 8) {
  const owner = new Map();
  pieces.forEach((p, i) => p.forEach(([x, y]) => owner.set(key(x, y), i)));
  for (let pass = 0; pass < pieces.length; pass++) {
    let merged = false;
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      if (!p || p.length >= min) continue;
      const near = new Set();
      for (const [x, y] of p) {
        for (const [dx, dy] of Object.values(DIR)) {
          const j = owner.get(key(x + dx, y + dy));
          if (j !== undefined && j !== i && pieces[j]) near.add(j);
        }
      }
      const fits = [...near].filter((j) => pieces[j].length + p.length <= cap);
      if (!fits.length) continue;
      const into = fits.reduce((a, b) => (pieces[a].length <= pieces[b].length ? a : b));
      pieces[into] = pieces[into].concat(p);
      p.forEach(([x, y]) => owner.set(key(x, y), into));
      pieces[i] = null;
      merged = true;
    }
    if (!merged) break;
  }
  return pieces.filter(Boolean);
}

function clearDirs(cols, rows, live, idx) {
  const p = live[idx];
  const occ = new Set();
  live.forEach((q, i) => { if (i !== idx && q) q.forEach(([x, y]) => occ.add(key(x, y))); });
  return DIRS.filter((d) => {
    const [dx, dy] = DIR[d];
    for (let s = 1; s <= cols + rows + 2; s++) {
      let allOut = true;
      for (const [cx, cy] of p) {
        const x = cx + dx * s, y = cy + dy * s;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        allOut = false;
        if (occ.has(key(x, y))) return false;
      }
      if (allOut) return true;
    }
    return true;
  });
}

function peel(cols, rows, pieces, rand) {
  const live = pieces.map((p) => p.slice());
  const exits = new Array(pieces.length);
  let left = pieces.length;
  while (left > 0) {
    const options = [];
    live.forEach((p, i) => {
      if (!p) return;
      for (const d of clearDirs(cols, rows, live, i)) options.push([i, d]);
    });
    if (!options.length) return null;   // a piece is boxed in; caller re-cuts
    const [i, d] = pick(options, rand);
    exits[i] = d;
    live[i] = null;
    left--;
  }
  return exits;
}

// How many pieces can move on turn one — the only difficulty knob there is,
// since the ruleset cannot dead-end.
export function freeOnTurnOne(cols, rows, pieces, exits) {
  const live = pieces.map((p) => p.slice());
  return pieces.filter((p, i) => clearDirs(cols, rows, live, i).includes(exits[i])).length;
}

// Returns { cols, rows, pieces: [{cells, dir, paint}], eyes, tries }.
export function carve(level, { seed = 1, tries = 200 } = {}) {
  const rows = level.art.length;
  const cols = level.art[0].length;
  if (level.art.some((r) => r.length !== cols)) {
    throw new Error(`level "${level.name}": art rows are not the same length`);
  }

  const paint = new Map();
  level.art.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    const color = level.palette[ch];
    if (!color) throw new Error(`level "${level.name}": no colour for '${ch}'`);
    paint.set(key(x, y), color);
  }));

  for (let t = 0; t < tries; t++) {
    const rand = rng(seed + t * 7919);
    const cells = mergeStrays(cut([...paint.keys()], rand));
    const exits = peel(cols, rows, cells, rand);
    if (!exits) continue;
    return {
      name: level.name,
      cols, rows,
      eyes: level.eyes ?? [],
      tries: t + 1,
      pieces: cells.map((cs, i) => ({
        cells: cs,
        dir: exits[i],
        paint: (x, y) => paint.get(key(x, y)),
      })),
    };
  }
  throw new Error(`level "${level.name}": no solvable cut in ${tries} tries`);
}
