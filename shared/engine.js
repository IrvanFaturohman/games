// Canvas stage + game loop.
//
// Two things phones get wrong that this file fixes:
//  1. A canvas sized in CSS pixels renders blurry on a retina screen, so we
//     size the backing store by devicePixelRatio and scale the context back.
//  2. rAF delta time is not constant — it spikes on a slow frame and stalls
//     to seconds when the tab is backgrounded. A fixed-step accumulator keeps
//     physics deterministic regardless.

const DPR_CAP = 2; // 3x backing store costs ~2.2x the fill rate for no visible gain

export function createStage(canvas, { dprCap = DPR_CAP } = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const listeners = [];

  const stage = {
    canvas,
    ctx,
    w: 0,        // logical width  (CSS px) — draw in these units
    h: 0,        // logical height (CSS px)
    dpr: 1,
    onResize(fn) { listeners.push(fn); return () => {
      const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1);
    }; },
  };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));

    if (stage.w === w && stage.h === h && stage.dpr === dpr) return;

    stage.w = w; stage.h = h; stage.dpr = dpr;
    canvas.width  = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    for (const fn of listeners) fn(stage);
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });
  // Rotating a phone fires resize before the new size is committed.
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  // The URL bar sliding away changes height without firing resize on iOS.
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resize, { passive: true });
  }

  stage.resize = resize;
  return stage;
}

export function startLoop({ update, render, step = 1 / 60, maxFrame = 0.25 }) {
  let last = performance.now();
  let acc = 0;
  let raf = 0;
  let running = true;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    // Clamp so a long stall (backgrounded tab, GC pause) replays a few
    // steps instead of thousands.
    let dt = Math.min((now - last) / 1000, maxFrame);
    last = now;
    acc += dt;
    while (acc >= step) { update(step); acc -= step; }
    render(acc / step); // fractional leftover, for interpolation if a game wants it
  }

  raf = requestAnimationFrame(frame);

  // Backgrounding the tab freezes rAF; without this the first frame back
  // carries a huge delta.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; }
    else if (!running) { running = true; last = performance.now(); acc = 0; }
  });

  return {
    stop() { cancelAnimationFrame(raf); },
  };
}
