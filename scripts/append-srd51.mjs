import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const spellsPath = path.join(root, 'app', 'src', 'data', 'spells.json');
const snapshotPath = path.join(root, 'tmp', 'srd51-unsuffixed-pre-restore.json');

function sortSpells(a, b) {
  return a.level - b.level || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

const current = JSON.parse(fs.readFileSync(spellsPath, 'utf8'));
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const existingIds = new Set(current.map((spell) => spell.id));

const additions = snapshot
  .map((spell) => ({ ...spell, id: `${spell.id}-srd51`, source: 'SRD 5.1' }))
  .sort(sortSpells);

for (const spell of additions) {
  if (existingIds.has(spell.id)) throw new Error(`Refusing to overwrite existing id ${spell.id}.`);
}

const next = [...current, ...additions].sort(sortSpells);
fs.writeFileSync(spellsPath, `${JSON.stringify(next, null, 2)}\n`);

console.log(JSON.stringify({
  added: additions.length,
  first: additions[0]?.id ?? null,
  last: additions.at(-1)?.id ?? null,
}, null, 2));
