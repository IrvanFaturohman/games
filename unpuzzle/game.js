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
import { drawTile, drawGhost, roundRect } from './style.js';

const NAME = 'unpuzzle';
const ACC = ACCENT[NAME];

const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const SLIDE_DUR  = 0.26;
const SLIDE_WIND = 0.07;   // anticipation: the tile loads up before it goes
const BOUNCE_DUR = 0.26;
const JIGGLE_DUR = 0.22;
const POP_DUR    = 0.30;
const CLEAR_HOLD = 1.5;

let level  = 0;
let board  = null;   // { name, cols, rows, ghost, tiles, total }
let view   = null;   // the one cell -> screen transform; everything routes through it
let clearT = -1;     // >= 0 once the board is empty and the celebration is running
let held   = null;   // the tile under the finger, for the press-down
let shake  = 0;
let punch  = 0;      // the counter's kick when a tile leaves

// Capped hard: a mid-range phone will draw a few dozen small shapes a frame
// without noticing and will absolutely notice a few hundred.
const MAX_BITS = 130;
const bits = [];

function spark(x, y, color, opts = {}) {
  if (bits.length >= MAX_BITS) return;
  const { vx = 0, vy = 0, life = 0.5, size = 6, grav = 0, spin = 0, back = false } = opts;
  bits.push({ x, y, vx, vy, life, max: life, size, color, grav, rot: 0, spin, back });
}

// Deterministic spread — update has to stay reproducible, so the "randomness"
// comes from the index rather than Math.random.
const spread = (i, n) => (i / n) * Math.PI * 2 + (i % 3) * 0.7;

// Phones that support it get a tick; the ones that do not carry on silently.
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } };

// ---------------------------------------------------------------- board model

