import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const spellsPath = path.join(root, 'src', 'data', 'spells.json');
const glyphDir = path.join(root, 'public', 'glyphs', 'sorcerer');

const RANGE_ALIASES = {
  '5ft': '5 feet',
  '15 ft': 'Special',
  '15ft': 'Special',
  '30ft': '30 feet',
  '60ft': '60 feet',
  '150ft': '150 feet',
  '300ft': '300 feet',
};

const DURATION_ALIASES = {
  'Until the beginning of your next turn': 'Special',
  'Until the end of your turn or a spell is cast': 'Special',
  'Up to 1 minute or until the': 'Special',
};

const spells = JSON.parse(fs.readFileSync(spellsPath, 'utf8')).map((spell) => ({
  ...spell,
  areaNotation: spell.areaNotation ?? spell.areaSound ?? 'None',
  range: RANGE_ALIASES[spell.range] ?? spell.range,
  duration: DURATION_ALIASES[spell.duration] ?? spell.duration,
  classes: (spell.classes ?? []).map((c) => c.replace(/\.+$/, '')),
}));

const FEATURES = {
  level: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  school: ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'],
  damage: ['None', 'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'],
  areaShape: ['None', 'Cone', 'Cube', 'Cylinder', 'Line', 'Sphere', 'Square', 'Wall', 'Circle', 'Multiple targets', 'Single target'],
  range: ['Self', 'Touch', '5 feet', '10 feet', '30 feet', '60 feet', '90 feet', '100 feet', '120 feet', '150 feet', '300 feet', '500 feet', '500 miles', '1 mile', 'Sight', 'Unlimited', 'Special'],
  duration: ['Instantaneous', '1 round', '1 minute', '10 minutes', '1 hour', '8 hours', '24 hours', '7 days', '10 days', '30 days', 'Until dispelled', 'Special', 'Up to 1 round', 'Up to 1 minute', 'Up to 10 minutes', 'Up to 1 hour', 'Up to 2 hours', 'Up to 8 hours', 'Up to 24 hours'],
};

const AREA_NOTATION = new Set([
  'None',
  'cone (15)', 'cone (30)', 'cone (40)', 'cone (60)',
  'cube (5)', 'cube (10)', 'cube (15)', 'cube (20)', 'cube (30)', 'cube (40)', 'cube (100)', 'cube (150)', 'cube (200)', 'cube (2500)', 'cube (5280)', 'cube (40000)',
  'cylinder (5)', 'cylinder (10)', 'cylinder (20)', 'cylinder (40)', 'cylinder (50)', 'cylinder (60)',
  'line (50)', 'line (60)', 'line (90)', 'line (100)',
  'sphere (5)', 'sphere (10)', 'sphere (15)', 'sphere (20)', 'sphere (30)', 'sphere (40)', 'sphere (60)', 'sphere (100)', 'sphere (360)',
]);

const required = [
  'id', 'name', 'source', 'level', 'school', 'damage', 'areaShape', 'areaNotation',
  'range', 'duration', 'concentration', 'ritual', 'castingTime', 'components', 'classes', 'description',
];

