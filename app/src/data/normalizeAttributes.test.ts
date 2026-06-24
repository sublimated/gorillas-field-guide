import { describe, expect, it } from 'vitest';
import {
  formatResolvedFormula,
  hasScalingAttributeValue,
  normalizeAreaNotation,
  normalizeAreaShape,
  normalizeDuration,
  normalizeRange,
  parseDurationFormula,
  parseRangeFormula,
  resolveAreaNotation,
  resolveDuration,
  resolveRange,
} from './normalizeAttributes';

describe('normalizeAttributes', () => {
  it('keeps the original safe format normalization', () => {
    expect(normalizeRange('30 ft.')).toBe('30 feet');
    expect(normalizeRange('Personal; see text')).toBe('Self');
    expect(normalizeDuration('Concentration, up to 1 minute')).toBe('Up to 1 minute');
    expect(normalizeDuration('Permanent')).toBe('Until dispelled');
  });

  it('resolves range phrasings that mean Touch or Self rather than a literal distance', () => {
    expect(normalizeRange('One willing creature touched')).toBe('Touch');
    expect(normalizeRange('A creature touched')).toBe('Touch');
    expect(normalizeRange('0 ft.')).toBe('Self');
    expect(normalizeRange('0 ft.; see text')).toBe('Self');
    expect(normalizeRange('Medium')).toBe('120 feet');
    expect(normalizeRange('Medium (100 + 10 ft./level)')).toBe('120 feet');
  });

  it('parses and resolves scaling ranges', () => {
    const close = parseRangeFormula('Close (25 ft. + 5 ft./2 levels)');
    const medium = parseRangeFormula('Medium (100 ft. + 10 ft./level)');

    expect(close).toMatchObject({ base: 25, perLevel: 5, perLevelDivisor: 2, unit: 'feet' });
    expect(medium).toMatchObject({ base: 100, perLevel: 10, perLevelDivisor: 1, unit: 'feet' });
    expect(resolveRange('Medium (100 ft. + 10 ft./level)', 7)).toBe('170 feet');
  });

  it('parses and resolves scaling durations', () => {
    const minute = parseDurationFormula('1 min./level (D)');
    const oneDay = parseDurationFormula('One day/level');

    expect(minute).toMatchObject({ perLevel: 1, unit: 'minutes', upTo: false });
    expect(oneDay).toMatchObject({ perLevel: 1, unit: 'days', upTo: false });
    expect(resolveDuration('1 min./level (D)', 7)).toBe('7 minutes');
    expect(formatResolvedFormula(oneDay!, 3)).toBe('3 days');
  });

  it('detects scaling terms and can resolve canonical area notation', () => {
    expect(hasScalingAttributeValue('1 round/level')).toBe(true);
    expect(hasScalingAttributeValue('60 feet')).toBe(false);
    expect(resolveAreaNotation('sphere (20)', 7, 'Sphere')).toBe('sphere (20)');
  });

  it('interprets the agreed area families', () => {
    expect(normalizeAreaNotation('Ray', 1, 'Ray')).toBe('Line');
    expect(normalizeAreaNotation('Cone-shaped burst', 1, 'None')).toBe('Cone');
    expect(normalizeAreaNotation('20-ft.-radius emanation', 1, 'Emanation')).toBe('emanation (20)');
    expect(normalizeAreaNotation('One missile of acid', 1, 'None')).toBe('Single target');
    expect(normalizeAreaNotation('One or more creatures, no two of which can be more than 30 ft. apart', 1, 'None')).toBe('Multiple targets');
    expect(normalizeAreaNotation('Wall 4 ft./level wide, 2 ft./level high', 3, 'Wall')).toBe('wall (12)');
  });

  it('normalizes coarse area shapes for engine lookup', () => {
    expect(normalizeAreaShape('Emanation', '20-ft.-radius emanation')).toBe('Sphere');
    expect(normalizeAreaShape('Ray', 'Ray')).toBe('Line');
    expect(normalizeAreaShape('None', 'One missile of acid')).toBe('Single target');
    expect(normalizeAreaShape('Wall', 'Wall 4 ft./level wide, 2 ft./level high')).toBe('Wall');
  });
});
