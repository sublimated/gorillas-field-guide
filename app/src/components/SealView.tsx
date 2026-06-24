import { useEffect, useId, useMemo, useState } from 'react';
import { buildSorcererSeal } from '../engines/seal';
import type { AttributeKey, SpellAttributes } from '../engines/attributes';
import { getGlyph, glyphKey, hasGlyph, isImageGlyph, type Alphabet, type Glyph } from '../alphabet/glyphStore';
import { glyphAreaNotation } from '../alphabet/numerals';
import { loadDefaultGlyph, loadGlyphByName, loadSorcererAreaGlyph, type ResolvedDefault } from '../alphabet/defaults';
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

// Renders the user's own glyph for (key, value) if drawn, else shipped default art, at the
// given box transform. Shared between a segment's primary mark and (for damage) its minor mark.
function renderMark(
  key: string,
  value: string,
  boxTransform: string,
  ink: string,
  alphabet: Alphabet,
  defaults: Record<string, ResolvedDefault | null>,
) {
  const glyph = getGlyph(alphabet, key, value);
  if (hasGlyph(glyph)) {
    return (
      <g transform={boxTransform}>
        {isImageGlyph(glyph) ? (
          <image href={glyph.src} x={0} y={0} width={100} height={100} preserveAspectRatio="xMidYMid meet" />
        ) : (
          glyph!.paths!.map((d, i) => <path key={i} d={d} className="seal-glyph" stroke={ink} />)
        )}
      </g>
    );
  }
  const def = defaults[glyphKey(key, value)];
  if (!def) return null;
  return (
    <g transform={boxTransform}>
      {def.kind === 'svg' ? (
        <g fill={ink} dangerouslySetInnerHTML={{ __html: def.inner }} />
      ) : (
        <image href={def.url} x={0} y={0} width={100} height={100} preserveAspectRatio="xMidYMid meet" />
      )}
    </g>
  );
}

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
    if (key === 'area' && areaNotation) return areaNotation === 'None' ? 'None' : glyphAreaNotation(areaNotation);
    return value;
  };

  useEffect(() => {
    // Intentional: re-trigger the draw-on CSS transition (toggle off, then on next frame)
    // whenever the spell/recast key changes — not deriving state from props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrawn(false);
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(t);
  }, [replayKey, attrs]);

  const [defaults, setDefaults] = useState<Record<string, ResolvedDefault | null>>({});
  useEffect(() => {
    let cancelled = false;
    const lookups: Array<{ key: AttributeKey; value: string }> = seal.segments.map((seg) => ({
      key: seg.key,
      value: segmentValue(seg.key, seg.value),
    }));
    // A spell dealing two damage types at once also needs the minor type's glyph resolved.
    if (attrs.damageSecondary) lookups.push({ key: 'damage', value: attrs.damageSecondary });
    Promise.all(
      lookups.map(async ({ key, value }) => {
        if (hasGlyph(getGlyph(alphabet, key, value))) return null;
        const r = key === 'area'
          ? await loadSorcererAreaGlyph(value)
          : await loadDefaultGlyph('sorcerer', key, value);
        return [glyphKey(key, value), r] as const;
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
    // segmentValue is derived purely from areaNotation (already a dependency); omitted to
    // avoid re-running this effect on every render from its unmemoized function identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          // Spectroscopy uses the per-segment rainbow gradient; normal/custom use a flat colour.
          const ink =
            mode === 'spectroscopy'
              ? `url(#${gradientId}-${seg.key})`
              : resolveAttrColor(seg.key, mode, custom, SORCERER_INK, seg.color);
          // Keep the glyph's native orientation and center it on its ring point.
          const c = pt(seg.mid, glyphRadius);
          const boxTransform = `translate(${c.x} ${c.y}) translate(${-glyphSize / 2} ${-glyphSize / 2}) scale(${glyphSize / 100})`;
          // A spell dealing two damage types at once (e.g. Ice Storm's Cold + Bludgeoning)
          // shows its lower-potential type as a compact second mark that leans toward the
          // school wedge while staying tucked inside the damage sector.
          const minorValue = seg.key === 'damage' ? attrs.damageSecondary : undefined;
          const minorSize = glyphSize * 0.42;
          const minorAngle = seg.mid - (seg.a1 - seg.a0) * 0.24;
          const cMinor = pt(minorAngle, glyphRadius - glyphSize * 0.08);
          const minorBoxTransform = `translate(${cMinor.x} ${cMinor.y}) translate(${-minorSize / 2} ${-minorSize / 2}) scale(${minorSize / 100})`;
          return (
            <g
              key={seg.key}
              className={`seal-seg${state}`}
              style={{
                opacity: drawn ? undefined : 0,
                transition: `opacity 0.5s ease ${s * STAGGER}ms`,
              }}
            >
              {renderMark(seg.key, value, boxTransform, ink, alphabet, defaults)}
              {minorValue && renderMark(seg.key, minorValue, minorBoxTransform, ink, alphabet, defaults)}
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
