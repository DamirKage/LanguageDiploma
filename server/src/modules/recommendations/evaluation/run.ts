import fs from 'node:fs';
import path from 'node:path';
import { ENGINE_VERSION } from '../engine';
import { PROFILES, runSimulation, type RunMetrics, type Strategy } from './simulator';

/**
 * Usage: npm run evaluate [-- --seeds 50 --days 30 --out ../docs/evaluation-results.md]
 * Compares the recommendation engine with two baselines on synthetic learners.
 */
const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1]! : fallback;
};
const SEEDS = Number(arg('seeds', '50'));
const DAYS = Number(arg('days', '30'));
const OUT = arg('out', path.resolve(process.cwd(), '../docs/evaluation-results.md'));
const STRATEGIES: Strategy[] = ['engine', 'sequential', 'random'];

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, xs.length - 1));
};
const fmt = (xs: number[], pct = true) => (pct ? `${(mean(xs) * 100).toFixed(1)} ± ${(sd(xs) * 100).toFixed(1)}` : `${mean(xs).toFixed(1)} ± ${sd(xs).toFixed(1)}`);

const lines: string[] = [];
lines.push(`# Результаты офлайн-оценки рекомендательного алгоритма`);
lines.push('');
lines.push(`Сгенерировано скриптом \`npm run evaluate\`. Версия движка: \`${ENGINE_VERSION}\`. Прогонов на профиль и стратегию: ${SEEDS}, длительность: ${DAYS} дней.`);
lines.push('');
lines.push('Данные синтетические: «скрытое» умение учащегося задаётся моделью, а не измеряется у людей. Результаты показывают поведение алгоритма в контролируемых условиях и не являются доказательством эффективности обучения.');
lines.push('');
lines.push('Метрики (среднее ± стандартное отклонение):');
lines.push('- **Среднее умение** — среднее скрытое умение по изученным темам в конце периода, %.');
lines.push('- **Мин. умение** — скрытое умение самой слабой изученной темы, %.');
lines.push('- **Покрытие слабых мест** — доля дней с занятиями, когда при наличии слабой темы (умение < 60%) в плане было занятие по ней, %.');
lines.push('- **Удержание слов** — средняя вероятность вспомнить слово в последний день, %.');
lines.push('- **Уроков** — число пройденных уроков из 8.');
lines.push('- **Минут** — суммарное время занятий; стратегии по-разному используют дневной бюджет времени.');
lines.push('- **Прирост в час** — рост среднего скрытого умения (п. п.) на час занятий; сравнивает эффективность при разном объёме.');
lines.push('');

const summary: Record<string, Record<Strategy, RunMetrics[]>> = {};
for (const profile of PROFILES) {
  summary[profile.name] = { engine: [], sequential: [], random: [] };
  for (const strategy of STRATEGIES) {
    for (let seed = 1; seed <= SEEDS; seed++) summary[profile.name]![strategy].push(runSimulation(profile, strategy, seed, DAYS));
  }
  lines.push(`## Профиль «${profile.name}»`);
  lines.push('');
  lines.push(`${profile.description}. Занятий в неделю ≈ ${(profile.adherence * 7).toFixed(1)}, ${profile.dailyMinutes} мин в день.`);
  lines.push('');
  lines.push('| Стратегия | Среднее умение | Мин. умение | Покрытие слабых мест | Удержание слов | Уроков | Минут | Прирост в час |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const strategy of STRATEGIES) {
    const runs = summary[profile.name]![strategy];
    lines.push(
      `| ${strategy} | ${fmt(runs.map((r) => r.meanSkill))} | ${fmt(runs.map((r) => r.minSkill))} | ${fmt(runs.map((r) => r.weakCoverage))} | ${fmt(runs.map((r) => r.wordRetention))} | ${fmt(runs.map((r) => r.lessonsCompleted), false)} | ${fmt(runs.map((r) => r.minutes), false)} | ${fmt(runs.map((r) => r.gainPerHour), false)} |`,
    );
  }
  lines.push('');
}

const engineDeterministic = PROFILES.every((p) => JSON.stringify(runSimulation(p, 'engine', 1, DAYS)) === JSON.stringify(runSimulation(p, 'engine', 1, DAYS)));
lines.push(`Детерминированность: повторный прогон с тем же зерном даёт ${engineDeterministic ? 'идентичный' : 'отличающийся'} результат.`);
lines.push('');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, lines.join('\n') + '\n');
console.log(lines.join('\n'));
console.log(`\nSaved to ${OUT}`);
