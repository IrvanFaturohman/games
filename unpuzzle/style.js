// Unpuzzle's local geometry.
//
// The suite is flat — `shared/tokens.js` sets STYLE.radius 0, no shadows, sharp
// corners — and this game deliberately is not. See CLAUDE.md, "Visual style:
// chunky here, flat everywhere else". Colour, type and spacing still come from
// the shared tokens; only the shapes are local, and they live only here.

import { COLOR, ACCENT } from '../shared/tokens.js';

// Every value is a fraction of the cell, never a fixed pixel count, so a tile
// reads the same on a 360px phone as on a tablet.
export const GEO = {
  radius:       0.20,
  inset:        0.055,  // gap between neighbouring tiles
  depth:        0.10,   // the tile's apparent thickness, below its face
  shadowOffset: 0.13,
  shadowAlpha:  0.13,
};

// The tile face is one colour for every tile, as in the reference — the picture
// is carried by the silhouette and the arrow colours, not by the tiles.
export const TILE = { face: '#F7E7C9', edge: '#DFC395' };

// Arrow colours are game content, not suite tokens — stick-hero and polygram
// have no tiles. These mirror the `color/piece-*` variables in this game's
// Figma file; change both together or they drift.
export const PIECE = {
  green:  ACCENT.unpuzzle,
  coral:  '#F0554B',
  amber:  '#F2A73B',
  blue:   '#4D9DE0',
  violet: '#B05BC4',
  orange: '#E8762C',
  sky:    '#6EC1E4',
  pink:   '#FF9BC2',
  ink:    '#4A3B36',
};

// Written out rather than using ctx.roundRect, which only reached Safari in
// 16.4 — this game is judged on whatever phone is in a pocket. Traced onto
// anything with the path methods, so one implementation serves both a context
// and a Path2D.
function trace(sink, x, y, w, h, [tl, tr, br, bl]) {
  const m = Math.min(w, h) / 2;
  const a = Math.min(tl, m), b = Math.min(tr, m);
  const c = Math.min(br, m), d = Math.min(bl, m);
  sink.moveTo(x + a, y);
  sink.lineTo(x + w - b, y);
  if (b) sink.arcTo(x + w, y, x + w, y + b, b);
  sink.lineTo(x + w, y + h - c);
  if (c) sink.arcTo(x + w, y + h, x + w - c, y + h, c);
  sink.lineTo(x + d, y + h);
  if (d) sink.arcTo(x, y + h, x, y + h - d, d);
  sink.lineTo(x, y + a);
  if (a) sink.arcTo(x, y, x + a, y, a);
  sink.closePath();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  trace(ctx, x, y, w, h, Array.isArray(r) ? r : [r, r, r, r]);
}

// The animal's full footprint, faint, under everything. Tiles cover it exactly,
// so it only shows where one has already left — and once the board is clear it
// is the whole silhouette, which is what the player spent the level taking apart.
//
// Drawn as one shape: a corner is rounded only where both cells that would touch
// it are absent, so cells inside the blob butt together square and the union
// reads as a single outline rather than a grid of squares.
export function drawGhost(ctx, cells, ox, oy, cell) {
  const set = new Set(cells.map(([x, y]) => x + ',' + y));
  const has = (x, y) => set.has(x + ',' + y);
  const r = GEO.radius * cell;
  const path = new Path2D();
  for (const [cx, cy] of cells) {
    const L = has(cx - 1, cy), R = has(cx + 1, cy);
    const U = has(cx, cy - 1), D = has(cx, cy + 1);
    trace(path, ox + cx * cell, oy + cy * cell, cell, cell, [
      (!L && !U) ? r : 0, (!R && !U) ? r : 0,
      (!R && !D) ? r : 0, (!L && !D) ? r : 0,
    ]);
  }
  ctx.save();
  ctx.fillStyle = COLOR.line;
  ctx.globalAlpha = 0.5;
  ctx.fill(path);
  ctx.restore();
}

// The shape points up at zero rotation, so this is how far to turn it.
const TURN = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };

// A blocky arrow — shaft plus head — stroked in its own colour with round joins,
// which is what softens the corners without a second path.
function arrow(ctx, cx, cy, size, color, dir) {
  const s = size * 0.30;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(TURN[dir]);
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.10);
  ctx.lineTo(s * 1.00, -s * 0.05);
  ctx.lineTo(s * 0.44, -s * 0.05);
  ctx.lineTo(s * 0.44, s * 0.95);
  ctx.lineTo(-s * 0.44, s * 0.95);
  ctx.lineTo(-s * 0.44, -s * 0.05);
  ctx.lineTo(-s * 1.00, -s * 0.05);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.11;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

// One tile: a dropped shadow, the thickness below the face, the face, the arrow.
// Deliberately not ctx.shadowBlur — a blurred shadow per tile per frame is the
// kind of thing that quietly costs frames on a mid-range phone, and at this size
// an offset silhouette is indistinguishable.
export function drawTile(ctx, x, y, cell, color, dir, alpha = 1) {
  const inset = GEO.inset * cell;
  const w = cell - inset * 2;
  const r = GEO.radius * cell;
  const left = x + inset, top = y + inset;

  ctx.save();

  ctx.globalAlpha = alpha * GEO.shadowAlpha;
  roundRect(ctx, left, top + GEO.shadowOffset * cell, w, w, r);
  ctx.fillStyle = COLOR.base;
  ctx.fill();

  ctx.globalAlpha = alpha;
  roundRect(ctx, left, top + GEO.depth * cell, w, w, r);
  ctx.fillStyle = TILE.edge;
  ctx.fill();

  roundRect(ctx, left, top, w, w, r);
  ctx.fillStyle = TILE.face;
  ctx.fill();

  arrow(ctx, left + w / 2, top + w / 2, w, color, dir);
  ctx.restore();
}
