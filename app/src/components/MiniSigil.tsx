import { memo, useEffect, useMemo, useState } from 'react';
import { buildRune } from '../engines/rune';
import { buildSorcererSeal } from '../engines/seal';
import { buildDruidSpokes } from '../engines/spokes';
import { buildWarlockSigil } from '../engines/warlock';
import { toAttributes, type Spell } from '../data/spells';
import { loadDefaultGlyph, loadSorcererAreaGlyph, type ResolvedDefault } from '../alphabet/defaults';
import { glyphAreaNotation } from '../alphabet/numerals';

type Props = {
  spell: Spell;
  mode: 'wizard' | 'sorcerer' | 'druid' | 'warlock';
  size?: number;
  colored?: boolean;
};

// A cheap, static thumbnail of a spell's sigil for the grid: no animation, no hover. Wizard =
// chords; Sorcerer = ring with the real default glyphs around it (ticks as the loading/missing
// fallback). Memoized so each cell computes once; combined with `content-visibility` on the cell,
// off-screen ones don't paint. Sorcerer glyphs load async but are cached per (attr,value) in
// loadDefaultGlyph, so distinct glyphs fetch once and are shared across every cell.
function MiniSigilBase({ spell, mode, size = 90, colored = true }: Props) {
  const attrs = useMemo(() => toAttributes(spell), [spell]);
  const rune = useMemo(
    () => (mode === 'wizard' ? buildRune(attrs, { size, padding: 8 }) : null),
    [attrs, size, mode],
  );
  const seal = useMemo(
    () => (mode === 'sorcerer' ? buildSorcererSeal(attrs, { size, padding: 7 }) : null),
    [attrs, size, mode],
  );
  const spokes = useMemo(
    () => (mode === 'druid' ? buildDruidSpokes(attrs, { size, padding: 8 }) : null),
    [attrs, size, mode],
  );
  const warlock = useMemo(
    () => (mode === 'warlock' ? buildWarlockSigil(attrs, { size, padding: 8, castingTime: spell.castingTime }) : null),
    [attrs, size, mode, spell.castingTime],
  );

  // Sorcerer mini: resolve the same shipped default glyphs the detail seal uses, one per
  // segment, keyed by segment key. Each segment that resolves to art draws its glyph; any
  // still-loading or missing (null) segment falls back to its numeral ticks below. The
  // resolver is cached per (attr,value), so this is one fetch per distinct glyph app-wide.
  const [sealGlyphs, setSealGlyphs] = useState<Record<string, ResolvedDefault | null>>({});
  useEffect(() => {
    if (!seal) return;
    let cancelled = false;
    // The area segment uses the SIZED area value (e.g. "Sphere (20)"), matching SealView,
    // so the area glyph file resolves.
    const segValue = (key: string, value: string) =>
      key === 'area' && attrs.areaNotation && attrs.areaNotation !== 'None'
        ? glyphAreaNotation(attrs.areaNotation)
        : value;
    Promise.all(
      seal.segments.map(async (seg) => {
        const value = segValue(seg.key, seg.value);
        const r = seg.key === 'area'
          ? await loadSorcererAreaGlyph(value)
          : await loadDefaultGlyph('sorcerer', seg.key, value);
        return [seg.key, r] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      const map: Record<string, ResolvedDefault | null> = {};
      for (const [k, r] of entries) map[k] = r;
      setSealGlyphs(map);
    });
    return () => {
      cancelled = true;
    };
  }, [seal, attrs.areaNotation]);

  if (warlock) {
    const ink = 'var(--warlock-ink)';
    const { center, rOuter, rInner, rText } = warlock;
    const pt = (a: number, r: number) => ({ x: center.x + r * Math.cos(a), y: center.y + r * Math.sin(a) });
    const rot = (a: number) => {
      let degrees = (a * 180) / Math.PI + 90;
      const normalized = ((degrees % 360) + 360) % 360;
      if (normalized > 90 && normalized < 270) degrees += 180;
      return degrees;
    };
    return (
      <svg viewBox={`0 0 ${size} ${size}`} className="mini-sigil" aria-hidden role="img">
        <circle cx={center.x} cy={center.y} r={rOuter} className="mini-ring" />
        <circle cx={center.x} cy={center.y} r={rInner} className="mini-ring" />
        {warlock.segments.map((seg) => {
          const c = pt(seg.mid, rText);
          return (
            <text
              key={seg.key}
              x={c.x}
              y={c.y}
              className="mini-warlock-text"
              fill={ink}
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${rot(seg.mid)} ${c.x} ${c.y})`}
            >
              {seg.code.replace(/\s+/g, '')}
            </text>
          );
        })}
      </svg>
    );
  }

  if (spokes) {
    const ink = colored ? undefined : 'var(--ink-soft)';
    return (
      <svg viewBox={`0 0 ${size} ${size}`} className="mini-sigil" aria-hidden role="img">
        <circle cx={spokes.center.x} cy={spokes.center.y} r={spokes.rHub} className="mini-ring" />
        {spokes.spokes.map((sp) => (
          <g key={sp.key}>
            <line x1={sp.ax} y1={sp.ay} x2={sp.bx} y2={sp.by} stroke={ink ?? sp.color} strokeWidth={1} strokeLinecap="round" />
            {sp.marks.map((m, i) => {
              const color = ink ?? sp.color;
              if (m.kind === 'circle') {
                return <circle key={i} cx={m.cx} cy={m.cy} r={m.r} fill="none" stroke={color} strokeWidth={1.1} />;
              }
              if (m.kind === 'triangle') {
                return <polygon key={i} points={m.points} fill="none" stroke={color} strokeWidth={1.1} strokeLinejoin="round" />;
              }
              if (m.kind === 'cycloid') {
                return (
                  <g key={i}>
                    {m.lines.map((line, j) => (
                      <line key={j} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke={color} strokeWidth={1.1} strokeLinecap="round" />
                    ))}
                  </g>
                );
              }
              return <line key={i} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke={color} strokeWidth={1.2} strokeLinecap="round" />;
            })}
          </g>
        ))}
      </svg>
    );
  }

  if (seal) {
    const ink = 'var(--sorcerer-ink)';
    const { center, rOuter, rInner, dividers } = seal;
    const pt = (a: number, r: number) => ({ x: center.x + r * Math.cos(a), y: center.y + r * Math.sin(a) });
    // Mirror SealView's placement so the mini reads as a shrunken detail seal: each glyph is
    // centred on its sector mid at this radius, in its own native orientation.
    const glyphRadius = rOuter * 0.65;
    const glyphSize = rOuter * 0.82;
    // A segment's tick numeral — used as the fallback while a glyph loads or when it's missing.
    const ticksFor = (seg: (typeof seal.segments)[number]) =>
      seg.ticks
        .filter((tk) => tk.on)
        .map((tk, i) => {
          const a = pt(tk.angle, rInner + (rOuter - rInner) * 0.12);
          const b = pt(tk.angle, rOuter - (rOuter - rInner) * 0.12);
          return <line key={`${seg.key}-tick-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="mini-seal-tick" />;
        });
    return (
      <svg viewBox={`0 0 ${size} ${size}`} className="mini-sigil" aria-hidden role="img">
        <circle cx={center.x} cy={center.y} r={rOuter} className="mini-ring" />
        <circle cx={center.x} cy={center.y} r={rInner} className="mini-ring" />
        {/* sector dividers so the seal reads as six segments, not a bare ring */}
        {dividers.map((a, i) => {
          const p = pt(a, rInner);
          const q = pt(a, rOuter);
          return <line key={`div-${i}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className="mini-seal-divider" />;
        })}
        {seal.segments.map((seg) => {
          const def = sealGlyphs[seg.key];
          if (!def) return <g key={seg.key}>{ticksFor(seg)}</g>; // loading or missing → ticks
          const c = pt(seg.mid, glyphRadius);
          const box = `translate(${c.x} ${c.y}) translate(${-glyphSize / 2} ${-glyphSize / 2}) scale(${glyphSize / 100})`;
          return (
            <g key={seg.key} transform={box}>
              {def.kind === 'svg' ? (
                <g fill={ink} dangerouslySetInnerHTML={{ __html: def.inner }} />
              ) : (
                <image href={def.url} x={0} y={0} width={100} height={100} preserveAspectRatio="xMidYMid meet" />
              )}
            </g>
          );
        })}
      </svg>
    );
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mini-sigil" aria-hidden role="img">
      {rune!.chords.map((c, i) => (
        <line
          key={`${c.key}-${c.from}-${c.to}-${i}`}
          x1={c.a.x}
          y1={c.a.y}
          x2={c.b.x}
          y2={c.b.y}
          stroke={colored ? c.color : 'var(--ink-soft)'}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

export const MiniSigil = memo(MiniSigilBase);
