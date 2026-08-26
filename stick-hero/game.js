// Stick Hero — hold to grow the stick, release to drop it, cross the gap.
//
// Art direction and the scene-hue system live in style.js; all drawing lives in
// scene.js. This file is state only.

import { boot } from '../shared/boot.js';
import { SCENE_ORDER, mixScenes } from './style.js';
import { layout, drawBackground, drawPlatforms, drawStick, drawHero, drawHud, drawPrompt } from './scene.js';

const NAME = 'stick-hero';

const GROW_RATE    = 220;   // px/s — the whole feel of the game lives here
const FALL_TIME    = 0.32;  // stick swinging down
const WALK_SPEED   = 165;
const CAM_TIME     = 0.40;
const PERFECT_HALF = 7;     // half-width of the double-score zone
const SCENE_EVERY  = 5;     // points between scene changes
const SCENE_FADE   = 0.9;

const rand = (a, b) => a + Math.random() * (b - a);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const S = {
  phase: 'idle',
  platforms: [],
  index: 0,
  stick: { x: 0, len: 0, angle: 0 },
  hero: { x: 0, y: 0, walkPhase: null, flip: false },
  cam: 0, camFrom: 0, camTo: 0, camT: 1,
  fallT: 0, dropV: 0, walkTo: 0, landed: false,
  score: 0, best: 0, flash: 0, shake: 0,
  sceneFrom: SCENE_ORDER[0], sceneTo: SCENE_ORDER[0], mixT: 1,
  pendingPerfect: false,
};

const platform = (i) => S.platforms[i];
const rightEdge = (p) => p.x + p.w;
const standX = (p) => rightEdge(p) - 20;

const maxReach = (stage) => stage.w - layout(stage).pivotX - 24;

function addPlatform(stage) {
  const last = S.platforms[S.platforms.length - 1];
  const easy = S.platforms.length <= 3;          // first few are near-impossible to fail
  const w = easy ? rand(92, 122) : rand(38, 104);
  // Never generate a gap the player cannot span before the stick runs off screen.
  const gapMax = Math.max(50, Math.min(easy ? 84 : 215, maxReach(stage) - w - 14));
  S.platforms.push({ x: rightEdge(last) + rand(easy ? 44 : 54, gapMax), w });
}

function reset(stage) {
  const L = layout(stage);
  // Starts off-screen left so the very first platform has no visible left edge.
  S.platforms = [{ x: -220, w: 340 }];
  S.index = 0;
  while (S.platforms.length < 4) addPlatform(stage);
  const p = platform(0);
  S.cam = S.camFrom = S.camTo = rightEdge(p) - L.pivotX;
  S.camT = 1;
  S.hero.x = standX(p);
  S.hero.y = L.groundY;
  S.hero.walkPhase = null;
  S.stick = { x: rightEdge(p), len: 0, angle: 0 };
  S.score = 0;
  S.flash = 0; S.shake = 0;
  S.phase = 'idle';
  S.sceneFrom = S.sceneTo = SCENE_ORDER[0];
  S.mixT = 1;
}

// Keep the run intact across an orientation or viewport-height change.
function relayout(stage) {
  const L = layout(stage);
  if (S.phase !== 'dropping' && S.phase !== 'dead') S.hero.y = L.groundY;
  S.camTo = rightEdge(platform(S.index)) - L.pivotX;
  if (S.phase !== 'scroll') { S.cam = S.camTo; S.camFrom = S.camTo; S.camT = 1; }
}

const targetScene = () =>
  SCENE_ORDER[Math.floor(S.score / SCENE_EVERY) % SCENE_ORDER.length];

function release(game) {
  if (S.phase !== 'growing') return;
  S.phase = 'falling';
  S.fallT = 0;
  game.audio.play('whoosh');
}

async function ready(game) {
  S.best = game.store.get('best', 0);
  // onResize never fires for the initial size, so lay out once here and only
  // re-lay-out later. Resetting on resize would wipe a run every time the iOS
  // URL bar slides away.
  reset(game.stage);
  game.stage.onResize(() => relayout(game.stage));
}

const input = {
  onDown(p, pointers, game) {
    if (S.phase === 'dead') { reset(game.stage); return; }
    if (S.phase !== 'idle') return;
    S.phase = 'growing';
    S.stick = { x: rightEdge(platform(S.index)), len: 0, angle: 0 };
    game.audio.play('tap');
  },
  onUp(p, pointers, game) { release(game); },
};

