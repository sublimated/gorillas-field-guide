import type { AttributeKey, SpellAttributes } from './attributes';
import type { Point } from './rune';
import { colorFor, rgbCss } from './spectrum';
import {
  normalizeDuration,
  normalizeRange,
  parseAreaFormula,
  parseDurationFormula,
  parseRangeFormula,
  resolveAreaNotation,
  resolveDuration,
  resolveRange,
} from '../data/normalizeAttributes';
import { warlockNumberTokens } from './warlockNumber';

export const WARLOCK_ORDER: AttributeKey[] = ['level', 'school', 'area', 'damage', 'range', 'duration'];

const LEVEL: Record<number, string> = {
  0: 'CIHA',
  1: 'idFH',
  2: 'FfdF',
  3: 'DjfF',
  4: 'FfdD',
  5: 'HcaH',
  6: 'jfbi',
  7: 'aadi',
  8: 'hHDd',
  9: 'iaaH',
};

const SCHOOL: Record<string, string> = {
  Abjuration: 'dHic',
  Conjuration: 'dhaF',
  Divination: 'iacH',
  Enchantment: 'FfHH',
  Evocation: 'bjDh',
  Illusion: 'CcCi',
  Necromancy: 'DECa',
  Transmutation: 'hFha',
};

const DAMAGE: Record<string, string> = {
  None: 'dJIc',
  Acid: 'DEbE',
  Bludgeoning: 'jfHj',
  Cold: 'BBDD',
  Fire: 'bjic',
  Force: 'jhjg',
  Lightning: 'bjbc',
  Necrotic: 'DEDE',
  Piercing: 'jgAB',
  Poison: 'BDEH',
  Psychic: 'gAcC',
  Radiant: 'cbad',
  Slashing: 'jBfj',
  Thunder: 'bjbC',
};

const RANGE: Record<string, string> = {
  '1 mile': 'aa d1 n1',
  '10 feet': 'aF d2 n5',
  '100 feet': 'aF d5 n20',
  '120 feet': 'aF d4 n30',
  '150 feet': 'aF d5 n30',
  '30 feet': 'aF d1 n30',
  '300 feet': 'aF d5 n60',
  '5 feet': 'aF d1 n5',
  '500 feet': 'aF d5 n100',
  '500 miles': 'aa d5 n100',
  '60 feet': 'aF d2 n30',
  '90 feet': 'aF d3 n30',
  Self: 'GGAH',
  Sight: 'gacc',
  Special: 'caAF',
  Touch: 'AgFA',
  Unlimited: 'aaaa',
};

const DURATION: Record<string, string> = {
  Instantaneous: 'hEDA',
  '1 hour': 'HaD n1',
  '1 minute': 'hEE n1',
  '1 round': 'hhE n1',
  '10 days': 'aHE n10',
  '10 minutes': 'hE n4 n6',
  '24 hours': 'HaD n20 n4',
  '30 days': 'aHE n30',
  '7 days': 'aHE n7',
  '8 hours': 'HaD n3 n5',
  Special: 'habC',
  'Until dispelled': 'FaFa',
  'Up to 1 hour': 'FHa n1',
  'Up to 1 minute': 'FhE n1',
  'Up to 1 round': 'Fhh n1',
  'Up to 10 minutes': 'FhE n10',
  'Up to 2 hours': 'FHa n2',
  'Up to 24 hours': 'FHF n20 n4',
  'Up to 8 hours': 'FHa n8',
};

const AREA: Record<string, string> = {
  None: 'GGAA',
  'cone (15)': 'Gg d3 n5',
  'cone (30)': 'Gg d3 n10',
  'cone (40)': 'Gg d2 n20',
  'cone (60)': 'Gg d2 n30',
  'cube (10)': 'AH d1 n10',
  'cube (100)': 'AH d5 n20',
  'cube (15)': 'AH d3 n5',
  'cube (150)': 'AH d3 n50',
  'cube (20)': 'AH d2 n10',
  'cube (200)': 'AH d5 n40',
  'cube (2500)': 'AH d5 n500',
  'cube (30)': 'AH d3 n10',
  'cube (40)': 'AH d2 n20',
  'cube (40000)': 'AH d5 n8000',
  'cube (5)': 'AH d5 n1',
  'cube (5280)': 'AH d5 n1000 n50 n6',
  'cylinder (10)': 'Fj d1 n10',
  'cylinder (20)': 'Fj d2 n10',
  'cylinder (40)': 'Fj d2 n20',
  'cylinder (5)': 'Fj d5 n1',
  'cylinder (50)': 'Fj d5 n10',
  'cylinder (60)': 'Fj d2 n30',
  'line (100)': 'ha d5 n20',
  'line (50)': 'ha d5 n10',
  'line (60)': 'ha d2 n30',
  'line (90)': 'ha d3 n30',
  'sphere (10)': 'Hc d1 n10',
  'sphere (100)': 'Hc d5 n20',
  'sphere (15)': 'Hc d3 n5',
  'sphere (20)': 'Hc d2 n10',
  'sphere (30)': 'Hc d3 n10',
  'sphere (360)': 'Hc d4 n90',
  'sphere (40)': 'Hc d2 n20',
  'sphere (5)': 'Hc d5 n1',
  'sphere (60)': 'Hc d2 n30',
};

