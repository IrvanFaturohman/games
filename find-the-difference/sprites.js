// Turning a sticker SVG into the two bitmaps a round draws.
//
// Only two appearances exist per round — normal and impostor — so each is
// rasterised once into an offscreen canvas and the grid becomes blits. That
// matters more here than it did with drawn shapes: an SVG with a filter is far
// more expensive to re-rasterise than a dozen bezier paths.

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
 * Rasterise `img` to fit a `box` square, preserving its aspect, then apply the
 * impostor's differences: a multiply tint the way SpriteRenderer.color does,
 * and a shape edit carved into or painted onto the sticker itself.
 */
export function makeSprite(img, options, box, dpr) {
  // `?? {}` rather than a default parameter: callers pass an explicit null for
  // the plain sprite, and a default only fills in for `undefined`.
  const { tint, edit } = options ?? {};
  const natural = Math.max(img.naturalWidth, img.naturalHeight) || 1;
  const scale = box / natural;
  const w = Math.max(1, img.naturalWidth * scale);
  const h = Math.max(1, img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w * dpr));
  canvas.height = Math.max(1, Math.ceil(h * dpr));
  const c = canvas.getContext('2d', { willReadFrequently: true });
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

  // After the tint, never before: the tint's `destination-in` pass would put
  // back exactly the alpha a `remove` edit had just carved away.
  if (edit) applyEdit(c, canvas, w, edit);

  return { canvas, w, h };
}

/**
 * One detail changed on the sticker: a bite out of its outline, placed by
 * walking out from the centre along `edit.angle` to the sticker's own edge so it
 * lands on the shape rather than in the empty corners of its box.
 */
function applyEdit(c, canvas, w, edit) {
  const { angle, strength } = edit;
  let pixels;
  try {
    // getImageData ignores the context transform and reads device pixels, which
    // is why every measurement below is converted back with `toCss`.
    pixels = c.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return; // tainted canvas; only possible if the SVG ever came cross-origin
  }

  const { data, width, height } = pixels;
  const box = alphaBounds(data, width, height);
  if (!box) return;

  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const reach = Math.hypot(width, height);

  // A sticker is one solid blob, so the last opaque pixel along the ray is its
  // outline. Scanning beats hardcoding a radius: the shapes are not circles.
  let edge = 0;
  for (let r = 1; r < reach; r++) {
    const x = Math.round(cx + dx * r);
    const y = Math.round(cy + dy * r);
    if (x < 0 || y < 0 || x >= width || y >= height) break;
    if (data[(y * width + x) * 4 + 3] > 128) edge = r;
  }
  if (edge <= 2) return;

  // Size by the whole sticker, not by how far the outline happens to be along
  // this one ray. Scaling by the ray made a bite on a spring onion — long and
  // thin, so a sideways ray is short — too small to see at any strength. The
  // geometric mean of the bounds is what keeps a stalk and a cookie comparable.
  const unit = Math.sqrt((box.maxX - box.minX) * (box.maxY - box.minY)) / 2;
  const toCss = w / width;

  // Centred ON the outline, so half the disc falls outside and it reads as a
  // bite rather than a hole punched through the middle.
  c.globalCompositeOperation = 'destination-out';
  disc(c, (cx + dx * edge) * toCss, (cy + dy * edge) * toCss,
    unit * (0.18 + 0.38 * strength) * toCss);
  c.globalCompositeOperation = 'source-over';
}

/** Bounds of the opaque pixels — the sticker sits inside a box padded by its
 *  own export, so the canvas centre is not the shape's centre. */
function alphaBounds(data, width, height) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= 128) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

function disc(c, x, y, r) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
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
    return fallback;
  }

  let best = null;
  let bestScore = -1;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
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
