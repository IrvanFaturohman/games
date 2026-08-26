// Stub — proves the full chain: Figma sprite -> SVG in assets/ -> Pages -> phone.
// Replace with real gameplay in this game's own session. See CLAUDE.md.

import { boot } from '../shared/boot.js';
import { loadAll } from '../shared/assets.js';
import { COLOR, ACCENT } from '../shared/tokens.js';

const NAME = 'stick-hero';
const ACC = ACCENT[NAME];

let art = {};
let taps = 0;
let pulse = 0;
let bob = 0;

boot({
  name: NAME,

  async ready({ store }) {
    taps = store.get('taps', 0);
    art = await loadAll({ hero: './assets/hero.svg' });
  },

  input: {
    onTap(p, game) {
      taps++; pulse = 1;
      game.store.set('taps', taps);
      game.audio.play('tap');
    },
  },

  update(dt) {
    pulse = Math.max(0, pulse - dt * 3);
    bob += dt * 6;
  },

  render(c, { stage }) {
    const { w, h } = stage;
    c.fillStyle = COLOR.bg;
    c.fillRect(0, 0, w, h);

    const groundY = h * 0.62;

    // Platform
    c.fillStyle = COLOR.base;
    c.fillRect(w / 2 - 70, groundY, 140, h - groundY);

    // Hero, drawn from the Figma SVG at 2.2x with a small idle bob
    if (art.hero) {
      const s = 2.2;
      const hw = art.hero.width * s, hh = art.hero.height * s;
      const lift = Math.sin(bob) * 3 + pulse * 10;
      c.drawImage(art.hero, w / 2 - hw / 2, groundY - hh - lift, hw, hh);
    }

    c.textAlign = 'center';
    c.fillStyle = COLOR.base;
    c.font = '800 30px "Baloo 2", system-ui, sans-serif';
    c.fillText('STICK HERO', w / 2, h * 0.22);

    c.fillStyle = ACC;
    c.font = '800 72px "Baloo 2", system-ui, sans-serif';
    c.fillText(String(taps), w / 2, h * 0.36);

    c.fillStyle = COLOR.baseSoft;
    c.font = '600 14px "Baloo 2", system-ui, sans-serif';
    c.fillText(art.hero ? 'stub · sprite figma termuat' : 'stub · sprite gagal muat',
               w / 2, h - 48);
  },
});
