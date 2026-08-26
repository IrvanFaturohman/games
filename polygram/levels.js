// Tangram geometry and level data.
//
// A level is a list of piece placements, and the silhouette is drawn as the
// union of those placements. That inverts the usual authoring risk: a level is
// solvable by construction, and the only way to author a broken one is to let
// two pieces overlap.
//
// All three levels below are subsets of a single verified 4x4 dissection, so
// overlap is impossible — every placement is lifted straight out of a tiling
// that was checked to cover the square exactly once.
//
//   the dissection, on a 4x4 grid (y down)
//     LT  (0,0) (4,0) (2,2)        area 4     LT  (0,0) (2,2) (0,4)     area 4
//     MT  (4,2) (4,4) (2,4)        area 2
//     ST  (4,0) (4,2) (3,1)        area 1     ST  (2,2) (1,3) (3,3)     area 1
//     SQ  (3,1) (4,2) (3,3) (2,2)  area 2
//     PA  (1,3) (0,4) (2,4) (3,3)  area 2                        total 16
//
// Shapes are stored centred on their own centroid so rotation needs no pivot
// bookkeeping. Units are level units — the full square is 4 wide — and one
// transform in game.js maps them to the screen.

export const SHAPES = {
  LT: [[-2, -2 / 3], [2, -2 / 3], [0, 4 / 3]],            // large triangle
  MT: [[2 / 3, -4 / 3], [2 / 3, 2 / 3], [-4 / 3, 2 / 3]], // medium triangle
  ST: [[1 / 3, -1], [1 / 3, 1], [-2 / 3, 0]],             // small triangle
  SQ: [[0, -1], [1, 0], [0, 1], [-1, 0]],                 // square, on its corner
  PA: [[-0.5, -0.5], [-1.5, 0.5], [0.5, 0.5], [1.5, -0.5]], // parallelogram
};

// Rotational symmetry is handled by the snap test comparing vertex sets rather
// than angles, so nothing here has to declare it.

export const LEVELS = [
  {
    name: 'Tiga Keping',
    solution: [
      { t: 'ST', x: 11 / 3, y: 1, r: 0 },
      { t: 'SQ', x: 3, y: 2, r: 0 },
      { t: 'ST', x: 2, y: 8 / 3, r: 90 },
    ],
  },
  {
    name: 'Segitiga',
    solution: [
      { t: 'ST', x: 11 / 3, y: 1, r: 0 },
      { t: 'SQ', x: 3, y: 2, r: 0 },
      { t: 'ST', x: 2, y: 8 / 3, r: 90 },
      { t: 'MT', x: 10 / 3, y: 10 / 3, r: 0 },
      { t: 'PA', x: 1.5, y: 3.5, r: 0 },
    ],
  },
  {
    name: 'Kotak',
    solution: [
      { t: 'LT', x: 2, y: 2 / 3, r: 0 },
      { t: 'LT', x: 2 / 3, y: 2, r: 270 },
      { t: 'MT', x: 10 / 3, y: 10 / 3, r: 0 },
      { t: 'ST', x: 11 / 3, y: 1, r: 0 },
      { t: 'SQ', x: 3, y: 2, r: 0 },
      { t: 'ST', x: 2, y: 8 / 3, r: 90 },
      { t: 'PA', x: 1.5, y: 3.5, r: 0 },
    ],
  },
];

// Rotate a shape around its own centre and drop it at (cx, cy), scaled.
export function poly(type, cx, cy, deg, s) {
  const a = (deg * Math.PI) / 180;
  const co = Math.cos(a);
  const si = Math.sin(a);
  return SHAPES[type].map(([x, y]) => [
    cx + (x * co - y * si) * s,
    cy + (x * si + y * co) * s,
  ]);
}
