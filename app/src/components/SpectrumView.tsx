import { useMemo } from 'react';
import { spectrum, luminosity, rgbCss, mixWhite } from '../engines/spectrum';
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
          // the visible-spectrum colour the spectrum engine assigned.
          const lineColor = mode === 'custom' ? customColorFor(l.key, custom) : rgbCss(l.color);
          const glowColor = mode === 'custom' ? customColorFor(l.key, custom) : rgbCss(l.color, 0.9);
          // A real light source reads hot/white at its core with the hue only fully showing
          // in the surrounding bloom — two stacked drop-shadows (tight+bright, wide+coloured)
          // sell that better than a single uniform glow.
          const coreColor = mode === 'custom' ? lineColor : rgbCss(mixWhite(l.color, 0.6), 0.95);
          const coreBlur = (isHot ? 4 : 1.5) + 3 * l.brightness * glow;
          const bloomBlur = (isHot ? 14 : 4) + 9 * l.brightness * glow;
          const width = l.variant === 'secondary' ? (isHot ? 9 : 5) : (isHot ? 12 : 7);
          const label = l.key === 'damage' && l.variant === 'secondary'
            ? 'Damage (secondary)'
            : LABELS[l.key];
          return (
            <div
              key={l.id}
              className={`spectral-line${isHot ? ' hot' : ''}${isDim ? ' dim' : ''}`}
              title={`${label} — brightness ${(l.brightness * 100).toFixed(0)}%`}
              style={{
                // Inset from the band edges by half the widest (hot) line state so a line at
                // x=0 or x=1 never gets clipped in half by .spectrum-band's overflow:hidden.
                left: `calc(6px + (100% - 12px) * ${l.x})`,
                width: `${width}px`,
                background: lineColor,
                opacity: isDim ? 0.18 : 0.5 + 0.5 * l.brightness,
                // drop-shadow (not box-shadow) so the glow follows the hand-drawn line mask
                filter: `drop-shadow(0 0 ${coreBlur}px ${coreColor}) drop-shadow(0 0 ${bloomBlur}px ${glowColor})`,
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
