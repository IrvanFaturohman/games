// Turning a sticker SVG into the two bitmaps a round draws.
//
// Only two appearances exist per round — normal and impostor — so each is
// rasterised once into an offscreen canvas and the grid becomes blits. That
// matters more here than it did with drawn shapes: an SVG with a drop-shadow
// filter is far more expensive to re-rasterise than a dozen bezier paths.

import { loadImage } from '../shared/assets.js';

const pending = new Map();

/** Cached by URL, so a level that reuses a sticker never fetches it twice. */
export function image(src) {
  if (!pending.has(src)) pending.set(src, loadImage(src));
  return pending.get(src);
}

export function prefetch(srcs) {
  // A failed prefetch must not reject into the caller — the level that needs it
  // will fetch again and surface the error there.
  for (const src of srcs) image(src).catch(() => pending.delete(src));
}

/**
 * Rasterise `img` to fit a `box` square, preserving its aspect, tinted by a
 * multiply the way SpriteRenderer.color does.
 */
export function makeSprite(img, tint, box, dpr) {
  const natural = Math.max(img.naturalWidth, img.naturalHeight) || 1;
  const scale = box / natural;
  const w = Math.max(1, img.naturalWidth * scale);
  const h = Math.max(1, img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w * dpr));
  canvas.height = Math.max(1, Math.ceil(h * dpr));
  const c = canvas.getContext('2d');
  c.scale(canvas.width / w, canvas.height / h);
  c.drawImage(img, 0, 0, w, h);

  if (tint && (tint[0] !== 1 || tint[1] !== 1 || tint[2] !== 1)) {
    // `multiply` falls back to source-over wherever the destination is
    // transparent, so the fill would paint the whole box. Re-drawing the sprite
    // as `destination-in` clips the result back to its own alpha.
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = `rgb(${byte(tint[0])},${byte(tint[1])},${byte(tint[2])})`;
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(img, 0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
  }

  return { canvas, w, h };
}

/**
 * The sticker's punchiest colour, for the burst particles. Sampled rather than
 * listed per asset: 62 hand-picked colours is 62 chances to forget one.
 */
export function accentColor(img, fallback = '#FFFFFF') {
  const size = 16;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d', { willReadFrequently: true });
  c.drawImage(img, 0, 0, size, size);

  let data;
  try {
    data = c.getImageData(0, 0, size, size).data;
  } catch {
    return fallback; // tainted canvas; only possible if the SVG ever came cross-origin
  }

  let best = null;
  let bestScore = -1;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 200) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max === 0) continue;
    // Saturation times lightness: picks a vivid mid-tone over both the white
    // keyline (no saturation) and a near-black outline (no lightness).
    const score = ((max - min) / max) * (max / 255);
    if (score > bestScore) { bestScore = score; best = `rgb(${r},${g},${b})`; }
  }
  return best ?? fallback;
}

const byte = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255);
