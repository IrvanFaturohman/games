# Find the Impostor

Read `../CLAUDE.md` first for the shell, constraints, and deploy flow.

Accent `#7C5CFF` · store namespace `find-the-difference` · portrait, one thumb.

Despite the folder name this is **not** a two-picture spot-the-difference. The
folder matches its source repo, `~/Documents/GitHub/find-the-difference`, so the
two are findable from each other.

## What this is

A **port of that Unity project**, not a new design. Unity is where it ships; this
is the copy that runs in a phone browser, so the curve and the feel can be judged
without opening the laptop. When the two disagree, the Unity project is the source
of truth for rules and this one gets fixed.

Module split mirrors the C# so the two read against each other:

| Here | Unity |
|---|---|
| `round.js` | `Gameplay/RoundState.cs` |
| `rules.js` | `Gameplay/AnomalyType.cs`, `ObjectVisualState.cs`, `ImpostorRules.cs` |
| `levels.js` | `Gameplay/LevelConfigGenerator.cs` |
| `board.js` | `Gameplay/BoardLayout.cs` |
| `objects.js` | `Data/ObjectSetDefinition.cs` + the fruit PNGs |
| `game.js` | `Gameplay/RoundController.cs`, `GridObjectView.cs`, `RoundFeedback.cs`, `UI/HudView.cs` |

## Core loop

A grid of identical fruit. One property is off on 1–4 of them; tap those.
**Exactly one** property deviates — two would let a player win by spotting the
easier one. The six anomalies, in unlock order: color, shape, scale, rotation,
opacity, animation.

A found impostor **morphs into a normal object** instead of disappearing, so the
grid stays full and the ones still hiding keep their camouflage.

Combo window is 2.5s, 100 points per hit times the combo. No timer, no fail
state — the pressure is the combo clock.

## Difficulty

`campaign(level)` is deterministic: the same level always yields the same grid
size, impostor count, anomaly and `subtle`. Only **where** the impostors land is
random, which is what stops a retry from being pure memory.

`subtle` runs 0.1 (obvious) to 0.95 (nearly invisible) and rides a sine wave on
top of the ramp, so the curve breathes instead of climbing monotonically. Levels
divisible by 10 are boss levels at 4 impostors. The grid caps at 6x7 — past that
the cells are narrower than a thumb.

## Deviations from Unity, all deliberate

- **Fruit are drawn, not exported.** Unity ships a 512px PNG per fruit and per
  shape variant; here each is a dozen canvas paths in a unit box, so the shape
  variants are a parameter on one drawing instead of a second file that can drift.
- **Two sprites are cached per round.** Only `normal` and `impostor` appearances
  exist, so each is drawn once into an offscreen canvas and the grid is blits.
  48 fruit worth of bezier per frame is what makes a mid-range phone drop to 30.
  Opacity, scale and rotation stay at blit time — never bake them.
- **The level is saved.** Unity always starts at `startLevel`; here the phone
  resumes where it left off, because the whole point is picking it up between
  other things.
- **Haptics through `navigator.vibrate`**, which iOS Safari does not implement.
  The call is guarded; do not build feel that depends on it landing.

## Feel numbers, ported straight

Pop-in `outBack` 0.35s staggered 12ms per cell · correct `1.5 -> 1` `outElastic`
0.45s · wrong `0.8 -> 1` `outBack` 0.3s plus a 0.3s horizontal shake · idle wobble
`1 + sin(phase) * 0.03` at `2 * wobbleSpeed`, random phase per cell so the grid
does not breathe in lockstep · camera shake 0.06 cell on a combo, 0.1 on a miss ·
popup rises 0.8 cell over 0.9s `outCubic`, alpha `1 - t^2` · next level after 1.2s.

Cell size is `min(area/cols, area/rows) * 0.82`; the fruit fills 0.78 of its cell.
Hit test is a circle of half a cell, so a thumb landing in the gap misses rather
than punishing the nearest fruit.

## Not ported yet

`endless()` exists in `levels.js` and nothing calls it — same as in Unity, where
the campaign loops back to level 1 at the cap. Sets are still the two Unity has,
strawberry and orange; the catalog cycles them, so adding a third changes which
set every level past it uses.
