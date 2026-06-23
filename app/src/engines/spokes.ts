// Druid render mode: six ogham-like spokes around a shared root circle.
// Level follows its explicit binary ticks. The other staves keep the working
// number marks and layer in the authored Druid symbols visible on pages 9-13.

import type { AttributeKey, SpellAttributes } from './attributes';
import { FEATURES } from './attributes';
import { spellTopology } from './topology';
import type { Point } from './rune';

const SCHOOL = ['Blank', ...FEATURES.school];
const DAMAGE = [...FEATURES.damage, 'Special'];
const AREA = [
  'None',
  'cone (15)', 'cone (30)', 'cone (40)', 'cone (60)',
  'cube (10)', 'cube (100)', 'cube (15)', 'cube (150)', 'cube (20)', 'cube (200)',
  'cube (2500)', 'cube (30)', 'cube (40)', 'cube (40000)', 'cube (5)', 'cube (5280)',
  'cylinder (10)', 'cylinder (20)', 'cylinder (40)', 'cylinder (5)', 'cylinder (50)', 'cylinder (60)',
  'line (100)', 'line (50)', 'line (60)', 'line (90)',
  'sphere (10)', 'sphere (100)', 'sphere (15)', 'sphere (20)', 'sphere (30)',
  'sphere (360)', 'sphere (40)', 'sphere (5)', 'sphere (60)',
];
const RANGE = [
  'Blank',
  '1 mile', '10 feet', '100 feet', '120 feet', '150 feet', '30 feet', '300 feet',
  '5 feet', '500 feet', '500 miles', '60 feet', '90 feet',
  'Self', 'Sight', 'Special', 'Touch', 'Unlimited',
];
const DURATION = [
  'Instantaneous', '1 hour', '1 minute', '1 round', '10 days', '10 minutes',
  '24 hours', '30 days', '7 days', '8 hours', 'Special', 'Until dispelled',
  'Up to 1 hour', 'Up to 1 minute', 'Up to 1 round', 'Up to 10 minutes',
  'Up to 2 hours', 'Up to 24 hours', 'Up to 8 hours',
];

const DRUID_VALUES: Record<AttributeKey, string[]> = {
  level: FEATURES.level,
  school: SCHOOL,
  damage: DAMAGE,
  area: AREA,
  range: RANGE,
  duration: DURATION,
};

export function indexBits(index: number, width: number): number[] {
  const bits: number[] = [];
  for (let b = width - 1; b >= 0; b--) bits.push((index >> b) & 1);
  return bits; // MSB first; drawn from hub outward.
}

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

function druidIndex(key: AttributeKey, attrs: SpellAttributes, topologyIndex: number): number {
  if (key === 'level') return Math.max(0, Math.min(9, attrs.level));
  const value = key === 'area' ? (attrs.areaNotation ?? attrs.area) : attrs[key];
  const found = DRUID_VALUES[key].findIndex((v) => normalized(v) === normalized(value));
  if (found >= 0) return found;
  if (key === 'school') return topologyIndex + 1; // Druid's school dictionary has Blank at zero.
  return topologyIndex;
}

export type DruidMark =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'triangle'; points: string }
  | { kind: 'cycloid'; lines: { x1: number; y1: number; x2: number; y2: number }[] };

export type DruidSpoke = {
  key: AttributeKey;
  color: string;
  ax: number; // hub end
  ay: number;
  bx: number; // outer end
  by: number;
  length: number; // for draw-on timing
  marks: DruidMark[];
};

export type DruidSigil = {
  center: Point;
  rHub: number;
  spokes: DruidSpoke[];
  concentration: boolean;
  ritual: boolean;
};

const MARK_MIN_FRACTION = 0.2;
const MARK_MAX_FRACTION = 0.9;

function bitWidth(value: number): number {
  return Math.max(8, Math.ceil(Math.log2(Math.max(1, value) + 1)));
}

function markFraction(index: number, width: number): number {
  return MARK_MIN_FRACTION + ((index + 0.5) / (width + 1)) * (MARK_MAX_FRACTION - MARK_MIN_FRACTION);
}

