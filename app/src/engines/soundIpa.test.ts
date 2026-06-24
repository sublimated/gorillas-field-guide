import { describe, it, expect } from 'vitest';
import { spokenIpa, diphthongIpa, allPhonemeTokens } from './soundIpa';
import type { SoundInput } from './sound';

// Symbols valid in Kokoro/Misaki's American-English vocabulary (EN_PHONES.md), plus the
// stress mark we always prepend. Anything outside this set would be silently stripped by the
// model's tokenizer normalizer, so every fixture here must stay inside it. Listed individually
// (no a-z style ranges) so this can't accidentally admit a character that isn't really in vocab.
const VALID_CHARS = 'ˈˌAIWYOæɑɔɛɜɪʊʌəiubdfhjklmnpstvwzɡŋɹʃʒðθʤʧɾᵻᵊ';
const VALID = new RegExp(`^[${VALID_CHARS}]*$`, 'u');

const FIXTURES: Array<{ spell: string; input: SoundInput }> = [
  { spell: 'Fireball', input: { level: 3, school: 'Evocation', damage: 'Fire', areaNotation: 'sphere (20)', range: '150 feet', duration: 'Instantaneous' } },
  { spell: 'Lightning Bolt', input: { level: 3, school: 'Evocation', damage: 'Lightning', areaNotation: 'line (100)', range: 'Self', duration: 'Instantaneous' } },
  { spell: 'Acid Arrow', input: { level: 2, school: 'Evocation', damage: 'Acid', areaNotation: 'None', range: '90 feet', duration: 'Instantaneous' } },
  { spell: 'Cure Wounds', input: { level: 1, school: 'Evocation', damage: 'None', areaNotation: 'None', range: 'Touch', duration: 'Instantaneous' } },
  { spell: 'Counterspell', input: { level: 3, school: 'Abjuration', damage: 'None', areaNotation: 'None', range: '60 feet', duration: 'Instantaneous' } },
];

describe('spokenIpa — produces only valid Kokoro/Misaki phoneme symbols', () => {
  for (const { spell, input } of FIXTURES) {
    it(`${spell} phoneme string uses only known symbols`, () => {
      const ipa = spokenIpa(input);
      expect(ipa).toMatch(VALID);
      expect(ipa.startsWith('ˈ')).toBe(true);
    });
  }

  it('every individual table entry (level/school/damage/area/range/duration) is valid on its own', () => {
    // Exhaustive, not just whatever the sample spells above happen to touch — this is exactly
    // the kind of check that catches a single mistyped token in an otherwise-unused row.
    for (const token of allPhonemeTokens()) {
      expect(token).toMatch(VALID);
    }
  });
});

describe('spokenIpa — mirrors spokenName grammar', () => {
  it('drops damage/area phonemes entirely when both are None (fused form)', () => {
    const ipa = spokenIpa({ level: 1, school: 'Evocation', damage: 'None', areaNotation: 'None', range: 'Touch', duration: 'Instantaneous' });
    // level 's' + school 'u' + range 'lɪks' (Touch), no damage/area inserted
    expect(ipa).toBe('ˈsulɪks');
  });

  it('keeps an (empty) damage slot distinct from the fused case when only one side is None', () => {
    const withAreaNone = spokenIpa({ level: 2, school: 'Evocation', damage: 'Acid', areaNotation: 'None', range: '90 feet', duration: 'Instantaneous' });
    const fused = spokenIpa({ level: 2, school: 'Evocation', damage: 'None', areaNotation: 'None', range: '90 feet', duration: 'Instantaneous' });
    expect(withAreaNone).not.toBe(fused);
    expect(withAreaNone.startsWith('ˈhusɪd')).toBe(true);
  });

  it('fuses an up-cast level with an "i" connector, same as the text grammar', () => {
    const base = spokenIpa({ level: 3, school: 'Evocation', damage: 'Fire', areaNotation: 'sphere (20)', range: '150 feet', duration: 'Instantaneous' });
    const upcast = spokenIpa({ level: 3, castLevel: 5, school: 'Evocation', damage: 'Fire', areaNotation: 'sphere (20)', range: '150 feet', duration: 'Instantaneous' });
    // castLevel 5's own phoneme is just "t" — the connector "i" is a separate inserted vowel.
    expect(upcast).toBe('ˈt' + 'i' + base.slice(1));
  });

  it('no upcast prefix when castLevel equals level', () => {
    const a = spokenIpa({ level: 3, school: 'Evocation', damage: 'Fire', areaNotation: 'sphere (20)', range: '150 feet', duration: 'Instantaneous' });
    const b = spokenIpa({ level: 3, castLevel: 3, school: 'Evocation', damage: 'Fire', areaNotation: 'sphere (20)', range: '150 feet', duration: 'Instantaneous' });
    expect(a).toBe(b);
  });
});

describe('diphthongIpa', () => {
  it('maps each collision-variant letter to a phoneme', () => {
    expect(diphthongIpa('ai')).toBe('ɑɪ');
    expect(diphthongIpa('')).toBe('');
  });

  it('only emits valid symbols for every known collision diphthong', () => {
    const known = ['ai', 'ei', 'oi', 'au', 'ou', 'ia', 'io', 'eu', 'ua', 'ui', 'ae', 'oe'];
    for (const d of known) {
      expect(diphthongIpa(d)).toMatch(VALID);
      expect(diphthongIpa(d)).not.toBe('');
    }
  });
});
