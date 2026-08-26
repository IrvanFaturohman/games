// Levels are pictures. One letter per colour, '.' for empty, and every filled
// cell becomes one tile carrying one arrow. `carve.js` works out which way each
// arrow points at load, so nothing but the drawing is authored here.
//
// The tiles themselves carry the colour, so the picture reads straight off the
// board. Arrows are neutral — white, or a deep tint of the tile on light faces —
// and each tile's thickness is derived from its own colour. Eyes are cells
// painted `ink`.
//
// After editing, check every level still carves:  node unpuzzle/tools/author.mjs

import { PIECE } from './style.js';

export const LEVELS = [
  {
    name: 'ikan',
    art: [
      '..SSS...V',
      '.SSSSSSVV',
      'CSESSSSVV',
      '.BBBBBBVV',
      '..BBB...V',
    ],
    palette: {
      S: PIECE.sky, B: PIECE.sea, V: PIECE.violet, C: PIECE.coral, E: PIECE.ink,
    },
    seed: 23,
  },

  {
    name: 'anak ayam',
    art: [
      '...R....',
      '..RRR...',
      '..YYYY..',
      'OYEYYYY.',
      '.YYYWWY.',
      '.YYYWWY.',
      '..YYYY..',
      '..O..O..',
    ],
    palette: {
      R: PIECE.coral, Y: PIECE.amber, W: PIECE.orange, O: PIECE.orange, E: PIECE.ink,
    },
    seed: 11,
  },

  {
    name: 'kucing',
    art: [
      '.P...P.',
      '.POOOP.',
      'OOEOEOO',
      'OOMMMOO',
      '.OMMMO.',
      '.OOOOOT',
      '.A...A.',
    ],
    palette: {
      P: PIECE.pink, O: PIECE.orange, M: PIECE.cream, T: PIECE.orange,
      A: PIECE.amber, E: PIECE.ink,
    },
    seed: 7,
  },
];
