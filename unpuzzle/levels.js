// Levels are pictures. Nothing else is authored — `carve.js` cuts the silhouette
// into pieces and works out every exit direction at load, so there is no piece
// table or exit table to keep in sync with the art.
//
// One letter per colour, '.' for empty. Draw the animal, pick a palette, mark
// where the eyes go, and that is the whole level. Eyes are painted on rather
// than being pieces: pieces only ever leave, so a piece fully enclosed by
// another could never get out and would deadlock the board.
//
// After editing, check every level still carves:  node unpuzzle/tools/author.mjs

import { PIECE } from './style.js';

export const LEVELS = [
  {
    name: 'anak ayam',
    art: [
      '....R....',
      '...RRR...',
      '..YYYYY..',
      '.YYYYYYY.',
      'OYYYYYYY.',
      '.YYYYYYY.',
      '.YYYYYYY.',
      '..YYYYY..',
      '..O...O..',
    ],
    palette: { R: PIECE.coral, Y: PIECE.amber, O: PIECE.orange },
    eyes: [[3, 3], [5, 3]],
    seed: 11,
  },

  {
    name: 'ikan',
    art: [
      '........VV.',
      '..SSSSS.VV.',
      '.SSSSSSSVV.',
      'CSSSSSSSVVV',
      '.SSSSSSSVV.',
      '..SSSSS.VV.',
      '........VV.',
    ],
    palette: { S: PIECE.sky, V: PIECE.violet, C: PIECE.coral },
    eyes: [[2, 3]],
    seed: 23,
  },

  {
    name: 'kucing',
    art: [
      '.PP...PP.',
      '.OOOOOOO.',
      'OOOOOOOOO',
      'OOOOOOOOO',
      '.OOOOOOO.',
      '..OOOOO..',
      '.OOOOOOOT',
      '.OOOOOOOT',
      '.AA...AA.',
    ],
    palette: { P: PIECE.pink, O: PIECE.orange, T: PIECE.orange, A: PIECE.amber },
    eyes: [[3, 2], [5, 2]],
    seed: 7,
  },
];
