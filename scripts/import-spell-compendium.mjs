import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
};
const inputFile = argument('--input', 'Spell Compendium (Premium Edition).txt');
const sourcePath = path.join(root, 'tmp', 'pdfs', 'text', inputFile);
const dataPath = path.join(root, 'app', 'src', 'data', 'spells.json');
const SOURCE = argument('--source', 'Spell Compendium (3.5)');
const ID_SUFFIX = argument('--id-suffix', 'spellcompendium35');

const CORE_CLASSES = new Map([
  ['bard', 'Bard'], ['cleric', 'Cleric'], ['druid', 'Druid'], ['paladin', 'Paladin'],
  ['ranger', 'Ranger'], ['sorcerer', 'Sorcerer'], ['wizard', 'Wizard'],
]);
const SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];
const DAMAGE = ['Acid', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Poison', 'Psychic', 'Radiant', 'Thunder'];

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function clean(value) {
  return value.replace(/â€™/g, "'").replace(/â€“|â€”/g, '-').replace(/\s+/g, ' ').trim();
}

function title(value) {
  return clean(value).toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isNameLine(value) {
  return /^[A-Z][A-Z0-9 ,'\-]+$/.test(value) && /[A-Z]/.test(value) && value.length < 62;
}

function joinedField(lines, start, label) {
  const first = lines[start].replace(new RegExp(`^${label}:\\s*`, 'i'), '');
  const values = [first];
  if (label === 'Level') {
    for (let index = start + 1; index < Math.min(lines.length, start + 3); index += 1) {
      const line = lines[index];
      if (!line || /^[A-Z][A-Za-z ]+:/.test(line) || /^(Components|Casting Time|Range|Target|Targets|Effect|Area|Duration|Saving Throw|Spell Resistance):/i.test(line)) break;
      if (!/[\/,]$/.test(values.at(-1)) && !/^(?:bard|cleric|druid|paladin|ranger|sorcerer|wizard|assassin|blackguard)\b/i.test(line)) break;
      values.push(line);
    }
  } else if (/\d$/.test(values[0])) {
    const continuation = lines[start + 1] ?? '';
    if (/^(?:feet|ft\.?|rounds?|minutes?|hours?|days?|weeks?|months?|years?)(?:\b|\/)/i.test(continuation)) {
      values.push(continuation);
    }
  }
  return clean(values.join(' '));
}

function parseClasses(levelLine) {
  const classes = new Set();
  const levels = [];
  const re = /([A-Za-z/]+)\s*(\d+)/g;
  for (const match of levelLine.matchAll(re)) {
    for (const raw of match[1].toLowerCase().split('/')) {
      const className = CORE_CLASSES.get(raw);
      if (className) classes.add(className);
    }
    levels.push(Number(match[2]));
  }
  return { classes: [...classes].sort(), level: levels.length ? Math.min(...levels) : null };
}

function deriveDamage(block) {
  for (const value of DAMAGE) {
    if (new RegExp(`\\b${value}\\b`, 'i').test(block)) return value;
  }
  return 'None';
}

function deriveArea(area) {
  if (!area) return { areaShape: 'None', areaNotation: 'None' };
  const value = clean(area);
  const radius = value.match(/(\d+)\s*-?\s*ft\.?\s*(?:radius|cone|line|cube)/i)?.[1];
  if (/cone/i.test(value)) return radius ? { areaShape: 'Cone', areaNotation: `cone (${radius})` } : { areaShape: 'Cone', areaNotation: value };
  if (/cylinder/i.test(value)) {
    const r = value.match(/(\d+)\s*-?\s*ft\.?\s*radius/i)?.[1];
    return r ? { areaShape: 'Cylinder', areaNotation: `cylinder (${r})` } : { areaShape: 'Cylinder', areaNotation: value };
  }
  if (/cube/i.test(value) && radius) return { areaShape: 'Cube', areaNotation: `cube (${radius})` };
  if (/line/i.test(value) && radius) return { areaShape: 'Line', areaNotation: `line (${radius})` };
  if (/(burst|emanation|spread|sphere)/i.test(value)) {
    const r = value.match(/(\d+)\s*-?\s*ft\.?\s*radius/i)?.[1];
    return r ? { areaShape: 'Sphere', areaNotation: `sphere (${r})` } : { areaShape: 'Sphere', areaNotation: value };
  }
  return { areaShape: 'None', areaNotation: 'None' };
}

function parse() {
  const lines = readFileSync(sourcePath, 'utf8').split(/\r?\n/).map(clean);
  const records = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^Level:/i.test(lines[index])) continue;
    const levelLine = joinedField(lines, index, 'Level');
    const { classes, level } = parseClasses(levelLine);
    if (!classes.length || level === null) continue;

    let schoolIndex = -1;
    for (let back = index - 1; back >= Math.max(0, index - 3); back -= 1) {
      if (SCHOOLS.some((school) => lines[back].startsWith(school))) {
        schoolIndex = back;
        break;
      }
    }
    if (schoolIndex < 1) continue;

    const nameParts = [];
    for (let back = schoolIndex - 1; back >= Math.max(0, schoolIndex - 3); back -= 1) {
      if (/^(SPELL|DESCRIPTIONS|SPELL DESCRIPTIONS|CHAPTER \d+|\d+ CHAPTER \d+)$/i.test(lines[back])) break;
      if (!isNameLine(lines[back])) break;
      nameParts.unshift(lines[back]);
    }
    if (!nameParts.length) continue;
    const name = title(nameParts.join(' '));
    if (/^(Spell Descriptions|Chapter)$/i.test(name)) continue;

    const fields = {};
    const labels = ['Components', 'Casting Time', 'Range', 'Target', 'Targets', 'Effect', 'Area', 'Duration'];
    for (let forward = index + 1; forward < Math.min(lines.length, index + 20); forward += 1) {
      for (const label of labels) {
        if (new RegExp(`^${label}:`, 'i').test(lines[forward])) fields[label] = joinedField(lines, forward, label);
      }
      if (/^Level:/i.test(lines[forward]) || (forward > index + 2 && SCHOOLS.some((school) => lines[forward].startsWith(school)))) break;
    }

    const school = SCHOOLS.find((value) => lines[schoolIndex].startsWith(value));
    const area = deriveArea(fields.Area ?? '');
    const mechanics = [lines[schoolIndex], fields.Area, fields.Targets, fields.Target, fields.Effect].filter(Boolean).join(' ');
    records.push({
      id: `${slugify(name)}-${ID_SUFFIX}`,
      name,
      source: SOURCE,
      level,
      school,
      damage: deriveDamage(mechanics),
      areaShape: area.areaShape,
      areaNotation: area.areaNotation,
      range: fields.Range ?? 'Special',
      duration: fields.Duration ?? 'Special',
      concentration: /concentration/i.test(fields.Duration ?? ''),
      ritual: false,
      castingTime: fields['Casting Time'] ?? 'Special',
      components: fields.Components ?? 'None',
      classes,
      description: `A ${school.toLowerCase()} spell recorded in ${SOURCE}. Its listed range is ${fields.Range ?? 'special'} and duration is ${fields.Duration ?? 'special'}.`,
    });
  }
  return records.filter((record, index, all) => all.findIndex((other) => other.id === record.id) === index);
}

const imported = parse();
const existing = JSON.parse(readFileSync(dataPath, 'utf8'));
const existingIds = new Set(existing.map((record) => record.id));
const additions = imported.filter((record) => {
  if (existingIds.has(record.id)) return false;
  if (!process.argv.includes('--unique-only')) return true;
  return !existing.some((other) =>
    other.name.toLowerCase() === record.name.toLowerCase() &&
    other.level === record.level &&
    other.school === record.school &&
    other.range === record.range &&
    other.duration === record.duration,
  );
});

if (process.argv.includes('--write')) {
  const merged = [...existing, ...additions].sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id));
  writeFileSync(dataPath, `${JSON.stringify(merged, null, 2)}\n`);
}

console.log(JSON.stringify({ parsed: imported.length, additions: additions.length, sample: additions.slice(0, 8) }, null, 2));
