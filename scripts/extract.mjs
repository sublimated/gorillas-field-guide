/**
 * Data pipeline: Source PDFs → spells.json
 *
 * Sources:
 *   Spell_Writing_Dictionaryv2.txt  → damage + areaShape (authoritative)
 *   Wizard / Sorcerer / Druid compendiums (Spoken Name before ATTRIBUTES)
 *   Warlock compendium (Spoken Name on a dedicated page AFTER each spell body)
 *   The_Science_Spellbook_V1.3.txt  → additional spells
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..');
const EXTRACTED = path.join(ROOT, 'Source PDFs', '_extracted');
const OUT       = process.env.DATA_OUT
  ? path.resolve(ROOT, process.env.DATA_OUT)
  : path.join(ROOT, 'app', 'src', 'data', 'spells.json');

function read(file) {
  return readFileSync(path.join(EXTRACTED, file), 'utf8');
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

function slugify(name) {
  return name.toLowerCase().replace(/['''\/]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}
function key(name) {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
}
function titleCaseLine(str) {
  return str.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
}

const SCHOOLS = ['Abjuration','Conjuration','Divination','Enchantment','Evocation','Illusion','Necromancy','Transmutation'];

function normalizeSchool(s) {
  if (!s) return null;
  const sl = s.toLowerCase().replace(/\s+/g,'');
  return SCHOOLS.find(sc => sl.startsWith(sc.toLowerCase().slice(0,5))) ?? null;
}

const DAMAGE_MAP = { none:'None', acid:'Acid', bludgeoning:'Bludgeoning', cold:'Cold',
  fire:'Fire', force:'Force', lightning:'Lightning', necrotic:'Necrotic',
  piercing:'Piercing', poison:'Poison', psychic:'Psychic', radiant:'Radiant',
  slashing:'Slashing', thunder:'Thunder' };

function normalizeDamage(s) {
  if (!s) return 'None';
  return DAMAGE_MAP[s.split(/[,/]/)[0].trim().toLowerCase()] ?? 'None';
}

function normalizeAreaShape(s) {
  if (!s) return 'None';
  const l = s.toLowerCase().split(/[,/]/)[0].trim();
  if (!l || /^(st|mt|none|st\/mt)/.test(l)) return 'None';
  if (l.startsWith('sphere') || l.startsWith('sph')) return 'Sphere';
  if (l.startsWith('cone')) return 'Cone';
  if (l.startsWith('cyl')) return 'Cylinder';
  if (l.startsWith('cube')) return 'Cube';
  if (l.startsWith('line')) return 'Line';
  if (l.startsWith('wall')) return 'Wall';
  if (l.startsWith('sq') || l.startsWith('square')) return 'Square';
  if (l.startsWith('circle')) return 'Circle';
  if (/multiple|mt/i.test(l)) return 'Multiple targets';
  return 'None';
}

function normalizeRange(s) {
  if (!s) return 'Special';
  const bare = s.replace(/\s*\(.*?\)/g,'').trim();
  const l = bare.toLowerCase().trim();
  if (l === 'self') return 'Self';
  if (l === 'touch') return 'Touch';
  if (l === 'sight') return 'Sight';
  if (l === 'unlimited') return 'Unlimited';
  if (l === 'special') return 'Special';
  const mm = l.match(/^(\d+)\s*mile/);
  if (mm) return parseInt(mm[1]) >= 500 ? '500 miles' : '1 mile';
  const mf = l.match(/^(\d+)\s*feet?/i);
  if (mf) {
    const ft = parseInt(mf[1]);
    const buckets = [5,10,30,60,90,100,120,150,300,500];
    return `${buckets.reduce((a,b) => Math.abs(b-ft) < Math.abs(a-ft) ? b : a)} feet`;
  }
  return bare || 'Special';
}

const DUR_MAP = {
  'instantaneous':'Instantaneous','until dispelled':'Until dispelled',
  '1 round':'1 round','1 minute':'1 minute','10 minutes':'10 minutes',
  '1 hour':'1 hour','8 hours':'8 hours','24 hours':'24 hours',
  '7 days':'7 days','10 days':'10 days','30 days':'30 days',
};
const UP_TO_MAP = {
  '1 round':'Up to 1 round','1 minute':'Up to 1 minute','10 minutes':'Up to 10 minutes',
  '1 hour':'Up to 1 hour','2 hours':'Up to 2 hours','8 hours':'Up to 8 hours','24 hours':'Up to 24 hours',
};
function normalizeDuration(s) {
  if (!s) return 'Special';
  const l = s.toLowerCase().trim();
  const concM = l.match(/concentration,?\s*up to (.+)/);
  if (concM) return UP_TO_MAP[concM[1].trim()] ?? `Up to ${concM[1].trim()}`;
  const upM = l.match(/^up to (.+)/);
  if (upM) return UP_TO_MAP[upM[1].trim()] ?? `Up to ${upM[1].trim()}`;
  for (const [k,v] of Object.entries(DUR_MAP)) if (l.includes(k)) return v;
  return s.trim();
}

function parseLevel(s) {
  const m = s.match(/(\d+)(?:st|nd|rd|th)/i);
  if (m) return parseInt(m[1]);
  if (/cantrip/i.test(s)) return 0;
  return null;
}

// ─── areaNotation derivation ─────────────────────────────────────────────────────

function areaNotationFromRange(raw) {
  if (!raw) return null;
  const m = raw.match(/\((\d+)[- ]foot[- ](cone|sphere|cube|line|cylinder)/i);
  return m ? `${m[2].toLowerCase()} (${m[1]})` : null;
}

const AREA_PATTERNS = [
  { shape:'Sphere',   re:/(\d+)[- ]foot[- ]radius sphere/i,              fn:m=>`sphere (${m[1]})` },
  { shape:'Sphere',   re:/sphere[^.]*?(\d+)[- ]foot[- ]radius/i,         fn:m=>`sphere (${m[1]})` },
  { shape:'Cone',     re:/(\d+)[- ]foot[- ]cone/i,                       fn:m=>`cone (${m[1]})` },
  { shape:'Cylinder', re:/(\d+)[- ]foot[- ]radius[^.]*?cylinder/i, fn:m=>`cylinder (${m[1]})` },
  { shape:'Cube',     re:/(\d+)[- ]foot[- ](?:side )?cube/i,             fn:m=>`cube (${m[1]})` },
  { shape:'Cube',     re:/no larger than a (\d+)[- ]foot cube/i,         fn:m=>`cube (${m[1]})` },
  { shape:'Line',     re:/line (\d+) feet long/i,                        fn:m=>`line (${m[1]})` },
  { shape:'Line',     re:/(\d+)[- ]foot(?:[- ]long)? line/i,             fn:m=>`line (${m[1]})` },
];

/**
 * Returns { areaShape, areaNotation } — may upgrade areaShape from 'None' when
 * the dictionary is wrong but the description text reveals the real shape.
 */
