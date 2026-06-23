import { describe, it, expect } from 'vitest';
import { spokenName } from './sound';
import type { SoundInput } from './sound';

// Ground-truth fixtures taken verbatim from "The Spell Saying Guide" PDF dictionary.
// These are the canonical answers the engine must match exactly.
const FIXTURES: Array<{ spell: string; input: SoundInput; expected: string }> = [
  // ── Both damage AND area present ──────────────────────────────────────────
  {
    spell: 'Fireball',
    input: { level: 3, school: 'Evocation', damage: 'Fire', areaNotation: 'sphere (20)', range: '150 feet', duration: 'Instantaneous' },
    expected: 'Luire-Sonosin',
  },
  {
    spell: 'Lightning Bolt',
    input: { level: 3, school: 'Evocation', damage: 'Lightning', areaNotation: 'line (100)', range: 'Self', duration: 'Instantaneous' },
    expected: 'Lunin-Lopor',
  },
  {
    spell: 'Burning Hands',
    input: { level: 1, school: 'Evocation', damage: 'Fire', areaNotation: 'cone (15)', range: 'Self', duration: 'Instantaneous' },
    expected: 'Suire-Nupor',
  },
  {
    spell: 'Cone Of Cold',
    input: { level: 5, school: 'Evocation', damage: 'Cold', areaNotation: 'cone (60)', range: 'Self', duration: 'Instantaneous' },
    expected: 'Tulod-Nopor',
  },
  {
    spell: 'Ice Storm',
    input: { level: 4, school: 'Evocation', damage: 'Bludgeoning', areaNotation: 'cylinder (20)', range: '300 feet', duration: 'Instantaneous' },
    expected: 'Vudeg-Xésphin',
  },

  // ── Area is None (glottal break, keep the '-') ────────────────────────────
  {
    spell: 'Acid Arrow',
    input: { level: 2, school: 'Evocation', damage: 'Acid', areaNotation: 'None', range: '90 feet', duration: 'Instantaneous' },
    expected: "Hucid-'ylar",
  },
  {
    spell: 'Eldritch Blast',
    input: { level: 0, school: 'Evocation', damage: 'Force', areaNotation: 'None', range: '120 feet', duration: 'Instantaneous' },
    expected: "Cuton-'mul",
  },
  {
    spell: 'Magic Missile',
    input: { level: 1, school: 'Evocation', damage: 'Force', areaNotation: 'None', range: '120 feet', duration: 'Instantaneous' },
    expected: "Suton-'mul",
  },
  {
    spell: 'Shocking Grasp',
    input: { level: 0, school: 'Evocation', damage: 'Lightning', areaNotation: 'None', range: 'Touch', duration: 'Instantaneous' },
    expected: "Cunin-'lix",
  },
  {
    spell: 'Fire Bolt',
    input: { level: 0, school: 'Evocation', damage: 'Fire', areaNotation: 'None', range: '120 feet', duration: 'Instantaneous' },
    expected: "Cuire-'mul",
  },
  {
    spell: 'Ray Of Frost',
    input: { level: 0, school: 'Evocation', damage: 'Cold', areaNotation: 'None', range: '60 feet', duration: 'Instantaneous' },
    expected: "Culod-'wyn",
  },
  {
    spell: 'Sacred Flame',
    input: { level: 0, school: 'Evocation', damage: 'Radiant', areaNotation: 'None', range: '60 feet', duration: 'Instantaneous' },
    expected: "Cunat-'wyn",
  },
  {
    spell: 'Hellish Rebuke',
    input: { level: 1, school: 'Evocation', damage: 'Fire', areaNotation: 'None', range: '60 feet', duration: 'Instantaneous' },
    expected: "Suire-'wyn",
  },
  {
    spell: 'Harm',
    input: { level: 6, school: 'Necromancy', damage: 'Necrotic', areaNotation: 'None', range: '60 feet', duration: 'Instantaneous' },
    expected: "Rourho-'wyn",
  },
  {
    spell: 'Inflict Wounds',
    input: { level: 1, school: 'Necromancy', damage: 'Necrotic', areaNotation: 'None', range: 'Touch', duration: 'Instantaneous' },
    expected: "Sourho-'lix",
  },

  // ── Both damage AND area are None (fused — drop the '-') ─────────────────
  {
    spell: 'Cure Wounds',
    input: { level: 1, school: 'Evocation', damage: 'None', areaNotation: 'None', range: 'Touch', duration: 'Instantaneous' },
    expected: 'Sulix',
  },
  {
    spell: 'Aid',
    input: { level: 2, school: 'Abjuration', damage: 'None', areaNotation: 'None', range: '30 feet', duration: '8 hours' },
    expected: 'Hausiniy',
  },
  {
    spell: 'Guidance',
    input: { level: 0, school: 'Divination', damage: 'None', areaNotation: 'None', range: 'Touch', duration: 'Up to 1 minute' },
    expected: 'Cilixse',
  },
  {
    spell: 'Counterspell',
    input: { level: 3, school: 'Abjuration', damage: 'None', areaNotation: 'None', range: '60 feet', duration: 'Instantaneous' },
    expected: 'Lawyn',
  },
  {
    spell: 'Dispel Magic',
    input: { level: 3, school: 'Abjuration', damage: 'None', areaNotation: 'None', range: '120 feet', duration: 'Instantaneous' },
    expected: 'Lamul',
  },
];

