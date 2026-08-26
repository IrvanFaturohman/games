# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Stick Hero

Read `../CLAUDE.md` first for the shell, constraints, and deploy flow.

Accent `#FF5A5F` · store namespace `stick-hero` · one session, one remote control.

## Commands

No build, no bundler, no test runner — plain ES modules served statically.

```bash
# Serve from the REPO ROOT, not this folder: game.js imports ../shared/*,
# which a server rooted at stick-hero/ cannot reach.
cd .. && npx serve . -p 5173          # → http://localhost:5173/stick-hero/

# Real-phone testing without the Pages round trip
cloudflared tunnel --url http://localhost:5173

# Deploy — three sessions share this repo, so always rebase first
git pull --rebase && git push          # live ~30s later at
                                       # https://irvanfaturohman.github.io/games/stick-hero/
```

`../test/` is a device diagnostic page: DPR, safe-area insets, fps, multi-touch,
audio unlock, whether Baloo 2 actually loaded. Open it first when something looks
wrong on a phone, before suspecting game code.

## Current state

The core loop is built and playable. Three files:

| File | Holds |
|---|---|
| `style.js` | tokens, the six scenes, `PARALLAX`/`LAYERS`/`OPACITY`, `mixScenes` |
| `scene.js` | every draw call — pure rendering, no state, no timing |
| `game.js` | the state machine, input, and generation |

`game.js` runs a phase machine: `idle → growing → falling → walking →
scroll → idle`, with `dropping → dead` on a miss. Landing the tip within
`PERFECT_HALF` of the target centre scores double.

On localhost only, `boot()` publishes `window.__debug` with `step(n)`,
`paint()` and the live state. This exists because **`requestAnimationFrame` is
suspended in a background tab**, so an automated check that just waits will see
nothing advance and look exactly like a hung game. Drive the loop with
`__debug.step()` and force a frame with `__debug.paint()` instead of sleeping.

`assets/hero.svg` is no longer loaded — the hero is canvas primitives now. The
file is kept only as the original Figma-export proof.

## The shell contract

`boot()` (`../shared/boot.js`) is the only entry point: it builds stage, input,
audio, and store, waits for fonts, then owns the loop. The signatures are easy to
get wrong because they are spread across three files:

- `ready(game)` — async, awaited before the first frame. `game` is
  `{stage, audio, store, input, name}` and the *same object* reaches every other
  callback. **If `ready` rejects, the loop never starts and the `#tap-to-start`
  gate is never wired** — the page sits on TAP UNTUK MULAI and ignores taps,
  because that gate covers the canvas at `z-index:10`. Nothing surfaces but a
  console error, so a failed `loadAll()` reads as a dead game rather than a
  broken asset path.
- `update(dt, game)` — fixed 1/60 s step, and may run up to 15 times in one frame
  after a stall. No `performance.now()`, no drawing.
- `render(ctx, game, alpha)` — draws in CSS pixels, DPR transform already applied.
  `alpha` is the leftover accumulator fraction, for interpolation if wanted.
- `input.onX(...)` handlers get **`game` appended as the last argument**:
  `onTap(p, game)`, `onDown(p, pointers, game)`, `onHoldEnd(p, ms, game)`.

Other decisions the shell already made:

- Pointer coords are stage-local CSS px, so a hit test is a plain compare against
  draw coords. `onHoldStart` fires only after 220 ms; a tap is <350 ms with <12 px
  drift. Stick growth belongs on `onDown`/`onUp` — routing it through
  `onHoldStart` swallows the first 220 ms of every hold.
- `audio.play()` silently no-ops until a real user gesture unlocks the context.
  `boot` handles that on the first `onDown` and on the `#tap-to-start` gate.
  Presets: `tap place perfect score fail whoosh`.
- `store` is namespaced and swallows private-browsing failures; `store.bestScore(n)`
  reads and writes the high score in one call.
- `stage.onResize(fn)` returns an unsubscribe, and fires only on *change* — never
  for the initial size, because the stage is sized before any listener exists.
  Compute the platform/camera layout in a function, call it once in `ready`, then
  re-call it from `onResize`. DPR is capped at 2 — never multiply by
  `devicePixelRatio` yourself.

## Core loop

Hero stands on a platform. Hold → a stick grows upward from the platform edge.
Release → it falls right. If it reaches the next platform, the hero walks
across and the world scrolls to the next gap. If it is too short or overshoots,
the hero walks off the end and falls. Score = platforms crossed.

## What makes or breaks the feel

- **Stick growth rate** is the whole game. Too fast and it is luck, too slow and
  it drags. Start near 220 px/s and tune on a real phone, not the desktop.
