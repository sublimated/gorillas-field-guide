// Spectrum engine, per "Arcane Spectroscopy".
// Each attribute maps to a position x in [0,1]; its colour is gist_rainbow(1 - x).
// Brightness of each spectral line falls off with distance from the spell's level.

import {
  ATTRIBUTE_ORDER,
  featureFraction,
  type AttributeKey,
  type SpellAttributes,
} from './attributes';
import { GIST_RAINBOW } from './gistRainbow';

export type RGB = [number, number, number];

export function gistRainbow(t: number): RGB {
  const c = Math.max(0, Math.min(1, t));
  return GIST_RAINBOW[Math.round(c * 255)];
}

export function rgbCss([r, g, b]: RGB, a = 1): string {
  return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
}

// f(x) from the paper: invert so x=0 is the low-energy (red) end.
export function colorFor(key: AttributeKey, value: string): RGB {
  return gistRainbow(1 - featureFraction(key, value));
}

export type SpectralLine = {
  key: AttributeKey;
  x: number; // 0..1 position along the band
  color: RGB;
  brightness: number; // 0..1
};

const SIGMA = 1;

export function spectrum(attrs: SpellAttributes): SpectralLine[] {
  const levelPos = attrs.level / 9;
  return ATTRIBUTE_ORDER.map((key) => {
    const value = key === 'level' ? String(attrs.level) : attrs[key];
    const x = featureFraction(key, value);
    const brightness = Math.exp(-((x - levelPos) ** 2) / (2 * SIGMA * SIGMA));
    return { key, x, color: gistRainbow(1 - x), brightness };
  });
}

// The spell's signature colour: the colour at its level position.
export function spellColor(attrs: SpellAttributes): RGB {
  return gistRainbow(1 - attrs.level / 9);
}

function rangeToFeet(range: string): number {
  if (range === 'Self' || range === 'Touch') return 5;
  if (range === '1 mile') return 5280;
  if (range === '500 miles') return 2_640_000;
  if (range === 'Sight') return 5000;
  if (range === 'Unlimited' || range === 'Special') return 1000;
  const m = range.match(/([\d.]+)\s*feet/i);
  return m ? parseFloat(m[1]) : 60;
}

// Glow intensity 0..1 ~ initial energy (exponential in level) / range.
export function luminosity(attrs: SpellAttributes): number {
  const energy = Math.exp(attrs.level / 2); // grows fast with level
  const raw = energy / Math.sqrt(rangeToFeet(attrs.range));
  // map to 0..1 with a soft log curve
  return Math.max(0.15, Math.min(1, Math.log10(1 + raw) / 1.6));
}
