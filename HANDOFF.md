# GOD App — Handoff for the next session (Codex)

Read this first, then the persistent memory files (below) for deeper background. This doc
captures the IN-FLIGHT work and the immediate next tasks.

## Persistent memory (already written — load these for context)
`C:\Users\josep\.claude\projects\G--GOD-App\memory\`
- `MEMORY.md` — index
- `god-app-build-status.md` — full state: stack, what's done, caveats. **Start here.**
- `god-app-class-rune-looks.md` — how each class draws sigils + construction methodology
- `god-app-source-material.md` — the 10 source PDFs
- `god-app-no-ai-art.md` — **HARD RULE: no AI-generated art ships. All final art is the
  user's own human-made art.** Reformatting/processing the user's art is fine; generating
  or copying the author's art is not.

## What the app is
"The GOD App" — animated spell compendium. Each spell shown 3 ways at once: a written
**rune/sigil**, a **spoken name**, a **color spectrum**. Based on Thomas Wallace's books.
Stack: Vite + React + TS at `G:\GOD App\app`. Engines are pure TS in `app/src/engines/`.

## Run / verify
- Dev server: `cd "G:\GOD App\app"; npm run dev` → http://localhost:5173 (launch.json exists;
  preview_start name "god-app").
- Type-check: `npx tsc --noEmit -p tsconfig.app.json`
- Tests: `npx vitest run` (63 tests; keep them green).
- NOTE: the preview **screenshot tool timed out all of last session** — verify via
  `preview_eval` DOM inspection instead. The page itself is fine.

## What works now
- Three engines + up-cast stepper + cross-highlight (hover any stat/string/line/syllable →
  all three views light up). `App.tsx` has it.
- Two render modes via a toggle: **Wizard · chords** (`RuneView`/`rune.ts`) and
  **Sorcerer · seal** (`SealView`/`seal.ts`). Shared meaning layer = `engines/topology.ts`.
- **Glyph alphabet system** (`app/src/alphabet/`): users draw (`GlyphPad`) or upload
  (PNG/WebP/SVG) their own glyph per value; stored in localStorage (`glyphStore.ts`).
- **Default glyphs**: `defaults.ts` `loadDefaultGlyph()` fetches `/glyphs/<class>/<file>`,
  inlines SVG (tinted with ink) or uses <image> for raster. SealView resolves
  **user glyph → default file → procedural placeholder**.
  - GOTCHA: Vite dev server returns index.html (HTTP 200) for missing files, so the loader
    MUST check `content-type` (already fixed — don't regress).
- **Sorcerer default glyphs DONE**: 106 user-made SVGs were normalized (label stripped,
  uniform-scaled+centered to viewBox 0 0 100 100, NO stretching) and named to convention,
  written to BOTH `app/public/glyphs/sorcerer/` and `G:\GOD App\Sorcerer\`. Pipeline +
  mapping: `G:\GOD App\Sorcerer\_finalize.py`. Verified: Fireball seal shows 5/6 real
  glyphs; **Area falls back to placeholder** (see Task A).
  - Glyph file convention: `Sorcerer_<Attribute>_<Value>.svg`, value-slug drops `()'"`,
    spaces→`-` (e.g. `Sorcerer_Area_Sphere-20.svg`, `Sorcerer_Range_90-feet.svg`).
    Resolver: `defaults.ts` `defaultGlyphUrls()`/`valueSlug()`.
  - Do NOT delete temp files in `G:\GOD App\Sorcerer\` (user said leave them).

---

## TASK A — close the Area gap  ✅ DONE (Codex)
Codex threaded `areaValue={spell.areaSound}` → `titleAreaSound` into `SealView` so sized Area
glyphs resolve. Original note kept below for reference.

## TASK A (orig note) — close the Area gap so all 6 arcs show art
The seal feeds each arc the value from `topology.ts` (`spellTopology`), which for `area`
uses the COARSE shape (`attrs.area` = e.g. "Sphere"). But the glyphs are SIZED
(`Sorcerer_Area_Sphere-20.svg`). So `loadDefaultGlyph('sorcerer','area','Sphere')` 404s →
placeholder.
Interim fix: pass the sized area value to the seal segment so it resolves to the sized file.
The spell carries `areaSound` like `"sphere (20)"` (see `data/spells.ts` Spell type) — map
that to the value `"Sphere (20)"` whose slug is `Sphere-20`. Either thread `areaSound`
into `SealView`/`seal.ts`, or store a sized-area value on the segment. Keep Wizard mode
(coarse area) unchanged. Verify Fireball Area arc then shows the Sphere-20 glyph.

This is superseded by Task B for the long term, but is a fast visible win.

---

## TASK C — Sorcerer seal VISUAL FIDELITY  ✅ DONE (Claude)
Reworked `SealView.tsx` to match the book original (`crop_sorcerer.png`): render the centre
mandala (`Sorcerer_Center.svg` via new `loadGlyphByName` in `defaults.ts`); large radial glyph
wreath hugging the centre (glyphRadius `0.68·rOuter`, glyphSize `0.60·rOuter`, rotate `mid+90`,
centre `0.82·rOuter`); removed the ring circles / dividers / dropzone (original has none); faint
`.seal-missing` dot fallback instead of blank. Tuned offline vs the original
(`Sorcerer/_seal_final.png`). tsc clean, 66/66. Possible follow-ups: deeper-vs-lighter ink,
the original's center starburst (not in the user's Center.svg), conc/ritual encoding (book =
ink gradient). Original spec kept below for reference.

## TASK C (orig spec) — Sorcerer seal VISUAL FIDELITY
User: the seal design is wrong vs the book; fix it against the originals.
Reference: `Source PDFs/_img/class_samples/crop_sorcerer.png` + `crop_sorcerer2.png` (assembled
Fireball/Burning-Hands seals) and `sorc_dict_hi_p9..11.png`. Background is already correct
(parchment + violet ink `--sorcerer-ink #35105e`, `.seal-svg`). Compare current `SealView.tsx`
to the original and fix:
1. **Center mandala MISSING.** Render `Sorcerer_Center.svg` (the signature rosette) in the
   middle in violet ink, sized to the inner circle — replace the dashed
   `.seal-center-dropzone` placeholder. (Later: let the user override the center mark.)
