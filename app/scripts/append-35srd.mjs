import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const tempRoot = path.join(root, '..', 'tmp', 'd20srd');
const indexPath = path.join(root, '..', 'tmp', 'd20srd-spells-index.html');
const spellsPath = path.join(root, 'src', 'data', 'spells.json');
const valuesPath = path.join(root, '..', 'docs', 'NEW_SPELL_VALUES.md');
const BASE_URL = 'https://www.d20srd.org';

const classNames = {
  Adept: 'Adept', Assassin: 'Assassin', Bard: 'Bard', Brd: 'Bard', Blackguard: 'Blackguard', Clr: 'Cleric', Cleric: 'Cleric',
  Drd: 'Druid', Druid: 'Druid', Pal: 'Paladin', Paladin: 'Paladin', Rgr: 'Ranger', Ranger: 'Ranger',
  Sor: 'Sorcerer', Sorcerer: 'Sorcerer', Wiz: 'Wizard', Wizard: 'Wizard',
};
const schools = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation', 'Universal'];
const damages = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'];
const engineValues = {
  school: new Set(schools.slice(0, -1)), damage: new Set(['None', ...damages]),
  range: new Set(['Self', 'Touch', '5 feet', '10 feet', '30 feet', '60 feet', '90 feet', '100 feet', '120 feet', '150 feet', '300 feet', '500 feet', '500 miles', '1 mile', 'Sight', 'Unlimited', 'Special']),
  duration: new Set(['Instantaneous', '1 round', '1 minute', '10 minutes', '1 hour', '8 hours', '24 hours', '7 days', '10 days', '30 days', 'Until dispelled', 'Special', 'Up to 1 round', 'Up to 1 minute', 'Up to 10 minutes', 'Up to 1 hour', 'Up to 2 hours', 'Up to 8 hours', 'Up to 24 hours']),
  areaShape: new Set(['None', 'Cone', 'Cube', 'Cylinder', 'Line', 'Sphere', 'Square', 'Wall', 'Circle', 'Multiple targets', 'Single target']),
  areaSound: new Set(['None']),
};

