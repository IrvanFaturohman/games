# Games — hyper-casual web prototypes

Three hyper-casual games built web-native first, tested on a phone browser,
and ported to Unity later once the gameplay feel is proven. Web is the
prototyping medium, **not** the shipping target.

## Layout

```
games/
  index.html      hub linking the three games
  shared/         the mobile shell every game builds on
  stick-hero/     hold, release, cross the gap        accent #FF5A5F
  unpuzzle/       slide every piece out of the board  accent #3DDC97
  polygram/       fit shapes into a silhouette        accent #FFB627
  test/           device diagnostic page
```

Each game is worked on in **its own Claude Code session** (`cd games/<game>`),
driven by its own remote control. Only touch your own game's folder; `shared/`
changes affect all three, so raise them with the user first.

## Constraints that drive everything

- **No build step.** Plain ES modules served straight from GitHub Pages. No
  npm, no bundler, no transpile. If it does not run from `file://`-style static
  hosting, it does not belong here.
- **Phone first.** Every feature is judged on a phone in portrait, one-thumb,
  outdoors. Desktop is a debugging convenience, not the target.
- **Flat minimal + bold color.** No gradients, no shadows, sharp corners. Tokens
  live in `shared/tokens.js` and mirror the Figma design system — change both
  together or they drift.

## The shared shell

Import from `shared/`, do not reimplement:

| Module | Gives you |
|---|---|
| `boot.js` | `boot({name, ready, input, update, render})` — wires everything below |
| `engine.js` | DPR-correct canvas, fixed-timestep loop, resize/orientation handling |
| `input.js` | pointer events → `onDown/onMove/onUp/onTap/onHoldStart/onHoldEnd` |
| `audio.js` | synthesised SFX, iOS unlock handled |
| `storage.js` | namespaced localStorage, guarded against private browsing |
| `tokens.js` | colors, type scale, spacing |

`render(ctx, game)` draws in **CSS pixels** — the DPR transform is already
applied, so never multiply by `devicePixelRatio` yourself.

`update(dt)` runs at a fixed 1/60s step and may run several times per frame.
Keep it pure of rendering and free of `performance.now()`.

## Assets

Designed in Figma, one file per game, exported into `<game>/assets/`.
Prefer SVG for flat shapes; PNG @2x only when a shape cannot be vector.
Generate what canvas cannot draw cheaply — do not export a rectangle.

Load them with `loadAll()` from `shared/assets.js`. SVG draws to canvas like any
other image and stays crisp at every DPR, so there are no @2x/@3x variants.

**Export trap.** Calling `download_assets` with `defaultFormat` *overrides* the
node's own export settings and re-adds a `#F5F5F5` backing rectangle to the SVG.
Set `exportSettings` on the node once (`[{format:'SVG', suffix:''}]`, which
carries `contentsOnly: true`) and then call `download_assets` **without**
`defaultFormat` so those settings win.

Every fill in Figma is bound to a `tokens` variable, never a raw hex — that is
what keeps the three files from drifting apart. Each file has its own `tokens`
collection: 16 variables (`color/*`, `space/*`, `stroke/*`, `radius/*`) and four
text styles (Score, Title, Body, Label) on Baloo 2. Note Figma spells the styles
`ExtraBold` and `SemiBold` with no space — unlike Inter.

Figma files:
- stick-hero `3MCjOe4tnvd5wTM4tPtE4Y`
- tangram/polygram `L5n7rj9XmQnAOxG9s0Tdpg`
- unpuzzle `qSAVuXAtFdC89LKE4H0P5Z`

## Deploy

Push to `main` → GitHub Pages serves it ~30s later.

```
https://irvanfaturohman.github.io/games/<game>/
```

`git pull --rebase` before pushing — three sessions share this repo.
Never delete `.nojekyll`; without it Pages hides any underscore-prefixed path.

For tight feel-tuning where a 30s round trip hurts:
`npx serve . -p 5173` plus `cloudflared tunnel --url http://localhost:5173`.
