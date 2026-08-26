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
import { drawTile, roundRect } from './style.js';

const NAME = 'unpuzzle';
const ACC = ACCENT[NAME];

const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const SLIDE_DUR  = 0.26;
const SLIDE_WIND = 0.07;   // anticipation: the tile loads up before it goes
const BOUNCE_DUR = 0.26;
const JIGGLE_DUR = 0.22;
const POP_DUR    = 0.30;
const CLEAR_HOLD = 1.5;

let screen  = 'select';   // 'select' | 'play'
let cleared = [];         // level indices finished, persisted
let cards   = [];         // hit-test rects for the select grid
let scrollY = 0, scrollMax = 0, dragFrom = 0;
let enter   = 0;          // the select screen's entrance

let level  = 0;
let board  = null;   // { name, cols, rows, dots, tiles, total }
let view   = null;   // the one cell -> screen transform; everything routes through it
let clearT = -1;     // >= 0 once the board is empty and the celebration is running
let held   = null;   // the tile under the finger, for the press-down
let shake  = 0;
let punch  = 0;      // the counter's kick when a tile leaves

// Camera. `view` fits the whole picture at zoom 1; this rides on top of it so a
// dense board can be pushed around and magnified to something a thumb can hit.
// screen = boardPixel * zoom + off
let zoom = 1, offX = 0, offY = 0;
let pinch = null;
let panLast = null;
let clearStep = 0;
const MIN_ZOOM = 0.75, MAX_ZOOM = 3.4;

const toBoard = (px, py) => ({ x: (px - offX) / zoom, y: (py - offY) / zoom });

// Zoom about a screen point, so whatever is under the fingers stays under them.
function zoomAt(mx, my, next) {
  const b = toBoard(mx, my);
  zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
  offX = mx - b.x * zoom;
  offY = my - b.y * zoom;
}

function resetCamera() { zoom = 1; offX = 0; offY = 0; pinch = null; }

// Keep the board's centre inside a generous box — dragging the picture entirely
// off screen is never what anyone meant to do.
function clampCamera(stage) {
  if (!view || !board) return;
  const cx = (view.ox + board.cols * view.cell / 2) * zoom + offX;
  const cy = (view.oy + board.rows * view.cell / 2) * zoom + offY;
  const padX = stage.w * 0.35, padY = stage.h * 0.28;
  offX += Math.max(padX - cx, 0) - Math.max(cx - (stage.w - padX), 0);
  offY += Math.max(padY - cy, 0) - Math.max(cy - (stage.h - padY), 0);
}

// Capped hard: a mid-range phone will draw a few dozen small shapes a frame
// without noticing and will absolutely notice a few hundred.
const MAX_BITS = 130;
const bits = [];

