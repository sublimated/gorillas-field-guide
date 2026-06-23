# GOD App - Handoff for Claude

## Latest Handoff

### What just landed

Warlock now supports per-level/scaling numbers for notation without any renderer changes.

- Shared parsing/normalization lives in [app/src/data/normalizeAttributes.ts](G:/GOD App/app/src/data/normalizeAttributes.ts)
  - Added reusable scaling parsing for:
    - `Close (25 ft. + 5 ft./2 levels)`
    - `Medium (100 ft. + 10 ft./level)`
    - `Long (400 ft. + 40 ft./level)`
    - `1 round/level`
    - `1 min./level`
    - `10 min./level`
    - `1 hour/level`
    - `One day/level`
  - Exposes parse/resolve helpers instead of only flattening to representative values.
  - Keeps the old safe formatting behavior too (`30 ft.` -> `30 feet`, etc.).

- Warlock number decomposition lives in [app/src/engines/warlockNumber.ts](G:/GOD App/app/src/engines/warlockNumber.ts)
  - Generates existing `n*` tokens only.
  - Examples:
    - `7` -> `n7`
    - `24` -> `n20 n4`
    - `150` -> `n100 n50`
    - `1200` -> `n1000 n200`
  - No renderer work needed because it emits the same token format `parseWarlockCode()` already understands.

- Warlock engine wiring is in [app/src/engines/warlock.ts](G:/GOD App/app/src/engines/warlock.ts)
  - Exact book-listed strings still use the existing lookup tables first. This is important: verified published encodings are preserved.
  - On lookup miss, range/duration/area now:
    1. normalize/parse
    2. resolve against caster level
    3. encode back into Warlock token strings
  - `buildWarlockSigil()` now reads `casterLevel` from `opts` or `attrs.casterLevel`.

- Shared attribute model now has optional `casterLevel` in [app/src/engines/attributes.ts](G:/GOD App/app/src/engines/attributes.ts)
  - This was the cleanest way to thread the value without touching `WarlockView.tsx`.

- UI wiring is in [app/src/App.tsx](G:/GOD App/app/src/App.tsx) and [app/src/App.css](G:/GOD App/app/src/App.css)
  - Reuses the existing `charLevel` state as caster level for Warlock.
  - Shows a labeled caster-level control only when the current Warlock spell has a per-level term in range, duration, or area.
  - `WarlockView.tsx` was intentionally left untouched.

### Tests added/updated

- [app/src/data/normalizeAttributes.test.ts](G:/GOD App/app/src/data/normalizeAttributes.test.ts)
- [app/src/engines/warlockNumber.test.ts](G:/GOD App/app/src/engines/warlockNumber.test.ts)
- [app/src/engines/warlock.test.ts](G:/GOD App/app/src/engines/warlock.test.ts)
- [app/src/data/collisionVariants.test.ts](G:/GOD App/app/src/data/collisionVariants.test.ts)
  - This last one was adjusted to be dataset-agnostic again after the full suite exposed an old fixture assumption.

### Verified

From `G:\GOD App\app`:

- `npx.cmd tsc --noEmit -p tsconfig.app.json`
- `npx.cmd vitest run`
- `npm.cmd run audit:data`

All passed at the end of the session.

### Demo cases that work now

- A per-level duration like `1 min./level (D)` at caster level 7 resolves to `7 minutes` and Warlock code `hEE n7`.
- A per-level range like `Medium (100 ft. + 10 ft./level)` at caster level 7 resolves to `170 feet` and Warlock code `aF n100 n70`.
- Book-listed fixed values still keep their original lookup encodings.

### Hard constraints preserved

- `WarlockView.tsx` was not modified.
- Number glyph assets were not modified.
- `spells.json` was not modified in this pass.
- This is Warlock-only for now, but the parser/generator pieces were structured for reuse later.

### Still out of scope

Do not treat these as bugs from this pass:

- `Universal` school still needs a glyph if Warlock should support it visually.
- `Emanation` area shape still needs a glyph if Warlock should support it visually.
- Other class engines were not updated to use the new scaling helpers yet.

### Good next step

If Claude continues from here, the sensible follow-up is to reuse the new shared scaling helpers in other engines or decide how `Emanation` and `Universal` should be represented in Warlock notation before broadening support.

## Start here

This is a Vite + React + TypeScript spell-compendium app at `G:\GOD App\app`.
It presents each spell as a written notation, a spoken name, and a spectral view.
The source books are authoritative. Do not invent artwork or substitute symbols from
one class system into another.

