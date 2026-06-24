import { describe, expect, it } from 'vitest';
import { toAttributes, type Spell } from '../data/spells';
import { SPELLS } from '../data/spellLibrary';
import { notationSupportForMode } from './notationSupport';

function spell(id: string): Spell {
  const found = SPELLS.find((entry) => entry.id === id);
  if (!found) throw new Error(`Missing test spell: ${id}`);
  return found;
}

describe('notationSupportForMode', () => {
  it('flags unsupported 3.5 area notation instead of treating it as canonical wizard notation', () => {
    const support = notationSupportForMode('wizard', toAttributes(spell('acid-splash-35srd')));
    expect(support.unsupported).toContain('area');
  });

  it('stays quiet for a fully supported canonical fireball in wizard mode', () => {
    const support = notationSupportForMode('wizard', toAttributes(spell('fireball-srd52')));
    expect(support.unsupported).toEqual([]);
  });

  it('treats scalar sorcerer area glyphs as supported when the notation is canonical', () => {
    const support = notationSupportForMode('sorcerer', toAttributes(spell('fireball-srd52')));
    expect(support.unsupported).not.toContain('area');
  });
});
