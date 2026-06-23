// Glyph / sigil colour modes, shared by all four sigil views and the spectrum lens.
//
//  - normal        each class's sigil uses its own per-class book ink (no rainbow).
//  - spectroscopy  each element uses its Arcane Spectroscopy colour (gist_rainbow index).
//  - custom        the user picks colours: one global colour plus optional per-attribute
//                  overrides. Per-attribute picks win; otherwise the global colour applies.
//
// In custom mode the same chosen colours drive BOTH the sigil elements and the "Seen"
// spectral lines, so a colour change is reflected everywhere live.

import { useCallback, useState } from 'react';
import { ATTRIBUTE_ORDER, type AttributeKey } from './attributes';

export type ColorMode = 'normal' | 'spectroscopy' | 'custom';

export type CustomColors = {
  all: string; // global colour, used for any attribute without its own pick
  perAttr: Partial<Record<AttributeKey, string>>; // per-attribute overrides
};

// A neutral ink as the default global custom colour (matches the parchment --ink).
export const DEFAULT_CUSTOM_COLORS: CustomColors = {
  all: '#2b2622',
  perAttr: {},
};

// The custom colour for one attribute: its own pick, else the global pick.
export function customColorFor(key: AttributeKey, custom: CustomColors): string {
  return custom.perAttr[key] ?? custom.all;
}

// Resolve the CSS colour for a single sigil element.
//  - normal       → the per-class ink the caller passes (e.g. 'var(--ink)').
//  - spectroscopy → the element's own pre-computed spectrum colour string.
//  - custom       → the user's per-attribute / global pick.
export function resolveAttrColor(
  key: AttributeKey,
  mode: ColorMode,
  custom: CustomColors,
  classInk: string,
  spectrumColor: string,
): string {
  switch (mode) {
    case 'spectroscopy':
      return spectrumColor;
    case 'custom':
      return customColorFor(key, custom);
    case 'normal':
    default:
      return classInk;
  }
}

// The six attributes the custom-mode UI exposes per-attribute pickers for.
export const CUSTOMIZABLE_ATTRS: AttributeKey[] = [...ATTRIBUTE_ORDER];

// --- persistence (mirrors alphabet/glyphStore.ts: STORAGE_KEY + try/catch) ---

const STORAGE_KEY = 'god-app:colorMode:v1';

type StoredColorState = { mode: ColorMode; custom: CustomColors };

const MODES: ColorMode[] = ['normal', 'spectroscopy', 'custom'];

function readColorState(): StoredColorState {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (raw && MODES.includes(raw.mode)) {
      return {
        mode: raw.mode,
        custom: {
          all: typeof raw.custom?.all === 'string' ? raw.custom.all : DEFAULT_CUSTOM_COLORS.all,
          perAttr: (raw.custom?.perAttr && typeof raw.custom.perAttr === 'object') ? raw.custom.perAttr : {},
        },
      };
    }
  } catch {
    // fall through to default
  }
  return { mode: 'normal', custom: { all: DEFAULT_CUSTOM_COLORS.all, perAttr: {} } };
}

function writeColorState(state: StoredColorState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Colour mode not persisted (storage unavailable):', e);
  }
}

// Stateful colour-mode model, persisted to localStorage.
export function useColorMode() {
  const [state, setState] = useState<StoredColorState>(readColorState);

  const setMode = useCallback((mode: ColorMode) => {
    setState((prev) => {
      const next = { ...prev, mode };
      writeColorState(next);
      return next;
    });
  }, []);

  const setAllColor = useCallback((all: string) => {
    setState((prev) => {
      const next = { ...prev, custom: { ...prev.custom, all } };
      writeColorState(next);
      return next;
    });
  }, []);

  const setAttrColor = useCallback((key: AttributeKey, color: string) => {
    setState((prev) => {
      const next = { ...prev, custom: { ...prev.custom, perAttr: { ...prev.custom.perAttr, [key]: color } } };
      writeColorState(next);
      return next;
    });
  }, []);

  return { mode: state.mode, custom: state.custom, setMode, setAllColor, setAttrColor };
}
