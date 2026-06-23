import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pagesPath = path.join(root, 'tmp', 'pdfs', 'srd-psionics');
const dataPath = path.join(root, 'app', 'src', 'data', 'spells.json');
const SOURCE = 'D&D 3.5 SRD Psionics';

const PSION_SPECIALTIES = new Set(['egoist', 'kineticist', 'nomad', 'seer', 'shaper', 'telepath']);
const CLASS_MAP = new Map([
  ['psion', 'Psion'], ['wilder', 'Wilder'], ['psychic warrior', 'Psychic Warrior'],
  ['soulknife', 'Soulknife'], ['lurker', 'Lurk'], ['lurk', 'Lurk'],
]);
const DAMAGE = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Poison', 'Psychic', 'Radiant', 'Thunder'];

function decode(value) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&frac12;/g, '1/2')
    .replace(/&rsquo;|&#8217;/g, "'")
    .replace(/&ndash;|&#8211;/g, '-')
    .replace(/&mdash;|&#8212;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#–/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function tableValue(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<th[^>]*>\\s*(?:<[^>]*>)*${escaped}.*?</th>\\s*<td>([\\s\\S]*?)</td>`, 'i'));
  return match ? decode(match[1]) : '';
}

function parseClasses(levelValue) {
  const classes = new Set();
  const levels = [];
  for (const match of levelValue.matchAll(/([A-Za-z/ ]+?)\s*(\d+)(?=,|$)/g)) {
    const level = Number(match[2]);
    levels.push(level);
    for (const raw of match[1].toLowerCase().split('/').map((part) => part.trim())) {
      if (PSION_SPECIALTIES.has(raw)) classes.add('Psion');
      else if (CLASS_MAP.has(raw)) classes.add(CLASS_MAP.get(raw));
    }
  }
  return { classes: [...classes].sort(), level: levels.length ? Math.min(...levels) : null };
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

function parsePage(filename) {
  const html = readFileSync(path.join(pagesPath, filename), 'utf8');
  const name = decode(html.match(/<h1>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
  const discipline = decode(html.match(/<h4>([\s\S]*?)<\/h4>/i)?.[1] ?? 'Universal').replace(/\s*\[.*$/, '').trim();
  const levelValue = tableValue(html, 'Level');
  const { classes, level } = parseClasses(levelValue);
  if (!name || level === null || !classes.length) return null;
  const areaSource = tableValue(html, 'Area');
  const area = deriveArea(areaSource);
  const details = html.slice(html.indexOf('</table>'));
  const damage = DAMAGE.find((value) => new RegExp(`\\b${value} damage\\b`, 'i').test(details)) ?? 'None';
  const range = tableValue(html, 'Range') || 'Special';
  const duration = tableValue(html, 'Duration') || 'Special';
  return {
    id: `${slugify(name)}-35psionics`,
    name,
    source: SOURCE,
    level,
    school: discipline,
    damage,
    areaShape: area.areaShape,
    areaNotation: area.areaNotation,
    range,
    duration,
    concentration: /concentration/i.test(duration),
    ritual: false,
    castingTime: tableValue(html, 'Manifesting Time') || 'Special',
    components: 'None',
    classes,
    description: `A ${discipline.toLowerCase()} psionic power. It is manifested at ${range} range and lasts ${duration}.`,
  };
}

const parsed = readdirSync(pagesPath)
  .filter((filename) => filename.endsWith('.htm'))
  .map(parsePage)
  .filter(Boolean);
const unique = parsed.filter((record, index, all) => all.findIndex((other) => other.id === record.id) === index);
const existing = JSON.parse(readFileSync(dataPath, 'utf8'));
const existingIds = new Set(existing.map((record) => record.id));
const additions = unique.filter((record) => !existingIds.has(record.id));

if (process.argv.includes('--write')) {
  const merged = [...existing, ...additions].sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id));
  writeFileSync(dataPath, `${JSON.stringify(merged, null, 2)}\n`);
}

console.log(JSON.stringify({ parsed: unique.length, additions: additions.length, sample: additions.slice(0, 5) }, null, 2));
