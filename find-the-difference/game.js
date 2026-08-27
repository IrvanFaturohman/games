// Find the impostor: a grid of identical objects, one property off on a few of
// them. Port of the Unity project at ~/Documents/GitHub/find-the-difference —
// RoundController is this file, the rest kept their own modules so the two
// codebases stay readable against each other.

import { boot } from '../shared/boot.js';
import { ACCENT, COLOR } from '../shared/tokens.js';
import { assetForLevel } from './catalog.js';
import { campaign, MAX_CAMPAIGN_LEVELS } from './levels.js';
import { buildImpostorState, normalState } from './rules.js';
import { cellCenter, fitBoard, hitTest } from './board.js';
import { CORRECT, WRONG, createRng, createRound } from './round.js';
import { accentColor, image, makeSprite, prefetch } from './sprites.js';

const NAME = 'find-the-difference';
const ACC = ACCENT[NAME];

const CELL_FILL = 0.78;        // object size as a fraction of its cell
const NEXT_LEVEL_DELAY = 1.2;
const HUD_HEIGHT = 86;
const PAD = 16;
const PAD_BOTTOM = 28;
// Sprites are rasterised bigger than they are ever drawn so the pop-in
// overshoot and the 1.5x correct-tap kick stay crisp.
const SPRITE_HEADROOM = 1.6;

const CORRECT_COLOR = '#FF4757';
const WRONG_COLOR = '#2E3336';

