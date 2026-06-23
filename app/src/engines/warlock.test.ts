import { describe, expect, it } from 'vitest';
import { buildWarlockSigil, castingFrameFor, parseWarlockCode, WARLOCK_ORDER } from './warlock';
import type { SpellAttributes } from './attributes';

const BASE: SpellAttributes = {
  level: 3,
  school: 'Conjuration',
  damage: 'None',
  area: 'None',
  areaNotation: 'None',
  range: '60 feet',
  duration: 'Up to 1 hour',
  concentration: true,
  ritual: false,
};

describe('Warlock sigil', () => {
  it('uses the compendium reading order', () => {
    expect(WARLOCK_ORDER).toEqual(['level', 'school', 'area', 'damage', 'range', 'duration']);
    expect(buildWarlockSigil(BASE).segments.map((s) => s.key)).toEqual(WARLOCK_ORDER);
  });

  it('maps fixed aspect strings from the Warlock compendium table', () => {
    const sigil = buildWarlockSigil(BASE);
    expect(sigil.segments.find((s) => s.key === 'level')?.code).toBe('DjfF');
    expect(sigil.segments.find((s) => s.key === 'school')?.code).toBe('dhaF');
    expect(sigil.segments.find((s) => s.key === 'range')?.code).toBe('aF d2 n30');
    expect(sigil.segments.find((s) => s.key === 'duration')?.code).toBe('FHa n1');
    expect(sigil.segments.find((s) => s.key === 'range')?.parts).toEqual([
      { kind: 'aspect', text: 'aF' },
      { kind: 'multiplier', value: 2 },
      { kind: 'number', value: 30 },
    ]);
  });

  it('uses fine area notation for sized area codes', () => {
    const sigil = buildWarlockSigil({ ...BASE, area: 'Sphere', areaNotation: 'sphere (20)' });
    expect(sigil.segments.find((s) => s.key === 'area')?.code).toBe('Hc d2 n10');
  });

  it('resolves scaling durations and ranges from caster level without changing token format', () => {
    const sigil = buildWarlockSigil({
      ...BASE,
      range: 'Medium (100 ft. + 10 ft./level)',
      duration: '1 min./level (D)',
      casterLevel: 7,
    });

    expect(sigil.segments.find((s) => s.key === 'range')).toMatchObject({
      value: '170 feet',
      code: 'aF n100 n70',
    });
    expect(sigil.segments.find((s) => s.key === 'duration')).toMatchObject({
      value: '7 minutes',
      code: 'hEE n7',
    });
  });

  it('keeps exact book-listed warlock encodings when the lookup already knows the value', () => {
    const sigil = buildWarlockSigil({ ...BASE, range: '60 feet', duration: 'Up to 1 hour', casterLevel: 7 });
    expect(sigil.segments.find((s) => s.key === 'range')?.code).toBe('aF d2 n30');
    expect(sigil.segments.find((s) => s.key === 'duration')?.code).toBe('FHa n1');
  });

  it('parses source formula parts into renderable code pieces', () => {
    expect(parseWarlockCode('AH d5 n1000 n50 n6')).toEqual([
      { kind: 'aspect', text: 'AH' },
      { kind: 'multiplier', value: 5 },
      { kind: 'number', value: 1000 },
      { kind: 'number', value: 50 },
      { kind: 'number', value: 6 },
    ]);
  });

  it('chooses source-style casting frame categories', () => {
    expect(castingFrameFor('1 Reaction, which you take when you see')).toBe('reaction');
    expect(castingFrameFor('1 Bonus Action')).toBe('bonus-action');
    expect(castingFrameFor('10 Minutes')).toBe('10-minute');
    expect(castingFrameFor('1 Hour')).toBe('1-hour');
    expect(castingFrameFor('24 Hours')).toBe('24-hours');
  });
});
