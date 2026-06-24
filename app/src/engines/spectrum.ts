// Spectrum engine, per "Arcane Spectroscopy".
// Each attribute maps to a position x in [0,1]; its colour is the visible-light spectrum
// at that position. Brightness of each spectral line falls off with distance from the
// spell's level.
//
// The source material (Arcane_Spectroscopy_Full_v3, ch.3) states the intent plainly: "f(0)
// gives the lower energy (red) end of the visible light spectrum while f(1) gives the higher
// (violet) end, and the values between are the other colours visible in a rainbow when we
// pass light through a simple illusory prism." It then approximates that with matplotlib's
// `gist_rainbow` colormap and immediately disclaims it: "This is somewhat arbitrary... there's
// definitely room to play with this system and tweak it to your exact liking." gist_rainbow is
// cyclic, so its two ends are both reddish-magenta instead of a true red→violet sweep — this
// implementation instead approximates the real wavelength-to-colour curve (700nm red down to
// 380nm violet), which is what the book actually describes wanting.

import {
  ATTRIBUTE_ORDER,
  featureFraction,
  type AttributeKey,
  type SpellAttributes,
} from './attributes';

export type RGB = [number, number, number];

const RED_NM = 700;
const VIOLET_NM = 380;

// Classic wavelength→RGB approximation (after Dan Bruton), with intensity tapering at both
// visible edges so the line dims as if fading into the invisible infrared/ultraviolet rather
// than cutting off hard.
function wavelengthToRGB(nm: number): RGB {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = -(nm - 440) / (440 - 380); b = 1; }
  else if (nm < 490) { g = (nm - 440) / (490 - 440); b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / (510 - 490); }
  else if (nm < 580) { r = (nm - 510) / (580 - 510); g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / (645 - 580); }
  else { r = 1; }

  let edgeFade = 1;
  if (nm < 420) edgeFade = 0.35 + 0.65 * (nm - 380) / (420 - 380); // fading toward UV
  else if (nm > 690) edgeFade = 0.35 + 0.65 * (780 - nm) / (780 - 690); // fading toward IR

  const gamma = 0.8;
  const channel = (c: number) => (c <= 0 ? 0 : Math.round(255 * Math.pow(c * edgeFade, gamma)));
  return [channel(r), channel(g), channel(b)];
}

// t=0 → red (low energy) end of the visible spectrum, t=1 → violet (high energy) end —
// directly matching the book's stated f(0)/f(1), no inversion needed.
export function visibleSpectrum(t: number): RGB {
  const clamped = Math.max(0, Math.min(1, t));
  const nm = RED_NM - clamped * (RED_NM - VIOLET_NM);
  return wavelengthToRGB(nm);
}

export function rgbCss([r, g, b]: RGB, a = 1): string {
  return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Mix a colour toward white — the hot, near-white core a real light source shows at its
// centre, with the spectral hue only fully reading in the surrounding bloom.
export function mixWhite([r, g, b]: RGB, t: number): RGB {
  const c = Math.max(0, Math.min(1, t));
  return [Math.round(r + (255 - r) * c), Math.round(g + (255 - g) * c), Math.round(b + (255 - b) * c)];
}

export function colorFor(key: AttributeKey, value: string): RGB {
  return visibleSpectrum(featureFraction(key, value));
}

export type SpectralLine = {
  id: string;
  key: AttributeKey;
  variant?: 'primary' | 'secondary';
  x: number; // 0..1 position along the band
  color: RGB;
  brightness: number; // 0..1
};

const SIGMA = 1;

export function spectrum(attrs: SpellAttributes): SpectralLine[] {
  const levelPos = attrs.level / 9;
  const lines: SpectralLine[] = ATTRIBUTE_ORDER.map((key) => {
    const value = key === 'level' ? String(attrs.level) : attrs[key];
    const x = featureFraction(key, value);
    const brightness = Math.exp(-((x - levelPos) ** 2) / (2 * SIGMA * SIGMA));
    return { id: key, key, variant: 'primary', x, color: visibleSpectrum(x), brightness };
  });
  if (attrs.damageSecondary) {
    const x = featureFraction('damage', attrs.damageSecondary);
    const brightness = Math.exp(-((x - levelPos) ** 2) / (2 * SIGMA * SIGMA));
    lines.push({
      id: 'damage-secondary',
      key: 'damage',
      variant: 'secondary',
      x,
      color: visibleSpectrum(x),
      brightness,
    });
  }
  return lines;
}

// The spell's signature colour: the colour at its level position.
export function spellColor(attrs: SpellAttributes): RGB {
  return visibleSpectrum(attrs.level / 9);
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
