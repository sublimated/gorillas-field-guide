import { useEffect, useId, useMemo, useState } from 'react';
import { buildWarlockSigil, type WarlockCodePart } from '../engines/warlock';
import type { AttributeKey, SpellAttributes } from '../engines/attributes';
import { colorFor, rgbCss } from '../engines/spectrum';
import { resolveAttrColor, type ColorMode, type CustomColors, DEFAULT_CUSTOM_COLORS } from '../engines/colorModes';
import type { Glyph } from '../alphabet/glyphStore';

type Props = {
  attrs: SpellAttributes;
  castingTime?: string;
  size?: number;
  mode?: ColorMode;
  custom?: CustomColors;
  replayKey?: number;
  highlight?: string | null;
  onHighlight?: (key: string | null) => void;
  centerGlyph?: Glyph;
  onRequestCenterChange?: () => void; // App owns the file picker + size control
};

// Warlock's per-class book ink (used in Normal mode).
const WARLOCK_INK = '#5b0b20';

export function WarlockView({
  attrs,
  castingTime,
  size = 420,
  mode = 'normal',
  custom = DEFAULT_CUSTOM_COLORS,
  replayKey = 0,
  highlight = null,
  onHighlight,
  centerGlyph,
  onRequestCenterChange,
}: Props) {
  const id = useId().replace(/:/g, '');
  const sigil = useMemo(() => buildWarlockSigil(attrs, { size, castingTime }), [attrs, size, castingTime]);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    // Intentional: re-trigger the draw-on CSS transition (toggle off, then on next frame)
    // whenever the spell/recast key changes — not deriving state from props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrawn(false);
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(t);
  }, [replayKey, attrs]);

  const { center, rOuter, rInner, rText, rFrameInner, rFrameOuter } = sigil;
  // The spectroscopy colour of an attribute (same derivation as engines/spectrum.ts).
  const spectrumColorFor = (key: AttributeKey): string => {
    const value = key === 'level' ? String(attrs.level) : attrs[key];
    return rgbCss(colorFor(key, value));
  };
  // Per-segment ink so spectroscopy / custom modes can colour each attribute distinctly.
  const inkFor = (key: AttributeKey) =>
    resolveAttrColor(key, mode, custom, WARLOCK_INK, spectrumColorFor(key));
  const centerSrc = centerGlyph?.src ?? '/glyphs/warlock/Warlock_Center_Default.png';
  const centerScale = centerGlyph?.scale ?? 1;
  const defaultCenterScale = centerGlyph ? 1 : 0.65;
  const pt = (angle: number, r: number) => ({ x: center.x + r * Math.cos(angle), y: center.y + r * Math.sin(angle) });
  const wedgePath = (seg: { a0: number; a1: number }) => {
    const o0 = pt(seg.a0, rOuter), o1 = pt(seg.a1, rOuter);
    const i1 = pt(seg.a1, rInner), i0 = pt(seg.a0, rInner);
    return `M${o0.x} ${o0.y} A${rOuter} ${rOuter} 0 0 1 ${o1.x} ${o1.y} L${i1.x} ${i1.y} A${rInner} ${rInner} 0 0 0 ${i0.x} ${i0.y} Z`;
  };
  // Each magnitude is its OWN glyph (compendium p37): n3, n30, n300, n3000 are four distinct
  // orientations of the digit-3 shape. So every value maps directly to its exact-value glyph.
  const numberHref = (value: number) => `/glyphs/warlock/n${value}.png?v=4`;
  // Book convention (p38 base pattern): runes read radially with their tops pointing OUTWARD
  // toward the rim — there is no readability flip, so the lower segments read "upside down" by
  // design. This keeps the uniform radial flow of the seal instead of forcing each word upright.
  const groupRotation = (angle: number) => (angle * 180) / Math.PI + 90;

  const renderCastingFrame = () => {
    // Book casting-time frames (p33-34) are clean circle decorations, not a scratchy effect.
    const scratch = [
      <circle key="f-out" cx={center.x} cy={center.y} r={rFrameOuter} className="warlock-frame" />,
      <circle key="f-in" cx={center.x} cy={center.y} r={rFrameInner} className="warlock-frame" />,
    ];
    if (sigil.castingFrame === 'reaction') {
      const ticks = Array.from({ length: 44 }, (_, i) => {
        const a = (i / 44) * Math.PI * 2;
        const p0 = pt(a, rFrameInner);
        const p1 = pt(a + 0.08, rFrameOuter);
        return <line key={i} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} className="warlock-frame-detail" />;
      });
      return <g>{scratch}{ticks}</g>;
    }
    if (sigil.castingFrame === 'bonus-action') {
      return <g>{scratch}<circle cx={center.x} cy={center.y} r={rFrameOuter} className="warlock-frame-dashed" /></g>;
    }
    if (sigil.castingFrame === '1-minute') return <g>{scratch}</g>;
    if (sigil.castingFrame === '10-minute') return <g>{scratch}<circle cx={center.x} cy={center.y} r={rFrameOuter + 8} className="warlock-frame-scratch faint" /></g>;
    if (sigil.castingFrame === '1-hour') {
      const s = rFrameOuter * 1.42;
      return <g>{scratch}<rect x={center.x - s / 2} y={center.y - s / 2} width={s} height={s} className="warlock-frame-square" /></g>;
    }
    if (sigil.castingFrame === '8-hours' || sigil.castingFrame === '12-hours' || sigil.castingFrame === '24-hours') {
      const rayCount = sigil.castingFrame === '24-hours' ? 16 : sigil.castingFrame === '12-hours' ? 12 : 8;
      const rays = Array.from({ length: rayCount }, (_, i) => {
        const a = (i / rayCount) * Math.PI * 2 + Math.PI / rayCount;
        const p0 = pt(a, rFrameOuter - 1);
        const p1 = pt(a, rFrameOuter + (sigil.castingFrame === '24-hours' ? 28 : 22));
        return <line key={i} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} className="warlock-frame-detail faint" />;
      });
      return <g>{scratch}{rays}</g>;
    }
    return (
      <g>
        <circle cx={center.x} cy={center.y} r={rFrameOuter} className="warlock-frame" />
        <circle cx={center.x} cy={center.y} r={rFrameInner} className="warlock-frame" />
      </g>
    );
  };

  // Group the parsed code per the book's number rules (p31): a multiplier dₙ and the
  // n-runes after it form ONE composite glyph — the digit-runes superimposed (= summed),
  // wrapped in a circle of n dots. Durations have n-runes with no multiplier (just summed).
  type Group =
    | { kind: 'aspect'; text: string }
    | { kind: 'num'; multiplier?: number; digits: number[] };
  type Item =
    | { kind: 'rune'; ch: string }
    | { kind: 'num'; multiplier?: number; digits: number[] };

  const itemsFor = (parts: WarlockCodePart[]): Item[] => {
    const groups: Group[] = [];
    for (const part of parts) {
      if (part.kind === 'aspect') {
        groups.push({ kind: 'aspect', text: part.text });
      } else if (part.kind === 'multiplier') {
        groups.push({ kind: 'num', multiplier: part.value, digits: [] });
      } else {
        const last = groups[groups.length - 1];
        if (last && last.kind === 'num') last.digits.push(part.value);
        else groups.push({ kind: 'num', digits: [part.value] });
      }
    }

    // Book layout: in numbered segments the number sits immediately BEFORE the last aspect rune
    // (range `aF` → a·num·F, middle; duration `HaD` → H·a·num·D, third glyph). Split the leading
    // aspect into "all but its last rune" + number group(s) + "its last rune".
    const hasNumber = groups.some((g) => g.kind === 'num');
    if (hasNumber && groups[0]?.kind === 'aspect' && groups[0].text.length > 1) {
      const lead = groups[0].text;
      const middle = groups.slice(1); // the number group(s)
      groups.length = 0;
      groups.push({ kind: 'aspect', text: lead.slice(0, -1) }, ...middle, { kind: 'aspect', text: lead.slice(-1) });
    }

    // Expand groups into individual items laid out along the arc: each aspect rune is its own
    // item; a number group (circle + superimposed digits) is one item.
    const items: Item[] = [];
    for (const g of groups) {
      if (g.kind === 'aspect') for (const ch of g.text) items.push({ kind: 'rune', ch });
      else items.push({ kind: 'num', multiplier: g.multiplier, digits: g.digits });
    }
    return items;
  };

  // Lay items out along the arc with an EQUAL gap between every glyph, the whole group
  // centred on the segment midline. This way the spacing on both sides of a number reads the
  // same regardless of how wide the number is versus the runes flanking it.
  const RUNE_W = 23; // approx tangential width of a rune at the current font size
  const GAP = 6; // arc-length gap between adjacent glyphs
  const anglesFor = (items: Item[], mid: number, radius: number): number[] => {
    const widthOf = (it: Item) => (it.kind === 'rune' ? RUNE_W : it.multiplier != null ? 52 : 26);
    const widths = items.map(widthOf);
    const totalSpan = widths.reduce((s, w) => s + w, 0) + GAP * Math.max(0, items.length - 1);
    let cursor = -totalSpan / 2; // arc-length offset from the segment midline
    return items.map((_, idx) => {
      const center = cursor + widths[idx] / 2;
      cursor += widths[idx] + GAP;
      return mid + center / radius; // arc-length → angle
    });
  };

  // Renders one row of items (the primary code, or — for damage with a second type — the
  // smaller minor-type row nested closer to the inner ring). `scale` shrinks runes/numbers
  // uniformly without changing the underlying CSS font-size.
  const renderItems = (items: Item[], angles: number[], radius: number, ink: string, scale: number, keyPrefix: string) =>
    items.map((it, idx) => {
      const ang = angles[idx];
      const p = pt(ang, radius);
      if (it.kind === 'rune') {
        // aspect runes follow the curve — tangent to the circle, tops pointing outward
        return (
          <text
            key={`${keyPrefix}${idx}`}
            x={0}
            y={0}
            transform={`translate(${p.x} ${p.y}) rotate(${groupRotation(ang)}) scale(${scale})`}
            className="warlock-text"
            fill={ink}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {it.ch}
          </text>
        );
      }
      // Numbers rotate WITH the segment, same as the runes beside them — their magnitude is
      // read relative to the box's orientation, so they must share it (not stand upright).
      const hasMult = it.multiplier != null;
      const R = 22; // multiplier circle radius — kept inside the rune band
      const nw = hasMult ? 16 : 23; // the inner sigil is small; the circle stays full-size
      const nh = hasMult ? 19 : 28;
      return (
        <g
          key={`${keyPrefix}${idx}`}
          transform={`translate(${p.x} ${p.y}) rotate(${groupRotation(ang) + 180}) scale(${scale})`}
          className={hasMult ? 'warlock-multiplier' : undefined}
        >
          {hasMult && <circle cx="0" cy="0" r={R} />}
          {it.digits.map((d, di) => (
            <image key={di} href={numberHref(d)} x={-nw / 2} y={-nh / 2} width={nw} height={nh} preserveAspectRatio="xMidYMid meet" className="warlock-number" />
          ))}
          {hasMult &&
            Array.from({ length: it.multiplier as number }, (_, dot) => {
              // dots sit ON the circle, stepping 72° clockwise (d5 = full pentagon). The
              // pattern is rotated 180° from the top so it reads right within the glyph.
              const a = Math.PI / 2 + dot * ((2 * Math.PI) / 5);
              return <circle key={dot} cx={Math.cos(a) * R} cy={Math.sin(a) * R} r="3.2" className="warlock-multiplier-dot" />;
            })}
        </g>
      );
    });

  const renderSegmentCode = (seg: (typeof sigil.segments)[number], i: number) => {
    const state = highlight ? (seg.key === highlight ? ' hot' : ' dim') : '';
    const ink = inkFor(seg.key);
    const items = itemsFor(seg.parts);
    const angles = anglesFor(items, seg.mid, rText);
    // A spell dealing two damage types at once (e.g. Ice Storm's Cold + Bludgeoning) shows
    // its lower-potential type's own code as a second, smaller row nested closer to the
    // inner ring. The runes must never touch the primary row, so this sits well inside it
    // (close to rInner) and at a noticeably smaller scale — unlike the Sorcerer seal, a
    // little crossover here is not acceptable.
    const minorItems = seg.minorParts ? itemsFor(seg.minorParts) : null;
    const rTextMinor = rInner + (rText - rInner) * 0.22;
    const minorAngles = minorItems ? anglesFor(minorItems, seg.mid, rTextMinor) : null;

    return (
      <g
        key={seg.key}
        className={`warlock-code${state}`}
        style={{
          opacity: drawn ? undefined : 0,
          transitionDelay: `${i * 130}ms`,
        }}
      >
        {renderItems(items, angles, rText, ink, 1, 'maj')}
        {minorItems && minorAngles && renderItems(minorItems, minorAngles, rTextMinor, ink, 0.5, 'min')}
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="warlock-svg" role="img" aria-label="Warlock spell sigil">
      <defs>
        <filter id={`${id}-warlock-glow`} x="-30%" y="-30%" width="160%" height="160%">
          {/* small, soft glow on every rune — kept low so it doesn't thicken the solid number runes */}
          <feGaussianBlur stdDeviation="0.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${id}-warlock-number-ink`} colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.357 0 0 0 0 0.043 0 0 0 0 0.125 0 0 0 1 0"
          />
        </filter>
        <clipPath id={`${id}-center-clip`}>
          <circle cx={center.x} cy={center.y} r={rInner} />
        </clipPath>
      </defs>

      {renderCastingFrame()}
      <circle cx={center.x} cy={center.y} r={rOuter} className="warlock-ring" />
      <circle cx={center.x} cy={center.y} r={rInner} className="warlock-ring" />

      {sigil.segments.map((seg) => {
        // dividers span only the rune band — stop at the inner edge of the outer ring, don't cross it
        const pOuter = pt(seg.a0, rFrameInner);
        const pInner = pt(seg.a0, rInner);
        return <line key={`d-${seg.key}`} x1={pInner.x} y1={pInner.y} x2={pOuter.x} y2={pOuter.y} className="warlock-divider" />;
      })}

      <g filter={`url(#${id}-warlock-glow)`}>
        <g filter={`url(#${id}-warlock-number-ink)`}>
          {sigil.segments.map(renderSegmentCode)}
        </g>
      </g>

      {/* patron centre: double-click to change the image (App owns the picker + size
          control); clipped to the inner ring so it can never spill into the rune band */}
      <g clipPath={`url(#${id}-center-clip)`}>
        {(() => {
          const s = rInner * 1.7 * centerScale * defaultCenterScale;
          return (
            <image
              href={centerSrc}
              onDoubleClick={onRequestCenterChange}
              style={{ cursor: 'pointer' }}
              x={center.x - s / 2}
              y={center.y - s / 2}
              width={s}
              height={s}
              preserveAspectRatio="xMidYMid meet"
              className="warlock-center"
            />
          );
        })()}
      </g>

      {/* Four broken arcs are the concentration mark on compendium page 35. */}
      {sigil.concentration && (
        <g className="warlock-concentration">
          {[0, 1, 2, 3].map((index) => {
            const start = index * Math.PI / 2 + 0.22;
            const end = start + 1.0;
            const a = pt(start, rInner * 0.76);
            const b = pt(end, rInner * 0.76);
            return <path key={index} d={`M ${a.x} ${a.y} A ${rInner * 0.76} ${rInner * 0.76} 0 0 1 ${b.x} ${b.y}`} />;
          })}
        </g>
      )}
      {/* Ritual is six short radial marks inside the main rune circle (p35). */}
      {sigil.ritual && (
        <g className="warlock-ritual">
          {Array.from({ length: 6 }, (_, index) => {
            const angle = (index * Math.PI) / 3;
            const a = pt(angle, rInner * 0.66);
            const b = pt(angle, rInner * 0.82);
            return <line key={index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
          })}
        </g>
      )}

      {sigil.segments.map((seg) => (
        <path
          key={`w-${seg.key}`}
          d={wedgePath(seg)}
          className="warlock-hit"
          onMouseEnter={() => onHighlight?.(seg.key)}
          onMouseLeave={() => onHighlight?.(null)}
        />
      ))}
    </svg>
  );
}