const EASE = {
  outBack(t) {
    const c1 = 1.70158, c3 = c1 + 1, p = t - 1;
    return 1 + c3 * p * p * p + c1 * p * p;
  },
  outElastic(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  outCubic(t) {
    const p = 1 - t;
    return 1 - p * p * p;
  },
};

const font = (weight, size) => `${weight} ${size}px "Baloo 2", system-ui, sans-serif`;

const rng = createRng();

let app = null;
let level = 1;
let config = null;
let asset = null;
let round = null;
let impostor = null;
let normal = normalState();

let art = null;        // {base, variant, accent} once the level's images land
let loadToken = 0;     // guards a slow level's images from landing after the next
let cells = [];
let board = null;
let layoutKey = '';
let sprites = null;

let clock = 0;
let acceptingInput = false;
let nextLevelIn = 0;
let safeTop = 0;

let camShake = null;
let popups = [];
let particles = [];
let progressPulse = 1;
let comboDisplay = 0;
let comboScale = 0;
let comboTarget = 0;

boot({
  name: NAME,

  ready(game) {
    app = game;
    safeTop = readSafeTop();
    const saved = game.store.get('level', 1);
    startLevel(Number.isFinite(saved) ? Math.min(Math.max(1, saved), MAX_CAMPAIGN_LEVELS) : 1);
  },

  input: {
    onTap(p, game) {
      handleTap(p.x, p.y, game);
    },
  },

  update(dt, game) {
    clock += dt;
    if (round.decayCombo(clock)) setCombo(0);

    layout(game.stage);
    stepCells(dt);
    stepPopups(dt);
    stepParticles(dt);

    if (camShake) {
      camShake.t += dt;
      if (camShake.t >= camShake.dur) camShake = null;
    }

    progressPulse += (1 - progressPulse) * Math.min(1, dt * 12);
    comboScale += (comboTarget - comboScale) * Math.min(1, dt * 14);

    if (nextLevelIn > 0) {
      nextLevelIn -= dt;
      if (nextLevelIn <= 0) {
        startLevel(level >= MAX_CAMPAIGN_LEVELS ? 1 : level + 1);
      }
    }
  },

  render(c, game) {
    const { stage } = game;
    layout(stage);

    // Same colour top and bottom: the style calls for a dead-flat field.
    c.fillStyle = asset.background;
    c.fillRect(0, 0, stage.w, stage.h);

    if (art) {
      ensureSprites(stage.dpr);
      c.save();
      if (camShake) {
        const k = 1 - camShake.t / camShake.dur;
        const amp = camShake.amp * k;
        c.translate(Math.sin(camShake.t * 61) * amp, Math.cos(camShake.t * 47) * amp);
      }
      drawGrid(c);
      drawParticles(c);
      drawPopups(c);
      c.restore();
    }

    drawHud(c, stage);
  },
});

function startLevel(n) {
  level = n;
  config = campaign(level);
  asset = assetForLevel(level);
  round = createRound(config.totalCells, config.impostorCount, rng);
  impostor = buildImpostorState(config.anomaly, config.subtle, rng);

  cells = [];
  for (let i = 0; i < config.totalCells; i++) {
    cells.push({
      // A random phase keeps the grid from breathing in lockstep, which would
      // read as one animated object and hide the animation anomaly.
      phase: Math.random() * Math.PI * 2,
      impostor: round.isImpostor(i),
      pop: null,
      shake: null,
    });
  }

  art = null;
  layoutKey = '';
  sprites = null;
  popups = [];
  particles = [];
  camShake = null;
  progressPulse = 1;
  comboDisplay = 0;
  comboScale = 0;
  comboTarget = 0;
  acceptingInput = false;
  nextLevelIn = 0;

  app?.store.set('level', level);
  loadArt();
}

async function loadArt() {
  const token = ++loadToken;
  // One image per level now: the impostor is this same sticker with an edit
  // baked into its sprite, never a second file.
  try {
    const base = await image(asset.src);
    if (token !== loadToken) return; // a newer level started while we waited
    art = { base, accent: accentColor(base, ACC) };
    for (let i = 0; i < cells.length; i++) {
      cells[i].pop = { from: 0, to: 1, dur: 0.35, delay: i * 0.012, ease: 'outBack', t: 0 };
    }
    acceptingInput = true;
  } catch (err) {
    // A missing sticker would otherwise be an empty screen with no explanation.
    console.error(`[find-the-difference] level ${level} art failed`, err);
    return;
  }

  const next = assetForLevel(level >= MAX_CAMPAIGN_LEVELS ? 1 : level + 1);
  prefetch([next.src]);
}

function handleTap(x, y, game) {
  if (!acceptingInput || !board) return;
  const index = hitTest(board, x, y);
  if (index < 0) return;

  const result = round.tap(index, clock);
  const cell = cells[index];
  const pos = cellCenter(board, index);

  if (result.outcome === CORRECT) {
    // Found impostors morph into normal objects rather than disappearing, so
    // the grid stays full and the remaining ones keep their camouflage.
    cell.impostor = false;
    cell.pop = { from: 1.5, to: 1, dur: 0.45, delay: 0, ease: 'outElastic', t: 0 };
    cell.shake = null;

    emitBurst(pos, 10);
    addPopup(pos.x, pos.y - board.cell * 0.3,
      result.combo > 1 ? `x${result.combo}!` : `+${result.points}`, CORRECT_COLOR);
    if (result.combo > 1) shakeCamera(0.06);
    progressPulse = 1.2;
    setCombo(result.combo);
    vibrate(result.combo > 1 ? [10, 30, 14] : 10);
    game.audio.play('score', { rate: Math.min(1.7, 1 + (result.combo - 1) * 0.09) });

    if (round.isComplete) {
      acceptingInput = false;
      nextLevelIn = NEXT_LEVEL_DELAY;
      game.audio.play('perfect');
    }
  } else if (result.outcome === WRONG) {
    cell.pop = { from: 0.8, to: 1, dur: 0.3, delay: 0, ease: 'outBack', t: 0 };
    cell.shake = { amp: 0.15, dur: 0.3, t: 0 };
    addPopup(pos.x, pos.y, 'Oops!', WRONG_COLOR);
    shakeCamera(0.1);
    setCombo(0);
    vibrate([26]);
    game.audio.play('fail');
  }
}

function setCombo(combo) {
  comboDisplay = combo;
  // Below 2 there is no combo to show; Unity collapses the label to zero scale.
  comboTarget = combo <= 1 ? 0 : Math.min(1.5, 1 + combo * 0.1);
  if (combo > 1) comboScale = comboTarget * 1.25;
}

function layout(stage) {
  const key = `${stage.w}x${stage.h}:${config.cols}x${config.rows}`;
  if (key === layoutKey) return;
  layoutKey = key;

  const top = safeTop + HUD_HEIGHT;
  board = fitBoard(config.cols, config.rows, {
    x: PAD,
    y: top,
    w: stage.w - PAD * 2,
    h: stage.h - top - PAD_BOTTOM,
  });
  sprites = null;
}

function ensureSprites(dpr) {
  if (sprites && sprites.cell === board.cell && sprites.dpr === dpr) return;
  const box = Math.max(24, board.cell * CELL_FILL * SPRITE_HEADROOM);
  sprites = {
    cell: board.cell,
    dpr,
    box,
    normal: makeSprite(art.base, null, box, dpr),
    impostor: makeSprite(art.base, { tint: impostor.tint, edit: impostor.edit }, box, dpr),
  };
}

function stepCells(dt) {
  for (const cell of cells) {
    const state = cell.impostor ? impostor : normal;
    cell.phase += dt * 2 * state.wobbleSpeed;
    if (cell.pop) {
      cell.pop.t += dt;
      if (cell.pop.t >= cell.pop.delay + cell.pop.dur) cell.pop = null;
    }
    if (cell.shake) {
      cell.shake.t += dt;
      if (cell.shake.t >= cell.shake.dur) cell.shake = null;
    }
  }
}

function popValue(cell) {
  const a = cell.pop;
  if (!a) return 1;
  if (a.t < a.delay) return a.from;
  const k = Math.min(1, (a.t - a.delay) / a.dur);
  return a.from + (a.to - a.from) * EASE[a.ease](k);
}

function drawGrid(c) {
  const fit = board.cell * CELL_FILL;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const state = cell.impostor ? impostor : normal;
    const pop = popValue(cell);
    if (pop <= 0) continue;

    const wobble = 1 + Math.sin(cell.phase) * 0.03;
    const sprite = cell.impostor ? sprites.impostor : sprites.normal;
    // The sticker keeps its own aspect: the sprite was rasterised to fit the
    // headroom box, so scaling by fit/box lands it inside the cell.
    const k = (fit / sprites.box) * state.scale * pop * wobble;
    const dw = sprite.w * k;
    const dh = sprite.h * k;
    const pos = cellCenter(board, i);

    let offsetX = 0;
    if (cell.shake) {
      const s = 1 - cell.shake.t / cell.shake.dur;
      offsetX = Math.sin(cell.shake.t * 46) * cell.shake.amp * s * board.cell;
    }

    c.save();
    c.translate(pos.x + offsetX, pos.y);
    if (state.rotation) c.rotate(state.rotation);
    c.globalAlpha = state.opacity;
    c.drawImage(sprite.canvas, -dw / 2, -dh / 2, dw, dh);
    c.restore();
  }
}

