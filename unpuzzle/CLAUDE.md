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

The core is playable: `carve.js` turns pictures into puzzles, `game.js` runs the
board, three animals ship in `levels.js`. Verified in a desktop browser only —
slide feel, flick threshold and audio have never been judged on a phone, which is
the one place that counts.

## Core loop

The pieces sit together as an animal. Each piece can only exit in one direction.
Tap (or flick) a piece → it slides that way and leaves the board, but only if
nothing blocks its path. Clearing the board takes the animal apart and leaves its
silhouette behind. No timer, no fail state — the pressure is purely "which one
first".

Note the neighbour: polygram is *fit shapes into a silhouette*. Unpuzzle must
stay the taking-apart game, or the two collapse into each other.

## The one hard problem

**Collision along the exit path.** A piece sweeps its own cell footprint along
its exit vector until it leaves the board; if any swept cell is occupied, the
move is illegal. Model the board as a grid occupancy map and test the sweep —
do not try to do this with bounding boxes and pixel math.

Illegal taps must still feel answered: nudge the piece a few pixels toward its
exit and bounce back, plus a dull thunk. Silence reads as a broken tap.

## Levels are pictures

A level is art and nothing else — an ASCII grid, one letter per colour, plus a
palette and a seed. **Every filled cell is one tile carrying one arrow**; there
is no cutting into multi-cell pieces. **The tile face is the picture's colour** —
the board is the animal, full colour — and the arrow on it stays neutral so it
never competes with the drawing. Eyes are cells painted `ink`.

Both the tile's thickness and its arrow are derived from its own face colour, so
adding a colour to the palette needs nothing else: the thickness is a 0.74 shade
of the face, and the arrow is white unless the face is paler than 0.80 luminance,
in which case it becomes a deep tint of the face. That threshold sits high on
purpose — a board of mostly white arrows reads as one set, and only genuinely
pale faces like a cream muzzle break away.

```js
{ name: 'kucing', art: ['.P...P.', ...], palette: { P: PIECE.pink, ... }, seed: 7 }
```

`carve.js` decides which way each arrow points at load, and it **peels rather
than guesses**: take a tile with a clear straight run to an edge given what is
still on the board, assign it that direction, remove it, repeat. The peel order
is by construction a solution, so a level that resolves is a level that can be
finished. It cannot get stuck either — the topmost remaining tile in any column
always has a clear run upward.

Check every level after editing art:

```
node unpuzzle/tools/author.mjs
```

It prints the silhouette as blocks, which is the fastest way to catch art that
does not read as the animal — a beak that does not protrude past the head, ears
flush with the skull. It also reports **free-on-turn-1**, how many tiles can move
immediately, which is the only real difficulty knob since the ruleset cannot
dead-end (below). Solid silhouettes leave most tiles on the boundary, so that
number runs high and levels play loose.

## Difficulty is search, not strategy

Picking a bad order cannot lose. Pieces only ever leave the board, never move to
a new blocking position, so blockers only ever disappear and a blocked piece
always frees up eventually. There is no dead end and no wrong move — only
looking for which piece is free.

That bounds what level design can achieve here. Real stakes would need a rule
this game does not have: a move limit, a star target, or pieces that stop inside
the board instead of leaving.

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

## The juice, and why each piece of it is there

Tile motion lives in `poseOf()`, the single place that decides where a tile is and
how deformed. Particles live in `bits`. Timers advance in `update`; nothing here
reads a clock during render, and nothing uses `Math.random` — the spread comes
from the particle index so a replay is identical.

- **Press on `onDown`, not on release.** The face sinks onto its own thickness
  and its shadow tightens. This is the one that matters most — a tile that does
  not answer the finger until it has already decided to move feels dead.
- **Anticipation before the slide.** The tile loads up 0.16 cells *against* its
  arrow for 70 ms before it goes. Without it, leaving reads as a teleport.
- **Stretch along the travel axis**, plus **three echoes** strung out behind a
  moving tile. Three is enough to read as speed; more costs fill rate for
  something on screen a quarter of a second.
- **Dust at the origin cell, not at the exit.** The eye is still where the tap
  landed, so that is where a departure has to register.
- **The blocker answers too.** A refused move shakes the tile twice toward its
  exit, pulses whatever stopped it, and throws sparks onto the seam between them.
  Refusing without pointing at the cause teaches nothing, and this game has no
  other way to explain itself.
