import { SPELLS, type Spell } from './spells';

export type CollisionVariant = {
  signature: string;
  index: number;
  count: number;
  diphthong: string; // appended to the spoken name to disambiguate collisions ('' for the first)
};

// When several spells share a full notation, the 2nd, 3rd… get a distinct diphthong woven into
// the spoken name so they're audibly different. The 1st keeps the clean canonical name.
const VARIANT_DIPHTHONGS = ['ai', 'ei', 'oi', 'au', 'ou', 'ia', 'io', 'eu', 'ua', 'ui', 'ae', 'oe'];

function variantDiphthong(index: number): string {
  if (index <= 1) return '';
  return VARIANT_DIPHTHONGS[index - 2] ?? `${VARIANT_DIPHTHONGS[(index - 2) % VARIANT_DIPHTHONGS.length]}${index}`;
}

type VariantRecord = {
  spell: Spell;
  castLevel: number;
  key: string;
  signature: string;
};

const MAX_CAST_LEVEL = 9;

export function notationSignature(spell: Spell, castLevel: number) {
  return [
    castLevel,
    spell.school,
    spell.damage,
    spell.areaNotation,
    spell.range,
    spell.duration,
  ].join('|');
}

function compareRecords(a: VariantRecord, b: VariantRecord) {
  return (
    a.spell.source.localeCompare(b.spell.source) ||
    a.spell.name.localeCompare(b.spell.name) ||
    a.spell.id.localeCompare(b.spell.id) ||
    a.castLevel - b.castLevel
  );
}

function spellCastLevels(spell: Spell) {
  if (spell.level === 0 || spell.level > MAX_CAST_LEVEL) return [spell.level];
  return Array.from({ length: MAX_CAST_LEVEL - spell.level + 1 }, (_, i) => spell.level + i);
}

function buildVariantIndex() {
  const bySignature = new Map<string, VariantRecord[]>();

  for (const spell of SPELLS) {
    for (const castLevel of spellCastLevels(spell)) {
      if (castLevel > MAX_CAST_LEVEL) continue;
      const signature = notationSignature(spell, castLevel);
      const record: VariantRecord = {
        spell,
        castLevel,
        key: `${spell.id}@${castLevel}`,
        signature,
      };
      const records = bySignature.get(signature) ?? [];
      records.push(record);
      bySignature.set(signature, records);
    }
  }

  const bySpellCast = new Map<string, CollisionVariant>();
  for (const [signature, records] of bySignature) {
    const byName = new Map<string, VariantRecord[]>();
    for (const record of records) {
      const key = record.spell.name.toLowerCase();
      const bucket = byName.get(key) ?? [];
      bucket.push(record);
      byName.set(key, bucket);
    }

    if (byName.size < 2) continue;

    const uniqueSpells = Array.from(byName.values())
      .map((bucket) => [...bucket].sort(compareRecords));
    const sorted = uniqueSpells.sort((a, b) => compareRecords(a[0], b[0]));
    sorted.forEach((bucket, i) => {
      const index = i + 1;
      bucket.forEach((record) => {
        bySpellCast.set(record.key, {
          signature,
          index,
          count: sorted.length,
          diphthong: variantDiphthong(index),
        });
      });
    });
  }

  return bySpellCast;
}

const VARIANTS = buildVariantIndex();

export function collisionVariantFor(spell: Spell, castLevel: number): CollisionVariant | null {
  return VARIANTS.get(`${spell.id}@${castLevel}`) ?? null;
}
