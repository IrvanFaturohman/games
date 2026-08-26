// Level check. Every level is art only — carve.js turns each cell into a tile
// and assigns its arrow at load — so the thing worth checking is that each
// picture resolves, and how much it hides on turn one.
//
//   node unpuzzle/tools/author.mjs

import { LEVELS } from '../levels.js';
import { carve, freeOnTurnOne } from '../carve.js';

let bad = 0;
for (const level of LEVELS) {
  try {
    const c = carve(level, { seed: level.seed });
    const cells = c.tiles.map((t) => [t.x, t.y]);
    const free = freeOnTurnOne(c.cols, c.rows, cells, c.tiles.map((t) => t.dir));
    console.log(
      `OK    ${level.name.padEnd(11)} ${c.cols}x${c.rows}  ${c.tiles.length} tiles  ` +
      `free-on-turn-1 ${free}  resolved on try ${c.tries}`
    );
    // The silhouette is the whole point, so show it — art that does not read as
    // the animal is the failure this tool exists to catch early.
    console.log(level.art.map((r) => '      ' + [...r].map((ch) => ch === '.' ? '  ' : '\u2588\u2588').join('')).join('\n'));
  } catch (e) {
    bad++;
    console.log(`FAIL  ${level.name.padEnd(11)} ${e.message}`);
  }
}
console.log(bad ? `\n${bad} level(s) do not resolve` : '\nall levels clearable');
