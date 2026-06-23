import { describe, it, expect } from 'vitest';
import { buildRune, RUNE_N } from './rune';
import { ATTRIBUTE_ORDER } from './attributes';
import { WIZARD_K_VALUES, wizardFeatureIndex } from './wizardTopology';
import type { SpellAttributes } from './attributes';

const FIREBALL: SpellAttributes = {
  level: 3, school: 'Evocation', damage: 'Fire',
  area: 'Sphere', range: '150 feet', duration: 'Instantaneous',
  concentration: false, ritual: false,
};

const CONC_SPELL: SpellAttributes = {
  ...FIREBALL, concentration: true, ritual: false,
};

const RITUAL_SPELL: SpellAttributes = {
  ...FIREBALL, concentration: false, ritual: true,
};

describe('RUNE_N', () => {
  it('equals 13 (the compendium polygon size)', () => {
    expect(RUNE_N).toBe(13);
  });
});

describe('buildRune()', () => {
  it('returns a rune with n = RUNE_N vertices', () => {
    const rune = buildRune(FIREBALL);
    expect(rune.n).toBe(RUNE_N);
    expect(rune.vertices).toHaveLength(RUNE_N);
  });

  it('every chord connects two of the n vertices', () => {
    const rune = buildRune(FIREBALL);
    for (const chord of rune.chords) {
      expect(chord.from).toBeGreaterThanOrEqual(0);
      expect(chord.from).toBeLessThan(RUNE_N);
      expect(chord.to).toBeGreaterThanOrEqual(0);
      expect(chord.to).toBeLessThan(RUNE_N);
    }
  });

  it('each chord "to" is exactly k steps from "from" (mod n)', () => {
    const rune = buildRune(FIREBALL);
    for (const chord of rune.chords) {
      const k = WIZARD_K_VALUES[chord.key];
      expect(chord.to).toBe((chord.from + k) % RUNE_N);
    }
  });

  it('chord keys are a subset of the 6 known attributes', () => {
    const rune = buildRune(FIREBALL);
    const validKeys = new Set(ATTRIBUTE_ORDER);
    for (const chord of rune.chords) {
      expect(validKeys.has(chord.key)).toBe(true);
    }
  });

  it('chord colors are valid rgb(…) strings', () => {
    const rune = buildRune(FIREBALL);
    for (const chord of rune.chords) {
      expect(chord.color).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    }
  });

  it('concentration flag is propagated', () => {
    expect(buildRune(CONC_SPELL).concentration).toBe(true);
    expect(buildRune(FIREBALL).concentration).toBe(false);
  });

  it('ritual flag is propagated', () => {
    expect(buildRune(RITUAL_SPELL).ritual).toBe(true);
    expect(buildRune(FIREBALL).ritual).toBe(false);
  });

  it('different level attrs produce different chord sets', () => {
    const rune3 = buildRune(FIREBALL);
    const rune5 = buildRune({ ...FIREBALL, level: 5 });
    const chords3 = rune3.chords.filter((c) => c.key === 'level').map((c) => c.from);
    const chords5 = rune5.chords.filter((c) => c.key === 'level').map((c) => c.from);
    // level 3 and level 5 have different binary representations → different chord sets
    expect(chords3).not.toEqual(chords5);
  });

  it('uses the book\'s blank school entry before the eight schools', () => {
    expect(wizardFeatureIndex('school', FIREBALL)).toBe(5); // Evocation
    expect(wizardFeatureIndex('school', { ...FIREBALL, school: 'Abjuration' })).toBe(1);
  });

  it('uses the book\'s printed range, duration, and full area ordering', () => {
    expect(wizardFeatureIndex('range', FIREBALL)).toBe(5); // 150 feet
    expect(wizardFeatureIndex('duration', FIREBALL)).toBe(0); // Instantaneous
    expect(wizardFeatureIndex('area', { ...FIREBALL, areaNotation: 'sphere (20)' })).toBe(30);
  });

  it('center is at (size/2, size/2) by default (size=400)', () => {
    const rune = buildRune(FIREBALL);
    expect(rune.center).toEqual({ x: 200, y: 200 });
  });

  it('radius fits within the requested size minus padding', () => {
    const rune = buildRune(FIREBALL, { size: 400, padding: 28 });
    expect(rune.radius).toBe(400 / 2 - 28);
  });

  it('vertices lie on the circle (distance from center ≈ radius)', () => {
    const rune = buildRune(FIREBALL);
    for (const v of rune.vertices) {
      const d = Math.hypot(v.x - rune.center.x, v.y - rune.center.y);
      expect(d).toBeCloseTo(rune.radius, 5);
    }
  });
});
