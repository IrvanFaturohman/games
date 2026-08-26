# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Unpuzzle

Read `../CLAUDE.md` first for the shell, constraints, and deploy flow.

Accent `#3DDC97` · store namespace `unpuzzle` · one session, one remote control.

## Running it

No build, no bundler, no test runner, no lint — there is no `package.json`
anywhere in this repo. `game.js` is served as a plain ES module.

Serve from the **repo root**, never from this folder:

```bash
npx serve . -p 5173                              # → http://localhost:5173/unpuzzle/
cloudflared tunnel --url http://localhost:5173   # reach it from a real phone
```

`game.js` imports `../shared/boot.js`, so a server rooted at `unpuzzle/` puts
those imports above its root and every module 404s — on a phone that shows up as
a blank cream screen, not an error.

Deploy: `git pull --rebase && git add -A && git commit -m "..." && git push` —
live ~30s later at `https://irvanfaturohman.github.io/games/unpuzzle/`.

`../test/` is the device diagnostic page: DPR, safe-area insets, fps, multi-touch,
audio unlock, whether Baloo 2 actually loaded. Open it first when something looks
wrong on a phone, before suspecting game code.

## Current state

`game.js` is still the scaffold stub — it counts taps and pulses a square to
prove the shell boots, renders, and takes input on device. There is no
`levels.js`, no `assets/`, no board, no piece, no collision. Everything below is
spec, not description.

## Core loop

A board holds interlocking pieces. Each piece can only exit in one direction.
Tap (or flick) a piece → it slides that way and leaves the board, but only if
nothing blocks its path. Clear every piece to finish the level. No timer, no
fail state — the pressure is purely "which one first".

## The one hard problem

**Collision along the exit path.** A piece sweeps its own cell footprint along
its exit vector until it leaves the board; if any swept cell is occupied, the
move is illegal. Model the board as a grid occupancy map and test the sweep —
do not try to do this with bounding boxes and pixel math.

Illegal taps must still feel answered: nudge the piece a few pixels toward its
exit and bounce back, plus a dull thunk. Silence reads as a broken tap.

## Level data

Levels are data, not code — a JSON array of `{cells, dir, color}`. Author them
in a `levels.js` file so difficulty can be retuned without touching logic.
Every level must be verified solvable by a solver before shipping; a hand-made
unsolvable level is the fastest way to lose a player permanently.

Difficulty comes from **dependency depth** (piece A must leave before B, which
must leave before C), not from piece count.

## The boot contract

Exact signatures, since `boot.js` appends the game object in a way the root
`CLAUDE.md` table glosses over:

```js
ready(game)                  // async, awaited before the first frame — loadAll() goes here
update(dt, game)             // fixed 1/60 s step, may run up to 15x in one frame
render(ctx, game, alpha)     // every rAF; alpha = leftover accumulator fraction
```

`game` is `{ stage, audio, store, input, name }` and is the *same object* in
every callback — hang board state off it or off module scope, either is fine.

**If `ready` rejects, the page sticks on TAP UNTUK MULAI and ignores taps.**
`boot` awaits `ready` *before* wiring the `#tap-to-start` gate, so a rejection
leaves that gate up forever — and at `z-index:10` it swallows every pointer
event. A `levels.js` typo or a wrong asset path in `loadAll()` produces exactly
this, with nothing but a console error to go on.

Pointer handlers get the game object appended **last**, so arity differs:

```js
onDown(p, pointers, game)   onMove(p, pointers, game)   onUp(p, pointers, game)
onTap(p, game)              onHoldStart(p, game)        onHoldEnd(p, dur, game)
```

`p` carries `{id, x, y, startX, startY, dx, dy, moved, held}` in the same
CSS-pixel space you draw in — hit-testing a piece is a direct comparison against
its draw coords, no transform needed. `p.duration` is added on release, so it
reads in `onHoldEnd`/`onUp`/`onTap` and is undefined before them.

## Gesture budget: the flick does not arrive as a tap

`input.js` fixes the thresholds, and this game's two verbs sit on opposite sides
of them:

- `TAP_SLOP` 12 px — drift past this sets `p.moved` and **kills `onTap`**
- `TAP_MAX_MS` 350 — slower than this is not a tap either
- `HOLD_MS` 220 — when `onHoldStart` fires (unused here; do not route play through it)

