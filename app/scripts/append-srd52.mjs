import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const spellsPath = path.join(root, 'src', 'data', 'spells.json');
const sourcePath = path.join(root, '..', 'tmp', 'srd52', 'dnd-5e-srd-markdown-master', 'spells.md');
const valuesPath = path.join(root, '..', 'docs', 'NEW_SPELL_VALUES.md');

const existing = JSON.parse(fs.readFileSync(spellsPath, 'utf8'));
const markdown = fs.readFileSync(sourcePath, 'utf8');

const SCHOOLS = new Set(['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation']);
const DAMAGES = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'];
const ENGINE_VALUES = {
  school: new Set([...SCHOOLS]),
  damage: new Set(['None', ...DAMAGES]),
  range: new Set(['Self', 'Touch', '5 feet', '10 feet', '30 feet', '60 feet', '90 feet', '100 feet', '120 feet', '150 feet', '300 feet', '500 feet', '500 miles', '1 mile', 'Sight', 'Unlimited', 'Special']),
  duration: new Set(['Instantaneous', '1 round', '1 minute', '10 minutes', '1 hour', '8 hours', '24 hours', '7 days', '10 days', '30 days', 'Until dispelled', 'Special', 'Up to 1 round', 'Up to 1 minute', 'Up to 10 minutes', 'Up to 1 hour', 'Up to 2 hours', 'Up to 8 hours', 'Up to 24 hours']),
  areaShape: new Set(['None', 'Cone', 'Cube', 'Cylinder', 'Line', 'Sphere', 'Square', 'Wall', 'Circle', 'Multiple targets', 'Single target']),
  areaSound: new Set(['None', 'cone (15)', 'cone (30)', 'cone (40)', 'cone (60)', 'cube (5)', 'cube (10)', 'cube (15)', 'cube (20)', 'cube (30)', 'cube (40)', 'cube (100)', 'cube (150)', 'cube (200)', 'cube (2500)', 'cube (5280)', 'cube (40000)', 'cylinder (5)', 'cylinder (10)', 'cylinder (20)', 'cylinder (40)', 'cylinder (50)', 'cylinder (60)', 'line (50)', 'line (60)', 'line (90)', 'line (100)', 'sphere (5)', 'sphere (10)', 'sphere (15)', 'sphere (20)', 'sphere (30)', 'sphere (40)', 'sphere (60)', 'sphere (100)', 'sphere (360)']),
};