function spark(x, y, color, opts = {}) {
  if (bits.length >= MAX_BITS) return;
  const { vx = 0, vy = 0, life = 0.5, size = 6, grav = 0, spin = 0, back = false,
          ring = 0, grow = 0, width = 0 } = opts;
  bits.push({ x, y, vx, vy, life, max: life, size, color, grav, rot: 0, spin, back,
              ring, grow, width });
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
    // One dot per cell, in that cell's own colour, sitting under the tiles. It
    // shows the moment a tile slides off, so the picture is drawn in dots as the
    // board empties instead of leaving a grey hole behind.
    dots: carved.tiles.map((t) => ({
      x: t.x, y: t.y, color: t.color,
      // The finish sweeps outward from the middle instead of flashing at once.
      wake: Math.hypot(t.x - midX, t.y - midY) * 0.035,
    })),
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
  clearStep = 0;
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

function confetti(power = 1) {
  const { ox, oy, cell } = view;
  const cx = ox + (board.cols / 2) * cell, cy = oy + (board.rows / 2) * cell;
  const n = Math.round(40 * power);

  for (let i = 0; i < n; i++) {
    const a = spread(i, n);
    const speed = cell * (3.0 + (i % 5) * 0.9) * power;
    spark(cx, cy, board.palette[i % board.palette.length], {
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - cell * 2.0,
      life: 0.9 + (i % 4) * 0.22, size: cell * (0.13 + (i % 3) * 0.05),
      grav: cell * 6.5, spin: (i % 2 ? 1 : -1) * 12,
    });
  }

  // Rings carry the size of the moment in a way scattered bits cannot — they
  // read as one event instead of forty.
  for (let i = 0; i < 2; i++) {
    spark(cx, cy, i ? ACC : COLOR.base, {
      life: 0.55 + i * 0.15, ring: cell * 0.4, grow: cell * (11 - i * 3),
      width: cell * (0.16 - i * 0.05),
    });
  }
}

function tileAt(px, py) {
  if (!view) return null;
  const b = toBoard(px, py);
  const cx = Math.floor((b.x - view.ox) / view.cell);
  const cy = Math.floor((b.y - view.oy) / view.cell);
  return inside(cx, cy) ? occupant(cx, cy, null) : null;
}

// ------------------------------------------------------------- level select

// A level opens once the one before it is done. Index 0 is always open.
const unlocked = (i) => i === 0 || cleared.includes(i - 1);

function layoutSelect(stage) {
  const padX = 22, gap = 14, cols = 2;
  const w = (stage.w - padX * 2 - gap * (cols - 1)) / cols;
  const h = w * 1.16;
  const top = 178;

  cards = LEVELS.map((lv, i) => ({
    i,
    x: padX + (i % cols) * (w + gap),
    y: top + Math.floor(i / cols) * (h + gap),
    w, h,
  }));

  const last = cards[cards.length - 1];
  scrollMax = Math.max(0, last.y + h + 32 - stage.h);
  scrollY = Math.min(scrollY, scrollMax);
}

function startLevel(i, stage) {
  level = i;
  loadLevel(i);
  layout(stage);
  resetCamera();
  bits.length = 0;
  screen = 'play';
}

function toSelect(game) {
  bits.length = 0;
  board = null;
  view = null;
  enter = 0;
  screen = 'select';
  layoutSelect(game.stage);
}

function finishLevel(game) {
  if (!cleared.includes(level)) {
    cleared = [...cleared, level];
    game.store.set('cleared', cleared);
  }
  toSelect(game);
}

function pickCard(p, game) {
  const y = p.y + scrollY;
  for (const card of cards) {
    if (p.x < card.x || p.x > card.x + card.w) continue;
    if (y < card.y || y > card.y + card.h) continue;
    if (!unlocked(card.i)) { game.audio.play('tap', { rate: 0.4 }); buzz(18); return; }
    game.audio.play('place');
    buzz(10);
    startLevel(card.i, game.stage);
    return;
  }
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
  if (screen === 'select') {
    enter = Math.min(1, enter + dt * 2.6);
    return;
  }

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
    if (b.ring) b.ring += b.grow * dt;
  }

  if (alive === 0 && clearT < 0) {
    clearT = 0;
    clearStep = 0;
    confetti();
    game.audio.play('perfect');
    buzz([16, 50, 24, 50, 40]);
  }

  if (clearT >= 0) {
    clearT += dt;
    // Three beats rather than one bang: the burst, the picture landing, and the
    // flourish. One sound at one moment reads as an event ending, not a reward.
    if (clearStep === 0 && clearT > 0.30) {
      clearStep = 1;
      confetti(0.6);
      game.audio.play('score', { rate: 1.25 });
      shake = Math.max(shake, 0.4);
    }
    if (clearStep === 1 && clearT > 0.60) {
      clearStep = 2;
      game.audio.play('perfect', { rate: 1.4 });
      buzz(30);
    }
    if (clearT >= CLEAR_HOLD) finishLevel(game);
  }
}

// -------------------------------------------------------------------- render

function render(c, game) {
  const { stage } = game;
  c.fillStyle = COLOR.bg;
  c.fillRect(0, 0, stage.w, stage.h);

  if (screen === 'select') { renderSelect(c, stage); return; }
  if (!view || !board) return;

  c.save();
  if (shake > 0) {
    // Deterministic wobble — update must stay reproducible, so no randomness.
    c.translate(Math.sin(shake * 91) * shake * 7, Math.cos(shake * 67) * shake * 7);
  }

  c.translate(offX, offY);
  c.scale(zoom, zoom);

  // The whole picture takes a breath on a clear.
  if (clearT >= 0) {
    const pcx = view.ox + board.cols * view.cell / 2;
    const pcy = view.oy + board.rows * view.cell / 2;
    const k = 1 + 0.07 * Math.sin(clamp01(clearT / 0.7) * Math.PI);
    c.translate(pcx, pcy); c.scale(k, k); c.translate(-pcx, -pcy);
  }

  drawDots(c);
  drawBits(c, true);
  for (const t of board.tiles) drawOne(c, t);
  drawBits(c, false);
  c.restore();

  if (clearT >= 0 && clearT < 0.5) {
    c.save();
    c.globalAlpha = 0.42 * (1 - clearT / 0.5);
    c.fillStyle = COLOR.white;
    c.fillRect(0, 0, stage.w, stage.h);
    c.restore();
  }

  drawHud(c, stage);
  if (clearT >= 0) drawClear(c, stage);
}

