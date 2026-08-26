# Stick Hero

Read `../CLAUDE.md` first for the shell, constraints, and deploy flow.

Accent `#FF5A5F` · store namespace `stick-hero` · one session, one remote control.

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
and UI marks only.
