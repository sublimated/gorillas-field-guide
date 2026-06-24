# Orders for Codex — Spell Compendium (3.5) description extraction

## Background

`npm run audit:data` doesn't currently catch this, but a direct scan does: **900 of the
902 "Spell Compendium (3.5)" records in `app/src/data/spells.json` have a fully generic,
content-free `description`** — the literal pattern is:

```
A <school> spell recorded in the 3.5 Spell Compendium. Its listed range is <range> and
duration is <duration>.
```

That's a templated stub, not a real description — it tells the reader nothing about what
the spell actually does. This was confirmed by hand on `Acid Storm`: the stub said nothing,
but the real book entry (extracted below) is a full spell with flavor text, a damage
formula, and a material component. The other mechanical fields (level/school/damage/
range/area/duration) were already correct — only `description` (and, where present,
`atHigherLevels`-equivalent text) is missing.

This is the single biggest content gap in the dataset. Your job is to fix it properly,
spell by spell, from the actual source book — not to rewrite the stub sentence.

## Source material

- PDF: `Source PDFs/Spell Compendium (Premium Edition).pdf` (290 pages).
- **Chapter 1 "Spell Descriptions"** = the real alphabetical entries you need. Runs from
  page 6 (`Acid Breath`) to page 244 (`Xorn Movement`), 0-indexed pages **5 through 243**
  in PyMuPDF (`fitz`). Confirmed boundary: page 244 starts with "CHAPTER 1 SPELL
  DESCRIPTIONS" (still in-chapter), page 245/246 switches to "CHAPTER 2 SPELL LISTS".
- **Chapter 2 "Spell Lists" (pages ~245–289)** is a by-class quick-reference index with
  one-line blurbs per spell (e.g. "Acid Storm: Deals 1d6/level acid damage... in a 20-ft.
  radius."). **Do not use this as the description source** — it's the same kind of
  one-liner as the stub we're replacing, just shorter. It's useful only as a cross-check
  that you've found the right spell (the blurb should match the real entry's effect).
- **Page 5 has a "Renamed Spells" table.** Several spells were renamed when included in
  this book (e.g. "Aganazzar's scorcher" → "scorch"). If a spell name in `spells.json`
  doesn't have an exact hit in Chapter 1, check this table — the book may file it under a
  different name than the one we have on record. Read this table once and keep it as a
  lookup; don't skip a spell just because the literal name search came up empty.

## Per-spell entry format (book convention, observed directly)

```
ACID STORM
Conjuration (Creation) [Acid]
Level: Sorcerer/wizard 6
Components: V, S, M
Casting Time: 1 standard action
Range: Medium (100 ft. + 10 ft./level)
Area: Cylinder (20-ft. radius, 20 ft. high)
Duration: Instantaneous
Saving Throw: Reflex half
Spell Resistance: No

A dark green cloud whirls into being before unleashing a shower of foul-smelling,
yellow-green rain.

Acid rain deals 1d6 points of acid damage per caster level (maximum 15d6) to each
creature in the area.

Material Component: A flask of acid (10 gp).
```

The stat block (Level/Components/Casting Time/Range/Area or Target/Duration/Saving
Throw/Spell Resistance) is **not what you're extracting** — we already have that data and
it's already verified correct (cross-checked Acid Storm's stat block against our existing
`spells.json` record field-for-field; it matched exactly). What you need is everything
**after** the stat block: the flavor-text paragraph, the mechanical effect paragraph(s),
and the trailing Material Component/Focus/XP Cost lines if present. Concatenate that into
one clean `description` string the same way the rest of `spells.json` is formatted (no
literal "Material Component:" line breaks needed — see how existing good records read,
e.g. any SRD 5.x entry, for the target prose style; plain sentences, no markdown).

If the entry has a separate scaling note (rare in 3.5 format, more of a 5e convention),
there's no `atHigherLevels` equivalent to worry about here — 3.5 scaling is baked into the
main description via "per caster level" phrasing, not a separate paragraph. Don't invent
an `atHigherLevels` field for these records.

## What to change, and what NOT to touch

- **Only touch `description`** on `Spell Compendium (3.5)` records (`source` field exactly
  `"Spell Compendium (3.5)"`, ids ending `-spellcompendium35`). Do not modify
  level/school/damage/area/range/duration/classes/etc. unless you find a genuine,
  source-verified error while you're in there — and if you do, fix that one record by its
  unique `id`, log it, don't touch siblings.
- Per the project's standing rule: **do not bulk-patch `spells.json` by field** — every
  edit must be targeted by the spell's unique `id`. You're touching ~900 ids; that's fine,
  it's still one targeted field per id, not a blanket find/replace.
- **Source PDF is authority.** If a spell's name search comes up empty even after checking
  the Renamed Spells table, don't guess or invent a description from the name alone — log
  it as unresolved and move on. We'll deal with stragglers in a follow-up pass.
- Don't touch any other source's records (`D&D 3.5 SRD Psionics`, `Complete Mage (3.5)`,
  `Dragon Magic (3.5)` have the same stub problem but are out of scope for this pass — they
  need their own source-PDF pass each, separately).
- No AI-invented or paraphrased-from-vibes text. Every description must trace to the actual
  PDF text for that spell. If you summarize/condense the book's wording, keep it
  mechanically complete (damage dice, save type, area, duration-affecting clauses) — don't
  drop content for brevity.

## Suggested approach

1. Extract Chapter 1 (pages 5–243, 0-indexed) once with PyMuPDF, split into per-spell
   chunks. The book prints each spell name in caps on its own line as the entry header —
   use that as your split point, but watch for two-column page layout artifacts (a spell's
   text can get interleaved with the next column if you naively read top-to-bottom; verify
   a sample of chunks visually before trusting the splitter on all 900).
2. Build a name→id map from `spells.json` (`Spell Compendium (3.5)` records only),
   normalizing case/punctuation, and apply the Renamed Spells table as a fallback alias.
3. For each matched spell, isolate the text after the stat block (after "Spell
   Resistance:" or "Saving Throw:" line, whichever appears last) through to the next
   spell's header, strip trailing page furniture/footers, and write that into
   `description`.
4. Track and report: how many of the 900 matched cleanly, how many needed the rename
   table, and how many you couldn't confidently match (list their ids/names — don't force
   a bad match).
5. Spot-check at least 15–20 extracted descriptions against the PDF by hand (open the
   actual page) before treating the batch as done — text-layout extraction from a
   two-column book is exactly the kind of thing that silently merges or truncates a spell
   here and there (we already found three unrelated truncation bugs elsewhere in this
   dataset this session — Longstrider, Diminish Plants, Plant Growth — so treat that
   failure mode as expected, not exceptional).

## Verification before you call this done

```powershell
cd "G:\GOD App\app"
npx.cmd tsc --noEmit -p tsconfig.app.json
npx.cmd vitest run
npm.cmd run lint
npm.cmd run audit:data
npm.cmd run build
```

All must be clean. Then report back: count fixed, count unresolved (with ids), and any
spell where you found a genuine mechanical-field error while reading the real entry
(separately listed, not silently changed).
