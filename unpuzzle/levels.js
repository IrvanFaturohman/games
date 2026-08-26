// Levels are pictures. One letter per colour, '.' for empty, and every filled
// cell becomes one tile carrying one arrow. `carve.js` works out which way each
// arrow points at load, so nothing but the drawing is authored here.
//
// The tiles themselves carry the colour, so the picture reads straight off the
// board. Arrows are neutral — white, or a deep tint of the tile on light faces.
// Eyes, beaks and seeds are just cells painted a darker colour; a tile can sit
// fully surrounded and still get out, because everything around it leaves too.
//
// **Draw portrait.** The board is judged on a phone held upright, so art wider
// than it is tall wastes the screen and forces small tiles. 7-9 columns by 9-12
// rows is the useful range. Fewer tiles is an easier level, so the list runs
// roughly small to large.
//
// After editing, check every level still carves:  node unpuzzle/tools/author.mjs

import { PIECE } from './style.js';

const P = PIECE;

export const LEVELS = [
  {
    name: 'kaktus',
    art: [
      '....G....',
      '....G....',
      '.G..G..G.',
      '.G..G..G.',
      '.GGGGGGG.',
      '....G....',
      '....G....',
      '....G....',
      '..WWWWW..',
      '..WWWWW..',
    ],
    palette: { G: P.leaf, W: P.wood },
    seed: 3,
  },

  {
    name: 'wortel',
    art: [
      '.L...L.',
      '..LLL..',
      '.OOOOO.',
      '.OOOOO.',
      '.OOOOO.',
      '..OOO..',
      '..OOO..',
      '..OOO..',
      '...O...',
      '...O...',
    ],
    palette: { L: P.leaf, O: P.orange },
    seed: 5,
  },

  {
    name: 'pohon',
    art: [
      '...LLL...',
      '..LLLLL..',
      '.LLLLLLL.',
      'LLLLLLLLL',
      '.LLLLLLL.',
      '..LLLLL..',
      '...LLL...',
      '....W....',
      '....W....',
      '...WWW...',
    ],
    palette: { L: P.leaf, W: P.wood },
    seed: 7,
  },

  {
    name: 'es krim',
    art: [
      '...PPP...',
      '..PPPPP..',
      '.PPPPPPP.',
      '.PPPPPPP.',
      '..PPPPP..',
      '..WWWWW..',
      '..WWWWW..',
      '...WWW...',
      '...WWW...',
      '....W....',
    ],
    palette: { P: P.pink, W: P.wood },
    seed: 11,
  },

  {
    name: 'roket',
    art: [
      '....C....',
      '...CCC...',
      '..CCCCC..',
      '..CCSCC..',
      '..CCCCC..',
      '..CCCCC..',
      '.RCCCCCR.',
      '.RCCCCCR.',
      '..CCCCC..',
      '...O.O...',
      '....O....',
    ],
    palette: { C: P.cream, S: P.sky, R: P.coral, O: P.orange },
    seed: 13,
  },

  {
    name: 'bunga',
    art: [
      '..Y.Y.Y..',
      '.YYYYYYY.',
      '.YYWWWYY.',
      '.YYWWWYY.',
      '.YYWWWYY.',
      '.YYYYYYY.',
      '..Y.Y.Y..',
      '....L....',
      '..LLL....',
      '....LLL..',
      '....L....',
      '....L....',
    ],
    palette: { Y: P.amber, W: P.wood, L: P.leaf },
    seed: 17,
  },

  {
    name: 'jamur',
    art: [
      '..RRRRR..',
      '.RRRRRRR.',
      'RRRCRRCRR',
      'RRRRRRRRR',
      '.RRRRRRR.',
      '...CCC...',
      '...CCC...',
      '...CCC...',
      '..CCCCC..',
    ],
    palette: { R: P.coral, C: P.cream },
    seed: 19,
  },

  {
    name: 'apel',
    art: [
      '....W....',
      '...WLL...',
      '..RRRRR..',
      '.RRRRRRR.',
      'RRRRRRRRR',
      'RRRRRRRRR',
      'RRRRRRRRR',
      '.RRRRRRR.',
      '..RRRRR..',
    ],
    palette: { W: P.wood, L: P.leaf, R: P.coral },
    seed: 23,
  },

  {
    name: 'labu',
    art: [
      '....L....',
      '...LWL...',
      '..OOOOO..',
      '.OOOOOOO.',
      'OOOOOOOOO',
      'OOEOOOEOO',
      'OOOOOOOOO',
      '.OOEEEOO.',
      '..OOOOO..',
    ],
    palette: { L: P.leaf, W: P.wood, O: P.orange, E: P.ink },
    seed: 29,
  },

  {
    name: 'stroberi',
    art: [
      '...LLL...',
      '..LLLLL..',
      '.RRRRRRR.',
      'RRRRRRRRR',
      'RRRRRRRRR',
      '.RRRRRRR.',
      '.RRRRRRR.',
      '..RRRRR..',
      '...RRR...',
      '....R....',
    ],
    palette: { L: P.leaf, R: P.coral },
    seed: 31,
  },

  {
    name: 'gurita',
    art: [
      '..VVVVV..',
      '.VVVVVVV.',
      'VVEVVVEVV',
      'VVVVVVVVV',
      'VVVVVVVVV',
      '.VVVVVVV.',
      'V.V.V.V.V',
      'V.V.V.V.V',
    ],
    palette: { V: P.plum, E: P.ink },
    seed: 37,
  },

  {
    name: 'nanas',
    art: [
      '...L.L...',
      '..LLLLL..',
      '...LLL...',
      '..YYYYY..',
      '.YYYYYYY.',
      '.YYYYYYY.',
      '.YYYYYYY.',
      '.YYYYYYY.',
      '.YYYYYYY.',
      '..YYYYY..',
      '...YYY...',
    ],
    palette: { L: P.leaf, Y: P.amber },
    seed: 41,
  },

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
    palette: { R: P.coral, Y: P.amber, O: P.orange, E: P.ink },
    seed: 43,
  },

  {
    name: 'penguin',
    art: [
      '...III...',
      '..IIIII..',
      '.IICICII.',
      '.IIIOIII.',
      '.ICCCCCI.',
      'IICCCCCII',
      'IICCCCCII',
      '.ICCCCCI.',
      '..IIIII..',
      '..O...O..',
    ],
    palette: { I: P.ink, C: P.cream, O: P.orange },
    seed: 47,
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
    palette: { W: P.pink, E: P.ink, P: P.coral, A: P.coral },
    seed: 53,
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
    palette: { P: P.pink, O: P.orange, E: P.ink, M: P.cream, A: P.amber },
    seed: 59,
  },

  {
    name: 'hantu',
    art: [
      '..CCCCC..',
      '.CCCCCCC.',
      'CCCCCCCCC',
      'CCECCCECC',
      'CCCCCCCCC',
      'CCCEEECCC',
      'CCCCCCCCC',
      'CCCCCCCCC',
      'C.CC.CC.C',
    ],
    palette: { C: P.cream, E: P.ink },
    seed: 61,
  },

  {
    name: 'beruang',
    art: [
      '.WW...WW.',
      '.WW...WW.',
      '.WWWWWWW.',
      'WWWWWWWWW',
      'WWEWWWEWW',
      'WWWCCCWWW',
      'WWWCICWWW',
      '.WWWWWWW.',
      '.WWWWWWW.',
      '..WWWWW..',
      '.WW...WW.',
    ],
    palette: { W: P.wood, E: P.ink, C: P.cream, I: P.ink },
    seed: 67,
  },
];
