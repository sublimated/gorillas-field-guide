// Sound engine, per "The Spell Saying Guide".
// Each attribute value maps to a syllable; concatenated in order they form the
// spoken name. Verified against the guide: Fireball -> "Luire-Sonosin",
// Acid Arrow -> "Hucid-'ylar".

const LEVEL: Record<number, string> = {
  0: 'C', 1: 'S', 2: 'H', 3: 'L', 4: 'V', 5: 'T', 6: 'R', 7: 'M', 8: 'N', 9: 'Xy',
};

const SCHOOL: Record<string, string> = {
  Abjuration: 'A', Conjuration: 'E', Divination: 'I', Enchantment: 'O',
  Evocation: 'U', Illusion: 'Ai', Necromancy: 'Ou', Transmutation: 'Ie',
};

const DAMAGE: Record<string, string> = {
  None: "'", Acid: 'Cid', Bludgeoning: 'Deg', Cold: 'Lod', Fire: 'Ire',
  Force: 'Ton', Lightning: 'Nin', Necrotic: 'Rho', Piercing: 'Ix', Poison: 'Nis',
  Psychic: 'Char', Radiant: 'Nat', Slashing: 'Sih', Thunder: 'Der',
};

// Area uses the fine-grained, sized keys from the guide.
const AREA: Record<string, string> = {
  None: "'",
  'cone (15)': 'Nu', 'cone (30)': 'Ne', 'cone (40)': 'Né', 'cone (60)': 'No',
  'cube (5)': 'Bu', 'cube (10)': 'Be', 'cube (15)': 'Bé', 'cube (20)': 'Bo',
  'cube (30)': 'Bor', 'cube (40)': 'Boe', 'cube (100)': 'Bi', 'cube (150)': 'Ba',
  'cube (200)': 'Bai', 'cube (2500)': 'Boé', 'cube (5280)': 'Bae', 'cube (40000)': 'Bie',
  'cylinder (5)': 'Xu', 'cylinder (10)': 'Xe', 'cylinder (20)': 'Xé',
  'cylinder (40)': 'Xo', 'cylinder (50)': 'Xi', 'cylinder (60)': 'Xa',
  'line (50)': 'Lu', 'line (60)': 'Le', 'line (90)': 'Lé', 'line (100)': 'Lo',
  'sphere (5)': 'Su', 'sphere (10)': 'Se', 'sphere (15)': 'Sé', 'sphere (20)': 'So',
  'sphere (30)': 'Sor', 'sphere (40)': 'Soe', 'sphere (60)': 'Si',
  'sphere (100)': 'Sa', 'sphere (360)': 'Sai',
};

const RANGE: Record<string, string> = {
  Self: 'Por', Touch: 'Lix', '5 feet': 'Wosin', '10 feet': 'Spul', '30 feet': 'Usin',
  '60 feet': 'Wyn', '90 feet': 'Ylar', '100 feet': 'Spon', '120 feet': 'Mul',
  '150 feet': 'Nosin', '300 feet': 'Sphin', '500 feet': 'Sin', '500 miles': 'Qul',
  '1 mile': 'Yp', Sight: 'Tor', Special: 'Intix', Unlimited: 'Ash',
};

const DURATION: Record<string, string> = {
  Instantaneous: '', '1 hour': 'A', '1 minute': 'E', '1 round': 'I', '10 days': 'Y',
  '10 minutes': 'S', '24 hours': 'L', '30 days': 'Ai', '7 days': 'Ei', '8 hours': 'Iy',
  Special: 'Yl', 'Until dispelled': 'Is', 'Up to 1 hour': 'Si', 'Up to 1 minute': 'Se',
  'Up to 1 round': 'Es', 'Up to 10 minutes': 'Ly', 'Up to 2 hours': 'Ay',
  'Up to 24 hours': 'Yi', 'Up to 8 hours': 'Os',
};

export type SoundInput = {
  level: number;
  castLevel?: number; // if set and > level, apply up-cast grammar
  school: string;
  damage: string; // "None" or a damage type
  areaNotation: string; // full Area slot notation, e.g. "sphere (20)", or "None"
  range: string;
  duration: string;
};

export type SoundPart = {
  label: string; // attribute label
  value: string; // human value
  syllable: string; // the sound
};

export type SpokenName = {
  name: string; // formatted (e.g. "Luire-Sonosin")
  parts: SoundPart[];
};

function format(raw: string): string {
  // Per the guide: lowercase everything, then capitalise the first letter of
  // each "-"-separated half — but NOT when that half starts with a "'" break
  // (e.g. "Luire-Sonosin", but "Hucid-'ylar").
  return raw
    .split('-')
    .map((seg) => {
      const lower = seg.toLowerCase();
      if (lower.startsWith("'")) return lower;
      const i = lower.search(/[a-z]/);
      return i < 0 ? lower : lower.slice(0, i) + lower[i].toUpperCase() + lower.slice(i + 1);
    })
    .join('-');
}

export function spokenName(s: SoundInput): SpokenName {
  const levelSyl = LEVEL[s.level] ?? '';
  const schoolSyl = SCHOOL[s.school] ?? '';
  const damageSyl = DAMAGE[s.damage] ?? "'";
  const areaSyl = AREA[s.areaNotation] ?? "'";
  const rangeSyl = RANGE[s.range] ?? '';
  const durSyl = DURATION[s.duration] ?? '';

  const noDamage = s.damage === 'None';
  const noArea = s.areaNotation === 'None';

  // Up-cast: a higher slot level is being used than the spell's base level.
  const upcastTo = s.castLevel !== undefined && s.castLevel > s.level ? s.castLevel : null;
  const castSyl = upcastTo !== null ? (LEVEL[upcastTo] ?? '') : '';

  let raw: string;
  if (noDamage && noArea) {
    raw = levelSyl + schoolSyl + rangeSyl + durSyl;
  } else {
    const leftFull = levelSyl + schoolSyl + damageSyl;
    const rightFull = areaSyl + rangeSyl + durSyl;
    raw = leftFull + '-' + rightFull;
  }

  // Fused up-cast form: prepend castLevel sound + 'i' (disambiguating per the guide).
  // e.g. L3 Fireball cast at 5 → T + i + Luire-Sonosin → "Tiluire-Sonosin"
  if (upcastTo !== null) {
    raw = castSyl + 'i' + raw;
  }

  const parts: SoundPart[] = [];
  if (upcastTo !== null) {
    parts.push({ label: 'Up-cast', value: `→ ${upcastTo}`, syllable: castSyl + 'i' });
  }
  parts.push(
    { label: 'Level', value: String(s.level), syllable: levelSyl },
    { label: 'School', value: s.school, syllable: schoolSyl },
    { label: 'Damage', value: s.damage, syllable: damageSyl },
    { label: 'Area', value: s.areaNotation, syllable: areaSyl },
    { label: 'Range', value: s.range, syllable: rangeSyl },
    { label: 'Duration', value: s.duration, syllable: durSyl || '—' },
  );

  return { name: format(raw), parts };
}
