// Normalizes imported (D&D 3.5 / 2024 SRD) range & duration strings onto the canonical
// values the notation engines understand (see engines/warlock.ts RANGE / DURATION).
//
// PROTOTYPE — two layers:
//   1) deterministic formatting/phrasing fixes (safe, no interpretation)
//   2) a POLICY table for formulaic / scaling values (per-level ranges, "1 min./level", etc.)
//      that maps each family to a representative fixed value. These are design choices and are
//      flagged for review — adjust RANGE_POLICY / DURATION_POLICY to taste.
//
// Anything we can't place falls back to 'Special', which the engines already render.

export type ScalingUnit = 'feet' | 'miles' | 'rounds' | 'minutes' | 'hours' | 'days';

export type ScalingFormula = {
  base: number;
  perLevel: number;
  perLevelDivisor: number;
  unit: ScalingUnit;
  cap?: number;
  upTo?: boolean;
};

export type AreaScaling = {
  shape: string;
  formula: ScalingFormula;
};

const stripTails = (s: string): string =>
  s
    .replace(/\s*\((?:D|M)\)\s*$/i, '') // trailing (D) dismissible / (M) material markers
    .replace(/\s*;?\s*see text.*$/i, '') // "; see text", " or see text", trailing notes
    .replace(/\s+/g, ' ')
    .trim();

const MILES_RE = /^(\d+)\s*(?:mile|miles)\b/i;

