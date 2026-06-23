import { useRef, useState } from 'react';

type Props = {
  value: string[]; // committed stroke paths (0..100 unit box)
  onChange: (paths: string[]) => void;
  size?: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number) => Math.max(0, Math.min(100, n));

// A square drawing surface. Each stroke is captured as an SVG path in a 0..100 box, so
// glyphs are resolution-independent and drop straight into the seal / runes.
export function GlyphPad({ value, onChange, size = 260 }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  // The in-progress stroke lives in a ref so handlers never read a stale value across
  // the down→move→up gesture; `live` only mirrors it for rendering the preview.
  const strokeRef = useRef<string | null>(null);
  const [live, setLive] = useState<string | null>(null);

  const toUnit = (e: React.PointerEvent): [number, number] => {
    const rect = ref.current!.getBoundingClientRect();
    return [
      clamp(((e.clientX - rect.left) / rect.width) * 100),
      clamp(((e.clientY - rect.top) / rect.height) * 100),
    ];
  };

  const down = (e: React.PointerEvent) => {
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* pointer capture is best-effort; drawing still works without it */
    }
    const [x, y] = toUnit(e);
    strokeRef.current = `M ${r1(x)} ${r1(y)}`;
    setLive(strokeRef.current);
  };
  const move = (e: React.PointerEvent) => {
    if (strokeRef.current === null) return;
    const [x, y] = toUnit(e);
    strokeRef.current = `${strokeRef.current} L ${r1(x)} ${r1(y)}`;
    setLive(strokeRef.current);
  };
  const up = () => {
    const stroke = strokeRef.current;
    strokeRef.current = null;
    setLive(null);
    if (stroke === null) return;
    if (stroke.includes('L')) onChange([...value, stroke]); // ignore taps that didn't move
  };

  return (
    <div className="glyph-pad-wrap">
      <svg
        ref={ref}
        className="glyph-pad"
        width={size}
        height={size}
        viewBox="0 0 100 100"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        role="img"
        aria-label="Glyph drawing pad"
      >
        <line x1="50" y1="6" x2="50" y2="94" className="glyph-guide" />
        <line x1="6" y1="50" x2="94" y2="50" className="glyph-guide" />
        {value.map((d, i) => (
          <path key={i} d={d} className="glyph-stroke" />
        ))}
        {live && <path d={live} className="glyph-stroke live" />}
      </svg>
      <div className="glyph-pad-tools">
        <button onClick={() => onChange(value.slice(0, -1))} disabled={!value.length}>
          ↶ undo
        </button>
        <button onClick={() => onChange([])} disabled={!value.length}>
          ✕ clear
        </button>
      </div>
    </div>
  );
}
