import { useEffect, useId, useMemo, useState } from 'react';
import { buildSorcererSeal } from '../engines/seal';
import type { SpellAttributes } from '../engines/attributes';
import { getGlyph, glyphKey, hasGlyph, isImageGlyph, type Alphabet, type Glyph } from '../alphabet/glyphStore';
import { titleAreaNotation } from '../alphabet/numerals';
import { loadDefaultGlyph, loadGlyphByName, type ResolvedDefault } from '../alphabet/defaults';
import { resolveAttrColor, type ColorMode, type CustomColors, DEFAULT_CUSTOM_COLORS } from '../engines/colorModes';

type Props = {
  attrs: SpellAttributes;
  size?: number;
  mode?: ColorMode;
  custom?: CustomColors;
  replayKey?: number;
  highlight?: string | null;
  onHighlight?: (key: string | null) => void;
  alphabet?: Alphabet; // the user's own glyphs; shipped default art fills any gaps
  areaNotation?: string; // full Area slot notation, e.g. "Sphere (20)"
  centerGlyph?: Glyph;
  onRequestCenterChange?: () => void;
};

const SORCERER_INK = 'var(--sorcerer-ink)';

export function SealView({
  attrs,
  size = 420,
  mode = 'normal',
  custom = DEFAULT_CUSTOM_COLORS,
  replayKey = 0,
  highlight = null,
  onHighlight,
  alphabet = {},
  areaNotation,
  centerGlyph,
  onRequestCenterChange,
}: Props) {
  const gradientId = useId().replace(/:/g, '');
  const seal = useMemo(() => buildSorcererSeal(attrs, { size }), [attrs, size]);
  const [drawn, setDrawn] = useState(false);

  const segmentValue = (key: string, value: string) => {
    if (key === 'area' && areaNotation) return areaNotation === 'None' ? 'None' : titleAreaNotation(areaNotation);
    return value;
  };

  useEffect(() => {
    setDrawn(false);
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(t);
  }, [replayKey, attrs]);

  const [defaults, setDefaults] = useState<Record<string, ResolvedDefault | null>>({});
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      seal.segments.map(async (seg) => {
        const value = segmentValue(seg.key, seg.value);
        if (hasGlyph(getGlyph(alphabet, seg.key, value))) return null;
        const r = await loadDefaultGlyph('sorcerer', seg.key, value);
        return [glyphKey(seg.key, value), r] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      const map: Record<string, ResolvedDefault | null> = {};
      for (const e of entries) if (e) map[e[0]] = e[1];
      setDefaults(map);
    });
    return () => {
      cancelled = true;
    };
  }, [areaNotation, alphabet, seal]);

  // The seal's centre mandala (the Sorcerer's signature mark).
  const [centerArt, setCenterArt] = useState<ResolvedDefault | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadGlyphByName('sorcerer', 'Sorcerer_Center').then((r) => {
      if (!cancelled) setCenterArt(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const { center, rOuter, rInner } = seal;
  const pt = (angle: number, r: number) => ({
    x: center.x + r * Math.cos(angle),
    y: center.y + r * Math.sin(angle),
  });

  // annular-sector path (for the hover hit area)
  const wedgePath = (a0: number, a1: number) => {
    const o0 = pt(a0, rOuter), o1 = pt(a1, rOuter);
    const i1 = pt(a1, rInner), i0 = pt(a0, rInner);
    return `M${o0.x} ${o0.y} A${rOuter} ${rOuter} 0 0 1 ${o1.x} ${o1.y} L${i1.x} ${i1.y} A${rInner} ${rInner} 0 0 0 ${i0.x} ${i0.y} Z`;
  };

  const STAGGER = 110; // ms between sectors drawing in
  // Place each glyph proportionally by its own center point.
  // The Sorcerer ring reads clockwise:
  // Level, School, Damage Type, Area Type, Range, Duration.
  const glyphRadius = rOuter * 0.65;
  const glyphSize = rOuter * 0.82;
  const centerSize = rOuter * 0.82 * (centerGlyph?.scale ?? 1);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="rune-svg seal-svg"
      role="img"
      aria-label="Spell seal"
    >
      <defs>
        <filter id="seal-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {seal.segments.map((seg, i) => {
          const next = seal.segments[(i + 1) % seal.segments.length];
          return (
            <linearGradient
              key={seg.key}
              id={`${gradientId}-${seg.key}`}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="50"
              x2="100"
              y2="50"
            >
              <stop offset="0%" stopColor={seg.color} />
              <stop offset="100%" stopColor={next.color} />
            </linearGradient>
          );
        })}
      </defs>

      {/* centre signature mandala (the Sorcerer's personal mark) */}
      {centerGlyph?.src ? (
        <image
          href={centerGlyph.src}
          onDoubleClick={onRequestCenterChange}
          style={{ cursor: 'pointer' }}
          x={center.x - centerSize / 2}
          y={center.y - centerSize / 2}
          width={centerSize}
          height={centerSize}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : centerArt?.kind === 'svg' ? (
        <g
          fill={SORCERER_INK}
          transform={`translate(${center.x - centerSize / 2} ${center.y - centerSize / 2}) scale(${centerSize / 100})`}
          onDoubleClick={onRequestCenterChange}
          style={{ cursor: 'pointer' }}
          dangerouslySetInnerHTML={{ __html: centerArt.inner }}
        />
      ) : centerArt?.kind === 'image' ? (
        <image
          href={centerArt.url}
          onDoubleClick={onRequestCenterChange}
          style={{ cursor: 'pointer' }}
          x={center.x - centerSize / 2}
          y={center.y - centerSize / 2}
          width={centerSize}
          height={centerSize}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : null}

      {/* per-sector mark: the user's own glyph if drawn, else shipped human-made default art */}
      <g filter="url(#seal-glow)">
        {seal.segments.map((seg, s) => {
          const state = highlight ? (seg.key === highlight ? ' hot' : ' dim') : '';
          const value = segmentValue(seg.key, seg.value);
          const glyph = getGlyph(alphabet, seg.key, value);
          const def = defaults[glyphKey(seg.key, value)];
          // Spectroscopy uses the per-segment rainbow gradient; normal/custom use a flat colour.
          const ink =
            mode === 'spectroscopy'
              ? `url(#${gradientId}-${seg.key})`
              : resolveAttrColor(seg.key, mode, custom, SORCERER_INK, seg.color);
          // Keep the glyph's native orientation and center it on its ring point.
          const c = pt(seg.mid, glyphRadius);
          const boxTransform = `translate(${c.x} ${c.y}) translate(${-glyphSize / 2} ${-glyphSize / 2}) scale(${glyphSize / 100})`;
          return (
            <g
              key={seg.key}
              className={`seal-seg${state}`}
              style={{
                opacity: drawn ? undefined : 0,
                transition: `opacity 0.5s ease ${s * STAGGER}ms`,
              }}
            >
              {hasGlyph(glyph) ? (
                <g transform={boxTransform}>
                  {isImageGlyph(glyph) ? (
                    <image href={glyph.src} x={0} y={0} width={100} height={100} preserveAspectRatio="xMidYMid meet" />
                  ) : (
                    glyph!.paths!.map((d, i) => (
                      <path key={i} d={d} className="seal-glyph" stroke={ink} />
                    ))
                  )}
                </g>
              ) : def ? (
                <g transform={boxTransform}>
                  {def.kind === 'svg' ? (
                    <g fill={ink} dangerouslySetInnerHTML={{ __html: def.inner }} />
                  ) : (
                    <image href={def.url} x={0} y={0} width={100} height={100} preserveAspectRatio="xMidYMid meet" />
                  )}
                </g>
              ) : null}
            </g>
          );
        })}
      </g>

      {/* invisible hover wedges */}
      {seal.segments.map((seg) => (
        <path
          key={`w${seg.key}`}
          d={wedgePath(seg.a0, seg.a1)}
          className="seal-wedge"
          onMouseEnter={() => onHighlight?.(seg.key)}
          onMouseLeave={() => onHighlight?.(null)}
        />
      ))}
    </svg>
  );
}