function deriveArea(dictAreaShape, rawRange, description) {
  // Range string embed takes highest priority (e.g. "Self (15-foot cone)")
  const fromRange = areaNotationFromRange(rawRange);
  if (fromRange) {
    const shapeName = fromRange.split(' ')[0];
    return { areaShape: shapeName.charAt(0).toUpperCase() + shapeName.slice(1), areaNotation: fromRange };
  }
  // Search description patterns; skip shape filter when dictionary says None
  const text = (description ?? '').toLowerCase();
  for (const { shape, re, fn } of AREA_PATTERNS) {
    if (dictAreaShape !== 'None' && shape !== dictAreaShape) continue;
    const m = text.match(re);
    if (m) return { areaShape: shape, areaNotation: fn(m) };
  }
  return { areaShape: dictAreaShape || 'None', areaNotation: 'None' };
}

// ─── 1. Spell Writing Dictionary ─────────────────────────────────────────────

function parseDictionary() {
  const text = read('Spell_Writing_Dictionaryv2.txt');
  const lines = text.split('\n').map(l=>l.trim()).filter(l=>l);
  const entries = {};
  let pendingName = null, cur = null;

  const isStructural = l =>
    l.startsWith('=====') || l.startsWith('CHAPTER') || /^\d+$/.test(l) || l === 'CONTENTS';

  for (const line of lines) {
    if (isStructural(line)) continue;
    const lvM  = line.match(/^Level \(k = \d\):\s*(\d+)/i);
    const dmgM = line.match(/^Damage Type \(k = \d\):\s*(.+)/i);
    const arM  = line.match(/^Area Type \(k = \d\):\s*(.+)/i);

    if (lvM) {
      if (cur?.name) entries[key(cur.name)] = cur;
      cur = { name: pendingName, damage: 'None', areaShape: 'None' };
      pendingName = null;
      continue;
    }
    if (cur) {
      if (dmgM) { cur.damage   = normalizeDamage(dmgM[1]);    continue; }
      if (arM)  { cur.areaShape = normalizeAreaShape(arM[1]); continue; }
    }
    // ALL-CAPS line with letters and no colon → potential spell name
    if (line === line.toUpperCase() && /[A-Z]/.test(line) && !line.includes(':')) {
      pendingName = titleCaseLine(line);
    }
  }
  if (cur?.name) entries[key(cur.name)] = cur;
  console.log(`Dictionary: ${Object.keys(entries).length} entries`);
  return entries;
}

