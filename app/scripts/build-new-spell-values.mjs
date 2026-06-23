import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const spellsPath = path.join(root, 'src', 'data', 'spells.json');
const reportPath = path.join(root, '..', 'docs', 'NEW_SPELL_VALUES.md');
const importedSources = ['SRD 5.1', 'SRD 5.2', 'D&D 3.5 SRD'];
const supported = {
  school: new Set(['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation']),
  damage: new Set(['None', 'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder']),
  range: new Set(['Self', 'Touch', '5 feet', '10 feet', '30 feet', '60 feet', '90 feet', '100 feet', '120 feet', '150 feet', '300 feet', '500 feet', '500 miles', '1 mile', 'Sight', 'Unlimited', 'Special']),
  duration: new Set(['Instantaneous', '1 round', '1 minute', '10 minutes', '1 hour', '8 hours', '24 hours', '7 days', '10 days', '30 days', 'Until dispelled', 'Special', 'Up to 1 round', 'Up to 1 minute', 'Up to 10 minutes', 'Up to 1 hour', 'Up to 2 hours', 'Up to 8 hours', 'Up to 24 hours']),
  areaShape: new Set(['None', 'Cone', 'Cube', 'Cylinder', 'Line', 'Sphere', 'Square', 'Wall', 'Circle', 'Multiple targets', 'Single target']),
  areaSound: new Set(['None', 'cone (15)', 'cone (30)', 'cone (40)', 'cone (60)', 'cube (5)', 'cube (10)', 'cube (15)', 'cube (20)', 'cube (30)', 'cube (40)', 'cube (100)', 'cube (150)', 'cube (200)', 'cube (2500)', 'cube (5280)', 'cube (40000)', 'cylinder (5)', 'cylinder (10)', 'cylinder (20)', 'cylinder (40)', 'cylinder (50)', 'cylinder (60)', 'line (50)', 'line (60)', 'line (90)', 'line (100)', 'sphere (5)', 'sphere (10)', 'sphere (15)', 'sphere (20)', 'sphere (30)', 'sphere (40)', 'sphere (60)', 'sphere (100)', 'sphere (360)']),
};
const comparedFields = ['level', 'school', 'damage', 'areaShape', 'areaSound', 'range', 'duration', 'concentration', 'ritual', 'castingTime', 'components', 'classes'];

function key(name) {
  return name.toLowerCase().normalize('NFKD').replace(/[â€™']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function counts(spells, field) {
  const values = new Map();
  for (const spell of spells) {
    const value = spell[field];
    if (!supported[field].has(value)) values.set(value, (values.get(value) ?? 0) + 1);
  }
  return [...values.entries()].sort(([a], [b]) => String(a).localeCompare(String(b)));
}

const all = JSON.parse(fs.readFileSync(spellsPath, 'utf8'));
const baseline = all.filter((spell) => !importedSources.includes(spell.source));
const byName = Map.groupBy(baseline, (spell) => key(spell.name));
const lines = [
  '# New Spell Values',
  '',
  'This report records values introduced by the imported open-rule spell batches that current notation lookups do not support. `areaNotation` is stored in the existing JSON shape as `areaSound`.',
  '',
  'Licensing attributions live in `NOTICE.md`.',
  '',
  '## Schema Notes',
  '',
  '- `atHigherLevels` is an intentional optional field. When scaling text is extracted reliably it is stored separately; otherwise it remains inside `description`.',
  '- 3.5 class lists are retained in full. Because the current record model has one `level`, it stores the lowest listed class level.',
  '',
  '## Imported Records',
  '',
  ...importedSources.map((source) => `- ${source}: ${all.filter((spell) => spell.source === source).length}`),
];

for (const source of importedSources) {
  const spells = all.filter((spell) => spell.source === source);
  lines.push('', `## ${source}: Values Outside Current Engine Lookups`, '');
  for (const field of Object.keys(supported)) {
    const values = counts(spells, field);
    const label = field === 'areaSound' ? 'areaNotation (stored as areaSound)' : field;
    lines.push(`### ${label}`, '');
    lines.push(...(values.length ? values.map(([value, count]) => `- \`${value}\`: ${count}`) : ['- None']), '');
  }
}

lines.push('## Source Values That Disagree With Existing Records', '', 'Each entry compares an imported source value with a same-named record that existed before these two import batches. It is intentionally a flag for review, not an automatic correction.');
for (const source of importedSources) {
  const conflicts = [];
  for (const spell of all.filter((entry) => entry.source === source)) {
    for (const prior of byName.get(key(spell.name)) ?? []) {
      for (const field of comparedFields) {
        if (JSON.stringify(prior[field]) !== JSON.stringify(spell[field])) {
          conflicts.push({ spell: spell.name, field, existing: `${prior.source}: ${JSON.stringify(prior[field])}`, imported: `${source}: ${JSON.stringify(spell[field])}` });
        }
      }
    }
  }
  lines.push('', `### ${source} (${conflicts.length} differences)`, '');
  lines.push(...(conflicts.length ? conflicts.map((row) => `- **${row.spell}** - \`${row.field}\`: existing ${row.existing}; imported ${row.imported}`) : ['- None']));
}

fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
console.log(JSON.stringify({ report: reportPath, imported: importedSources.map((source) => [source, all.filter((spell) => spell.source === source).length]) }, null, 2));
