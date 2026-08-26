// Polygram — drag the pieces into the silhouette.
//
// Everything lives in level units and goes through one transform on the way to
// the screen (see toX/toY). That is deliberate: solutions are authored in level
// units, and if any of position, snapping or hit-testing used a second mapping,
// the 24 px snap tolerance would quietly mean a different distance on every
// device.
//
// THE ONE RULE THE JUICE MUST NOT BREAK: no animating value may reach the snap
// test. Displayed rotation, the pop, the lean, the grow tween and the screen
// shake are all display-only; candidate() reads the logical `p.r` at the settled
// `view.s`. Three separate snap bugs came from getting this wrong, and every one
// of them looked like "sometimes it just doesn't grab".

import { boot } from '../shared/boot.js';
import { COLOR, ACCENT } from '../shared/tokens.js';
import { LEVELS, poly } from './levels.js';
import { PIECE, TILE, shade } from './style.js';

const NAME = 'polygram';
const ACC = ACCENT[NAME];

const SNAP_PX = 24;              // how close a vertex must land — tune with a thumb
const NEAR_PX = SNAP_PX * 2.8;   // close enough to be told "rotate me"
const LIFT_PX = 40;              // the dragged piece rides above the finger
const ROT_STEP = 45;             // every angle any solution uses is a multiple of this

const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch {} };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

let stage, audio, store;

let level = 0;
let targets = [];
let pieces = [];
let view = { s: 1, ts: 1, ox: 0, oy: 0, board: null, tray: null, reset: null };
let drag = null;
let tapee = null;
let ghost = -1;
let ghostT = 0;
let placedN = 0;
let winT = -1;
let cardT = 0;
let taught = false;              // has the player ever rotated a piece

// Decaying scalars and particle lists, the same shape as stick-hero's juice.
let shake = 0;
let bits = [];
let fanfare = [];

const toX = (x) => view.ox + x * view.s;
const toY = (y) => view.oy + y * view.s;
const unX = (X) => (X - view.ox) / view.s;
const unY = (Y) => (Y - view.oy) / view.s;

// --- level setup -----------------------------------------------------------

function loadLevel(n) {
  level = ((n % LEVELS.length) + LEVELS.length) % LEVELS.length;
  const L = LEVELS[level];

  targets = L.solution.map((s, i) => ({ ...s, i, filled: false, pulse: 0 }));
  pieces = L.solution.map((s, i) => ({
    t: s.t,
    color: PIECE[i % PIECE.length],
    x: 0, y: 0, xPrev: 0,
    r: 0,                // logical rotation — the only one the snap test sees
    rDisp: 0,            // what gets drawn, chasing r
    state: 'tray',
    grown: 0,            // tray -> board scale
    hold: 0,             // 0..1 while carried; thickens the tile
    lift: 0,
    pop: 0,              // scale punch
    lean: 0,             // tilt from drag speed
    wob: 0, wobT: 0,     // "turn me" wobble after a near miss
    flash: 0,
    flashAt: -1,         // when the win ripple reaches this piece
    ti: -1,
  }));

  placedN = 0;
  winT = -1;
  cardT = 0;
  drag = null;
  tapee = null;
  ghost = -1;
  shake = 0;
  bits = [];
  fanfare = [];
  store.set('level', level);
  layout();
  for (const p of pieces) p.xPrev = p.x;
}

