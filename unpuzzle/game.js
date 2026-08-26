// Unpuzzle — take the animal apart.
//
// The pieces sit together as a picture. A piece can only leave along its own
// exit vector, and only if nothing sits on the swept path. Clearing the board
// dismantles the animal and leaves its silhouette behind. There is no timer and
// no fail state, so the pressure is entirely "which one first".

import { boot } from '../shared/boot.js';
import { COLOR, TYPE, ACCENT } from '../shared/tokens.js';
import { LEVELS } from './levels.js';
import { carve } from './carve.js';
import { GEO, roundRect, drawPiece, drawGhost } from './style.js';

const NAME = 'unpuzzle';
const ACC = ACCENT[NAME];

const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const SLIDE_DUR  = 0.25;
const BOUNCE_DUR = 0.18;
const CLEAR_HOLD = 1.1;
const HINT_OPEN  = 2.4;   // arrows introduce the level, then clear off the picture
const HINT_TOUCH = 1.0;   // and come back on whatever the player just touched

let level  = 0;
let board  = null;   // { cols, rows, pieces }
let view   = null;   // the one cell -> screen transform; everything routes through it
let clearT = -1;     // >= 0 once the board is empty and the sweep is running

// ---------------------------------------------------------------- board model

function loadLevel(i) {
  const src = LEVELS[i % LEVELS.length];
  const carved = carve(src, { seed: src.seed });
  board = {
    cols: carved.cols,
    rows: carved.rows,
    name: carved.name,
    eyes: carved.eyes,
    ghost: carved.pieces.flatMap((p) => p.cells),
    pieces: carved.pieces.map((p) => ({
      cells: p.cells,
      dir: p.dir,
      paint: p.paint,
      gone: false,
      slide: null,
      bounce: 0,
      hint: HINT_OPEN,
    })),
  };
  clearT = -1;
}

// A piece that has committed to leaving no longer occupies the board, so taps
// can be chained instead of queueing behind each other's animations.
function occupant(cx, cy, exclude) {
  for (const p of board.pieces) {
    if (p.gone || p.slide || p === exclude) continue;
    for (const [x, y] of p.cells) if (x === cx && y === cy) return p;
  }
  return null;
}

const inside = (x, y) => x >= 0 && y >= 0 && x < board.cols && y < board.rows;

// The whole game is this test. The piece sweeps its own footprint one cell at a
// time along its exit vector until every cell is off the board; any occupied
// cell on the way makes the move illegal. Grid occupancy, never bounding boxes.
function sweep(p) {
  const [dx, dy] = DIR[p.dir];
  const limit = board.cols + board.rows + 2;
  for (let s = 1; s <= limit; s++) {
    let allOut = true;
    for (const [cx, cy] of p.cells) {
      const x = cx + dx * s, y = cy + dy * s;
      if (!inside(x, y)) continue;
      allOut = false;
      if (occupant(x, y, p)) return { clear: false, steps: s };
    }
    if (allOut) return { clear: true, steps: s };
  }
  return { clear: true, steps: limit };
}

function trySlide(p, audio) {
  if (!p || p.gone || p.slide || clearT >= 0) return;
  const { clear, steps } = sweep(p);
  if (clear) {
    p.slide = { t: 0, steps, left: false };
    audio.play('place');
  } else {
    p.bounce = BOUNCE_DUR;
    p.hint = HINT_TOUCH;               // show which way it wanted to go
    audio.play('tap', { rate: 0.4 });  // there is no `thunk` preset; rate is the only knob
  }
}

function pieceAt(px, py) {
  if (!view) return null;
  const cx = Math.floor((px - view.ox) / view.cell);
  const cy = Math.floor((py - view.oy) / view.cell);
  return inside(cx, cy) ? occupant(cx, cy, null) : null;
}

// -------------------------------------------------------------------- layout

// onResize never fires for the initial size, so this is called once from ready
// and again on every change. The URL bar sliding away on iOS is a change.
function layout(stage) {
  const padX = 20, top = 108, bottom = 56;
  const skirt = GEO.plate * 2;               // the plate sticks out this far, in cells
  const availW = stage.w - padX * 2;
  const availH = stage.h - top - bottom;
  const cell = Math.floor(Math.min(
    availW / (board.cols + skirt),
    availH / (board.rows + skirt),
  ));
  const plateW = cell * (board.cols + skirt);
  const plateH = cell * (board.rows + skirt);
  view = {
    cell,
    ox: Math.round((stage.w - plateW) / 2 + cell * GEO.plate),
    oy: Math.round(top + (availH - plateH) / 2 + cell * GEO.plate),
  };
}

