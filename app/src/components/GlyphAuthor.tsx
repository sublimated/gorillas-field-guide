import { useEffect, useMemo, useState } from 'react';
import { ATTRIBUTE_ORDER, FEATURES, type AttributeKey } from '../engines/attributes';
import { GlyphPad } from './GlyphPad';
import { fileToGlyphSrc } from '../alphabet/glyphImage';
import { getGlyph, glyphKey, hasGlyph, isImageGlyph, type Alphabet, type Glyph } from '../alphabet/glyphStore';

type Props = {
  alphabet: Alphabet;
  setGlyph: (attr: string, value: string, glyph: Glyph) => void;
  removeGlyph: (attr: string, value: string) => void;
  replaceAll: (a: Alphabet) => void;
};

const LABELS: Record<AttributeKey, string> = {
  level: 'Level', school: 'School', damage: 'Damage',
  area: 'Area', range: 'Range', duration: 'Duration',
};

function GlyphPreview({ glyph, size = 30 }: { glyph: Glyph; size?: number }) {
  if (isImageGlyph(glyph)) {
    return <img src={glyph.src} width={size} height={size} alt="" style={{ objectFit: 'contain', display: 'block' }} />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      {(glyph.paths ?? []).map((d, i) => <path key={i} d={d} className="glyph-stroke" />)}
    </svg>
  );
}

export function GlyphAuthor({ alphabet, setGlyph, removeGlyph, replaceAll }: Props) {
  const [attr, setAttr] = useState<AttributeKey>('school');
  const [value, setValue] = useState<string>(FEATURES.school[0]);
  const [draft, setDraft] = useState<string[]>([]);

  // Load the existing glyph (if any) whenever the selected value changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(getGlyph(alphabet, attr, value)?.paths ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attr, value]);

  const values = FEATURES[attr];
  const total = useMemo(
    () => ATTRIBUTE_ORDER.reduce((sum, k) => sum + FEATURES[k].length, 0),
    [],
  );
  const drawn = Object.keys(alphabet).length;

  const current = getGlyph(alphabet, attr, value);
  const save = () => setGlyph(attr, value, { paths: draft });
  const dirty = JSON.stringify(draft) !== JSON.stringify(current?.paths ?? []);

  const uploadArt = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    fileToGlyphSrc(file)
      .then((src) => { setGlyph(attr, value, { src }); setDraft([]); })
      .catch(() => alert('Could not read that image.'));
    e.target.value = '';
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(alphabet, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'god-alphabet.json'; a.click();
    URL.revokeObjectURL(url);
  };
  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((t) => {
      try { replaceAll(JSON.parse(t) as Alphabet); } catch { alert('Could not read that alphabet file.'); }
    });
    e.target.value = '';
  };

  return (
    <section className="alphabet">
      <div className="alphabet-head">
        <h2>Sorcerer Scriptorium</h2>
        <p className="meta">
          Draw a symbol, or upload your own artwork (PNG/WebP with transparency, or SVG).
          {' '}{drawn} of {total} set. These render in the Sorcerer seal — the placeholder
          shows for anything blank. (Wizard chords and Druid spokes are drawn from geometry;
          Warlock uses its own fixed glyph set.)
        </p>
        <div className="alphabet-io">
          <button onClick={exportJson}>⭳ export</button>
          <label className="import-btn">
            ⭱ import
            <input type="file" accept="application/json" onChange={importJson} hidden />
          </label>
        </div>
      </div>

      <div className="alphabet-attrs">
        {ATTRIBUTE_ORDER.map((k) => (
          <button
            key={k}
            className={`mode-btn${attr === k ? ' active' : ''}`}
            onClick={() => { setAttr(k); setValue(FEATURES[k][0]); }}
          >
            {LABELS[k]}
          </button>
        ))}
      </div>

      <div className="alphabet-body">
        <div className="value-list">
          {values.map((v) => {
            const g = alphabet[glyphKey(attr, v)];
            return (
              <button
                key={v}
                className={`value-row${value === v ? ' active' : ''}`}
                onClick={() => setValue(v)}
              >
                <span className="value-mark">
                  {hasGlyph(g) ? <GlyphPreview glyph={g} /> : <span className="value-empty">·</span>}
                </span>
                <span className="value-name">{v}</span>
              </button>
            );
          })}
        </div>

        <div className="glyph-editor">
          <div className="glyph-editor-label">
            {LABELS[attr]} · <strong>{value}</strong>
          </div>

          {isImageGlyph(current) && (
            <div className="current-art">
              <span className="value-mark"><GlyphPreview glyph={current} size={40} /></span>
              <span>Using uploaded artwork. Draw below to replace it with strokes.</span>
            </div>
          )}

          <GlyphPad value={draft} onChange={setDraft} />
          <div className="glyph-editor-actions">
            <button className="save-btn" onClick={save} disabled={!dirty}>
              {current?.paths?.length ? 'Update strokes' : 'Save strokes'}
            </button>
            <label className="import-btn">
              ⭱ upload art
              <input type="file" accept="image/png,image/webp,image/svg+xml,.svg" onChange={uploadArt} hidden />
            </label>
            <button
              onClick={() => { removeGlyph(attr, value); setDraft([]); }}
              disabled={!hasGlyph(current)}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
