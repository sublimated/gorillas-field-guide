import type { AttributeKey } from '../engines/attributes';

export type NumeralAtom = 5 | 10 | 15 | 30 | 40 | 50 | 60 | 100 | 200 | 300 | 500;
type RangeUnit = 'feet' | 'mile' | 'miles';
type DurationUnit = 'round' | 'rounds' | 'minute' | 'minutes' | 'hour' | 'hours' | 'day' | 'days';

export type NumberedGlyphValue =
  | { kind: 'area'; shape: string; number: number }
  | { kind: 'range'; unit: RangeUnit; number: number }
  | { kind: 'duration'; unit: DurationUnit; number: number; upTo: boolean };

const ATOMS: NumeralAtom[] = [500, 300, 200, 100, 60, 50, 40, 30, 15, 10, 5];

export function titleAreaNotation(areaNotation: string): string {
  const m = areaNotation.match(/^([a-z]+)\s+\((\d+)\)$/i);
  if (!m) return areaNotation;
  return `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} (${m[2]})`;
}

export function decomposeNumber(value: number): NumeralAtom[] {
  if (!Number.isFinite(value) || value <= 0) return [];
  const atoms: NumeralAtom[] = [];
  let remaining = Math.round(value);
  for (const atom of ATOMS) {
    while (remaining >= atom) {
      atoms.push(atom);
      remaining -= atom;
    }
  }
  return remaining === 0 ? atoms : [];
}

export function parseNumberedGlyphValue(attr: AttributeKey, value: string): NumberedGlyphValue | null {
  if (attr === 'area') {
    const m = value.match(/^(Cone|Cube|Cylinder|Line|Sphere)\s+\((\d+)\)$/i);
    if (!m) return null;
    return { kind: 'area', shape: `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()}`, number: Number(m[2]) };
  }

  if (attr === 'range') {
    const m = value.match(/^(\d+)\s+(feet|mile|miles)$/i);
    if (!m) return null;
    return { kind: 'range', number: Number(m[1]), unit: m[2].toLowerCase() as RangeUnit };
  }

  if (attr === 'duration') {
    const m = value.match(/^(Up to\s+)?(\d+)\s+(rounds?|minutes?|hours?|days?)$/i);
    if (!m) return null;
    return {
      kind: 'duration',
      number: Number(m[2]),
      unit: m[3].toLowerCase() as DurationUnit,
      upTo: Boolean(m[1]),
    };
  }

  return null;
}

export function isComposedNumberGlyph(attr: AttributeKey, value: string): boolean {
  const parsed = parseNumberedGlyphValue(attr, value);
  return parsed !== null && decomposeNumber(parsed.number).length > 0;
}