// -------------------------------------------------------------------- update

const easeOut = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

function update(dt, game) {
  let alive = 0;

  for (const p of board.pieces) {
    if (p.bounce > 0) p.bounce = Math.max(0, p.bounce - dt);
    if (p.hint > 0) p.hint = Math.max(0, p.hint - dt);

    if (p.slide) {
      p.slide.t += dt;
      if (!p.slide.left && p.slide.t >= SLIDE_DUR * 0.5) {
        p.slide.left = true;
        game.audio.play('whoosh');
      }
      if (p.slide.t >= SLIDE_DUR) { p.slide = null; p.gone = true; }
    }

    if (!p.gone) alive++;
  }

  if (alive === 0 && clearT < 0) {
    clearT = 0;
    game.audio.play('perfect');
  }

  if (clearT >= 0) {
    clearT += dt;
    if (clearT >= CLEAR_HOLD) {
      level++;
      game.store.set('level', level);
      loadLevel(level);
      layout(game.stage);
    }
  }
}

// -------------------------------------------------------------------- render

function render(c, game) {
  const { stage } = game;
  c.fillStyle = COLOR.bg;
  c.fillRect(0, 0, stage.w, stage.h);
  if (!view) return;

  drawPlate(c);
  drawGhost(c, board.ghost, view.ox, view.oy, view.cell);
  for (const p of board.pieces) drawOne(c, p);
  drawEyes(c);
  drawHud(c, stage);
  if (clearT >= 0) drawClear(c, stage);
}

function drawPlate(c) {
  const { ox, oy, cell } = view;
  const w = cell * board.cols, h = cell * board.rows;
  const pad = cell * GEO.plate, r = cell * GEO.plateRadius;

  c.save();
  c.globalAlpha = 0.10;
  c.fillStyle = COLOR.base;
  roundRect(c, ox - pad, oy - pad + cell * 0.06, w + pad * 2, h + pad * 2, r);
  c.fill();
  c.restore();

  c.fillStyle = COLOR.white;
  roundRect(c, ox - pad, oy - pad, w + pad * 2, h + pad * 2, r);
  c.fill();
}

function offsetOf(p) {
  const { cell } = view;
  const [dx, dy] = DIR[p.dir];

  if (p.slide) {
    const k = easeOut(p.slide.t / SLIDE_DUR);
    return {
      x: dx * k * p.slide.steps * cell,
      y: dy * k * p.slide.steps * cell,
      alpha: 1 - Math.max(0, (k - 0.55) / 0.45),   // fades as it crosses the edge
    };
  }
  if (p.bounce > 0) {
    // Nudge toward the exit and back — an illegal tap must still feel answered.
    const k = Math.sin((1 - p.bounce / BOUNCE_DUR) * Math.PI);
    return { x: dx * k * cell * 0.12, y: dy * k * cell * 0.12, alpha: 1 };
  }
  return { x: 0, y: 0, alpha: 1 };
}

function drawOne(c, p) {
  if (p.gone) return;
  const { ox, oy, cell } = view;
  const o = offsetOf(p);
  const has = (x, y) => p.cells.some(([a, b]) => a === x && b === y);
  drawPiece(c, p.cells, has, ox + o.x, oy + o.y, cell, p.paint, o.alpha);
  if (p.hint > 0) drawArrow(c, p, ox + o.x, oy + o.y, cell, o.alpha * Math.min(1, p.hint / 0.5));
}

