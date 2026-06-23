# Spell Data Audit

## Active

- [ ] Reconcile every spell record against its originating source before treating
  extracted attributes as authoritative. Audit level, school, damage, area,
  range, duration, casting time, components, ritual, concentration, classes,
  and source attribution.
- [ ] Review semantic-audit candidates emitted by `npm run audit:data`.
- [ ] Define how a spell with multiple damage types or multiple distinct area
  zones is represented in the single-primary-attribute notation model.
- [ ] Audit the 33 records currently marked `damage: None` despite containing
  explicit typed damage in their descriptions. Start with the ScienceSpellbook
  candidates because they account for the largest visible notation failures.
- [ ] Audit the 55 records marked with no area that contain radius/proximity
  language. Treat these as review candidates, not automatic corrections.
- [ ] Resolve the level-10 topology case (`Supermassive Black Hole`) and decide
  whether the app supports a tenth spell level as a first-class attribute.
- [ ] Add support/assets for valid dynamic area notation such as `circle (80)`;
  this is now required by Eruption.

## Fixed

- [x] `Eruption` was extracted as `damage: None` despite dealing Fire and
  Bludgeoning damage. It now uses Fire as the primary damage type.
- [x] `Eruption` was extracted with no area despite five 40-foot-radius circular
  blast zones. It now records `areaShape: Circle` and `areaNotation: circle (80)`.

## Audit Rule

Automated checks are triage only. A source PDF remains the final authority for
every correction; do not infer a mechanical attribute from spell names alone.