function pluralize(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

function quantityWord(word: string) {
  if (/^one$/i.test(word)) return 1;
  const parsed = Number(word);
  return Number.isFinite(parsed) ? parsed : null;
}

function unitFromWord(word: string): ScalingUnit | null {
  const unit = word.toLowerCase();
  if (unit.startsWith('ft') || unit.startsWith('foot') || unit.startsWith('feet')) return 'feet';
  if (unit.startsWith('mile')) return 'miles';
  if (unit.startsWith('round')) return 'rounds';
  if (unit.startsWith('min')) return 'minutes';
  if (unit.startsWith('hour')) return 'hours';
  if (unit.startsWith('day')) return 'days';
  return null;
}

export function resolveScalingFormula(formula: ScalingFormula, level: number): number {
  const resolved = formula.base + Math.floor(level / formula.perLevelDivisor) * formula.perLevel;
  return formula.cap == null ? resolved : Math.min(resolved, formula.cap);
}

export function formatResolvedFormula(formula: ScalingFormula, level: number): string {
  const amount = resolveScalingFormula(formula, level);
  const rendered =
    formula.unit === 'feet' ? `${amount} feet` :
    formula.unit === 'miles' ? pluralize(amount, 'mile', 'miles') :
    formula.unit === 'rounds' ? pluralize(amount, 'round', 'rounds') :
    formula.unit === 'minutes' ? pluralize(amount, 'minute', 'minutes') :
    formula.unit === 'hours' ? pluralize(amount, 'hour', 'hours') :
    pluralize(amount, 'day', 'days');
  return formula.upTo ? `Up to ${rendered}` : rendered;
}

// ---- RANGE --------------------------------------------------------------------------------

// Formulaic 3.5 range categories → representative fixed value (REVIEW THESE).
const RANGE_POLICY: Array<[RegExp, string]> = [
  [/^close \(25 ft/i, '30 feet'], //  Close (25 ft. + 5 ft./2 levels)
  [/^medium \(100 ft/i, '120 feet'], //  Medium (100 ft. + 10 ft./level)
  [/^long \(400 ft/i, '500 feet'], //  Long (400 ft. + 40 ft./level)
  [/^\d+\s*miles?\b/i, 'Unlimited'],
  [/^up to\s+\d+\s*ft/i, 'Special'],
  [/^personal/i, 'Self'],
  [/^(see text|anywhere|unlimited)/i, 'Special'],
  [/mile\/level|miles?$|mile$/i, 'Unlimited'], //  1 mile/level, 2 miles, One mile, 5 miles
];

const FEET_RE = /^(\d+)\s*(?:ft\.?|feet)\b/i;

export function parseRangeFormula(raw: string): ScalingFormula | null {
  const s = stripTails(raw);
  if (/^close \(25 ft\.? \+ 5 ft\.?\/2 levels?\)$/i.test(s)) {
    return { base: 25, perLevel: 5, perLevelDivisor: 2, unit: 'feet' };
  }
  if (/^medium \(100 ft\.? \+ 10 ft\.?\/level\)$/i.test(s)) {
    return { base: 100, perLevel: 10, perLevelDivisor: 1, unit: 'feet' };
  }
  if (/^long \(400 ft\.? \+ 40 ft\.?\/level\)$/i.test(s)) {
    return { base: 400, perLevel: 40, perLevelDivisor: 1, unit: 'feet' };
  }
  const generic = s.match(/^(\d+)\s*(ft\.?|feet|miles?)\/(\d+)?\s*levels?$/i);
  if (!generic) return null;
  const unit = unitFromWord(generic[2]);
  if (!unit) return null;
  return {
    base: 0,
    perLevel: Number(generic[1]),
    perLevelDivisor: generic[3] ? Number(generic[3]) : 1,
    unit,
  };
}

export function normalizeRange(raw: string): string {
  const s = stripTails(raw);
  if (s.length === 0) return 'Special';
  if (/^up to\s+\d+\s*ft/i.test(s)) return 'Special';
  // "30 ft." → "30 feet" (the most common skew: 3.5 uses ft., the engines use feet)
  const feet = s.match(FEET_RE);
  if (feet) return `${feet[1]} feet`;
  // Only 1 mile and 500 miles have dedicated feature slots; other mile values bucket to Unlimited.
  const miles = s.match(MILES_RE);
  if (miles) {
    const n = Number(miles[1]);
    if (n === 1) return '1 mile';
    if (n === 500) return '500 miles';
    return 'Unlimited';
  }
  if (/^touch/i.test(s)) return 'Touch';
  if (/^self/i.test(s) || /^personal/i.test(s)) return 'Self';
  if (/^sight/i.test(s)) return 'Sight';
  for (const [re, value] of RANGE_POLICY) if (re.test(s)) return value;
  return s; // already canonical (or leave for the gap report)
}

export function resolveRange(raw: string, level: number): string {
  const formula = parseRangeFormula(raw);
  return formula ? formatResolvedFormula(formula, level) : normalizeRange(raw);
}

// ---- DURATION -----------------------------------------------------------------------------

function parseBaseDuration(s: string): { amount: number; unit: ScalingUnit; upTo: boolean } | null {
  const m = s.match(/^(up to\s+)?(\d+)\s*(round|minute|min|hour|day)s?\b/i);
  if (!m) return null;
  const unit = unitFromWord(m[3]);
  if (!unit) return null;
  return { amount: Number(m[2]), unit, upTo: Boolean(m[1]) };
}

// Formulaic 3.5 duration families → representative fixed value (REVIEW THESE).
const DURATION_POLICY: Array<[RegExp, string]> = [
  [/^permanent/i, 'Until dispelled'],
  [/^instantaneous/i, 'Instantaneous'],
  [/round\/level/i, '1 round'],
  [/min\.?\/level/i, '1 minute'],
  [/hour\/level/i, '1 hour'],
  [/day\/level|one day/i, '10 days'],
];

export function parseDurationFormula(raw: string): ScalingFormula | null {
  let s = stripTails(raw);
  let upTo = false;
  const conc = s.match(/^concentration,?\s*(.*)$/i);
  if (conc) {
    upTo = true;
    s = stripTails(conc[1]) || s;
  }
  if (/^up to /i.test(s)) {
    upTo = true;
    s = s.replace(/^up to\s+/i, '');
  }
  const perLevel = s.match(/^(one|\d+)\s*(round|minute|min\.?|hour|day)s?\/level$/i);
  if (!perLevel) return null;
  const base = quantityWord(perLevel[1]);
  const unit = unitFromWord(perLevel[2]);
  if (base == null || !unit) return null;
  return { base: 0, perLevel: base, perLevelDivisor: 1, unit, upTo };
}

export function normalizeDuration(raw: string): string {
  let s = stripTails(raw);
  if (s.length === 0) return 'Special';
  // 2024 phrasing: "Concentration, up to 1 minute" → our "Up to 1 minute"
  const conc = s.match(/^concentration,?\s*(?:\(?up to\)?\s*)?(.*)$/i);
  if (conc) {
    const base = parseBaseDuration(stripTails(conc[1]));
    if (base) return `Up to ${pluralize(base.amount, base.unit.slice(0, -1), base.unit)}`;
    // bare "Concentration" or per-level concentration → fall through to policy below
    s = stripTails(conc[1]) || s;
  }
  if (/^concentration$/i.test(s)) return 'Special';
  if (/^1 full round$/i.test(s)) return '1 round';
  if (/^1 day$/i.test(s)) return '24 hours';
  if (/^up to 1 day$/i.test(s)) return 'Up to 24 hours';
  if (/^instantaneous/i.test(s)) return 'Instantaneous';
  if (/until dispelled/i.test(s)) return 'Until dispelled';
  const base = parseBaseDuration(s);
  if (base) {
    const rendered = pluralize(base.amount, base.unit.slice(0, -1), base.unit);
    return base.upTo ? `Up to ${rendered}` : rendered;
  }
  for (const [re, value] of DURATION_POLICY) if (re.test(s)) return value;
  return s;
}

export function resolveDuration(raw: string, level: number): string {
  const formula = parseDurationFormula(raw);
  return formula ? formatResolvedFormula(formula, level) : normalizeDuration(raw);
}

function inferAreaShape(raw: string, shapeHint?: string): string | null {
  if (/emanation/i.test(raw)) return 'Emanation';
  if (/cone/i.test(raw)) return 'Cone';
  if (/cube/i.test(raw)) return 'Cube';
  if (/cylinder/i.test(raw)) return 'Cylinder';
  if (/\bline\b/i.test(raw)) return 'Line';
  if (/sphere/i.test(raw)) return 'Sphere';
  if (/circle/i.test(raw)) return 'Circle';
  return shapeHint && shapeHint !== 'None' ? shapeHint : null;
}

export function parseAreaFormula(raw: string, shapeHint?: string): AreaScaling | null {
  const s = stripTails(raw);
  const shape = inferAreaShape(s, shapeHint);
  if (!shape) return null;
  const canonical = s.match(/^(cone|cube|cylinder|line|sphere|circle)\s*\((\d+)\)$/i);
  if (canonical) {
    return {
      shape: canonical[1][0].toUpperCase() + canonical[1].slice(1).toLowerCase(),
      formula: { base: Number(canonical[2]), perLevel: 0, perLevelDivisor: 1, unit: 'feet' },
    };
  }
  const radiusPerLevel = s.match(/(\d+)\s*(?:-| )?(?:ft\.?|foot|feet)(?:-| )?radius.*?\/level/i);
  if (radiusPerLevel) {
    return {
      shape,
      formula: { base: 0, perLevel: Number(radiusPerLevel[1]), perLevelDivisor: 1, unit: 'feet' },
    };
  }
  const fixedRadius = s.match(/(\d+)\s*(?:-| )?(?:ft\.?|foot|feet)(?:-| )?radius/i);
  if (fixedRadius) {
    return {
      shape,
      formula: { base: Number(fixedRadius[1]), perLevel: 0, perLevelDivisor: 1, unit: 'feet' },
    };
  }
  const fixedSize = s.match(/(\d+)\s*(?:-| )?(?:ft\.?|foot|feet)\b/i);
  if (fixedSize) {
    return {
      shape,
      formula: { base: Number(fixedSize[1]), perLevel: 0, perLevelDivisor: 1, unit: 'feet' },
    };
  }
  return null;
}

export function resolveAreaNotation(raw: string, level: number, shapeHint?: string): string | null {
  const parsed = parseAreaFormula(raw, shapeHint);
  if (!parsed) return null;
  const amount = resolveScalingFormula(parsed.formula, level);
  return `${parsed.shape.toLowerCase()} (${amount})`;
}

export function hasScalingAttributeValue(raw: string | undefined | null): boolean {
  if (!raw) return false;
  return /\/level\b|\/\d+\s*levels?\b/i.test(stripTails(raw));
}

// Quick self-checks (run with: npx tsx app/src/data/normalizeAttributes.ts isn't wired; these
// are documentation of intent, mirror them into a vitest spec when we promote this).
// normalizeRange('30 ft.')                              -> '30 feet'
// normalizeRange('Close (25 ft. + 5 ft./2 levels)')     -> '30 feet'   (policy)
// normalizeRange('Personal; see text')                  -> 'Self'
// normalizeDuration('Concentration, up to 1 minute')    -> 'Up to 1 minute'
// normalizeDuration('1 min./level (D)')                 -> '1 minute'  (policy)
// normalizeDuration('Permanent')                        -> 'Until dispelled' (policy)
