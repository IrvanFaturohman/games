// One call that wires the whole shell together, so a game file starts at
// "here is my gameplay" instead of forty lines of setup.

import { createStage, startLoop } from './engine.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createStore } from './storage.js';

export async function boot({ name, update, render, input: inputHandlers = {}, ready }) {
  const canvas = document.getElementById('stage');
  const stage  = createStage(canvas);
  const audio  = createAudio();
  const store  = createStore(name);

  const ctxObj = { stage, audio, store, name };

  const input = createInput(stage, wrapHandlers(inputHandlers, ctxObj, audio));
  ctxObj.input = input;

  // Fonts change text metrics; waiting avoids a first-frame reflow pop.
  if (document.fonts?.ready) { try { await document.fonts.ready; } catch {} }
  stage.resize();

  await ready?.(ctxObj);

  const gate = document.getElementById('tap-to-start');
  if (gate) {
    const start = () => {
      audio.unlock();
      gate.classList.add('hidden');
      gate.removeEventListener('pointerdown', start);
    };
    gate.addEventListener('pointerdown', start);
  }

  startLoop({
    update: (dt) => update(dt, ctxObj),
    render: (alpha) => render(stage.ctx, ctxObj, alpha),
  });

  return ctxObj;
}

// Every pointer handler gets (pointer, game) and unlocks audio on first touch,
// so no game has to remember the iOS gesture rule.
function wrapHandlers(handlers, game, audio) {
  const out = {};
  for (const [key, fn] of Object.entries(handlers)) {
    out[key] = (...args) => {
      if (key === 'onDown') audio.unlock();
      return fn(...args, game);
    };
  }
  if (!out.onDown) out.onDown = () => audio.unlock();
  return out;
}
