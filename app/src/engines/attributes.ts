// Shared attribute model for all three engines.
// Each spell attribute is an ordered set of feature values. The order matters:
// it determines both the binary index (rune) and the 0..1 position (spectrum).
// Ordering convention (from the source material): numeric for Level, alphabetical otherwise.

export type AttributeKey =
  | 'level'
  | 'school'
  | 'damage'
  | 'area'
  | 'range'
  | 'duration';

// The six attributes the class compendiums draw as rune layers, with their k step.
// k = how many vertices along the polygon each "on" bit connects.
export const ATTRIBUTE_ORDER: AttributeKey[] = [
  'level',
  'school',
  'damage',
  'area',
  'range',
  'duration',
];

export const K_VALUES: Record<AttributeKey, number> = {
  level: 1,
  school: 2,
  damage: 3,
  area: 4,
  range: 5,
  duration: 6,
};

// Feature sets. These mirror the dictionaries in the source PDFs.
// Level is numeric 0..9. The rest are alphabetical with "None" first where it exists.
export const FEATURES: Record<AttributeKey, string[]> = {
  level: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  school: [
    'Abjuration',
    'Conjuration',
    'Divination',
    'Enchantment',
    'Evocation',
    'Illusion',
    'Necromancy',
    'Transmutation',
  ],
  damage: [
    'None',
    'Acid',
    'Bludgeoning',
    'Cold',
    'Fire',
    'Force',
    'Lightning',
    'Necrotic',
    'Piercing',
    'Poison',
    'Psychic',
    'Radiant',
    'Slashing',
    'Thunder',
  ],
  // Area buckets (simplified set used by the rune dictionary).
  area: [
    'None',
    'Cone',
    'Cube',
    'Cylinder',
    'Line',
    'Sphere',
    'Square',
    'Wall',
    'Circle',
    'Multiple targets',
    'Single target',
  ],
  // Range buckets from the saying/writing dictionaries.
  range: [
    'Self',
    'Touch',
    '5 feet',
    '10 feet',
    '15 feet',
    '20 feet',
    '30 feet',
    '40 feet',
    '50 feet',
    '60 feet',
    '90 feet',
    '100 feet',
    '120 feet',
    '150 feet',
    '300 feet',
    '500 feet',
    '500 miles',
    '1 mile',
    'Sight',
    'Unlimited',
    'Special',
  ],
  duration: [
    'Instantaneous',
    '1 round',
    '1 minute',
    '10 minutes',
    '1 hour',
    '8 hours',
    '24 hours',
    '7 days',
    '10 days',
    '30 days',
    'Until dispelled',
    'Special',
    'Up to 1 round',
    'Up to 1 minute',
    'Up to 10 minutes',
    'Up to 1 hour',
    'Up to 2 hours',
    'Up to 8 hours',
    'Up to 24 hours',
    '(maximum 10 rounds)',
    '+ 2 rounds',
    '+ 3 rounds',
    '+1 hour/ level',
    '+1 round/ level',
    '+2 rounds',
    '12 hours',
    '1d4 rounds or 1 round',
    '1d4+1 rounds',
    '1d4+1 rounds (apparent time)',
    '1d4+1 rounds, or 1d4+1 rounds after creatures leave the smoke cloud',
    '1d6+2 rounds',
    '2 hours',
    '2 minutes',
    '2d4 rounds',
    '30 minutes',
    '4d12 hours',
    '5 rounds',
    '7 rounds',
    'One usage per two levels',
    'Seven days or seven months (D)',
    'Sixty days or until discharged',
    'Until triggered or broken',
    'Up to 1 day',
    'Up to 4 rounds',
    'Up to 6 rounds',
  ],
};

export type SpellAttributes = {
  level: number; // 0..9
  school: string;
  damage: string; // primary (higher-potential) damage type, or "None"
  damageSecondary?: string; // for spells dealing two damage types at once; see data/spells.ts
  area: string;
  areaNotation?: string; // fine Area slot notation, e.g. "sphere (20)", when a renderer needs it
  range: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  casterLevel?: number; // optional per-level resolver input; currently consumed by Warlock only
};

// Index of a feature value within its ordered set (used by rune + spectrum).
export function featureIndex(key: AttributeKey, value: string): number {
  const i = FEATURES[key].indexOf(value);
  return i < 0 ? 0 : i;
}

// 0..1 position of an attribute value within its set (used by spectrum).
export function featureFraction(key: AttributeKey, value: string): number {
  const set = FEATURES[key];
  const max = set.length - 1;
  if (max <= 0) return 0;
  return featureIndex(key, value) / max;
}
