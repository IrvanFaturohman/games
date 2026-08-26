// Polygram's visual tokens.
//
// These belong in shared/tokens.js eventually — a 7-piece tangram needs seven
// tellable-apart fills and the shared file carries one accent per game. They
// live here until that change is signed off, because tokens.js is read by all
// three games.
//
// Art rule: no outlines anywhere. Depth is a second solid face under the shape,
// never a gradient, shadow or blur. See "Visual direction" in CLAUDE.md.

export const PIECE = [
  '#FFB627', // amber — also the game's accent
  '#FF5A5F', // coral
  '#FF8FCF', // pink
  '#9B6BFF', // violet
  '#4EA8FF', // sky
  '#3DDC97', // mint
  '#A8CE2B', // lime — pulled down from #B8DE2E, which washed out on cream
];

export const TILE = {
  depth: 0.075,     // thickness of the lower face, as a fraction of board scale
  round: 0.085,     // corner rounding, same units
  slot: '#45403A',  // an empty slot inside the silhouette: lifted, not outlined
};

export const CHROME = {
  radius: 20,
  bevel: 4,
};

// The lower face is derived, not stored, so a piece colour can never drift from
// its own shadow. Memoised because render calls this every frame.
const cache = new Map();

export function shade(hex, k = 0.8) {
  const key = hex + k;
  let out = cache.get(key);
  if (out) return out;
  out = '#' + hex.slice(1).match(/../g)
    .map((v) => Math.round(parseInt(v, 16) * k).toString(16).padStart(2, '0'))
    .join('');
  cache.set(key, out);
  return out;
}
