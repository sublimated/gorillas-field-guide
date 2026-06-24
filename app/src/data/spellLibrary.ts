import spellsJson from './spells.json';
import { prepareSpellLibrary, type RawSpell, type Spell } from './spells';

export const SPELLS: Spell[] = prepareSpellLibrary(spellsJson as RawSpell[]);
