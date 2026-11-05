import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../../lib/motion';

/** Letters of all five course alphabets, so the scramble itself shows which scripts are taught. */
const GLYPHS = 'әғқңөұүһіäöüßçğışñáéóабвгдежзиклмнопрстуфхшыэюяabcdefghijklmnopqrstuvwxyz';

/**
 * Cycles through phrases; each new phrase "decodes" from random letters of the course
 * alphabets, left to right. With reduced motion the phrase simply changes.
 */
export function Decoder({ phrases, interval = 3400, onChange }: { phrases: string[]; interval?: number; onChange?: (index: number) => void }) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState<Array<{ ch: string; scrambled: boolean }>>(() => [...(phrases[0] ?? '')].map((ch) => ({ ch, scrambled: false })));

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % phrases.length), interval);
    return () => clearInterval(timer);
  }, [phrases.length, interval]);

  useEffect(() => {
    onChange?.(index);
    const target = [...(phrases[index] ?? '')];
    if (prefersReducedMotion()) {
      setShown(target.map((ch) => ({ ch, scrambled: false })));
      return;
    }
    let frame = 0;
    const start = performance.now();
    const duration = 700;
    const step = (now: number) => {
      const revealed = Math.floor(((now - start) / duration) * target.length);
      setShown(
        target.map((ch, i) =>
          i < revealed || ch === ' ' ? { ch, scrambled: false } : { ch: GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!, scrambled: true },
        ),
      );
      if (revealed < target.length) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [index, phrases, onChange]);

  return (
    <span className="decoder" aria-live="off" aria-label={phrases[index]}>
      {shown.map((c, i) => (
        <span key={i} className="decoder__char" aria-hidden data-scrambled={c.scrambled || undefined}>
          {c.ch}
        </span>
      ))}
    </span>
  );
}
