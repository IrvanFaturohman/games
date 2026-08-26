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
