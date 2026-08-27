// Which sticker a level is built from, and what it sits on.
//
// The art is Half It's sticker sheets, exported from Figma
// (file F7Vlc4oODiLdMrZEl81oqi) into `assets/`. Only 62 of the ~240 sheet slots
// are drawn — the rest are `locked` placeholders with no art — so levels 1-62
// each get their own object and level 63 wraps back to the first.
//
// A theme is only a run of levels and a set of backgrounds — an impostor is
// never a different sticker, it is the level's own sticker with one detail
// edited (see rules.js), so nothing here affects difficulty.

const BG = {
  purple: '#7C5CFF',
  grape: '#5B47D6',
  cyan: '#45C3DE',
  blue: '#3D6BE5',
  teal: '#2FBF9F',
  green: '#4CAF50',
  coral: '#FF6B6B',
  amber: '#FBCF4C',
  navy: '#2E3192',
  pink: '#FF7BAC',
  forest: '#3E8E5A',
  tangerine: '#FF9F43',
};

// Backgrounds are picked to fight the theme's own colours — a green vegetable on
// a green field is a different game. Every sticker carries a white keyline and a
// soft shadow, so contrast only has to be good, not extreme.
export const THEMES = [
  {
    name: 'fruits',
    backgrounds: [BG.cyan, BG.purple, BG.teal, BG.blue],
    items: ['orange', 'mango', 'lemon', 'apple', 'cherry', 'greenapple', 'pear',
      'kiwi', 'mangosteen', 'blueberry', 'dragonfruit', 'watermelon', 'banana', 'pineapple'],
  },
  {
    name: 'vegetables',
    backgrounds: [BG.purple, BG.blue, BG.grape, BG.navy],
    items: ['tomato', 'bellpepper', 'onion', 'garlic', 'cauliflower', 'cabbage',
      'potato', 'mushroom', 'radish', 'peas', 'broccoli', 'lettuce', 'spinach',
      'springonion', 'corn', 'daikon', 'carrot', 'cucumber', 'eggplant', 'chili'],
  },
  {
    name: 'desserts',
    backgrounds: [BG.teal, BG.blue, BG.forest, BG.grape],
    items: ['donut', 'cookie', 'macaron', 'lollipop', 'pudding', 'cupcake',
      'icecream', 'cakeslice', 'swissroll', 'chocolatebar'],
  },
  {
    name: 'animals',
    backgrounds: [BG.purple, BG.teal, BG.coral, BG.amber],
    items: ['cat', 'dog', 'rabbit', 'bird', 'turtle'],
  },
  {
    name: 'flowers',
    backgrounds: [BG.teal, BG.blue, BG.forest, BG.navy],
    items: ['tulip', 'plumblossom', 'pansy', 'daisy', 'forgetmenot', 'sunflower', 'hyacinth'],
  },
  {
    name: 'sea',
    backgrounds: [BG.amber, BG.coral, BG.tangerine, BG.green],
    items: ['bluewhale', 'dolphin', 'orca'],
  },
  {
    name: 'space',
    backgrounds: [BG.grape, BG.navy, BG.blue],
    items: ['sun', 'moon'],
  },
  {
    name: 'vehicles',
    backgrounds: [BG.teal, BG.amber, BG.purple],
    items: ['car'],
  },
];

const FLAT = THEMES.flatMap((theme) =>
  theme.items.map((slug, index) => ({ theme, index, slug })));

export const ASSET_COUNT = FLAT.length;

const src = (theme, slug) => `./assets/${theme.name}-${slug}.svg`;

export function assetForLevel(level) {
  const n = Math.max(1, Math.round(level));
  const entry = FLAT[(n - 1) % FLAT.length];
  return {
    theme: entry.theme,
    index: entry.index,
    slug: entry.slug,
    src: src(entry.theme, entry.slug),
    background: entry.theme.backgrounds[(n - 1) % entry.theme.backgrounds.length],
  };
}

