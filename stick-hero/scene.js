// All drawing for Stick Hero. Pure rendering — no state changes, no timing.
// Everything is in CSS pixels; boot.js has already applied the DPR transform.

import { OPACITY, PARALLAX, TYPE } from './style.js';

const HERO_SCALE = 1.85;

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// Derived from stage size every frame, never cached at startup — the iOS URL
// bar changes height mid-session and stage.onResize does not fire for the
// initial size anyway.
// How much world fits on screen. Below 1 the camera pulls back: the play layer
// shrinks and the visible world widens by 1/ZOOM, which is what lets gaps get
// long enough to feel like a leap instead of a step.
let ZOOM = 0.32;
export const getZoom = () => ZOOM;
// Exposed so the camera can be dialled while the game runs — see __debug.
export const setZoom = (z) => { ZOOM = z; };

export function layout(stage) {
  const groundY = Math.round(stage.h * 0.76);
  const pivotX = Math.round(stage.w * 0.32);   // where the current platform's edge sits
  return {
    zoom: ZOOM,
    groundY, pivotX,           // screen px — background and HUD live here
    gy: groundY / ZOOM,        // the same ground line, in world units
    px: pivotX / ZOOM,
    bottom: stage.h / ZOOM,
    viewW: stage.w / ZOOM,     // how wide the world slice on screen actually is
  };
}