export type WarlockSegment = {
  key: AttributeKey;
  value: string;
  code: string;
  parts: WarlockCodePart[];
  color: string;
  a0: number;
  a1: number;
  mid: number;
};

export type WarlockCodePart =
  | { kind: 'aspect'; text: string }
  | { kind: 'number'; value: number }
  | { kind: 'multiplier'; value: number };

export type WarlockCastingFrame =
  | 'reaction'
  | 'bonus-action'
  | 'action'
  | '1-minute'
  | '10-minute'
  | '1-hour'
  | '8-hours'
  | '12-hours'
  | '24-hours'
  | 'generic';

export type WarlockSigil = {
  center: Point;
  rOuter: number;
  rInner: number;
  rText: number;
  rFrameInner: number;
  rFrameOuter: number;
  segments: WarlockSegment[];
  concentration: boolean;
  ritual: boolean;
  castingFrame: WarlockCastingFrame;
};

function areaKey(attrs: SpellAttributes): string {
  return attrs.areaNotation && attrs.areaNotation !== 'None' ? attrs.areaNotation.toLowerCase() : attrs.area;
}

const RANGE_ASPECT: Record<'feet' | 'miles', string> = {
  feet: 'aF',
  miles: 'aa',
};

const DURATION_ASPECT: Record<string, string> = {
  rounds: 'hhE',
  minutes: 'hEE',
  hours: 'HaD',
  days: 'aHE',
};

const DURATION_UP_TO_ASPECT: Partial<Record<string, string>> = {
  rounds: 'Fhh',
  minutes: 'FhE',
  hours: 'FHa',
};

const AREA_ASPECT: Record<string, string> = {
  Cone: 'Gg',
  Cube: 'AH',
  Cylinder: 'Fj',
  Emanation: 'Hc',
  Line: 'ha',
  Sphere: 'Hc',
  Circle: 'Hc',
};

function encodeNumbered(aspect: string, amount: number) {
  const tokens = warlockNumberTokens(amount);
  return tokens.length ? `${aspect} ${tokens.join(' ')}` : aspect;
}

function encodeRangeValue(value: string) {
  const feet = value.match(/^(\d+)\s+feet$/i);
  if (feet) return encodeNumbered(RANGE_ASPECT.feet, Number(feet[1]));
  const miles = value.match(/^(\d+)\s+miles?$/i);
  if (miles) return encodeNumbered(RANGE_ASPECT.miles, Number(miles[1]));
  return RANGE[normalizeRange(value)] ?? RANGE.Special;
}

function encodeDurationValue(value: string) {
  const upTo = value.match(/^Up to\s+(\d+)\s+(round|rounds|minute|minutes|hour|hours|day|days)$/i);
  if (upTo) {
    const unit = upTo[2].toLowerCase();
    const aspect = DURATION_UP_TO_ASPECT[unit];
    if (aspect) return encodeNumbered(aspect, Number(upTo[1]));
    const fallback = DURATION[`Up to ${upTo[1]} ${unit}`];
    return fallback ?? DURATION.Special;
  }
  const fixed = value.match(/^(\d+)\s+(round|rounds|minute|minutes|hour|hours|day|days)$/i);
  if (fixed) {
    const unit = fixed[2].toLowerCase();
    const aspect = DURATION_ASPECT[unit];
    if (aspect) return encodeNumbered(aspect, Number(fixed[1]));
  }
  return DURATION[normalizeDuration(value)] ?? DURATION.Special;
}

function encodeAreaValue(value: string, attrs: SpellAttributes, casterLevel: number) {
  const resolved = resolveAreaNotation(value, casterLevel, attrs.area);
  const parsed = resolved ? parseAreaFormula(resolved, attrs.area) : parseAreaFormula(value, attrs.area);
  if (!parsed) return AREA.None;
  const aspect = AREA_ASPECT[parsed.shape];
  if (!aspect) return AREA.None;
  return encodeNumbered(aspect, parsed.formula.base);
}