// ─── 2. Standard compendium parser (Wizard / Sorcerer / Druid) ────────────────
//    Format: [SPELL NAME (may span 2 lines)] → Spoken Name: X → ATTRIBUTES → ...

function parseCompendium(filename, className, source) {
  const text = read(filename);
  const lines = text.split('\n').map(l => l.trim());
  const spells = [];
  const isStructural = l => !l || /^=====|^CHAPTER|\d+$|^CONTENTS$/.test(l);

  for (let snIdx = 0; snIdx < lines.length; snIdx++) {
    if (!/^Spoken Name:/i.test(lines[snIdx])) continue;

    // Collect spell name: walk backward collecting consecutive ALL-CAPS lines.
    // "DELAYED BLAST\nFIREBALL\nSpoken Name:" → "Delayed Blast Fireball"
    const nameParts = [];
    for (let i = snIdx - 1; i >= Math.max(0, snIdx - 6); i--) {
      const l = lines[i];
      if (isStructural(l)) { if (nameParts.length) break; continue; }
      if (l === l.toUpperCase() && /[A-Z]/.test(l) && !l.includes(':')) {
        nameParts.unshift(l);
      } else {
        if (!nameParts.length) nameParts.unshift(l);
        break;
      }
    }
    if (!nameParts.length) continue;
    const spellName = titleCaseLine(nameParts.join(' ').trim());
    const spokenName = lines[snIdx].replace(/^Spoken Name:\s*/i, '').trim();

    // Find ATTRIBUTES section forward from Spoken Name
    let ai = snIdx + 1;
    while (ai < lines.length && !/^ATTRIBUTES$/i.test(lines[ai])) ai++;
    if (ai >= lines.length) continue;

    let level = null, school = null, concentration = false, ritual = false;
    let castingTime = '', range = '', components = '', duration = '';
    let i = ai + 1;

    const attrLine = lines[i] ?? '';
    level = parseLevel(attrLine);
    for (const sc of SCHOOLS) { if (attrLine.includes(sc)) { school = sc; break; } }
    if (/concentration/i.test(attrLine)) concentration = true;
    if (/ritual/i.test(attrLine)) ritual = true;
    i++;

    while (i < lines.length && lines[i] && !/^Casting Time/i.test(lines[i])) {
      if (/concentration/i.test(lines[i])) concentration = true;
      if (/ritual/i.test(lines[i])) ritual = true;
      i++;
    }
    for (; i < lines.length; i++) {
      const l = lines[i];
      if (/^SPELL DESCRIPTION$/i.test(l)) break;
      const ctM = l.match(/^Casting Time\s*:\s*(.+)/i);
      const rM  = l.match(/^Range\s*:\s*(.+)/i);
      const cM  = l.match(/^Components\s*:\s*(.+)/i);
      const dM  = l.match(/^Duration\s*:\s*(.+)/i);
      if (ctM) castingTime = ctM[1].trim();
      if (rM)  range = rM[1].trim();
      if (cM)  components = cM[1].trim();
      if (dM)  { if (/concentration/i.test(dM[1])) concentration = true; duration = normalizeDuration(dM[1]); }
    }

    // i is now pointing at the "SPELL DESCRIPTION" line (the loop breaks when found)
    if (!/^SPELL DESCRIPTION$/i.test(lines[i] ?? '')) continue;
    const descStart = i + 1; // first line of description body

    // Bound ALL section searches to within this spell's block (before the next "Spoken Name:")
    const nextSpell = lines.findIndex((l, idx) => idx >= descStart && /^Spoken Name:/i.test(l));
    const blockEnd  = nextSpell > 0 ? nextSpell : lines.length;

    let hlStart = -1, notesIdx = -1;
    for (let k = descStart; k < blockEnd; k++) {
      if (hlStart < 0 && /^AT HIGHER LEVELS$/i.test(lines[k])) hlStart = k;
      if (notesIdx < 0 && /^NOTES$/i.test(lines[k])) notesIdx = k;
    }

    const bodyEnd = [hlStart, notesIdx].filter(n => n > 0).reduce((a, b) => Math.min(a, b), blockEnd);

    const description = lines.slice(descStart, bodyEnd)
      .filter(l => l && !isStructural(l))
      .join(' ').replace(/\s+/g, ' ').trim();

    let atHigherLevels = undefined;
    if (hlStart > 0) {
      const hlEnd = notesIdx > hlStart ? notesIdx : blockEnd;
      const hl = lines.slice(hlStart + 1, hlEnd)
        .filter(l => l && !isStructural(l))
        .join(' ').replace(/\s+/g, ' ').trim();
      if (hl) atHigherLevels = hl;
    }

    if (level === null || !school || !description) continue;
    spells.push({ name: spellName, spokenName, level, school, concentration, ritual,
      castingTime: castingTime || '1 Action', rawRange: range, range: normalizeRange(range),
      components, duration, description, atHigherLevels, classes: [className], source });
  }

  console.log(`${filename}: ${spells.length} spells`);
  return spells;
}

