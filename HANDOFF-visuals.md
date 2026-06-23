# GOD App — Handoff (visual + color work)

**Updated:** 2026-06-22
**Branch:** `work/normalization-and-visual-handoff` (all work committed here, nothing pushed)
**App:** `G:\GOD App\app` (Vite + React + TS). Dev: `npm --prefix app run dev` (autoPort).
**Verify:** `cd "G:/GOD App/app" && npx tsc --noEmit && npx vitest run` — baseline **tsc clean, 101/101 pass**.

## State (all committed, working tree clean)
Recent commits, newest first:
- `fd1ba00` original hand-drawn art source files (root: Boxes-*.svg, Line.svg, Square.svg, Search Bar*)
- `3aa1e8d` Wizard sigil: parchment bg, dark 13 vertices, hand-drawn chord strokes (line.svg via per-chord `feFlood`+`feComposite`, clip-path draw-on)
- `dc4bc31` merge of color modes
- `008771c` color modes (Normal / Spectroscopy / Custom) — `engines/colorModes.ts`, `useColorMode` (localStorage `god-app:colorMode:v1`), pickers in detail controls
- `e6184db` visual pass: Embolism Spark font (+30% sizes), flat parchment page (no panels), hand-drawn boxes on elements (`public/textures/boxes/`), name-dedup (`normalizeName`), Scriptorium rename, solid spectrum band w/ masked hand-drawn lines
- `e6ddc53` 3.5 range/duration normalization

## Done
- Data: range+duration normalize to FEATURES (0 gaps); name-casing/spacing dupes merged (Vampiric Touch, Heroes' Feast, Blindness/Deafness, etc.) via `normalizeName` in `data/spells.ts`.
- Type/UI: Embolism Spark default font; flat paper look (header + body, no panels); hand-drawn box frames on search/toggles/tabs/cells; spectrum = solid black band + hand-drawn (line-v.svg masked) colored lines; sigil container shadows removed.
- Color modes: Normal (per-class book ink), Spectroscopy (rainbow), Custom (global + 6 per-attr pickers; also drives the "Seen" lines). Wizard chords are hand-drawn strokes recolored per mode.
- Scriptorium (was "Alphabet"): copy scoped accurately — only the **Sorcerer seal** consumes the drawn glyph alphabet.

## Open / not done
- **Per-class glyph authoring** in Scriptorium (Sorcerer + Warlock selectors). Currently Sorcerer-only by design; Warlock uses its own fixed numeric glyph set. User dismissed the per-class-vs-Sorcerer-only question — confirm intent before building.
- **Custom-mode default color** is dark ink (`#2b2622`) → invisible on dark sigil/spectrum until the user picks a color. Consider a brighter default.
- Sorcerer / Druid / Warlock sigils were NOT given the Wizard's hand-drawn-stroke treatment — only the Wizard was reworked. Decide if the others should match.
- Stale dir `.claude/worktrees/agent-afbe14cce597dcd8f` couldn't be deleted (file lock); gitignored + git-pruned, safe to `rm -rf` manually.

## Constraints (still apply)
- No AI-generated art — final art is the user's own (the root SVGs are their originals).
- WarlockView: color values may change, but do NOT touch its glyph layout / number-glyph hrefs / notation math. Don't touch RANGE/DURATION tables in `engines/warlock.ts`.

## Workflow gotchas (when spawning isolated worktrees)
- A worktree branches from the **last commit**, not the working tree — commit pending work first, or the agent's diff won't include it (caused a 3-way merge earlier). Worktrees have no `node_modules`; agents junction the main repo's to run tooling.
- `preview_eval` `.click()` / synthetic events often don't trigger React handlers reliably; dispatch a real `new MouseEvent('click',{bubbles:true})`, or use `preview_click`. Inputs: use the native value setter + `input` event.
- `preview_screenshot` hung for a whole session once; a `preview_stop`+`preview_start` (new serverId) fixed it. To see a single styled SVG without the page, a canvas rasterizer that inlines computed styles works (external CSS is dropped on naive serialize).
- `.gitignore` excludes: `tmp/`, `app/src/data/spells.BACKUP-*.json`, `app/.visual-checks/`, `.claude/worktrees/`.
