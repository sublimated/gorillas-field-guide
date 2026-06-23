import type { SpellAttributes } from '../engines/attributes';
import type { SoundInput } from '../engines/sound';
import { normalizeDuration, normalizeRange } from './normalizeAttributes';
import spellsJson from './spells.json';

export const PSIONIC_SCHOOLS = [
  'Clairsentience',
  'Metacreativity',
  'Psychokinesis',
  'Psychometabolism',
  'Psychoportation',
  'Telepathy',
] as const;

export type Spell = {
  id: string;
  name: string;
  source: string;
  level: number;
  school: string;
  damage: string; // primary damage type or "None"
  areaShape: string; // coarse, for rune + spectrum (must be in FEATURES.area)
  areaNotation: string; // full Area slot notation, e.g. "sphere (20)", or "None"
  range: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  castingTime: string;
  components: string;
  classes: string[];
  domains?: string[]; // D&D 3.5 cleric/druid domain lists (Air, Fire, etc.) — not PC classes
  description: string;
  // Intentional optional schema field. When a source parser can isolate scaling text
  // cleanly, it is stored here; otherwise that text remains folded into description.
  atHigherLevels?: string;
};

export type SourceGroup = 'edition' | 'addon';

export const SOURCE_CONFIG: Array<{
  id: string;
  label: string;
  group: SourceGroup;
  defaultOn: boolean;
}> = [
  { id: 'SRD 5.1', label: '5e 2014', group: 'edition', defaultOn: true },
  { id: 'SRD 5.2', label: '5e 2024', group: 'edition', defaultOn: true },
  { id: 'D&D 3.5 SRD', label: '3.5', group: 'edition', defaultOn: false },
  { id: 'D&D 3.5 SRD Psionics', label: '3.5 Psionics', group: 'edition', defaultOn: false },
  { id: 'Complete Psionic (3.5)', label: 'Complete Psionic', group: 'edition', defaultOn: false },
  { id: 'Dragon Magic (3.5)', label: 'Dragon Magic', group: 'edition', defaultOn: false },
  { id: 'Complete Mage (3.5)', label: 'Complete Mage', group: 'edition', defaultOn: false },
  { id: 'Spell Compendium (3.5)', label: 'Spell Compendium', group: 'edition', defaultOn: false },
  { id: 'Wizard Compendium V7', label: 'Wizard', group: 'addon', defaultOn: true },
  { id: 'Druid Book', label: 'Druid', group: 'addon', defaultOn: true },
  { id: 'Warlock Spell Compendium v1.3', label: 'Warlock', group: 'addon', defaultOn: true },
  { id: 'Sorcerer Compendium', label: 'Sorcerer', group: 'addon', defaultOn: true },
  { id: 'ScienceSpellbook', label: 'Science', group: 'addon', defaultOn: false },
];

// Default representative version per spell: the player's-handbook editions come first
// (2024, then 2014), then 3.5, then the author's own class compendiums last — those only
// become the default when a spell has no edition (SRD) version at all.
export const SOURCE_PRIORITY: string[] = [
  'SRD 5.2',
  'SRD 5.1',
  'D&D 3.5 SRD',
  'D&D 3.5 SRD Psionics',
  'Complete Psionic (3.5)',
  'Dragon Magic (3.5)',
  'Complete Mage (3.5)',
  'Spell Compendium (3.5)',
  'Wizard Compendium V7',
  'Druid Book',
  'Warlock Spell Compendium v1.3',
  'Sorcerer Compendium',
  'ScienceSpellbook',
];

// The three "main category" editions shown as version tabs. Any 3.5-era source (core or
// supplement) collapses into one "3.5 Rules" tab; the highest-priority 3.5 source present
// is the one actually selected. A spell with no edition version at all falls back to
// showing its own originating compendium as a single tab (handled by versionTabsFor).
const THREE_FIVE_SOURCES = [
  'D&D 3.5 SRD',
  'D&D 3.5 SRD Psionics',
  'Complete Psionic (3.5)',
  'Dragon Magic (3.5)',
  'Complete Mage (3.5)',
  'Spell Compendium (3.5)',
];

export type VersionTab = { label: string; source: string };

