// Unpuzzle's local geometry.
//
// The suite is flat — `shared/tokens.js` sets STYLE.radius 0, no shadows, sharp
// corners — and this game deliberately is not. See CLAUDE.md, "Visual style:
// chunky here, flat everywhere else". Colour, type and spacing still come from
// the shared tokens; only the shapes are local, and they live only here.

import { COLOR, ACCENT } from '../shared/tokens.js';

// Every value is a fraction of the cell, never a fixed pixel count, so a piece
// reads the same on a 360px phone as on a tablet.
export const GEO = {
  radius:       0.18,
  outline:      0.055,  // the die-cut white edge
  inset:        0.05,   // pulls a piece off its cell bounds so neighbours separate
  shadowOffset: 0.05,
  shadowAlpha:  0.16,
  plate:        0.14,   // board plate padding, in cells — layout must reserve it
  plateRadius:  0.22,
};

// Piece colours are game content, not suite tokens — stick-hero and polygram
// have no pieces. These mirror the `color/piece-*` variables in this game's
// Figma file; change both together or they drift.
export const PIECE = {
  green:  ACCENT.unpuzzle,
  coral:  '#FF6B6B',
  amber:  '#FFC93C',
  blue:   '#4D9DE0',
  violet: '#A06CD5',
  orange: '#FF9F45',
  sky:    '#8ED2F5',
  pink:   '#FF9BC2',
  ink:    COLOR.base,
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

// One sticker, not a pile of tiles.
//
// A corner is rounded only where both cells that would touch it are absent, and
// an edge is inset only where the piece has no neighbour of its own there. Cells
// inside the piece therefore butt together at full size with square corners, so
// the union fills seamlessly and only the outer boundary carries the shape.
//
// `grow` pushes that outer boundary outward without disturbing internal edges —
// that is what draws the white edge and the shadow from the same footprint.
function piecePath(cells, has, ox, oy, cell, grow) {
  const inset = GEO.inset * cell;
  const r = GEO.radius * cell + grow;
  const path = new Path2D();
  for (const [cx, cy] of cells) {
    const L = has(cx - 1, cy), R = has(cx + 1, cy);
    const U = has(cx, cy - 1), D = has(cx, cy + 1);
    const l = L ? 0 : inset - grow, r0 = R ? 0 : inset - grow;
    const t = U ? 0 : inset - grow, b = D ? 0 : inset - grow;
    trace(path,
      ox + cx * cell + l, oy + cy * cell + t,
      cell - l - r0, cell - t - b,
      [(!L && !U) ? r : 0, (!R && !U) ? r : 0,
       (!R && !D) ? r : 0, (!L && !D) ? r : 0]);
  }
  return path;
}

// The animal's full footprint, faint, under everything. Pieces cover it exactly,
// so it only shows where one has already left — and once the board is clear it
// is the whole silhouette, which is what the player spent the level taking apart.
export function drawGhost(ctx, cells, ox, oy, cell) {
  const set = new Set(cells.map(([x, y]) => x + ',' + y));
  const has = (x, y) => set.has(x + ',' + y);
  ctx.save();
  ctx.fillStyle = COLOR.line;
  ctx.globalAlpha = 0.55;
  ctx.fill(piecePath(cells, has, ox, oy, cell, 0));
  ctx.restore();
}

// Three fills of the same footprint: offset silhouette, white edge, body.
// Deliberately not ctx.shadowBlur — a blurred shadow per piece per frame is the
// kind of thing that quietly costs frames on a mid-range phone, and at this size
// the offset version is indistinguishable.
export function drawPiece(ctx, cells, has, ox, oy, cell, colorAt, alpha = 1) {
  const edge = GEO.outline * cell;
  const outer = piecePath(cells, has, ox, oy, cell, edge);
  const body  = piecePath(cells, has, ox, oy, cell, 0);

  ctx.save();
  ctx.globalAlpha = alpha * GEO.shadowAlpha;
  ctx.translate(0, GEO.shadowOffset * cell);
  ctx.fillStyle = COLOR.base;
  ctx.fill(outer);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLOR.white;
  ctx.fill(outer);
  // The picture rides the piece: every cell keeps its own colour from the art,
  // clipped to the piece outline so the sticker edge stays one clean shape and
  // a single piece can carry more than one colour.
  ctx.clip(body);
  for (const [cx, cy] of cells) {
    ctx.fillStyle = colorAt(cx, cy);
    ctx.fillRect(ox + cx * cell - 0.5, oy + cy * cell - 0.5, cell + 1, cell + 1);
  }
  ctx.restore();
}
