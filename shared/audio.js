// Synthesised SFX — no audio files to load, download, or keep in sync.
// Every sound here is a couple of oscillators and an envelope, which is
// plenty for hyper-casual feedback and costs zero bytes of asset budget.

const PRESETS = {
  tap:     { type: 'square',   from: 660,  to: 660,  dur: 0.05, gain: 0.18 },
  place:   { type: 'sine',     from: 440,  to: 880,  dur: 0.10, gain: 0.22 },
  perfect: { type: 'triangle', from: 880,  to: 1760, dur: 0.18, gain: 0.28 },
  score:   { type: 'sine',     from: 523,  to: 784,  dur: 0.14, gain: 0.24 },
  fail:    { type: 'sawtooth', from: 320,  to: 70,   dur: 0.38, gain: 0.20 },
  whoosh:  { type: 'sine',     from: 180,  to: 60,   dur: 0.22, gain: 0.14 },
};

export function createAudio() {
  let ctx = null;
  let muted = JSON.parse(localStorage.getItem('muted') ?? 'false');

  // iOS refuses to start an AudioContext outside a user gesture, so this
  // must be called from a real touch/click handler.
  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    // A silent blip to flip the context into "running" on Safari.
    const o = ctx.createOscillator(), g = ctx.createGain();
    g.gain.value = 0;
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.01);
  }

  function play(name, { rate = 1 } = {}) {
    if (muted || !ctx || ctx.state !== 'running') return;
    const p = PRESETS[name];
    if (!p) return;

    const t = ctx.currentTime;
    const dur = p.dur / rate;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = p.type;
    osc.frequency.setValueAtTime(p.from * rate, t);
    if (p.to !== p.from) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, p.to * rate), t + dur);
    }

    // Short attack then exponential decay — a linear fade reads as a click.
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(p.gain, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  return {
    unlock,
    play,
    get muted() { return muted; },
    set muted(v) { muted = !!v; localStorage.setItem('muted', JSON.stringify(muted)); },
    get ready() { return !!ctx && ctx.state === 'running'; },
  };
}