export function versionTabsFor(versions: Spell[]): VersionTab[] {
  const bySource = new Map(versions.map((v) => [v.source, v] as const));
  const srd2024 = bySource.get('SRD 5.2');
  const srd2014 = bySource.get('SRD 5.1');
  const threeFive = THREE_FIVE_SOURCES.map((s) => bySource.get(s)).find(Boolean);
  const editionTabs: VersionTab[] = [
    ...(srd2024 ? [{ label: '2024 Rules', source: srd2024.source }] : []),
    ...(srd2014 ? [{ label: '2014 Rules', source: srd2014.source }] : []),
    ...(threeFive ? [{ label: '3.5 Rules', source: threeFive.source }] : []),
  ];
  if (editionTabs.length > 0) return editionTabs;
  // No edition (PHB) version exists at all — show the originating book(s) directly.
  return versions.map((v) => ({ label: SOURCE_CONFIG.find((s) => s.id === v.source)?.label ?? v.source, source: v.source }));
}

export type SpellGroup = {
  key: string;
  name: string;
  versions: Spell[];
};

type RawSpell = Omit<Spell, 'areaNotation'> & {
  areaNotation?: string;
  areaSound?: string; // legacy extraction field; kept for JSON compatibility
};

const RANGE_ALIASES: Record<string, string> = {
  '5ft': '5 feet',
  '15ft': '15 feet',
  '15 ft': '15 feet',
  '15 ft.': '15 feet',
  '30ft': '30 feet',
  '60ft': '60 feet',
  '150ft': '150 feet',
  '300ft': '300 feet',
  'Medium (100 ft. + 10 ft. level)': 'Medium (100 ft. + 10 ft./level)',
  'One mile': '1 mile',
};

const DURATION_ALIASES: Record<string, string> = {
  'Until the beginning of your next turn': 'Special',
  'Until the end of your turn or a spell is cast': 'Special',
  'Up to 1 minute or until the': 'Special',
};

// Repairs name corruptions from source extraction (stray spaces, curly apostrophes,
// spaced separators) so variants of the same spell group together instead of splitting.
// e.g. "Arcanist ’s Magic Aura" → "Arcanist's Magic Aura", "Blindness / Deafness" → "Blindness/Deafness".
function normalizeName(name: string): string {
  return name
    .replace(/’/g, "'") // curly apostrophe → straight
    .replace(/\s+'/g, "'") // space before apostrophe
    .replace(/\s*\/\s*/g, '/') // spaces around a slash separator
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeSchool(school: string): string {
  const match = school.match(/^(Clairsentience|Metacreativity|Psychokinesis|Psychometabolism|Psychoportation|Telepathy)\b/i);
  if (match) return match[1];
  return /^Psychokinetic$/i.test(school) ? 'Psychokinesis' : school;
}

function normalizeSpell(spell: RawSpell): Spell {
  const { areaSound, ...rest } = spell;
  const areaNotation = (spell.areaNotation ?? areaSound ?? 'None').replace(/^emanation\s*\(/i, 'sphere (');
  return {
    ...rest,
    name: normalizeName(spell.name),
    school: normalizeSchool(spell.school),
    areaShape: spell.areaShape === 'Emanation' ? 'Sphere' : spell.areaShape,
    areaNotation,
    range: normalizeRange(RANGE_ALIASES[spell.range] ?? spell.range),
    duration: normalizeDuration(DURATION_ALIASES[spell.duration] ?? spell.duration),
    classes: spell.classes.map((c) => c.replace(/\.+$/, '')),
  };
}

export const SPELLS: Spell[] = (spellsJson as RawSpell[]).map(normalizeSpell);

function sourcePriority(source: string) {
  const index = SOURCE_PRIORITY.indexOf(source);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function groupSpells(spells: Spell[]): SpellGroup[] {
  const grouped = new Map<string, Spell[]>();
  for (const spell of spells) {
    const key = spell.name.toLowerCase();
    const bucket = grouped.get(key);
    if (bucket) bucket.push(spell);
    else grouped.set(key, [spell]);
  }
  return Array.from(grouped.entries())
    .map(([key, versions]) => {
      const sortedVersions = [...versions].sort((a, b) => {
        const priorityDiff = sourcePriority(a.source) - sourcePriority(b.source);
        if (priorityDiff !== 0) return priorityDiff;
        return a.source.localeCompare(b.source) || a.id.localeCompare(b.id);
      });
      return {
        key,
        name: sortedVersions[0]?.name ?? key,
        versions: sortedVersions,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function toAttributes(s: Spell): SpellAttributes {
  return {
    level: s.level,
    school: s.school,
    damage: s.damage,
    area: s.areaShape,
    areaNotation: s.areaNotation,
    range: s.range,
    duration: s.duration,
    concentration: s.concentration,
    ritual: s.ritual,
  };
}

export function toSoundInput(s: Spell): SoundInput {
  return {
    level: s.level,
    school: s.school,
    damage: s.damage,
    areaNotation: s.areaNotation,
    range: s.range,
    duration: s.duration,
  };
}
