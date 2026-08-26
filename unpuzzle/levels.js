// Levels are pictures. One letter per colour, '.' for empty, and every filled
// cell becomes one tile carrying one arrow. `carve.js` works out which way each
// arrow points at load, so nothing but the drawing is authored here.
//
// The tiles themselves carry the colour, so the picture reads straight off the
// board. Arrows are neutral — white, or a deep tint of the tile on light faces.
// Eyes, noses and beaks are just cells painted a darker colour; a tile can sit
// fully surrounded and still get out, because everything around it leaves too.
//
// **Draw portrait.** The board is judged on a phone held upright, so art that is
// wider than it is tall wastes the screen and forces small tiles. Roughly 9
// columns by 11-12 rows fills a phone with ~38px tiles, which is about the
// smallest a thumb wants.
//
// After editing, check every level still carves:  node unpuzzle/tools/author.mjs

import { PIECE } from './style.js';

export const LEVELS = [
  {
    name: 'anak ayam',
    art: [
      '....R....',
      '...RRR...',
      '...YYY...',
      '..YYYYY..',
      '.YYYYYYY.',
      '.YEYYYEY.',
      '.YYYOYYY.',
      '.YYYYYYY.',
      '.YYYYYYY.',
      '..YYYYY..',
      '..YYYYY..',
      '..O...O..',
    ],
    palette: { R: PIECE.coral, Y: PIECE.amber, O: PIECE.orange, E: PIECE.ink },
    seed: 11,
  },

  {
    name: 'kelinci',
    art: [
      '.WW...WW.',
      '.WW...WW.',
      '.WW...WW.',
      '..WWWWW..',
      '.WWWWWWW.',
      '.WEWWWEW.',
      '.WWWPWWW.',
      '..WWWWW..',
      '.WWWWWWW.',
      '.WWWWWWW.',
      '..WWWWW..',
      '..A...A..',
    ],
    palette: { W: PIECE.pink, E: PIECE.ink, P: PIECE.coral, A: PIECE.coral },
    seed: 23,
  },

  {
    name: 'kucing',
    art: [
      '.P.....P.',
      '.PP...PP.',
      '.OOOOOOO.',
      'OOOOOOOOO',
      'OOEOOOEOO',
      'OOOOOOOOO',
      'OOOMMMOOO',
      '.OOMMMOO.',
      '..OOOOO..',
      '.OOOOOOO.',
      '.AA...AA.',
    ],
    palette: {
      P: PIECE.pink, O: PIECE.orange, E: PIECE.ink,
      M: PIECE.cream, A: PIECE.amber,
    },
    seed: 7,
  },
];