function resetLevel() {
  audio.play('whoosh');
  loadLevel(level);
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
    ts: s * 0.5,
    ox: board.x + (board.w - bw * s) / 2 - x0 * s,
    oy: board.y + (board.h - bh * s) / 2 - y0 * s,
    board,
    tray,
    reset: { x: w - 16 - 92 - 8 - 40, y: 16, d: 40 },
  };

  for (const p of pieces) {
    if (p.state === 'placed') {
      const t = targets[p.ti];
      p.x = t.x; p.y = t.y; p.r = t.r; p.rDisp = t.r;
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
  const CW = 4.4;
  const CH = 2.8;

  let best = { ts: 0, cols: inTray.length, rows: 1 };
  for (let rows = 1; rows <= 4; rows++) {
    const cols = Math.ceil(inTray.length / rows);
    const ts = Math.min(tray.w / (cols * CW), tray.h / (rows * CH));
    if (ts > best.ts) best = { ts, cols, rows };
  }

  const { cols, rows } = best;
  const ts = Math.min(best.ts, view.s * 0.6);
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
// polygon that snaps is the polygon on screen. Applying it in both places is
// how a piece ends up snapping 40 px from where it looks.
const cxOf = (p) => toX(p.x);
const cyOf = (p) => toY(p.y) - p.lift;

// Drawn: carries every cosmetic offset. Never fed to the snap test.
function shape(p) {
  const wobble = Math.sin(p.wobT * 34) * p.wob * 10;
  return poly(p.t, cxOf(p), cyOf(p), p.rDisp + p.lean + wobble,
    scaleOf(p) * (1 + p.pop * 0.13));
}

// Logical: the shape the piece would occupy if it settled right now.
const settled = (p) => poly(p.t, cxOf(p), cyOf(p), p.r, view.s);

const slotPoly = (t) => poly(t.t, toX(t.x), toY(t.y), t.r, view.s);

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

// Compare vertex sets rather than angles. The square's 4-fold and the
// parallelogram's 2-fold symmetry then fall out for free — no per-shape table.
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
  const pv = settled(p);
  let best = -1;
  let bestD = Infinity;
  for (const t of targets) {
    if (t.filled || t.t !== p.t) continue;
    const d = Math.hypot(cxOf(p) - toX(t.x), cyOf(p) - toY(t.y));
    if (d > SNAP_PX * 2.2 || d >= bestD) continue;
    if (!fits(pv, slotPoly(t))) continue;
    best = t.i;
    bestD = d;
  }
  return best;
}

// A slot the piece is sitting on but is turned wrong for. This is the whole
// difference between a puzzle that teaches its own verb and one that just
// refuses in silence.
function nearMiss(p) {
  for (const t of targets) {
    if (t.filled || t.t !== p.t) continue;
    if (Math.hypot(cxOf(p) - toX(t.x), cyOf(p) - toY(t.y)) > NEAR_PX) continue;
    for (let a = ROT_STEP; a < 360; a += ROT_STEP) {
      const turned = poly(p.t, cxOf(p), cyOf(p), (p.r + a) % 360, view.s);
      if (fits(turned, slotPoly(t))) return t.i;
    }
  }
  return -1;
}

// --- particles -------------------------------------------------------------

function shards(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const sp = 90 + Math.random() * 130;
    bits.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      g: 260, size: 5 + Math.random() * 5,
      rot: Math.random() * 6, vrot: (Math.random() - 0.5) * 12,
      color, t: 0, max: 0.42 + Math.random() * 0.2, tri: true,
    });
  }
}

function confetti(x, y) {
  for (let i = 0; i < 44; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.1;
    const sp = 220 + Math.random() * 320;
    bits.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      g: 620, size: 6 + Math.random() * 8,
      rot: Math.random() * 6, vrot: (Math.random() - 0.5) * 14,
      color: PIECE[i % PIECE.length], t: 0, max: 1.5 + Math.random() * 0.9,
      tri: i % 3 === 0,
    });
  }
}

// --- placing ---------------------------------------------------------------

function trySnap(p) {
  const i = candidate(p);
  if (i < 0) return false;

  const t = targets[i];
  t.filled = true;
  p.state = 'placed';
  p.ti = i;
  p.x = t.x; p.y = t.y; p.r = t.r; p.rDisp = t.r;
  p.grown = 1;
  p.lift = 0;
  p.lean = 0;
  p.wob = 0;
  p.pop = 1;
  p.flash = 1;
  placedN++;

  shards(toX(t.x), toY(t.y), p.color, 7);
  shake = Math.max(shake, 0.32);
  buzz(12);

  // Each piece lands a step higher than the last, so filling reads as progress
  // rather than repetition.
  audio.play('place', { rate: 1 + placedN * 0.09 });

  if (placedN === targets.length) win();
  return true;
}

function win() {
  winT = 0;
  cardT = 0;
  shake = Math.max(shake, 0.7);
  buzz([18, 40, 26]);
  audio.play('perfect');

  // The ripple runs in slot order, so the finished shape lights up piece by
  // piece instead of flashing all at once.
  for (const p of pieces) if (p.state === 'placed') p.flashAt = p.ti * 0.07;
  fanfare = [
    { t: 0.30, name: 'score', rate: 1.0 },
    { t: 0.44, name: 'score', rate: 1.25 },
    { t: 0.60, name: 'score', rate: 1.5 },
  ];

  let cx = 0, cy = 0;
  for (const t of targets) { cx += toX(t.x); cy += toY(t.y); }
  confetti(cx / targets.length, cy / targets.length);
}

