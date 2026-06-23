import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const inputPath = path.join(root, 'tmp', 'SRD-OGL_V5.1.txt');
const spellsPath = path.join(root, 'app', 'src', 'data', 'spells.json');
const backupPath = path.join(root, 'app', 'src', 'data', 'spells.BACKUP-SRD51-MISLABELED.json');
const shouldWrite = process.argv.includes('--write');

const CLASSES = ['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Sorcerer', 'Warlock', 'Wizard'];
const SCHOOLS = new Set(['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation']);
const DAMAGES = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'];

function cleanSourceText(text) {
  return text
    .replace(/[\s\u00a0]+/g, ' ')
    .replace(/Â/g, '')
    .replace(/[\u00ad‐‑–—]/g, '-')
    .replace(/-+/g, '-')
    .replace(/Not for resale\. Permission granted to print or photocopy this document for personal use only\. System Reference Document 5\.1 \d+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function key(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slug(name) {
  return `${key(name).replace(/\s+/g, '-')}-srd51`;
}

function sourceDamage(text) {
  return DAMAGES.find((damage) => new RegExp(`\\b${damage} damage\\b`, 'i').test(text)) ?? 'None';
}

function areaFrom(text, range) {
  const source = `${range} ${text}`;
  const match = source.match(/(\d+)[- ]foot(?:[- ]radius)?\s+(Cone|Cube|Cylinder|Emanation|Line|Sphere)/i);
  if (!match) return { areaShape: 'None', areaSound: 'None' };
  const [, amount, rawShape] = match;
  const shape = rawShape[0].toUpperCase() + rawShape.slice(1).toLowerCase();
  return { areaShape: shape, areaSound: `${shape.toLowerCase()} (${amount})` };
}

function splitHigherLevels(description) {
  const match = description.match(/\s+At Higher Levels\.\s+/i);
  if (!match || match.index === undefined) return { description };
  return {
    description: description.slice(0, match.index).trim(),
    atHigherLevels: description.slice(match.index + match[0].length).trim(),
  };
}

function parseDescriptions(text) {
  const descriptionText = text.slice(text.indexOf('Spell Descriptions') + 'Spell Descriptions'.length);
  const titleWord = "[A-Z][A-Za-z0-9'’,/-]*";
  const titleTail = "(?:[A-Z][A-Za-z0-9'’,/-]*|of|the|and|to|from|with|in|on|or|at|a|an)";
  const header = new RegExp(`(${titleWord}(?:\\s+${titleTail}){0,5})\\s+(?:(\\d)(?:st|nd|rd|th)[^A-Za-z0-9]+level\\s+([a-z]+)(\\s+\\(ritual\\))?|([A-Za-z]+) cantrip)\\s+Casting Time:`, 'g');
  const matches = [...descriptionText.matchAll(header)];
  const spells = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const next = matches[index + 1];
    const name = match[1].trim();
    const level = match[5] ? 0 : Number(match[2]);
    const school = (match[5] ?? match[3]).replace(/^./, (letter) => letter.toUpperCase());
    const body = descriptionText.slice(match.index + match[0].length, next?.index ?? descriptionText.length).trim();
    const parts = body.match(/^\s*(.*?)\s+Range:\s*(.*?)\s+Components:\s*(.*?)\s+Duration:\s*(.*)$/);
    if (!parts || !SCHOOLS.has(school) || !Number.isInteger(level)) continue;

    const castingTime = parts[1].trim();
    const range = parts[2].trim();
    const components = parts[3].trim();
    const durationAndDescription = parts[4].trim();
    const durationMatch = durationAndDescription.match(/^(Instantaneous|Special|Until dispelled(?: or triggered)?|Concentration, up to (?:a|an|one|\d+) (?:round|minute|hour|day|week|month|year)s?|(?:a|an|one|\d+) (?:round|minute|hour|day|week|month|year)s?)(?:\s+|$)/i);
    if (!durationMatch) continue;
    const duration = durationMatch[1].trim();
    const description = durationAndDescription.slice(durationMatch[0].length).trim();
    if (!description) continue;

    const split = splitHigherLevels(description);
    const area = areaFrom(split.description, range);
    spells.push({
      id: slug(name),
      name,
      source: 'SRD 5.1',
      level,
      school,
      damage: sourceDamage(`${split.description} ${split.atHigherLevels ?? ''}`),
      areaShape: area.areaShape,
      areaSound: area.areaSound,
      range,
      duration,
      concentration: /^Concentration,/i.test(duration),
      ritual: Boolean(match[4]),
      castingTime,
      components,
      classes: [],
      description: split.description,
      ...(split.atHigherLevels ? { atHigherLevels: split.atHigherLevels } : {}),
    });
  }
  return spells;
}

function applyClassLists(text, spells) {
  const listStart = text.indexOf('Spell Lists');
  const listEnd = text.indexOf('Spell Descriptions');
  const lists = text.slice(listStart, listEnd);
  const classPositions = CLASSES
    .map((className) => ({ className, index: lists.indexOf(`${className} Spells`) }))
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => a.index - b.index);

  const classSections = classPositions.map((current, index) => ({
    className: current.className,
    text: key(lists.slice(current.index, classPositions[index + 1]?.index)),
  }));

  for (const section of classSections) {
    for (const spell of spells) {
      if (section.text.includes(key(spell.name))) spell.classes.push(section.className);
    }
  }

  // Some PDF pages join the last capitalized word of a sentence to the next
  // spell heading. A title suffix that is actually listed as a spell is safer.
  for (const spell of spells.filter((candidate) => candidate.classes.length === 0)) {
    const words = spell.name.split(' ');
    for (let offset = 1; offset < words.length; offset += 1) {
      const candidateName = words.slice(offset).join(' ');
      const candidateKey = key(candidateName);
      const matchingClasses = classSections
        .filter((section) => section.text.includes(candidateKey))
        .map((section) => section.className);
      if (matchingClasses.length) {
        spell.name = candidateName;
        spell.id = slug(candidateName);
        spell.classes.push(...matchingClasses);
        break;
      }
    }
  }

}

function sortSpells(a, b) {
  return a.level - b.level || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

const sourceText = cleanSourceText(fs.readFileSync(inputPath, 'utf8'));
const parsed = parseDescriptions(sourceText);
applyClassLists(sourceText, parsed);
const additions = parsed.filter((spell) => spell.classes.length > 0).sort(sortSpells);
const noClass = parsed.filter((spell) => spell.classes.length === 0).map((spell) => spell.name);
const duplicateIds = additions.filter((spell, index) => additions.findIndex((candidate) => candidate.id === spell.id) !== index).map((spell) => spell.id);

if (duplicateIds.length) throw new Error(`Duplicate SRD 5.1 ids: ${[...new Set(duplicateIds)].join(', ')}`);

if (shouldWrite) {
  const existing = JSON.parse(fs.readFileSync(spellsPath, 'utf8'));
  if (!fs.existsSync(backupPath)) fs.copyFileSync(spellsPath, backupPath);
  const baseline = existing.filter((spell) => spell.source !== 'SRD 5.1');
  const existingIds = new Set(baseline.map((spell) => spell.id));
  const collisions = additions.filter((spell) => existingIds.has(spell.id));
  if (collisions.length) throw new Error(`Refusing to overwrite non-SRD 5.1 ids: ${collisions.map((spell) => spell.id).join(', ')}`);
  fs.writeFileSync(spellsPath, `${JSON.stringify([...baseline, ...additions].sort(sortSpells), null, 2)}\n`);
}

console.log(JSON.stringify({
  parsed: parsed.length,
  imported: additions.length,
  withoutClasses: noClass,
  byClass: Object.fromEntries(CLASSES.map((className) => [className, additions.filter((spell) => spell.classes.includes(className)).length])),
  wrote: shouldWrite,
}, null, 2));