// ─── 3. Warlock compendium parser ────────────────────────────────────────────
//    Format: [Spell Name (may span 2 lines)] → Attributes → ... → Notes
//    then on a SEPARATE PAGE: [Spoken Name: X]
//    Section headers are Title Case, not ALL CAPS.

function parseWarlockCompendium(source) {
  const text = read('Warlock_Spell_Compendium_v1_3.txt');
  const lines = text.split('\n').map(l=>l.trim());
  const spells = [];

  // Collect all spoken names in document order
  const spokenNames = [];
  for (const l of lines) {
    const m = l.match(/^Spoken Name:\s*(.+)/i);
    if (m) spokenNames.push(m[1].trim());
  }

  let si = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Anchor on "Attributes" (Title Case) that appears alone on a line
    if (line !== 'Attributes' && line !== 'ATTRIBUTES') continue;

    // Spell name: collect up to 3 non-structural lines immediately before "Attributes"
    const nameParts = [];
    for (let j = i-1; j >= Math.max(0, i-5); j--) {
      const l = lines[j];
      if (!l) continue;
      if (/^=====|^CHAPTER|^Chapter|^\d+$|^Notes?$|^Spoken Name:/i.test(l)) break;
      if (l.length > 60) break; // too long → description text from prev spell
      nameParts.unshift(l);
      if (nameParts.join(' ').split(/\s+/).length >= 4) break; // max 4-word name
    }
    if (!nameParts.length) continue;
    const spellName = titleCaseLine(nameParts.join(' ').trim());

    let level = null, school = null, concentration = false, ritual = false;
    let castingTime = '', range = '', components = '', duration = '';

    i++;
    const attrLine = lines[i] ?? '';
    level = parseLevel(attrLine);
    for (const sc of SCHOOLS) { if (attrLine.includes(sc)) { school = sc; break; } }
    if (/concentration/i.test(attrLine)) concentration = true;
    if (/ritual/i.test(attrLine)) ritual = true;
    i++;

    while (i < lines.length && lines[i] && !/^Casting Time/i.test(lines[i])) {
      if (/concentration/i.test(lines[i])) concentration = true;
      if (/ritual/i.test(lines[i])) ritual = true;
      i++;
    }
    for (; i < lines.length; i++) {
      const l = lines[i];
      if (/^Spell Description$/i.test(l)) break;
      const ctM = l.match(/^Casting Time\s*:\s*(.+)/i);
      const rM  = l.match(/^Range\s*:\s*(.+)/i);
      const cM  = l.match(/^Components\s*:\s*(.+)/i);
      const dM  = l.match(/^Duration\s*:\s*(.+)/i);
      if (ctM) castingTime = ctM[1].trim();
      if (rM)  range = rM[1].trim();
      if (cM)  components = cM[1].trim();
      if (dM)  { if (/concentration/i.test(dM[1])) concentration = true; duration = normalizeDuration(dM[1]); }
    }

    i++; // past "Spell Description"
    const descLines = [], hlLines = [];
    let inHL = false;
    for (; i < lines.length; i++) {
      const l = lines[i];
      if (/^Notes?$/i.test(l)) break;
      if (/^Spoken Name:/i.test(l)) break;
      if (/^Attributes$/i.test(l)) { i--; break; } // next spell started
      if (/^=====|^Chapter|^CHAPTER|^\d+$/.test(l)) continue;
      if (/^At Higher Levels?$/i.test(l)) { inHL = true; continue; }
      if (inHL) hlLines.push(l);
      else if (l) descLines.push(l);
    }

    const description = descLines.join(' ').replace(/\s+/g,' ').trim();
    const atHigherLevels = hlLines.join(' ').replace(/\s+/g,' ').trim() || undefined;
    if (!description || level === null || !school) continue;

    const spokenName = spokenNames[si++] ?? '';
    spells.push({ name:spellName, spokenName, level, school, concentration, ritual,
      castingTime: castingTime||'1 Action', rawRange:range, range:normalizeRange(range),
      components, duration, description, atHigherLevels, classes:['Warlock'], source });
  }

  console.log(`Warlock_Spell_Compendium: ${spells.length} spells (${spokenNames.length} spoken names)`);
  return spells;
}