function countBy(items, getKey) {
  const counts = new Map();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

function duplicatesBy(getKey) {
  return [...Map.groupBy(spells, getKey)].filter(([, group]) => group.length > 1);
}

function groupCollisions(records, getKey) {
  return [...Map.groupBy(records, getKey)]
    .filter(([, group]) => group.length > 1)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

function areaSlug(value) {
  return value
    .replace(/^([a-z])/, (m) => m.toUpperCase())
    .replace(/\s+\(/, '-')
    .replace(/[()]/g, '');
}

function sorcererAreaGlyphExists(value) {
  const slug = value === 'None' ? 'None' : areaSlug(value);
  return fs.existsSync(path.join(glyphDir, `Sorcerer_Area_${slug}.svg`));
}

const missingFields = [];
const invalid = [];
const unresolvedAreaNotation = [];
const missingAreaGlyphs = [];
const dirtyClassNames = [];
const damageNoneCandidates = [];
const areaNoneCandidates = [];

for (const spell of spells) {
  for (const field of required) {
    const value = spell[field];
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      missingFields.push({ spell: spell.name, field });
    }
  }

  for (const [field, allowed] of Object.entries(FEATURES)) {
    const value = field === 'level' ? String(spell.level) : spell[field];
    if (!allowed.includes(value)) invalid.push({ spell: spell.name, field, value });
  }

  if (!AREA_NOTATION.has(spell.areaNotation)) unresolvedAreaNotation.push({ spell: spell.name, areaNotation: spell.areaNotation });
  if (!sorcererAreaGlyphExists(spell.areaNotation)) missingAreaGlyphs.push({ spell: spell.name, areaNotation: spell.areaNotation });

  for (const cls of spell.classes ?? []) {
    if (/[.]$/.test(cls)) dirtyClassNames.push({ spell: spell.name, className: cls });
  }

  if (spell.damage === 'None') {
    const match = spell.description.match(/\b\d+d\d+\s+(Acid|Bludgeoning|Cold|Fire|Force|Lightning|Necrotic|Piercing|Poison|Psychic|Radiant|Slashing|Thunder)\s+damage\b/i);
    if (match) damageNoneCandidates.push({ spell: spell.name, damageText: match[0] });
  }

  if (spell.areaNotation === 'None') {
    const match = spell.description.match(/\bwithin\s+\d+\s*(?:ft|feet)\s+of\b/i);
    if (match) areaNoneCandidates.push({ spell: spell.name, areaText: match[0] });
  }
}

console.log('Spell Data Audit');
console.log('================');
console.log(`Total spells: ${spells.length}`);
console.log('');

console.log('By source:');
for (const [source, count] of countBy(spells, (s) => s.source)) console.log(`  ${source}: ${count}`);
console.log('');

console.log('By class:');
for (const [cls, count] of countBy(spells.flatMap((s) => s.classes), (c) => c)) console.log(`  ${cls}: ${count}`);
console.log('');

console.log(`Duplicate ids: ${duplicatesBy((s) => s.id).length}`);
console.log(`Duplicate names: ${duplicatesBy((s) => s.name.toLowerCase()).length}`);
console.log(`Missing required fields: ${missingFields.length}`);
console.log(`Invalid topology values: ${invalid.length}`);
console.log(`Unresolved area notation values: ${unresolvedAreaNotation.length}`);
console.log(`Missing Sorcerer area glyph files: ${missingAreaGlyphs.length}`);
console.log(`Dirty class names after normalization: ${dirtyClassNames.length}`);
console.log(`Damage None semantic candidates: ${damageNoneCandidates.length}`);
console.log(`Area None semantic candidates: ${areaNoneCandidates.length}`);
console.log('');

function printSample(label, rows) {
  if (rows.length === 0) return;
  console.log(`${label} (first 20):`);
  for (const row of rows.slice(0, 20)) console.log(`  ${JSON.stringify(row)}`);
  console.log('');
}

printSample('Missing fields', missingFields);
printSample('Invalid topology values', invalid);
printSample('Unresolved area notation values', unresolvedAreaNotation);
printSample('Missing Sorcerer area glyph files', missingAreaGlyphs);
printSample('Damage None semantic candidates', damageNoneCandidates);
printSample('Area None semantic candidates', areaNoneCandidates);

const SOUND = {
  level: { 0: 'C', 1: 'S', 2: 'H', 3: 'L', 4: 'V', 5: 'T', 6: 'R', 7: 'M', 8: 'N', 9: 'Xy' },
  school: {
    Abjuration: 'A', Conjuration: 'E', Divination: 'I', Enchantment: 'O',
    Evocation: 'U', Illusion: 'Ai', Necromancy: 'Ou', Transmutation: 'Ie',
  },
  damage: {
    None: "'", Acid: 'Cid', Bludgeoning: 'Deg', Cold: 'Lod', Fire: 'Ire',
    Force: 'Ton', Lightning: 'Nin', Necrotic: 'Rho', Piercing: 'Ix', Poison: 'Nis',
    Psychic: 'Char', Radiant: 'Nat', Slashing: 'Sih', Thunder: 'Der',
  },
  area: {
    None: "'",
    'cone (15)': 'Nu', 'cone (30)': 'Ne', 'cone (40)': 'Ne2', 'cone (60)': 'No',
    'cube (5)': 'Bu', 'cube (10)': 'Be', 'cube (15)': 'Be2', 'cube (20)': 'Bo',
    'cube (30)': 'Bor', 'cube (40)': 'Boe', 'cube (100)': 'Bi', 'cube (150)': 'Ba',
    'cube (200)': 'Bai', 'cube (2500)': 'Boe2', 'cube (5280)': 'Bae', 'cube (40000)': 'Bie',
    'cylinder (5)': 'Xu', 'cylinder (10)': 'Xe', 'cylinder (20)': 'Xe2',
    'cylinder (40)': 'Xo', 'cylinder (50)': 'Xi', 'cylinder (60)': 'Xa',
    'line (50)': 'Lu', 'line (60)': 'Le', 'line (90)': 'Le2', 'line (100)': 'Lo',
    'sphere (5)': 'Su', 'sphere (10)': 'Se', 'sphere (15)': 'Se2', 'sphere (20)': 'So',
    'sphere (30)': 'Sor', 'sphere (40)': 'Soe', 'sphere (60)': 'Si',
    'sphere (100)': 'Sa', 'sphere (360)': 'Sai',
  },
  range: {
    Self: 'Por', Touch: 'Lix', '5 feet': 'Wosin', '10 feet': 'Spul', '30 feet': 'Usin',
    '60 feet': 'Wyn', '90 feet': 'Ylar', '100 feet': 'Spon', '120 feet': 'Mul',
    '150 feet': 'Nosin', '300 feet': 'Sphin', '500 feet': 'Sin', '500 miles': 'Qul',
    '1 mile': 'Yp', Sight: 'Tor', Special: 'Intix', Unlimited: 'Ash',
  },
  duration: {
    Instantaneous: '', '1 hour': 'A', '1 minute': 'E', '1 round': 'I', '10 days': 'Y',
    '10 minutes': 'S', '24 hours': 'L', '30 days': 'Ai', '7 days': 'Ei', '8 hours': 'Iy',
    Special: 'Yl', 'Until dispelled': 'Is', 'Up to 1 hour': 'Si', 'Up to 1 minute': 'Se',
    'Up to 1 round': 'Es', 'Up to 10 minutes': 'Ly', 'Up to 2 hours': 'Ay',
    'Up to 24 hours': 'Yi', 'Up to 8 hours': 'Os',
  },
};

function formatSpoken(raw) {
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

function spokenSignature(record) {
  const spell = record.spell;
  const levelSyl = SOUND.level[spell.level] ?? '';
  const schoolSyl = SOUND.school[spell.school] ?? '';
  const damageSyl = SOUND.damage[spell.damage] ?? "'";
  const areaSyl = SOUND.area[spell.areaNotation] ?? "'";
  const rangeSyl = SOUND.range[spell.range] ?? '';
  const durationSyl = SOUND.duration[spell.duration] ?? '';
  const noDamage = spell.damage === 'None';
  const noArea = spell.areaNotation === 'None';
  const upcastTo = record.castLevel > spell.level ? record.castLevel : null;
  const castSyl = upcastTo !== null ? (SOUND.level[upcastTo] ?? '') : '';

  let raw = noDamage && noArea
    ? levelSyl + schoolSyl + rangeSyl + durationSyl
    : levelSyl + schoolSyl + damageSyl + '-' + areaSyl + rangeSyl + durationSyl;

  if (upcastTo !== null) raw = castSyl + 'i' + raw;
  return formatSpoken(raw);
}

function notationSignature(record) {
  const spell = record.spell;
  return [
    record.castLevel,
    spell.school,
    spell.damage,
    spell.areaNotation,
    spell.range,
    spell.duration,
  ].join('|');
}

function currentTopologySignature(record) {
  const spell = record.spell;
  return [
    record.castLevel,
    spell.school,
    spell.damage,
    spell.areaShape,
    spell.range,
    spell.duration,
  ].join('|');
}

function recordLabel(record) {
  const slot = record.castLevel > record.spell.level ? ` @ slot ${record.castLevel}` : '';
  return `${record.spell.name}${slot} [${record.spell.source}]`;
}

function castVariants(spell) {
  if (spell.level === 0 || spell.level > 9) return [{ spell, castLevel: spell.level }];
  return Array.from({ length: 10 - spell.level }, (_, i) => ({ spell, castLevel: spell.level + i }));
}

const validSpells = spells.filter((spell) => spell.level <= 9);
const baseRecords = validSpells.map((spell) => ({ spell, castLevel: spell.level }));
const expandedRecords = spells.flatMap(castVariants).filter((record) => record.castLevel <= 9);

function printCollisionReport(label, records) {
  const checks = [
    ['spoken name', spokenSignature],
    ['full notation glyph', notationSignature],
    ['current topology glyph', currentTopologySignature],
    ['spoken + full notation', (record) => `${spokenSignature(record)} || ${notationSignature(record)}`],
  ];

  console.log(`${label}`);
  console.log('-'.repeat(label.length));
  console.log(`Records: ${records.length}`);
  for (const [name, getKey] of checks) {
    const collisions = groupCollisions(records, getKey);
    const spellsInCollision = collisions.reduce((sum, [, group]) => sum + group.length, 0);
    console.log(`${name}: ${collisions.length} colliding signatures, ${spellsInCollision} records affected`);
    for (const [signature, group] of collisions.slice(0, 5)) {
      console.log(`  ${signature}`);
      console.log(`    ${group.map(recordLabel).join(' | ')}`);
    }
  }
  console.log('');
}

console.log('Collision Audit');
console.log('===============');
printCollisionReport('Base spells only', baseRecords);
printCollisionReport('Expanded cast variants', expandedRecords);
