// Stick Hero local design tokens.
//
// Mirrors Figma file 3MCjOe4tnvd5wTM4tPtE4Y — `tokens` for the unthemed parts,
// `scene` (one mode per entry in SCENES) for everything carrying the scene hue.
// Change both together or they drift.
//
// Local to this game on purpose; shared/tokens.js is untouched.
//
// THE RULE: one scene, one hue — foreground included.
//
//   Background bands are all painted in the SAME colour (`veil`) and separated
//   only by opacity. Opacity belongs to the layer, never to the shapes, or
//   overlaps inside a band darken twice and it shows its own seams.
//
//   `ink` is the scene hue at its darkest, so the foreground belongs to the
//   scene too. A neutral black reads as a hue from somewhere else and is the
//   fastest way to make this stop cohering.
//
//   Depth comes from the sky gradient showing through the translucent bands.
//   No overlay wash — it flattens the midground.
//
// Every scene is solved onto one luminance ladder, NOT one HSL ladder: yellow
// at L=50% reads far brighter than blue at L=50%, so the lightness was fitted
// per hue until each rung hit its target luminance. That is why every scene has
// the same contrast structure (sky 0.45 → 0.93, ink ~0.07, gap ~0.85) and no
// level is harder to read than another — and it is also what makes crossfading
// between two scenes safe, since the rungs line up.

import { COLOR as SHARED, ACCENT, TYPE, SPACE } from '../shared/tokens.js';

export { TYPE, SPACE };

// Constant across every scene — the hero never reskins.
export const FOREGROUND = {
  ...SHARED,
  accent:   ACCENT['stick-hero'],
  hero:     '#F5A64B',
  heroDeep: '#C4622A',
};

export const SCENES = {
  mint:    { skyTop: '#328864', skyMid: '#6BC9A2', skyBottom: '#D8F3E8', veil: '#134430', ink: '#071710', inkDeep: '#030D09', glow: '#FFFFFF' },
  azure:   { skyTop: '#3E7DA9', skyMid: '#90BAD7', skyBottom: '#E3EFF7', veil: '#193E5A', ink: '#09161E', inkDeep: '#040B11', glow: '#FFFFFF' },
  lilac:   { skyTop: '#9661C4', skyMid: '#C6A9E0', skyBottom: '#F2EAF9', veil: '#5B2589', ink: '#1E0D2C', inkDeep: '#100719', glow: '#FFFFFF' },
  blossom: { skyTop: '#C25A88', skyMid: '#DEA4BF', skyBottom: '#F9EAF0', veil: '#7C224B', ink: '#290D19', inkDeep: '#18060E', glow: '#FFFFFF' },
  ember:   { skyTop: '#BC614B', skyMid: '#DBA99C', skyBottom: '#F8EBE7', veil: '#6A2C1D', ink: '#23100B', inkDeep: '#130805', glow: '#FFFFFF' },
  amber:   { skyTop: '#8C7234', skyMid: '#CCB173', skyBottom: '#F4EDDB', veil: '#473713', ink: '#171307', inkDeep: '#0D0A03', glow: '#FFFFFF' },
};

export const SCENE_ORDER = ['mint', 'azure', 'lilac', 'blossom', 'ember', 'amber'];

export const RUNGS = ['skyTop', 'skyMid', 'skyBottom', 'veil', 'ink', 'inkDeep', 'glow'];

export function palette(name) {
  const scene = SCENES[name];
  if (!scene) throw new Error(`unknown scene: ${name}`);
  return { ...FOREGROUND, ...scene };
}

const hex2rgb = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const rgb2hex = (c) =>
  '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

// Safe only because every scene sits on the same luminance ladder — rung i of
// one scene always means the same depth as rung i of another, so a midpoint is
// still a legible palette rather than mud.
export function mixScenes(a, b, t) {
  if (t <= 0) return palette(a);
  if (t >= 1) return palette(b);
  const A = SCENES[a], B = SCENES[b];
  const out = {};
  for (const rung of RUNGS) {
    const ca = hex2rgb(A[rung]), cb = hex2rgb(B[rung]);
    out[rung] = rgb2hex(ca.map((v, i) => v + (cb[i] - v) * t));
  }
  return { ...FOREGROUND, ...out };
}

// Applied to the whole layer, never to its shapes.
export const OPACITY = { glow: 0.42, bandFar: 0.13, bandMid: 0.20, bandNear: 0.30 };

// Scroll factor per layer. 0 = pinned, 1 = moves with the world.
export const PARALLAX = {
  sky: 0, glow: 0.04, bandFar: 0.12, bandMid: 0.24, bandNear: 0.38, play: 1,
};

// Draw order, slowest first.
export const LAYERS = ['sky', 'glow', 'bandFar', 'bandMid', 'bandNear', 'play'];

export const RADIUS = { sharp: 0, sm: 8, md: 16, lg: 28, pill: 999 };
