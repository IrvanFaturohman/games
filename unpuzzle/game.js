// Unpuzzle — take the animal apart.
//
// Every cell of the picture is one tile carrying one arrow. Tap a tile and it
// slides the way its arrow points, but only if nothing blocks the straight run
// off the board. Clearing the board dismantles the animal and leaves its
// silhouette behind. There is no timer and no fail state, so the pressure is
// entirely "which one first".

import { boot } from '../shared/boot.js';
import { COLOR, TYPE, ACCENT } from '../shared/tokens.js';
import { LEVELS } from './levels.js';
import { carve } from './carve.js';
import { drawTile, drawGhost } from './style.js';

const NAME = 'unpuzzle';
const ACC = ACCENT[NAME];

const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const SLIDE_DUR  = 0.24;
const BOUNCE_DUR = 0.18;
const CLEAR_HOLD = 1.2;

let level  = 0;
let board  = null;   // { name, cols, rows, ghost, tiles }
let view   = null;   // the one cell -> screen transform; everything routes through it
let clearT = -1;     // >= 0 once the board is empty and the sweep is running

// ---------------------------------------------------------------- board model

function loadLevel(i) {
  const src = LEVELS[i % LEVELS.length];
  const carved = carve(src, { seed: src.seed });
  board = {
    name: carved.name,
    cols: carved.cols,
    rows: carved.rows,
    ghost: carved.tiles.map((t) => [t.x, t.y]),
    tiles: carved.tiles.map((t) => ({
      x: t.x, y: t.y, color: t.color, dir: t.dir,
      gone: false, slide: null, bounce: 0,
    })),
  };
  clearT = -1;
}

// A tile that has committed to leaving no longer occupies the board, so taps can
// be chained instead of queueing behind each other's animations.
function occupant(cx, cy, exclude) {
  for (const t of board.tiles) {
    if (t.gone || t.slide || t === exclude) continue;
    if (t.x === cx && t.y === cy) return t;
  }
  return null;
}

const inside = (x, y) => x >= 0 && y >= 0 && x < board.cols && y < board.rows;

// The whole game is this test: walk the arrow's direction one cell at a time
// until the tile is off the board, and fail on the first occupied cell.
function sweep(t) {
  const [dx, dy] = DIR[t.dir];
  const limit = board.cols + board.rows + 2;
  for (let s = 1; s <= limit; s++) {
    const x = t.x + dx * s, y = t.y + dy * s;
    if (!inside(x, y)) return { clear: true, steps: s + 1 };  // +1 carries it off screen
    if (occupant(x, y, t)) return { clear: false, steps: s };
  }
  return { clear: true, steps: limit };
}

function trySlide(t, audio) {
  if (!t || t.gone || t.slide || clearT >= 0) return;
  const { clear, steps } = sweep(t);
  if (clear) {
    t.slide = { t: 0, steps, left: false };
    audio.play('place');
  } else {
    t.bounce = BOUNCE_DUR;
    audio.play('tap', { rate: 0.4 });  // there is no `thunk` preset; rate is the only knob
  }
}

function tileAt(px, py) {
  if (!view) return null;
  const cx = Math.floor((px - view.ox) / view.cell);
  const cy = Math.floor((py - view.oy) / view.cell);
  return inside(cx, cy) ? occupant(cx, cy, null) : null;
}

// -------------------------------------------------------------------- layout

// onResize never fires for the initial size, so this is called once from ready
// and again on every change. The URL bar sliding away on iOS is a change.
function layout(stage) {
  const padX = 20, top = 110, bottom = 64;
  const availW = stage.w - padX * 2;
  const availH = stage.h - top - bottom;
  const cell = Math.floor(Math.min(availW / board.cols, availH / board.rows));
  view = {
    cell,
    ox: Math.round((stage.w - cell * board.cols) / 2),
    oy: Math.round(top + (availH - cell * board.rows) / 2),
  };
}

// -------------------------------------------------------------------- update

const easeOut = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