// Eyes are painted on, not pieces — a piece enclosed by another can never leave,
// so an eye inside a face would deadlock the level. They ride whichever piece
// holds their cell and leave with it.
function drawEyes(c) {
  const { ox, oy, cell } = view;
  for (const [ex, ey] of board.eyes) {
    const p = board.pieces.find(
      (q) => !q.gone && q.cells.some(([x, y]) => x === ex && y === ey));
    if (!p) continue;
    const o = offsetOf(p);
    c.save();
    c.globalAlpha = o.alpha;
    c.fillStyle = COLOR.base;
    c.beginPath();
    c.arc(ox + o.x + (ex + 0.5) * cell, oy + o.y + (ey + 0.5) * cell, cell * 0.11, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
}

// The exit direction has to be readable at a glance or the player is guessing.
function drawArrow(c, p, ox, oy, cell, alpha) {
  // Sit on the piece's leading edge, not its centre — centred arrows land on the
  // animal's face and read as eyebrows.
  const [dx, dy] = DIR[p.dir];
  const reach = Math.max(...p.cells.map(([x, y]) => x * dx + y * dy));
  const lead = p.cells.filter(([x, y]) => x * dx + y * dy === reach);
  let sx = 0, sy = 0;
  for (const [x, y] of lead) { sx += x; sy += y; }
  const cx = ox + (sx / lead.length + 0.5) * cell;
  const cy = oy + (sy / lead.length + 0.5) * cell;
  const ang = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[p.dir];
  const s = cell * 0.15;

  c.save();
  c.globalAlpha = alpha * 0.92;
  c.translate(cx, cy);
  c.rotate(ang);
  c.strokeStyle = COLOR.white;
  c.lineWidth = Math.max(2, cell * 0.075);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(-s * 0.3, -s);
  c.lineTo(s * 0.5, 0);
  c.lineTo(-s * 0.3, s);
  c.stroke();
  c.restore();
}

function drawHud(c, stage) {
  const x = 24, y = 74;
  const left = board.pieces.filter((p) => !p.gone).length;

  c.save();
  c.font = `${TYPE.label.weight} ${TYPE.label.size}px ${TYPE.family}`;
  c.textAlign = 'left';
  c.fillStyle = COLOR.baseSoft;
  c.fillText(`LEVEL ${level + 1}`, x, y);
  c.textAlign = 'right';
  c.fillStyle = left ? COLOR.base : ACC;
  c.fillText(`SISA ${left}`, stage.w - x, y);

  c.textAlign = 'center';
  c.fillStyle = COLOR.baseSoft;
  c.fillText(board.name.toUpperCase(), stage.w / 2, y);
  c.restore();
}

function drawClear(c, stage) {
  const { ox, oy, cell } = view;
  const w = cell * board.cols, h = cell * board.rows;
  const pad = cell * GEO.plate;
  const k = easeOut(clearT / (CLEAR_HOLD * 0.7));
  const bandW = w * 0.55;

  c.save();
  roundRect(c, ox - pad, oy - pad, w + pad * 2, h + pad * 2, cell * GEO.plateRadius);
  c.clip();
  c.globalAlpha = 0.32 * (1 - k * 0.5);
  c.fillStyle = ACC;
  c.fillRect(ox - bandW + (w + bandW * 2) * k, oy - cell, bandW, h + cell * 2);
  c.restore();

  c.save();
  c.globalAlpha = Math.min(1, clearT * 4);
  c.textAlign = 'center';
  c.fillStyle = COLOR.base;
  c.font = `${TYPE.title.weight} ${TYPE.title.size}px ${TYPE.family}`;
  c.fillText('SELESAI!', stage.w / 2, oy + h + pad + cell * 0.75);
  c.restore();
}

// ---------------------------------------------------------------------- boot

boot({
  name: NAME,

  async ready(game) {
    level = game.store.get('level', 0);
    loadLevel(level);
    layout(game.stage);
    game.stage.onResize(() => layout(game.stage));
  },

  input: {
    // A tap carries no direction, so it uses the piece's own exit vector.
    onTap(p, game) {
      const piece = pieceAt(p.x, p.y);
      if (piece) piece.hint = Math.max(piece.hint, HINT_TOUCH);
      trySlide(piece, game.audio);
    },

    // A flick never arrives as onTap — 12px of drift already sets p.moved and
    // kills it — so the direction is read here instead, from where the finger
    // started rather than where it ended.
    onUp(p, pointers, game) {
      if (!p.moved || !view) return;
      const piece = pieceAt(p.startX, p.startY);
      if (!piece) return;
      if (Math.hypot(p.dx, p.dy) < view.cell * 0.3) return;

      const [dx, dy] = DIR[piece.dir];
      const along = p.dx * dx + p.dy * dy;
      const across = Math.abs(p.dx * dy - p.dy * dx);
      if (along > across) {
        trySlide(piece, game.audio);
      } else {
        // Flicked the wrong way: answer it, and teach the direction.
        piece.bounce = BOUNCE_DUR;
        game.audio.play('tap', { rate: 0.4 });
      }
    },
  },

  update,
  render,
});
