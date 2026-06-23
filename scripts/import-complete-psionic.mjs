import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(root, 'tmp', 'pdfs', 'text', 'Complete Psionic.txt');
const dataPath = path.join(root, 'app', 'src', 'data', 'spells.json');
const SOURCE = 'Complete Psionic (3.5)';
const DISCIPLINES = new Set(['Clairsentience', 'Metacreativity', 'Psychokinesis', 'Psychometabolism', 'Psychoportation', 'Telepathy']);
const MANTLES = new Set(['Chaos', 'Communication', 'Conflict', 'Consumption', 'Corruption and Madness', 'Death', 'Deception', 'Energy', 'Evil', 'Fate', 'Freedom', 'Good', 'Guardian', 'Justice', 'Knowledge', 'Life', 'Magic', 'Mental Might', 'Natural World', 'Pain and Suffering', 'Physical Power', 'Planar', 'Repose', 'Time', 'Unity']);
const DAMAGE = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Poison', 'Psychic', 'Radiant', 'Thunder'];

function clean(value) {
  return value.replace(/â€™/g, "'").replace(/â€“|â€”/g, '-').replace(/\s+/g, ' ').trim();
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function title(value) {
  return clean(value).toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function parseClasses(levelLine) {
  const classes = new Set();
  const levels = [];
  for (const match of levelLine.matchAll(/([A-Za-z/ ]+?)\s*(\d+)/g)) {
    const label = clean(match[1]).toLowerCase();
    levels.push(Number(match[2]));
    if (label.includes('psion')) classes.add('Psion');
    if (label.includes('wilder')) classes.add('Wilder');
    if (label.includes('psychic warrior')) classes.add('Psychic Warrior');
    if (label.includes('lurk')) classes.add('Lurk');
    if ([...MANTLES].some((mantle) => label.includes(mantle.toLowerCase()))) {
      classes.add('Ardent');
      classes.add('Divine Mind');
    }
  }
  return { classes: [...classes].sort(), level: levels.length ? Math.min(...levels) : null };
}

function field(lines, start, label) {
  const line = lines[start].replace(new RegExp(`^${label}:\\s*`, 'i'), '');
  const next = lines[start + 1] ?? '';
  if (/\d$/.test(line) && /^(?:feet|ft\.?|rounds?|minutes?|hours?|days?)(?:\b|\/)/i.test(next)) return clean(`${line} ${next}`);
  return line;
}

function deriveArea(value) {
  if (!value) return { areaShape: 'None', areaNotation: 'None' };
  const radius = value.match(/(\d+)\s*-?\s*ft\.?\s*(?:radius|cone|line|cube)/i)?.[1];
  if (/cone/i.test(value)) return radius ? { areaShape: 'Cone', areaNotation: `cone (${radius})` } : { areaShape: 'Cone', areaNotation: value };
  if (/cylinder/i.test(value)) return radius ? { areaShape: 'Cylinder', areaNotation: `cylinder (${radius})` } : { areaShape: 'Cylinder', areaNotation: value };
  if (/cube/i.test(value)) return radius ? { areaShape: 'Cube', areaNotation: `cube (${radius})` } : { areaShape: 'Cube', areaNotation: value };
  if (/line/i.test(value)) return radius ? { areaShape: 'Line', areaNotation: `line (${radius})` } : { areaShape: 'Line', areaNotation: value };
  if (/(burst|emanation|spread|sphere)/i.test(value)) return radius ? { areaShape: 'Sphere', areaNotation: `sphere (${radius})` } : { areaShape: 'Sphere', areaNotation: value };
  return { areaShape: 'None', areaNotation: 'None' };
}

const lines = readFileSync(sourcePath, 'utf8').split(/\r?\n/).map(clean);
const records = [];
for (let index = 0; index < lines.length; index += 1) {
  if (!/^Level:/i.test(lines[index])) continue;
  let disciplineIndex = -1;
  for (let back = index - 1; back >= Math.max(0, index - 4); back -= 1) {
    if (DISCIPLINES.has(lines[back])) {
      disciplineIndex = back;
      break;
    }
  }
  if (disciplineIndex < 1) continue;
  const nameParts = [];
  for (let back = disciplineIndex - 1; back >= Math.max(0, disciplineIndex - 3); back -= 1) {
    if (!/^[A-Z][A-Z0-9 ,'\-]+$/.test(lines[back])) break;
    nameParts.unshift(lines[back]);
  }
  if (!nameParts.length) continue;
  const name = title(nameParts.join(' '));
  const levelLine = clean([field(lines, index, 'Level'), lines[index + 1]].filter((part) => !/^(Display|Manifesting Time|Range|Target|Targets|Effect|Area|Duration|Saving Throw|Power Resistance|Power Points):/i.test(part)).join(' '));
  const { classes, level } = parseClasses(levelLine);
  if (!classes.length || level === null) continue;
  const fields = {};
  for (let forward = index + 1; forward < Math.min(lines.length, index + 18); forward += 1) {
    for (const label of ['Manifesting Time', 'Range', 'Target', 'Targets', 'Effect', 'Area', 'Duration']) {
      if (new RegExp(`^${label}:`, 'i').test(lines[forward])) fields[label] = field(lines, forward, label);
    }
    if (forward > index + 1 && /^Level:/i.test(lines[forward])) break;
  }
  const area = deriveArea(fields.Area ?? '');
  const details = lines.slice(index, Math.min(lines.length, index + 30)).join(' ');
  const damage = DAMAGE.find((value) => new RegExp(`\\b${value} damage\\b`, 'i').test(details)) ?? 'None';
  records.push({
    id: `${slugify(name)}-completepsionic35`, name, source: SOURCE, level, school: lines[disciplineIndex], damage,
    areaShape: area.areaShape, areaNotation: area.areaNotation, range: fields.Range ?? 'Special', duration: fields.Duration ?? 'Special',
    concentration: /concentration/i.test(fields.Duration ?? ''), ritual: false, castingTime: fields['Manifesting Time'] ?? 'Special', components: 'None', classes,
    description: `A ${lines[disciplineIndex].toLowerCase()} psionic power from Complete Psionic. Its listed range is ${fields.Range ?? 'special'} and duration is ${fields.Duration ?? 'special'}.`,
  });
}
const unique = records.filter((record, index, all) => all.findIndex((other) => other.id === record.id) === index);
const existing = JSON.parse(readFileSync(dataPath, 'utf8'));
const existingIds = new Set(existing.map((record) => record.id));
const additions = unique.filter((record) => !existingIds.has(record.id));
if (process.argv.includes('--write')) {
  writeFileSync(dataPath, `${JSON.stringify([...existing, ...additions].sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id)), null, 2)}\n`);
}
console.log(JSON.stringify({ parsed: unique.length, additions: additions.length, sample: additions.slice(0, 8) }, null, 2));
