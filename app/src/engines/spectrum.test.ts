import { describe, it, expect } from 'vitest';
import { spectrum, spellColor, luminosity, visibleSpectrum, colorFor } from './spectrum';
import { ATTRIBUTE_ORDER } from './attributes';
import type { SpellAttributes } from './attributes';

const FIREBALL: SpellAttributes = {
  level: 3, school: 'Evocation', damage: 'Fire',
  area: 'Sphere', range: '150 feet', duration: 'Instantaneous',
  concentration: false, ritual: false,
};

describe('spectrum()', () => {
  it('returns one line per attribute (6 for the standard set)', () => {
    expect(spectrum(FIREBALL)).toHaveLength(ATTRIBUTE_ORDER.length);
  });

  it('lines are keyed to the correct attributes in order', () => {
    const lines = spectrum(FIREBALL);
    expect(lines.map((l) => l.key)).toEqual(ATTRIBUTE_ORDER);
  });

  it('all x values are in [0, 1]', () => {
    for (const line of spectrum(FIREBALL)) {
      expect(line.x).toBeGreaterThanOrEqual(0);
      expect(line.x).toBeLessThanOrEqual(1);
    }
  });

  it('all brightness values are in (0, 1]', () => {
    for (const line of spectrum(FIREBALL)) {
      expect(line.brightness).toBeGreaterThan(0);
      expect(line.brightness).toBeLessThanOrEqual(1);
    }
  });

  it('level line has the highest brightness (Gaussian peaks at its own position)', () => {
    const lines = spectrum(FIREBALL);
    const levelLine = lines.find((l) => l.key === 'level')!;
    for (const l of lines) {
      expect(levelLine.brightness).toBeGreaterThanOrEqual(l.brightness);
    }
  });

  it('color matches visibleSpectrum(x) for each line', () => {
    for (const line of spectrum(FIREBALL)) {
      const expected = visibleSpectrum(line.x);
      expect(line.color).toEqual(expected);
    }
  });
});

describe('spellColor()', () => {
  it('returns an [R, G, B] tuple', () => {
    const c = spellColor(FIREBALL);
    expect(c).toHaveLength(3);
    c.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(255); });
  });

  it('higher-level spells get a different color than lower-level ones', () => {
    const high: SpellAttributes = { ...FIREBALL, level: 9 };
    const low: SpellAttributes = { ...FIREBALL, level: 1 };
    expect(spellColor(high)).not.toEqual(spellColor(low));
  });
});

describe('luminosity()', () => {
  it('returns a value in [0, 1]', () => {
    const lum = luminosity(FIREBALL);
    expect(lum).toBeGreaterThanOrEqual(0);
    expect(lum).toBeLessThanOrEqual(1);
  });

  it('short-range, high-level spell glows harder than long-range, low-level', () => {
    const powerhouse: SpellAttributes = { ...FIREBALL, level: 9, range: 'Touch' };
    const wisp: SpellAttributes = { ...FIREBALL, level: 1, range: '500 feet' };
    expect(luminosity(powerhouse)).toBeGreaterThan(luminosity(wisp));
  });
});

describe('visibleSpectrum()', () => {
  it('clamps t < 0 to the red end', () => {
    expect(visibleSpectrum(-1)).toEqual(visibleSpectrum(0));
  });

  it('clamps t > 1 to the violet end', () => {
    expect(visibleSpectrum(2)).toEqual(visibleSpectrum(1));
  });

  it('returns an [R, G, B] triple with values in 0..255', () => {
    const [r, g, b] = visibleSpectrum(0.5);
    [r, g, b].forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    });
  });

  it('t=0 is red-dominant and t=1 is violet (blue+red present, low green)', () => {
    const red = visibleSpectrum(0);
    const violet = visibleSpectrum(1);
    expect(red[0]).toBeGreaterThan(red[1]);
    expect(red[0]).toBeGreaterThan(red[2]);
    expect(violet[2]).toBeGreaterThan(violet[1]);
  });
});

describe('colorFor()', () => {
  it('level 0 (x=0/9=0) → visibleSpectrum(0), the red end', () => {
    expect(colorFor('level', '0')).toEqual(visibleSpectrum(0));
  });

  it('level 9 (x=9/9=1) → visibleSpectrum(1), the violet end', () => {
    expect(colorFor('level', '9')).toEqual(visibleSpectrum(1));
  });
});