So a tap-to-slide lands on `onTap`, but a **flick never will** — by the time the
thumb has travelled far enough to have a direction it is already `moved`. Detect
the flick in `onUp` from `p.dx/p.dy` and `p.duration`, and have `onTap` and the
flick path call the same `trySlide(piece)`. Deciding tap-vs-flick anywhere else
fights the shared shell.

Ignore non-primary pointers (`input.primary`, `pointers.size`) — two thumbs
sliding two pieces into each other is not a case the occupancy sweep models.

## Audio

`audio.play(name)` **silently returns** on an unknown name — there is no warning.
The presets are exactly `tap`, `place`, `perfect`, `score`, `fail`, `whoosh`.
There is no `thunk`, `bump` or `slide`.

The second argument is the only way to get a new sound without editing
`shared/audio.js` (which is shared and needs the user's sign-off):
`play(name, {rate})` scales pitch and shortens duration by `rate`. So the dull
thunk for an illegal move is `audio.play('tap', { rate: 0.4 })` — `fail` is a
0.38 s descending buzz, far too heavy for something that fires all the time. Use
`place` for a legal slide, `whoosh` as the piece leaves the board, and `perfect`
when the board empties.

Nothing sounds until a real touch has unlocked the context — `boot` does that on
the first `onDown` and on the `#tap-to-start` gate.

Mute lives under a bare `muted` key, not the `unpuzzle:` namespace — it is
deliberately shared across all three games.

## Layout on resize

Derive the board rect from `stage.w/h` in a `layout()` function, call it **once
in `ready`**, and re-call it from `stage.onResize(fn)`. Subscribing alone is not
enough: `createStage` sizes the stage before any listener can exist and `resize()`
early-returns when nothing changed, so `onResize` never fires for the initial
size and the board would render from uninitialised layout until the iOS URL bar
slid away.

Levels are authored in grid cells, so keep **one cell→screen transform** and route
every draw, hit test and slide animation through it. `stage.onResize` returns an
unsubscribe function. DPR is capped at 2 and already applied — never multiply by
`devicePixelRatio` yourself.

## Animation lives in `update`, not `render`

The ~0.25 s eased slide is state advanced in `update(dt)` at a fixed 1/60 s (15
steps), not a `performance.now()` read inside `render`. `render` only draws what
`update` decided; `alpha` is there if a slide needs interpolating between steps.

## Feel details worth the effort

Slide eased out over ~0.25s · a piece fades as it crosses the board edge ·
remaining-piece counter · subtle celebratory sweep when the board empties.

## Assets

Pieces are flat coloured polygons — draw them, do not export rectangles from
Figma. The Figma file holds the piece style sheet, direction arrows,
level-complete art, and UI marks. Load any of it through `loadAll()` from
`../shared/assets.js`, inside `ready`.

- Figma file `qSAVuXAtFdC89LKE4H0P5Z` —
  https://www.figma.com/design/qSAVuXAtFdC89LKE4H0P5Z/unpuzzle?node-id=0-1
  This is where the design work happens, not a screenshot-and-guess.
- Art-style references — https://id.pinterest.com/093irvan/mobile-ui/
  The user's own board. Pull the visual direction from here before inventing
  one; it is the tiebreaker whenever "flat minimal + bold color" leaves room.

## Conventions

- **Player-facing copy is Indonesian** (`TAP UNTUK MULAI`, the hub cards, the
  test page); `index.html` is `<html lang="id">`. Code, comments and commit
  messages stay English.
- No raw hex or raw font strings in `game.js` — pull from `../shared/tokens.js`
  (`COLOR`, `ACCENT['unpuzzle']`, `TYPE`, `SPACE`, `STYLE`). Figma binds the same
  tokens; raw values are how the two drift apart. The stub's inline
  `'800 30px "Baloo 2"…'` is scaffold shorthand, not the pattern to copy.
- `store` is namespaced and swallows private-browsing failures. There is no score
  here, so `store.bestScore()` is not the right call — persist level progress
  with `store.get/set`.
- `shared/` is used by all three games — raise any change there with the user
  first. Touch nothing outside `unpuzzle/`.