Useful commands, from `G:\GOD App\app`:

```powershell
npm.cmd run dev
npx.cmd tsc --noEmit -p tsconfig.app.json
npx.cmd vitest run
npm.cmd run audit:data
```

At this handoff: TypeScript passes and Vitest passes (`8` files, `88` tests).

## Hard rules

- Do not generate or ship AI-created artwork.
- Do not redraw, extrapolate, or invent book notation. Use the matching class's
  compendium and source text.
- Keep edits isolated by renderer. Wizard corrections must not change completed
  Sorcerer, Warlock, or Druid notation.
- For spell metadata, source PDFs are the authority. Automated audits are triage,
  never automatic corrections.
- Do not broadly patch `spells.json` by a shared field/value; always include the
  unique `id` context. A previous broad patch temporarily changed unrelated spells.

## Current app shape

- Main UI: `app/src/App.tsx`.
- Spell data: `app/src/data/spells.json`, transformed by `app/src/data/spells.ts`.
- Shared spoken-name/spectrum attribute model: `app/src/engines/attributes.ts`.
- Wizard renderer: `app/src/engines/rune.ts`, `app/src/components/RuneView.tsx`,
  `app/src/engines/wizardTopology.ts`.
- Sorcerer renderer: `app/src/engines/seal.ts`, `app/src/components/SealView.tsx`.
- Warlock renderer: `app/src/engines/warlock.ts`, `app/src/components/WarlockView.tsx`.
- Druid renderer: `app/src/engines/spokes.ts`, `app/src/components/SpokesView.tsx`.

The spell-list/detail interface is intentionally a single flat paper sheet, not a
literal book. It opens on the list, opens a spell on selection, and has a back button.
Elements draw onto the page in sequence. Do not revert that interaction model.

## Class status

### Wizard - active recent correction

Source material:

- `Source PDFs/Wizard_Spell_Compendium_V7.pdf`
- `Source PDFs/_extracted/Wizard_Spell_Compendium_V7.txt`
- Dictionary pages 11-14: area/damage, school/level/duration, and range.

The Wizard system is a 13-sided blank lattice. The pale full lattice is correct:
each spell overlays the selected attribute chords in darker ink. Concentration is a
central dot; ritual is a central dot plus ring.

The former implementation used general-purpose feature orders. That was wrong for
the book. A new isolated `wizardTopology.ts` now follows the printed dictionary
order exactly:

- School has `Blank` at index 0, then Abjuration through Transmutation. This fixed
  the major visible bug: Abjuration previously rendered no school lines and every
  other school was shifted by one pattern.
- Area uses the full printed size notation, such as `sphere (20)`, not only a
  coarse shape.
- Range and duration use the book's non-alphabetical dictionary order.
- Values absent from the Wizard book intentionally render as the blank option. Do
  not invent an unsupported Wizard symbol.

Tests in `app/src/engines/rune.test.ts` protect the blank-school offset and sample
range/duration/area indices. If changing Wizard notation, compare visually against
the PDF dictionary pages before editing the lookup.

### Sorcerer - complete, do not casually alter

The Sorcerer seal uses user-provided/default glyph assets around the ring and the
Sorcerer center mark. It has source-matched glyph placement and flowing color
transitions. User explicitly rejected invented artwork. Default glyph assets live in
`app/public/glyphs/sorcerer/`.

The Sorcerer area renderer still needs an asset for `circle (80)` if Eruption is to
be shown source-faithfully. Do not substitute a different circle glyph.

### Warlock - in progress (decoded notation spec below)

The embedded source-PDF font was extracted, renamed `Warlock Font.ttf`, and is used
by the Warlock renderer. The aspect-word ENCODING in `warlock.ts` is correct (verified vs
compendium pp.30-32). The RENDERING needs work.

**Decoded Warlock notation system (Warlock_Spell_Compendium_v1_3.pdf pp.30-38):**
- Seal layers, outside→in (p38 Base Pattern): casting-time FRAME → outer rune ring (double
  circle, 6 sectors: Level, School, Area, Damage, Range, Duration top-clockwise) → inner ring
  (concentration/ritual) → 3 inward triangles → patron center.
