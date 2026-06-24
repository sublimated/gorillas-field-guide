// Default (shipped) glyphs live in app/public/glyphs and are addressed by the
// class + attribute + value triple. See app/public/glyphs/README.md for the convention.
//   path:  /glyphs/<class>/<Class>_<Attribute>_<Value>.(png|webp|svg)
// e.g.    /glyphs/druid/Druid_Area_Cone-15.png
// Defaults are human-made art (never AI). Resolution at render time is:
//   user glyph  →  default file  →  procedural placeholder.

import { decomposeNumber, glyphAreaNotation, parseNumberedGlyphValue, titleAreaNotation } from './numerals';
import type { AttributeKey } from '../engines/attributes';

export type ClassName = 'wizard' | 'sorcerer' | 'warlock' | 'druid';

const CLASS_CAP: Record<ClassName, string> = {
  wizard: 'Wizard', sorcerer: 'Sorcerer', warlock: 'Warlock', druid: 'Druid',
};
const ATTR_CAP: Record<AttributeKey, string> = {
  level: 'Level', school: 'School', damage: 'Damage', area: 'Area', range: 'Range', duration: 'Duration',
};

// Formats we accept for default files, in priority order (raster-with-alpha first, vector last).
export const DEFAULT_GLYPH_EXTS = ['png', 'webp', 'svg'] as const;

// "Cone (15)" → "Cone-15", "150 feet" → "150-feet", "Up to 1 minute" → "Up-to-1-minute".
export function valueSlug(value: string): string {
  return value
    .trim()
    .replace(/['"]/g, '')
    .replace(/[()]/g, '')
    .replace(/[\\/]/g, '-')
    .replace(/\s+/g, '-');
}

// Filename without extension, e.g. "Druid_Area_Cone-15".
export function defaultGlyphName(cls: ClassName, attr: AttributeKey, value: string): string {
  return `${CLASS_CAP[cls]}_${ATTR_CAP[attr]}_${valueSlug(value)}`;
}

// Candidate URLs to try, in priority order.
export function defaultGlyphUrls(cls: ClassName, attr: AttributeKey, value: string): string[] {
  const base = `/glyphs/${cls}/${defaultGlyphName(cls, attr, value)}`;
  return DEFAULT_GLYPH_EXTS.map((ext) => `${base}.${ext}`);
}

// Resolve a shipped default glyph at runtime. SVG files are inlined (so they inherit the
// seal's ink colour); raster files come back as an <image> URL. Cached per identity; a
// miss (no file) resolves to null and the caller falls back to the procedural placeholder.
export type ResolvedDefault = { kind: 'svg'; inner: string } | { kind: 'image'; url: string };

const cache = new Map<string, Promise<ResolvedDefault | null>>();

function innerSvg(markup: string): string {
  const m = markup.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  return m ? m[1] : '';
}

export function loadDefaultGlyph(
  cls: ClassName,
  attr: AttributeKey,
  value: string,
): Promise<ResolvedDefault | null> {
  const key = `d:${cls}:${attr}:${value}`;
  if (!cache.has(key)) cache.set(key, resolveUrls(defaultGlyphUrls(cls, attr, value)));
  return cache.get(key)!;
}

function mergeResolvedDefaults(parts: ResolvedDefault[]): ResolvedDefault | null {
  if (parts.length === 0) return null;
  const inners = parts.map((part) => {
    if (part.kind === 'svg') return part.inner;
    return `<image href="${part.url}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid meet" />`;
  });
  return { kind: 'svg', inner: inners.join('') };
}

function areaGlyphShapeAlias(shape: string): string {
  if (shape === 'Emanation' || shape === 'Circle') return 'Sphere';
  if (shape === 'Square') return 'Cube';
  if (shape === 'Wall') return 'None';
  return shape;
}

function sorcererAreaBaseUrls(shape: string): string[] {
  if (shape === 'None') return defaultGlyphUrls('sorcerer', 'area', 'None');
  const stems = [
    `/glyphs/sorcerer/Sorcerer_Area_${shape}-Base`,
    `/glyphs/sorcerer/Sorcerer_Area_${shape}-base`,
  ];
  return stems.flatMap((stem) => DEFAULT_GLYPH_EXTS.map((ext) => `${stem}.${ext}`));
}

function loadSorcererAreaBaseGlyph(shape: string): Promise<ResolvedDefault | null> {
  const key = `base:sorcerer:area:${shape}`;
  if (!cache.has(key)) cache.set(key, resolveUrls(sorcererAreaBaseUrls(shape)));
  return cache.get(key)!;
}

export async function loadSorcererAreaGlyph(value: string): Promise<ResolvedDefault | null> {
  const exact = await loadDefaultGlyph('sorcerer', 'area', glyphAreaNotation(value));
  if (exact) return exact;

  const parsed = parseNumberedGlyphValue('area', titleAreaNotation(value));
  if (!parsed || parsed.kind !== 'area') return null;

  const atoms = decomposeNumber(parsed.number);
  const aliasedShape = areaGlyphShapeAlias(parsed.shape);
  if (aliasedShape === 'None') {
    return loadDefaultGlyph('sorcerer', 'area', 'None');
  }
  if (atoms.length === 0) {
    return loadSorcererAreaBaseGlyph(aliasedShape);
  }

  const parts = await Promise.all(
    atoms.map((atom) => loadDefaultGlyph('sorcerer', 'area', `${aliasedShape} (${atom})`)),
  );
  const resolved = parts.filter((part): part is ResolvedDefault => part !== null);
  if (resolved.length === parts.length && resolved.length > 0) return mergeResolvedDefaults(resolved);
  return loadSorcererAreaBaseGlyph(aliasedShape);
}

// Load a glyph by explicit filename stem, e.g. the seal centre `Sorcerer_Center`.
export function loadGlyphByName(cls: ClassName, name: string): Promise<ResolvedDefault | null> {
  const key = `n:${cls}:${name}`;
  if (!cache.has(key)) {
    cache.set(key, resolveUrls(DEFAULT_GLYPH_EXTS.map((ext) => `/glyphs/${cls}/${name}.${ext}`)));
  }
  return cache.get(key)!;
}

async function resolveUrls(urls: string[]): Promise<ResolvedDefault | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') ?? '';
      if (url.endsWith('.svg')) {
        // guard against dev-server SPA fallback (returns index.html as 200)
        if (/html/i.test(ct)) continue;
        const inner = innerSvg(await res.text());
        if (inner.trim()) return { kind: 'svg', inner } as const;
      } else {
        // a real raster only — a 200 that isn't image/* is the SPA fallback
        if (/^image\//i.test(ct)) return { kind: 'image', url } as const;
      }
    } catch {
      /* network/parse error — try the next candidate */
    }
  }
  return null;
}
