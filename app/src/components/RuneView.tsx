import { useEffect, useMemo, useState } from 'react';
import { buildRune } from '../engines/rune';
import { WIZARD_K_VALUES, WIZARD_ATTRIBUTE_ORDER } from '../engines/wizardTopology';
import type { SpellAttributes } from '../engines/attributes';
import { resolveAttrColor, type ColorMode, type CustomColors, DEFAULT_CUSTOM_COLORS } from '../engines/colorModes';

// Concrete value of --ink so SVG feFlood (which doesn't resolve CSS var()) gets a real colour.
const WIZARD_INK = '#2c2013';

// Hand-drawn stroke art used for every meaningful chord.
const CHORD_ART = '/textures/boxes/line.svg';
const CHORD_ART_W = 1182.41; // art viewBox width
const CHORD_ART_H = 18.21; // art viewBox height

// Place the horizontal hand-drawn stroke along the chord A->B: translate to A,
// rotate to the chord angle, scale X to the chord length and Y to a stroke
// thickness, then lift by half-height so the art is centred on the chord line.
function chordArtTransform(a: { x: number; y: number }, b: { x: number; y: number }, thickness: number): string {
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const sx = length / CHORD_ART_W;
  const sy = thickness / CHORD_ART_H;
  return `translate(${a.x} ${a.y}) rotate(${angle}) scale(${sx} ${sy}) translate(0 ${-CHORD_ART_H / 2})`;
}

type Props = {
  attrs: SpellAttributes;
  size?: number;
  mode?: ColorMode; // how to colour the sigil
  custom?: CustomColors; // chosen colours when mode === 'custom'
  replayKey?: number; // change to replay the draw-on animation
  highlight?: string | null; // attribute key to spotlight (others dim)
  onHighlight?: (key: string | null) => void;
};

const ATTRIBUTE_WEIGHT: Record<string, number> = {
  level: 3.4,
  school: 3.05,
  damage: 2.8,
  area: 2.55,
  range: 2.35,
  duration: 2.15,
};

const ATTRIBUTE_OPACITY: Record<string, number> = {
  level: 0.98,
  school: 0.94,
  damage: 0.92,
  area: 0.88,
  range: 0.84,
  duration: 0.8,
};

export function RuneView({
  attrs,
  size = 420,
  mode = 'normal',
  custom = DEFAULT_CUSTOM_COLORS,
  replayKey = 0,
  highlight = null,
  onHighlight,
}: Props) {
  const rune = useMemo(() => buildRune(attrs, { size }), [attrs, size]);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    setDrawn(false);
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(t);
  }, [replayKey, attrs]);

  // faint decorative mesh: every chord for every k, very low opacity
  const mesh = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const key of WIZARD_ATTRIBUTE_ORDER.slice(0, 4)) {
      const k = WIZARD_K_VALUES[key];
      for (let i = 0; i < rune.n; i += 2) {
        const a = rune.vertices[i];
        const b = rune.vertices[(i + k) % rune.n];
        lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }
    }
    return lines;
  }, [rune]);

  const STAGGER = 90; // ms between chords

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="rune-svg"
      role="img"
      aria-label="Spell rune"
    >
      <defs>
        <filter id="rune-roughen" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="11" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.75" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="rune-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.7" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx={rune.center.x} cy={rune.center.y} r={rune.radius - 8} className="rune-field" />

      <line
        x1={rune.center.x}
        y1={rune.center.y - rune.radius - 10}
        x2={rune.center.x}
        y2={rune.center.y + rune.radius + 10}
        className="rune-axis"
      />

      {/* decorative mesh */}
      <g className="rune-mesh" filter="url(#rune-roughen)">
        {mesh.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
        ))}
      </g>

      {/* guide rings */}
      <g filter="url(#rune-roughen)">
        <circle cx={rune.center.x} cy={rune.center.y} r={rune.radius + 10} className="rune-ring outer" />
        <circle cx={rune.center.x} cy={rune.center.y} r={rune.radius - 4} className="rune-ring mid" />
        <circle cx={rune.center.x} cy={rune.center.y} r={rune.radius * 0.42} className="rune-ring inner" />
      </g>

      {/* per-chord ink filters: flood the resolved colour through the art's alpha,
          so the single-ink hand-drawn stroke is recoloured per colour-mode. */}
      <defs>
        {rune.chords.map((c, i) => {
          const color = resolveAttrColor(c.key, mode, custom, WIZARD_INK, c.color);
          return (
            <filter key={`ink-${i}`} id={`rune-ink-${i}`} x="0%" y="0%" width="100%" height="100%">
              <feFlood floodColor={color} result="flood" />
              <feComposite in="flood" in2="SourceGraphic" operator="in" />
            </filter>
          );
        })}
      </defs>

      {/* meaningful chords (draw-on): hand-drawn stroke art placed along each chord */}
      <g filter="url(#rune-glow)">
        {rune.chords.map((c, i) => {
          const state = highlight ? (c.key === highlight ? ' hot' : ' dim') : '';
          const thickness = ATTRIBUTE_WEIGHT[c.key] ?? 2.4;
          return (
            <image
              key={`${c.key}-${c.from}-${c.to}-${i}`}
              href={CHORD_ART}
              x={0}
              y={0}
              width={CHORD_ART_W}
              height={CHORD_ART_H}
              preserveAspectRatio="none"
              transform={chordArtTransform(c.a, c.b, thickness)}
              filter={`url(#rune-ink-${i})`}
              className={`rune-chord${state}`}
              style={{
                transitionDelay: `${i * STAGGER}ms`,
                ['--draw' as any]: drawn ? 1 : 0,
                ['--rune-opacity' as any]: ATTRIBUTE_OPACITY[c.key] ?? 0.88,
              }}
              data-attr={c.key}
              onMouseEnter={() => onHighlight?.(c.key)}
              onMouseLeave={() => onHighlight?.(null)}
            />
          );
        })}
      </g>

      {/* vertices */}
      <g className="rune-verts" filter="url(#rune-roughen)">
        {rune.vertices.map((p, i) => (
          <circle key={`halo-${i}`} cx={p.x} cy={p.y} r={i === 0 ? 8 : 5.3} className={i === 0 ? 'vert-halo start' : 'vert-halo'} />
        ))}
        {rune.vertices.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 4.4 : 2.7} className={i === 0 ? 'vert start' : 'vert'} />
        ))}
      </g>

      {/* concentration / ritual markers */}
      {rune.ritual && <circle cx={rune.center.x} cy={rune.center.y} r={12} className="rune-ritual-ring" filter="url(#rune-roughen)" />}
    </svg>
  );
}