- NUMBERS (p37): only **9 digit-runes (1-9), reused by magnitude** (n30 = the "3" rune).
  Multiplier `dM` = **a circle with M dots drawn AROUND the number rune**. Combined numbers
  **superimpose into one glyph** (e.g. 8h = n3+n5 overlaid; 24h = n20+n4; 10m = n4+n6;
  cube 5280 = d5×(n1000+n50+n6)).
- Encoding (p30-32) matches code: 150ft = d5×n30, feet vs miles aspects, etc.
- Casting time = outer FRAME (p33-34): Action=single circle; Reaction=ticked ring; Bonus
  Action=variant; 1 min=double circle; 10 min=double-circle variant; 1 hour=circle in a
  square; 8/12/24 hours=circle with rays (more=longer, 24h=sunburst).
- Concentration/Ritual = INNER ring (p35): Concentration=a single inner ring; Ritual=diagonal
  slash marks.

**DONE (Claude):** added the 3 base-pattern triangles; concentration→inner ring; ritual→
diagonal slashes; replaced the invented "scratch" casting-frame base with clean circles
(`WarlockView.tsx`, `.warlock-triangle`/`.warlock-concentration-ring` CSS). tsc clean, 88 tests.

**STILL TO DO (the big one): number rendering.** Currently `parseWarlockCode` splits `d5 n30`
into a separate `multiplier` part (drawn as the value 5 in a dotted circle) and a `number` part
(n30) side-by-side, and combined numbers render sequentially. Per the book it must be: the
NUMBER rune wrapped in a circle with M dots (one glyph), and multi-`n` SUPERIMPOSED. Use the 9
digit-runes (the 36 `n*.png` are redundant). This touches `warlock.ts` parseWarlockCode +
`WarlockView` renderSegmentCode. Also: firm up the double-ring band; confirm Bonus Action frame.

### Druid - paused for later visual review

The Druid system is procedural and follows the Druid book's line/circle/triangle/X
vocabulary. The user approved binary numbers on number-bearing staves, including the
current large-number approach. They may revisit spacing and symbols visually.

Current user-provided symbol vocabulary:

- Schools: Abjuration bar+circle; Conjuration circle+bar+triangle; Divination circle;
  Enchantment slash+bar; Evocation triangle+bar; Illusion circle+slash+X;
  Necromancy X+circle; Transmutation triangle+slash+circle.
- Damage: Acid circle+triangle; Bludgeoning circle; Cold X; Fire triangle+X;
  Force double-bar+double-slash; Lightning slash+X+slash; Necrotic X+circle;
  Piercing slash; Poison circle+X; Psychic circle+double-slash;
  Radiant circle+slash+circle; Slashing slash+double-slash+slash;
  Thunder slash+circle+slash; Special bar+double-bar+triangle+circle.
- Area: type glyph plus binary amount lines. Range has special symbols for Self,
  Sight, Special, Touch, and Unlimited, plus binary numeric representation.

Be aware `spokes.ts` has a legacy-looking `const v = -1` in `numberMarks`; it is
working but should be cleaned only with a focused test-backed refactor.

## Spell data audit - highest-priority substantive work

Read `docs/SPELL_DATA_AUDIT.md` before editing spell records.

`npm.cmd run audit:data` currently reports:

- 375 total spells.
- 33 `damage: None` candidates with explicit typed damage in their descriptions.
- 55 no-area candidates with radius/proximity language.
- One level-10 topology case: `Supermassive Black Hole`.
- One currently unsupported Sorcerer area notation: Eruption `circle (80)`.

Known corrected spell:

```json
{
  "id": "eruption",
  "school": "Evocation",
  "damage": "Fire",
  "areaShape": "Circle",
  "areaNotation": "circle (80)",
  "range": "1 mile",
  "duration": "10 minutes"
}
```

Eruption deals both Fire and Bludgeoning; the app presently supports one primary damage
attribute, so Fire was recorded as primary. A deliberate model decision is still needed
for spells with multiple damage types or multiple distinct areas.

Recommended audit workflow:

1. Select a candidate from `audit:data`.
2. Open its actual originating PDF/source text.
3. Verify level, school, primary damage, area, range, duration, casting time,
   components, ritual, concentration, classes, and source attribution together.
4. Patch only that spell's unique JSON object.
5. Add a regression test for meaningful fixes.
6. Run the audit, TypeScript check, and Vitest.

## Suggested next task

After the user visually verifies the recent Wizard update, begin the data audit with
the ScienceSpellbook records flagged as `damage: None`. This is the broadest remaining
source-fidelity risk and is more valuable than new renderer features.
