// Level check. Every level is art only — carve.js cuts it and assigns exits at
// load — so the thing worth checking is that each picture carves at all, how
// many tries it takes, and how much it hides on turn one.
//
//   node unpuzzle/tools/author.mjs

import { LEVELS } from '../levels.js';
import { carve, freeOnTurnOne } from '../carve.js';

let bad = 0;
for (const level of LEVELS) {
  try {
    const c = carve(level, { seed: level.seed });
    const free = freeOnTurnOne(c.cols, c.rows, c.pieces.map((p) => p.cells), c.pieces.map((p) => p.dir));
    const sizes = c.pieces.map((p) => p.cells.length);
    console.log(
      `OK    ${level.name.padEnd(11)} ${c.cols}x${c.rows}  ${c.pieces.length} pieces ` +
      `(${Math.min(...sizes)}-${Math.max(...sizes)} cells)  free-on-turn-1 ${free}  ` +
      `carved on try ${c.tries}`
    );
  } catch (e) {
    bad++;
    console.log(`FAIL  ${level.name.padEnd(11)} ${e.message}`);
  }
}
console.log(bad ? `\n${bad} level(s) do not carve` : '\nall levels carve and are clearable');
