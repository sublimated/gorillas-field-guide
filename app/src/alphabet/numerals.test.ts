import { describe, expect, it } from 'vitest';
import { decomposeNumber, glyphAreaNotation, parseNumberedGlyphValue, titleAreaNotation } from './numerals';

describe('sorcerer numeral composition', () => {
  it('decomposes additive legend values', () => {
    expect(decomposeNumber(20)).toEqual([15, 5]);
    expect(decomposeNumber(90)).toEqual([60, 30]);
    expect(decomposeNumber(150)).toEqual([100, 50]);
    expect(decomposeNumber(360)).toEqual([300, 60]);
  });

  it('parses numbered area, range, and duration values', () => {
    expect(parseNumberedGlyphValue('area', 'Sphere (20)')).toEqual({
      kind: 'area',
      shape: 'Sphere',
      number: 20,
    });
    expect(parseNumberedGlyphValue('range', '150 feet')).toEqual({
      kind: 'range',
      unit: 'feet',
      number: 150,
    });
    expect(parseNumberedGlyphValue('duration', 'Up to 10 minutes')).toEqual({
      kind: 'duration',
      unit: 'minutes',
      number: 10,
      upTo: true,
    });
  });

  it('normalizes extracted area sound casing for glyph identity', () => {
    expect(titleAreaNotation('sphere (20)')).toBe('Sphere (20)');
    expect(glyphAreaNotation('emanation (30)')).toBe('Sphere (30)');
    expect(glyphAreaNotation('wall (12)')).toBe('Wall (12)');
  });
});