// ─── 4. Science Spellbook ─────────────────────────────────────────────────────

function parseScienceSpellbook() {
  const text = read('The_Science_Spellbook_V1.3.txt');
  const spells = [];

  // Each spell ends with "Spell List: Class1, Class2, ..."
  const chunks = text.split(/\nSpell List[s:]*/i);

  for (let ci = 0; ci < chunks.length - 1; ci++) {
    const chunk = chunks[ci];
    const nextChunk = chunks[ci+1] ?? '';
    const classLine = nextChunk.split('\n').find(l=>l.trim().length>0)?.trim() ?? '';
    const classes = classLine.split(/[,;]/).map(c=>c.trim()).filter(c=>/^[A-Z]/.test(c));
    if (!classes.length) continue;

    const lines = chunk.split('\n').map(l=>l.trim()).filter(l=>l);

    let levelIdx = -1, level = null, school = null;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const lv = parseLevel(l);
      const sc = SCHOOLS.find(s => l.toLowerCase().includes(s.toLowerCase()));
      if (lv !== null && sc) { level = lv; school = sc; levelIdx = i; break; }
      if (/cantrip/i.test(l) && sc) { level = 0; school = sc; levelIdx = i; break; }
    }
    if (levelIdx < 0) continue;

    let spellName = null;
    for (let i = levelIdx-1; i >= 0; i--) {
      const l = lines[i];
      if (!l || /^=====|^CHAPTER|\d+$/.test(l)) continue;
      if (/introduction|credits|disclaimer|legal/i.test(l)) break;
      spellName = l;
      break;
    }
    if (!spellName || spellName.length < 2) continue;

    let castingTime = '', rawRange = '', components = '', duration = '';
    let concentration = false;
    let fieldEnd = levelIdx+1;
    for (; fieldEnd < lines.length; fieldEnd++) {
      const l = lines[fieldEnd];
      const ctM = l.match(/^Casting Time\s*:?\s*(.+)/i);
      const rM  = l.match(/^Range\s*:?\s*(.+)/i);
      const dM  = l.match(/^Duration\s*:?\s*(.+)/i);
      const cM  = l.match(/^Components\s*:?\s*(.+)/i);
      if (ctM) { castingTime = ctM[1].trim(); continue; }
      if (rM)  { rawRange = rM[1].trim(); continue; }
      if (dM)  { if (/concentration/i.test(dM[1])) concentration = true; duration = normalizeDuration(dM[1]); continue; }
      if (cM)  { components = cM[1].trim(); continue; }
      if (/^Target\s*:?/i.test(l)) continue;
      break;
    }

    const description = lines.slice(fieldEnd)
      .filter(l => !/^=====|^\d+$|[A-Z][a-z]+ [A-Z][a-z]+\s*\|/.test(l))
      .join(' ').replace(/\s+/g,' ').trim();
    if (!description) continue;

    spells.push({ name:spellName, spokenName:'', level, school, concentration, ritual:false,
      castingTime: castingTime||'1 Action', rawRange, range:normalizeRange(rawRange),
      components: components||'V, S', duration: duration||'Instantaneous',
      description, atHigherLevels:undefined, classes, source:'ScienceSpellbook' });
  }

  console.log(`Science Spellbook: ${spells.length} spells`);
  return spells;
}

