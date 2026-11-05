import { useEffect, useRef } from 'react';
import { currentAnalyser, useIsPlaying } from '../../lib/playback';
import { prefersReducedMotion } from '../../lib/motion';

const BARS = 28;

/**
 * Radial bars around a play button that follow the real signal of the recording. When the
 * signal is not available (browser synthesis), the bars breathe slowly instead.
 */
export function AudioRing({ size = 132 }: { size?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const playing = useIsPlaying();

  useEffect(() => {
    const el = canvas.current;
    if (!el || !playing || prefersReducedMotion()) return;
    const ctx = el.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    el.width = size * dpr;
    el.height = size * dpr;
    ctx.scale(dpr, dpr);
    const color = getComputedStyle(el).color;
    const data = new Uint8Array(32);
    let frame = 0;
    const started = performance.now();
    const draw = (now: number) => {
      const analyser = currentAnalyser();
      if (analyser) analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, size, size);
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.lineWidth = 3;
      const c = size / 2;
      const inner = size * 0.34;
      for (let i = 0; i < BARS; i++) {
        const level = analyser
          ? (data[(i * 3) % 24] ?? 0) / 255
          : 0.25 + 0.2 * Math.sin((now - started) / 220 + i * 0.7) * Math.sin((now - started) / 610 + i);
        const angle = (i / BARS) * Math.PI * 2 - Math.PI / 2;
        const len = 4 + level * size * 0.14;
        ctx.globalAlpha = 0.35 + level * 0.65;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(angle) * inner, c + Math.sin(angle) * inner);
        ctx.lineTo(c + Math.cos(angle) * (inner + len), c + Math.sin(angle) * (inner + len));
        ctx.stroke();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, el.width, el.height);
    };
  }, [playing, size]);

  return <canvas ref={canvas} className="audio-ring" style={{ width: size, height: size }} aria-hidden />;
}
