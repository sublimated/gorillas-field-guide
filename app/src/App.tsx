import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { fileToGlyphSrc } from './alphabet/glyphImage';
import { PSIONIC_SCHOOLS, SOURCE_CONFIG, groupSpells, toAttributes, toSoundInput, versionTabsFor, type Spell } from './data/spells';
import { RuneView } from './components/RuneView';
import { SealView } from './components/SealView';
import { SpectrumView } from './components/SpectrumView';
import { SpokenNameView } from './components/SpokenNameView';
import { GlyphAuthor } from './components/GlyphAuthor';
import { MiniSigil } from './components/MiniSigil';
import { SpokesView } from './components/SpokesView';
import { WarlockView } from './components/WarlockView';
import { getGlyph, useAlphabet } from './alphabet/glyphStore';
import { spellColor, rgbCss } from './engines/spectrum';
import { buildCollisionVariantIndex, collisionVariantFor } from './data/collisionVariants';
import { hasScalingAttributeValue, normalizeAreaNotation } from './data/normalizeAttributes';
import { useColorMode, customColorFor, CUSTOMIZABLE_ATTRS, type ColorMode } from './engines/colorModes';
import type { AttributeKey } from './engines/attributes';
import { notationSupportForMode, type GlyphMode } from './engines/notationSupport';
import type { CSSVars } from './cssVars';

const CANTRIP_BREAKPOINTS = [1, 5, 11, 17];
const ALL_CLASSES = 'All classes';
const ALL_LEVELS = 'All levels';
const ALL_SCHOOLS = 'All schools';
const PSIONICS_MENU = '__psionics_menu__';
const PSIONIC_CLASSES = new Set(['Psion', 'Psychic Warrior', 'Wilder', 'Lurk', 'Ardent', 'Divine Mind']);
const FIVE_E_BASE_SOURCES = ['SRD 5.1', 'SRD 5.2'];
const FIVE_E_COMPENDIUM_SOURCES = ['Wizard Compendium V7', 'Druid Book', 'Warlock Spell Compendium v1.3', 'Sorcerer Compendium', 'ScienceSpellbook'];
const THREE_FIVE_BASE_SOURCE = 'D&D 3.5 SRD';
const THREE_FIVE_SUPPLEMENT_SOURCES = ['D&D 3.5 SRD Psionics', 'Complete Psionic (3.5)', 'Spell Compendium (3.5)', 'Dragon Magic (3.5)', 'Complete Mage (3.5)'];

type SavedAppState = {
  activeSources?: string[];
  spellGroupKey?: string;
  spellVersionSource?: string;
  castLevel?: number;
  charLevel?: number;
  view?: 'compendium' | 'alphabet';
  compendiumView?: 'list' | 'detail';
  spellQuery?: string;
  classFilter?: string;
  levelFilter?: number | typeof ALL_LEVELS;
  schoolFilter?: string;
  displayFont?: string;
};

const APP_STATE_STORAGE_KEY = 'god-app:state:v1';

function readSavedAppState(): SavedAppState {
  try {
    const value = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY) ?? 'null');
    return value && typeof value === 'object' ? value as SavedAppState : {};
  } catch {
    return {};
  }
}

const SOURCE_MODE: Partial<Record<Spell['source'], GlyphMode>> = {
  'Sorcerer Compendium': 'sorcerer',
  'Druid Book': 'druid',
  'Warlock Spell Compendium v1.3': 'warlock',
  'Wizard Compendium V7': 'wizard',
  ScienceSpellbook: 'wizard',
};

const FONT_OPTIONS = [
  { label: 'Embolism Spark', value: "'Embolism Spark', 'Cinzel', Georgia, serif" },
  { label: 'Six Hands', value: "'Six Hands Black', 'Cinzel', Georgia, serif" },
  { label: 'Cinzel', value: "'Cinzel', Georgia, serif" },
];

const ATTR_LABELS: Record<AttributeKey, string> = {
  level: 'Level',
  school: 'School',
  damage: 'Damage',
  area: 'Area',
  range: 'Range',
  duration: 'Duration',
};

function classNameClean(name: string) {
  return name.replace(/\.+$/, '');
}

function levelLabel(level: number | typeof ALL_LEVELS) {
  if (level === ALL_LEVELS) return 'All';
  return level === 0 ? 'Cantrips' : `Level ${level}`;
}

function glyphModeForSpell(spell: Spell, classFilter: string): GlyphMode {
  if (classFilter !== ALL_CLASSES) {
    if (classFilter === 'Sorcerer' && spell.classes.some((c) => classNameClean(c) === 'Sorcerer')) return 'sorcerer';
    if (classFilter === 'Druid' && spell.classes.some((c) => classNameClean(c) === 'Druid')) return 'druid';
    if (classFilter === 'Warlock' && spell.classes.some((c) => classNameClean(c) === 'Warlock')) return 'warlock';
    return 'wizard';
  }
  return SOURCE_MODE[spell.source] ?? 'wizard';
}

