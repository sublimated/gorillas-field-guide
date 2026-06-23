import { describe, expect, it } from 'vitest';
import { warlockNumberTokens, warlockNumberValue } from './warlockNumber';

const glyphs = import.meta.glob('../../public/glyphs/warlock/n*.png');
const glyphNames = new Set(
  Object.keys(glyphs).map((key) => key.slice(key.lastIndexOf('/') + 1)),
);

describe('warlockNumberTokens', () => {
  it('decomposes place values into existing n-glyph tokens', () => {
    const samples = new Map<number, string[]>([
      [0, []],
      [7, ['n7']],
      [24, ['n20', 'n4']],
      [150, ['n100', 'n50']],
      [1200, ['n1000', 'n200']],
      [5280, ['n5000', 'n200', 'n80']],
      [9999, ['n9000', 'n900', 'n90', 'n9']],
    ]);

    for (const [value, expected] of samples) {
      const tokens = warlockNumberTokens(value);
      expect(tokens).toEqual(expected);
      expect(warlockNumberValue(tokens)).toBe(value);
      for (const token of tokens) {
        expect(glyphNames.has(`${token}.png`)).toBe(true);
      }
    }
  });

  it('rejects negative or non-integer quantities', () => {
    expect(() => warlockNumberTokens(-1)).toThrow();
    expect(() => warlockNumberTokens(1.5)).toThrow();
  });
});