function addPopup(x, y, text, color) {
  popups.push({ x, y, text, color, t: 0, dur: 0.9, rise: board.cell * 0.8 });
}

function stepPopups(dt) {
  for (const p of popups) p.t += dt;
  popups = popups.filter((p) => p.t < p.dur);
}

function drawPopups(c) {
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (const p of popups) {
    const t = Math.min(1, p.t / p.dur);
    const eased = EASE.outCubic(t);
    const scale = 0.6 + 0.4 * Math.min(1, t * 4);
    c.save();
    c.globalAlpha = Math.max(0, 1 - t * t);
    c.fillStyle = p.color;
    c.font = font(800, Math.round(board.cell * 0.34 * scale));
    c.fillText(p.text, p.x, p.y - p.rise * eased);
    c.restore();
  }
}

function emitBurst(pos, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = board.cell * (1.1 + Math.random() * 1.7);
    particles.push({
      x: pos.x,
      y: pos.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      t: 0,
      dur: 0.45 + Math.random() * 0.2,
      r: board.cell * 0.055,
    });
  }
  // A tap during the tail of the previous burst must not grow the list forever.
  if (particles.length > 160) particles.splice(0, particles.length - 160);
}

function stepParticles(dt) {
  for (const p of particles) {
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += board.cell * 5 * dt;
    p.vx *= 0.94;
  }
  particles = particles.filter((p) => p.t < p.dur);
}

function drawParticles(c) {
  c.fillStyle = art.accent;
  for (const p of particles) {
    const k = 1 - p.t / p.dur;
    c.globalAlpha = k;
    c.beginPath();
    c.arc(p.x, p.y, p.r * k, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
}

function shakeCamera(strength) {
  camShake = { amp: strength * board.cell, dur: 0.3, t: 0 };
}

function drawHud(c, stage) {
  const top = safeTop + 14;
  c.textBaseline = 'top';

  c.textAlign = 'left';
  c.fillStyle = 'rgba(43,43,43,0.55)';
  c.font = font(700, 12);
  c.fillText('LVL', PAD + 2, top);
  c.fillStyle = COLOR.base;
  c.font = font(800, 34);
  c.fillText(String(level), PAD, top + 14);

  // Progress pill, right-aligned so the thumb never covers it.
  const label = `${round.found}/${round.impostorCount}`;
  c.font = font(800, 18);
  const textW = c.measureText(label).width;
  const pillW = textW + 30;
  const pillH = 34;
  const pillX = stage.w - PAD - pillW;
  const pillY = top + 10;

  c.save();
  c.translate(pillX + pillW / 2, pillY + pillH / 2);
  c.scale(progressPulse, progressPulse);
  c.fillStyle = COLOR.base;
  c.fillRect(-pillW / 2, -pillH / 2, pillW, pillH);
  c.fillStyle = ACC;
  c.fillRect(-pillW / 2, pillH / 2 - 4, pillW * (round.found / round.impostorCount), 4);
  c.fillStyle = COLOR.white;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = font(800, 18);
  c.fillText(label, 0, 1);
  c.restore();

  if (comboScale > 0.02) {
    c.save();
    c.translate(stage.w - PAD - pillW / 2, pillY + pillH + 20);
    c.scale(comboScale, comboScale);
    c.fillStyle = ACC;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = font(800, 22);
    c.fillText(`x${comboDisplay}`, 0, 0);
    c.restore();
  }
}

// The notch is a CSS value; the canvas has no way to ask for it directly.
function readSafeTop() {
  const probe = document.getElementById('safe-probe');
  if (!probe) return 0;
  return parseFloat(getComputedStyle(probe).paddingTop) || 0;
}

function vibrate(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported on iOS Safari */ }
}
