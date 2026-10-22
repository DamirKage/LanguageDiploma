import { useEffect, useState } from 'react';
import { BarElement, CategoryScale, Chart as ChartJS, Filler, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Filler);

function readTokens() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return { ink: v('--ink'), ink3: v('--ink-3'), line: v('--line'), accent: v('--accent'), surface: v('--surface'), font: v('--font-ui') };
}

/** Chart colors come from the CSS tokens so light and dark themes stay consistent. */
function useTokens() {
  const [tokens, setTokens] = useState(readTokens);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setTokens(readTokens());
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return tokens;
}

function baseOptions(tokens: ReturnType<typeof readTokens>, yMax?: number, ySuffix = '') {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tokens.ink,
        titleColor: tokens.surface,
        bodyColor: tokens.surface,
        displayColors: false,
        padding: 10,
        titleFont: { family: tokens.font, weight: 600 as const },
        bodyFont: { family: tokens.font },
        callbacks: { label: (ctx: { formattedValue: string }) => `${ctx.formattedValue}${ySuffix}` },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: tokens.line },
        ticks: { color: tokens.ink3, font: { family: tokens.font, size: 11 }, maxRotation: 0, autoSkipPadding: 16 },
      },
      y: {
        min: 0,
        max: yMax,
        grid: { color: tokens.line },
        border: { display: false },
        ticks: { color: tokens.ink3, font: { family: tokens.font, size: 11 }, maxTicksLimit: 5, callback: (v: string | number) => `${v}${ySuffix}` },
      },
    },
  };
}

export function LineChart({ labels, values, label, max, suffix }: { labels: string[]; values: Array<number | null>; label: string; max?: number; suffix?: string }) {
  const tokens = useTokens();
  return (
    <div className="chart" role="img" aria-label={label}>
      <Line
        options={baseOptions(tokens, max, suffix)}
        data={{
          labels,
          datasets: [
            {
              label,
              data: values,
              borderColor: tokens.accent,
              backgroundColor: tokens.accent,
              borderWidth: 2,
              pointRadius: 3,
              pointHoverRadius: 5,
              pointBackgroundColor: tokens.accent,
              pointBorderColor: tokens.surface,
              pointBorderWidth: 2,
              spanGaps: true,
              tension: 0.25,
            },
          ],
        }}
      />
    </div>
  );
}

export function BarChart({ labels, values, label, suffix }: { labels: string[]; values: number[]; label: string; suffix?: string }) {
  const tokens = useTokens();
  return (
    <div className="chart" role="img" aria-label={label}>
      <Bar
        options={baseOptions(tokens, undefined, suffix)}
        data={{
          labels,
          datasets: [
            {
              label,
              data: values,
              backgroundColor: tokens.ink,
              hoverBackgroundColor: tokens.accent,
              borderRadius: { topLeft: 4, topRight: 4 },
              borderSkipped: 'bottom',
              maxBarThickness: 18,
            },
          ],
        }}
      />
    </div>
  );
}
