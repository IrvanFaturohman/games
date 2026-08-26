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

## Visual direction

Decided 2026-08-26 against the reference board (Pinterest link is in the project
memory). The board is casual-puzzle candy UI — saturated multi-colour, generous
radii, chunky bevelled buttons. The play field takes its *craft* without its
noise: in the board's own block-puzzle screens the play area stays quiet and all
the decoration lives in the frame.

- **No outlines anywhere.** Not on pieces, not on the silhouette, not on cards.
  An earlier draft gave pieces a charcoal stroke to hold contrast on cream; the
  user rejected it and the tile treatment below solves the same problem better.
- **Pieces are tiles, not cut paper.** Two faces: a flat top face in the piece
  colour, and one solid darker face ~6 px below it reading as thickness. That
  darker face is what separates two touching pieces and what keeps a light fill
  legible on cream — the job the stroke was doing.
- **Corners are rounded, ~7 px.** This is the real break with the suite: the root
  `CLAUDE.md` still says *sharp corners*, and polygram no longer obeys it. Raise
  it before assuming the other two games follow.
- **Depth from a second fill, never an effect.** The darker face is a solid
  colour derived from the fill (×0.8). Still no gradient, no shadow, no blur —
  cheap to draw on canvas and consistent with the rest of the suite.
- **Empty slots are lighter than the silhouette**, not dashed outlines. A
  slightly lifted charcoal (`#45403A`) inside the silhouette marks the next
  target without introducing a second visual language.
- **Chrome is the same rule, louder.** HUD pills, buttons, modals and the
  level-complete beat keep the bottom-band trick and just go rounder and more
  saturated. A pressed button drops 3 px and its band thins to match.

On canvas, round the polygon corners with `ctx.lineJoin = 'round'` plus a stroke
in the *same colour as the fill* — that rounds the silhouette of the shape
without ever drawing a visible edge.

Pieces need their own palette whatever the taste call: a 7-piece tangram needs
seven tellable-apart fills and `tokens.js` carries one accent per game. Each
piece is also a distinct *shape*, so colour is not the only channel separating
them — which is what keeps the ramp workable for colour-blind players. Lime was
pulled from `#B8DE2E` to `#A8CE2B`: with the stroke gone, the lighter value
washed out against cream.

## Assets

Polygon geometry is data, not images. The Figma file
(`L5n7rj9XmQnAOxG9s0Tdpg`) holds the silhouette set, piece style sheet, and
UI marks.

## Current state

The core loop is built and plays: drag out of the tray, tap to rotate in 45°
steps, snap on vertex proximity, the silhouette fills piece by piece, a
level-complete card, three levels, progress kept in `store`.

- `levels.js` — the seven-piece dissection plus three levels (3, 5 and 7
  pieces). A silhouette is drawn as the union of its own solution, so a level is
  solvable by construction and the only authoring risk left is two pieces
  overlapping. All three are subsets of one tiling that was checked to cover the
  4×4 square exactly once.
- `style.js` — piece palette, tile depth, `shade()`. This wants to be in
  `shared/tokens.js` and is local only until that change is signed off.
- `game.js` — everything else. Still no `assets/`: the geometry is data.

**Never let an animating value feed the snap test.** Three separate misses all
came from this. The grab lift, the tray→board grow tween and the drawn scale
each ended up deciding *where* a piece snapped, so the same gesture landed or
missed depending only on how fast the thumb moved. The rules that fixed it:
the lift is instant and gated on `p.moved` (a tap dispatches a pointermove at
the same coordinate, and lifting for that shoves the piece up on every rotate);
on release the lift is baked into the position rather than eased away; and
`candidate()` tests at the settled board scale, never at the tween's current
one. Only the grow tween is still animated, and nothing reads it but the draw.

Not done: tuning on a real phone — every number here is a desk guess — and more
levels.

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

**A rejecting `ready` is a blank screen, not an error.** `boot` awaits it before
starting the loop and nothing catches the rejection, so a missing `levels.js`
import or a failed `loadAll()` (which rejects loudly by design) reads on device
as a dead game. Wrap what can fail and draw the failure.

**The `#tap-to-start` gate eats the first tap.** It is an opaque `z-index:10` div
whose `pointerdown` only unlocks audio and hides itself, so input handlers never
see that tap — and the loop is already running behind it. "Tap to start level 1"
needs its own state, not the gate's.

Pointer handlers get the game object appended **last**, so arity differs:

```js
onDown(p, pointers, game)   onMove(p, pointers, game)   onUp(p, pointers, game)
onTap(p, game)              onHoldStart(p, game)        onHoldEnd(p, dur, game)
```

`p` carries `{x, y, startX, startY, dx, dy, moved, held}` in the same CSS-pixel
space you draw in — hit-testing a piece is a direct comparison against its draw
coords, no transform needed. `p.duration` is only stamped on the way up: it is
there in `onHoldEnd`/`onUp`/`onTap` and `undefined` in `onDown`/`onMove`.

## Gesture budget

`input.js` fixes the thresholds that decide drag-vs-tap, and this game's rotate
gesture lives inside them:

- `TAP_SLOP` 12 px — drift past this sets `p.moved` and **kills `onTap`**
- `TAP_MAX_MS` 350 — slower than this is not a tap either
- `HOLD_MS` 220 — when `onHoldStart` fires

So tap-to-rotate only lands if the thumb stays inside 12 px for under 350 ms. A
piece grab must therefore begin on `onDown`, and the rotate must commit on
`onTap` — deciding between the two on `onUp` fights the shared shell.

**220 and 350 overlap — they are not a boundary.** A single `onUp` fires, in
order, `onHoldEnd` → `onUp` → `onTap`, each gated independently. A still thumb
lifted between 220 ms and 350 ms therefore fires `onHoldStart`, `onHoldEnd`
*and* `onTap` for one gesture, so a slightly slow rotate tap runs the hold path
too. Either keep the two verbs on states that cannot both be live (a piece is
grabbed, or it is selected — never both), or ignore `onHoldEnd` under 350 ms.

## Audio

`audio.play(name)` **silently returns** on an unknown name — there is no warning.
The presets are exactly: `tap`, `place`, `perfect`, `score`, `fail`, `whoosh`.
There is no `snap` and no `click`; use `place` for a piece landing and `perfect`
for level completion. Nothing sounds until a real touch has unlocked the context.

`audio.play(name, { rate })` pitch-shifts a preset. `place` at a rate climbing
with each piece placed is the cheapest way to make a filling silhouette read as
progress rather than repetition.

Mute is stored under a bare `muted` key, not the `polygram:` namespace — it is
deliberately shared across all three games.

## Layout on resize

The board and the tray must both be derived from `stage.w/h` inside
`stage.onResize(fn)`, not computed once at startup. The URL bar sliding away on
iOS changes height mid-session, and level solutions are authored in normalised
coordinates — keep one silhouette→screen transform and route every piece
position, snap test and hit test through it, or the 24 px snap tolerance means a
different thing on every device.

**Register the callback, then run the layout once yourself.** `resize()`
early-returns when width, height and DPR are all unchanged, and `boot` calls
`stage.resize()` *before* awaiting `ready` — so a callback registered inside
`ready` does not fire until a genuine size change. Without that inline first
call the opening frames draw against a layout that was never computed.
`test/test.js` does exactly this pairing; copy it.

## UI copy is Indonesian

Every page is `<html lang="id">` and all on-screen text is Indonesian
("TAP UNTUK MULAI"). Match it — code, comments and commits stay English.
