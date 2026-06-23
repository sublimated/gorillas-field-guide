import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const spellsPath = path.join(root, 'app', 'src', 'data', 'spells.json');
const reextractPath = path.join(root, 'tmp', 'reextracted-originals.json');
const srdSnapshotPath = path.join(root, 'tmp', 'srd51-unsuffixed-pre-restore.json');
const notesPath = path.join(root, 'docs', 'RECOVERY_NOTES.md');

const COMPENDIUM_SOURCE = 'Thomas Wallace Compendium';
const CURRENT_SRD51 = 'SRD 5.1';
const SCIENCE_SOURCE = 'ScienceSpellbook';
const comparedFields = ['level', 'school', 'damage', 'areaShape', 'areaSound', 'range', 'duration', 'concentration', 'ritual', 'castingTime', 'components', 'classes', 'description', 'atHigherLevels'];

function sortSpells(a, b) {
  return a.level - b.level || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

function stable(value) {
  return JSON.stringify(value ?? null);
}

const current = JSON.parse(fs.readFileSync(spellsPath, 'utf8'));
const reextracted = JSON.parse(fs.readFileSync(reextractPath, 'utf8'));

const overwritten = current
  .filter((spell) => spell.source === CURRENT_SRD51 && !/-srd\d+$|-35srd$/i.test(spell.id))
  .sort(sortSpells);

const restored = reextracted
  .filter((spell) => spell.source !== SCIENCE_SOURCE)
  .map((spell) => ({ ...spell, source: COMPENDIUM_SOURCE }))
  .sort(sortSpells);

if (overwritten.length !== 272) throw new Error(`Expected 272 overwritten SRD 5.1 records, found ${overwritten.length}.`);
if (restored.length !== 272) throw new Error(`Expected 272 re-extracted compendium records, found ${restored.length}.`);

const restoredById = new Map(restored.map((spell) => [spell.id, spell]));
for (const spell of overwritten) {
  if (!restoredById.has(spell.id)) throw new Error(`Missing restored original for id ${spell.id}.`);
}

if (!fs.existsSync(srdSnapshotPath)) {
  fs.writeFileSync(srdSnapshotPath, `${JSON.stringify(overwritten, null, 2)}\n`);
}

const currentById = new Map(current.map((spell) => [spell.id, spell]));
const manualCorrections = [];
for (const spell of reextracted.filter((entry) => entry.source === SCIENCE_SOURCE)) {
  const live = currentById.get(spell.id);
  if (!live) continue;
  const delta = {};
  for (const field of comparedFields) {
    if (stable(spell[field]) !== stable(live[field])) {
      delta[field] = { reextract: spell[field] ?? null, preserved: live[field] ?? null };
    }
  }
  if (Object.keys(delta).length) manualCorrections.push({ id: spell.id, name: spell.name, delta });
}

const next = current
  .map((spell) => restoredById.get(spell.id) ?? spell)
  .sort(sortSpells);

fs.writeFileSync(spellsPath, `${JSON.stringify(next, null, 2)}\n`);

const notes = [
  '# Recovery Notes',
  '',
  '## Overwritten originals restored',
  '',
  `- Restored unsuffixed Thomas Wallace compendium records: ${restored.length}`,
  `- Preserved ScienceSpellbook records: ${current.filter((spell) => spell.source === SCIENCE_SOURCE).length}`,
  `- Captured pre-restore 2014 SRD records for re-append: ${overwritten.length}`,
  '',
  '## Preserved manual corrections',
  '',
  ...(manualCorrections.length
    ? manualCorrections.flatMap((entry) => [
        `### ${entry.name} (\`${entry.id}\`)`,
        '',
        ...Object.entries(entry.delta).map(([field, values]) => `- \`${field}\`: re-extract ${JSON.stringify(values.reextract)}; preserved ${JSON.stringify(values.preserved)}`),
        '',
      ])
    : ['- None', '']),
].join('\n');

fs.writeFileSync(notesPath, `${notes}\n`);

console.log(JSON.stringify({
  restored: restored.length,
  sciencePreserved: current.filter((spell) => spell.source === SCIENCE_SOURCE).length,
  capturedSrd51: overwritten.length,
  manualCorrections: manualCorrections.map((entry) => entry.id),
  notesPath,
}, null, 2));