// One path per band, filled once under a single globalAlpha. Doing it this way
// rather than per-shape alpha is what stops overlaps darkening twice.
function band(ctx, w, h, { baseY, amp, wave, offset, color, alpha }) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-4, h + 4);
  for (let x = -4; x <= w + 4; x += 6) {
    const t = ((x + offset) / wave) * Math.PI * 2;
    const rise = 0.55 + 0.30 * Math.cos(t) + 0.15 * Math.cos(2 * t + 1.2);
    ctx.lineTo(x, baseY - amp * rise);
  }
  ctx.lineTo(w + 4, h + 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawBackground(ctx, stage, cam, pal) {
  const { w, h } = stage;

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, pal.skyTop);
  sky.addColorStop(0.52, pal.skyMid);
  sky.addColorStop(1, pal.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Real transparency here, unlike in Figma — the glow can actually vanish into
  // the sky instead of having to land on a matching colour. Pinned: it reads as
  // a light source, and a wrapped parallax offset would jump when it wrapped.
  const gx = w * 0.5, gy = h * 0.56, gr = Math.max(w, h) * 0.52;
  const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
  glow.addColorStop(0, rgba(pal.glow, 0.55));
  glow.addColorStop(0.6, rgba(pal.glow, 0.16));
  glow.addColorStop(1, rgba(pal.glow, 0));
  ctx.save();
  ctx.globalAlpha = OPACITY.glow;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // cam is in world units, the bands are drawn in screen units — scale the
  // offset or the background slides faster than the world it sits behind.
  const g = layout(stage).groundY;
  const c = cam * ZOOM;
  band(ctx, w, h, { baseY: g - h * 0.20, amp: h * 0.10, wave: 520,
    offset: -c * PARALLAX.bandFar, color: pal.veil, alpha: OPACITY.bandFar });
  band(ctx, w, h, { baseY: g - h * 0.11, amp: h * 0.09, wave: 430,
    offset: -c * PARALLAX.bandMid - 140, color: pal.veil, alpha: OPACITY.bandMid });
  band(ctx, w, h, { baseY: g - h * 0.03, amp: h * 0.075, wave: 350,
    offset: -c * PARALLAX.bandNear - 300, color: pal.veil, alpha: OPACITY.bandNear });
}

export function drawPlatforms(ctx, L, cam, pal, platforms, fromIndex, time) {
  const body = ctx.createLinearGradient(0, L.gy, 0, L.bottom);
  body.addColorStop(0, pal.ink);
  body.addColorStop(1, pal.inkDeep);

  platforms.forEach((p, i) => {
    const x = p.x - cam;
    if (x + p.w < -12 || x > L.viewW + 12) return;
    ctx.fillStyle = body;
    ctx.fillRect(x, L.gy, p.w, L.bottom - L.gy);

    // Only ahead of the hero — a marker on the platform you are standing on is
    // just noise. It breathes so the eye lands on it under time pressure.
    if (i > fromIndex && p.half > 1.5) {
      const pulse = 0.72 + 0.28 * Math.sin(time * 4 + i);
      ctx.fillStyle = rgba(pal.glow, pulse);
      ctx.fillRect(x + p.w / 2 - p.half, L.gy, p.half * 2, 18);
    }
  });
}

export function drawStick(ctx, L, cam, pal, stick) {
  if (!stick || stick.len <= 0) return;
  ctx.save();
  ctx.translate(stick.x - cam, L.gy);
  ctx.rotate(stick.angle + (stick.wobble || 0));
  ctx.fillStyle = pal.ink;
  ctx.fillRect(-8, -stick.len, 16, stick.len);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

export function drawHero(ctx, L, cam, pal, hero) {
  ctx.save();
  ctx.translate(hero.x - cam, hero.y);
  if (hero.spin) ctx.rotate(hero.spin);
  // Drawn oversized in world units so that after the zoom it still reads on a
  // phone — a 1:1 hero at ZOOM 0.62 loses its face.
  ctx.scale(HERO_SCALE, HERO_SCALE);

  // Squash keeps volume: what it loses in height it gains in width, pivoting on
  // the feet so the hero never appears to sink into the platform.
  const q = hero.squash || 0;
  ctx.scale(1 + q * 0.28, 1 - q * 0.28);

  const crouch = (hero.crouch || 0) * 5;
  const step = hero.walkPhase != null ? Math.sin(hero.walkPhase) * 4 : 0;

  ctx.fillStyle = pal.ink;
  roundRect(ctx, -9 + step, -10, 6, 10, 3);
  roundRect(ctx, 3 - step, -10, 6, 10, 3);

  ctx.fillStyle = pal.heroDeep;
  roundRect(ctx, -12, -30 + crouch, 28, 24, 11);
  ctx.fillStyle = pal.hero;
  roundRect(ctx, -14, -32 + crouch, 28, 24, 11);

  ctx.fillStyle = rgba(pal.glow, 0.85);
  roundRect(ctx, -6, -24 + crouch, 12, 15, 6);

  ctx.fillStyle = pal.heroDeep;
  roundRect(ctx, -14, -58 + crouch, 32, 30, 13);
  ctx.fillStyle = pal.hero;
  roundRect(ctx, -16, -60 + crouch, 32, 30, 13);

  ctx.fillStyle = pal.ink;
  for (const ex of [-8, 4]) {
    ctx.beginPath();
    ctx.ellipse(ex + 2, -49 + crouch, 2.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Positions come from the world, sizes are authored in screen pixels. Without
// the counter-scale a 3px ring stroke would render at 1px once the camera pulls
// back, and the +2 popup would be unreadable.
export function drawEffects(ctx, L, cam, pal, fx) {
  const z = L.zoom;
  const sx = (wx) => (wx - cam) * z;
  const sy = (wy) => wy * z;

  ctx.save();
  ctx.scale(1 / z, 1 / z);

  for (const r of fx.rings) {
    const t = r.t / r.max;
    ctx.globalAlpha = (1 - t) * 0.8;
    ctx.strokeStyle = pal.glow;
    ctx.lineWidth = 3 * (1 - t) + 1;
    ctx.beginPath();
    ctx.arc(sx(r.x), sy(r.y), 6 + t * 46, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const p of fx.puffs) {
    const t = p.t / p.max;
    ctx.globalAlpha = (1 - t) * 0.75;
    ctx.fillStyle = p.dark ? pal.ink : pal.glow;
    ctx.beginPath();
    ctx.arc(sx(p.x), sy(p.y), p.r * (1 - t * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }

  if (fx.popup) {
    const t = fx.popup.t / fx.popup.max;
    ctx.globalAlpha = 1 - t * t;
    ctx.fillStyle = pal.glow;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${TYPE.title.weight} ${TYPE.title.size}px ${TYPE.family}`;
    ctx.fillText(fx.popup.text, sx(fx.popup.x), sy(fx.popup.y) - t * 46);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawHud(ctx, stage, pal, { score, best, flash, punch }) {
  const { w } = stage;
  ctx.save();

  if (flash > 0) {
    ctx.globalAlpha = flash * 0.28;   // a punch, not a whiteout
    ctx.fillStyle = pal.glow;
    ctx.fillRect(0, 0, w, stage.h);
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.save();
  const cx = w / 2, cy = 64;
  ctx.translate(cx, cy);
  ctx.scale(1 + punch * 0.3, 1 + punch * 0.3);
  ctx.translate(-cx, -cy);
  ctx.fillStyle = rgba(pal.glow, 0.92);
  ctx.font = `${TYPE.score.weight} ${TYPE.score.size}px ${TYPE.family}`;
  ctx.fillText(String(score), cx, cy);
  ctx.restore();

  ctx.textAlign = 'right';
  ctx.fillStyle = rgba(pal.glow, 0.7);
  ctx.font = `${TYPE.label.weight} ${TYPE.label.size}px ${TYPE.family}`;
  ctx.fillText(`BEST ${best}`, w - 22, 62);
  ctx.restore();
}

export function drawPrompt(ctx, stage, pal, text) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(pal.glow, 0.8);
  ctx.font = `${TYPE.body.weight} ${TYPE.body.size}px ${TYPE.family}`;
  ctx.fillText(text, stage.w / 2, stage.h * 0.42);
  ctx.restore();
}
