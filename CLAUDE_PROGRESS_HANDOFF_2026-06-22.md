# Gorilla's field guide — Progress Report / Handoff for Claude

Updated: 2026-06-22
Workspace: `G:\GOD App`
App URL: `http://localhost:5173/`

## Current state

We are in late-stage visual cleanup and interaction polish.

The app title has been changed from **The GOD App** to **Gorilla's field guide**.
The subtitle is now **A working theory of practical magic**.

The current browser title is:

- `Gorilla's field guide — Spell Compendium`

## What was completed

### 1. Spell list / page structure

- Removed the nested spell-list scrolling issue earlier so the spell list behaves as one page.
- Kept the flat parchment page approach.
- Search and class filter controls were widened in a prior pass, then partially rolled back when the user asked for original sizing proportions.

### 2. Spell previews in the list

- The spell list now shows previews for all spells regardless of active class filter.
- Preview mode is chosen per spell source/class logic instead of forcing every preview into the current detail renderer.
- Important: detail view still follows the current class lens (`Sorcerer`, `Druid`, `Warlock`, otherwise wizard), while list previews are per-spell.

Relevant file:

- `app/src/App.tsx`

### 3. Center-image swapping across glyph systems

- Warlock center-image flow remains working.
- Sorcerer now supports center-image swapping too.
- Druid also now supports center-image swapping.
- The controls are shared through the main app and passed down into the renderers.

Relevant files:

- `app/src/App.tsx`
- `app/src/components/SealView.tsx`
- `app/src/components/SpokesView.tsx`

### 4. Druid glyph stroke treatment

The user clarified a very specific art rule:

- only **triangles** and **circles** should remain generated
- line-based elements should use the hand-drawn line element

That is now implemented in the Druid renderer:

- main spokes use the hand-drawn line asset
- line / cycloid-style marks use the hand-drawn line asset
- circles and triangles remain procedural SVG shapes

Relevant file:

- `app/src/components/SpokesView.tsx`

### 5. Hand-drawn box asset usage

We previously cropped the box-sheet assets into individual SVGs in:

- `app/public/textures/boxes/`

Useful reference:

- `app/public/textures/boxes/README.md`

This README includes the intended aspect ratios for each frame asset.

## What changed most recently

### Spell cards on the spell list

This area has had several iterations and is the main thing Claude should inspect carefully.

What the user wanted:

- spell cards should feel closer to the earlier near-square proportions
- the top of the hand-drawn outer frame should not intersect the top divider line inside the card

What was done:

1. Restored the spell cards to the squarer frame asset:
   - `box-01.svg`

2. Adjusted actual card proportions, not just background art:
   - wider grid columns
   - shorter intrinsic height
   - tighter vertical padding
   - slightly smaller mini sigils

3. Then attempted to fix the top-edge collision between:
   - the outer hand-drawn card frame
   - the top internal divider line in `.sigil-cell-art`

Current approach in CSS:

- the outer card frame background is shifted upward slightly with `background-position: center -4px`
- the inner divider-line container padding was restored after an incorrect pass that effectively made the top divider disappear visually

Relevant file:

- `app/src/App.css`

## Important user correction

There were two different requests that got mixed up:

1. On the spell list / search UI, the user meant the **hand-drawn outline frames** should be corrected, not the underlying element sizes alone.
2. Separately, on the Druid glyph, the user wanted the **spokes themselves** to use hand-drawn line elements.

The Druid renderer now matches that request more faithfully.

The spell-card frame issue may still need visual inspection in-browser.

## Files modified in this phase

- `app/index.html`
- `app/src/App.tsx`
- `app/src/App.css`
- `app/src/components/SealView.tsx`
- `app/src/components/SpokesView.tsx`

## Validation status

Latest checks passed:

- `npx.cmd tsc --noEmit -p tsconfig.app.json`
- `npx.cmd vitest run`

Latest test result:

- `101/101` tests passing

## Likely next action for Claude

Open the live app and inspect the spell list visually.

Most likely remaining visual task:

- verify whether the **top of the spell-card frame** still feels too close to or intersects the **top divider line**

If it still looks wrong, adjust the spell-card frame relationship by changing the actual frame/image positioning first, not by deleting or visually collapsing the divider line.

## Notes on intent

- Do not revert the new title/subtitle.
- Do not revert the per-spell preview logic unless the user asks.
- Do not revert the Druid hand-drawn spoke implementation unless the user explicitly says it is wrong.
- The user is paying very close attention to tiny frame/line relationships on the spell list. Visual QA matters more here than abstract “clean CSS.”