// --- input -----------------------------------------------------------------
//
// A grab starts on onDown and a rotate commits on onTap, because input.js fires
// onHoldEnd -> onUp -> onTap off one release, and a still thumb lifted between
// 220 and 350 ms triggers all three.

function onDown(p) {
  tapee = null;
  if (winT >= 0) return;

  const R = view.reset;
  if (Math.hypot(p.x - (R.x + R.d / 2), p.y - (R.y + R.d / 2)) <= R.d / 2 + 4) {
    resetLevel();
    return;
  }

  // Topmost first: loose pieces sit above tray pieces.
  for (let i = pieces.length - 1; i >= 0; i--) {
    const pc = pieces[i];
    if (pc.state === 'placed') continue;
    if (!hit(shape(pc), p.x, p.y)) continue;

    drag = pc;
    pc.grabDX = pc.x - unX(p.x);
    pc.grabDY = pc.y - unY(p.y);
    pc.pop = Math.max(pc.pop, 0.55);
    pc.wob = 0;
    if (pc.state === 'tray') {
      pc.state = 'loose';
      layoutTray();
    }
    audio.play('tap', { rate: 1.5 });
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
  // the lift moves the snap point.
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

  if (!p.moved) { pc.lift = 0; tapee = pc; return; }

  // Bake the lift into the position so the piece stays where it was drawn.
  // Letting it settle back down would drop a near miss 40 px below where it was
  // aimed, and the follow-up rotate would then test that.
  pc.y -= pc.lift / view.s;
  pc.lift = 0;

  if (trySnap(pc)) return;

  // Dropped back over the tray: send it home instead of leaving it floating on
  // the board with nothing to do.
  const T = view.tray;
  const X = toX(pc.x);
  const Y = toY(pc.y);
  if (X >= T.x && X <= T.x + T.w && Y >= T.y) {
    pc.state = 'tray';
    pc.grown = 0;
    layoutTray();
    audio.play('whoosh', { rate: 1.4 });
    return;
  }

  // Right place, wrong angle. Say so — silence here reads as a broken drop.
  const m = nearMiss(pc);
  if (m >= 0) {
    pc.wob = 1;
    pc.wobT = 0;
    targets[m].pulse = 1;
    audio.play('tap', { rate: 0.42 });
  }
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
  pc.pop = Math.max(pc.pop, 0.5);
  pc.wob = 0;
  audio.play('tap');
  if (!taught) { taught = true; store.set('taught', true); }
  trySnap(pc);
}

// --- update ----------------------------------------------------------------
//
// Fixed 1/60 s. Everything below is cosmetic; none of it is read by candidate(),
// trySnap() or nearMiss().

const approach = (v, to, k, dt) => v + (to - v) * Math.min(1, k * dt);

function angleTo(from, to) {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function update(dt) {
  for (const p of pieces) {
    p.grown = approach(p.grown, p.state === 'tray' ? 0 : 1, 11, dt);
    p.hold = approach(p.hold, p === drag ? 1 : 0, 12, dt);
    p.rDisp += angleTo(p.rDisp, p.r) * Math.min(1, 17 * dt);

    // Tilt into the direction of travel, measured from the fixed-step position
    // delta so it does not depend on how often pointermove happens to fire.
    const lean = p === drag
      ? clamp((p.x - p.xPrev) * view.s * 60 * 0.028, -13, 13)
      : 0;
    p.lean = approach(p.lean, lean, 14, dt);
    p.xPrev = p.x;

    if (p.pop > 0) p.pop = Math.max(0, p.pop - dt * 3.6);
    if (p.wob > 0) { p.wob = Math.max(0, p.wob - dt * 3.4); p.wobT += dt; }

    if (p.flashAt >= 0 && winT >= p.flashAt) { p.flash = 1; p.pop = 0.7; p.flashAt = -1; }
    if (p.flash > 0) p.flash = Math.max(0, p.flash - dt * 2.4);
  }

  for (const t of targets) if (t.pulse > 0) t.pulse = Math.max(0, t.pulse - dt * 2.2);

  if (shake > 0) shake = Math.max(0, shake - dt * 3.5);
  ghostT += dt;

  for (let i = bits.length - 1; i >= 0; i--) {
    const b = bits[i];
    b.t += dt;
    if (b.t >= b.max) { bits.splice(i, 1); continue; }
    b.vy += b.g * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rot += b.vrot * dt;
  }

  if (winT >= 0) {
    winT += dt;
    cardT = Math.min(1, cardT + dt * 3.4);
    for (let i = fanfare.length - 1; i >= 0; i--) {
      if (winT >= fanfare[i].t) {
        audio.play(fanfare[i].name, { rate: fanfare[i].rate });
        fanfare.splice(i, 1);
      }
    }
  }
}

// --- render ----------------------------------------------------------------

function trace(c, pts, dy) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1] + dy);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1] + dy);
  c.closePath();
}

