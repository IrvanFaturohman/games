// Deterministic difficulty curve: every campaign level maps to the same config
// so retrying a level faces the same challenge. Only where the impostors land
// is random, which is what stops a retry from being pure memory.
// Port of Game.Gameplay.LevelConfigGenerator.

import { ANOMALY_COUNT } from './rules.js';

export const MAX_CAMPAIGN_LEVELS = 100;
export const MIN_SUBTLE = 0.1;
export const MAX_SUBTLE = 0.95;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Rows that make the grid fill a portrait phone instead of floating in it.
 *
 * The board sizes its cells to `min(area/cols, area/rows)`, so a square-cell
 * grid only reaches both edges when `cols/rows` matches the play area's aspect —
 * about 0.54 on a 420x776 screen once the HUD is out. Unity's rows were all far
 * squarer than that (3x4 up to 6x7) and left 40-140px of background above and
 * below. These are the same columns with the rows the screen actually wants, so
 * a level holds more cells than the Unity original: 4 cols goes from 20 to 28,
 * 6 cols from 42 to 66. Impostor counts are untouched — it is more haystack,
 * not more needles.
 *
 * Fixed per column count, never derived from the live viewport: `RoundState` is
 * built from the cell count when the level starts, so a rotation or a URL bar
 * sliding away would otherwise change the size of a round already in play.
 * Tuned for a ~1.85 tall screen; a short one (an SE) keeps some side margin.
 */
function rowsFor(cols) {
  if (cols <= 3) return 6;
  if (cols === 4) return 7;
  if (cols === 5) return 9;
  return 11;
}

export function campaign(level) {
  level = clamp(Math.round(level), 1, MAX_CAMPAIGN_LEVELS);

  // Hand-tuned tutorials introduce one anomaly at a time before the curve takes over.
  if (level === 1) return config(3, rowsFor(3), 1, 0, 0.1);
  if (level === 2) return config(3, rowsFor(3), 1, 1, 0.15);
  if (level === 3) return config(3, rowsFor(3), 2, 2, 0.2);

  let cols;
  if (level <= 5) cols = 3;
  else if (level <= 30) cols = 4;
  else if (level <= 80) cols = 5;
  else cols = 6; // fat-finger ceiling for phones
  const rows = rowsFor(cols);

  let impostors = 1 + Math.floor((level - 1) / 4) % 3;
  if (level % 10 === 0) impostors = 4; // boss levels

  // A sine wave gives the curve breathing room instead of a monotone ramp.
  const baseSubtle = Math.min(MAX_SUBTLE, level / 100);
  const wave = Math.sin(level * 0.5) * 0.1;
  const subtle = clamp(baseSubtle + wave, MIN_SUBTLE, MAX_SUBTLE);

  const anomaly = (level * 7 + 13) % unlockedAnomalies(level);
  return config(cols, rows, impostors, anomaly, subtle);
}

export function unlockedAnomalies(level) {
  if (level > 40) return ANOMALY_COUNT;
  if (level > 25) return 5;
  if (level > 10) return 4;
  return 3;
}

// Ported alongside the campaign curve and, as in the Unity original, nothing
// drives it yet — the campaign loops back to level 1 at the cap.
export function endless(round, rng) {
  round = Math.max(1, Math.round(round));
  const cols = Math.min(6, 3 + Math.floor(round / 5));
  const rows = rowsFor(cols);
  const impostors = Math.min(4, 1 + Math.floor(round / 6));
  const anomaly = rng.int(ANOMALY_COUNT);
  const subtle = clamp(round * 0.05, MIN_SUBTLE, 0.9);
  return config(cols, rows, impostors, anomaly, subtle);
}

function config(cols, rows, impostorCount, anomaly, subtle) {
  return { cols, rows, impostorCount, anomaly, subtle, totalCells: cols * rows };
}
