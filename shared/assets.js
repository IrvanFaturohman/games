// Image loading. SVG draws to canvas like any other image, so flat vector
// sprites stay crisp at every DPR without exporting @2x/@3x variants.

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`asset failed: ${src}`));
    img.src = src;
  });
}

// loadAll({hero: './assets/hero.svg'}) -> {hero: <img>}
// A missing asset rejects loudly rather than silently drawing nothing —
// a sprite that fails to load on device is otherwise invisible to debug.
export async function loadAll(map) {
  const names = Object.keys(map);
  const imgs = await Promise.all(names.map(n => loadImage(map[n])));
  return Object.fromEntries(names.map((n, i) => [n, imgs[i]]));
}
