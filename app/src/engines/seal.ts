// Sorcerer render mode — the segmented ring, per the Sorcerer Compendium "Breakdown".
// "The base of the system is a circle split into six arcs of equal length. Going
// clockwise these arcs represent Level, School, Damage Type, Area Type, Range, and
// Duration… Each arc is separated with a vertical line except [the start] boundary,
// which is marked with two to allow the reader to know the beginning of the spell."
//
// Same meaning as the Wizard chords (shared topology); the value in each arc is written
// as a compact binary "numeral" — radial ticks across the sector, on=1 / off=0.

import type { AttributeKey, SpellAttributes } from './attributes';
import { spellTopology } from './topology';
import type { Point } from './rune';

const BIT_WIDTH = 5; // every arc reads as a 5-tick numeral (covers all feature sets)

export type SealTick = { angle: number; on: boolean };

export type SealSegment = {
  key: AttributeKey;
  value: string;
  color: string;
  a0: number; // sector start angle (rad)
  a1: number; // sector end angle (rad)
  mid: number; // sector mid angle (rad)
  ticks: SealTick[];
};

export type Seal = {
  center: Point;
  rOuter: number;
  rInner: number;
  segments: SealSegment[];
  dividers: number[]; // boundary angles between sectors
  startAngle: number; // the double-divider marking the beginning (top)
  concentration: boolean;
  ritual: boolean;
};

function indexBits(index: number, width = BIT_WIDTH): number[] {
  const bits: number[] = [];
  for (let b = width - 1; b >= 0; b--) bits.push((index >> b) & 1);
  return bits; // MSB first → read clockwise across the arc
}

export function buildSorcererSeal(
  attrs: SpellAttributes,
  opts: { size?: number; padding?: number } = {},
): Seal {
  const size = opts.size ?? 400;
  const padding = opts.padding ?? 28;
  const center = { x: size / 2, y: size / 2 };
  const rOuter = size / 2 - padding;
  const rInner = rOuter * 0.62; // the ring band that holds the numerals

  const { layers } = spellTopology(attrs); // 6 layers, ATTRIBUTE_ORDER = Level,School,Damage,Area,Range,Duration
  const count = layers.length;
  const span = (2 * Math.PI) / count;
  const start = -Math.PI / 2; // first sector (Level) starts at the top, reads clockwise

  const segments: SealSegment[] = layers.map((layer, s) => {
    const a0 = start + s * span;
    const a1 = a0 + span;
    const bits = indexBits(layer.index);
    const pad = span * 0.16; // keep numerals off the divider lines
    const ticks: SealTick[] = bits.map((on, t) => {
      const f = bits.length > 1 ? t / (bits.length - 1) : 0.5;
      return { angle: a0 + pad + f * (span - 2 * pad), on: on === 1 };
    });
    return { key: layer.key, value: layer.value, color: layer.color, a0, a1, mid: (a0 + a1) / 2, ticks };
  });

  return {
    center,
    rOuter,
    rInner,
    segments,
    dividers: segments.map((seg) => seg.a0),
    startAngle: start, // double line here marks where reading begins
    concentration: attrs.concentration,
    ritual: attrs.ritual,
  };
}