function loadLevel(i) {
  const src = LEVELS[i % LEVELS.length];
  const carved = carve(src, { seed: src.seed });
  const midX = (carved.cols - 1) / 2, midY = (carved.rows - 1) / 2;

  board = {
    name: carved.name,
    cols: carved.cols,
    rows: carved.rows,
    total: carved.tiles.length,
    ghost: carved.tiles.map((t) => [t.x, t.y]),
    palette: [...new Set(carved.tiles.map((t) => t.color))],
    tiles: carved.tiles.map((t) => ({
      x: t.x, y: t.y, color: t.color, dir: t.dir,
      gone: false, slide: null, bounce: 0, jiggle: 0, press: 0,
      // Tiles arrive from the middle outwards, so the animal assembles itself
      // rather than appearing all at once.
      pop: -Math.hypot(t.x - midX, t.y - midY) * 0.045,
    })),
  };
  clearT = -1;
  held = null;
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
// until the tile is off the board, and stop at the first occupied cell. The
// blocker comes back too — pointing at what stopped you is worth more than
// simply refusing the tap.
function sweep(t) {
  const [dx, dy] = DIR[t.dir];
  const limit = board.cols + board.rows + 2;
  for (let s = 1; s <= limit; s++) {
    const x = t.x + dx * s, y = t.y + dy * s;
    if (!inside(x, y)) return { clear: true, steps: s + 1 };  // +1 carries it off screen
    const hit = occupant(x, y, t);
    if (hit) return { clear: false, blocker: hit };
  }
  return { clear: true, steps: limit };
}

function trySlide(t, audio) {
  if (!t || t.gone || t.slide || clearT >= 0) return;
  const result = sweep(t);

  if (result.clear) {
    t.slide = { t: 0, steps: result.steps, left: false };
    puff(t);
    const remaining = board.tiles.filter((q) => !q.gone && !q.slide).length;
    // Pitch climbs as the board empties, so a long level builds instead of
    // repeating the same note thirty times.
    audio.play('place', { rate: 1 + 0.55 * (1 - remaining / board.total) });
    buzz(10);
  } else {
    t.bounce = BOUNCE_DUR;
    result.blocker.jiggle = JIGGLE_DUR;
    sparksAt(t, result.blocker);
    shake = Math.max(shake, 0.35);
    audio.play('tap', { rate: 0.4 });  // there is no `thunk` preset; rate is the only knob
    buzz(18);
  }
}

// Dust where the tile was, not where it went — the eye is still at the origin
// when the tap lands, and that is where the departure needs to register.
function puff(t) {
  const { ox, oy, cell } = view;
  const cx = ox + (t.x + 0.5) * cell, cy = oy + (t.y + 0.5) * cell;
  for (let i = 0; i < 7; i++) {
    const a = spread(i, 7);
    const speed = cell * (1.1 + (i % 4) * 0.35);
    spark(cx, cy, t.color, {
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      life: 0.30 + (i % 3) * 0.09, size: cell * (0.10 + (i % 3) * 0.035),
      grav: cell * 3.4, spin: (i % 2 ? 1 : -1) * 7,
    });
  }
}

// Sparks land on the seam between the two tiles, so the refusal has a location.
function sparksAt(t, blocker) {
  const { ox, oy, cell } = view;
  const [dx, dy] = DIR[t.dir];
  const cx = ox + (t.x + 0.5 + dx * 0.5) * cell;
  const cy = oy + (t.y + 0.5 + dy * 0.5) * cell;
  for (let i = 0; i < 5; i++) {
    const a = spread(i, 5);
    spark(cx, cy, blocker.color, {
      vx: (Math.cos(a) - dx * 1.4) * cell * 1.5,
      vy: (Math.sin(a) - dy * 1.4) * cell * 1.5,
      life: 0.22 + (i % 2) * 0.07, size: cell * 0.075,
      grav: cell * 5, spin: 9,
    });
  }
}

function confetti() {
  const { ox, oy, cell } = view;
  const cx = ox + (board.cols / 2) * cell, cy = oy + (board.rows / 2) * cell;
  for (let i = 0; i < 34; i++) {
    const a = spread(i, 34);
    const speed = cell * (2.6 + (i % 5) * 0.7);
    spark(cx, cy, board.palette[i % board.palette.length], {
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - cell * 1.6,
      life: 0.9 + (i % 4) * 0.2, size: cell * (0.11 + (i % 3) * 0.04),
      grav: cell * 6, spin: (i % 2 ? 1 : -1) * 11,
    });
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
  const padX = 22, top = 156, bottom = 82;
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

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
const easeOutBack = (t) => {
  const k = clamp01(t) - 1;
  return 1 + 2.70158 * k * k * k + 1.70158 * k * k;
};

function update(dt, game) {
  let alive = 0;

  for (const t of board.tiles) {
    if (t.pop < POP_DUR) t.pop += dt;
    if (t.bounce > 0) t.bounce = Math.max(0, t.bounce - dt);
    if (t.jiggle > 0) t.jiggle = Math.max(0, t.jiggle - dt);

    const wantPress = t === held && !t.slide && !t.gone ? 1 : 0;
    t.press += (wantPress - t.press) * 0.35;

    if (t.slide) {
      t.slide.t += dt;
      // Stamp a mark every ~22ms of travel. Echoes alone vanish with the tile;
      // these outlive it, which is what makes the path readable after the fact.
      if (t.slide.t > SLIDE_WIND) {
        t.slide.ink = (t.slide.ink ?? 0) + dt;
        if (t.slide.ink >= 0.022) {
          t.slide.ink = 0;
          const p = poseOf(t);
          spark(view.ox + p.x + (t.x + 0.5) * view.cell,
                view.oy + p.y + (t.y + 0.5) * view.cell, t.color,
                { life: 0.30, size: view.cell * 0.66, back: true });
        }
      }
      if (!t.slide.left && t.slide.t >= SLIDE_DUR * 0.55) {
        t.slide.left = true;
        game.audio.play('whoosh');
      }
      if (t.slide.t >= SLIDE_DUR) { t.slide = null; t.gone = true; punch = 1; }
    }

    if (!t.gone) alive++;
  }

  shake = Math.max(0, shake - dt * 2.6);
  punch = Math.max(0, punch - dt * 3.4);

  for (let i = bits.length - 1; i >= 0; i--) {
    const b = bits[i];
    b.life -= dt;
    if (b.life <= 0) { bits.splice(i, 1); continue; }
    b.vy += b.grav * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rot += b.spin * dt;
  }

  if (alive === 0 && clearT < 0) {
    clearT = 0;
    confetti();
    game.audio.play('perfect');
    buzz([14, 60, 26]);
  }

  if (clearT >= 0) {
    clearT += dt;
    if (clearT >= CLEAR_HOLD) {
      level++;
      game.store.set('level', level);
      loadLevel(level);
      layout(game.stage);
      bits.length = 0;
    }
  }
}

// -------------------------------------------------------------------- render

function render(c, game) {
  const { stage } = game;
  c.fillStyle = COLOR.bg;
  c.fillRect(0, 0, stage.w, stage.h);
  if (!view) return;

  c.save();
  if (shake > 0) {
    // Deterministic wobble — update must stay reproducible, so no randomness.
    c.translate(Math.sin(shake * 91) * shake * 7, Math.cos(shake * 67) * shake * 7);
  }

  drawBoardGhost(c);
  drawBits(c, true);
  for (const t of board.tiles) drawOne(c, t);
  drawBits(c, false);
  c.restore();

  drawHud(c, stage);
  if (clearT >= 0) drawClear(c, stage);
}

// Trail marks are laid down behind the tiles; dust, sparks and confetti go on
// top. Same array, two passes — a moving tile has to stay above its own smear.
function drawBits(c, back) {
  for (const b of bits) {
    if (!!b.back !== back) continue;
    const k = b.life / b.max;
    const s = b.size * (0.45 + k * 0.55);
    c.save();
    c.globalAlpha = Math.min(1, k * 1.7);
    c.translate(b.x, b.y);
    c.rotate(b.rot);
    c.fillStyle = b.color;
    roundRect(c, -s / 2, -s / 2, s, s, s * 0.3);
    c.fill();
    c.restore();
  }
}

function drawBoardGhost(c) {
  const { ox, oy, cell } = view;
  if (clearT < 0) {
    drawGhost(c, board.ghost, ox, oy, cell);
    return;
  }
  // The silhouette is what the level was; on a clear it takes a breath in the
  // accent colour before the next animal arrives.
  const k = clamp01(clearT / 0.45);
  drawGhost(c, board.ghost, ox, oy, cell, {
    color: ACC,
    alpha: 0.30 + 0.45 * Math.sin(k * Math.PI),
    scale: 1 + 0.05 * Math.sin(k * Math.PI),
  });
}

// Where a tile is right now, and how deformed — one place so nothing drifts.
function poseOf(t) {
  const { cell } = view;
  const [dx, dy] = DIR[t.dir];
  const pose = { x: 0, y: 0, alpha: 1, press: t.press, scale: 1, stretch: 1 };

  const born = clamp01(t.pop / POP_DUR);
  if (t.pop <= 0) { pose.scale = 0; return pose; }
  if (born < 1) pose.scale = easeOutBack(born);

  if (t.slide) {
    const tt = t.slide.t;
    let travel;
    if (tt < SLIDE_WIND) {
      // Wind up against the exit first; leaving without it reads as a teleport.
      travel = -0.16 * Math.sin((tt / SLIDE_WIND) * Math.PI / 2);
    } else {
      const k = easeOut((tt - SLIDE_WIND) / (SLIDE_DUR - SLIDE_WIND));
      travel = -0.16 * (1 - k) + k * t.slide.steps;
      pose.alpha = 1 - Math.max(0, (k - 0.6) / 0.4);   // fades as it crosses the edge
      pose.stretch = 1 + 0.30 * Math.sin(k * Math.PI);
    }
    pose.x = dx * travel * cell;
    pose.y = dy * travel * cell;
    return pose;
  }

  if (t.bounce > 0) {
    // Two decaying shoves toward the exit — an illegal tap must feel answered.
    const p = 1 - t.bounce / BOUNCE_DUR;
    const amp = Math.exp(-p * 4.5) * 0.20 * cell;
    pose.x = dx * Math.sin(p * Math.PI * 3) * amp;
    pose.y = dy * Math.sin(p * Math.PI * 3) * amp;
  }

  if (t.jiggle > 0) {
    // The blocker answers too, so the player can see what stopped the move.
    const p = 1 - t.jiggle / JIGGLE_DUR;
    pose.scale *= 1 + Math.sin(p * Math.PI) * 0.12;
  }

  return pose;
}

function drawOne(c, t) {
  if (t.gone) return;
  const { ox, oy, cell } = view;
  const p = poseOf(t);

  // Echoes strung out behind a moving tile, on top of the stamped trail.
  if (t.slide && t.slide.t > SLIDE_WIND) {
    for (let i = 5; i >= 1; i--) {
      const f = 1 - i * 0.11;
      drawTile(c, ox + p.x * f + t.x * cell, oy + p.y * f + t.y * cell, cell, t.color, t.dir, {
        alpha: p.alpha * (0.46 - i * 0.07),
        scale: p.scale * (1 - i * 0.045),
        stretch: p.stretch,
      });
    }
  }

  drawTile(c, ox + p.x + t.x * cell, oy + p.y + t.y * cell, cell, t.color, t.dir, p);
}

function pill(c, text, cx, cy, bg, fg) {
  c.font = `${TYPE.label.weight} ${TYPE.label.size}px ${TYPE.family}`;
  const w = c.measureText(text).width + 30;
  roundRect(c, cx - w / 2, cy - 16, w, 32, 16);
  c.fillStyle = bg;
  c.fill();
  c.fillStyle = fg;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, cx, cy);
  return w;
}

const pillWidth = (c, text) => {
  c.font = `${TYPE.label.weight} ${TYPE.label.size}px ${TYPE.family}`;
  return c.measureText(text).width + 30;
};

function drawHud(c, stage) {
  const left = board.tiles.filter((t) => !t.gone).length;
  const y = 58;
  const lvl = `LEVEL ${level + 1}`;
  const rest = `SISA ${left}`;

  c.save();
  pill(c, lvl, 22 + pillWidth(c, lvl) / 2, y, COLOR.white, COLOR.baseSoft);

  // The counter kicks on every tile that leaves — the one number that changes
  // should be the one thing that moves.
  const rw = pillWidth(c, rest);
  c.save();
  c.translate(stage.w - 22 - rw / 2, y);
  c.scale(1 + punch * 0.22, 1 + punch * 0.22);
  pill(c, rest, 0, 0, left ? COLOR.base : ACC, COLOR.white);
  c.restore();

  // The animal's name is the title of the screen, not a third equal label.
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.fillStyle = COLOR.base;
  c.font = `${TYPE.title.weight} 27px ${TYPE.family}`;
  c.fillText(board.name.toUpperCase(), stage.w / 2, y + 62);
  c.restore();
}

function drawClear(c, stage) {
  const y = view.oy + board.rows * view.cell + Math.max(44, view.cell * 0.9);
  const rise = easeOutBack(clamp01(clearT / 0.4));

  c.save();
  c.globalAlpha = clamp01(clearT * 4);
  c.textAlign = 'center';
  c.fillStyle = COLOR.base;
  c.font = `${TYPE.title.weight} ${TYPE.title.size}px ${TYPE.family}`;
  c.translate(stage.w / 2, y);
  c.scale(rise, rise);
  c.fillText('SELESAI!', 0, 0);
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
    // Press down on touch, not on release — the tile has to answer the finger
    // before anything else happens.
    onDown(p, pointers, game) {
      held = tileAt(p.x, p.y);
    },

    onMove(p) {
      if (held && tileAt(p.x, p.y) !== held) held = null;
    },

    // A tap carries no direction, so it uses the tile's own arrow.
    onTap(p, game) {
      trySlide(tileAt(p.x, p.y), game.audio);
    },

    // A flick never arrives as onTap — 12px of drift already sets p.moved and
    // kills it — so the direction is read here instead, from where the finger
    // started rather than where it ended.
    onUp(p, pointers, game) {
      const from = view ? tileAt(p.startX, p.startY) : null;
      held = null;
      if (!p.moved || !from) return;
      if (Math.hypot(p.dx, p.dy) < view.cell * 0.3) return;

      const [dx, dy] = DIR[from.dir];
      const along = p.dx * dx + p.dy * dy;
      const across = Math.abs(p.dx * dy - p.dy * dx);
      if (along > across) {
        trySlide(from, game.audio);
      } else {
        // Flicked the wrong way: answer it, and let the arrow do the teaching.
        from.bounce = BOUNCE_DUR;
        shake = Math.max(shake, 0.25);
        game.audio.play('tap', { rate: 0.4 });
        buzz(18);
      }
    },
  },

  update,
  render,
});
