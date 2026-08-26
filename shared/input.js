// Unified pointer input for touch + mouse, in stage logical coordinates.
//
// Pointer Events cover both, so there is no touch/mouse branching and no
// synthetic-click double-fire. Everything is reported in the same CSS-pixel
// space you draw in, so a hit test is just a comparison against draw coords.

const TAP_MAX_MS = 350;   // longer than this is a hold, not a tap
const TAP_SLOP   = 12;    // CSS px of drift still counted as a tap
const HOLD_MS    = 220;   // when onHoldStart fires

export function createInput(stage, handlers = {}) {
  const el = stage.canvas;
  const pointers = new Map();
  let holdTimer = null;

  const toLocal = (e) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const call = (name, ...args) => handlers[name] && handlers[name](...args);

  function onDown(e) {
    el.setPointerCapture?.(e.pointerId);
    const { x, y } = toLocal(e);
    const p = {
      id: e.pointerId,
      x, y,
      startX: x, startY: y,
      dx: 0, dy: 0,
      downAt: performance.now(),
      moved: false,
      held: false,
    };
    pointers.set(e.pointerId, p);

    call('onDown', p, pointers);

    if (pointers.size === 1) {
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        if (pointers.has(p.id) && !p.moved) { p.held = true; call('onHoldStart', p); }
      }, HOLD_MS);
    }
  }

  function onMove(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const { x, y } = toLocal(e);
    p.x = x; p.y = y;
    p.dx = x - p.startX; p.dy = y - p.startY;
    if (Math.hypot(p.dx, p.dy) > TAP_SLOP) p.moved = true;
    call('onMove', p, pointers);
  }

  function onUp(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    clearTimeout(holdTimer);

    const dur = performance.now() - p.downAt;
    p.duration = dur;

    if (p.held) call('onHoldEnd', p, dur);
    call('onUp', p, pointers);
    if (!p.moved && dur <= TAP_MAX_MS) call('onTap', p);
  }

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  // A pointer that leaves the element still owns the gesture thanks to
  // setPointerCapture, so pointerleave is deliberately not wired up.

  // Belt and braces: touch-action:none should already stop this, but Safari
  // has historically ignored it on some elements.
  el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  el.addEventListener('touchmove',  (e) => e.preventDefault(), { passive: false });

  return {
    pointers,
    get isDown() { return pointers.size > 0; },
    get primary() { return pointers.values().next().value || null; },
    destroy() {
      clearTimeout(holdTimer);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    },
  };
}