function codeFor(key: AttributeKey, attrs: SpellAttributes, casterLevel: number): { value: string; code: string } {
  if (key === 'level') return { value: String(attrs.level), code: LEVEL[attrs.level] ?? LEVEL[0] };
  if (key === 'school') return { value: attrs.school, code: SCHOOL[attrs.school] ?? 'aaaa' };
  if (key === 'damage') return { value: attrs.damage, code: DAMAGE[attrs.damage] ?? DAMAGE.None };
  if (key === 'area') {
    const value = areaKey(attrs);
    if (AREA[value]) return { value, code: AREA[value] };
    const resolved = resolveAreaNotation(value, casterLevel, attrs.area);
    return { value: resolved ?? value, code: encodeAreaValue(value, attrs, casterLevel) };
  }
  if (key === 'range') {
    if (RANGE[attrs.range]) return { value: attrs.range, code: RANGE[attrs.range] };
    const resolved = parseRangeFormula(attrs.range) ? resolveRange(attrs.range, casterLevel) : normalizeRange(attrs.range);
    return { value: resolved, code: encodeRangeValue(resolved) };
  }
  if (DURATION[attrs.duration]) return { value: attrs.duration, code: DURATION[attrs.duration] };
  const resolved = parseDurationFormula(attrs.duration) ? resolveDuration(attrs.duration, casterLevel) : normalizeDuration(attrs.duration);
  return { value: resolved, code: encodeDurationValue(resolved) };
}

export function parseWarlockCode(code: string): WarlockCodePart[] {
  return code.split(/\s+/).filter(Boolean).map((token) => {
    const multiplier = token.match(/^d([1-5])$/);
    if (multiplier) return { kind: 'multiplier', value: Number(multiplier[1]) };
    const number = token.match(/^n(\d+)$/);
    if (number) return { kind: 'number', value: Number(number[1]) };
    return { kind: 'aspect', text: token };
  });
}

export function castingFrameFor(castingTime?: string): WarlockCastingFrame {
  const text = (castingTime ?? '').toLowerCase();
  if (text.includes('reaction')) return 'reaction';
  if (text.includes('bonus')) return 'bonus-action';
  if (/\b24\s*hours?\b/.test(text)) return '24-hours';
  if (/\b12\s*hours?\b/.test(text)) return '12-hours';
  if (/\b8\s*hours?\b/.test(text)) return '8-hours';
  if (/\b1\s*hours?\b/.test(text) || /\b1\s*hour\b/.test(text)) return '1-hour';
  if (/\b10\s*minutes?\b/.test(text)) return '10-minute';
  if (/\b1\s*minutes?\b/.test(text) || /\b1\s*minute\b/.test(text)) return '1-minute';
  if (text.includes('action')) return 'action';
  return 'generic';
}

export function buildWarlockSigil(
  attrs: SpellAttributes,
  opts: { size?: number; padding?: number; castingTime?: string; casterLevel?: number } = {},
): WarlockSigil {
  const size = opts.size ?? 420;
  const padding = opts.padding ?? 28;
  const casterLevel = opts.casterLevel ?? attrs.casterLevel ?? 1;
  const center = { x: size / 2, y: size / 2 };
  const rOuter = size / 2 - padding;
  const rFrameInner = rOuter * 0.9;
  const rFrameOuter = rOuter * 1.02;
  const rInner = rOuter * 0.48;
  // A little inside the geometric midpoint keeps the enlarged aspect groups
  // optically centered in their six wedge-shaped fields.
  const rText = rInner + (rOuter - rInner) * 0.45;
  const span = (2 * Math.PI) / WARLOCK_ORDER.length;
  const start = -Math.PI / 2 - span / 2;

  const segments = WARLOCK_ORDER.map((key, i) => {
    const a0 = start + i * span;
    const a1 = a0 + span;
    const { value, code } = codeFor(key, attrs, casterLevel);
    const color = rgbCss(colorFor(key, key === 'level' ? String(attrs.level) : value));
    return { key, value, code, parts: parseWarlockCode(code), color, a0, a1, mid: (a0 + a1) / 2 };
  });

  return {
    center,
    rOuter,
    rInner,
    rText,
    rFrameInner,
    rFrameOuter,
    segments,
    concentration: attrs.concentration,
    ritual: attrs.ritual,
    castingFrame: castingFrameFor(opts.castingTime),
  };
}