// Rounding comes from a stroke in the fill's own colour: the outline of the
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

function tile(c, pts, fill, s, thick = 1) {
  const depth = Math.max(2, s * TILE.depth) * thick;
  const round = Math.max(2, s * TILE.round);
  flat(c, pts, shade(fill), round);
  c.save();
  c.translate(0, -depth);
  flat(c, pts, fill, round);
  c.restore();
}

function mix(a, b, t) {
  const pa = a.slice(1).match(/../g).map((v) => parseInt(v, 16));
  const pb = b.slice(1).match(/../g).map((v) => parseInt(v, 16));
  return '#' + pa.map((v, i) =>
    Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

function drawBits(c) {
  for (const b of bits) {
    const k = 1 - b.t / b.max;
    const sz = b.size * (0.45 + k * 0.55);
    c.save();
    c.globalAlpha = Math.min(1, k * 2.2);
    c.translate(b.x, b.y);
    c.rotate(b.rot);
    c.fillStyle = b.color;
    c.beginPath();
    if (b.tri) { c.moveTo(0, -sz); c.lineTo(sz, sz); c.lineTo(-sz, sz); }
    else { c.rect(-sz, -sz * 0.7, sz * 2, sz * 1.4); }
    c.closePath();
    c.fill();
    c.restore();
  }
}

function pill(c, x, y, w, h, text, size, bg = COLOR.white, fg = COLOR.base) {
  const r = h / 2;
  c.fillStyle = bg === COLOR.white ? COLOR.line : shade(bg);
  c.beginPath(); c.roundRect(x, y + 4, w, h, r); c.fill();
  c.fillStyle = bg;
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fill();
  c.fillStyle = fg;
  c.font = `800 ${size}px "Baloo 2", system-ui, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, x + w / 2, y + h / 2 + 1);
}

const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);

function render(c) {
  const { w, h } = stage;
  const { s } = view;
  const round = Math.max(2, s * TILE.round);

  c.fillStyle = COLOR.bg;
  c.fillRect(0, 0, w, h);

  c.save();
  if (shake > 0) {
    const m = shake * shake * 9;   // quadratic: barely there on a snap, real on a win
    c.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }

  for (const t of targets) flat(c, slotPoly(t), COLOR.base, round);

  // The slot under the dragged piece lifts instead of outlining itself, and
  // carries a hint of that piece's colour so it is obvious which one belongs.
  if (ghost >= 0 && drag) {
    const breathe = 0.5 + 0.5 * Math.sin(ghostT * 6);
    flat(c, slotPoly(targets[ghost]),
      mix(TILE.slot, drag.color, 0.22 + breathe * 0.16), round);
  }
  for (const t of targets) {
    if (t.pulse > 0 && !t.filled) {
      flat(c, slotPoly(t), mix(COLOR.base, TILE.slot, t.pulse), round);
    }
  }

  for (const p of pieces) {
    if (p.state !== 'placed') continue;
    const pts = shape(p);
    tile(c, pts, p.color, s);
    if (p.flash > 0) {
      c.save();
      c.globalAlpha = p.flash * 0.5;   // above ~0.5 it reads as a whiteout, not a hit
      flat(c, pts, COLOR.white, round);
      c.restore();
    }
  }

  for (const p of pieces) {
    if (p.state === 'placed') continue;
    // A carried piece thickens rather than casting a shadow — the flat rule
    // holds, and the depth still reads as "this one is off the board".
    tile(c, shape(p), p.color, scaleOf(p), 1 + p.hold * 1.7);
  }

  if (winT < 0) drawBits(c);
  c.restore();

  // HUD
  const L = LEVELS[level];
  pill(c, 16, 16, 148, 40, L.name.toUpperCase(), 16);
  pill(c, w - 16 - 92, 16, 92, 40, `${placedN}/${targets.length}`, 18);

  const R = view.reset;
  c.fillStyle = COLOR.line;
  c.beginPath(); c.arc(R.x + R.d / 2, R.y + R.d / 2 + 4, R.d / 2, 0, 6.2832); c.fill();
  c.fillStyle = COLOR.white;
  c.beginPath(); c.arc(R.x + R.d / 2, R.y + R.d / 2, R.d / 2, 0, 6.2832); c.fill();
  c.fillStyle = COLOR.baseSoft;
  c.font = '800 20px "Baloo 2", system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('↺', R.x + R.d / 2, R.y + R.d / 2 + 1);

  // Rotation is invisible as a verb until someone stumbles on it, so say it
  // once and never again.
  if (!taught && winT < 0) {
    // Accent, not charcoal: this pill sits in the gap between board and tray and
    // will overlap the silhouette on a tall level — charcoal on charcoal is
    // invisible exactly where a first-timer is looking.
    pill(c, (w - 216) / 2, view.tray.y - 48, 216, 34,
      'TAP KEPING UNTUK PUTAR', 13, ACC, COLOR.base);
  }

  if (winT >= 0) {
    const last = level === LEVELS.length - 1;
    c.fillStyle = `rgba(43,43,43,${0.82 * Math.min(1, winT * 4)})`;
    c.fillRect(0, 0, w, h);
    drawBits(c);

    const cw = Math.min(280, w - 48);
    const ch = 188;
    const k = easeOutBack(cardT);
    c.save();
    c.translate(w / 2, h / 2);
    c.scale(k, k);
    c.translate(-cw / 2, -ch / 2);

    c.fillStyle = shade(ACC);
    c.beginPath(); c.roundRect(0, 5, cw, ch, 24); c.fill();
    c.fillStyle = COLOR.bg;
    c.beginPath(); c.roundRect(0, 0, cw, ch, 24); c.fill();
    c.fillStyle = ACC;
    c.beginPath(); c.roundRect(0, 0, cw, 56, [24, 24, 0, 0]); c.fill();

    c.textAlign = 'center';
    c.fillStyle = COLOR.base;
    c.font = '800 24px "Baloo 2", system-ui, sans-serif';
    c.fillText(last ? 'SEMUA SELESAI!' : 'SELESAI!', cw / 2, 29);
    c.font = '800 48px "Baloo 2", system-ui, sans-serif';
    c.fillText(`${targets.length}/${targets.length}`, cw / 2, 102);

    if (winT > 0.7) {
      c.fillStyle = COLOR.baseSoft;
      c.font = '700 14px "Baloo 2", system-ui, sans-serif';
      c.fillText(last ? 'TAP UNTUK MAIN LAGI' : 'TAP UNTUK LANJUT', cw / 2, 152);
    }
    c.restore();
  }
}

// --- boot ------------------------------------------------------------------

boot({
  name: NAME,

  ready(game) {
    stage = game.stage;
    audio = game.audio;
    store = game.store;
    taught = store.get('taught', false);

    // stage.resize() early-returns when nothing changed, and boot calls it
    // before awaiting ready — so a callback registered here does not fire until
    // a genuine size change. Register it, then run it once by hand.
    stage.onResize(layout);
    loadLevel(store.get('level', 0));

    // Local only. requestAnimationFrame is throttled to a crawl in a background
    // tab, so an automated check that just waits sees nothing advance and cannot
    // tell a paused loop from a hung one. Drive the clock with __debug.step()
    // and force a frame with __debug.paint() instead of sleeping.
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      window.__debug = {
        step: (n = 60) => { for (let i = 0; i < n; i++) update(1 / 60); },
        paint: () => render(stage.ctx),
        state: () => ({ level, placedN, winT: +winT.toFixed(2), taught, bits: bits.length }),
      };
    }
  },

  input: { onDown, onMove, onUp, onTap },

  update,
  render,
});
