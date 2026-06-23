import { describe, expect, it } from 'vitest';
import { buildDruidSpokes, indexBits } from './spokes';
import type { SpellAttributes } from './attributes';

const BASE: SpellAttributes = {
  level: 0,
  school: 'Abjuration',
  damage: 'None',
  area: 'None',
  areaNotation: 'None',
  range: 'Self',
  duration: 'Instantaneous',
  concentration: false,
  ritual: false,
};

describe('Druid spokes', () => {
  it('uses the source level binary, with the 1 mark farthest from the hub', () => {
    expect(indexBits(1, 4)).toEqual([0, 0, 0, 1]);
    expect(indexBits(8, 4)).toEqual([1, 0, 0, 0]);

    const sigil = buildDruidSpokes({ ...BASE, level: 1 }, { size: 100, padding: 10 });
    const level = sigil.spokes.find((sp) => sp.key === 'level')!;
    expect(level.marks).toHaveLength(1);
    expect(level.marks[0].kind).toBe('line');
    if (level.marks[0].kind === 'line') {
      expect(level.marks[0].y1).toBeLessThan(level.ay);
    }
  });

  it('reserves Druid school index zero for Blank before Abjuration', () => {
    const sigil = buildDruidSpokes(BASE, { size: 100, padding: 10 });
    const school = sigil.spokes.find((sp) => sp.key === 'school')!;
    expect(school.marks.some((m) => m.kind === 'circle')).toBe(true);
  });

  it('uses the agreed authored symbol sequence for each Druid school stave', () => {
    const kindsFor = (school: string) => buildDruidSpokes({ ...BASE, school }, { size: 160, padding: 12 })
      .spokes.find((sp) => sp.key === 'school')!.marks.map((mark) => mark.kind);

    expect(kindsFor('Abjuration')).toEqual(['line', 'circle']);
    expect(kindsFor('Conjuration')).toEqual(['circle', 'line', 'triangle']);
    expect(kindsFor('Divination')).toEqual(['circle']);
    expect(kindsFor('Enchantment')).toEqual(['line', 'line']);
    expect(kindsFor('Evocation')).toEqual(['triangle', 'line']);
    expect(kindsFor('Illusion')).toEqual(['circle', 'line', 'cycloid']);
    expect(kindsFor('Necromancy')).toEqual(['cycloid', 'circle']);
    expect(kindsFor('Transmutation')).toEqual(['triangle', 'line', 'circle']);
  });

  it('uses the agreed authored symbol sequence for each Druid damage stave', () => {
    const kindsFor = (damage: string) => buildDruidSpokes({ ...BASE, damage }, { size: 160, padding: 12 })
      .spokes.find((sp) => sp.key === 'damage')!.marks.map((mark) => mark.kind);

    expect(kindsFor('Acid')).toEqual(['circle', 'triangle']);
    expect(kindsFor('Bludgeoning')).toEqual(['circle']);
    expect(kindsFor('Cold')).toEqual(['cycloid']);
    expect(kindsFor('Fire')).toEqual(['triangle', 'cycloid']);
    expect(kindsFor('Force')).toEqual(['line', 'line', 'line', 'line']);
    expect(kindsFor('Lightning')).toEqual(['line', 'cycloid', 'line']);
    expect(kindsFor('Necrotic')).toEqual(['cycloid', 'circle']);
    expect(kindsFor('Piercing')).toEqual(['line']);
    expect(kindsFor('Poison')).toEqual(['circle', 'cycloid']);
    expect(kindsFor('Psychic')).toEqual(['circle', 'line', 'line']);
    expect(kindsFor('Radiant')).toEqual(['circle', 'line', 'circle']);
    expect(kindsFor('Slashing')).toEqual(['line', 'line', 'line', 'line']);
    expect(kindsFor('Thunder')).toEqual(['line', 'circle', 'line']);
    expect(kindsFor('Special')).toEqual(['line', 'line', 'line', 'triangle', 'circle']);
  });

  it('uses fine area notation for sized Druid area marks', () => {
    const none = buildDruidSpokes({ ...BASE, area: 'Sphere', areaNotation: 'None' }, { size: 100, padding: 10 })
      .spokes.find((sp) => sp.key === 'area')!;
    const sphere20 = buildDruidSpokes({ ...BASE, area: 'Sphere', areaNotation: 'sphere (20)' }, { size: 100, padding: 10 })
      .spokes.find((sp) => sp.key === 'area')!;

    expect(none.marks).toHaveLength(0);
    expect(sphere20.marks.length).toBeGreaterThan(0);
    expect(sphere20.marks.some((m) => m.kind === 'circle')).toBe(true);
  });

  it('uses the agreed area glyph on top of the area size marks', () => {
    const kindsFor = (areaNotation: string) => buildDruidSpokes({ ...BASE, area: 'Sphere', areaNotation }, { size: 160, padding: 12 })
      .spokes.find((sp) => sp.key === 'area')!.marks.map((mark) => mark.kind);

    expect(kindsFor('cone (15)')).toContain('triangle');
    expect(kindsFor('cube (10)')).toContain('cycloid');
    expect(kindsFor('cylinder (20)').filter((kind) => kind === 'line')).toHaveLength(4);
    expect(kindsFor('line (60)').filter((kind) => kind === 'line')).toHaveLength(6);
    expect(kindsFor('sphere (20)')).toContain('circle');
  });

  it('expands the area number system beyond eight bits without crowding the hub', () => {
    const area = buildDruidSpokes({ ...BASE, area: 'Cube', areaNotation: 'cube (500)' }, { size: 200, padding: 16 })
      .spokes.find((sp) => sp.key === 'area')!;
    const numericLines = area.marks.filter((mark) => mark.kind === 'line');

    expect(numericLines).toHaveLength(6); // 500 = 111110100 in binary.
    expect(area.marks.some((mark) => mark.kind === 'cycloid')).toBe(true);
  });

  it('uses the agreed non-numeric Druid range glyphs', () => {
    const kindsFor = (range: string) => buildDruidSpokes({ ...BASE, range }, { size: 160, padding: 12 })
      .spokes.find((sp) => sp.key === 'range')!.marks.map((mark) => mark.kind);

    expect(kindsFor('Self')).toEqual(['circle']);
    expect(kindsFor('Sight')).toEqual(['circle', 'line']);
    expect(kindsFor('Special')).toEqual(['circle', 'cycloid']);
    expect(kindsFor('Touch')).toEqual(['triangle', 'line']);
    expect(kindsFor('Unlimited')).toEqual(['circle', 'circle']);
  });

  it('uses number lines, binary magnitude bands, and an end X for miles', () => {
    const marksFor = (range: string) => buildDruidSpokes({ ...BASE, range }, { size: 180, padding: 14 })
      .spokes.find((sp) => sp.key === 'range')!.marks;

    expect(marksFor('30 feet').map((mark) => mark.kind)).toEqual(['line', 'line', 'line', 'line']);
    expect(marksFor('500 feet').map((mark) => mark.kind)).toEqual(['triangle', 'cycloid']);
    expect(marksFor('1000 feet').map((mark) => mark.kind)).toEqual(['circle', 'line']);
    expect(marksFor('1600 feet').map((mark) => mark.kind)).toEqual(['triangle']);
    expect(marksFor('1 mile').some((mark) => mark.kind === 'cycloid')).toBe(true);
  });

  it('adds authored Druid symbols on non-level staves while keeping level line-only', () => {
    const sigil = buildDruidSpokes({
      ...BASE,
      level: 3,
      school: 'Evocation',
      damage: 'Fire',
      area: 'Sphere',
      areaNotation: 'sphere (20)',
      range: '150 feet',
      duration: 'Up to 1 minute',
    }, { size: 160, padding: 12 });

    expect(sigil.spokes.find((sp) => sp.key === 'level')!.marks.every((m) => m.kind === 'line')).toBe(true);
    const school = sigil.spokes.find((sp) => sp.key === 'school')!;
    expect(school.marks.some((m) => m.kind === 'triangle')).toBe(true);
    expect(school.marks.filter((m) => m.kind === 'cycloid')).toHaveLength(0);
    expect(sigil.spokes.find((sp) => sp.key === 'damage')!.marks.some((m) => m.kind === 'cycloid')).toBe(true);
    expect(sigil.spokes.find((sp) => sp.key === 'area')!.marks.some((m) => m.kind === 'circle')).toBe(true);
    expect(sigil.spokes.find((sp) => sp.key === 'range')!.marks.some((m) => m.kind === 'triangle')).toBe(true);
    expect(sigil.spokes.find((sp) => sp.key === 'duration')!.marks.some((m) => m.kind === 'circle')).toBe(true);
  });
});
