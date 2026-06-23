import { describe, expect, it } from 'vitest';
import { resolveAttrColor, customColorFor, type CustomColors } from './colorModes';

const custom: CustomColors = {
  all: '#111111',
  perAttr: { school: '#ff0000' },
};

describe('customColorFor', () => {
  it('uses the per-attribute pick when present', () => {
    expect(customColorFor('school', custom)).toBe('#ff0000');
  });
  it('falls back to the global pick when the attribute is not customised', () => {
    expect(customColorFor('level', custom)).toBe('#111111');
  });
});

describe('resolveAttrColor', () => {
  const classInk = 'var(--ink)';
  const spectrumColor = 'rgb(10, 20, 30)';

  it('normal mode returns the per-class ink', () => {
    expect(resolveAttrColor('school', 'normal', custom, classInk, spectrumColor)).toBe(classInk);
  });
  it('spectroscopy mode returns the element spectrum colour', () => {
    expect(resolveAttrColor('school', 'spectroscopy', custom, classInk, spectrumColor)).toBe(spectrumColor);
  });
  it('custom mode returns the per-attribute pick, else the global pick', () => {
    expect(resolveAttrColor('school', 'custom', custom, classInk, spectrumColor)).toBe('#ff0000');
    expect(resolveAttrColor('damage', 'custom', custom, classInk, spectrumColor)).toBe('#111111');
  });
});
