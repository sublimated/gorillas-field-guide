import { describe, expect, it } from 'vitest';
import { SPELLS } from './spellLibrary';
import { buildCollisionVariantIndex, collisionVariantFor, notationSignature } from './collisionVariants';

const VARIANTS = buildCollisionVariantIndex(SPELLS);

function spell(id: string) {
  const found = SPELLS.find((s) => s.id === id);
  if (!found) throw new Error(`Missing fixture spell: ${id}`);
  return found;
}

describe('collision variants', () => {
  it('keeps Eruption classified with its primary Fire damage', () => {
    expect(spell('eruption')).toMatchObject({
      damage: 'Fire',
      areaShape: 'Circle',
      areaNotation: 'circle (80)',
      duration: '10 minutes',
    });
  });

  it('marks known full-notation collisions', () => {
    const barkskin = spell('barkskin');
    const variant = collisionVariantFor(barkskin, 2, VARIANTS);

    expect(variant).toMatchObject({
      signature: notationSignature(barkskin, 2),
      count: 4,
    });
    expect(variant?.index).toBeGreaterThanOrEqual(1);
  });

  it('uses quiet spoken diphthongs instead of visible numeric variants', () => {
    const barkskin = collisionVariantFor(spell('barkskin'), 2, VARIANTS);
    const enhanceAbility = collisionVariantFor(spell('enhance-ability'), 2, VARIANTS);

    expect(barkskin).toMatchObject({ index: 1, diphthong: '' });
    expect(enhanceAbility).toMatchObject({ index: 2, diphthong: 'ai' });
  });

  it('does not mark unique spell/cast signatures', () => {
    expect(collisionVariantFor(spell('acid-splash'), 3, VARIANTS)).toBeNull();
  });

  it('uses the cast slot in the collision signature', () => {
    const barkskin = spell('barkskin');

    expect(collisionVariantFor(barkskin, 2, VARIANTS)?.signature).toBe(notationSignature(barkskin, 2));
    expect(collisionVariantFor(barkskin, 3, VARIANTS)?.signature).toBe(notationSignature(barkskin, 3));
  });
});
