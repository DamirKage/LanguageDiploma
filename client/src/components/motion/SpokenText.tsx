import { useMemo } from 'react';
import { usePlaybackOf } from '../../lib/playback';

/**
 * Target-language text that lights up word by word while it is being pronounced, so the
 * learner connects what they hear with what they read. Timing is proportional to the
 * length of each word, which is close enough for short phrases.
 */
export function SpokenText({ text, className = '' }: { text: string; className?: string }) {
  const progress = usePlaybackOf(text);
  const parts = useMemo(() => {
    const tokens = text.split(/(\s+)/);
    const total = text.length || 1;
    let offset = 0;
    return tokens.map((token) => {
      const start = offset / total;
      offset += token.length;
      return { token, start, end: offset / total, space: /^\s+$/.test(token) };
    });
  }, [text]);

  if (progress === null) return <span className={className}>{text}</span>;
  return (
    <span className={`${className} spoken`} aria-label={text}>
      {parts.map((p, i) =>
        p.space ? (
          p.token
        ) : (
          <span key={i} className="spoken__word" aria-hidden data-state={progress >= p.end ? 'done' : progress >= p.start ? 'now' : undefined}>
            {p.token}
          </span>
        ),
      )}
    </span>
  );
}
