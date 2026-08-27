// Pure round bookkeeping: which cells are impostors, combo and score.
// No canvas, no clock of its own — the caller passes `now`, which is what makes
// it testable and what keeps the combo window honest when a frame runs long.
// Port of Game.Gameplay.RoundState.

export const COMBO_WINDOW = 2.5;
export const POINTS_PER_HIT = 100;

export const MISS = 'miss';
export const CORRECT = 'correct';
export const WRONG = 'wrong';

export function createRound(cellCount, impostorCount, rng) {
  if (cellCount <= 0) throw new RangeError(`cellCount must be positive, got ${cellCount}`);
  if (impostorCount <= 0 || impostorCount > cellCount) {
    throw new RangeError(`impostorCount ${impostorCount} out of range for ${cellCount} cells`);
  }

  const impostors = new Array(cellCount).fill(false);
  let lastCorrectTime = -Infinity;
  let placed = 0;
  while (placed < impostorCount) {
    const i = rng.int(cellCount);
    if (impostors[i]) continue;
    impostors[i] = true;
    placed++;
  }

  return {
    cellCount,
    impostorCount,
    found: 0,
    combo: 0,
    maxCombo: 0,
    score: 0,

    get isComplete() { return this.found >= this.impostorCount; },

    isImpostor(index) {
      return index >= 0 && index < impostors.length && impostors[index];
    },

    remainingImpostors() {
      const out = [];
      for (let i = 0; i < impostors.length; i++) if (impostors[i]) out.push(i);
      return out;
    },

    tap(index, now) {
      if (this.isComplete || index < 0 || index >= impostors.length) {
        return { outcome: MISS, points: 0, combo: this.combo };
      }
      if (!impostors[index]) {
        this.combo = 0;
        return { outcome: WRONG, points: 0, combo: 0 };
      }

      impostors[index] = false;
      this.found++;
      this.combo = now - lastCorrectTime < COMBO_WINDOW ? this.combo + 1 : 1;
      lastCorrectTime = now;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      const points = POINTS_PER_HIT * this.combo;
      this.score += points;
      return { outcome: CORRECT, points, combo: this.combo };
    },

    // True on the frame the combo expires, so the HUD can hide it.
    decayCombo(now) {
      if (this.combo === 0 || now - lastCorrectTime <= COMBO_WINDOW) return false;
      this.combo = 0;
      return true;
    },
  };
}

// Injectable so a test can pin a board; the game passes the unseeded one.
export function createRng(seed) {
  if (seed === undefined) {
    return { int: (n) => Math.floor(Math.random() * n), next: () => Math.random() };
  }
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (n) => Math.floor(next() * n) };
}
