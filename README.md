# Gorilla's Field Guide

Gorilla's Field Guide is an interactive spell compendium and experimental visual
notation workbench. It presents spells as hand-drawn pages with class-specific
sigils, spoken forms, spell statistics, source filtering, and a player-editable
glyph center where that system supports one.

The application currently includes Wizard, Sorcerer, Druid, and Warlock visual
systems. Cleric, Bard, Paladin, Ranger, and psionic classes intentionally use
the Wizard presentation until their own notation systems are designed.

## Requirements

- Node.js 20 or newer
- npm (bundled with Node.js)

## Install And Run

The Vite application lives in `app/`.

```powershell
cd app
npm install
npm run dev
```

Vite prints a local URL, normally `http://localhost:5173/`. Open that URL in a
browser.

To make a production build:

```powershell
cd app
npm run build
npm run preview
```

## Use

1. Start in the Compendium and choose the editions and compendiums to include.
   - 5e compendiums appear when a 5e edition is enabled.
   - 3.5 supplements appear when the 3.5 source is enabled.
2. Search by spell name, school, damage, or class. Choose a class to narrow the
   spell list. The Psionics entry expands to its psionic classes when selected.
3. Use the level and school tabs to refine the list, then select a spell page to
   open its full detail view.
4. Select a casting slot where available. Warlock spells with per-level ranges,
   durations, or areas respond to the caster-level control.
5. Use the color controls to switch between the default drawing palette and
   arcane spectroscopy. The chosen filters, source selections, font, and view
   state are saved locally in the browser.
6. Double-click an editable sigil center to choose a personal glyph image. This
   is supported by the Sorcerer, Druid, and Warlock systems.

## Spell Data

The library combines the original compendium data with separate 5e and 3.5
source records. Different editions remain separate spell versions rather than
being merged. Class filters use the class association from every active version,
so a spell appears for a class when any of its editions lists that class.

Spell source PDFs are intentionally not tracked in Git. They can remain as local
research material, but the repository contains only the application, extracted
spell data, and supporting code/assets.

## Current Notation Limits

Some spell values are deliberately preserved without invented notation. The six
psionic disciplines have no official visual system in this project yet, so their
school slot remains blank. A small set of 3.5 range and duration variants also
await normalization or notation design. See [docs/NEEDS_NOTATION.md](docs/NEEDS_NOTATION.md)
for the current inventory.

## Development Checks

```powershell
cd app
npx tsc --noEmit -p tsconfig.app.json
npm run test
npm run audit:data
```

## Licensing And Attribution

See [NOTICE.md](NOTICE.md) for SRD 5.1, SRD 5.2, and D&D 3.5 SRD attribution
requirements. The project is a fan-made prototype and is not affiliated with or
endorsed by Wizards of the Coast or any third-party compendium author.
