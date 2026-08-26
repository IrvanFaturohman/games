# Polygram

Read `../CLAUDE.md` first for the shell, constraints, and deploy flow.

Accent `#FFB627` · store namespace `polygram` · one session, one remote control.

Hardest of the three. Expect the level authoring to cost more than the code.

## Core loop

A silhouette outline sits on the board. A tray below holds polygon pieces.
Drag a piece onto the silhouette; when its position and rotation are close
enough, it snaps into place. Fill the silhouette completely to finish.

## The three hard problems

1. **Snapping tolerance.** Too tight and it feels broken, too loose and it plays
   itself. Snap on *vertex proximity* to the target slot, roughly 24 CSS px, and
   rotation within ~12°. Tune on a phone with a thumb, never with a mouse.
2. **Rotation on touch.** A thumb cannot easily two-finger rotate a small piece.
   Prefer a tap-to-rotate-by-increment on the selected piece over pinch rotation,
   and only allow the increments a solution actually needs.
3. **Piece pickup under a thumb.** The finger covers the piece. Lift the dragged
   piece toward the touch point by ~40 px so it stays visible.

## Level data

Each level is a target silhouette plus a known solution: for every piece, its
final position and rotation. Snapping tests against that solution, so an
authored level is by construction solvable. Store as JSON in `levels.js`.

Start with classic 7-piece tangram sets — they are well documented, known
solvable, and give a real difficulty curve for free before any custom shape work.

## Feel details worth the effort

Piece lifts and scales slightly on grab · target slot ghosts in when a piece is
near · satisfying click on snap · silhouette fills in accent colour piece by
piece · completed shape gets a short celebratory beat before the next level.

## Assets

Polygon geometry is data, not images. The Figma file
(`L5n7rj9XmQnAOxG9s0Tdpg`) holds the silhouette set, piece style sheet, and
UI marks.

## Current state

`game.js` is still the shell stub (tap counter). `assets/` is empty and there is
no `levels.js` yet. Everything above is spec, not description — none of the core
loop exists on disk.

## Running it

No build, no tests, no lint — there is no `package.json` in this repo at all.

Serve from the **repo root**, never from this folder:

```
cd .. && npx serve . -p 5173     # then open /polygram/
```

`game.js` imports `../shared/boot.js`, so a server rooted at `polygram/` puts
those imports above its root and every module 404s.

`/test/` is the device diagnostic — DPR, safe area, fps, multi-touch, audio
unlock. Open it first when something looks wrong on a phone, before suspecting
game code.

## The boot contract

Exact signatures, since `boot.js` appends the game object in a way the root
`CLAUDE.md` table glosses over:

```js
ready(game)                  // awaited — put loadAll() here
update(dt, game)             // fixed 1/60 step, may run several times a frame
render(ctx, game, alpha)     // every rAF; alpha = leftover accumulator fraction
```

`game` is `{ stage, audio, store, input, name }`.

Pointer handlers get the game object appended **last**, so arity differs:

```js
onDown(p, pointers, game)   onMove(p, pointers, game)   onUp(p, pointers, game)
onTap(p, game)              onHoldStart(p, game)        onHoldEnd(p, dur, game)
```

`p` carries `{x, y, startX, startY, dx, dy, moved, held, duration}` in the same
CSS-pixel space you draw in — hit-testing a piece is a direct comparison against
its draw coords, no transform needed.

## Gesture budget

`input.js` fixes the thresholds that decide drag-vs-tap, and this game's rotate
gesture lives inside them:

- `TAP_SLOP` 12 px — drift past this sets `p.moved` and **kills `onTap`**
- `TAP_MAX_MS` 350 — slower than this is not a tap either
- `HOLD_MS` 220 — when `onHoldStart` fires

So tap-to-rotate only lands if the thumb stays inside 12 px for under 350 ms. A
piece grab must therefore begin on `onDown`, and the rotate must commit on
`onTap` — deciding between the two on `onUp` fights the shared shell.

## Audio

`audio.play(name)` **silently returns** on an unknown name — there is no warning.
The presets are exactly: `tap`, `place`, `perfect`, `score`, `fail`, `whoosh`.
There is no `snap` and no `click`; use `place` for a piece landing and `perfect`
for level completion. Nothing sounds until a real touch has unlocked the context.

Mute is stored under a bare `muted` key, not the `polygram:` namespace — it is
deliberately shared across all three games.

## Layout on resize

The board and the tray must both be derived from `stage.w/h` inside
`stage.onResize(fn)`, not computed once at startup. The URL bar sliding away on
iOS changes height mid-session, and level solutions are authored in normalised
coordinates — keep one silhouette→screen transform and route every piece
position, snap test and hit test through it, or the 24 px snap tolerance means a
different thing on every device.

## UI copy is Indonesian

Every page is `<html lang="id">` and all on-screen text is Indonesian
("TAP UNTUK MULAI"). Match it — code, comments and commits stay English.
