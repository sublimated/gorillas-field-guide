# The GOD App — Design & Specification

*A fun, colorful, animated spell compendium that shows every spell three ways: **written** (rune), **said** (spoken name), and **seen** (color & spectrum).*

Working draft v0.1 — 2026-06-16. Based on the ten Source PDFs by **Thomas Wallace, "The Gorilla of Destiny" (G.o.D)**.

---

## 1. Vision

A single spell can be expressed three different ways in the Gorilla of Destiny's world, and almost nobody has ever seen all three *together and alive*. The GOD App is that place:

- You browse a beautiful spellbook.
- You open a spell, and it **comes to life** — its rune draws itself stroke by stroke, its spectrum glows in the spell's true color, and its arcane spoken name appears (and can be heard).
- Later, you can step into the **Spell Forge** and conjure your *own* spells — choose the attributes, and the app generates a brand-new rune, name, and spectrum that obey the same rules.

**Confirmed decisions (from kickoff):**
| Decision | Choice |
|---|---|
| Core experience | **Both** — animated compendium first, Spell Forge second |
| Engine depth | **Generative** — implement the real algorithms, works for any spell incl. homebrew |
| Platforms | **All three** — one codebase → web + installable mobile (PWA) + desktop (Tauri) |
| Aesthetic | **Living Spellbook** — warm parchment/tome, ink-drawn animated runes, gilded edges; opening into a darker "casting" view for the glowing spectrum |
| Immediate next step | This spec, for review before code |

---

## 2. Source material → app features

| Source PDF | What it gives the app |
|---|---|
| **Theory of Magic** | The rune-writing algorithm (polygon + binary `k`-layers). Powers the **Rune engine**. |
| **Spell Writing Dictionary** | Every SRD spell's attributes (Level, School, Damage, Area, Range) + `k` values — seed **data**. |
| **Spell Saying Guide** | Attribute→sound tables + grammar + full pronunciation dictionary. Powers the **Sound engine**. |
| **Arcane Spectroscopy** | Attribute→color/spectrum mapping + luminosity rules. Powers the **Spectrum engine**. |
| **The Science Spellbook** | ~99 original physics-themed spells (full stat blocks) — **content**. |
| **Wizard / Sorcerer / Druid / Warlock compendiums** | The "all three together" per-spell format (spoken name + rune + stat block + colored banner) — **content + the canonical combined layout to emulate**. |

---

## 3. The three engines (core IP)

All three derive everything from a spell's **attributes**, so they work for known *and* homebrew spells. Each engine is a pure function: `attributes → representation`. They live in a shared, framework-agnostic TypeScript core (`/packages/engines`) so web, mobile, and desktop reuse them, and so they're unit-testable in isolation.

### 3.1 Rune engine (Writing)

From *Theory of Magic*. A spell becomes a symbol drawn on the vertices of a regular polygon.

**Algorithm:**
1. **Attributes & layers.** Each attribute is drawn as its own layer, identified by a step value `k`. The compendiums use **six** attributes — Level, School, Damage Type, Area, Range, Duration — so we default to that set. (The earlier Theory/Dictionary used five; the engine treats the attribute list as configurable.)
2. **Polygon size `n`.** `n = max(2·(#attributes)+1, smallest n whose count of cyclically-unique binaries ≥ the largest attribute's feature count)`, forced **odd**. For the 6-attribute set, **n = 13** (yields 352 unique symbols — ample). Vertices are placed evenly on a circle, indexed `0…n-1`, starting at the top.
3. **Feature → binary.** For each attribute, find the feature's index in its ordered feature set, then pick that index from the precomputed, sorted list of **cyclically-unique binary numbers** of length `n`.
4. **Draw layer.** For every bit `i` that is `1`, draw a connector from vertex `i` to vertex `(i + k) mod n`.
5. **Overlay** all layers into one symbol.
6. **Markers.** Concentration → a dot at the center; ritual → a dot **and** a ring.
7. **Line styles (personalization, later).** Straight (default), centered-circle arcs, non-centered arcs, or alternate bases (constellation/curve) — the "handwriting" feature. Style never changes meaning, only looks.

**Cyclically-unique binaries** are generated once per `n`: enumerate `0…2ⁿ-1`, group numbers that are rotations of each other, keep the canonical (lexicographically smallest) representative, sort. (`00…0` and `11…1` have no rotational partners and are included.)

**Animation:** each connector is an SVG path animated with `stroke-dashoffset` so the rune "writes itself," layer by layer, in ink.

