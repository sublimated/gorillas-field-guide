# Default glyph alphabet

Shipped, human-made default symbols for the glyph-based render modes (Sorcerer seal,
Warlock runes, Druid ogham). Wizard chords are algorithmic and need no files.

These are **default art only** — a baseline so spells render fully out of the box. Users
can draw or import their own glyphs (stored locally), which override these. Per the
project's no-AI-art rule, every file here must be **human-made** (yours or your artist's),
never AI-generated.

## Identity: class + attribute + value

Every glyph is identified by three things, because each class draws the same value
differently. The resolver in `src/alphabet/defaults.ts` builds the path from this triple,
so files MUST be named to match.

## Location

```
app/public/glyphs/<class>/<Class>_<Attribute>_<Value>.svg
```

- `<class>` folder is lowercase: `wizard | sorcerer | warlock | druid`
- Served at runtime as `/glyphs/<class>/<file>` (Vite copies `public/` as-is — drop a
  file in and it works, no rebuild). Ships in the PWA and Tauri bundles.

## Filename: `<Class>_<Attribute>_<Value>.svg`

- `<Class>`: `Wizard | Sorcerer | Warlock | Druid` (title case)
- `<Attribute>`: `Level | School | Damage | Area | Range | Duration` (title case)
- `<Value>`: the feature value, slugged — drop `( )` and `' '`, slashes → `-`, spaces → `-`

### Examples

| class | attribute | value | filename |
|-------|-----------|-------|----------|
| Druid | Area | Cone (15) | `druid/Druid_Area_Cone-15.svg` |
| Sorcerer | Damage | Fire | `sorcerer/Sorcerer_Damage_Fire.svg` |
| Sorcerer | School | Evocation | `sorcerer/Sorcerer_School_Evocation.svg` |
| Sorcerer | Level | 3 | `sorcerer/Sorcerer_Level_3.svg` |
| Sorcerer | Range | 150 feet | `sorcerer/Sorcerer_Range_150-feet.svg` |
| Sorcerer | Duration | Up to 1 minute | `sorcerer/Sorcerer_Duration_Up-to-1-minute.svg` |
| Sorcerer | Damage | None | `sorcerer/Sorcerer_Damage_None.svg` |
| Sorcerer | Area | None | `sorcerer/Sorcerer_Area_None.svg` |

(Note `Damage_None` vs `Area_None` — including the attribute keeps them distinct.)

## File formats

Two ways to author a glyph — pick per file:

**Vector strokes (SVG, tintable).** Inherits the seal's ink colour and the hover hot/dim
states. Author as:
- `viewBox="0 0 100 100"` (same unit box as the in-app drawing pad)
- `<path>` elements only, with `fill="none"` and `stroke="currentColor"`
- `stroke-width` ~3–4, `stroke-linecap="round"`, `stroke-linejoin="round"`
- no hard-coded colours (so light/dark and per-attribute tint work)

```svg
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M 30 20 L 55 50 L 35 80" fill="none" stroke="currentColor"
        stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

**Finished artwork (`.png` / `.webp` with alpha, or a coloured `.svg`).** Shown exactly as
drawn — your own colours, baked in (no tint). This is the easy path for hand-made art:
draw it in any tool, export with a transparent background, drop it in. Keep it roughly
square; it's placed in the arc with `preserveAspectRatio` (centre, contain). Rendered via
`<image>` so it's sandboxed/safe.

Extensions are tried in this order: **`.png` → `.webp` → `.svg`** (see `DEFAULT_GLYPH_EXTS`
in `src/alphabet/defaults.ts`).

## Resolution order (how a glyph is chosen at render time)

1. **User glyph** — the player's own drawn/imported symbol (localStorage), if present
2. **Default** — the shipped file here, if present
3. **Procedural placeholder** — the decodable binary/ogham mark, so nothing is ever blank