// ─── 5. Merge + output ────────────────────────────────────────────────────────

function merge(compendiumSpells, dictionary, scienceSpells) {
  const byKey = new Map();

  for (const sp of compendiumSpells) {
    const k = key(sp.name);
    if (byKey.has(k)) {
      const ex = byKey.get(k);
      for (const cls of sp.classes) if (!ex.classes.includes(cls)) ex.classes.push(cls);
    } else {
      byKey.set(k, { ...sp });
    }
  }

  for (const [k, sp] of byKey) {
    const d = dictionary[k];
    sp.damage = d ? d.damage : 'None';
    const { areaShape, areaNotation } = deriveArea(d ? d.areaShape : 'None', sp.rawRange, sp.description);
    sp.areaShape = areaShape;
    sp.areaNotation = areaNotation;
    delete sp.rawRange;
  }

  for (const sp of scienceSpells) {
    const k = key(sp.name);
    if (byKey.has(k)) {
      const ex = byKey.get(k);
      for (const cls of sp.classes) if (!ex.classes.includes(cls)) ex.classes.push(cls);
    } else {
      sp.damage = 'None';
      const { areaShape, areaNotation } = deriveArea('None', sp.rawRange, sp.description);
      sp.areaShape = areaShape;
      sp.areaNotation = areaNotation;
      delete sp.rawRange;
      byKey.set(k, sp);
    }
  }

  return [...byKey.values()];
}

function buildSpells(merged) {
  return merged
    .filter(sp => sp.name && sp.description)
    .map(sp => ({
      id: slugify(sp.name),
      name: sp.name,
      source: sp.source ?? 'Compendium',
      level: sp.level,
      school: sp.school,
      damage: sp.damage,
      areaShape: sp.areaShape,
      areaSound: sp.areaNotation,
      range: sp.range,
      duration: sp.duration,
      concentration: sp.concentration,
      ritual: sp.ritual,
      castingTime: sp.castingTime,
      components: sp.components,
      classes: sp.classes.sort(),
      description: sp.description,
      ...(sp.atHigherLevels ? { atHigherLevels: sp.atHigherLevels } : {}),
    }))
    .sort((a,b) => a.level - b.level || a.name.localeCompare(b.name));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const dictionary      = parseDictionary();
const compendiumSpells = [
  ...parseCompendium('Wizard_Spell_Compendium_V7.txt',    'Wizard',   'Wizard Compendium V7'),
  ...parseCompendium('Sorcerer_Compendium.txt',           'Sorcerer', 'Sorcerer Compendium'),
  ...parseWarlockCompendium('Warlock Spell Compendium v1.3'),
  ...parseCompendium('Druid_Book.txt',                    'Druid',    'Druid Book'),
];
const scienceSpells   = parseScienceSpellbook();
const merged          = merge(compendiumSpells, dictionary, scienceSpells);
const spells          = buildSpells(merged);

writeFileSync(OUT, JSON.stringify(spells, null, 2), 'utf8');
console.log(`\n✓ ${spells.length} spells → ${OUT}`);

const withArea    = spells.filter(s => s.areaNotation !== 'None').length;
const withHL      = spells.filter(s => s.atHigherLevels).length;
const science     = spells.filter(s => s.source === 'ScienceSpellbook').length;
const multiClass  = spells.filter(s => s.classes.length > 1).length;
console.log(`  ${withArea} with sized areaNotation`);
console.log(`  ${withHL} with At Higher Levels`);
console.log(`  ${science} science spells`);
console.log(`  ${multiClass} multi-class spells`);

const dmgDist = {};
for (const s of spells) dmgDist[s.damage] = (dmgDist[s.damage]??0)+1;
console.log('  Damage:', Object.fromEntries(Object.entries(dmgDist).sort()));