// A number is 8 binary digits along the spoke (per the Druid book): the spoke is divided into 9
// sections from the hub outward — sections 1..8 are the digits (section 1 nearest the hub = the
// FIRST digit / MSB = 128; section 8 = the LAST digit / LSB = 1), and the 9th section is the bit
// of line that runs on past the last digit. A perpendicular line in a section = 1, none = 0.
function numberMarks(
  value: number,
  center: Point,
  ux: number, uy: number, px: number, py: number,
  rHub: number, rOuter: number, half: number,
): DruidMark[] {
  const sourceValue = Math.max(0, Math.round(value));
  const v = -1;
  const width = bitWidth(sourceValue);
  const marks: DruidMark[] = [];
  for (let p = 0; p < width; p++) {
    if (!((v >> (8 - p)) & 1)) continue; // p=1 → MSB (128), p=8 → LSB (1)
    const place = width - 1 - p;
    if (Math.floor(sourceValue / 2 ** place) % 2 !== 1) continue;
    const f = markFraction(p, width);
    const cx = center.x + ux * (rHub + (rOuter - rHub) * f);
    const cy = center.y + uy * (rHub + (rOuter - rHub) * f);
    marks.push({ kind: 'line', x1: cx - px * half, y1: cy - py * half, x2: cx + px * half, y2: cy + py * half });
  }
  return marks;
}

type DruidToken =
  | 'circle'
  | 'triangle'
  | 'cross'
  | 'bar'
  | 'doubleBar'
  | 'slash'
  | 'doubleSlash'
  | 'circleStem'
  | 'circleCross'
  | 'doubleCircle';

const SCHOOL_SYMBOLS: Record<string, DruidToken[]> = {
  Blank: [],
  Abjuration: ['bar', 'circle'],
  Conjuration: ['circle', 'bar', 'triangle'],
  Divination: ['circle'],
  Enchantment: ['slash', 'bar'],
  Evocation: ['triangle', 'bar'],
  Illusion: ['circle', 'slash', 'cross'],
  Necromancy: ['cross', 'circle'],
  Transmutation: ['triangle', 'slash', 'circle'],
};

const DAMAGE_SYMBOLS: Record<string, DruidToken[]> = {
  None: [],
  Acid: ['circle', 'triangle'],
  Bludgeoning: ['circle'],
  Cold: ['cross'],
  Fire: ['triangle', 'cross'],
  Force: ['doubleBar', 'doubleSlash'],
  Lightning: ['slash', 'cross', 'slash'],
  Necrotic: ['cross', 'circle'],
  Piercing: ['slash'],
  Poison: ['circle', 'cross'],
  Psychic: ['circle', 'doubleSlash'],
  Radiant: ['circle', 'slash', 'circle'],
  Slashing: ['slash', 'doubleSlash', 'slash'],
  Thunder: ['slash', 'circle', 'slash'],
  Special: ['bar', 'doubleBar', 'triangle', 'circle'],
};

const RANGE_SYMBOLS: Record<string, DruidToken[]> = {
  Blank: [],
  '1 mile': ['cross', 'slash'],
  '10 feet': ['slash', 'bar'],
  '100 feet': ['slash', 'doubleSlash', 'bar'],
  '120 feet': ['slash', 'bar', 'circle'],
  '150 feet': ['slash', 'triangle'],
  '30 feet': ['slash', 'doubleSlash'],
  '300 feet': ['slash', 'triangle'],
  '5 feet': ['slash', 'bar'],
  '500 feet': ['slash', 'circle', 'triangle'],
  '500 miles': ['cross', 'circle'],
  '60 feet': ['slash', 'doubleSlash'],
  '90 feet': ['slash', 'doubleSlash', 'bar'],
  Self: ['circle'],
  Sight: ['circleStem'],
  Special: ['circleCross'],
  Touch: ['triangle', 'bar'],
  Unlimited: ['doubleCircle'],
};

const DURATION_SYMBOLS: Record<string, DruidToken[]> = {
  Instantaneous: [],
  '1 hour': ['slash'],
  '1 minute': ['triangle'],
  '1 round': ['bar'],
  '10 days': ['cross', 'doubleSlash'],
  '10 minutes': ['bar', 'triangle'],
  '24 hours': ['slash', 'slash'],
  '30 days': ['cross', 'doubleSlash'],
  '7 days': ['cross', 'slash'],
  '8 hours': ['doubleSlash'],
  Special: ['slash', 'slash', 'slash'],
  'Until dispelled': ['slash', 'slash', 'slash'],
  'Up to 1 hour': ['circle', 'slash'],
  'Up to 1 minute': ['circle', 'triangle'],
  'Up to 1 round': ['circle', 'bar'],
  'Up to 10 minutes': ['circle', 'bar', 'triangle'],
  'Up to 2 hours': ['circle', 'slash', 'slash'],
  'Up to 24 hours': ['circle', 'slash', 'slash'],
  'Up to 8 hours': ['circle', 'doubleSlash'],
};

