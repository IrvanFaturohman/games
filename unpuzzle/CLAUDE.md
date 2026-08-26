# Unpuzzle

Read `../CLAUDE.md` first for the shell, constraints, and deploy flow.

Accent `#3DDC97` · store namespace `unpuzzle` · one session, one remote control.

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

## Feel details worth the effort

Slide eased out over ~0.25s · a piece fades as it crosses the board edge ·
remaining-piece counter · subtle celebratory sweep when the board empties.

## Assets

Pieces are flat coloured polygons — draw them. The Figma file
(`qSAVuXAtFdC89LKE4H0P5Z`) holds the piece style sheet, direction arrows,
level-complete art, and UI marks.

## Current state

`game.js` is still the shell stub — a tap counter that proves boot, render and
input work on device. `assets/` is empty and there is no `levels.js`. Everything
above is spec, not description: none of the core loop exists on disk.

## Running it

No build, no tests, no lint — there is no `package.json` in this repo at all.

Serve from the **repo root**, never from this folder:

```bash
cd .. && npx serve . -p 5173          # → http://localhost:5173/unpuzzle/

# Real-phone testing without the Pages round trip
cloudflared tunnel --url http://localhost:5173

# Deploy — three sessions share this repo, so always rebase first
git pull --rebase && git push          # live ~30s later at
                                       # https://irvanfaturohman.github.io/games/unpuzzle/
```

`game.js` imports `../shared/boot.js`, so a server rooted at `unpuzzle/` puts
those imports above its root and every module 404s.

`../test/` is the device diagnostic — DPR, safe-area insets, fps, multi-touch,
audio unlock, whether Baloo 2 actually loaded. Open it first when something looks
wrong on a phone, before suspecting game code.

## The boot contract

```js
ready(game)                  // awaited — put level loading here
update(dt, game)             // fixed 1/60 step, may run up to 15x in one frame
render(ctx, game, alpha)     // every rAF; alpha = leftover accumulator fraction
```

`game` is `{ stage, audio, store, input, name }`. Pointer handlers get it appended
**last**, so arity differs:

```js
onDown(p, pointers, game)   onMove(p, pointers, game)   onUp(p, pointers, game)
onTap(p, game)              onHoldStart(p, game)        onHoldEnd(p, dur, game)
```

`p` carries `{id, x, y, startX, startY, dx, dy, moved, held}` in the same
CSS-pixel space you draw in, so hit-testing a piece is a direct comparison
against its draw coords. `duration` is added on `onUp` and is undefined before it.

## Tap versus flick

The core verb is "tap or flick a piece", and `input.js` has already decided where
the line falls:

- `TAP_SLOP` 12 px — drift past this sets `p.moved` and **kills `onTap`**
- `TAP_MAX_MS` 350 — slower than this is not a tap either
- `HOLD_MS` 220 — when `onHoldStart` fires

So a flick never arrives as `onTap`. Read the direction on `onUp` from `p.dx/p.dy`
and treat `onTap` as the no-direction case that uses the piece's own exit vector.
Deciding between them anywhere else fights the shared shell.

## Audio

`audio.play(name)` **silently returns** on an unknown name — there is no warning.
The presets are exactly: `tap`, `place`, `perfect`, `score`, `fail`, `whoosh`.
There is no `thunk`, no `snap`, no `click`. Use `whoosh` for a piece leaving the
board, `place` for a legal slide, `fail` for the blocked-move bounce, and
`perfect` when the board empties. Nothing sounds until a real touch has unlocked
the context.

Mute is stored under a bare `muted` key, not the `unpuzzle:` namespace — it is
deliberately shared across all three games.

## Layout on resize

Derive the board rect from `stage.w/h` in a `layout()` function, call it once in
`ready`, and re-call it from `stage.onResize(fn)` — the subscription alone never
fires for the initial size. Levels are authored in grid cells, so keep one
cell→screen transform and route every draw, hit test and sweep through it.

## UI copy is Indonesian

Every page is `<html lang="id">` and all on-screen text is Indonesian
("TAP UNTUK MULAI"). Match it — code, comments and commits stay English.
