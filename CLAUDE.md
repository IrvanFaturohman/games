# Games — hyper-casual web prototypes

Three hyper-casual games built web-native first, tested on a phone browser,
and ported to Unity later once the gameplay feel is proven. Web is the
prototyping medium, **not** the shipping target.

## Layout

```
games/
  index.html      hub linking the three games
  shared/         the mobile shell every game builds on
  stick-hero/     hold, release, cross the gap        accent #FF5A5F
  unpuzzle/       slide every piece out of the board  accent #3DDC97
  polygram/       fit shapes into a silhouette        accent #FFB627
  test/           device diagnostic page
```

## Who owns what

Each game is worked on in **its own Claude Code session**, from its own clone
(see "One clone per session" below — the clone root *is* this repo root, there is
no `games/` directory inside it), driven by its own remote control.

| Path | Who may change it |
|---|---|
| `stick-hero/`, `unpuzzle/`, `polygram/` | that game's session, and only that one — including the folder's own `CLAUDE.md` |
| `shared/`, this root `CLAUDE.md`, `index.html`, `test/` | nobody unilaterally; raise it with the user first |

**The boundary covers the other games' docs, not just their code.** Noticing that
another game's `CLAUDE.md` is thin, stale, or plainly wrong is not a licence to
fix it. Say so and let the user route it to the session that owns it.

This is not bookkeeping. A session that edits a folder it does not own creates
the merge conflict this whole layout exists to prevent, and the conflict lands on
whoever pushes *second* — never on the session that caused it. It has already
happened once: two sessions independently corrected the same shell-contract
mistake, one of them reaching into a game folder that was not its own, and the
second push had to reconcile both files by hand.

It runs the other way too. If your game needs something from `shared/`, ask for
it — do not add it locally, and do not copy it out of another game's folder.

## Constraints that drive everything

- **No build step.** Plain ES modules served straight from GitHub Pages. No
  npm, no bundler, no transpile. If it does not run from `file://`-style static
  hosting, it does not belong here.
- **Phone first.** Every feature is judged on a phone in portrait, one-thumb,
  outdoors. Desktop is a debugging convenience, not the target.
- **Flat minimal + bold color.** No gradients, no shadows, sharp corners. Tokens
  live in `shared/tokens.js` and mirror the Figma design system — change both
  together or they drift.

## The shared shell

Import from `shared/`, do not reimplement:

| Module | Gives you |
|---|---|
| `boot.js` | `boot({name, ready, input, update, render})` — wires everything below |
| `engine.js` | DPR-correct canvas, fixed-timestep loop, resize/orientation handling |
| `input.js` | pointer events → `onDown/onMove/onUp/onTap/onHoldStart/onHoldEnd` |
| `audio.js` | synthesised SFX, iOS unlock handled |
| `storage.js` | namespaced localStorage, guarded against private browsing |
| `tokens.js` | colors, type scale, spacing |
| `assets.js` | `loadAll({name: url})` → `{name: <img>}`; a miss rejects loudly |
| `core.css` | the no-scroll, no-zoom, no-tap-flash page shell each `index.html` links |

### The callback contract

```js
ready(game)                  // awaited before the first frame — put loadAll() here
update(dt, game)             // fixed 1/60 s step, may run up to 15x in one frame
render(ctx, game, alpha)     // every rAF; alpha = leftover accumulator fraction
```

`game` is `{ stage, audio, store, input, name }` — the *same object* reaches every
callback, input handlers included. Those handlers get `game` appended as the
**last** argument, so their arity differs:

```js
onDown(p, pointers, game)   onMove(p, pointers, game)   onUp(p, pointers, game)
onTap(p, game)              onHoldStart(p, game)        onHoldEnd(p, dur, game)
```

`render` draws in **CSS pixels** — the DPR transform is already applied, so never
multiply by `devicePixelRatio` yourself. `update` must stay free of rendering and
of `performance.now()`; its 15-step ceiling is `maxFrame 0.25 ÷ step 1/60`.

Two more things the canvas decides for you: `stage.dpr` is capped at 2, so a 3x
phone deliberately renders at 2x, and the context is created with
`{alpha: false}` — `clearRect` paints **black**, not cream, so fill `COLOR.bg`
every frame instead.

### Three traps the shell sets

