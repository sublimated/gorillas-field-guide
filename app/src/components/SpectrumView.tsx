import { useMemo } from 'react';
import { spectrum, luminosity, rgbCss } from '../engines/spectrum';
import type { SpellAttributes } from '../engines/attributes';
import { customColorFor, type ColorMode, type CustomColors, DEFAULT_CUSTOM_COLORS } from '../engines/colorModes';
import type { CSSVars } from '../cssVars';

type Props = {
  attrs: SpellAttributes;
  replayKey?: number;
  highlight?: string | null;
  onHighlight?: (key: string | null) => void;
  mode?: ColorMode;
  custom?: CustomColors;
};

const LABELS: Record<string, string> = {
  level: 'Level',
  school: 'School',
  damage: 'Damage',
  area: 'Area',
  range: 'Range',
  duration: 'Duration',
};

export function SpectrumView({
  attrs,
  replayKey = 0,
  highlight = null,
  onHighlight,
  mode = 'normal',
  custom = DEFAULT_CUSTOM_COLORS,
}: Props) {
  const lines = useMemo(() => spectrum(attrs), [attrs]);
  const glow = useMemo(() => luminosity(attrs), [attrs]);

  return (
    <div className="spectrum" key={replayKey} style={{ '--glow': glow } as CSSVars}>
      <div className="spectrum-band">
        {lines.map((l, i) => {
          const isHot = highlight === l.key;
          const isDim = highlight !== null && !isHot;
          // Custom mode recolours each spectral line with the user's chosen colour for that
          // attribute (per-attribute pick, else the global pick). Normal / Spectroscopy keep
          // the gist_rainbow colour the spectrum engine assigned.
          const lineColor = mode === 'custom' ? customColorFor(l.key, custom) : rgbCss(l.color);
          const glowColor = mode === 'custom' ? customColorFor(l.key, custom) : rgbCss(l.color, 0.9);
          return (
            <div
              key={l.key}
              className={`spectral-line${isHot ? ' hot' : ''}${isDim ? ' dim' : ''}`}
              title={`${LABELS[l.key]} — brightness ${(l.brightness * 100).toFixed(0)}%`}
              style={{
                left: `${l.x * 100}%`,
                background: lineColor,
                opacity: isDim ? 0.18 : 0.5 + 0.5 * l.brightness,
                // drop-shadow (not box-shadow) so the glow follows the hand-drawn line mask
                filter: `drop-shadow(0 0 ${(isHot ? 10 : 3) + 6 * l.brightness * glow}px ${glowColor})`,
                animationDelay: `${i * 80}ms`,
              }}
              onMouseEnter={() => onHighlight?.(l.key)}
              onMouseLeave={() => onHighlight?.(null)}
            />
          );
        })}
      </div>
      <div className="spectrum-scale">
        <span>low energy</span>
        <span>high energy</span>
      </div>
    </div>
  );
}