> ⚠️ **Validation risk:** the rune *images* in the PDFs aren't machine-readable, so the exact `k`-assignment per attribute and the author's precise binary ordering can't be 100% confirmed from text alone. Our engine will faithfully implement the *documented* algorithm; matching the books' exact glyphs may need a visual pass against the PDF figures. Tracked in §8.

### 3.2 Sound engine (Saying)

From *Spell Saying Guide*. Concatenate one sound per attribute into the spoken name.

- **Tables:** Level, School, Damage Type, Area Type, Range, Duration each map a value → a syllable (e.g. Level 3 → `L`, Evocation → `U`, Fire → `Ire`, 90 ft → `Ylar`).
- **Order:** `Level · School · DamageType · "-" · AreaType · Range · Duration`.
- **Grammar rules:**
  - No damage type → use a glottal break `'` instead of a damage syllable.
  - No area type → `'` in the area slot.
  - If **both** damage and area are "None" → drop the `'-'` join and fuse the two halves.
  - Up-casting → prepend the new level's sound, or fuse with an `i` to avoid ambiguity.
- **Worked example:** Acid Arrow (L2 `H`, Evocation `U`, Acid `Cid`, area None `'`, range 90 ft `Ylar`, instantaneous = blank) → `H+U+Cid` `-` `'+Ylar` → **"Hucid-'ylar."** ✓ (matches the guide)
- **Audio:** v1 shows the phonetic name with a syllable breakdown; a "speak" button uses the Web Speech API (TTS) as a first pass. Hand-tuned phoneme audio is a later enhancement.
- **Known collisions** (e.g. Bane/Bless/Hideous Laughter all → `Sousinse`) are surfaced honestly as "shared names," per the author's own notes.

### 3.3 Spectrum engine (Seeing)

From *Arcane Spectroscopy*. Each spell gets a color and an emission spectrum.

- **Per attribute:** order its feature set (numeric for Level, alphabetical otherwise), take the feature's index `v` and the max index `m = len-1`, compute `x = v / m ∈ [0,1]`.
- **Color of that line:** `f(x) = gist_rainbow(1 − x)` → RGB (we'll bundle the `gist_rainbow` colormap as a lookup).
- **Brightness:** `h' = h₀ · exp( −(x − L/9)² / (2σ²) )`, with `σ = 1`, `L` = spell level. Lines near the spell's level shine brightest.
- **Spectrum render:** a dark band with one bright vertical line per attribute, at position `x`, in its color, at its brightness — like a real emission spectrum.
- **Overall spell color** (used for the banner/glow): the color at the level position by default (design choice, tunable).
- **Luminosity / glow halo:** `L ∝ (energy / range)`, where energy grows ~exponentially with level. We normalize this to a glow intensity: high-level, short-range spells glow hardest. Used to drive the bloom on the casting view.

### 3.4 Up-casting (a cross-cutting feature)

A spell can be **cast at a slot higher than its base level**. We model a `castLevel` distinct from the spell's base `level`; when `castLevel > level` the spell is up-cast. Every representation responds, because all three are functions of attributes and level:

- **Rune.** The level layer (k=1) redraws to the `castLevel`'s symbol. Default presentation: the rune shows the level it's *cast at*, with a small up-cast indicator (e.g. the base-level layer drawn faintly beneath, or a marker noting `base→cast`). A toggle can show base vs. cast.
- **Spoken name.** Uses the guide's documented up-cast grammar: prepend the new level's sound, **or** fuse the two level sounds with an `i` between them (the disambiguating form). e.g. a 3rd-level spell up-cast to 5th: `T` (5) + `i` + `L` (3) + rest. Both forms offered; the fused form is default to avoid collisions.
- **Spectrum.** The brightness Gaussian re-centers on `castLevel/9` and the luminosity glow grows — an up-cast spell visibly burns brighter and its spectral emphasis shifts up the band.
- **Stat block.** The spell's `atHigherLevels` text is shown, and where the scaling is simple (e.g. "+1d6 per slot above 3rd") we compute and display the resulting dice/effect at the chosen `castLevel`.

UI: a **slot / cast-level stepper** on the casting view (and in the Forge) from the spell's base level up to 9. Cantrips are a special case — they scale by character level, not slot, so they get a character-level stepper at the documented breakpoints (5/11/17) instead.

---

## 4. Data model

```ts
type Spell = {
  id: string;
  name: string;
  source: 'SRD' | 'ScienceSpellbook' | 'Homebrew';
  level: number;            // 0–9 (0 = cantrip / "0th")
  school: School;
  castingTime: string;
  range: string;            // canonical range bucket, e.g. "120 feet"
  components: { v: boolean; s: boolean; m?: string };
  duration: string;         // canonical duration bucket
  concentration: boolean;
  ritual: boolean;
  areaType: AreaType;       // canonical area bucket
  damageTypes: DamageType[]; // [] for non-damage spells
  classes: ClassName[];     // wizard, sorcerer, druid, warlock, ...
  description: string;
  atHigherLevels?: string;
  art?: { illustration?: string; artist?: string; license?: string }; // optional human-made art; empty → procedural fallback (§8)
  // derived (computed by engines, cached): rune paths, spoken name, spectrum
};
```

Engines are the single source of truth for rune/name/spectrum; precomputed values from the PDFs (e.g. published spoken names) are kept only as **validation fixtures** to test the engines against.

---

## 5. Data extraction plan

Most fields are parseable from the already-extracted text (`Source PDFs/_extracted/*.txt`):

1. **Attributes** ← *Spell Writing Dictionary* (clean, regular `Level/School/Damage/Area/Range` blocks).
2. **Spoken names** ← *Spell Saying Guide* dictionary (validation fixtures for the Sound engine).
3. **Full stat blocks + descriptions** ← class compendiums (regular `Spoken Name / ATTRIBUTES / SPELL DESCRIPTION / AT HIGHER LEVELS` blocks).
4. **Science spells (99)** ← *The Science Spellbook* (regular stat blocks).
5. **Class lists** ← each compendium's contents + the "Spell List" lines in the Science Spellbook.

Output: a single normalized `spells.json` (+ per-attribute enums and the sound/colormap tables). A small Node script does the parsing so it's repeatable when sources update. Canonicalization (mapping the many area/range strings to the dictionary's buckets) is the fiddly part and gets its own reviewed mapping table.

