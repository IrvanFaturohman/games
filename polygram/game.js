// Polygram — drag the pieces into the silhouette.
//
// Everything lives in level units and goes through one transform on the way to
// the screen (see toX/toY). That is deliberate: solutions are authored in level
// units, and if any of position, snapping or hit-testing used a second mapping,
// the 24 px snap tolerance would quietly mean a different distance on every
// device.

import { boot } from '../shared/boot.js';
import { COLOR, ACCENT } from '../shared/tokens.js';
import { LEVELS, poly } from './levels.js';
import { PIECE, TILE, shade } from './style.js';

const NAME = 'polygram';
const ACC = ACCENT[NAME];

const SNAP_PX = 24;   // how close a vertex has to land — tune with a thumb, not a mouse
const LIFT_PX = 40;   // the dragged piece rides above the finger so it stays visible
const ROT_STEP = 45;  // every angle any solution uses is a multiple of this
const GROW = 9;       // tray -> board scale, units per second

let stage, audio, store;

let level = 0;
let targets = [];              // solution slots, in level units
let pieces = [];
let view = { s: 1, ts: 1, ox: 0, oy: 0, board: null, tray: null };
let drag = null;               // piece under the finger
let tapee = null;              // piece a rotate would apply to
let ghost = -1;                // target index previewed while dragging
let placedN = 0;
let winT = -1;                 // seconds since the silhouette filled; -1 = still playing

const toX = (x) => view.ox + x * view.s;
const toY = (y) => view.oy + y * view.s;
const unX = (X) => (X - view.ox) / view.s;
const unY = (Y) => (Y - view.oy) / view.s;

// --- level setup -----------------------------------------------------------

function loadLevel(n) {
  level = ((n % LEVELS.length) + LEVELS.length) % LEVELS.length;
  const L = LEVELS[level];

  targets = L.solution.map((s, i) => ({ ...s, i, filled: false }));
  pieces = L.solution.map((s, i) => ({
    t: s.t,
    color: PIECE[i % PIECE.length],
    x: 0, y: 0, r: 0,
    state: 'tray',             // tray | loose | placed
    grown: 0,                  // 0 = tray scale, 1 = board scale
    lift: 0,
    flash: 0,
    ti: -1,
  }));

  placedN = 0;
  winT = -1;
  drag = null;
  ghost = -1;
  store.set('level', level);
  layout();
}

// --- layout ----------------------------------------------------------------
//
// Derived from stage.w/h every time, never computed once at startup: the iOS
// URL bar slides away mid-session and changes the height under us.

function layout() {
  const { w, h } = stage;
  const pad = 16;
  const hudH = 72;
  const trayH = Math.max(116, Math.min(190, h * 0.24));

  const board = { x: pad, y: hudH, w: w - pad * 2, h: h - hudH - trayH - pad };
  const tray = { x: pad, y: h - trayH, w: w - pad * 2, h: trayH - pad };

  // Fit the silhouette's own bounding box, so a level that is not 4x4 still
  // fills the board.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of targets) {
    for (const [x, y] of poly(t.t, t.x, t.y, t.r, 1)) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const bw = x1 - x0 || 1;
  const bh = y1 - y0 || 1;
  const s = Math.min(board.w / bw, board.h / bh) * 0.9;

  view = {
    s,
    ts: s * 0.42,
    ox: board.x + (board.w - bw * s) / 2 - x0 * s,
    oy: board.y + (board.h - bh * s) / 2 - y0 * s,
    board,
    tray,
  };

  // Placed pieces are defined by their slot, so they follow the transform.
  for (const p of pieces) {
    if (p.state === 'placed') {
      const t = targets[p.ti];
      p.x = t.x; p.y = t.y; p.r = t.r;
    }
  }
  layoutTray();
}

// Tray slots are recomputed whenever a piece leaves, so the row re-centres
// instead of leaving a hole where the piece was.
//
// The tray scale is derived from the tray box, never from the board scale: on a
// phone the board is roomy and the tray is a short strip, and scaling one off
// the other stacks four rows of pieces straight through each other.
function layoutTray() {
  const inTray = pieces.filter((p) => p.state === 'tray');
  if (!inTray.length) return;

  const { tray } = view;
  const CW = 4.4;   // widest piece plus a gap, in level units
  const CH = 2.8;   // tallest plus a gap

  let best = { ts: 0, cols: inTray.length, rows: 1 };
  for (let rows = 1; rows <= 4; rows++) {
    const cols = Math.ceil(inTray.length / rows);
    const ts = Math.min(tray.w / (cols * CW), tray.h / (rows * CH));
    if (ts > best.ts) best = { ts, cols, rows };
  }

  const { cols, rows } = best;
  const ts = Math.min(best.ts, view.s * 0.6);   // never larger than on the board
  view.ts = ts;

  const cellW = CW * ts;
  const cellH = CH * ts;
  inTray.forEach((p, i) => {
    const row = Math.floor(i / cols);
    const n = Math.min(cols, inTray.length - row * cols);
    const col = i - row * cols;
    p.x = unX(tray.x + tray.w / 2 + (col - (n - 1) / 2) * cellW);
    p.y = unY(tray.y + tray.h / 2 + (row - (rows - 1) / 2) * cellH);
  });
}

