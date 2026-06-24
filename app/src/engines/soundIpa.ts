// Phonemic companion to sound.ts, for driving Kokoro TTS directly by phoneme rather than
// letting a generic English phonemizer guess at our invented spellings (which mangles them
// unpredictably — "Luire-Sonosin" is not an English word). Every table here mirrors sound.ts's
// keys exactly; each spelled syllable gets a fixed, hand-authored phonemic transcription using
// only the symbols Kokoro's underlying model actually understands (Misaki's American-English
// vocabulary — see https://github.com/hexgrad/misaki/blob/main/EN_PHONES.md). That guarantees a
// spell sounds the same every time, instead of drifting with whatever a generic g2p model guesses.
//
// IMPORTANT: Misaki's diphthongs (eɪ, aɪ, aʊ, ɔɪ, oʊ) are each a single compact symbol — A, I, W,
// Y, O respectively — not the decomposed two-character IPA spelling. Always use the compact form;
// the decomposed form silently gets stripped by the model's tokenizer (it's not in its vocab).
import type { SoundInput } from './sound';

const LEVEL_IPA: Record<number, string> = {
  0: 'k', 1: 's', 2: 'h', 3: 'l', 4: 'v', 5: 't', 6: 'ɹ', 7: 'm', 8: 'n', 9: 'zI',
};

const SCHOOL_IPA: Record<string, string> = {
  Abjuration: 'A', Conjuration: 'i', Divination: 'I', Enchantment: 'O',
  Evocation: 'u', Illusion: 'Y', Necromancy: 'W', Transmutation: 'iə',
};

const DAMAGE_IPA: Record<string, string> = {
  None: '', Acid: 'sɪd', Bludgeoning: 'dɛɡ', Cold: 'lɑd', Fire: 'Iɹ',
  Force: 'tɑn', Lightning: 'nɪn', Necrotic: 'ɹO', Piercing: 'ɪks', Poison: 'nɪs',
  Psychic: 'ʧɑɹ', Radiant: 'næt', Slashing: 'sI', Thunder: 'dɛɹ',
};

const AREA_IPA: Record<string, string> = {
  None: '',
  'cone (15)': 'nʊ', 'cone (30)': 'nɛ', 'cone (40)': 'nA', 'cone (60)': 'nO',
  'cube (5)': 'bʊ', 'cube (10)': 'bɛ', 'cube (15)': 'bA', 'cube (20)': 'bO',
  'cube (30)': 'bɔɹ', 'cube (40)': 'bY', 'cube (100)': 'bi', 'cube (150)': 'bɑ',
  'cube (200)': 'bI', 'cube (2500)': 'bOA', 'cube (5280)': 'bAɛ', 'cube (40000)': 'bIə',
  'cylinder (5)': 'zʊ', 'cylinder (10)': 'zɛ', 'cylinder (20)': 'zA',
  'cylinder (40)': 'zO', 'cylinder (50)': 'zi', 'cylinder (60)': 'zɑ',
  'line (50)': 'lʊ', 'line (60)': 'lɛ', 'line (90)': 'lA', 'line (100)': 'lO',
  'sphere (5)': 'sʊ', 'sphere (10)': 'sɛ', 'sphere (15)': 'sA', 'sphere (20)': 'sO',
  'sphere (30)': 'sɔɹ', 'sphere (40)': 'sY', 'sphere (60)': 'si',
  'sphere (100)': 'sɑ', 'sphere (360)': 'sI',
};

const RANGE_IPA: Record<string, string> = {
  Self: 'pɔɹ', Touch: 'lɪks', '5 feet': 'wOsɪn', '10 feet': 'spʊl', '30 feet': 'usɪn',
  '60 feet': 'wɪn', '90 feet': 'Ilɑɹ', '100 feet': 'spɑn', '120 feet': 'mʊl',
  '150 feet': 'nOsɪn', '300 feet': 'sfɪn', '500 feet': 'sɪn', '500 miles': 'kwʊl',
  '1 mile': 'Ip', Sight: 'tɔɹ', Special: 'ɪntɪks', Unlimited: 'æʃ',
};

// Built from one base phoneme per letter (A=eɪ, E=ɛ, I=ɪ, Y=aɪ, S=s, L=l, O=oʊ — same letter
// regardless of case, since sound.ts's spelling case carries no phonetic meaning of its own),
// concatenated in the order the letters appear in sound.ts's DURATION spelling.
const DURATION_IPA: Record<string, string> = {
  Instantaneous: '', '1 hour': 'A', '1 minute': 'ɛ', '1 round': 'ɪ', '10 days': 'I',
  '10 minutes': 's', '24 hours': 'l', '30 days': 'Aɪ', '7 days': 'ɛɪ', '8 hours': 'ɪI',
  Special: 'Il', 'Until dispelled': 'ɪs', 'Up to 1 hour': 'sɪ', 'Up to 1 minute': 'sɛ',
  'Up to 1 round': 'ɛs', 'Up to 10 minutes': 'lI', 'Up to 2 hours': 'AI',
  'Up to 24 hours': 'Iɪ', 'Up to 8 hours': 'Os',
};

// Exposed only so tests can validate every table entry against Kokoro's vocabulary exhaustively,
// not just whatever a handful of sample spells happen to touch.
export function allPhonemeTokens(): string[] {
  return [
    ...Object.values(LEVEL_IPA),
    ...Object.values(SCHOOL_IPA),
    ...Object.values(DAMAGE_IPA),
    ...Object.values(AREA_IPA),
    ...Object.values(RANGE_IPA),
    ...Object.values(DURATION_IPA),
  ];
}

// Mirrors spokenName()'s raw-string construction in sound.ts exactly, but in phonemes instead
// of spelling, and with a single primary-stress mark on the first syllable instead of
// capitalization/hyphenation (which are spelling conventions with no phonemic meaning).
export function spokenIpa(s: SoundInput): string {
  const levelP = LEVEL_IPA[s.level] ?? '';
  const schoolP = SCHOOL_IPA[s.school] ?? '';
  const damageP = DAMAGE_IPA[s.damage] ?? '';
  const areaP = AREA_IPA[s.areaNotation] ?? '';
  const rangeP = RANGE_IPA[s.range] ?? '';
  const durP = DURATION_IPA[s.duration] ?? '';

  const noDamage = s.damage === 'None';
  const noArea = s.areaNotation === 'None';

  const upcastTo = s.castLevel !== undefined && s.castLevel > s.level ? s.castLevel : null;
  const castP = upcastTo !== null ? (LEVEL_IPA[upcastTo] ?? '') : '';

  let raw: string;
  if (noDamage && noArea) {
    raw = levelP + schoolP + rangeP + durP;
  } else {
    raw = levelP + schoolP + damageP + areaP + rangeP + durP;
  }

  if (upcastTo !== null) {
    raw = castP + 'i' + raw;
  }

  return 'ˈ' + raw;
}

const DIPHTHONG_LETTER_IPA: Record<string, string> = { a: 'ɑ', e: 'ɛ', i: 'ɪ', o: 'O', u: 'ʊ' };

// Mirrors collisionVariants.ts's VARIANT_DIPHTHONGS spellings, so colliding spells stay
// distinguishable by ear, not just by eye.
export function diphthongIpa(diphthong: string): string {
  return diphthong
    .split('')
    .map((letter) => DIPHTHONG_LETTER_IPA[letter] ?? '')
    .join('');
}
