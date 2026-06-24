# Spell Data Audit

## Active

- [ ] Reconcile every spell record against its originating source before treating
  extracted attributes as authoritative. Audit level, school, damage, area,
  range, duration, casting time, components, ritual, concentration, classes,
  and source attribution.
- [ ] Review semantic-audit candidates emitted by `npm run audit:data`.
- [ ] Define how a spell with multiple damage types or multiple distinct area
  zones is represented in the single-primary-attribute notation model.
- [ ] A second pass of `damage: None`/no-area review candidates remains, lower
  confidence than the batch already fixed (see Fixed below) — e.g. Sunbeam,
  Starry Wisp, Branding Smite, Shining Smite, Fire Shield, Flame Blade, Fire
  Trap, Spike Growth, Sonic Boom, Turbulent Gas, Supersonic Omnidirectional Jet,
  Burst Radiation, Freezing Sphere. Each needs its own description read before
  a shape/size or damage correction — do not bulk-apply the same regex twice.
- [ ] Resolve the level-10 topology case (`Supermassive Black Hole`) and decide
  whether the app supports a tenth spell level as a first-class attribute.
- [ ] Add support/assets for valid dynamic area notation such as `circle (80)`;
  this is now required by Eruption.

## Fixed

- [x] `Eruption` was extracted as `damage: None` despite dealing Fire and
  Bludgeoning damage. It now uses Fire as the primary damage type.
- [x] `Eruption` was extracted with no area despite five 40-foot-radius circular
  blast zones. It now records `areaShape: Circle` and `areaNotation: circle (80)`.
- [x] 32 spells were `damage: None` despite their own description explicitly naming
  a single damage type (e.g. Acid Arrow, Black Tentacles). Each was checked
  individually against its description text and corrected to that type.
- [x] `Refraction` (ScienceSpellbook) had absorbed the next spell's text
  (`Resonant Shatter`) due to an extraction merge bug, which had also dropped
  Resonant Shatter from the dataset entirely. Trimmed Refraction's description
  back to its own spell and added the missing Resonant Shatter record, verified
  against `Source PDFs/_extracted/The_Science_Spellbook_V1.3.txt`.
- [x] 9 D&D 3.5 SRD spells (Shocking Grasp, Call Lightning, Lightning Bolt, Call
  Lightning Storm, Chain Lightning, Shatter, Sound Burst, Shout, Shout Greater)
  were `damage: None` because the importer's damage-type regex only recognized
  modern 5e wording — these used 3.5 terminology ("electricity damage", "sonic
  damage") that maps to Lightning/Thunder. Model decision: spells using a
  player-choice-of-damage-type mechanic (Chromatic Orb, Sorcerous Burst,
  Dragon's Breath, Conjure Minor Elementals, Conjure Elemental) now record the
  first-listed option as their primary damage type, same policy as Eruption.
  Animate Objects records Bludgeoning, its stated default slam-attack damage.
- [x] `Storm of Vengeance` (D&D 3.5 SRD) had a truncated description cut off
  mid-spell, dropping its actual damage-dealing rounds (2nd: Acid, 3rd: 10d6
  Lightning, 4th: Bludgeoning). Restored the full text from the cached
  `tmp/d20srd/stormOfVengeance.htm` source and set `damage: Lightning` as
  primary (the spell's headline effect).
- [x] The SRD 5.1/5.2 importer's area-shape regex only recognized
  `Cone|Cube|Cylinder|Emanation|Line|Sphere` immediately following a foot/radius
  phrase — it omitted `Circle` and `Square` entirely, and couldn't match phrasing
  like "20-foot-radius, 40-foot-high Cylinder" where a second dimension clause
  sits between the size and the shape word. Fixed 36 records across both
  editions (Ice Storm, Flame Strike, Moonbeam, Magic Circle, Reverse Gravity,
  Conjure Celestial, Sleet Storm, Call Lightning → Cylinder; Flaming Sphere,
  Sunburst → Sphere; Entangle, Grease, Black Tentacles → Square; Teleportation
  Circle, Earthquake → Circle; Control Water, Guards and Wards, Wall of Thorns,
  Wall of Ice, Move Earth → Wall, matching the `Wall` tagging already used for
  these same spells' Wizard Compendium / 3.5 SRD versions). Also fixed a
  radius/height transposition in `sleet-storm-srd51`'s description (it read
  "20-foot-tall, 40-foot radius"; the correct text, confirmed against the SRD
  5.2 version already in this dataset, is "40-foot-tall, 20-foot radius").

## Audit Rule

Automated checks are triage only. A source PDF remains the final authority for
every correction; do not infer a mechanical attribute from spell names alone.
