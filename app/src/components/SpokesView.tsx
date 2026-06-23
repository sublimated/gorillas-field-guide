import { useEffect, useMemo, useState } from 'react';
import { buildDruidSpokes } from '../engines/spokes';
import type { SpellAttributes } from '../engines/attributes';
import { resolveAttrColor, type ColorMode, type CustomColors, DEFAULT_CUSTOM_COLORS } from '../engines/colorModes';
import type { Glyph } from '../alphabet/glyphStore';

const DRUID_INK = 'var(--ink)';
const DRUID_STROKE_INK = '#2c2013';
const STROKE_ART = '/textures/boxes/line.svg';
const STROKE_ART_W = 1182.41;
const STROKE_ART_H = 18.21;

function strokeArtTransform(a: { x: number; y: number }, b: { x: number; y: number }, thickness: number): string {
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const sx = length / STROKE_ART_W;
  const sy = thickness / STROKE_ART_H;
  return `translate(${a.x} ${a.y}) rotate(${angle}) scale(${sx} ${sy}) translate(0 ${-STROKE_ART_H / 2})`;
}

type Props = {
  attrs: SpellAttributes;
  size?: number;
  mode?: ColorMode;
  custom?: CustomColors;
  replayKey?: number;
  highlight?: string | null;
  onHighlight?: (key: string | null) => void;
  centerGlyph?: Glyph;
  onRequestCenterChange?: () => void;
};

const STAGGER = 110; // ms between spokes drawing out

export function SpokesView({
  attrs,
  size = 420,
  mode = 'normal',
  custom = DEFAULT_CUSTOM_COLORS,
  replayKey = 0,
  highlight = null,
  onHighlight,
  centerGlyph,
  onRequestCenterChange,
}: Props) {
  const sigil = useMemo(() => buildDruidSpokes(attrs, { size }), [attrs, size]);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    // Intentional: re-trigger the draw-on CSS transition (toggle off, then on next frame)
    // whenever the spell/recast key changes — not deriving state from props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrawn(false);
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(t);
  }, [replayKey, attrs]);

  const { center, rHub } = sigil;
  const centerSize = rHub * 1.7 * (centerGlyph?.scale ?? 1);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="spokes-svg" role="img" aria-label="Spell ogham">
      <defs>
        <clipPath id="spoke-center-clip">
          <circle cx={center.x} cy={center.y} r={Math.max(rHub - 2, 1)} />
        </clipPath>
        {sigil.spokes.map((sp) => {
          const ink = resolveAttrColor(sp.key, mode, custom, DRUID_STROKE_INK, sp.color);
          return (
            <filter key={sp.key} id={`spoke-ink-${sp.key}`} x="0%" y="0%" width="100%" height="100%">
              <feFlood floodColor={ink} result="flood" />
              <feComposite in="flood" in2="SourceGraphic" operator="in" />
            </filter>
          );
        })}
      </defs>

      <circle cx={center.x} cy={center.y} r={rHub} className="spoke-hub" />

      {sigil.spokes.map((sp, s) => {
        const state = highlight ? (sp.key === highlight ? ' hot' : ' dim') : '';
        const markInk = resolveAttrColor(sp.key, mode, custom, DRUID_INK, sp.color);
        return (
          <g key={sp.key} className={`spoke${state}`}>
            <image
              href={STROKE_ART}
              x={0}
              y={0}
              width={STROKE_ART_W}
              height={STROKE_ART_H}
              preserveAspectRatio="none"
              transform={strokeArtTransform({ x: sp.ax, y: sp.ay }, { x: sp.bx, y: sp.by }, 3.1)}
              filter={`url(#spoke-ink-${sp.key})`}
              className="spoke-stroke"
              style={{
                opacity: drawn ? undefined : 0,
                transitionDelay: `${s * STAGGER}ms`,
              }}
            />
            {sp.marks.map((m, i) => {
              const style = {
                opacity: drawn ? undefined : 0,
                transitionDelay: `${s * STAGGER + 280 + i * 70}ms`,
              };
              if (m.kind === 'circle') {
                return <circle key={i} cx={m.cx} cy={m.cy} r={m.r} className="spoke-mark" fill="none" stroke={markInk} style={style} />;
              }
              if (m.kind === 'triangle') {
                return <polygon key={i} points={m.points} className="spoke-mark" fill="none" stroke={markInk} strokeLinejoin="round" style={style} />;
              }
              if (m.kind === 'cycloid') {
                return (
                  <g key={i} style={style}>
                    {m.lines.map((line, j) => (
                      <image
                        key={j}
                        href={STROKE_ART}
                        x={0}
                        y={0}
                        width={STROKE_ART_W}
                        height={STROKE_ART_H}
                        preserveAspectRatio="none"
                        transform={strokeArtTransform({ x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 }, 2.8)}
                        filter={`url(#spoke-ink-${sp.key})`}
                        className="spoke-stroke mark"
                      />
                    ))}
                  </g>
                );
              }
              return (
                <image
                  key={i}
                  href={STROKE_ART}
                  x={0}
                  y={0}
                  width={STROKE_ART_W}
                  height={STROKE_ART_H}
                  preserveAspectRatio="none"
                  transform={strokeArtTransform({ x: m.x1, y: m.y1 }, { x: m.x2, y: m.y2 }, 2.8)}
                  filter={`url(#spoke-ink-${sp.key})`}
                  className="spoke-stroke mark"
                  style={style}
                />
              );
            })}
            <line
              x1={sp.ax}
              y1={sp.ay}
              x2={sp.bx}
              y2={sp.by}
              className="spoke-hit"
              onMouseEnter={() => onHighlight?.(sp.key)}
              onMouseLeave={() => onHighlight?.(null)}
            />
          </g>
        );
      })}

      {sigil.ritual && <circle cx={center.x} cy={center.y} r={rHub + 6} className="rune-ritual-ring" />}
      {(sigil.concentration || sigil.ritual) && (
        <circle cx={center.x} cy={center.y} r={3.5} className="rune-center-dot" />
      )}

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
          clipPath="url(#spoke-center-clip)"
        />
      ) : (
        <circle
          cx={center.x}
          cy={center.y}
          r={Math.max(rHub - 4, 1)}
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onDoubleClick={onRequestCenterChange}
        />
      )}
    </svg>
  );
}
