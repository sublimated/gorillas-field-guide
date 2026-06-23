# Needs Notation / Structure

Spells render in one of four systems (Wizard chords, Sorcerer seal, Druid spokes, Warlock arc).
Classes **without** their own system (Cleric, Bard, Paladin, Ranger, and the psionic classes —
Psion, Psychic Warrior, Wilder, Lurk, Ardent, Divine Mind) currently **default to the Wizard
system**. Building dedicated systems for those classes is future work.

This file lists attribute **values** that have no glyph / sigil / underlying mathematic structure
in the engines yet. They are intentionally left to render with the fallback (the blank / index-0
option) until their notation is designed — they are **not** coerced into a different value.

Counts are post-normalization (what actually reaches the renderer), measured across the full
3,049-record dataset. Damage and area are fully covered (0 gaps).

## School — 359 records (the main gap)
The six psionic disciplines are not in `engines/attributes.ts` `FEATURES.school`, so psionic
spells render with the school slot blank (index 0). Needs: a school glyph + a place in the math
structure for each (or a deliberate mapping decision).

| value | records |
|---|---|
| Psychometabolism | 96 |
| Telepathy | 71 |
| Clairsentience | 56 |
| Psychokinesis | 53 |
| Psychoportation | 47 |
| Metacreativity | 36 |

**Not a gap:** `Universal` (5 records) is school-less by design — it carries no school glyph and
appears under **every** school filter for the classes it applies to (handled in the school filter).

## Range — 45 records
Mostly supplemental-3.5 residue; several are normalization gaps that could be folded into
`data/normalizeAttributes.ts` rather than new slots:
- `0 feet` (27) — likely should normalize to Self/Touch
- `Medium` (12) — bare band, should resolve to 120 feet like `Medium (100 ft. + 10 ft./level)`
- `180 feet` (2) — no FEATURES slot
- one-offs: `One willing creature touched`, `Medium (100 + 10 ft./level)`, `80 feet`, `30-ft.-radius emanation`

## Duration — 80 records
Supplemental-3.5 variants + a few malformed extractions. Some are normalization-fixable; a few
small fixed durations would need FEATURES slots:
- fixed durations with no slot: `3 rounds` (10), `2 rounds`, `4 rounds`, `6 rounds`, `10 rounds`, `1d4/1d6 rounds`, `1 day` (4), `4 hours`, `1 year`
- malformed / truncated extractions: `Concentration, up to` (23), `+ 1 round/`, `+1 round/`, `10`, `1`, `Concentration (up to`, `Performance +1 hour or`, `+ 5 rounds,`
- phrase durations: `See spell text`, `Until triggered`, `Until discharged`, `Until expended or 10 minutes/level`, `Up to 20 minutes`, `Up to 12 hours`

## Notes
- The malformed/truncated range & duration values (e.g. `Concentration, up to`, `Close (25 ft. +`)
  point at extraction truncation in the supplemental-3.5 import — fixing the importer or adding
  normalization rules would clear most of the residue cheaply.
- Per-value glyph art (when designed) must be the user's own art (no AI), per the project rule.