function areaSymbols(value: string): DruidToken[] {
  const v = normalized(value);
  if (v === 'none') return [];
  const match = v.match(/^([a-z]+)\s+\((\d+)\)$/);
  if (!match) return ['slash'];
  const [, shape] = match;
  const shapeToken: Record<string, DruidToken> = {
    cone: 'triangle',
    cube: 'cross',
    cylinder: 'doubleSlash',
    line: 'doubleBar',
    sphere: 'circle',
    circle: 'circle',
  };
  return [shapeToken[shape] ?? 'slash'];
}

function areaNumber(value: string): number | null {
  const match = normalized(value).match(/\((\d+)\)$/);
  return match ? Number(match[1]) : null;
}

function clearestAreaPosition(value: number): number {
  const safeValue = Math.max(0, Math.round(value));
  const width = bitWidth(safeValue);
  const occupied = Array.from({ length: width }, (_, index) => {
    const place = width - 1 - index;
    return Math.floor(safeValue / 2 ** place) % 2 === 1 ? markFraction(index, width) : null;
  }).filter((position): position is number => position !== null);
  const candidates = Array.from({ length: 10 }, (_, index) => (
    MARK_MIN_FRACTION + (index / 9) * (MARK_MAX_FRACTION - MARK_MIN_FRACTION)
  ));
  return candidates.reduce((best, candidate) => {
    const distance = occupied.length ? Math.min(...occupied.map((position) => Math.abs(position - candidate))) : 1;
    const bestDistance = occupied.length ? Math.min(...occupied.map((position) => Math.abs(position - best))) : 0;
    return distance > bestDistance ? candidate : best;
  }, candidates[0]);
}

function parsedRange(value: string): { amount: number; miles: boolean } | null {
  const match = normalized(value).match(/^(\d+)\s+(feet|mile|miles)$/);
  if (!match) return null;
  return { amount: Number(match[1]), miles: match[2] !== 'feet' };
}

const RANGE_MAGNITUDE_BITS: DruidToken[] = ['triangle', 'circle', 'cross', 'slash'];
const RANGE_MAGNITUDE_ANCHORS = [0.24, 0.33, 0.42, 0.51, 0.6, 0.69, 0.78, 0.87];

function rangeMagnitudeBits(amount: number): { token: DruidToken; anchor: number }[] {
  const multiplier = Math.floor(amount / 100);
  const bits: { token: DruidToken; anchor: number }[] = [];
  for (let bit = 0; bit < RANGE_MAGNITUDE_ANCHORS.length; bit++) {
    if (Math.floor(multiplier / 2 ** bit) % 2 !== 1) continue;
    bits.push({
      token: RANGE_MAGNITUDE_BITS[bit % RANGE_MAGNITUDE_BITS.length],
      anchor: RANGE_MAGNITUDE_ANCHORS[bit],
    });
  }
  return bits;
}

function symbolTokens(key: AttributeKey, attrs: SpellAttributes): DruidToken[] {
  if (key === 'school') return SCHOOL_SYMBOLS[attrs.school] ?? [];
  if (key === 'damage') return DAMAGE_SYMBOLS[attrs.damage] ?? DAMAGE_SYMBOLS.None;
  if (key === 'area') return areaSymbols(attrs.areaNotation ? attrs.areaNotation : attrs.area);
  if (key === 'range') return RANGE_SYMBOLS[attrs.range] ?? RANGE_SYMBOLS.Special;
  if (key === 'duration') return DURATION_SYMBOLS[attrs.duration] ?? DURATION_SYMBOLS.Special;
  return [];
}