---

## 6. Experience & screens

**Living Spellbook aesthetic:** warm parchment, deep leather, gold leaf, hand-inked type. The *compendium* feels like a physical tome; opening a spell flips into a darker **casting view** where the rune is inked in glowing light and the spectrum blooms in color.

1. **Cover / Home** — the closed tome; tap to open. Quick search.
2. **Compendium (browse)** — searchable, filterable index (by class, level, school, damage, even by *color*). Each row shows the spell name + a small inked rune + its color swatch.
3. **Spell detail / Casting view** — the centerpiece:
   - Rune draws itself (SVG ink animation).
   - Spectrum band lights up; the page tints with the spell's color; glow scaled by luminosity.
   - Spoken name with syllable breakdown + "speak" button.
   - Full stat block + description, styled as grimoire text.
   - **Cast-level stepper** (up-casting, §3.4): drag the slot up and watch the rune redraw, the name shift, the spectrum brighten, and the "At Higher Levels" effects recompute live.
   - A "three lenses" toggle to focus on Rune / Sound / Spectrum.
4. **Spell Forge / Sandbox (phase 5)** — the procedural creation mode. Because the three engines are pure functions of attributes, the Forge simply binds controls to them and renders live:
   - **Procedural build-up.** Set each attribute (level, school, damage, area, range, duration, concentration/ritual, cast level) via dials/dropdowns; each choice adds or redraws *its own rune layer*, names a syllable, and lights a spectral line — the spell assembles before your eyes, layer by layer, mirroring the system's structure.
   - **Live everything.** Rune + spoken name + spectrum + signature color update on every change, including up-casting.
   - **Two depths:** *quick* (attributes only — instant rune/name/spectrum for any combination, even ones no published spell uses) and *full homebrew* (also author the stat block: name, casting time, components, description, At Higher Levels, class list) → a complete custom spell.
   - **Surprise me.** A procedural generator rolls a *coherent* random spell (sensible attribute combos) and can suggest a flavor name — instant inspiration.
   - **Save / export / share.** Persist creations locally (and into the compendium as `source: Homebrew`); export the rune as SVG/PNG and a shareable spell card. Import/export homebrew as JSON.
   - **Decode mode (stretch):** the inverse — given a rune (or its attributes), read back the spell. Teaches the notation and enables "reading" runes drawn by others.
