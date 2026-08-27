// Cell positions for a grid centred inside a play area. Index 0 is top-left,
// rows go downward. Port of Game.Gameplay.BoardLayout, with y flipped: canvas
// y grows down where Unity world y grows up.

/**
 * @param fill Fraction of the available cell that becomes the cell size; the rest is gap.
 */
export function fitBoard(cols, rows, area, fill = 0.82) {
  const cell = Math.min(area.w / cols, area.h / rows) * fill;
  return {
    cols,
    rows,
    cell,
    count: cols * rows,
    ox: area.x + area.w / 2 - (cell * cols) / 2 + cell / 2,
    oy: area.y + area.h / 2 - (cell * rows) / 2 + cell / 2,
  };
}

export function cellCenter(board, index) {
  return {
    x: board.ox + (index % board.cols) * board.cell,
    y: board.oy + Math.floor(index / board.cols) * board.cell,
  };
}

// Circular hit area of half a cell, so a fat thumb landing in the gap between
// two fruit misses instead of punishing the nearest one.
export function hitTest(board, px, py) {
  const radiusSq = (board.cell * 0.5) ** 2;
  for (let i = 0; i < board.count; i++) {
    const c = cellCenter(board, i);
    const dx = px - c.x;
    const dy = py - c.y;
    if (dx * dx + dy * dy < radiusSq) return i;
  }
  return -1;
}