function decode(value) {
  return value.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&rsquo;|&#8217;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&mdash;/g, '-').replace(/&#[^;]+;/g, '');
}
function text(value) { return decode(value.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()); }
function key(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function slug(name) { return `${key(name).replace(/ /g, '-')}-35srd`; }
function cell(table, label) {
  for (const row of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map((match) => text(match[1]));
    if (cells.length >= 2 && cells[0].replace(/:$/, '').trim() === label) return cells[1];
  }
  return '';
}
function sourceDamage(description) { return damages.find((damage) => new RegExp(`\\b${damage} damage\\b`, 'i').test(description)) ?? 'None'; }
function sourceArea(value) {
  if (!value) return { areaShape: 'None', areaSound: 'None' };
  const lower = value.toLowerCase();
  const shape = lower.includes('cone') ? 'Cone' : lower.includes('cube') ? 'Cube' : lower.includes('cylinder') ? 'Cylinder' : lower.includes('line') ? 'Line' : lower.includes('sphere') ? 'Sphere' : lower.includes('spread') ? 'Spread' : lower.includes('ray') ? 'Ray' : lower.includes('wall') ? 'Wall' : 'Effect';
  return { areaShape: shape, areaSound: value };
}
function classesAndLevel(value) {
  const matches = [...value.matchAll(/([A-Za-z]+(?:\/[A-Za-z]+)*)\s+(\d+)/g)];
  const levels = [];
  const classes = new Set();
  for (const [, rawClasses, rawLevel] of matches) {
    for (const raw of rawClasses.split('/')) classes.add(classNames[raw] ?? raw);
    levels.push(Number(rawLevel));
  }
  return { level: levels.length ? Math.min(...levels) : null, classes: [...classes].sort() };
}
function parse(html) {
  const name = text(html.match(/<h1>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
  const schoolLine = text(html.match(/<h4>([\s\S]*?)<\/h4>/i)?.[1] ?? '');
  const school = schools.find((entry) => new RegExp(`\\b${entry}\\b`, 'i').test(schoolLine));
  const statTable = html.match(/<table[^>]*class=["'][^"']*statBlock[^"']*["'][^>]*>([\s\S]*?)<\/table>/i)?.[1] ?? '';
  const levelAndClasses = classesAndLevel(cell(statTable, 'Level'));
  const components = cell(statTable, 'Components') || cell(statTable, 'Component');
  const castingTime = cell(statTable, 'Casting Time');
  const range = cell(statTable, 'Range');
  const duration = cell(statTable, 'Duration');
  const area = cell(statTable, 'Area') || cell(statTable, 'Effect');
  const afterTable = html.slice((html.indexOf(statTable) + statTable.length));
  const spellContent = afterTable.split(/<h6|<div\s+class=["']footer/i)[0];
  const paragraphs = [...spellContent.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => text(match[1])).filter(Boolean);
  const description = paragraphs.join(' ');
  const inherits = spellContent.match(/(?:functions|works) (?:like|similarly to)(?: a)?\s+<a[^>]*href=["']\/srd\/spells\/([^"']+\.htm)["']/i)?.[1] ?? '';
  if (!name || !school || levelAndClasses.level === null || !description) return null;
  const shape = sourceArea(area);
  return {
    id: slug(name), name, source: 'D&D 3.5 SRD', level: levelAndClasses.level, school,
    damage: sourceDamage(description), areaShape: shape.areaShape, areaSound: shape.areaSound,
    range, duration, concentration: /\bconcentration\b/i.test(duration), ritual: false, castingTime, components,
    classes: levelAndClasses.classes, description, inherits,
  };
}

const index = fs.readFileSync(indexPath, 'utf8');
const links = [...index.matchAll(/href="(\/srd\/spells\/[^"#]+\.htm)">([^<]+)<\/a>/gi)].map((match) => ({ href: match[1], name: text(match[2]) }));
const uniqueLinks = [...new Map(links.map((link) => [link.href, link])).values()].filter((link) => !link.name.includes('(Spell Name)'));
fs.mkdirSync(tempRoot, { recursive: true });
for (const link of uniqueLinks) {
  const file = path.join(tempRoot, path.basename(link.href));
  if (fs.existsSync(file)) continue;
  const response = await fetch(`${BASE_URL}${link.href}`);
  if (!response.ok) throw new Error(`Failed ${response.status} for ${link.href}`);
  fs.writeFileSync(file, await response.text());
}

const parsed = uniqueLinks.map((link) => parse(fs.readFileSync(path.join(tempRoot, path.basename(link.href)), 'utf8'))).filter(Boolean);
const byFile = new Map(parsed.map((spell) => [`${key(spell.name).replace(/ /g, '')}.htm`, spell]));
const byHref = new Map(uniqueLinks.map((link) => [path.basename(link.href), parsed.find((spell) => spell.id === slug(link.name))]).filter(([, spell]) => spell));

function resolveInherited(spell, seen = new Set()) {
  if (!spell.inherits || seen.has(spell.id)) return spell;
  const parent = byHref.get(spell.inherits);
  if (!parent) return spell;
  resolveInherited(parent, new Set([...seen, spell.id]));
  for (const field of ['components', 'castingTime', 'range', 'duration', 'areaShape', 'areaSound']) {
    if (!spell[field]) spell[field] = parent[field];
  }
  return spell;
}
parsed.forEach((spell) => resolveInherited(spell));
const sourceErrata = new Map([
  ['confusion-lesser-35srd', { castingTime: '1 standard action' }],
]);
for (const spell of parsed) Object.assign(spell, sourceErrata.get(spell.id));
for (const spell of parsed) delete spell.inherits;
const existing = JSON.parse(fs.readFileSync(spellsPath, 'utf8'));
const baseline = existing.filter((spell) => spell.source !== 'D&D 3.5 SRD');
const ids = new Set(baseline.map((spell) => spell.id));
const additions = parsed.filter((spell) => !ids.has(spell.id)).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
if (additions.length !== parsed.length) throw new Error('A 3.5 SRD id already exists; stop rather than overwrite.');

const byName = Map.groupBy(baseline, (spell) => key(spell.name));
const fields = ['level', 'school', 'damage', 'areaShape', 'areaSound', 'range', 'duration', 'concentration', 'ritual', 'castingTime', 'components'];
const conflicts = [];
for (const spell of additions) for (const prior of byName.get(key(spell.name)) ?? []) for (const field of fields) {
  if (JSON.stringify(prior[field]) !== JSON.stringify(spell[field])) conflicts.push({ spell: spell.name, field, existing: `${prior.source}: ${JSON.stringify(prior[field])}`, imported: `D&D 3.5 SRD: ${JSON.stringify(spell[field])}` });
}

const introduced = {};
for (const [field, supported] of Object.entries(engineValues)) {
  const counts = new Map();
  for (const spell of additions) if (!supported.has(spell[field])) counts.set(spell[field], (counts.get(spell[field]) ?? 0) + 1);
  introduced[field] = [...counts.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

const previousReport = fs.existsSync(valuesPath) ? fs.readFileSync(valuesPath, 'utf8') : '# New Spell Values\n';
const report = [previousReport.trimEnd(), '', '## D&D 3.5 SRD Batch', '', 'Licensing attributions live in `NOTICE.md`.', `- Added: ${additions.length} records`, '', '### Values Outside Current Engine Lookups', '', ...Object.entries(introduced).flatMap(([field, values]) => [`#### ${field}`, ...(values.length ? values.map(([value, count]) => `- \`${value}\`: ${count}`) : ['- None']), '']), '### Source Conflicts With Existing Records', '', ...conflicts.map((row) => `- **${row.spell}** - \`${row.field}\`: existing ${row.existing}; imported ${row.imported}`), ''].join('\n');
fs.writeFileSync(spellsPath, JSON.stringify([...baseline, ...additions], null, 2) + '\n');
fs.writeFileSync(valuesPath, report);
console.log(JSON.stringify({ indexed: uniqueLinks.length, parsed: parsed.length, added: additions.length, conflicts: conflicts.length, introduced }, null, 2));