function sourceIsAvailable(source: string, activeSources: Set<string>): boolean {
  if (FIVE_E_COMPENDIUM_SOURCES.includes(source)) return FIVE_E_BASE_SOURCES.some((id) => activeSources.has(id));
  if (THREE_FIVE_SUPPLEMENT_SOURCES.includes(source)) return activeSources.has(THREE_FIVE_BASE_SOURCE);
  return true;
}

function formatDamageLabel(damage: string, damageSecondary?: string): string {
  return damageSecondary ? `${damage} and ${damageSecondary}` : damage;
}

function StatRow({
  k,
  dt,
  dd,
  hi,
  on,
}: {
  k: string;
  dt: string;
  dd: string;
  hi: string | null;
  on: (key: string | null) => void;
}) {
  return (
    <div
      className={`stat-row${hi === k ? ' hot' : ''}`}
      onMouseEnter={() => on(k)}
      onMouseLeave={() => on(null)}
    >
      <dt>{dt}</dt>
      <dd>{dd}</dd>
    </div>
  );
}

export default function App() {
  const [spells, setSpells] = useState<Spell[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('./data/spellLibrary')
      .then((module) => {
        if (!cancelled) setSpells(module.SPELLS);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Unknown error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    return (
      <div className="page">
        <header className="masthead">
          <h1>Gorilla&apos;s field guide</h1>
          <p className="subtitle">A working theory of practical magic</p>
        </header>
        <main className="paper-sheet loading-sheet">
          <p>Spell library failed to load.</p>
          <p className="loading-note">{loadError}</p>
        </main>
      </div>
    );
  }

  if (!spells) {
    return (
      <div className="page">
        <header className="masthead">
          <h1>Gorilla&apos;s field guide</h1>
          <p className="subtitle">A working theory of practical magic</p>
        </header>
        <main className="paper-sheet loading-sheet">
          <p>Loading the field notes…</p>
        </main>
      </div>
    );
  }

  return <LoadedApp spells={spells} />;
}

function LoadedApp({ spells }: { spells: Spell[] }) {
  const savedState = useMemo(() => readSavedAppState(), []);
  const initialSpellGroupKey = useMemo(
    () => spells.find((s) => s.name.toLowerCase() === 'fireball')?.name.toLowerCase() ?? spells[0].name.toLowerCase(),
    [spells],
  );
  const [activeSources, setActiveSources] = useState<Set<string>>(
    () => new Set(savedState.activeSources ?? SOURCE_CONFIG.filter((s) => s.defaultOn).map((s) => s.id)),
  );
  const [spellGroupKey, setSpellGroupKey] = useState<string>(savedState.spellGroupKey ?? initialSpellGroupKey);
  const [spellVersionSource, setSpellVersionSource] = useState<string>(
    savedState.spellVersionSource ?? SOURCE_CONFIG.find((s) => s.defaultOn)?.id ?? 'SRD 5.2',
  );
  const [replay, setReplay] = useState(0);
  const { mode: colorMode, custom: customColors, setMode: setColorMode, setAllColor, setAttrColor } = useColorMode();
  const [castLevel, setCastLevel] = useState(
    savedState.castLevel ?? spells.find((s) => s.name.toLowerCase() === initialSpellGroupKey)?.level ?? spells[0].level,
  );
  const [charLevel, setCharLevel] = useState(savedState.charLevel ?? 1);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [view, setView] = useState<'compendium' | 'alphabet'>(savedState.view ?? 'compendium');
  const [compendiumView, setCompendiumView] = useState<'list' | 'detail'>(savedState.compendiumView ?? 'list');
  const [spellQuery, setSpellQuery] = useState(savedState.spellQuery ?? '');
  const [classFilter, setClassFilter] = useState(savedState.classFilter ?? ALL_CLASSES);
  const [psionicsMenuOpen, setPsionicsMenuOpen] = useState(
    () => PSIONIC_CLASSES.has(savedState.classFilter ?? ALL_CLASSES),
  );
  const [levelFilter, setLevelFilter] = useState<number | typeof ALL_LEVELS>(
    savedState.levelFilter ?? spells.find((s) => s.name.toLowerCase() === initialSpellGroupKey)?.level ?? ALL_LEVELS,
  );
  const [schoolFilter, setSchoolFilter] = useState(savedState.schoolFilter ?? ALL_SCHOOLS);
  const [displayFont, setDisplayFont] = useState(
    () => FONT_OPTIONS.some((font) => font.value === savedState.displayFont)
      ? savedState.displayFont!
      : FONT_OPTIONS[0].value,
  );
  const { alphabet, setGlyph, removeGlyph, replaceAll } = useAlphabet();

  const sorcererCenterInput = useRef<HTMLInputElement>(null);
  const druidCenterInput = useRef<HTMLInputElement>(null);
  const warlockCenterInput = useRef<HTMLInputElement>(null);
  const sorcererCenter = getGlyph(alphabet, 'sorcerer', 'center');
  const druidCenter = getGlyph(alphabet, 'druid', 'center');
  const warlockCenter = getGlyph(alphabet, 'warlock', 'center');
  const changeCenterGlyph = (
    attr: 'sorcerer' | 'druid' | 'warlock',
    current: ReturnType<typeof getGlyph>,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    fileToGlyphSrc(file)
      .then((src) => setGlyph(attr, 'center', { src, scale: current?.scale ?? 1 }))
      .catch(() => alert('Could not read that center image.'));
    event.target.value = '';
  };
  const changeSorcererCenter = (event: React.ChangeEvent<HTMLInputElement>) => {
    changeCenterGlyph('sorcerer', sorcererCenter, event);
  };
  const changeDruidCenter = (event: React.ChangeEvent<HTMLInputElement>) => {
    changeCenterGlyph('druid', druidCenter, event);
  };
  const changeWarlockCenter = (event: React.ChangeEvent<HTMLInputElement>) => {
    changeCenterGlyph('warlock', warlockCenter, event);
  };
  const setCenterScale = (attr: 'sorcerer' | 'druid' | 'warlock', glyph: ReturnType<typeof getGlyph>, scale: number) => {
    if (!glyph?.src) return;
    setGlyph(attr, 'center', { ...glyph, scale });
  };

  const spellGroups = useMemo(() => groupSpells(spells), [spells]);
  const activeSpells = useMemo(
    () => spells.filter((s) => activeSources.has(s.source) && sourceIsAvailable(s.source, activeSources)),
    [activeSources, spells],
  );
  const activeSpellGroups = useMemo(
    () => groupSpells(activeSpells),
    [activeSpells],
  );
  const spellGroup = useMemo(
    () => activeSpellGroups.find((group) => group.key === spellGroupKey),
    [activeSpellGroups, spellGroupKey],
  );
  const spell = useMemo(
    () => spellGroup?.versions.find((version) => version.source === spellVersionSource) ?? spellGroup?.versions[0],
    [spellGroup, spellVersionSource],
  );
  const fallbackSpell = spell ?? activeSpellGroups[0]?.versions[0] ?? spellGroups[0]?.versions[0] ?? spells[0];
  const versionTabs = useMemo(
    () => (spellGroup ? versionTabsFor(spellGroup.versions) : []),
    [spellGroup],
  );

  const attrs = useMemo(() => toAttributes(fallbackSpell), [fallbackSpell]);
  const sound = useMemo(() => toSoundInput(fallbackSpell), [fallbackSpell]);
  // Detail render system: a selected class with its own system uses it; any other selected
  // class (Wizard, Cleric, Bard, Paladin, Ranger, the psionic classes) defaults to the
  // wizard system until those systems exist. "All classes" previews each spell by its source.
  const mode: GlyphMode =
    classFilter === 'Sorcerer' ? 'sorcerer' :
    classFilter === 'Druid' ? 'druid' :
    classFilter === 'Warlock' ? 'warlock' :
    classFilter === ALL_CLASSES ? glyphModeForSpell(fallbackSpell, classFilter) :
    'wizard';
  const classOptions = useMemo(
    () => [ALL_CLASSES, ...Array.from(new Set(spells.flatMap((s) => s.classes.map(classNameClean)))).sort()],
    [spells],
  );
  const psionicClassOptions = useMemo(
    () => classOptions.filter((option) => PSIONIC_CLASSES.has(option)),
    [classOptions],
  );
  const standardClassOptions = useMemo(
    () => classOptions.filter((option) => option === ALL_CLASSES || !PSIONIC_CLASSES.has(option)),
    [classOptions],
  );
  const isPsionicClass = PSIONIC_CLASSES.has(classFilter);
  const bookSpells = useMemo(() => {
    const q = spellQuery.trim().toLowerCase();
    return activeSpellGroups.filter((group) => {
      const representative = group.versions[0];
      // Match a class if ANY version in the group lists it: the representative is the
      // highest-priority source (often a single-class compendium like Druid Book), so a
      // spell's full class list lives across its versions (e.g. Cure Wounds is Cleric/Bard/
      // Paladin/Ranger in the SRD even though Druid Book tags it Druid-only).
      const matchesClass =
        classFilter === ALL_CLASSES ||
        group.versions.some((v) => v.classes.some((c) => classNameClean(c) === classFilter));
      const matchesQuery =
        q.length === 0 ||
        representative.name.toLowerCase().includes(q) ||
        representative.school.toLowerCase().includes(q) ||
        representative.damage.toLowerCase().includes(q) ||
        group.versions.some((v) => v.classes.some((c) => c.toLowerCase().includes(q)));
      return matchesClass && matchesQuery;
    });
  }, [activeSpellGroups, classFilter, spellQuery]);
  const levelOptions = useMemo(
    () => [ALL_LEVELS, ...Array.from(new Set(bookSpells.map((group) => group.versions[0].level))).sort((a, b) => a - b)] as (number | typeof ALL_LEVELS)[],
    [bookSpells],
  );
  const schoolOptions = useMemo(
    () => [
      ALL_SCHOOLS,
      ...Array.from(new Set(bookSpells.map((group) => group.versions[0].school)))
        .filter((school) => isPsionicClass ? PSIONIC_SCHOOLS.includes(school as typeof PSIONIC_SCHOOLS[number]) : !PSIONIC_SCHOOLS.includes(school as typeof PSIONIC_SCHOOLS[number]))
        .sort(),
    ],
    [bookSpells, isPsionicClass],
  );
  const filteredSpellGroups = useMemo(
    () => bookSpells.filter((group) => {
      const representative = group.versions[0];
      const matchesLevel = levelFilter === ALL_LEVELS || representative.level === levelFilter;
      // "Universal" is school-less (no school glyph): it shows up under every school filter
      // for whatever class list it appears in.
      const matchesSchool =
        schoolFilter === ALL_SCHOOLS ||
        representative.school === schoolFilter ||
        representative.school === 'Universal';
      return matchesLevel && matchesSchool;
    }),
    [bookSpells, levelFilter, schoolFilter],
  );
  const warlockHasScaling = useMemo(
    () => [fallbackSpell.range, fallbackSpell.duration, fallbackSpell.areaNotation].some((value) => hasScalingAttributeValue(value)),
    [fallbackSpell],
  );

  const isCantrip = fallbackSpell.level === 0;
  const collisionVariants = useMemo(() => buildCollisionVariantIndex(spells), [spells]);
  const collisionVariant = useMemo(
    () => collisionVariantFor(fallbackSpell, isCantrip ? fallbackSpell.level : castLevel, collisionVariants),
    [fallbackSpell, castLevel, collisionVariants, isCantrip],
  );

  const castAttrs = useMemo(
    () => (isCantrip ? { ...attrs, casterLevel: charLevel } : { ...attrs, level: castLevel, casterLevel: charLevel }),
    [attrs, castLevel, charLevel, isCantrip],
  );
  const castSound = useMemo(
    () => (isCantrip ? sound : { ...sound, castLevel }),
    [sound, castLevel, isCantrip],
  );
  const displayArea = useMemo(() => {
    const resolved = normalizeAreaNotation(fallbackSpell.areaNotation, charLevel, fallbackSpell.areaShape);
    return resolved === 'None' ? fallbackSpell.areaShape : resolved;
  }, [fallbackSpell, charLevel]);
  const activeCenterMode = mode === 'wizard' ? null : mode;
  const activeCenterGlyph =
    activeCenterMode === 'sorcerer' ? sorcererCenter :
    activeCenterMode === 'druid' ? druidCenter :
    activeCenterMode === 'warlock' ? warlockCenter :
    undefined;
  const notationSupport = useMemo(
    () => notationSupportForMode(mode, castAttrs, charLevel),
    [castAttrs, charLevel, mode],
  );
  const unsupportedLabels = notationSupport.unsupported.map((key) => ATTR_LABELS[key]);

  const tint = rgbCss(spellColor(castAttrs));

  useEffect(() => {
    // Intentional: falls back to a valid spell/version when the active source toggles make
    // the current selection disappear — reacting to external state, not deriving render state.
    if (activeSpellGroups.length === 0) return;
    if (!spellGroup) {
      const nextGroup = activeSpellGroups[0];
      const nextSpell = nextGroup.versions[0];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSpellGroupKey(nextGroup.key);
      setSpellVersionSource(nextSpell.source);
      setCastLevel(nextSpell.level);
      return;
    }
    if (!spell) {
      const nextSpell = spellGroup.versions[0];
      setSpellVersionSource(nextSpell.source);
      setCastLevel(nextSpell.level);
    }
  }, [activeSpellGroups, spell, spellGroup]);

  useEffect(() => {
    const state: SavedAppState = {
      activeSources: [...activeSources],
      spellGroupKey,
      spellVersionSource,
      castLevel,
      charLevel,
      view,
      compendiumView,
      spellQuery,
      classFilter,
      levelFilter,
      schoolFilter,
      displayFont,
    };
    try {
      localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('App state not persisted (storage unavailable):', error);
    }
  }, [
    activeSources,
    spellGroupKey,
    spellVersionSource,
    castLevel,
    charLevel,
    view,
    compendiumView,
    spellQuery,
    classFilter,
    levelFilter,
    schoolFilter,
    displayFont,
  ]);

  const toggleSource = (source: string) => {
    setActiveSources((current) => {
      const next = new Set(current);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const choose = (groupKey: string) => {
    const nextGroup = filteredSpellGroups.find((group) => group.key === groupKey) ?? activeSpellGroups.find((group) => group.key === groupKey);
    if (!nextGroup) return;
    const next = nextGroup.versions[0];
    setSpellGroupKey(groupKey);
    setSpellVersionSource(next.source);
    setCastLevel(next.level);
    setCharLevel(1);
    setCompendiumView('detail');
    setReplay((r) => r + 1);
  };

  const chooseVersion = (source: string) => {
    if (!spellGroup) return;
    const next = spellGroup.versions.find((version) => version.source === source);
    if (!next) return;
    setSpellVersionSource(source);
    setCastLevel((current) => (next.level === 0 ? 0 : Math.max(current, next.level)));
    setReplay((r) => r + 1);
  };

  const chooseCastLevel = (lvl: number) => {
    setCastLevel(lvl);
    setReplay((r) => r + 1);
  };

  const isUpcast = !isCantrip && castLevel > fallbackSpell.level;

  return (
    <div className="page" style={{ '--tint': tint, '--display-font': displayFont } as CSSVars}>
      <header className="masthead">
        <h1>Gorilla&apos;s field guide</h1>
        <p className="subtitle">A working theory of practical magic</p>
        <label className="font-picker">
          <span>Script</span>
          <select value={displayFont} onChange={(e) => setDisplayFont(e.target.value)} aria-label="Choose script font">
            {FONT_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <nav className="view-tabs">
          {(['compendium', 'alphabet'] as const).map((v) => (
            <button
              key={v}
              className={`view-tab${view === v ? ' active' : ''}`}
              onClick={() => setView(v)}
            >
              {v === 'compendium' ? 'Compendium' : 'Scriptorium'}
            </button>
          ))}
        </nav>
      </header>

      {view === 'alphabet' ? (
        <GlyphAuthor
          alphabet={alphabet}
          setGlyph={setGlyph}
          removeGlyph={removeGlyph}
          replaceAll={replaceAll}
        />
      ) : (
        <>
          {compendiumView === 'list' ? (
            <main className="paper-sheet spell-list-view">
              <section className="spell-browser draw-layer" aria-label="Spell browser">
                <div className="spell-browser-controls">
                  <input
                    className="spell-search draw-item"
                    style={{ animationDelay: '120ms' }}
                    value={spellQuery}
                    onChange={(e) => setSpellQuery(e.target.value)}
                    placeholder="Search spells"
                    aria-label="Search spells"
                  />
                  <select
                    className="draw-item"
                    style={{ animationDelay: '280ms' }}
                    value={classFilter}
                    onChange={(e) => {
                      const nextClass = e.target.value;
                      if (nextClass === PSIONICS_MENU) {
                        setPsionicsMenuOpen((open) => !open);
                        return;
                      }
                      setClassFilter(nextClass);
                      setSchoolFilter(ALL_SCHOOLS);
                      setPsionicsMenuOpen(PSIONIC_CLASSES.has(nextClass));
                    }}
                    aria-label="Filter by class"
                  >
                    {standardClassOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                    {psionicClassOptions.length > 0 && (
                      <option value={PSIONICS_MENU}>
                        {psionicsMenuOpen ? 'Psionics (close)' : 'Psionics >'}
                      </option>
                    )}
                    {psionicsMenuOpen && psionicClassOptions.map((option) => (
                      <option key={option} value={option}>  {option}</option>
                    ))}
                  </select>
                </div>
                <div className="spell-browser-filters draw-item" style={{ animationDelay: '440ms' }}>
                  <div className="source-group">
                    <span className="source-group-label">5e:</span>
                    {SOURCE_CONFIG.filter((source) => FIVE_E_BASE_SOURCES.includes(source.id)).map((source) => (
                      <button
                        key={source.id}
                        className={`source-toggle${activeSources.has(source.id) ? ' active' : ''}`}
                        onClick={() => toggleSource(source.id)}
                      >
                        {source.label}
                      </button>
                    ))}
                  </div>
                  {FIVE_E_BASE_SOURCES.some((source) => activeSources.has(source)) && (
                    <div className="source-subgroup">
                      <span className="source-group-label">Compendiums:</span>
                      {SOURCE_CONFIG.filter((source) => FIVE_E_COMPENDIUM_SOURCES.includes(source.id)).map((source) => (
                        <button
                          key={source.id}
                          className={`source-toggle${activeSources.has(source.id) ? ' active' : ''}`}
                          onClick={() => toggleSource(source.id)}
                        >
                          {source.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="source-group">
                    <span className="source-group-label">3.5:</span>
                    {SOURCE_CONFIG.filter((source) => source.id === THREE_FIVE_BASE_SOURCE).map((source) => (
                      <button
                        key={source.id}
                        className={`source-toggle${activeSources.has(source.id) ? ' active' : ''}`}
                        onClick={() => toggleSource(source.id)}
                      >
                        {source.label}
                      </button>
                    ))}
                  </div>
                  {activeSources.has(THREE_FIVE_BASE_SOURCE) && (
                    <div className="source-subgroup">
                      <span className="source-group-label">Supplements:</span>
                      {SOURCE_CONFIG.filter((source) => THREE_FIVE_SUPPLEMENT_SOURCES.includes(source.id)).map((source) => (
                        <button
                          key={source.id}
                          className={`source-toggle${activeSources.has(source.id) ? ' active' : ''}`}
                          onClick={() => toggleSource(source.id)}
                        >
                          {source.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="spell-browser-count draw-item" style={{ animationDelay: '640ms' }}>
                  {filteredSpellGroups.length} of {activeSpellGroups.length} spells
                </div>
                <nav className="level-tabs" aria-label="Spell levels">
                  {levelOptions.map((lvl, i) => (
                    <button
                      key={lvl}
                      className={`level-tab draw-item${levelFilter === lvl ? ' active' : ''}`}
                      style={{ animationDelay: `${840 + i * 105}ms` }}
                      onClick={() => setLevelFilter(lvl)}
                    >
                      {levelLabel(lvl)}
                    </button>
                  ))}
                </nav>
                <div className="spellbook-pages">
                  <nav className="school-tabs" aria-label="Spell schools">
                    {schoolOptions.map((school, i) => (
                      <button
                        key={school}
                        className={`school-tab draw-item${schoolFilter === school ? ' active' : ''}`}
                        style={{ animationDelay: `${1260 + i * 110}ms` }}
                        onClick={() => setSchoolFilter(school)}
                      >
                        {school === ALL_SCHOOLS ? 'All' : school}
                      </button>
                    ))}
                  </nav>
                  <nav className="sigil-grid" aria-label="Spell pages">
                    {filteredSpellGroups.map((group, i) => {
                      const representative = group.versions[0];
                      // A group can be present because one edition/version belongs to the
                      // selected class while its default representative does not. Preview
                      // the matching version in that case, so Warlock (and the other
                      // dedicated class systems) never silently fall back to Wizard.
                      const previewSpell = classFilter === ALL_CLASSES
                        ? representative
                        : group.versions.find((version) =>
                          version.classes.some((cls) => classNameClean(cls) === classFilter),
                        ) ?? representative;
                      const previewMode = glyphModeForSpell(previewSpell, classFilter);
                      const previewSupport = notationSupportForMode(previewMode, toAttributes(previewSpell));
                      return (
                        <button
                          key={group.key}
                          className={`sigil-cell draw-item ${group.key === spellGroupKey ? 'active' : ''}`}
                          style={{ animationDelay: `${1840 + Math.min(i, 16) * 45}ms` }}
                          onClick={() => choose(group.key)}
                        >
                          <span className="sigil-cell-art">
                            <MiniSigil spell={previewSpell} mode={previewMode} colored={colorMode === 'spectroscopy'} />
                          </span>
                          <span className="tab-name">{group.name}</span>
                          <span className="tab-meta">
                            {representative.level === 0 ? 'Cantrip' : `L${representative.level}`} · {representative.school}
                          </span>
                          {previewSupport.unsupported.length > 0 && (
                            <span className="notation-flag" aria-label={`Notation incomplete: ${previewSupport.unsupported.join(', ')}`}>
                              notation gap
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </div>
              </section>
            </main>
          ) : (
            <main className="paper-sheet spell-detail-view">
              <div className="spell-page-toolbar draw-layer">
                <button className="back-btn draw-item" style={{ animationDelay: '120ms' }} onClick={() => setCompendiumView('list')}>Back to spell list</button>
              </div>
              <section className="casting">
                <div className="rune-stage">
                  <div className="rune-art draw-item" style={{ animationDelay: '360ms' }}>
                    {mode === 'wizard' ? (
                      <RuneView
                        key={`wizard-${fallbackSpell.id}-${castLevel}-${charLevel}-${replay}`}
                        attrs={castAttrs}
                        replayKey={replay}
                        mode={colorMode}
                        custom={customColors}
                        highlight={highlight}
                        onHighlight={setHighlight}
                      />
                    ) : mode === 'druid' ? (
                      <SpokesView
                        key={`druid-${fallbackSpell.id}-${castLevel}-${charLevel}-${replay}`}
                        attrs={castAttrs}
                        replayKey={replay}
                        mode={colorMode}
                        custom={customColors}
                        highlight={highlight}
                        onHighlight={setHighlight}
                        centerGlyph={druidCenter}
                        onRequestCenterChange={() => druidCenterInput.current?.click()}
                      />
                    ) : mode === 'warlock' ? (
                      <WarlockView
                        key={`warlock-${fallbackSpell.id}-${castLevel}-${charLevel}-${replay}`}
                        attrs={castAttrs}
                        castingTime={fallbackSpell.castingTime}
                        replayKey={replay}
                        mode={colorMode}
                        custom={customColors}
                        highlight={highlight}
                        onHighlight={setHighlight}
                        centerGlyph={warlockCenter}
                        onRequestCenterChange={() => warlockCenterInput.current?.click()}
                      />
                    ) : (
                      <SealView
                        key={`sorcerer-${fallbackSpell.id}-${castLevel}-${charLevel}-${replay}`}
                        attrs={castAttrs}
                        replayKey={replay}
                        mode={colorMode}
                        custom={customColors}
                        highlight={highlight}
                        onHighlight={setHighlight}
                        alphabet={alphabet}
                        areaNotation={castAttrs.areaNotation}
                        centerGlyph={sorcererCenter}
                        onRequestCenterChange={() => sorcererCenterInput.current?.click()}
                      />
                    )}
                  </div>

                  {isCantrip ? (
                    <div className="cast-stepper draw-item" style={{ animationDelay: '1080ms' }}>
                      <span className="cast-stepper-label">Character level</span>
                      {CANTRIP_BREAKPOINTS.map((cl) => (
                        <button
                          key={cl}
                          className={`cast-level-btn${charLevel === cl ? ' active' : ''}`}
                          onClick={() => setCharLevel(cl)}
                        >
                          {cl}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="cast-stepper draw-item" style={{ animationDelay: '1080ms' }}>
                      <span className="cast-stepper-label">Cast at slot</span>
                      {Array.from({ length: 10 - fallbackSpell.level }, (_, i) => fallbackSpell.level + i).map((lvl) => (
                        <button
                          key={lvl}
                          className={`cast-level-btn${castLevel === lvl ? ' active' : ''}${lvl === fallbackSpell.level ? ' base' : ''}`}
                          onClick={() => chooseCastLevel(lvl)}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  )}

                  {mode === 'warlock' && warlockHasScaling && (
                    <div className="cast-stepper caster-level-stepper draw-item" style={{ animationDelay: '1180ms' }}>
                      <span className="cast-stepper-label">Caster level</span>
                      <label className="caster-level-control">
                        <input
                          type="range"
                          min={1}
                          max={20}
                          step={1}
                          value={charLevel}
                          onChange={(e) => {
                            setCharLevel(Number(e.target.value));
                            setReplay((r) => r + 1);
                          }}
                        />
                        <span>{charLevel}</span>
                      </label>
                    </div>
                  )}

                  <div className="rune-controls draw-item" style={{ animationDelay: '1280ms' }}>
                    <button onClick={() => setReplay((r) => r + 1)}>recast</button>
                    {activeCenterMode && (
                      <>
                        <button
                          onClick={() => {
                            if (activeCenterMode === 'sorcerer') sorcererCenterInput.current?.click();
                            else if (activeCenterMode === 'druid') druidCenterInput.current?.click();
                            else warlockCenterInput.current?.click();
                          }}
                        >
                          center image
                        </button>
                        {activeCenterGlyph?.src && (
                          <>
                            <button onClick={() => removeGlyph(activeCenterMode, 'center')}>
                              reset to default
                            </button>
                            <label className="center-size">
                              size
                              <input
                                type="range"
                                min={0.3}
                                max={4}
                                step={0.05}
                                value={activeCenterGlyph.scale ?? 1}
                                onChange={(e) =>
                                  setCenterScale(
                                    activeCenterMode,
                                    activeCenterGlyph,
                                    Number(e.target.value),
                                  )
                                }
                              />
                            </label>
                          </>
                        )}
                        <input
                          ref={sorcererCenterInput}
                          type="file"
                          accept="image/png,image/webp,image/svg+xml,.svg"
                          onChange={changeSorcererCenter}
                          hidden
                        />
                        <input
                          ref={druidCenterInput}
                          type="file"
                          accept="image/png,image/webp,image/svg+xml,.svg"
                          onChange={changeDruidCenter}
                          hidden
                        />
                        <input
                          ref={warlockCenterInput}
                          type="file"
                          accept="image/png,image/webp,image/svg+xml,.svg"
                          onChange={changeWarlockCenter}
                          hidden
                        />
                      </>
                    )}
                    <div className="color-mode" role="group" aria-label="Glyph colour mode">
                      {([
                        ['normal', 'Normal'],
                        ['spectroscopy', 'Spectroscopy'],
                        ['custom', 'Custom'],
                      ] as [ColorMode, string][]).map(([value, label]) => (
                        <button
                          key={value}
                          className={`color-mode-btn${colorMode === value ? ' active' : ''}`}
                          onClick={() => setColorMode(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {colorMode === 'custom' && (
                    <div className="color-pickers draw-item" style={{ animationDelay: '1340ms' }}>
                      <label className="color-pick color-pick-all">
                        <span>All</span>
                        <input
                          type="color"
                          value={customColors.all}
                          onChange={(e) => setAllColor(e.target.value)}
                          aria-label="Colour for all glyphs"
                        />
                      </label>
                      {CUSTOMIZABLE_ATTRS.map((key) => (
                        <label key={key} className="color-pick">
                          <span>{ATTR_LABELS[key]}</span>
                          <input
                            type="color"
                            value={customColorFor(key, customColors)}
                            onChange={(e) => setAttrColor(key, e.target.value)}
                            aria-label={`Colour for ${ATTR_LABELS[key]}`}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lenses">
                  <div className="lens">
                    <h3>Said</h3>
                    <SpokenNameView
                      input={castSound}
                      highlight={highlight}
                      onHighlight={setHighlight}
                      variant={collisionVariant}
                    />
                  </div>
                  <div className="lens">
                    <h3>Seen</h3>
                    <SpectrumView
                      attrs={castAttrs}
                      replayKey={replay}
                      highlight={highlight}
                      onHighlight={setHighlight}
                      mode={colorMode}
                      custom={customColors}
                    />
                  </div>
                </div>
              </section>

              <section className="statblock">
                {spellGroup && versionTabs.length > 1 && (
                  <div className="version-tabs draw-item" style={{ animationDelay: '200ms' }}>
                    {versionTabs.map((tab) => (
                      <button
                        key={tab.source}
                        className={`version-tab${tab.source === fallbackSpell.source ? ' active' : ''}`}
                        onClick={() => chooseVersion(tab.source)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}
                <h2 className="draw-item" style={{ animationDelay: '3520ms' }}>{fallbackSpell.name}</h2>
                <p className="meta draw-item" style={{ animationDelay: '3760ms' }}>
                  <span
                    className={`meta-stat${highlight === 'level' ? ' hot' : ''}`}
                    onMouseEnter={() => setHighlight('level')}
                    onMouseLeave={() => setHighlight(null)}
                  >
                    {isCantrip ? 'Cantrip' : `Level ${fallbackSpell.level}`}
                  </span>
                  {isUpcast && <span className="upcast-badge"> ? slot {castLevel}</span>}
                  {' · '}
                  <span
                    className={`meta-stat${highlight === 'school' ? ' hot' : ''}`}
                    onMouseEnter={() => setHighlight('school')}
                    onMouseLeave={() => setHighlight(null)}
                  >
                    {fallbackSpell.school}
                  </span>
                  {fallbackSpell.concentration ? ' · Concentration' : ''}
                  {fallbackSpell.ritual ? ' · Ritual' : ''}
                </p>
                <dl className="attrs">
                  <div><dt>Casting Time</dt><dd>{fallbackSpell.castingTime}</dd></div>
                  <StatRow k="range" dt="Range" dd={fallbackSpell.range} hi={highlight} on={setHighlight} />
                  <div><dt>Components</dt><dd>{fallbackSpell.components}</dd></div>
                  <StatRow k="duration" dt="Duration" dd={fallbackSpell.duration} hi={highlight} on={setHighlight} />
                  <StatRow
                    k="damage"
                    dt="Damage"
                    dd={formatDamageLabel(fallbackSpell.damage, fallbackSpell.damageSecondary)}
                    hi={highlight}
                    on={setHighlight}
                  />
                  <StatRow
                    k="area"
                    dt="Area"
                    dd={displayArea}
                    hi={highlight}
                    on={setHighlight}
                  />
                </dl>
                {unsupportedLabels.length > 0 && (
                  <p className="notation-warning draw-item" style={{ animationDelay: '4740ms' }} data-testid="notation-warning">
                    Notation incomplete in this renderer: {unsupportedLabels.join(', ')}.
                  </p>
                )}
                <p className="desc draw-item" style={{ animationDelay: '4920ms' }}>{fallbackSpell.description}</p>
                {fallbackSpell.atHigherLevels && (
                  <p className={`desc higher draw-item${isUpcast || (isCantrip && charLevel > 1) ? ' higher-active' : ''}`} style={{ animationDelay: '5220ms' }}>
                    <em>At Higher Levels.</em> {fallbackSpell.atHigherLevels}
                  </p>
                )}
                <p className="source">
                  {fallbackSpell.source} · classes:
                  {fallbackSpell.classes.map((cls) => {
                    const clean = classNameClean(cls);
                    return (
                      <button
                        key={cls}
                        className={`class-tab${classFilter === clean ? ' active' : ''}`}
                        onClick={() => setClassFilter(clean)}
                      >
                        {clean}
                      </button>
                    );
                  })}
                </p>
              </section>
            </main>
          )}
        </>
      )}

      <footer className="colophon">
        Systems by <strong>The Gorilla of Destiny</strong>. Spell text from SRD 5.1
        (CC&nbsp;BY&nbsp;4.0). Prototype — not affiliated with or endorsed by him.
      </footer>
    </div>
  );
}
