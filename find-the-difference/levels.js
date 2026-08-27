// Deterministic difficulty curve: every campaign level maps to the same config
// so retrying a level faces the same challenge. Only where the impostors land
// is random, which is what stops a retry from being pure memory.
// Port of Game.Gameplay.LevelConfigGenerator.

import { ANOMALY_COUNT } from './rules.js';

export const MAX_CAMPAIGN_LEVELS = 100;
export const MIN_SUBTLE = 0.1;
export const MAX_SUBTLE = 0.95;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function campaign(level) {
  level = clamp(Math.round(level), 1, MAX_CAMPAIGN_LEVELS);

  // Hand-tuned tutorials introduce one anomaly at a time before the curve takes over.
  if (level === 1) return config(3, 4, 1, 0, 0.1);
  if (level === 2) return config(3, 4, 1, 1, 0.15);
  if (level === 3) return config(3, 5, 2, 2, 0.2);

  let cols, rows;
  if (level <= 5) { cols = 3; rows = 4; }
  else if (level <= 15) { cols = 4; rows = 5; }
  else if (level <= 30) { cols = 4; rows = 6; }
  else if (level <= 50) { cols = 5; rows = 6; }
  else if (level <= 80) { cols = 5; rows = 7; }
  else { cols = 6; rows = 7; } // fat-finger ceiling for phones

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
  const rows = Math.min(8, 4 + Math.floor(round / 4));
  const impostors = Math.min(4, 1 + Math.floor(round / 6));
  const anomaly = rng.int(ANOMALY_COUNT);
  const subtle = clamp(round * 0.05, MIN_SUBTLE, 0.9);
  return config(cols, rows, impostors, anomaly, subtle);
}

function config(cols, rows, impostorCount, anomaly, subtle) {
  return { cols, rows, impostorCount, anomaly, subtle, totalCells: cols * rows };
}