5. **Reference / Legend** — the teaching hub, with three illustrated "how to read" guides plus the raw tables:
   - **How to read a spectrum** (the spectroscopy guide, detailed below) — the one the user specifically wants.
   - **How to read a rune** — the dictionary breakdown: blank template, the symbol for every Area/Damage/School/Level/Duration/Range value, the concentration dot and ritual ring, and a worked "decode this rune" walkthrough.
   - **How to say a spell** — the syllable tables and the grammar rules (breaks, separators, up-cast fusion), with worked examples.
   - The bundled lookup tables (sounds, color map) for reference.

### 6.6 The Explain layer (contextual help)

Esoteric ideas are explained *in place*, not buried in a manual, so a curious newcomer is never lost:

- **Info affordances.** A small ⓘ / dotted-underline marker sits next to esoteric terms and UI elements (e.g. *cyclically-unique binary*, *k-value*, *emission line*, *luminosity*, *concentration dot*, *ritual ring*, *up-cast fusion*, *cantrip vs. slot*). Tap/hover/focus opens a **short, plain-English popover** (1–3 sentences), with an optional "more →" link into the relevant Reference guide.
- **One glossary, reused everywhere.** All popover copy lives in a single `glossary` map (term → short text + optional deep-link). A reusable `<Explain term="…">` component renders the marker + popover, so the casting view, the Forge, and the spectrum all draw from the same source and stay consistent.
- **Two registers.** Each entry has a one-line *plain* explanation and an optional *in-character* (Gorilla-of-Destiny voice) flavor line; a global **"lore ⇄ plain"** toggle picks which shows by default. Honors the author's mix of real-science-in-italics vs. in-universe writing.
- **Accessible & unobtrusive.** Keyboard-reachable, dismissible (Esc/outside-click), never blocks the flow, respects `prefers-reduced-motion`. Popovers are progressive enhancement — the app is fully usable with them ignored.

### 6.7 Spectroscopy reading guide (detailed)

