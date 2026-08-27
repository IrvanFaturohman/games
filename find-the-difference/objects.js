// Object sets, drawn as canvas paths rather than exported sprites.
//
// The Unity original ships 512px PNGs per fruit plus one per shape variant.
// Here a fruit is a dozen paths in a unit box, which costs no asset pipeline,
// stays crisp at every DPR, and lets the shape variants be a parameter on the
// same drawing instead of a second file that can drift from the first.
//
// Everything draws inside x,y in [-0.5, 0.5]; the caller scales.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Unity tints through SpriteRenderer.color, which multiplies. Doing the same
// multiply per fill reproduces it exactly and avoids a composite pass.
export function tinted(hex, tint) {
  if (!tint || (tint[0] === 1 && tint[1] === 1 && tint[2] === 1)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * clamp01(tint[0]));
  const g = Math.round(((n >> 8) & 255) * clamp01(tint[1]));
  const b = Math.round((n & 255) * clamp01(tint[2]));
  return `rgb(${r},${g},${b})`;
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

// The face is the same on every fruit — it is what makes the set read as a
// family, so a difference elsewhere is the only thing a player can be looking at.
function face(ctx, t, cheek) {
  ctx.fillStyle = tinted(cheek, t);
  ellipse(ctx, -0.128, 0.092, 0.046, 0.026);
  ellipse(ctx, 0.128, 0.092, 0.046, 0.026);

  ctx.fillStyle = tinted('#2B2B2B', t);
  ellipse(ctx, -0.062, 0.030, 0.026, 0.030);
  ellipse(ctx, 0.062, 0.030, 0.026, 0.030);

  ctx.strokeStyle = tinted('#2B2B2B', t);
  ctx.lineWidth = 0.020;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0.052, 0.054, 0.16 * Math.PI, 0.84 * Math.PI);
  ctx.stroke();
}

const STRAWBERRY_SEEDS = [
  [-0.175, -0.115, -0.35], [-0.010, -0.155, 0.05], [0.163, -0.118, 0.35],
  [-0.258, 0.010, -0.20], [0.252, 0.015, 0.22],
  [-0.188, 0.180, -0.30], [0.182, 0.178, 0.30],
  [-0.040, 0.268, 0.00], [0.078, 0.322, 0.15],
];

// `round` pulls the silhouette toward a ball. It is the obvious shape variant:
// a strawberry that lost its point reads as wrong from across the grid.
function strawberryBody(ctx, round) {
  const waist = 0.22 + round * 0.18;  // how late the sides start closing in
  const tip = 0.45 - round * 0.05;
  ctx.beginPath();
  ctx.moveTo(0, -0.30);
  ctx.bezierCurveTo(-0.28, -0.34, -0.44, -0.16, -0.42, 0.00);
  ctx.bezierCurveTo(-0.40, waist, -0.20, tip, 0, tip);
  ctx.bezierCurveTo(0.20, tip, 0.40, waist, 0.42, 0.00);
  ctx.bezierCurveTo(0.44, -0.16, 0.28, -0.34, 0, -0.30);
  ctx.closePath();
}

const STRAWBERRY = {
  name: 'strawberry',
  theme: '#FBCF4C',
  burstColor: '#F2635E',
  variantCount: 2,
  draw(ctx, variant, t) {
    strawberryBody(ctx, variant === 0 ? 1 : 0);
    ctx.fillStyle = tinted('#F2635E', t);
    ctx.fill();
    ctx.strokeStyle = tinted('#1A1A1A', t);
    ctx.lineWidth = 0.014;
    ctx.stroke();

    if (variant !== 0) {
      ctx.fillStyle = tinted('#5CC79A', t);
      ellipse(ctx, -0.170, -0.258, 0.150, 0.068, -0.44);
      ellipse(ctx, 0.170, -0.258, 0.150, 0.068, 0.44);
      ellipse(ctx, 0.000, -0.298, 0.126, 0.078, 0.00);
      ctx.fillStyle = tinted('#3FA97F', t);
      ctx.fillRect(-0.022, -0.428, 0.044, 0.132);
    }

    // Variant 1 is the subtle one: a single seed short of the base fruit.
    const seeds = variant === 1 ? STRAWBERRY_SEEDS.slice(1) : STRAWBERRY_SEEDS;
    ctx.fillStyle = tinted('#F7DEC9', t);
    for (const [x, y, a] of seeds) ellipse(ctx, x, y, 0.019, 0.031, a);

    face(ctx, t, '#F6A9A2');
  },
};

const ORANGE_PORES = [
  [-0.235, -0.055], [0.245, -0.060], [-0.292, 0.085], [0.286, 0.090],
  [-0.152, 0.245], [0.146, 0.250], [-0.030, 0.302], [0.078, -0.232], [-0.086, -0.246],
];

const ORANGE = {
  name: 'orange',
  theme: '#45C3DE',
  burstColor: '#F5A23F',
  variantCount: 2,
  draw(ctx, variant, t) {
    // No outline here, unlike the strawberry. The two sets have to be
    // distinguishable at a glance or alternating levels feel like one level.
    ctx.fillStyle = tinted('#F5A23F', t);
    ellipse(ctx, 0, 0.015, 0.405, 0.405);

    if (variant !== 0) {
      const leaf = variant === 1 ? 0.72 : 1;
      ctx.fillStyle = tinted('#8A5A34', t);
      ctx.save();
      ctx.translate(0, -0.345);
      ctx.rotate(-0.06);
      ctx.fillRect(-0.022, -0.062, 0.044, 0.160);
      ctx.restore();
      ctx.fillStyle = tinted('#4FC79B', t);
      ellipse(ctx, 0.138, -0.398, 0.132 * leaf, 0.072 * leaf, -0.42);
    }

    ctx.fillStyle = tinted('#F8BC64', t);
    for (const [x, y] of ORANGE_PORES) ellipse(ctx, x, y, 0.016, 0.016);

    face(ctx, t, '#F7C3B4');
  },
};

export const SETS = [STRAWBERRY, ORANGE];

// Cycles so consecutive levels always look different.
export function setForLevel(level) {
  return SETS[(Math.max(1, level) - 1) % SETS.length];
}