**`onResize` never fires for the initial size.** `createStage` sizes the stage
before any listener can exist, and `resize()` early-returns when w/h/dpr are
unchanged — which makes the `stage.resize()` inside `boot` a no-op too. Write
layout as a function, call it once in `ready`, and re-call it from `onResize`.
Subscribing alone leaves you rendering uninitialised layout until something
genuinely changes size, which on a phone means the URL bar sliding away.

**A rejected `ready` looks like a dead page, not an error.** `boot` awaits `ready`
*before* wiring the `#tap-to-start` gate, so a rejection leaves that gate up
forever — and at `z-index:10` it swallows every pointer event. The symptom is a
page stuck on TAP UNTUK MULAI that ignores taps; the only evidence is a console
error. `loadAll()` rejects on any missing asset, so one wrong path does exactly
this.

**A held pointer can still fire `onTap`.** On release the order is `onHoldEnd`
(when `p.held`), then `onUp`, then `onTap` — and the `onTap` guard is only
`!p.moved && dur <= TAP_MAX_MS`. With `HOLD_MS` 220 and `TAP_MAX_MS` 350, a still
thumb released inside that 130 ms window fires `onHoldEnd` *and* `onTap`, so a
game wiring both gets its action twice. `p.duration` is assigned just before
`onHoldEnd`, so it reads fine there and in `onTap`, but is undefined during
`onDown`, `onMove` and `onHoldStart`.

## Assets

Designed in Figma, one file per game, exported into `<game>/assets/`.
Prefer SVG for flat shapes; PNG @2x only when a shape cannot be vector.
Generate what canvas cannot draw cheaply — do not export a rectangle.

Load them with `loadAll()` from `shared/assets.js`. SVG draws to canvas like any
other image and stays crisp at every DPR, so there are no @2x/@3x variants.

**Export trap.** Calling `download_assets` with `defaultFormat` *overrides* the
node's own export settings and re-adds a `#F5F5F5` backing rectangle to the SVG.
Set `exportSettings` on the node once (`[{format:'SVG', suffix:''}]`, which
carries `contentsOnly: true`) and then call `download_assets` **without**
`defaultFormat` so those settings win.

Every fill in Figma is bound to a `tokens` variable, never a raw hex — that is
what keeps the three files from drifting apart. Each file has its own `tokens`
collection: 16 variables (`color/*`, `space/*`, `stroke/*`, `radius/*`) and four
text styles (Score, Title, Body, Label) on Baloo 2. Note Figma spells the styles
`ExtraBold` and `SemiBold` with no space — unlike Inter.

Figma files:
- stick-hero `3MCjOe4tnvd5wTM4tPtE4Y`
- tangram/polygram `L5n7rj9XmQnAOxG9s0Tdpg`
- unpuzzle `qSAVuXAtFdC89LKE4H0P5Z`

## One clone per session

Each game is worked on from **its own clone**, never a shared working tree:

```
~/games/              foundation + shared/    (this is the origin's source)
~/games-stick-hero/   session 1
~/games-unpuzzle/     session 2
~/games-polygram/     session 3
```

All four track `origin/main` on GitHub. Separate clones mean separate index and
HEAD, so `git add -A`, `stash` and `checkout` are safe — they can only ever see
your own copy. In a shared tree they silently swallow another session's
in-progress work, which git does not report as a conflict because it isn't one.

## Deploy

```
git pull --rebase        # take in the other sessions' work
git add -A
git commit -m "..."
git push                 # Pages rebuilds in ~30s
```

If the push is rejected, someone pushed first: repeat `git pull --rebase`, then
push again. While every session stays inside its own folder the rebase replays
cleanly and there is nothing to resolve.

```
https://irvanfaturohman.github.io/games/<game>/
```

A real conflict means two sessions touched the same file — either somewhere they
legitimately meet (`shared/`, this `CLAUDE.md`, `index.html`, `test/`) or because
one of them crossed into a folder it does not own. Fix the marked file, `git add`
it, then `git rebase --continue`.

Resolve it, never `--force`. The other session's side is not noise: it may well be
the more correct of the two, and if it contradicts yours on a fact about the
shell, check the shell rather than assuming yours was right. Reconciling by hand
and keeping the better half of each is the expected outcome, and worth saying in
the commit message so the next session can see which claim won.

Never delete `.nojekyll`; without it Pages hides any underscore-prefixed path.

For tight feel-tuning where a 30s round trip hurts, serve from the **repo root**
so `../shared/` imports resolve: `npx serve . -p 5173`, plus
`cloudflared tunnel --url http://localhost:5173` to reach it from a phone.