function update(dt, game) {
  const stage = game.stage;
  const L = layout(stage);

  if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 2.2);
  if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 3.5);
  if (S.mixT < 1) S.mixT = Math.min(1, S.mixT + dt / SCENE_FADE);

  switch (S.phase) {
    case 'growing': {
      S.stick.len += GROW_RATE * dt;
      const cap = stage.h * 0.92;
      if (S.stick.len > cap) { S.stick.len = cap; release(game); }
      break;
    }

    case 'falling': {
      S.fallT += dt / FALL_TIME;
      S.stick.angle = easeOut(Math.min(1, S.fallT)) * (Math.PI / 2);
      if (S.fallT >= 1) {
        S.stick.angle = Math.PI / 2;
        const tip = S.stick.x + S.stick.len;
        const next = platform(S.index + 1);
        S.landed = !!next && tip >= next.x && tip <= rightEdge(next);
        S.pendingPerfect =
          S.landed && Math.abs(tip - (next.x + next.w / 2)) <= PERFECT_HALF;
        S.walkTo = S.landed ? standX(next) : tip;
        S.phase = 'walking';
        S.hero.walkPhase = 0;
      }
      break;
    }

    case 'walking': {
      S.hero.walkPhase += dt * 14;
      const dir = Math.sign(S.walkTo - S.hero.x) || 1;
      S.hero.x += WALK_SPEED * dt * dir;
      if ((dir > 0 && S.hero.x >= S.walkTo) || (dir < 0 && S.hero.x <= S.walkTo)) {
        S.hero.x = S.walkTo;
        S.hero.walkPhase = null;
        if (S.landed) {
          S.score += S.pendingPerfect ? 2 : 1;
          if (S.pendingPerfect) { S.flash = 1; game.audio.play('perfect'); }
          else game.audio.play('score');
          const want = targetScene();
          if (want !== S.sceneTo) { S.sceneFrom = S.sceneTo; S.sceneTo = want; S.mixT = 0; }
          S.index++;
          addPlatform(stage);
          S.camFrom = S.cam;
          S.camTo = rightEdge(platform(S.index)) - L.pivotX;
          S.camT = 0;
          S.phase = 'scroll';
        } else {
          S.phase = 'dropping';
          S.dropV = 0;
          S.shake = 1;
          game.audio.play('fail');
        }
      }
      break;
    }

    case 'scroll': {
      S.camT = Math.min(1, S.camT + dt / CAM_TIME);
      S.cam = S.camFrom + (S.camTo - S.camFrom) * easeInOut(S.camT);
      if (S.camT >= 1) {
        S.stick = { x: rightEdge(platform(S.index)), len: 0, angle: 0 };
        S.phase = 'idle';
      }
      break;
    }

    case 'dropping': {
      S.dropV += 2100 * dt;
      S.hero.y += S.dropV * dt;
      S.stick.angle = Math.min(Math.PI, S.stick.angle + dt * 5);
      if (S.hero.y > stage.h + 120) {
        S.best = game.store.bestScore(S.score);
        S.phase = 'dead';
      }
      break;
    }
  }
}

function render(ctx, game) {
  const stage = game.stage;
  const pal = mixScenes(S.sceneFrom, S.sceneTo, S.mixT);

  ctx.save();
  if (S.shake > 0) {
    const m = S.shake * 7;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }
  drawBackground(ctx, stage, S.cam, pal);
  drawPlatforms(ctx, stage, S.cam, pal, S.platforms, PERFECT_HALF, S.index);
  drawStick(ctx, stage, S.cam, pal, S.stick);
  drawHero(ctx, stage, S.cam, pal, S.hero);
  ctx.restore();

  drawHud(ctx, stage, pal, { score: S.score, best: Math.max(S.best, S.score), flash: S.flash });
  if (S.phase === 'idle' && S.score === 0) drawPrompt(ctx, stage, pal, 'TAHAN UNTUK MEMANJANGKAN');
  if (S.phase === 'dead') drawPrompt(ctx, stage, pal, 'TAP UNTUK MAIN LAGI');
}

boot({ name: NAME, ready, input, update, render }).then((game) => {
  // Local-only harness: requestAnimationFrame is suspended in a background tab,
  // so automated checks need to drive the loop themselves.
  if (location.hostname === 'localhost') {
    window.__debug = {
      S, game, input,
      step: (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) update(dt, game); },
      paint: () => render(game.stage.ctx, game),
      reset: () => reset(game.stage),
    };
  }
});