- **Perfect bonus.** Landing the stick tip inside a small centre zone of the next
  platform scores double and deserves loud feedback (flash, `audio.play('perfect')`,
  brief scale punch). This single reward is what makes people replay.
- **Difficulty must ramp, not just vary.** Flat random geometry reads as easy
  forever however wide the spread — that was the first version's mistake.
  `difficulty()` runs 0 → 1 over `RAMP_OVER` points; platforms narrow (~96 → ~16
  px) and gaps stretch (~50 → ~250 px) together. Gaps are still clamped against
  `maxReach()` so an unreachable one cannot be generated.
- **`standX()` is clamped to the platform midpoint.** A fixed inset from the
  right edge puts the hero off the left side entirely once platforms get
  narrower than twice that inset — which they now do.
- **The perfect zone scales with the platform** (`w * 0.13`, capped at
  `PERFECT_MAX`). A fixed zone would make perfects *more* common as platforms
  narrow — exactly backwards.
- **Timing windows are generous early.** First three platforms should be near
  impossible to fail, or first-time players quit before they understand the verb.

## Feel details, and what they are for

Built: eased stick rotation · two-frame walk cycle · camera eased over 0.4s ·
quadratic screen shake (subtle on a landing, hard on a fall) · stick sway that
grows with its length · hero crouches while the stick grows and squashes on
landing · dust puffs at the stick tip and under a fall · expanding ring, `+2`
popup and screen flash on a perfect · score punch on every gain · hero tumbles
as it falls · `navigator.vibrate` on land / perfect / death, guarded.

Squash pivots on the feet and trades height for width, so the hero never appears
to sink into the platform. The flash is capped at `0.28` alpha — anything more
reads as a whiteout rather than a hit.

## Art direction

Everything is drawn; there are no image assets in the loop. The rules are in the
header comment of `style.js` and they are not stylistic preferences — each one
was a correction:

- **No outlines, ever.** Shapes separate by value and hue. If two shapes do not
  read apart, the tones are too close — do not reach for a stroke.
- **One scene, one hue — foreground included.** Background bands are all painted
  in the *same* colour (`veil`) and separated only by opacity. `ink` is the scene
  hue at its darkest; a neutral black reads as a foreign hue and stops the whole
  composition cohering.
- **Opacity goes on the layer, never the shapes.** Per-shape alpha makes overlaps
  inside one band darken twice and the band shows its own seams. In canvas that
  means one path per band under a single `globalAlpha`.
- **Colour variety comes from swapping scenes**, never from a second hue inside
  one. Scenes rotate every 5 points and crossfade via `mixScenes`.
- Nothing decorative goes in the gap the stick crosses.

The six scenes are solved onto one *luminance* ladder rather than one HSL ladder,
so every scene has the same contrast structure (sky 0.45 → 0.93, ink ~0.07) and
no level is harder to read than another. That is also what makes `mixScenes`
safe: rung *i* of any two scenes means the same depth.

The Figma file (`3MCjOe4tnvd5wTM4tPtE4Y`) mirrors this: `tokens` for the unthemed
parts, `scene` with one mode per entry in `SCENES`. Frame "Stick Hero / Play" and
the "Scenes" comparison strip live on the Assets page. Change code and Figma in
the same pass.

**Two Figma traps, both hit while building this.** A paint whose colour is bound
to a variable renders from the binding and drops the rest: `setBoundVariableForPaint`
sometimes leaves the literal at `{0,0,0}` and the shape goes solid black, and
alpha inside a bound gradient stop is ignored entirely. Build such paints by hand
— resolve the value through any alias chain and write both `color` and
`boundVariables` — and fade by landing the outer stop on the neighbouring colour
plus node opacity. Read `fills[0].color` back to verify; a `screenshot()` taken
inside the same call can still show the pre-edit render. Separately, `addMode()`
invalidates the collection handle, so `setValueForMode` calls after it in the
same script fail silently — split them into two calls and verify.

## Conventions

- **Player-facing copy is Indonesian** (`TAP UNTUK MULAI`, the hub cards, the test
  page). Code, comments, and commit messages stay English.
- No raw hex in `game.js` or `scene.js` — pull from `./style.js`, which extends
  `../shared/tokens.js` rather than redefining it. Figma binds the same tokens;
  raw values are how the two drift apart.
- `shared/tokens.js` still holds the old flat system that unpuzzle and polygram
  render with, and stays untouched until this look is proven on a phone.
- `shared/` is used by all three games — raise any change there with the user first.
