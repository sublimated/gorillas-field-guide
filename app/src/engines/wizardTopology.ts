// Wizard notation follows the dictionary order printed in Wizard Spell Compendium V7,
// pages 11-14. Index zero is intentionally the book's blank/null entry.

import type { AttributeKey, SpellAttributes } from './attributes';
import { uniqueBinaries } from './binary';
import { colorFor, rgbCss } from './spectrum';

export const WIZARD_K_VALUES: Record<AttributeKey, number> = {
  level: 1,
  school: 2,
  damage: 3,
  area: 4,
  range: 5,
  duration: 6,
};

export const WIZARD_ATTRIBUTE_ORDER: AttributeKey[] = [
  'level',
  'school',
  'damage',
  'area',
  'range',
  'duration',
];

const WIZARD_VALUES: Record<AttributeKey, string[]> = {
  level: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  school: ['Blank', 'Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'],
  damage: ['None', 'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'],
  area: [
    'None',
    'cone (15)', 'cone (30)', 'cone (40)', 'cone (60)',
    'cube (10)', 'cube (100)', 'cube (15)', 'cube (150)', 'cube (20)', 'cube (200)',
    'cube (2500)', 'cube (30)', 'cube (40)', 'cube (40000)', 'cube (5)', 'cube (5280)',
    'cylinder (10)', 'cylinder (20)', 'cylinder (40)', 'cylinder (5)', 'cylinder (50)', 'cylinder (60)',
    'line (100)', 'line (50)', 'line (60)', 'line (90)',
    'sphere (10)', 'sphere (100)', 'sphere (15)', 'sphere (20)', 'sphere (30)',
    'sphere (360)', 'sphere (40)', 'sphere (5)', 'sphere (60)',
  ],
  range: [
    'Blank',
    '1 mile', '10 feet', '100 feet', '120 feet', '150 feet', '30 feet', '300 feet',
    '5 feet', '500 feet', '500 miles', '60 feet', '90 feet',
    'Self', 'Sight', 'Special', 'Touch', 'Unlimited',
  ],
  duration: [
    'Instantaneous', '1 hour', '1 minute', '1 round', '10 days', '10 minutes',
    '24 hours', '30 days', '7 days', '8 hours', 'Special', 'Until dispelled',
    'Up to 1 hour', 'Up to 1 minute', 'Up to 1 round', 'Up to 10 minutes',
    'Up to 2 hours', 'Up to 24 hours', 'Up to 8 hours',
  ],
};

// The source template is a 13-sided figure. It has more than enough rotationally
// unique binary patterns for every printed dictionary entry.
export const WIZARD_RUNE_N = 13;

export type WizardLayer = {
  key: AttributeKey;
  value: string;
  index: number;
  k: number;
  bits: number[];
  color: string;
};

export type WizardTopology = {
  n: number;
  layers: WizardLayer[];
};

function normal(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function wizardValue(key: AttributeKey, attrs: SpellAttributes): string {
  if (key === 'level') return String(attrs.level);
  if (key === 'area') return attrs.areaNotation ?? attrs.area;
  return attrs[key];
}

function valueIndex(key: AttributeKey, value: string): number {
  const index = WIZARD_VALUES[key].findIndex((candidate) => normal(candidate) === normal(value));
  return index < 0 ? 0 : index;
}

export function wizardFeatureIndex(key: AttributeKey, attrs: SpellAttributes): number {
  return valueIndex(key, wizardValue(key, attrs));
}

// A layer for an explicit value rather than attrs[key] — used for the minor type of a
// spell dealing two damage types at once (see data/spells.ts damageSecondary).
export function wizardLayerForValue(key: AttributeKey, value: string): WizardLayer {
  const symbols = uniqueBinaries(WIZARD_RUNE_N);
  const index = valueIndex(key, value);
  return { key, value, index, k: WIZARD_K_VALUES[key], bits: symbols[index], color: rgbCss(colorFor(key, value)) };
}

export function wizardTopology(attrs: SpellAttributes): WizardTopology {
  const symbols = uniqueBinaries(WIZARD_RUNE_N);
  const layers = WIZARD_ATTRIBUTE_ORDER.map((key) => {
    const value = wizardValue(key, attrs);
    const index = wizardFeatureIndex(key, attrs);
    return {
      key,
      value,
      index,
      k: WIZARD_K_VALUES[key],
      bits: symbols[index],
      color: rgbCss(colorFor(key, value)),
    };
  });
  return { n: WIZARD_RUNE_N, layers };
}
