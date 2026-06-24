import type { AttributeKey, SpellAttributes } from './attributes';
import { FEATURES } from './attributes';
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

export type GlyphMode = 'wizard' | 'sorcerer' | 'druid' | 'warlock';

export type NotationSupport = {
  unsupported: AttributeKey[];
  supported: Partial<Record<AttributeKey, boolean>>;
};

const CORE_SCHOOLS = new Set(FEATURES.school);
const CORE_DAMAGE = new Set(FEATURES.damage);
const CORE_RANGE = new Set(FEATURES.range);
const CORE_DURATION = new Set(FEATURES.duration);

const DETAILED_AREA = new Set([
  'none',
  'cone (15)', 'cone (30)', 'cone (40)', 'cone (60)',
  'cube (10)', 'cube (100)', 'cube (15)', 'cube (150)', 'cube (20)', 'cube (200)',
  'cube (2500)', 'cube (30)', 'cube (40)', 'cube (40000)', 'cube (5)', 'cube (5280)',
  'cylinder (10)', 'cylinder (20)', 'cylinder (40)', 'cylinder (5)', 'cylinder (50)', 'cylinder (60)',
  'line (100)', 'line (50)', 'line (60)', 'line (90)',
  'sphere (10)', 'sphere (100)', 'sphere (15)', 'sphere (20)', 'sphere (30)',
  'sphere (360)', 'sphere (40)', 'sphere (5)', 'sphere (60)',
]);

const SORCERER_AREA_SHAPES = new Set(['Cone', 'Cube', 'Cylinder', 'Line', 'Sphere', 'Circle', 'Emanation', 'Wall', 'Square']);
const WARLOCK_AREA_SHAPES = new Set(['Cone', 'Cube', 'Cylinder', 'Line', 'Sphere', 'Circle', 'Emanation']);

function canon(value: string | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function areaNotationValue(attrs: SpellAttributes) {
  return attrs.areaNotation && attrs.areaNotation !== 'None' ? attrs.areaNotation : attrs.area;
}

function supportsDetailedArea(attrs: SpellAttributes) {
  return DETAILED_AREA.has(canon(areaNotationValue(attrs)));
}

function supportsSorcererArea(attrs: SpellAttributes) {
  const value = areaNotationValue(attrs);
  if (canon(value) === 'none') return true;
  const parsed = parseAreaFormula(value, attrs.area);
  return Boolean(parsed && SORCERER_AREA_SHAPES.has(parsed.shape));
}

function supportsWarlockArea(attrs: SpellAttributes, casterLevel: number) {
  const value = areaNotationValue(attrs);
  if (DETAILED_AREA.has(canon(value))) return true;
  const resolved = resolveAreaNotation(value, casterLevel, attrs.area);
  const parsed = resolved ? parseAreaFormula(resolved, attrs.area) : parseAreaFormula(value, attrs.area);
  return Boolean(parsed && WARLOCK_AREA_SHAPES.has(parsed.shape));
}

function supportsWarlockRange(range: string, casterLevel: number) {
  if (CORE_RANGE.has(range)) return true;
  if (parseRangeFormula(range)) return true;
  const normalized = parseRangeFormula(range) ? resolveRange(range, casterLevel) : normalizeRange(range);
  return CORE_RANGE.has(normalized) || /^\d+\s+(feet|mile|miles)$/i.test(normalized);
}

function supportsWarlockDuration(duration: string, casterLevel: number) {
  if (CORE_DURATION.has(duration)) return true;
  if (parseDurationFormula(duration)) return true;
  const normalized = parseDurationFormula(duration) ? resolveDuration(duration, casterLevel) : normalizeDuration(duration);
  return CORE_DURATION.has(normalized) || /^(Up to\s+)?\d+\s+(round|rounds|minute|minutes|hour|hours|day|days)$/i.test(normalized);
}

function supportsCoreDamage(attrs: SpellAttributes) {
  return CORE_DAMAGE.has(attrs.damage) && (!attrs.damageSecondary || CORE_DAMAGE.has(attrs.damageSecondary));
}

export function notationSupportForMode(
  mode: GlyphMode,
  attrs: SpellAttributes,
  casterLevel = attrs.casterLevel ?? 1,
): NotationSupport {
  const supported: Partial<Record<AttributeKey, boolean>> = {
    level: attrs.level >= 0 && attrs.level <= 9,
    school: CORE_SCHOOLS.has(attrs.school),
    damage: supportsCoreDamage(attrs),
  };

  if (mode === 'warlock') {
    supported.area = supportsWarlockArea(attrs, casterLevel);
    supported.range = supportsWarlockRange(attrs.range, casterLevel);
    supported.duration = supportsWarlockDuration(attrs.duration, casterLevel);
  } else if (mode === 'sorcerer') {
    supported.area = supportsSorcererArea(attrs);
    supported.range = CORE_RANGE.has(attrs.range);
    supported.duration = CORE_DURATION.has(attrs.duration);
  } else {
    supported.area = supportsDetailedArea(attrs);
    supported.range = CORE_RANGE.has(attrs.range);
    supported.duration = CORE_DURATION.has(attrs.duration);
  }

  const unsupported = (Object.entries(supported) as Array<[AttributeKey, boolean | undefined]>)
    .filter(([, ok]) => ok === false)
    .map(([key]) => key);

  return { supported, unsupported };
}
