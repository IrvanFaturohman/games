// Levels are data, never code, so difficulty can be retuned without touching
// logic. A piece is `{cells, dir, color}` in board-grid coordinates.
//
// These three are test material for proving the feel, not the real set. The
// shipped levels need a solver verifying each one is actually clearable —
// difficulty comes from dependency depth, not piece count.

import { PIECE } from './style.js';

export const LEVELS = [
  // 1 — teach the verb. Every piece is already free; failing is not possible.
  {
    cols: 4, rows: 4,
    pieces: [
      { cells: [[0, 0], [1, 0]], dir: 'up',    color: PIECE.coral },
      { cells: [[3, 1], [3, 2]], dir: 'right', color: PIECE.blue },
      { cells: [[1, 3], [2, 3]], dir: 'down',  color: PIECE.amber },
    ],
  },

  // 2 — one dependency: the green pair cannot leave until the coral single does.
  {
    cols: 5, rows: 5,
    pieces: [
      { cells: [[2, 0]],         dir: 'up',    color: PIECE.coral },
      { cells: [[2, 1], [2, 2]], dir: 'up',    color: PIECE.green },
      { cells: [[0, 2], [1, 2]], dir: 'left',  color: PIECE.violet },
      { cells: [[4, 3]],         dir: 'right', color: PIECE.amber },
    ],
  },

  // 3 — two independent chains, two cells deep each. Note that picking a bad
  // order cannot lose: pieces only ever leave, so blockers only ever disappear
  // and a blocked piece always frees up eventually. The difficulty is search,
  // not strategy.
  {
    cols: 5, rows: 5,
    pieces: [
      { cells: [[0, 0], [1, 0], [2, 0]], dir: 'up',    color: PIECE.amber },
      { cells: [[1, 1], [1, 2]],         dir: 'up',    color: PIECE.green },
      { cells: [[0, 2], [0, 3]],         dir: 'left',  color: PIECE.blue },
      { cells: [[2, 2], [3, 2], [4, 2]], dir: 'right', color: PIECE.violet },
      { cells: [[3, 3], [3, 4]],         dir: 'down',  color: PIECE.orange },
      { cells: [[2, 3]],                 dir: 'left',  color: PIECE.coral },
    ],
  },
];