describe('spokenName — PDF fixtures', () => {
  for (const { spell, input, expected } of FIXTURES) {
    it(`${spell} → "${expected}"`, () => {
      expect(spokenName(input).name).toBe(expected);
    });
  }
});

describe('spokenName — up-cast grammar', () => {
  it('Fireball L3 at slot 5: fuses T+i prefix → Tiluire-Sonosin', () => {
    const name = spokenName({
      level: 3,
      castLevel: 5,
      school: 'Evocation',
      damage: 'Fire',
      areaNotation: 'sphere (20)',
      range: '150 feet',
      duration: 'Instantaneous',
    }).name;
    expect(name).toBe('Tiluire-Sonosin');
  });

  it('Cure Wounds L1 at slot 3: fuses L+i into fused form → Lisulix', () => {
    const name = spokenName({
      level: 1,
      castLevel: 3,
      school: 'Evocation',
      damage: 'None',
      areaNotation: 'None',
      range: 'Touch',
      duration: 'Instantaneous',
    }).name;
    expect(name).toBe('Lisulix');
  });

  it('castLevel === level: no upcast prefix applied', () => {
    const name = spokenName({
      level: 3,
      castLevel: 3,
      school: 'Evocation',
      damage: 'Fire',
      areaNotation: 'sphere (20)',
      range: '150 feet',
      duration: 'Instantaneous',
    }).name;
    expect(name).toBe('Luire-Sonosin');
  });

  it('upcast parts array includes an Up-cast card first', () => {
    const { parts } = spokenName({
      level: 3,
      castLevel: 5,
      school: 'Evocation',
      damage: 'Fire',
      areaNotation: 'sphere (20)',
      range: '150 feet',
      duration: 'Instantaneous',
    });
    expect(parts[0].label).toBe('Up-cast');
    expect(parts[0].syllable).toBe('Ti');
    expect(parts[1].label).toBe('Level');
  });
});

describe('spokenName — parts structure', () => {
  it('base spell has 6 parts (no upcast card)', () => {
    const { parts } = spokenName({
      level: 3,
      school: 'Evocation',
      damage: 'Fire',
      areaNotation: 'sphere (20)',
      range: '150 feet',
      duration: 'Instantaneous',
    });
    expect(parts).toHaveLength(6);
  });

  it('upcast spell has 7 parts (upcast card + 6 base)', () => {
    const { parts } = spokenName({
      level: 3,
      castLevel: 5,
      school: 'Evocation',
      damage: 'Fire',
      areaNotation: 'sphere (20)',
      range: '150 feet',
      duration: 'Instantaneous',
    });
    expect(parts).toHaveLength(7);
  });

  it('Instantaneous duration renders as — in parts', () => {
    const { parts } = spokenName({
      level: 1,
      school: 'Evocation',
      damage: 'None',
      areaNotation: 'None',
      range: 'Touch',
      duration: 'Instantaneous',
    });
    const dur = parts.find((p) => p.label === 'Duration')!;
    expect(dur.syllable).toBe('—');
  });
});
