/** A path drawn through the five languages: the brand idea, drawn once as the page opens. */
export function RouteLine({ labels }: { labels: string[] }) {
  const points = labels.map((_, i) => ({ x: 40 + i * 130, y: i % 2 === 0 ? 58 : 22 }));
  const d = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1]!;
    const mid = (prev.x + p.x) / 2;
    return `${acc} C ${mid} ${prev.y}, ${mid} ${p.y}, ${p.x} ${p.y}`;
  }, '');
  return (
    <svg className="route-line" viewBox="0 0 600 80" role="presentation" aria-hidden>
      <path d={d} pathLength={1} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={labels[i]} style={{ '--i': i } as React.CSSProperties}>
          <circle cx={p.x} cy={p.y} r={14} fill="var(--surface)" stroke="currentColor" strokeWidth={2} />
          <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="currentColor">
            {labels[i]}
          </text>
        </g>
      ))}
    </svg>
  );
}