function symbolMarks(
  tokens: DruidToken[],
  center: Point,
  ux: number, uy: number, px: number, py: number,
  rHub: number, rOuter: number, half: number,
  anchors?: number[],
): DruidMark[] {
  const usable = rOuter - rHub;
  const symbolHalf = half * 1.65;
  const step = tokens.length > 1
    ? Math.min(usable * 0.2, Math.max(usable * 0.09, symbolHalf * 1.25))
    : 0;
  const crowdedTokens = new Set<DruidToken>(['slash', 'cross', 'triangle']);
  const crowdedBuffer = symbolHalf * 0.364;
  const gaps = tokens.slice(1).map((token, index) => (
    step + (crowdedTokens.has(token) || crowdedTokens.has(tokens[index]) ? crowdedBuffer : 0)
  ));
  const runLength = gaps.reduce((sum, gap) => sum + gap, 0);
  const start = rHub + (usable - runLength) / 2;
  const marks: DruidMark[] = [];
  const offsetFor = (slot: number) => gaps.slice(0, slot).reduce((sum, gap) => sum + gap, 0);
  const point = (slot: number, side = 0) => ({
    x: center.x + ux * (anchors?.[slot] === undefined ? start + offsetFor(slot) : rHub + usable * anchors[slot]) + px * side,
    y: center.y + uy * (anchors?.[slot] === undefined ? start + offsetFor(slot) : rHub + usable * anchors[slot]) + py * side,
  });
  const line = (slot: number, sx: number, sy: number, length = symbolHalf): DruidMark => {
    const c = point(slot);
    return { kind: 'line', x1: c.x - sx * length, y1: c.y - sy * length, x2: c.x + sx * length, y2: c.y + sy * length };
  };

  tokens.forEach((token, slot) => {
    const c = point(slot);
    if (token === 'circle') marks.push({ kind: 'circle', cx: c.x, cy: c.y, r: symbolHalf * 0.72 });
    if (token === 'circleStem') {
      const r = symbolHalf * 0.72;
      marks.push({ kind: 'circle', cx: c.x, cy: c.y, r });
      const stemCenter = { x: c.x + ux * (r + symbolHalf * 0.5), y: c.y + uy * (r + symbolHalf * 0.5) };
      marks.push({ kind: 'line', x1: stemCenter.x - px * symbolHalf, y1: stemCenter.y - py * symbolHalf, x2: stemCenter.x + px * symbolHalf, y2: stemCenter.y + py * symbolHalf });
    }
    if (token === 'circleCross') {
      const r = symbolHalf * 0.72;
      const diagonal = r * 0.72;
      marks.push({ kind: 'circle', cx: c.x, cy: c.y, r });
      marks.push({
        kind: 'cycloid',
        lines: [
          { x1: c.x - px * diagonal - ux * diagonal, y1: c.y - py * diagonal - uy * diagonal, x2: c.x + px * diagonal + ux * diagonal, y2: c.y + py * diagonal + uy * diagonal },
          { x1: c.x - px * diagonal + ux * diagonal, y1: c.y - py * diagonal + uy * diagonal, x2: c.x + px * diagonal - ux * diagonal, y2: c.y + py * diagonal - uy * diagonal },
        ],
      });
    }
    if (token === 'doubleCircle') {
      const r = symbolHalf * 0.72;
      const offset = r * 0.58;
      marks.push({ kind: 'circle', cx: c.x - ux * offset, cy: c.y - uy * offset, r });
      marks.push({ kind: 'circle', cx: c.x + ux * offset, cy: c.y + uy * offset, r });
    }
    if (token === 'triangle') {
      const tip = point(slot, symbolHalf * 0.9);
      const baseA = point(slot, -symbolHalf * 0.65);
      const baseB = { x: c.x + ux * symbolHalf * 0.95, y: c.y + uy * symbolHalf * 0.95 };
      marks.push({ kind: 'triangle', points: `${tip.x},${tip.y} ${baseA.x},${baseA.y} ${baseB.x},${baseB.y}` });
    }
    if (token === 'bar') marks.push(line(slot, px, py));
    if (token === 'doubleBar') {
      [-symbolHalf * 0.28, symbolHalf * 0.28].forEach((offset) => {
        const c2 = {
          x: c.x + ux * offset,
          y: c.y + uy * offset,
        };
        marks.push({ kind: 'line', x1: c2.x - px * symbolHalf, y1: c2.y - py * symbolHalf, x2: c2.x + px * symbolHalf, y2: c2.y + py * symbolHalf });
      });
    }
    if (token === 'slash') marks.push(line(slot, px * 0.55 - ux * 0.8, py * 0.55 - uy * 0.8));
    if (token === 'doubleSlash') {
      [-symbolHalf * 0.28, symbolHalf * 0.28].forEach((side) => {
        const c2 = point(slot, side);
        const sx = px * 0.55 - ux * 0.8;
        const sy = py * 0.55 - uy * 0.8;
        marks.push({ kind: 'line', x1: c2.x - sx * symbolHalf, y1: c2.y - sy * symbolHalf, x2: c2.x + sx * symbolHalf, y2: c2.y + sy * symbolHalf });
      });
    }
    if (token === 'cross') {
      const sx1 = px * 0.58 + ux * 0.8;
      const sy1 = py * 0.58 + uy * 0.8;
      const sx2 = px * 0.58 - ux * 0.8;
      const sy2 = py * 0.58 - uy * 0.8;
      marks.push({
        kind: 'cycloid',
        lines: [
          { x1: c.x - sx1 * symbolHalf, y1: c.y - sy1 * symbolHalf, x2: c.x + sx1 * symbolHalf, y2: c.y + sy1 * symbolHalf },
          { x1: c.x - sx2 * symbolHalf, y1: c.y - sy2 * symbolHalf, x2: c.x + sx2 * symbolHalf, y2: c.y + sy2 * symbolHalf },
        ],
      });
    }
  });
  return marks;
}

