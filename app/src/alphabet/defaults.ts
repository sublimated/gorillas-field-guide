// Default (shipped) glyphs live in app/public/glyphs and are addressed by the
// class + attribute + value triple. See app/public/glyphs/README.md for the convention.
//   path:  /glyphs/<class>/<Class>_<Attribute>_<Value>.(png|webp|svg)
// e.g.    /glyphs/druid/Druid_Area_Cone-15.png
// Defaults are human-made art (never AI). Resolution at render time is:
//   user glyph  →  default file  →  procedural placeholder.

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
