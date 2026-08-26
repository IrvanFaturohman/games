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