A dedicated, illustrated page (and the source for the spectrum's inline popovers) teaching how to read a spell's light, framed in the in-universe "arcane spectrometer" voice with the real science alongside:

- **Each vertical line = one attribute** of the spell (level, school, damage, area, range, duration).
- **Left → right position = the attribute's value**, rescaled to 0–1 (numeric for level, alphabetical otherwise) — the low-energy (red) end to the high-energy (violet) end.
- **Color = that position**, via the `gist_rainbow` map (the line literally *is* the color of its position). A labeled color ramp with the red↔violet ends anchors it.
- **Brightness of a line = how close that attribute sits to the spell's level** (the level-centered Gaussian): lines near the level burn brightest, distant ones dim.
- **Overall glow / luminosity = energy ÷ range** — high-level, short-range spells glow hardest; high-range spells are faint. (Energy rises ~exponentially with level.)
- **Reading it back.** From the line positions you can recover the attribute values and thus identify the spell (within accuracy) — the inverse of casting. An interactive "hover a line → see which attribute & value it is", and a small **read-the-spectrum quiz/puzzle** to practice.
- **In-universe flavor.** The spectrometer, crystal monocle, and "stained spectacles" (color filters) from *Arcane Spectroscopy*, with the real diffraction/emission-spectrum science called out (italicized, per the author's convention).

**Animation principles:** ink-draw for runes, spectral bloom for color, gentle page-turn transitions, parallax on the tome. Respect `prefers-reduced-motion`.

---

## 7. Tech stack & cross-platform strategy

**One codebase, three deliveries.**

- **Core:** TypeScript. Engines in a pure, dependency-free package (`/packages/engines`) with unit tests.
- **UI:** React + Vite. SVG for runes (animatable, crisp at any size, exportable). Canvas/SVG for spectra. Framer Motion + CSS for animation. Lightweight state (Zustand or context). Data shipped as static JSON (offline-first).
- **Responsive** layout handles phone ↔ tablet ↔ desktop.
- **Web:** deploy the Vite build (static host).
- **Mobile:** installable **PWA** (`vite-plugin-pwa`, offline cache). Optional Capacitor wrap later if app-store presence is wanted.
- **Desktop:** **Tauri** (tiny, fast, native webview) wrapping the same build → real Windows/Mac/Linux app. (Electron is the heavier fallback.)

Rationale: SVG + a pure engine core means the "wow" visuals and the math are portable everywhere with zero per-platform rewrites; PWA + Tauri cover mobile and desktop without a second codebase.

---

## 8. Art & asset layer (pluggable, human-made)

**Principle: the final artwork is the user's own, original, human-made art. No AI-generated art ships in the product.** The architecture is built so this is easy and incremental.

- **Procedural-first identity.** The look is carried by the *generated* visuals (runes, spectra, signature colors) plus typographic/gilded styling (CSS, fonts, borders). The app is complete and attractive with **zero illustrations** — art is purely additive, never load-bearing.
- **Art is data, not code.** An **asset manifest** maps logical *art slots* → asset files, each with `artist` + `license` metadata. Every slot has a graceful fallback to the procedural/typographic default, so an empty slot is invisible and any one piece of original art can be dropped in 1:1 without code changes.
- **Art slots (reserved now, filled later):** app cover / tome; per-spell illustration; school sigils/heralds; class emblems; page textures, borders, dividers, gilded frames; damage-type / area / component icons; share-card frames & backs; spectrometer & reading-guide illustrations; app icon / favicon. Optional ink/paper *textures* applied over procedural strokes (texture = art, geometry = procedural — they layer, never conflict).
- **Formats & discipline.** SVG preferred (themeable, crisp, animatable); raster (PNG/WebP, @1x/@2x) for paintings. Each slot has a fixed aspect/safe-area so assets swap cleanly. Original art carries attribution shown on the Credits screen (mirroring how the source PDFs credit their artists).
- **Homebrew art.** The Forge lets users attach their *own* illustration to a custom spell (local upload) — same slot system.
- **Placeholders during development are non-AI and temporary:** procedural/geometric/typographic placeholders (or clearly-marked, properly-licensed stock with attribution), each designed to be replaced 1:1 by final original art. They never become permanent and are tracked so none slips into release.

---

## 9. Risks & open questions

- **Rune fidelity (highest):** exact glyphs in the PDFs are images. Plan: implement the documented algorithm; do a visual diff against a sample of compendium runes; adjust `k`-order/binary-ordering until they match, or accept a faithful-but-not-identical variant (still rules-correct).
- **Attribute ordering inconsistency:** the Dictionary swaps Area/Range `k` between damage vs non-damage spells; compendiums add Duration as a 6th layer. Decision: standardize on the **6-attribute compendium scheme** app-wide; document the canonical order.
- **Area/Range/Duration granularity:** the Saying Guide enumerates many specific sizes (e.g. `cube (2500)`), while the rune Dictionary uses coarser buckets. Need one canonical enum per attribute, with a mapping table.
- **Multi-damage spells** (e.g. Prismatic Spray): how to show multiple damage layers in one rune and multiple lines in the spectrum — define a rule (draw/sum each).
- **Audio quality:** TTS first; decide later whether hand-crafted phoneme audio is worth it.
- **v1 content scope:** SRD spells + the 99 science spells is the natural full set; could ship a smaller first batch. (To decide at build time.)

---

## 10. Roadmap

1. **Proof-of-life prototype** ✅ — one spell, all three engines rendering + animating on one page. Done; spoken names verified against the guide.
2. **Engines hardened** — unit tests against PDF fixtures (spoken names especially); cyclically-unique-binary generator; colormap; **up-casting** across all three engines (§3.4); rune visual-diff pass.
3. **Data pipeline** — parse the PDFs → `spells.json` with canonical enums.
4. **Compendium browser + Explain layer** — search, filter, the full Living-Spellbook library + casting view (incl. cast-level stepper); the `<Explain>` glossary popovers (§6.6) and the three "how to read" guides — including the **spectroscopy reading guide** (§6.7).
5. **Spell Forge / Sandbox** — procedural creation mode: layer-by-layer build-up, up-casting, quick + full-homebrew depths, "surprise me", save/export/share. (Decode mode = stretch.)
6. **Package & ship** — PWA (mobile) + Tauri (desktop) + web deploy.
7. **Original artwork integration** *(ongoing, parallel track)* — fill the §8 art slots with the user's own human-made art over time; replace any temporary placeholders; wire homebrew art upload; Credits screen lists artists. Not gated on the other phases — slots accept art whenever it's ready.

---

## 11. Legal & attribution

All spell content derives from **SRD 5.1 / 5.2.1** (Wizards of the Coast), licensed **CC-BY-4.0** — attribution required. The systems are by **The Gorilla of Destiny**; per his stated terms we must **credit him** ("The Gorilla of Destiny" / @gorillaofdestiny), make clear the app is **our own work, not affiliated with or endorsed by him**, and that it is **substantially different** from his documents. An in-app Credits/License screen will carry SRD attribution, the CC-BY link, and Gorilla of Destiny credit. *(If this app is to be public/commercial, confirm intent with him directly — his contact is in the PDFs.)*
