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

`game.js` is still the scaffold stub — it counts taps and draws `assets/hero.svg`
to prove the Figma → SVG → Pages → phone chain works. Replacing it with the real
loop is the job.

## The shell contract

`boot()` (`../shared/boot.js`) is the only entry point: it builds stage, input,
audio, and store, waits for fonts, then owns the loop. The signatures are easy to
get wrong because they are spread across three files:

- `ready(game)` — async, awaited before the first frame. `game` is
  `{stage, audio, store, input, name}` and the *same object* reaches every other
  callback. **If `ready` rejects, the loop never starts and the screen stays
  blank** — a failed `loadAll()` looks like a dead game, not an error.
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
- `stage.onResize(fn)` returns an unsubscribe. DPR is capped at 2 — never multiply
  by `devicePixelRatio` yourself.

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
- **Gap and width variety.** Randomise both, but never generate a gap that is
  unreachable — clamp against the max stick length the player can grow before the
  screen runs out.
- **Timing windows are generous early.** First three platforms should be near
  impossible to fail, or first-time players quit before they understand the verb.

## Feel details worth the effort

Stick rotation eased rather than linear · hero walk cycle as two alternating
rectangles · camera scroll eased over ~0.4s · screen shake on a fall · the stick
wobbles slightly at full extension.

## Assets

Mostly canvas primitives — do not export rectangles from Figma. The Figma file
(`3MCjOe4tnvd5wTM4tPtE4Y`) holds the hero sprite, background silhouette layers,
and UI marks only. Load through `loadAll()` from `../shared/assets.js`.

## Conventions

- **Player-facing copy is Indonesian** (`TAP UNTUK MULAI`, the hub cards, the test
  page). Code, comments, and commit messages stay English.
- No raw hex in `game.js` — pull from `../shared/tokens.js` (`COLOR`,
  `ACCENT['stick-hero']`, `TYPE`, `SPACE`). Figma binds the same tokens; raw
  values are how the two drift apart.
- `shared/` is used by all three games — raise any change there with the user first.
