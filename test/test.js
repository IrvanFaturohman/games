// Device diagnostic. Everything here answers a question that would otherwise
// bite us silently once three games are built on this shell.

import { createStage, startLoop } from '../shared/engine.js';
import { createInput } from '../shared/input.js';
import { createAudio } from '../shared/audio.js';
import { COLOR, ACCENT } from '../shared/tokens.js';

const canvas = document.getElementById('stage');
const stage  = createStage(canvas);
const audio  = createAudio();

const ACC = ACCENT['stick-hero'];

// --- state -----------------------------------------------------------------
let taps = 0;
let holdMs = 0;
let holding = false;
let box = { x: 0, y: 0, size: 84, grabbed: false, ox: 0, oy: 0 };
let trail = [];
let fps = 0, fpsAcc = 0, fpsFrames = 0;
let audioBtn = { x: 0, y: 0, w: 0, h: 52 };
let lastSound = '—';

stage.onResize(() => {
  box.x = stage.w / 2 - box.size / 2;
  box.y = stage.h * 0.52;
});
box.x = stage.w / 2 - box.size / 2;
box.y = stage.h * 0.52;

// --- safe area probe -------------------------------------------------------
// env() is only readable from CSS, so we mirror it onto a hidden element.
const probe = document.createElement('div');
probe.style.cssText = `position:fixed;top:0;left:0;width:0;height:0;
  padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);
  padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);
  visibility:hidden;pointer-events:none;`;
document.body.appendChild(probe);
const safeArea = () => {
  const s = getComputedStyle(probe);
  return {
    t: parseFloat(s.paddingTop) || 0, r: parseFloat(s.paddingRight) || 0,
    b: parseFloat(s.paddingBottom) || 0, l: parseFloat(s.paddingLeft) || 0,
  };
};

