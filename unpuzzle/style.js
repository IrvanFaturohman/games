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

// Tile colours are game content, not suite tokens — stick-hero and polygram have
// no tiles. These mirror the `color/piece-*` variables in this game's Figma file;
// change both together or they drift.
export const PIECE = {
  green:  ACCENT.unpuzzle,
  coral:  '#F0554B',
  amber:  '#F2A73B',
  blue:   '#4D9DE0',
  violet: '#B05BC4',
  orange: '#E8762C',
  sky:    '#4FB3DE',
  sea:    '#7CC8E8',
  pink:   '#FF9BC2',
  cream:  '#FFE7BE',
  leaf:   '#5DBB63',
  wood:   '#B0763F',
  plum:   '#7E57A6',
  ink:    '#4A3B36',
};

// The tile carries the picture, so its thickness and its arrow are both derived
// from its own colour rather than being fixed.
// Returns hex, not rgb(): the result is fed back into shade() and arrowInk(),
// both of which parse hex. Mixing the two formats silently produces NaN
// channels and black tiles.
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
  const v = (f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255);
  return '#' + v.toString(16).padStart(6, '0');
}

// A large field of one flat colour reads as a slab. Nudging each tile a few
// percent either way by its own coordinates turns it into a surface — richer at
// a glance, and still obviously one colour. Deterministic, so it is computed
// once at load and never per frame.
export function tone(hex, x, y) {
  const step = ((x * 7 + y * 13) % 5) - 2;      // -2..2
  return shade(hex, 1 + step * 0.045);
}

// Blend toward another colour — used for the wash behind the board, which is the
// level's own dominant colour pulled most of the way back to the page.
export function mix(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16);
  const ch = (sh) => Math.round((((a >> sh) & 255) * (1 - t)) + (((b >> sh) & 255) * t));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// A white arrow vanishes on a cream muzzle and a dark one vanishes on an eye, so
// pick per tile by luminance. The threshold sits high on purpose: a board of
// mostly white arrows reads as one set, and only genuinely pale faces break away.
function arrowInk(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.80 ? shade(hex, 0.42) : '#FFFFFF';
}

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

// The shape points up at zero rotation, so this is how far to turn it.
const TURN = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };

// Head plus tail, not a bare triangle.
//
// A triangle on its own points, but only once you have worked out which corner
// is the tip — rotate it and players hesitate. The tail removes the question
// instantly, so it stays even though it costs a few points on the path.
//
// Slimmer and smaller than the original chunky arrow: the tile's colour carries
// the picture, and the mark on it only has to say which way. The stem tapers
// slightly toward the back, which is the difference between a drawn arrow and a
// default one. Stroked in its own colour with round joins — that rounds the
// corners without a second path.
function arrow(ctx, cx, cy, size, color, dir) {
  const s = size * 0.235;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(TURN[dir]);
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.15);
  ctx.lineTo(s * 0.95, -s * 0.02);
  ctx.lineTo(s * 0.34, -s * 0.02);
  ctx.lineTo(s * 0.26, s * 0.98);
  ctx.lineTo(-s * 0.26, s * 0.98);
  ctx.lineTo(-s * 0.34, -s * 0.02);
  ctx.lineTo(-s * 0.95, -s * 0.02);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.08;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

// One tile: a dropped shadow, the thickness below the face, the face in the
// picture's colour, and the arrow on top.
//
// Deliberately not ctx.shadowBlur — a blurred shadow per tile per frame is the
// kind of thing that quietly costs frames on a mid-range phone, and at this size
// an offset silhouette is indistinguishable.
//
// `press` sinks the face onto its own thickness, which is what makes a tile feel
// like a key rather than a picture of one. `stretch` runs along the travel axis,
// so a tile leaving the board smears the way a thrown object does.
export function drawTile(ctx, x, y, cell, color, dir, opts = {}) {
  const { alpha = 1, press = 0, scale = 1, stretch = 1 } = opts;
  if (alpha <= 0 || scale <= 0) return;

  const inset = GEO.inset * cell;
  const w = cell - inset * 2;
  const r = GEO.radius * cell;
  const left = x + inset, top = y + inset;
  const depth = GEO.depth * cell;
  const sink = press * depth;
  const along = dir === 'left' || dir === 'right';

  ctx.save();
  if (scale !== 1 || stretch !== 1) {
    const cx = x + cell / 2, cy = y + cell / 2;
    ctx.translate(cx, cy);
    ctx.scale(scale * (along ? stretch : 1), scale * (along ? 1 : stretch));
    ctx.translate(-cx, -cy);
  }

  // The shadow tightens as the tile is pushed down — that, more than the travel
  // itself, is what sells the press.
  ctx.globalAlpha = alpha * GEO.shadowAlpha * (1 - press * 0.65);
  roundRect(ctx, left, top + GEO.shadowOffset * cell - sink * 0.5, w, w, r);
  ctx.fillStyle = COLOR.base;
  ctx.fill();

  ctx.globalAlpha = alpha;
  roundRect(ctx, left, top + depth, w, w, r);
  ctx.fillStyle = shade(color, 0.74);
  ctx.fill();

  roundRect(ctx, left, top + sink, w, w, r);
  ctx.fillStyle = color;
  ctx.fill();

  arrow(ctx, left + w / 2, top + sink + w / 2, w, arrowInk(color), dir);
  ctx.restore();
}