- **Pitch climbs as the board empties** — `place` is played at up to 1.55× rate.
  Thirty taps of the same note is a chore; thirty rising ones is a build.
- **Tiles arrive from the middle outwards**, staggered by distance from centre,
  so the animal assembles itself instead of appearing.
- **Confetti in the level's own palette** on a clear, then the silhouette breathes
  in the accent colour. It is what the level was, so it gets the last beat.
- **`navigator.vibrate` where it exists** — 10 ms on a move, 18 on a refusal, a
  pattern on a clear. Guarded; desktop and iOS Safari simply skip it.

`MAX_BITS` is 130 and deliberately low. A mid-range phone will draw a few dozen
small shapes a frame without noticing and will absolutely notice a few hundred.

Screen shake is tiny and only fires on a refusal. There is no fail state here, so
shake has nothing else to mean.

## Screen furniture

Tiles on an empty page look like a screenshot rather than a screen, so:

- A **wash panel** behind the board, filled with the level's own dominant colour
  pulled 86% back toward the page — each animal brings its own mood. `layout`
  reserves `WASH_PAD` cells on every side for it; without that reservation the
  panel is sized off a board that already claimed the full width and bleeds off
  the screen.
- **Pills, not labels.** `LEVEL n` on the left, the count on the right, and the
  animal's name as the screen's title rather than a third equal label.

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

## Visual style: chunky here, flat everywhere else

Decided with the user after a pass over the reference board. Unpuzzle diverges
from the suite's flat law **on geometry only**, and the divergence is deliberate
— it is not drift, and it is not a licence to touch `shared/`.

| | Comes from | Value |
|---|---|---|
| Colour | `shared/tokens.js` | `COLOR`, `ACCENT['unpuzzle']` — unchanged, no local palette |
| Type | `shared/tokens.js` | `TYPE` (Baloo 2) — already the right family for this look |
| Spacing | `shared/tokens.js` | `SPACE` — unchanged |
| Piece geometry | **local to this game** | rounded, die-cut, shadowed — see below |

`STYLE` from `shared/tokens.js` (`radius: 0`, `strokeWidth: 4`) still governs the
suite and the other two games. **Unpuzzle's pieces ignore it.** Keep the local
geometry in one place — a `style.js` in this folder — so the override is a single
readable exception rather than magic numbers sprinkled through `render`.

The look, from the board:

- **Radius scales with the cell, not the screen.** Express it as a fraction of
  cell size (~0.18) inside the cell→screen transform, so a piece reads the same
  on a small phone and a tablet. A fixed px radius makes pieces look sharp on a
  big board and mushy on a small one.
- **Die-cut outline.** A `COLOR.white` stroke *outside* the fill, ~3–4 px, is what
  makes a piece read as a peel-able sticker rather than a painted tile. This is
  the single detail doing most of the work on the board — do it before the shadow.
- **Offset silhouette, not `ctx.shadowBlur`.** Draw the piece shape again beneath
  itself, offset a few px, in charcoal at low alpha. A real blurred shadow per
  piece per frame is the kind of thing that quietly costs frames on a mid-range
  phone, and at this scale the offset version is indistinguishable.
- **Warm saturated ground.** The board leans orange/yellow-green under multicolour
  pieces. `COLOR.bg` cream is close enough to start; if it needs more heat, raise
  it with the user rather than inventing a local background colour.

The suite deliberately looks less uniform after this. That was the trade accepted:
no `shared/` change, so no coordination with the stick-hero and polygram sessions.

## Conventions

- **Player-facing copy is Indonesian** (`TAP UNTUK MULAI`, the hub cards, the
  test page); `index.html` is `<html lang="id">`. Code, comments and commit
  messages stay English.
- No raw hex or raw font strings in `game.js` — pull from `../shared/tokens.js`
  (`COLOR`, `ACCENT['unpuzzle']`, `TYPE`, `SPACE`). Figma binds the same tokens;
  raw values are how the two drift apart. The stub's inline
  `'800 30px "Baloo 2"…'` is scaffold shorthand, not the pattern to copy.
  `STYLE` is the one token group this game does not follow — see "Visual style"
  above.
- `store` is namespaced and swallows private-browsing failures. There is no score
  here, so `store.bestScore()` is not the right call — persist level progress
  with `store.get/set`.
- `shared/` is used by all three games — raise any change there with the user
  first. Touch nothing outside `unpuzzle/`.