2. **Ring structure REMOVED.** Restore the subtle outer+inner ring circles, the 6 sector
   **dividers**, and the **double-line START marker** at top (book: marks where reading
   begins). CSS still has `.seal-ring/.seal-divider/.seal-start`; the JSX was stripped — re-add,
   subtle/gold like the example.
3. **Glyph size/position/rotation OFF.** Current: radius `0.9*rOuter`, `gs=1.34*band`,
   `rotate(mid+90)`. Original: moderate, evenly-spaced glyphs sitting WITHIN the band, oriented
   base-inward, reading around the ring. Re-tune radius/size; verify rotation sign/offset vs the
   example (current looks too large / spilling / possibly mis-oriented).
4. **Missing-glyph fallback = blank.** Empty arcs currently render `null`. Don't leave blank —
   compose via numerals (Task B) for area, and meanwhile show a subtle placeholder.
5. **VERIFY visually.** Screenshot the running seal, compare side-by-side with
   `crop_sorcerer.png`; iterate until it reads as the same object (glyph ring + ornate center,
   balanced). Confirm hover hot/dim still reads on parchment. (Screenshot MCP tool was flaky —
   may need to free port 5173 / use a managed preview, or render via PyMuPDF.)

## PROGRESS LOG (recent)
- Variant→diphthong DONE: collisions weave a quiet diphthong onto the spoken name (`collisionVariants.ts` `diphthong`); all visible variant UI removed (sigil corner marks, name superscript, "Variant" chip, meta badge).
- Fonts: 3 new (`Blacksword`, `Cream Cake`, `Spell of Asia`) wired (@font-face) + added to `FONT_OPTIONS`; live switcher already existed (`--display-font`).
- Class↔notation UNIFIED: removed the wizard/sorcerer mode toggle; `mode` now derived from `classFilter` (`Sorcerer`→seal, else chords). List already filters by `classFilter`. So picking a class scopes the list AND the notation. (Could make the class selector more prominent as part of the picker redesign.)
- Compendium is one flat paper sheet (Codex): list → detail → back, element-by-element draw-on, `BG Paper.jpeg`. Sorcerer seal design finalized by user+Codex (leave it).
- 69 tests, tsc clean.

## TASK D — spell PICKER / compendium browser  ✅ DONE
List+filters+class-scoping + **glyph grid** done. `components/MiniSigil.tsx` = cheap static
thumbnail (wizard chords / sorcerer ring+ticks, memoized, no animation/async). List nav is now
`.sigil-grid` of `.sigil-cell`s with **`content-visibility: auto` + `contain-intrinsic-size`**
(native virtualization → scales to any spell count; only on-screen cells paint). Full animated
sigil still renders on the detail page. Per-cell draw-on stagger capped (`Math.min(i,16)`) so it
doesn't fight virtualization. Future extreme scale → swap to `react-window`.

## TASK D (orig) — spell PICKER / compendium browser  ⭐ HIGH (user feedback: dislikes current picker)
Current: 4 hardcoded spells in `data/spells.ts` shown as pill tabs (`.spell-tabs`). Replace with
a real browser backed by the generated `data/spells.json` (375 spells via `scripts/extract.mjs`):
- Wire `spells.json` as the data source (App imports it; keep the `Spell` type/`toAttributes`/
  `toSoundInput`).
- Searchable + filterable list: search by name; filter by class / level / school. Each row shows
  name + level + a color swatch (ideally a mini sigil). Selecting loads it into the 3-lens view;
  keep the up-cast stepper behavior.
- Confirm layout with the user (sidebar list vs modal search vs command palette).
(Supersedes the old "wire spells.json + compendium browser" bullet under Other pending.)

