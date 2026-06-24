import { useMemo } from 'react';
import { spokenName } from '../engines/sound';
import type { SoundInput } from '../engines/sound';
import { spokenIpa, diphthongIpa } from '../engines/soundIpa';
import { useKokoroSpeak } from '../engines/kokoroClient';
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
  const phonemes = useMemo(
    () => spokenIpa(input) + diphthongIpa(variant?.diphthong ?? ''),
    [input, variant],
  );

  const { status, speak } = useKokoroSpeak();
  const loading = status === 'loading';
  const speaking = status === 'speaking';
  const label = loading ? 'loading voice…' : status === 'error' ? 'speak (retry)' : '◈ speak';

  return (
    <div className="spoken">
      <div className="spoken-row">
        <span className="spoken-name">{displayName}</span>
        <button
          className={`speak-btn${loading || speaking ? ' busy' : ''}`}
          onClick={() => speak(phonemes)}
          disabled={loading || speaking}
          aria-label="Speak the name"
        >
          {label}
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