// --- geometry --------------------------------------------------------------

const scaleOf = (p) => view.ts + (view.s - view.ts) * p.grown;

// The lift is baked into the centre rather than added at draw time, so the
// polygon that snaps is byte-for-byte the polygon on screen. Applying it in
// both places is how a piece ends up snapping 40 px from where it looks.
const cxOf = (p) => toX(p.x);
const cyOf = (p) => toY(p.y) - p.lift;

function shape(p) {
  return poly(p.t, cxOf(p), cyOf(p), p.r, scaleOf(p));
}

function hit(pts, X, Y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > Y) !== (yj > Y) && X < ((xj - xi) * (Y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Compare vertex sets rather than angles. That makes the square's 4-fold and
// the parallelogram's 2-fold symmetry fall out for free — no per-shape table.
function fits(pv, tv) {
  if (pv.length !== tv.length) return false;
  for (const [tx, ty] of tv) {
    let near = false;
    for (const [px, py] of pv) {
      if (Math.hypot(px - tx, py - ty) <= SNAP_PX) { near = true; break; }
    }
    if (!near) return false;
  }
  return true;
}

function candidate(p) {
  // Tested at the settled board scale, never at the animating one. The question
  // is "if I let go here, does it fit the slot" — and the answer must not depend
  // on how far a grow tween happens to have run. A fast flick would otherwise be
  // tested as a tray-sized piece and miss every time.
  const pv = poly(p.t, cxOf(p), cyOf(p), p.r, view.s);
  let best = -1;
  let bestD = Infinity;
  for (const t of targets) {
    if (t.filled || t.t !== p.t) continue;
    const d = Math.hypot(cxOf(p) - toX(t.x), cyOf(p) - toY(t.y));
    if (d > SNAP_PX * 2.2 || d >= bestD) continue;
    if (!fits(pv, poly(t.t, toX(t.x), toY(t.y), t.r, view.s))) continue;
    best = t.i;
    bestD = d;
  }
  return best;
}

function trySnap(p) {
  const i = candidate(p);
  if (i < 0) return false;

  const t = targets[i];
  t.filled = true;
  p.state = 'placed';
  p.ti = i;
  p.x = t.x; p.y = t.y; p.r = t.r;
  p.grown = 1;
  p.lift = 0;
  p.flash = 1;
  placedN++;

  // Each piece lands a step higher than the last, so filling reads as progress.
  audio.play('place', { rate: 1 + placedN * 0.09 });

  if (placedN === targets.length) {
    winT = 0;
    audio.play('perfect');
  }
  return true;
}

// --- input -----------------------------------------------------------------
//
// A grab has to start on onDown and a rotate has to commit on onTap, because
// input.js fires onHoldEnd -> onUp -> onTap off one release and a still thumb
// lifted between 220 and 350 ms triggers all three.

function onDown(p) {
  tapee = null;
  if (winT >= 0) return;

  // Topmost first: loose pieces sit above tray pieces.
  for (let i = pieces.length - 1; i >= 0; i--) {
    const pc = pieces[i];
    if (pc.state === 'placed') continue;
    if (!hit(shape(pc), p.x, p.y)) continue;

    drag = pc;
    pc.grabDX = pc.x - unX(p.x);
    pc.grabDY = pc.y - unY(p.y);

    if (pc.state === 'tray') {
      pc.state = 'loose';
      layoutTray();
    }
    // Draw last = draw on top.
    pieces.splice(i, 1);
    pieces.push(pc);
    return;
  }
}

function onMove(p) {
  if (!drag) return;
  // Gated on p.moved, not merely on a move arriving: a tap dispatches a
  // pointermove at the same coordinate, and lifting for that would shove the
  // piece 40 px up on every tap-to-rotate. Instant rather than eased, because
  // the lift moves the snap point — easing it would make one gesture land or
  // miss depending only on how fast the thumb travelled.
  if (p.moved) drag.lift = LIFT_PX;
  drag.x = unX(p.x) + drag.grabDX;
  drag.y = unY(p.y) + drag.grabDY;
  ghost = candidate(drag);
}

function onUp(p) {
  if (!drag) return;
  const pc = drag;
  drag = null;
  ghost = -1;
  // Bake the lift into the position so the piece stays exactly where it was
  // drawn. Letting it settle back down instead would drop a near miss 40 px
  // below where it was aimed, and the follow-up rotate would then test that.
  if (p.moved) {
    pc.y -= pc.lift / view.s;
    pc.lift = 0;
    trySnap(pc);
    return;
  }
  pc.lift = 0;
  // Held still: onTap may or may not follow (it will not past 350 ms), so hand
  // the piece over instead of leaving it grabbed and rotating it much later.
  tapee = pc;
}

function onTap() {
  if (winT >= 0) {
    if (winT > 0.7) loadLevel(level + 1);
    return;
  }
  const pc = tapee;
  tapee = null;
  if (!pc) return;
  pc.r = (pc.r + ROT_STEP) % 360;
  audio.play('tap');
  trySnap(pc);
}

// --- update ----------------------------------------------------------------

function update(dt) {
  for (const p of pieces) {
    const target = p.state === 'tray' ? 0 : 1;
    p.grown += Math.sign(target - p.grown) * Math.min(GROW * dt, Math.abs(target - p.grown));
    if (p.flash > 0) p.flash = Math.max(0, p.flash - dt * 2.4);
  }
  if (winT >= 0) winT += dt;
}

// --- render ----------------------------------------------------------------

function trace(c, pts, dy) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1] + dy);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1] + dy);
  c.closePath();
}

