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
| `catalog.js` | `Data/ObjectCatalog.cs`, `ObjectSetDefinition.cs` |
| `sprites.js` | the sprite half of `GridObjectView.cs` |
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

## Assets

**Every level gets its own object.** They are Half It's sticker sheets, exported
from Figma (file `F7Vlc4oODiLdMrZEl81oqi`) into `assets/<theme>-<slug>.svg`.
`catalog.js` maps level to sticker and to a background colour.

**There are 62, not 100.** The Figma file has twelve sheets of twenty slots, but
only 62 are drawn — every other slot is a `locked` placeholder with no art inside
its frame, and Sports, Kitchen, Tools and Halloween are entirely placeholder. So
levels 1-62 are each unique and level 63 wraps back to the first sticker, on a
different background so the repeat is not obvious. Drawing more stickers in Figma
and re-exporting is what raises that ceiling; nothing in code needs to change
beyond adding the slug to its theme.

**Exporting more.** `download_assets` on the sticker's inner art frame (the child
of `LvNN Name Grade`, not the wrapper — the wrapper carries Half It's grade badge)
returns one SVG in `svgAssets`. When a node returns several, they are its
sub-layers and none of them is the whole sticker: fall back to
`defaultFormat: 'svg'`, which returns the node whole but drags in two rects that
must be deleted — the `#F5F5F5` backing the override re-adds, and the sheet's own
390x844 background.

**The white keyline and drop shadow are stripped**, on purpose: this game wants
flat art on bold colour, and the sticker chrome that reads well on Half It's cream
paper reads as a muddy blob on a saturated field. Both live in Figma, untouched,
because the same sheets are Half It's shipping art. Two structural markers to
strip after any re-export, never a colour test — plenty of stickers are
legitimately white:

- Figma renders an outside stroke as `<path mask="url(#path-N-outside-M)" fill="white"/>`
  plus its `<mask>` definition. Delete both. (59 of 62 files.)
- The Space stickers encode the same edge as a path that is both `fill="white"`
  and `stroke="white"`. Delete those. (2 files.)
- The shadow is a `filter="url(#filterN_d_...)"` attribute plus its `<filter>`
  definition. Deleting both took the folder from 1.0 MB to 364 KB.

## Deviations from Unity, all deliberate

- **The shape anomaly swaps the sticker, it does not swap a variant.** Unity
  authors two shape variants per fruit; Figma has none, so the impostor becomes a
  different sticker from the same theme. `THEMES[].items` is ordered by how alike
  the stickers look, and `alternatives()` returns them farthest-first, which is
  the obvious-to-subtle order `ImpostorRules` already expects. **Reordering that
  list retunes every shape level in the theme.** A theme with one item (vehicles)
  has no alternative at all and falls back to a colour anomaly.
- **Art loads per level, not upfront.** 62 SVGs is 364 KB and `loadAll()` would
  pull all of it before the first frame. A level fetches its two stickers, then
  prefetches the next level's; `loadToken` drops a slow level's images if a newer
  level started while they were in flight.
- **Two sprites are cached per round.** Only `normal` and `impostor` appearances
  exist, so each is rasterised once into an offscreen canvas and the grid is
  blits — worth more here than with drawn shapes, since re-rasterising an SVG per
  frame is far more expensive than a dozen bezier paths. Opacity, scale and
  rotation stay at blit time; never bake them. The colour anomaly *is* baked,
  through a `multiply` fill re-clipped with `destination-in`.
- **Burst particles sample the sticker** (`accentColor`) rather than reading a
  hand-listed colour: 62 hand-picked colours is 62 chances to forget one.
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
the campaign loops back to level 1 at the cap.
