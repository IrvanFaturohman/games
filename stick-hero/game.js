// Stick Hero — hold to grow the stick, release to drop it, cross the gap.
//
// Art direction and the scene-hue system live in style.js; all drawing lives in
// scene.js. This file is state only.

import { boot } from '../shared/boot.js';
import { SCENE_ORDER, mixScenes } from './style.js';
import {
  layout, drawBackground, drawPlatforms, drawStick, drawHero,
  drawEffects, drawHud, drawPrompt,
} from './scene.js';

const NAME = 'stick-hero';

const GROW_RATE    = 220;   // px/s — the whole feel of the game lives here
const FALL_TIME    = 0.32;  // stick swinging down
const WALK_SPEED   = 175;
const CAM_TIME     = 0.40;
const PERFECT_MAX  = 7;     // half-width of the double-score zone, on a wide platform
const RAMP_OVER    = 20;    // points from opening difficulty to full
const SCENE_EVERY  = 5;
const SCENE_FADE   = 0.9;

const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const buzz = (p) => { try { navigator.vibrate?.(p); } catch {} };

const S = {
  phase: 'idle',
  platforms: [], index: 0,
  stick: { x: 0, len: 0, angle: 0, wobble: 0 },
  hero: { x: 0, y: 0, walkPhase: null, squash: 0, crouch: 0, spin: 0 },
  cam: 0, camFrom: 0, camTo: 0, camT: 1,
  fallT: 0, dropV: 0, walkTo: 0, landed: false, pendingPerfect: false,
  score: 0, best: 0,
  time: 0, flash: 0, shake: 0, punch: 0,
  puffs: [], rings: [], popup: null,
  sceneFrom: SCENE_ORDER[0], sceneTo: SCENE_ORDER[0], mixT: 1,
};

const platform = (i) => S.platforms[i];
const rightEdge = (p) => p.x + p.w;
// Hero stands 20px in from the right edge, but never past the middle — on a
// narrow platform a fixed inset would place it off the left side entirely.
const standX = (p) => rightEdge(p) - Math.min(20, p.w / 2);
const maxReach = (stage) => stage.w - layout(stage).pivotX - 24;

// Difficulty has to actually ramp — flat random geometry reads as easy forever
// no matter how wide the spread is. Platforms narrow and gaps stretch together.
const difficulty = () => Math.min(1, Math.max(0, (S.score - 2) / RAMP_OVER));

function addPlatform(stage) {
  const last = S.platforms[S.platforms.length - 1];
  const opening = S.platforms.length <= 3;   // first few near-impossible to fail
  const d = opening ? 0 : difficulty();

  const w = rand(lerp(96, 16, d), lerp(122, 32, d));
  const gapMin = opening ? 44 : lerp(52, 100, d);
  // Never generate a gap the player cannot span before the stick runs off screen.
  const gapMax = Math.max(gapMin + 12,
    Math.min(opening ? 84 : lerp(98, 252, d), maxReach(stage) - w - 12));

  S.platforms.push({
    x: rightEdge(last) + rand(gapMin, gapMax),
    w,
    // Scaled, not fixed: a 14px zone on a 30px platform would make perfects
    // routine exactly when they should be getting rare.
    half: Math.min(PERFECT_MAX, w * 0.13),
  });
}

function reset(stage) {
  const L = layout(stage);
  // Starts off-screen left so the first platform has no visible left edge.
  S.platforms = [{ x: -220, w: 340, half: PERFECT_MAX }];
  S.index = 0;
  S.score = 0;
  while (S.platforms.length < 4) addPlatform(stage);

  const p = platform(0);
  S.cam = S.camFrom = S.camTo = rightEdge(p) - L.pivotX;
  S.camT = 1;
  S.hero = { x: standX(p), y: L.groundY, walkPhase: null, squash: 0, crouch: 0, spin: 0 };
  S.stick = { x: rightEdge(p), len: 0, angle: 0, wobble: 0 };
  S.flash = S.shake = S.punch = 0;
  S.puffs = []; S.rings = []; S.popup = null;
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

function puff(x, y, n, dark = false) {
  for (let i = 0; i < n; i++) {
    S.puffs.push({
      x, y, vx: rand(-75, 75), vy: rand(-140, -35),
      r: rand(2.5, 5.5), t: 0, max: rand(0.35, 0.62), dark,
    });
  }
}

function release(game) {
  if (S.phase !== 'growing') return;
  S.phase = 'falling';
  S.fallT = 0;
  S.stick.wobble = 0;
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
    S.stick = { x: rightEdge(platform(S.index)), len: 0, angle: 0, wobble: 0 };
    game.audio.play('tap');
  },
  onUp(p, pointers, game) { release(game); },
};

