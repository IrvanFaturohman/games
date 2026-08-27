// Design tokens — flat minimal + bold color.
// Mirrors the Figma design system. Keep both in sync when either changes.

export const COLOR = {
  bg:      '#F4F1EA',  // cream, flat
  base:    '#2B2B2B',  // charcoal — silhouettes, text
  baseSoft:'#5A5A5A',  // secondary text
  line:    '#D9D4C7',  // dividers, inactive
  white:   '#FFFFFF',
};

// One bold accent per game so each reads as its own thing
// while the suite still feels like one family.
export const ACCENT = {
  'stick-hero': '#FF5A5F',
  'unpuzzle':   '#3DDC97',
  'polygram':   '#FFB627',
  'find-the-difference': '#7C5CFF',
};

// Flat style contract: no gradients, no shadows, sharp corners.
export const STYLE = {
  radius: 0,
  strokeWidth: 4,
};

export const TYPE = {
  family: '"Baloo 2", system-ui, -apple-system, sans-serif',
  score:  { size: 72, weight: 800 },
  title:  { size: 34, weight: 800 },
  body:   { size: 17, weight: 600 },
  label:  { size: 13, weight: 700, tracking: 0.08 },
};

export const SPACE = [0, 4, 8, 12, 16, 24, 32, 48, 64];
