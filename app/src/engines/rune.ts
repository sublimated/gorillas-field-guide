// Rune engine — the WIZARD render mode, per "The Theory of Magic".
// Vertices sit on a circle. Each attribute is a layer: read its cyclically-unique
// binary; for every "on" bit i, draw a straight chord from vertex i to vertex i+k.
// The meaning (which vertices connect) comes from the shared topology layer; this
// module is purely the chord/polygon presentation of it.

import type { AttributeKey, SpellAttributes } from './attributes';
import { wizardTopology } from './wizardTopology';

export { WIZARD_RUNE_N as RUNE_N } from './wizardTopology';

export type Point = { x: number; y: number };

export type RuneChord = {
  key: AttributeKey;
  from: number; // vertex index
  to: number; // vertex index
  a: Point;
  b: Point;
  color: string; // tied to the attribute's spectrum colour
  length: number; // px, for draw-on animation timing
};

export type Rune = {
  n: number;
  radius: number;
  center: Point;
  vertices: Point[];
  chords: RuneChord[];
  concentration: boolean;
  ritual: boolean;
};

function vertexPoints(n: number, radius: number, center: Point): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    // start at top, go clockwise
    const theta = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    pts.push({
      x: center.x + radius * Math.cos(theta),
      y: center.y + radius * Math.sin(theta),
    });
  }
  return pts;
}

export function buildRune(
  attrs: SpellAttributes,
  opts: { size?: number; padding?: number } = {}
): Rune {
  const size = opts.size ?? 400;
  const padding = opts.padding ?? 28;
  const center = { x: size / 2, y: size / 2 };
  const radius = size / 2 - padding;
  const { n, layers } = wizardTopology(attrs);
  const vertices = vertexPoints(n, radius, center);

  const chords: RuneChord[] = [];
  for (const layer of layers) {
    const { key, k, bits, color } = layer;
    for (let i = 0; i < n; i++) {
      if (bits[i] === 1) {
        const a = vertices[i];
        const b = vertices[(i + k) % n];
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        chords.push({ key, from: i, to: (i + k) % n, a, b, color, length });
      }
    }
  }

  return {
    n,
    radius,
    center,
    vertices,
    chords,
    concentration: attrs.concentration,
    ritual: attrs.ritual,
  };
}
