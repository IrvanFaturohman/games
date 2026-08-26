// Levels are pictures. One letter per colour, '.' for empty, and every filled
// cell becomes one tile carrying one arrow. `carve.js` works out which way each
// arrow points at load, so nothing but the drawing is authored here.
//
// The picture reads from its silhouette plus the arrow colours — the tile faces
// are all the same tan, as in the reference. Eyes are just cells painted `ink`.
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
      '.SSSSSSVV',
      '..SSS...V',
    ],
    palette: { S: PIECE.sky, V: PIECE.violet, C: PIECE.coral, E: PIECE.ink },
    seed: 23,
  },

  {
    name: 'anak ayam',
    art: [
      '...R....',
      '..RRR...',
      '..YYYY..',
      'OYEYYYY.',
      '.YYYYYY.',
      '.YYYYYY.',
      '..YYYY..',
      '..O..O..',
    ],
    palette: { R: PIECE.coral, Y: PIECE.amber, O: PIECE.orange, E: PIECE.ink },
    seed: 11,
  },

  {
    name: 'kucing',
    art: [
      '.P...P.',
      '.POOOP.',
      'OOEOEOO',
      'OOOOOOO',
      '.OOOOO.',
      '.OOOOOT',
      '.A...A.',
    ],
    palette: { P: PIECE.pink, O: PIECE.orange, T: PIECE.orange, A: PIECE.amber, E: PIECE.ink },
    seed: 7,
  },
];