// Trail marks are laid down behind the tiles; dust, sparks and confetti go on
// top. Same array, two passes — a moving tile has to stay above its own smear.
function drawBits(c, back) {
  for (const b of bits) {
    if (!!b.back !== back) continue;
    const k = b.life / b.max;

    if (b.ring) {
      c.save();
      c.globalAlpha = Math.min(1, k * 1.4) * 0.8;
      c.strokeStyle = b.color;
      c.lineWidth = b.width * k;
      c.beginPath();
      c.arc(b.x, b.y, b.ring, 0, Math.PI * 2);
      c.stroke();
      c.restore();
      continue;
    }

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

function drawDots(c) {
  const { ox, oy, cell } = view;
  const base = cell * 0.155;

  c.save();
  for (const d of board.dots) {
    // On a clear each dot pops as the wave reaches it, so the finish reads as
    // the picture arriving rather than as one flash.
    let r = base;
    if (clearT >= 0) {
      const k = clamp01((clearT - d.wake) / 0.42);
      if (k > 0) r = base * (1 + 1.05 * Math.sin(k * Math.PI) + 0.35 * k);
    }
    c.beginPath();
    c.arc(ox + (d.x + 0.5) * cell, oy + (d.y + 0.5) * cell, r, 0, Math.PI * 2);
    c.fillStyle = d.color;
    c.fill();
  }
  c.restore();
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

// A miniature of the level's own art. The card is the puzzle, shrunk — nothing
// to author and no thumbnail to keep in sync with the drawing.
function drawThumb(c, lv, x, y, w, h, muted) {
  const cols = lv.art[0].length, rows = lv.art.length;
  const cell = Math.min(w / cols, h / rows);
  const ox = x + (w - cell * cols) / 2;
  const oy = y + (h - cell * rows) / 2;

  lv.art.forEach((row, ry) => [...row].forEach((ch, cx) => {
    if (ch === '.') return;
    c.fillStyle = muted ? COLOR.line : lv.palette[ch];
    roundRect(c, ox + cx * cell + cell * 0.09, oy + ry * cell + cell * 0.09,
      cell * 0.82, cell * 0.82, cell * 0.26);
    c.fill();
  }));
}

// Small on purpose: it marks the card, it does not replace the thumbnail. The
// picture is the reason to want the level.
function drawLock(c, cx, cy, r) {
  c.save();
  c.strokeStyle = COLOR.baseSoft;
  c.lineWidth = r * 0.34;
  c.lineCap = 'round';
  c.beginPath();
  c.arc(cx, cy - r * 0.35, r * 0.52, Math.PI, 0);
  c.stroke();
  c.fillStyle = COLOR.baseSoft;
  roundRect(c, cx - r * 0.8, cy - r * 0.25, r * 1.6, r * 1.25, r * 0.3);
  c.fill();
  c.restore();
}

function drawTick(c, cx, cy, r) {
  c.save();
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fillStyle = ACC;
  c.fill();
  c.strokeStyle = COLOR.white;
  c.lineWidth = r * 0.32;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(cx - r * 0.42, cy);
  c.lineTo(cx - r * 0.08, cy + r * 0.36);
  c.lineTo(cx + r * 0.45, cy - r * 0.34);
  c.stroke();
  c.restore();
}

function drawCard(c, card) {
  const k = easeOutBack(clamp01((enter - card.i * 0.10) * 2.4));
  if (k <= 0) return;

  const lv = LEVELS[card.i];
  const open = unlocked(card.i);
  const done = cleared.includes(card.i);
  const r = card.w * 0.16;
  const depth = card.w * 0.045;
  const cx = card.x + card.w / 2, cy = card.y + card.h / 2;

  c.save();
  c.translate(cx, cy); c.scale(k, k); c.translate(-cx, -cy);
  c.globalAlpha = Math.min(1, k * 2);

  // Same language as a tile: a thickness under a face.
  roundRect(c, card.x, card.y + depth, card.w, card.h, r);
  c.fillStyle = open ? '#E4DDCC' : '#E9E5DB';
  c.fill();
  roundRect(c, card.x, card.y, card.w, card.h, r);
  c.fillStyle = open ? COLOR.white : '#F1EDE4';
  c.fill();

  drawThumb(c, lv, card.x, card.y + card.h * 0.07, card.w, card.h * 0.60, !open);

  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.fillStyle = open ? COLOR.base : COLOR.line;
  c.font = `${TYPE.label.weight} ${TYPE.label.size}px ${TYPE.family}`;
  c.fillText(lv.name.toUpperCase(), cx, card.y + card.h * 0.86);

  if (!open) drawLock(c, cx, card.y + card.h * 0.34, card.w * 0.095);
  else if (done) drawTick(c, card.x + card.w - 20, card.y + 20, 10);

  c.restore();
}

function renderSelect(c, stage) {
  c.save();
  c.translate(0, -scrollY);

  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.fillStyle = COLOR.base;
  c.font = `${TYPE.title.weight} ${TYPE.title.size}px ${TYPE.family}`;
  c.fillText('UNPUZZLE', stage.w / 2, 100);

  c.fillStyle = COLOR.baseSoft;
  c.font = `${TYPE.label.weight} ${TYPE.label.size}px ${TYPE.family}`;
  c.fillText(`${cleared.length} DARI ${LEVELS.length} SELESAI`, stage.w / 2, 132);

  for (const card of cards) drawCard(c, card);
  c.restore();
}

// Generous hit radius: the drawn circle is smaller than what the thumb gets.
const BACK = { x: 42, y: 58, r: 30 };

function drawBack(c) {
  const { x, y } = BACK, r = 21;
  c.save();
  c.beginPath(); c.arc(x, y + 3, r, 0, Math.PI * 2);
  c.fillStyle = '#E4DDCC'; c.fill();
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = COLOR.white; c.fill();
  c.strokeStyle = COLOR.base;
  c.lineWidth = 3.4; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(x + 5, y - 7); c.lineTo(x - 4, y); c.lineTo(x + 5, y + 7);
  c.stroke();
  c.restore();
}

function drawHud(c, stage) {
  const left = board.tiles.filter((t) => !t.gone).length;
  const y = 58;
  const rest = `SISA ${left}`;

  drawBack(c);
  c.save();

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
    cleared = game.store.get('cleared', []);
    layoutSelect(game.stage);
    game.stage.onResize(() => {
      layoutSelect(game.stage);
      if (board) layout(game.stage);
    });
  },

  input: {
    // Press down on touch, not on release — the tile has to answer the finger
    // before anything else happens.
    onDown(p) {
      if (screen !== 'play') { dragFrom = scrollY + p.y; return; }
      held = tileAt(p.x, p.y);
      panLast = { x: p.x, y: p.y };
      pinch = null;
    },

    onMove(p, pointers, game) {
      if (screen !== 'play') {
        // Drag scrolls the grid; input.js already withholds onTap once the
        // finger drifts past its slop, so the two gestures cannot both fire.
        if (scrollMax > 0) scrollY = Math.min(scrollMax, Math.max(0, dragFrom - p.y));
        return;
      }

      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        if (!pinch || d < 1) { pinch = { d: Math.max(d, 1), mx, my, zoom }; return; }
        held = null;
        // Pan by the midpoint first, then magnify about it, so whatever sits
        // between the fingers stays between them.
        offX += mx - pinch.mx;
        offY += my - pinch.my;
        pinch.mx = mx; pinch.my = my;
        zoomAt(mx, my, pinch.zoom * (d / pinch.d));
        clampCamera(game.stage);
        return;
      }

      // One finger drags the picture — but only once it has passed the same
      // slop that decides a tap, so a tap never nudges the camera.
      if (!p.moved || !panLast) return;
      held = null;
      offX += p.x - panLast.x;
      offY += p.y - panLast.y;
      panLast = { x: p.x, y: p.y };
      clampCamera(game.stage);
    },

    onTap(p, game) {
      if (screen === 'select') { pickCard(p, game); return; }
      if (Math.hypot(p.x - BACK.x, p.y - BACK.y) <= BACK.r) {
        game.audio.play('whoosh');
        toSelect(game);
        return;
      }
      // A tap carries no direction, so it uses the tile's own arrow.
      trySlide(tileAt(p.x, p.y), game.audio);
    },

    // Dragging now pans the board, so the flick-to-slide gesture is gone: the
    // two are the same motion and the arrow already says which way a tile goes.
    onUp(p, pointers) {
      held = null;
      panLast = null;
      if (pointers.size < 2) pinch = null;
    },
  },

  update,
  render,
});
