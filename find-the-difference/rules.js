// What makes one grid object look different from its neighbours.
// Port of Game.Gameplay.AnomalyType / ObjectVisualState / ImpostorRules.

// Order matters: levels.js unlocks anomalies by index as the campaign progresses.
export const ANOMALY = {
  COLOR: 0,
  SHAPE: 1,
  SCALE: 2,
  ROTATION: 3,
  OPACITY: 4,
  ANIMATION: 5,
};

export const ANOMALY_COUNT = 6;

export const ANOMALY_NAMES = ['color', 'shape', 'scale', 'rotation', 'opacity', 'animation'];

export function normalState() {
  return {
    tint: [1, 1, 1],
    variantIndex: -1, // -1 uses the set's base drawing
    rotation: 0,      // radians
    scale: 1,
    opacity: 1,
    wobbleSpeed: 1,
  };
}

/**
 * The look shared by every impostor in a round. Exactly one property deviates
 * from normal — two would let a player win by spotting the easier one.
 *
 * @param {number} subtle 0.1 = obvious difference, 0.95 = nearly invisible.
 */
export function buildImpostorState(anomaly, subtle, variantCount, rng) {
  // A set without authored variants cannot show a shape difference; fall back
  // so the round stays solvable.
  if (anomaly === ANOMALY.SHAPE && variantCount <= 0) anomaly = ANOMALY.COLOR;

  const state = normalState();
  switch (anomaly) {
    case ANOMALY.COLOR: {
      // The tint multiplies, so it can only pull channels down. Keeping one
      // channel at full strength pushes the hue toward it.
      const shift = 0.35 - 0.25 * subtle;
      const keep = rng.int(3);
      state.tint = [
        keep === 0 ? 1 : 1 - shift,
        keep === 1 ? 1 : 1 - shift,
        keep === 2 ? 1 : 1 - shift,
      ];
      break;
    }
    case ANOMALY.SHAPE:
      // Variants are authored obvious-first, so harder levels pick later ones.
      state.variantIndex = Math.max(0, Math.min(variantCount - 1,
        Math.round(subtle * (variantCount - 1))));
      break;
    case ANOMALY.SCALE:
      state.scale = 1 - 0.25 * (1 - subtle);
      break;
    case ANOMALY.ROTATION: {
      const direction = rng.int(2) === 0 ? -1 : 1;
      state.rotation = direction * (45 * Math.PI / 180) * (1 - subtle * 0.7);
      break;
    }
    case ANOMALY.OPACITY:
      state.opacity = 0.5 + 0.35 * subtle;
      break;
    case ANOMALY.ANIMATION:
      state.wobbleSpeed = 1.2 + 3 * (1 - subtle);
      break;
  }
  return state;
}