// --- input -----------------------------------------------------------------
const input = createInput(stage, {
  onDown(p) {
    audio.unlock();
    if (hit(audioBtn, p)) { audio.play('perfect'); lastSound = 'perfect'; return; }
    if (p.x >= box.x && p.x <= box.x + box.size && p.y >= box.y && p.y <= box.y + box.size) {
      box.grabbed = true; box.ox = p.x - box.x; box.oy = p.y - box.y;
    }
  },
  onMove(p) {
    if (box.grabbed) {
      box.x = clamp(p.x - box.ox, 0, stage.w - box.size);
      box.y = clamp(p.y - box.oy, 0, stage.h - box.size);
    }
    trail.push({ x: p.x, y: p.y, life: 1 });
    if (trail.length > 90) trail.shift();
  },
  onUp() { box.grabbed = false; },
  onTap() { taps++; audio.play('tap'); lastSound = 'tap'; },
  onHoldStart() { holding = true; holdMs = 0; audio.play('whoosh'); lastSound = 'whoosh'; },
  onHoldEnd() { holding = false; audio.play('score'); lastSound = 'score'; },
});

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hit = (r, p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

// --- loop ------------------------------------------------------------------
startLoop({
  update(dt) {
    if (holding) holdMs += dt * 1000;
    for (const t of trail) t.life -= dt * 1.6;
    trail = trail.filter(t => t.life > 0);
    fpsAcc += dt; fpsFrames++;
    if (fpsAcc >= 0.5) { fps = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }
  },
  render() { draw(stage.ctx); },
});

function draw(c) {
  const { w, h } = stage;
  const sa = safeArea();

  c.fillStyle = COLOR.bg;
  c.fillRect(0, 0, w, h);

  // Safe-area boundary: if the notch or home indicator overlaps anything,
  // it shows up as content crossing this line.
  c.strokeStyle = '#D9D4C7';
  c.lineWidth = 2;
  c.setLineDash([6, 6]);
  c.strokeRect(sa.l + 1, sa.t + 1, w - sa.l - sa.r - 2, h - sa.t - sa.b - 2);
  c.setLineDash([]);

  // Crispness reference: 1px hairlines. Blurry here == DPR scaling is wrong.
  for (let i = 0; i < 5; i++) {
    c.fillStyle = COLOR.base;
    c.fillRect(w - 60, sa.t + 150 + i * 6, 44, 1);
  }

  // Touch trail
  for (const t of trail) {
    c.globalAlpha = t.life * 0.5;
    c.fillStyle = ACC;
    c.beginPath(); c.arc(t.x, t.y, 10 * t.life, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;

  // Draggable box
  c.fillStyle = box.grabbed ? ACC : COLOR.base;
  c.fillRect(box.x, box.y, box.size, box.size);
  c.fillStyle = COLOR.bg;
  c.font = '700 13px "Baloo 2", system-ui, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('DRAG', box.x + box.size / 2, box.y + box.size / 2);

  // Live multi-touch dots — confirms the phone reports more than one finger.
  let n = 0;
  for (const p of input.pointers.values()) {
    c.strokeStyle = ACC; c.lineWidth = 3;
    c.beginPath(); c.arc(p.x, p.y, 30, 0, Math.PI * 2); c.stroke();
    c.fillStyle = ACC;
    c.font = '800 15px "Baloo 2", system-ui, sans-serif';
    c.fillText(String(++n), p.x, p.y - 44);
  }

  // Hold meter
  if (holding) {
    const pw = Math.min(holdMs / 1500, 1) * (w * 0.6);
    c.fillStyle = COLOR.line;
    c.fillRect(w * 0.2, h - sa.b - 90, w * 0.6, 10);
    c.fillStyle = ACC;
    c.fillRect(w * 0.2, h - sa.b - 90, pw, 10);
  }

  // Audio test button
  audioBtn = { x: w * 0.2, y: h - sa.b - 66, w: w * 0.6, h: 52 };
  c.fillStyle = audio.ready ? COLOR.base : COLOR.line;
  c.fillRect(audioBtn.x, audioBtn.y, audioBtn.w, audioBtn.h);
  c.fillStyle = audio.ready ? COLOR.bg : COLOR.baseSoft;
  c.font = '700 14px "Baloo 2", system-ui, sans-serif';
  c.fillText(audio.ready ? 'TES SUARA' : 'SENTUH DULU UNTUK AKTIFKAN AUDIO',
             audioBtn.x + audioBtn.w / 2, audioBtn.y + audioBtn.h / 2);

  // Readout
  const lines = [
    `viewport   ${w} x ${h} css px`,
    `canvas     ${canvas.width} x ${canvas.height} device px`,
    `dpr        ${(window.devicePixelRatio || 1).toFixed(2)}  →  dipakai ${stage.dpr}`,
    `safe area  t${sa.t.toFixed(0)} r${sa.r.toFixed(0)} b${sa.b.toFixed(0)} l${sa.l.toFixed(0)}`,
    `orientasi  ${w > h ? 'landscape' : 'portrait'}`,
    `fps        ${fps}`,
    `jari aktif ${input.pointers.size}`,
    `tap        ${taps}`,
    `hold       ${holding ? holdMs.toFixed(0) + ' ms' : 'tidak'}`,
    `audio      ${audio.ready ? 'aktif' : 'belum'} · terakhir: ${lastSound}`,
    `font       ${document.fonts?.check('700 16px "Baloo 2"') ? 'Baloo 2 termuat' : 'fallback sistem'}`,
  ];

  c.textAlign = 'left'; c.textBaseline = 'top';
  c.font = '600 13px ui-monospace, SFMono-Regular, Menlo, monospace';
  lines.forEach((line, i) => {
    c.fillStyle = COLOR.baseSoft;
    c.fillText(line, sa.l + 16, sa.t + 16 + i * 19);
  });

  c.fillStyle = COLOR.base;
  c.font = '800 22px "Baloo 2", system-ui, sans-serif';
  c.fillText('DEVICE TEST', sa.l + 16, sa.t + 16 + lines.length * 19 + 10);
  c.font = '600 13px "Baloo 2", system-ui, sans-serif';
  c.fillStyle = COLOR.baseSoft;
  c.fillText('Drag kotaknya · tap · tahan · pakai 2 jari', sa.l + 16, sa.t + 16 + lines.length * 19 + 42);
}