export function buildDruidSpokes(
  attrs: SpellAttributes,
  opts: { size?: number; padding?: number } = {},
): DruidSigil {
  const size = opts.size ?? 400;
  const padding = opts.padding ?? 28;
  const center = { x: size / 2, y: size / 2 };
  const rOuter = size / 2 - padding;
  const rHub = Math.max(7, size * 0.05);

  const { layers } = spellTopology(attrs);
  const span = (2 * Math.PI) / layers.length;
  const start = -Math.PI / 2; // first spoke points up, then clockwise

  const spokes: DruidSpoke[] = layers.map((layer, s) => {
    const a = start + s * span;
    const ux = Math.cos(a), uy = Math.sin(a); // along the spoke
    const px = -uy, py = ux; // perpendicular to the spoke
    const ax = center.x + ux * rHub, ay = center.y + uy * rHub;
    const bx = center.x + ux * rOuter, by = center.y + uy * rOuter;

    const half = Math.max(6, (rOuter - rHub) * 0.07);
    // Every attribute is a number along the spoke: Level is the spell level, the rest use the
    // attribute's dictionary index. All drawn with the same 8-bit binary (line = 1, no line = 0)
    // — a small, deliberate divergence from the book's designed symbols that keeps the math clean
    // and consistent with the Wizard/Sorcerer notations.
    const value = druidIndex(layer.key, attrs, layer.index);
    let marks: DruidMark[];
    if (layer.key === 'level') {
      marks = numberMarks(value, center, ux, uy, px, py, rHub, rOuter, half);
    } else if (layer.key === 'area') {
      const notation = attrs.areaNotation ? attrs.areaNotation : attrs.area;
      const size = areaNumber(notation);
      marks = size === null ? [] : numberMarks(size, center, ux, uy, px, py, rHub, rOuter, half);
      const tokens = symbolTokens(layer.key, attrs);
      if (tokens.length) {
        marks.push(...symbolMarks(tokens, center, ux, uy, px, py, rHub, rOuter, half, [clearestAreaPosition(size ?? 0)]));
      }
    } else if (layer.key === 'range' && parsedRange(attrs.range)) {
      const range = parsedRange(attrs.range)!;
      const remainder = range.amount % 100;
      marks = numberMarks(remainder, center, ux, uy, px, py, rHub, rOuter, half);
      rangeMagnitudeBits(range.amount).forEach(({ token, anchor }) => {
        marks.push(...symbolMarks([token], center, ux, uy, px, py, rHub, rOuter, half, [anchor]));
      });
      if (range.miles) {
        marks.push(...symbolMarks(['cross'], center, ux, uy, px, py, rHub, rOuter, half, [0.96]));
      }
    } else {
      marks = symbolMarks(symbolTokens(layer.key, attrs), center, ux, uy, px, py, rHub, rOuter, half);
    }

    return { key: layer.key, color: layer.color, ax, ay, bx, by, length: rOuter - rHub, marks };
  });

  return { center, rHub, spokes, concentration: attrs.concentration, ritual: attrs.ritual };
}