function stepEffects(dt) {
  S.time += dt;
  if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 3.2);
  if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 3.5);
  if (S.punch > 0) S.punch = Math.max(0, S.punch - dt * 3.2);
  if (S.hero.squash > 0) S.hero.squash = Math.max(0, S.hero.squash - dt * 5);
  if (S.mixT < 1) S.mixT = Math.min(1, S.mixT + dt / SCENE_FADE);

  for (let i = S.puffs.length - 1; i >= 0; i--) {
    const e = S.puffs[i];
    e.t += dt; e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 300 * dt;
    if (e.t >= e.max) S.puffs.splice(i, 1);
  }
  for (let i = S.rings.length - 1; i >= 0; i--) {
    const r = S.rings[i];
    r.t += dt;
    if (r.t >= r.max) S.rings.splice(i, 1);
  }
  if (S.popup) { S.popup.t += dt; if (S.popup.t >= S.popup.max) S.popup = null; }
}

function update(dt, game) {
  const stage = game.stage;
  const L = layout(stage);
  stepEffects(dt);

  switch (S.phase) {
    case 'idle':
      S.hero.crouch = Math.max(0, S.hero.crouch - dt * 6);
      break;

    case 'growing': {
      S.stick.len += GROW_RATE * dt;
      // Sways more the longer it gets — sells the weight and warns you that
      // holding longer is not free.
      S.stick.wobble = Math.sin(S.time * 9) * Math.min(1, S.stick.len / 180) * 0.022;
      S.hero.crouch = Math.min(1, S.stick.len / 200);
      const cap = stage.h * 0.92;
      if (S.stick.len > cap) { S.stick.len = cap; release(game); }
      break;
    }

    case 'falling': {
      S.fallT += dt / FALL_TIME;
      S.stick.angle = easeOut(Math.min(1, S.fallT)) * (Math.PI / 2);
      S.hero.crouch = Math.max(0, S.hero.crouch - dt * 6);
      if (S.fallT >= 1) {
        S.stick.angle = Math.PI / 2;
        const tip = S.stick.x + S.stick.len;
        const next = platform(S.index + 1);
        S.landed = !!next && tip >= next.x && tip <= rightEdge(next);
        S.pendingPerfect =
          S.landed && Math.abs(tip - (next.x + next.w / 2)) <= next.half;
        S.walkTo = S.landed ? standX(next) : tip;
        S.phase = 'walking';
        S.hero.walkPhase = 0;
        S.shake = Math.max(S.shake, 0.35);
        puff(tip, L.groundY, 5, true);
        game.audio.play('place');
        buzz(8);
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
          const gained = S.pendingPerfect ? 2 : 1;
          S.score += gained;
          S.punch = 1;
          S.hero.squash = 1;
          const next = platform(S.index + 1);
          if (S.pendingPerfect) {
            S.flash = 1;
            S.rings.push({ x: next.x + next.w / 2, y: L.groundY, t: 0, max: 0.5 });
            puff(next.x + next.w / 2, L.groundY, 10);
            S.popup = { text: '+2', x: S.hero.x, y: L.groundY - 76, t: 0, max: 0.7 };
            game.audio.play('perfect');
            buzz(30);
          } else {
            game.audio.play('score');
            buzz(12);
          }
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
          puff(S.hero.x, L.groundY, 8, true);
          game.audio.play('fail');
          buzz([30, 50, 30]);
        }
      }
      break;
    }

    case 'scroll': {
      S.camT = Math.min(1, S.camT + dt / CAM_TIME);
      S.cam = S.camFrom + (S.camTo - S.camFrom) * easeInOut(S.camT);
      if (S.camT >= 1) {
        S.stick = { x: rightEdge(platform(S.index)), len: 0, angle: 0, wobble: 0 };
        S.phase = 'idle';
      }
      break;
    }

    case 'dropping': {
      S.dropV += 2100 * dt;
      S.hero.y += S.dropV * dt;
      S.hero.spin += dt * 5.5;
      S.stick.angle = Math.min(Math.PI, S.stick.angle + dt * 5);
      if (S.hero.y > stage.h + 140) {
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
    const m = S.shake * S.shake * 11;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }
  drawBackground(ctx, stage, S.cam, pal);
  drawPlatforms(ctx, stage, S.cam, pal, S.platforms, S.index, S.time);
  drawStick(ctx, stage, S.cam, pal, S.stick);
  drawHero(ctx, stage, S.cam, pal, S.hero);
  drawEffects(ctx, stage, S.cam, pal, S);
  ctx.restore();

  drawHud(ctx, stage, pal, {
    score: S.score, best: Math.max(S.best, S.score), flash: S.flash, punch: S.punch,
  });
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
      difficulty,
    };
  }
});