---

## TASK B — legend NUMBER SYSTEM  🔄 IN PROGRESS (Codex started `app/src/alphabet/numerals.ts`)
GOAL: stop needing a separate glyph per size. Keep only the **base shape per category** +
**numeral atoms**, and COMPOSE any number. Matches the book and fixes the value-model gap.

### The discovery (confirmed from the art — see `Sorcerer/_legend_big.png` and
`Sorcerer/_numeral_study.png`):
- A sized glyph = **base shape + a numeral placed in the shape's "number slot."**
- Sphere: base = circle + the two side strokes (constant); the NUMBER is the mark INSIDE
  the circle. Cone/Cube/Cylinder/Line: number sits at the shape's vertex/body.
- The numeral system is **ADDITIVE** using legend atoms. Proof: `Sphere-360` = the `300`
  bowl + the `60` peak stacked. `Sphere-30` = the `30` peak; `Sphere-100` = the `100` bowl.
- Legend atoms (`Sorcerer_legend.svg`, also book Sorcerer pp.8 / `_legend_big.png`):
  - units/tens: **5, 10, 15, 30, 40, 50, 60**
  - hundreds: **100, 200, 300, 500** (bowl + N strokes = N hundreds; 400 = 4 strokes, composable)
  - duration units (right col): **Day, Hour, Minute, Round**, and **"Up to"** (a prefix modifier)

### Open questions to CONFIRM WITH THE USER before building (don't guess the art):
1. Exact additive decomposition for values not directly in the atom set: **20, 90, 360…**
   - 20 = 15+5? or 10+10? (inspect `Sorcerer_Area_Sphere-20.svg` mark — looked like slash+hook)
   - 90 = 60+30? 50+40? — need the canonical rule.
2. Big numbers: **2500, 5280 (=1 mile in ft), 40000** (Cube sizes). The atom set tops out at
   500. Is there a thousands atom / multiplier, or are these bespoke? Likely rare — confirm.
3. Range uses feet vs miles (units) + distance; Duration uses number + unit + optional
   "Up to". Confirm the number slot/position per base.

### Assets needed (decision point — ask user):
The numeral atoms are currently BAKED INTO each sized glyph; clean extraction is unreliable.
Two options:
- (preferred) User exports clean **base-shape** glyphs (no number) + each **numeral atom**
  as its own SVG (they have Illustrator + the source). Then we just place/stack them.
- OR extract atoms by cropping `Sorcerer_legend.svg` (it contains all atoms at known
  positions) + derive base shapes from the simplest sized glyph per shape.

### Implementation sketch
1. New module `app/src/alphabet/numerals.ts`:
   - `decompose(n: number): Atom[]` — greedy additive over the atom set (hundreds then tens/units).
   - atom → glyph asset path (e.g. `/glyphs/sorcerer/num/Sorcerer_Num_300.svg`).
2. New default-glyph naming for composables, e.g.:
   - bases: `Sorcerer_Area_Sphere.svg` (no size), `Sorcerer_Area_Cone.svg`, …
   - numerals: `Sorcerer_Num_5.svg`, `_10`, `_15`, `_30`, `_40`, `_50`, `_60`, `_100`,
     `_200`, `_300`, `_500`; modifier `Sorcerer_Mod_Up-to.svg`; units already exist
     (Minute/Hour/Day/Round as duration bases).
   - Each base defines a **number anchor** (x,y,scale within the 0..100 box) where the
     composed numeral is placed/stacked. Could be a small JSON/TS map per base.
3. `seal.ts` / `SealView`: for area/range/duration, compose = render base glyph + stacked
   numeral atoms at the anchor (all inlined SVG, tinted with ink). For level/school/damage,
   keep the single per-value glyph (no number).
4. Value model: store area as **shape + size** (and range as distance+unit, duration as
   number+unit+upto) rather than enumerating every sized value in `FEATURES`. This replaces
   the "value-model gap" caveat in build-status.

### Keep these guarantees
- Uniform scaling only (never stretch). Composition places atoms; don't distort them.
- No-AI-art rule: bases + atoms must be the user's own art (extracted/exported), not generated.

---

## Other pending work (lower priority; see build-status memory)
- (spell picker / compendium browser → promoted to **TASK D** above)
- Druid render mode (ogham spokes — algorithmic, like Wizard; no art needed).
- Warlock render mode (4-aspect runes; the alphabet is an embedded font `Untitled1`).
- Kokoro local neural TTS for the "speak" button (user chose Kokoro), driven by the syllable
  engine for accurate pronunciation of the constructed names.
- Per-class glyph keys: user glyph store key is class-agnostic (`attr:value`); should become
  `class:attr:value` to match per-class defaults.

## Tools available in this env
- Python 3.14 with `PyMuPDF` (fitz), `PIL`, `svgelements` (installed last session). `pip` works.
- Use these for SVG bbox / rendering contact sheets (see `Sorcerer/_finalize.py`,
  `_numeral_study` rendering pattern).