function clean(value) {
  return value.replace(/\*\*/g, '').replace(/_/g, '').replace(/\[(.*?)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
}

function slug(name) {
  return `${name.toLowerCase().normalize('NFKD').replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-srd52`;
}

function key(name) {
  return name.toLowerCase().normalize('NFKD').replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function sourceDamage(text) {
  const found = DAMAGES.find((damage) => new RegExp(`\\b${damage} damage\\b`, 'i').test(text));
  return found ?? 'None';
}

function areaFrom(text, range) {
  const subject = `${range} ${text}`;
  const match = subject.match(/(\d+)[- ]foot(?:[- ]radius)?\s+(Cone|Cube|Cylinder|Emanation|Line|Sphere)/i);
  if (!match) return { areaShape: 'None', areaSound: 'None' };
  const [, amount, rawShape] = match;
  const shape = rawShape[0].toUpperCase() + rawShape.slice(1).toLowerCase();
  return { areaShape: shape, areaSound: `${shape.toLowerCase()} (${amount})` };
}

function parseEntry(chunk) {
  const lines = chunk.split('\n');
  const name = clean(lines.shift() ?? '');
  const meta = lines.find((line) => /^_(?:Level \d+ |[A-Z][a-z]+ Cantrip )/.test(line));
  if (!name || !meta) return null;
  const body = meta.slice(1, -1);
  const cantrip = body.match(/^(\w+) Cantrip \((.+)\)$/);
  const leveled = body.match(/^Level (\d+) (\w+) \((.+)\)$/);
  const level = cantrip ? 0 : Number(leveled?.[1]);
  const school = cantrip?.[1] ?? leveled?.[2];
  const classes = (cantrip?.[2] ?? leveled?.[3] ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!Number.isInteger(level) || !SCHOOLS.has(school)) return null;

  const stat = (label) => clean(lines.find((line) => line.startsWith(`**${label}:**`))?.replace(`**${label}:**`, '') ?? '');
  const castingTime = stat('Casting Time');
  const range = stat('Range');
  const components = stat('Components') || stat('Component');
  const durationRaw = stat('Duration');
  const ritual = /\bor Ritual\b/i.test(castingTime);
  const concentration = /^Concentration,/i.test(durationRaw);
  const descriptionLines = lines.filter((line) => line && !line.startsWith('**') && !line.startsWith('_'));
  const description = clean(descriptionLines.join(' '));
  const area = areaFrom(description, range);
  return {
    id: slug(name),
    name,
    source: 'SRD 5.2',
    level,
    school,
    damage: sourceDamage(description),
    areaShape: area.areaShape,
    areaSound: area.areaSound,
    range,
    duration: durationRaw,
    concentration,
    ritual,
    castingTime,
    components,
    classes,
    description,
  };
}

const descriptionStart = markdown.indexOf('## Spell Descriptions');
const parsed = markdown.slice(descriptionStart).split(/^#### /m).slice(1).map(parseEntry).filter(Boolean);
const baseline = existing.filter((spell) => spell.source !== 'SRD 5.2');
const ids = new Set(baseline.map((spell) => spell.id));
const additions = parsed.filter((spell) => !ids.has(spell.id)).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
if (additions.length !== parsed.length) throw new Error('An SRD 5.2 id already exists; stop rather than overwrite.');

const beforeByName = Map.groupBy(baseline, (spell) => key(spell.name));
const fields = ['level', 'school', 'damage', 'areaShape', 'areaSound', 'range', 'duration', 'concentration', 'ritual', 'castingTime', 'components'];
const conflicts = [];
for (const spell of additions) {
  for (const prior of beforeByName.get(key(spell.name)) ?? []) {
    for (const field of fields) {
      if (JSON.stringify(prior[field]) !== JSON.stringify(spell[field])) {
        conflicts.push({ spell: spell.name, field, existing: `${prior.source}: ${JSON.stringify(prior[field])}`, imported: `SRD 5.2: ${JSON.stringify(spell[field])}` });
      }
    }
  }
}

const introduced = {};
for (const field of Object.keys(ENGINE_VALUES)) {
  const counts = new Map();
  for (const spell of additions) {
    const value = spell[field];
    if (!ENGINE_VALUES[field].has(value)) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  introduced[field] = [...counts.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

const rows = Object.entries(introduced).map(([field, values]) => [field, values]);
const report = [
  '# New Spell Values',
  '',
  'Licensing attributions live in `NOTICE.md`.',
  '',
  '## Imported Batch',
  '',
  `- SRD 5.2: ${additions.length} records`,
  '',
  '## Values Outside Current Engine Lookups',
  '',
  ...rows.flatMap(([field, values]) => [
    `### ${field}`,
    ...(values.length ? values.map(([value, count]) => `- \`${value}\`: ${count}`) : ['- None']),
    '',
  ]),
  '## Source Conflicts With Existing Records',
  '',
  'These are intentional edition/data-review flags. Existing records were not changed.',
  '',
  ...(conflicts.length ? conflicts.map((row) => `- **${row.spell}** - \`${row.field}\`: existing ${row.existing}; imported ${row.imported}`) : ['- None']),
  '',
].join('\n');

fs.writeFileSync(spellsPath, JSON.stringify([...baseline, ...additions], null, 2) + '\n');
fs.writeFileSync(valuesPath, report);
console.log(JSON.stringify({ parsed: parsed.length, added: additions.length, conflicts: conflicts.length, introduced }, null, 2));