// Rounding comes from a stroke in the fill's own colour: the silhouette of the
// shape softens without any visible edge ever being drawn.
function flat(c, pts, fill, round) {
  c.lineJoin = 'round';
  c.lineWidth = round;
  c.fillStyle = fill;
  c.strokeStyle = fill;
  trace(c, pts, 0);
  c.fill();
  c.stroke();
}

function tile(c, pts, fill, s) {
  const depth = Math.max(2, s * TILE.depth);
  const round = Math.max(2, s * TILE.round);
  flat(c, pts, shade(fill), round);
  c.save();
  c.translate(0, -depth);
  flat(c, pts, fill, round);
  c.restore();
}

function pill(c, x, y, w, h, text, size) {
  const r = h / 2;
  c.fillStyle = COLOR.line;
  c.beginPath(); c.roundRect(x, y + 4, w, h, r); c.fill();
  c.fillStyle = COLOR.white;
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fill();
  c.fillStyle = COLOR.base;
  c.font = `800 ${size}px "Baloo 2", system-ui, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, x + w / 2, y + h / 2 + 1);
}

function render(c) {
  const { w, h } = stage;
  const { s } = view;

  c.fillStyle = COLOR.bg;
  c.fillRect(0, 0, w, h);

  // Silhouette: one flat charcoal mass, drawn slot by slot.
  const round = Math.max(2, s * TILE.round);
  for (const t of targets) {
    flat(c, poly(t.t, toX(t.x), toY(t.y), t.r, s), COLOR.base, round);
  }

  // The slot under the dragged piece lifts instead of outlining itself.
  if (ghost >= 0) {
    const t = targets[ghost];
    flat(c, poly(t.t, toX(t.x), toY(t.y), t.r, s), TILE.slot, round);
  }

  for (const p of pieces) {
    if (p.state === 'placed') {
      const pts = shape(p);
      tile(c, pts, p.color, s);
      if (p.flash > 0) {
        c.save();
        c.globalAlpha = p.flash * 0.55;
        flat(c, pts, COLOR.white, round);
        c.restore();
      }
    }
  }

  for (const p of pieces) {
    if (p.state === 'placed') continue;
    tile(c, shape(p), p.color, scaleOf(p));
  }

  // HUD
  const L = LEVELS[level];
  c.textBaseline = 'middle';
  pill(c, 16, 16, 148, 40, L.name.toUpperCase(), 16);
  pill(c, w - 16 - 92, 16, 92, 40, `${placedN}/${targets.length}`, 18);

  if (winT >= 0) {
    const last = level === LEVELS.length - 1;
    c.fillStyle = 'rgba(43,43,43,0.82)';
    c.fillRect(0, 0, w, h);

    const cw = Math.min(280, w - 48);
    const ch = 188;
    const cx = (w - cw) / 2;
    const cy = (h - ch) / 2;

    c.fillStyle = shade(ACC);
    c.beginPath(); c.roundRect(cx, cy + 5, cw, ch, 24); c.fill();
    c.fillStyle = COLOR.bg;
    c.beginPath(); c.roundRect(cx, cy, cw, ch, 24); c.fill();
    c.fillStyle = ACC;
    c.beginPath(); c.roundRect(cx, cy, cw, 56, [24, 24, 0, 0]); c.fill();

    c.textAlign = 'center';
    c.fillStyle = COLOR.base;
    c.font = '800 24px "Baloo 2", system-ui, sans-serif';
    c.fillText(last ? 'SEMUA SELESAI!' : 'SELESAI!', w / 2, cy + 29);
    c.font = '800 48px "Baloo 2", system-ui, sans-serif';
    c.fillText(`${targets.length}/${targets.length}`, w / 2, cy + 102);

    if (winT > 0.7) {
      c.fillStyle = COLOR.baseSoft;
      c.font = '700 14px "Baloo 2", system-ui, sans-serif';
      c.fillText(last ? 'TAP UNTUK MAIN LAGI' : 'TAP UNTUK LANJUT', w / 2, cy + 152);
    }
  }
}

// --- boot ------------------------------------------------------------------

boot({
  name: NAME,

  ready(game) {
    stage = game.stage;
    audio = game.audio;
    store = game.store;

    // stage.resize() early-returns when nothing changed, and boot calls it
    // before awaiting ready — so a callback registered here does not fire until
    // a genuine size change. Register it, then run it once by hand.
    stage.onResize(layout);
    loadLevel(store.get('level', 0));
  },

  input: { onDown, onMove, onUp, onTap },

  update,
  render,
});