function update(dt, game) {
  let alive = 0;

  for (const t of board.tiles) {
    if (t.bounce > 0) t.bounce = Math.max(0, t.bounce - dt);

    if (t.slide) {
      t.slide.t += dt;
      if (!t.slide.left && t.slide.t >= SLIDE_DUR * 0.5) {
        t.slide.left = true;
        game.audio.play('whoosh');
      }
      if (t.slide.t >= SLIDE_DUR) { t.slide = null; t.gone = true; }
    }

    if (!t.gone) alive++;
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

  drawGhost(c, board.ghost, view.ox, view.oy, view.cell);
  for (const t of board.tiles) drawOne(c, t);
  drawHud(c, stage);
  if (clearT >= 0) drawClear(c, stage);
}

function offsetOf(t) {
  const { cell } = view;
  const [dx, dy] = DIR[t.dir];

  if (t.slide) {
    const k = easeOut(t.slide.t / SLIDE_DUR);
    return {
      x: dx * k * t.slide.steps * cell,
      y: dy * k * t.slide.steps * cell,
      alpha: 1 - Math.max(0, (k - 0.6) / 0.4),   // fades as it crosses the edge
    };
  }
  if (t.bounce > 0) {
    // Nudge toward the exit and back — an illegal tap must still feel answered.
    const k = Math.sin((1 - t.bounce / BOUNCE_DUR) * Math.PI);
    return { x: dx * k * cell * 0.14, y: dy * k * cell * 0.14, alpha: 1 };
  }
  return { x: 0, y: 0, alpha: 1 };
}

function drawOne(c, t) {
  if (t.gone) return;
  const { ox, oy, cell } = view;
  const o = offsetOf(t);
  drawTile(c, ox + o.x + t.x * cell, oy + o.y + t.y * cell, cell, t.color, t.dir, o.alpha);
}

function drawHud(c, stage) {
  const x = 24, y = 74;
  const left = board.tiles.filter((t) => !t.gone).length;

  c.save();
  c.font = `${TYPE.label.weight} ${TYPE.label.size}px ${TYPE.family}`;
  c.textAlign = 'left';
  c.fillStyle = COLOR.baseSoft;
  c.fillText(`LEVEL ${level + 1}`, x, y);

  c.textAlign = 'center';
  c.fillText(board.name.toUpperCase(), stage.w / 2, y);

  c.textAlign = 'right';
  c.fillStyle = left ? COLOR.base : ACC;
  c.fillText(`SISA ${left}`, stage.w - x, y);
  c.restore();
}

function drawClear(c, stage) {
  const { ox, oy, cell } = view;
  const w = cell * board.cols, h = cell * board.rows;
  const k = easeOut(clearT / (CLEAR_HOLD * 0.7));
  const bandW = w * 0.55;

  c.save();
  c.beginPath();
  c.rect(ox, oy, w, h);
  c.clip();
  c.globalAlpha = 0.34 * (1 - k * 0.5);
  c.fillStyle = ACC;
  c.fillRect(ox - bandW + (w + bandW * 2) * k, oy - cell, bandW, h + cell * 2);
  c.restore();

  c.save();
  c.globalAlpha = Math.min(1, clearT * 4);
  c.textAlign = 'center';
  c.fillStyle = COLOR.base;
  c.font = `${TYPE.title.weight} ${TYPE.title.size}px ${TYPE.family}`;
  c.fillText('SELESAI!', stage.w / 2, oy + h + cell * 0.9);
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
    // A tap carries no direction, so it uses the tile's own arrow.
    onTap(p, game) {
      trySlide(tileAt(p.x, p.y), game.audio);
    },

    // A flick never arrives as onTap — 12px of drift already sets p.moved and
    // kills it — so the direction is read here instead, from where the finger
    // started rather than where it ended.
    onUp(p, pointers, game) {
      if (!p.moved || !view) return;
      const tile = tileAt(p.startX, p.startY);
      if (!tile) return;
      if (Math.hypot(p.dx, p.dy) < view.cell * 0.3) return;

      const [dx, dy] = DIR[tile.dir];
      const along = p.dx * dx + p.dy * dy;
      const across = Math.abs(p.dx * dy - p.dy * dx);
      if (along > across) {
        trySlide(tile, game.audio);
      } else {
        // Flicked the wrong way: answer it, and let the arrow do the teaching.
        tile.bounce = BOUNCE_DUR;
        game.audio.play('tap', { rate: 0.4 });
      }
    },
  },

  update,
  render,
});
