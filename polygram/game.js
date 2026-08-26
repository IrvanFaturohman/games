// Stub — proves the shared shell boots, renders, and takes input on device.
// Replace with real gameplay in this game's own session.

import { boot } from '../shared/boot.js';
import { COLOR, ACCENT } from '../shared/tokens.js';

const NAME = 'polygram';
const TITLE = 'POLYGRAM';
const ACC = ACCENT[NAME];

let taps = 0;
let pulse = 0;

boot({
  name: NAME,

  ready({ store }) { taps = store.get('taps', 0); },

  input: {
    onTap(p, game) {
      taps++; pulse = 1;
      game.store.set('taps', taps);
      game.audio.play('tap');
    },
  },

  update(dt) { pulse = Math.max(0, pulse - dt * 3); },

  render(c, { stage }) {
    const { w, h } = stage;
    c.fillStyle = COLOR.bg;
    c.fillRect(0, 0, w, h);

    const size = 96 + pulse * 24;
    c.fillStyle = ACC;
    c.fillRect(w / 2 - size / 2, h / 2 - size / 2 - 40, size, size);

    c.fillStyle = COLOR.base;
    c.textAlign = 'center';
    c.font = '800 30px "Baloo 2", system-ui, sans-serif';
    c.fillText(TITLE, w / 2, h / 2 + 100);

    c.fillStyle = COLOR.baseSoft;
    c.font = '600 14px "Baloo 2", system-ui, sans-serif';
    c.fillText('stub · shell aktif · tap ' + taps, w / 2, h / 2 + 132);
  },
});
