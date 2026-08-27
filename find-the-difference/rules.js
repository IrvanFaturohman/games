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
    edit: null,   // a shape edit applied to the sticker; see SHAPE below
    rotation: 0,  // radians
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
export function buildImpostorState(anomaly, subtle, rng) {
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
      // Unity authors a second sprite per fruit; the Figma stickers have none,
      // so the impostor is the SAME sticker with one detail changed — a bite
      // out of its outline, or a spot added on it. Both work on any silhouette,
      // which a hand-authored variant per sticker would not.
      state.edit = {
        kind: rng.int(2) === 0 ? 'remove' : 'add',
        // Where on the sticker, as an angle out from its centre. Fixed once per
        // round so every impostor in a grid carries the same difference.
        angle: rng.next() * Math.PI * 2,
        strength: 1 - subtle,
      };
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
