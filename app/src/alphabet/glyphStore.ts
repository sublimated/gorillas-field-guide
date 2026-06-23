// The user's own glyph alphabet — one hand-drawn symbol per attribute value.
// Stored locally (localStorage), exportable/importable as JSON. Render modes that need
// a designed symbol (Sorcerer seal, Warlock runes) look glyphs up here and fall back to
// a procedural placeholder for any value not yet drawn. No AI art, no copied art — these
// are the user's own marks. See the no-AI-art project rule.

import { useCallback, useState } from 'react';

// A glyph is EITHER vector strokes drawn in-app (tinted with the ink colour) OR a piece
// of imported artwork as a data URL — PNG/WebP with alpha, or an SVG file (shown as-is).
export type Glyph = {
  paths?: string[]; // vector strokes, drawn in a 0..100 unit box (inherit ink colour)
  src?: string; // imported artwork as a data URL (PNG/WebP/SVG); rendered as-is
  scale?: number; // display scale for the Warlock centre symbol (1 = default fit)
};

export const isImageGlyph = (g?: Glyph): g is Glyph & { src: string } => !!g?.src;
export const hasGlyph = (g?: Glyph): boolean => !!(g?.src || g?.paths?.length);

export type Alphabet = Record<string, Glyph>; // key = `${attribute}:${value}`

const STORAGE_KEY = 'god-app:alphabet:v1';

export const glyphKey = (attr: string, value: string) => `${attr}:${value}`;

export function getGlyph(alphabet: Alphabet, attr: string, value: string): Glyph | undefined {
  return alphabet[glyphKey(attr, value)];
}

function read(): Alphabet {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Alphabet;
  } catch {
    return {};
  }
}

function write(a: Alphabet) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
  } catch (e) {
    // Imported images are downscaled on import, but a large alphabet can still exceed the
    // ~5MB localStorage quota. (Production follow-up: move the store to IndexedDB.)
    console.warn('Alphabet not persisted (storage full or unavailable):', e);
  }
}

export function useAlphabet() {
  const [alphabet, setAlphabet] = useState<Alphabet>(read);

  const setGlyph = useCallback((attr: string, value: string, glyph: Glyph) => {
    setAlphabet((prev) => {
      const next = { ...prev, [glyphKey(attr, value)]: glyph };
      write(next);
      return next;
    });
  }, []);

  const removeGlyph = useCallback((attr: string, value: string) => {
    setAlphabet((prev) => {
      const next = { ...prev };
      delete next[glyphKey(attr, value)];
      write(next);
      return next;
    });
  }, []);

  const replaceAll = useCallback((a: Alphabet) => {
    write(a);
    setAlphabet(a);
  }, []);

  return { alphabet, setGlyph, removeGlyph, replaceAll };
}
