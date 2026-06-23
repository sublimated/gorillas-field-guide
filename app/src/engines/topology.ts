// Meaning layer — shared by every render mode (Wizard chords, Sorcerer seal, Druid spokes…).
// A spell's "meaning" is: for each attribute, its value, feature index, k-step, and the
// cyclically-unique binary that says which vertices are "on". Presentation modes consume
// this without re-deriving it. Per "The Theory of Magic": n = 2·(#attributes) + 1.

import {
  ATTRIBUTE_ORDER,
  FEATURES,
  K_VALUES,
  featureIndex,
  type AttributeKey,
  type SpellAttributes,
} from './attributes';
import { chooseN, uniqueBinaries } from './binary';
import { colorFor, rgbCss } from './spectrum';

// Polygon size: enough layers for the attributes, enough symbols for the biggest set.
const MAX_FEATURES = Math.max(...Object.values(FEATURES).map((f) => f.length));
export const RUNE_N = chooseN(ATTRIBUTE_ORDER.length, MAX_FEATURES);

export type AttrLayer = {
  key: AttributeKey;
  value: string;
  index: number; // position of the value within its feature set
  k: number; // k-step for the chord/polygon notation
  bits: number[]; // cyclically-unique binary, length n ("on"/"off" per vertex)
  color: string; // the attribute's spectrum colour
};

export type SpellTopology = {
  n: number;
  layers: AttrLayer[]; // one per attribute, in ATTRIBUTE_ORDER
};

export function spellTopology(attrs: SpellAttributes): SpellTopology {
  const n = RUNE_N;
  const symbols = uniqueBinaries(n);
  const layers: AttrLayer[] = ATTRIBUTE_ORDER.map((key) => {
    const value = key === 'level' ? String(attrs.level) : (attrs as any)[key];
    const index = featureIndex(key, value);
    const bits = symbols[index] ?? symbols[0];
    return { key, value, index, k: K_VALUES[key], bits, color: rgbCss(colorFor(key, value)) };
  });
  return { n, layers };
}
