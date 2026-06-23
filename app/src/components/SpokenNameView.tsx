import { useMemo } from 'react';
import { spokenName } from '../engines/sound';
import type { SoundInput } from '../engines/sound';
import type { CollisionVariant } from '../data/collisionVariants';

type Props = {
  input: SoundInput;
  highlight?: string | null;
  onHighlight?: (key: string | null) => void;
  variant?: CollisionVariant | null;
};

export function SpokenNameView({ input, highlight = null, onHighlight, variant = null }: Props) {
  const spoken = useMemo(() => spokenName(input), [input]);

  // Collisions get a quiet diphthong woven onto the end of the name so they sound distinct.
  const displayName = spoken.name + (variant?.diphthong ?? '');

  const speak = () => {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(displayName.replace(/'/g, ' '));
    u.rate = 0.85;
    u.pitch = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  return (
    <div className="spoken">
      <div className="spoken-row">
        <span className="spoken-name">{displayName}</span>
        <button className="speak-btn" onClick={speak} aria-label="Speak the name">
          ◈ speak
        </button>
      </div>
      <div className="spoken-parts">
        {spoken.parts.map((p) => {
          const k = p.label.toLowerCase(); // 'level','school',… (Up-cast won't match a chord)
          const state = highlight ? (k === highlight ? ' hot' : ' dim') : '';
          return (
            <div
              className={`syllable${state}`}
              key={p.label}
              onMouseEnter={() => onHighlight?.(k)}
              onMouseLeave={() => onHighlight?.(null)}
            >
              <span className="syl">{p.syllable || "·"}</span>
              <span className="syl-label">{p.label}</span>
              <span className="syl-val">{p.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
