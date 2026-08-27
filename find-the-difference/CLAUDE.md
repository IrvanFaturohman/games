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
divisible by 10 are boss levels at 4 impostors. Columns cap at 6 — past that the
cells are narrower than a thumb — and `rowsFor` sets the rows from that.

## Assets

**Every level gets its own object.** They are Half It's sticker sheets, exported
from Figma (file `F7Vlc4oODiLdMrZEl81oqi`) into `assets/<theme>-<slug>.svg`.
`catalog.js` maps level to sticker and to a background colour.

Themes are only runs of levels and sets of backgrounds; an impostor is never a
different sticker, so nothing about the theme lists affects difficulty.

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

- **The shape anomaly edits the sticker; it never swaps in another one.** Unity
  authors two shape variants per fruit and Figma has none, so the impostor is the
  level's own sticker with a bite taken out of its outline. That works on any
  silhouette, so there is no per-sticker authoring to keep in sync. `rules.js`
  only decides angle and strength; `sprites.js` finds where the shape actually is.
  - **A bite is the only edit, and that is a finding, not a shortcut.** Two
    others were built and rejected on the render: a painted spot read as a
    smudge rather than a drawing, and a bump grown out of the outline read as a
    lump on the kiwi, the ice cream and the rabbit — fine only on shapes that
    were already blobs. Variety comes from where and how big, not from having
    several kinds. A second edit that looks *designed* needs authored variants
    in Figma; do not add another procedural one without rendering all 62 first.
  - **Placement is scanned, not assumed.** The sticker sits inside a box padded
    by its own export, so `alphaBounds` finds the real shape first, and a ray
    from that centre out to the last opaque pixel finds the outline. The disc is
    centred ON that point so half of it falls outside, which reads as a bite
    rather than as a hole punched through the middle.
  - **Size comes from the whole sticker, not from that ray.** Scaling by the ray
    made a bite on a spring onion — long and thin, so a sideways ray is short —
    invisible at every strength. The geometric mean of the alpha bounds is what
    keeps a stalk and a cookie comparable.
- **Art loads per level, not upfront.** 62 SVGs is 364 KB and `loadAll()` would
  pull all of it before the first frame. A level fetches its one sticker, then
  prefetches the next level's; `loadToken` drops a slow level's image if a newer
  level started while it was in flight.
- **Two sprites are cached per round.** Only `normal` and `impostor` appearances
  exist, so each is rasterised once into an offscreen canvas and the grid is
  blits — worth more here than with drawn shapes, since re-rasterising an SVG per
  frame is far more expensive than a dozen bezier paths. Opacity, scale and
  rotation stay at blit time; never bake them. The colour anomaly *is* baked,
  through a `multiply` fill re-clipped with `destination-in` — and the shape edit
  is applied AFTER it, because that `destination-in` pass would put back exactly
  the alpha a `remove` had just carved away.
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

## Density

The grid runs the **full width of the screen** and the objects nearly touch:
`BOARD_FILL` 1 and `CELL_FILL` 0.96, against Unity's 0.82 and 0.78. Unity's
numbers put the objects at 64% of the space available, which on a phone reads as
a small grid floating in a field of colour. Width is the binding dimension on
every campaign level in portrait, so the grid always reaches both edges.

**Sprites are cropped to the drawing, not to the file.** Each export carries the
padding its drop-shadow filter needed, and stripping that filter left the padding
behind — up to 11 user units, measured, and different in every file, so a fixed
inset would have clipped the ones that had none. `contentBounds` measures it once
per image and `makeSprite` scales the content, not the box, to fill the cell.

Cell size is `min(area/cols, area/rows)`; hit test is a circle of half a cell, so
a thumb landing in the gap between two objects misses rather than punishing the
nearest one.

**Rows come from the screen's aspect, not from Unity** (`rowsFor` in
`levels.js`). A square-cell grid only fills a 420x776 play area when `cols/rows`
is about 0.54 — 3x6, 4x7, 5x9, 6x11. Unity's rows were all squarer than that and
left 40-140px of background above and below. Same columns, more rows, so a level
holds more cells than the original: 4 cols 20 to 28, 6 cols 42 to 66. Impostor
counts are untouched, so it is more haystack, not more needles. Measured on a
420x776 board the margins are now 0-21px.

`rowsFor` is fixed per column count and never derived from the live viewport:
`RoundState` is built from the cell count at level start, so reading the screen
would let a rotation or a URL bar sliding away resize a round already in play. It
is tuned for a ~1.85 tall screen; a short one (an SE) keeps some side margin.

**The entrance stagger is capped in total, not per cell.** Unity delays each cell
a flat 12ms; at 66 cells that is 0.8s before the last object exists. `game.js`
divides `ENTRANCE_STAGGER` (0.4s) across the grid instead, so a big level opens as
fast as a small one.

## Visual direction — not built yet

The feel currently in the build is the generic hyper-casual set: a floating
`+100`, a circular particle burst, screen shake, a dark pill HUD. It works and it
refers to nothing. The replacement is designed in Figma `L14Uu1J6D2XwsI5yExsWkt`
("Perangko"): a **sheet of postage stamps**, chosen because the match is
structural — a sheet is a dense grid of identical images separated by
perforations, and philately is the hunt for printing errors.

| Now | Perangko |
|---|---|
| gap between cells | the perforation, punched not drawn |
| dark pill HUD | the selvage, the sheet's own margin |
| `LVL 6` | plate number, printed small |
| `0/4` pill | colour-check dots, blacked out one per find |
| particle burst + `+100` | a postmark thunks down off-register, killer bars running onto the neighbour |
| shake + `Oops!` | a red RETUR hand stamp |
| `x2!` floating | the date in the postmark advances |

One deliberate break from a real sheet: a 9px gutter between stamps. Tiled edge
to edge the whole screen goes cream and the level's background colour survives
only inside the perforations.

## Not ported yet

`endless()` exists in `levels.js` and nothing calls it — same as in Unity, where
the campaign loops back to level 1 at the cap.
