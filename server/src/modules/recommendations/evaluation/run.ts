import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_ENGINE_CONFIG as D, type EngineConfig } from '../config';
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
lines.push('- **Покрытие слабых мест** — доля дней с занятиями, на которые приходилась слабая тема (самая слабая изученная тема с умением < 60%), когда в выполненной части плана было занятие по этой теме (практика темы или урок, в котором она есть), %. Дни без занятий в знаменатель не входят.');
lines.push('- **Удержание слов** — средняя вероятность вспомнить слово в последний день, %.');
lines.push('- **Уроков** — число пройденных уроков из 8.');
lines.push('- **Минут** — суммарное время занятий за 30 дней. Все стратегии ограничены одним и тем же дневным бюджетом: занятие, которое не помещается в оставшееся время, пропускается (первое учебное занятие дня допускается всегда) — то же правило, что и в `composePlan`.');
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

const ROW_HEAD = '| Вариант | Мин. умение | Покрытие слабых мест | Среднее умение | Удержание слов | Уроков | Минут |';
const row = (label: string, runs: RunMetrics[]) =>
  `| ${label} | ${fmt(runs.map((r) => r.minSkill))} | ${fmt(runs.map((r) => r.weakCoverage))} | ${fmt(runs.map((r) => r.meanSkill))} | ${fmt(runs.map((r) => r.wordRetention))} | ${fmt(runs.map((r) => r.lessonsCompleted), false)} | ${fmt(runs.map((r) => r.minutes), false)} |`;
const WEAK_PROFILES = PROFILES.filter((p) => p.name !== 'strong-fast');

lines.push('## Сравнение при прежнем правиле бюджета');
lines.push('');
lines.push(
  'До версии rules-1.4 симулятор выполнял занятия, пока бюджет не исчерпан, поэтому последнее занятие могло выйти за него. Движок сам укладывает план в бюджет, а случайная стратегия — нет, и получала больше времени. Для прозрачности ниже те же стратегии при прежнем («мягком») правиле.',
);
lines.push('');
for (const profile of WEAK_PROFILES) {
  lines.push(`### ${profile.name}`);
  lines.push('');
  lines.push(ROW_HEAD);
  lines.push('|---|---|---|---|---|---|---|');
  for (const strategy of STRATEGIES) {
    lines.push(row(strategy, Array.from({ length: SEEDS }, (_, i) => runSimulation(profile, strategy, i + 1, DAYS, D, 'loose'))));
  }
  lines.push('');
}

const ablations: Array<[string, EngineConfig]> = [
  ['rules-1.4 (по умолчанию)', D],
  ['без модели забывания', { ...D, forgetting: { ...D.forgetting, halfLifeDays: 1e9 } }],
  ['без порога освоения (remedialGate = 0)', { ...D, remedialGate: 0 }],
  ['без давления прогресса', { ...D, progression: { graceDays: 1e9, fullDays: 1e9 + 1 } }],
  ['период полураспада 14 дней', { ...D, forgetting: { ...D.forgetting, halfLifeDays: 14 } }],
];
lines.push('## Вклад отдельных правил (абляция)');
lines.push('');
lines.push('Движок с одним выключенным или изменённым правилом; остальные параметры по умолчанию.');
lines.push('');
for (const profile of WEAK_PROFILES) {
  lines.push(`### ${profile.name}`);
  lines.push('');
  lines.push(ROW_HEAD);
  lines.push('|---|---|---|---|---|---|---|');
  for (const [label, cfg] of ablations) lines.push(row(label, Array.from({ length: SEEDS }, (_, i) => runSimulation(profile, 'engine', i + 1, DAYS, cfg))));
  lines.push('');
}

const engineDeterministic = PROFILES.every((p) => JSON.stringify(runSimulation(p, 'engine', 1, DAYS)) === JSON.stringify(runSimulation(p, 'engine', 1, DAYS)));
lines.push(`Детерминированность: повторный прогон с тем же зерном даёт ${engineDeterministic ? 'идентичный' : 'отличающийся'} результат.`);
lines.push('');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, lines.join('\n') + '\n');
console.log(lines.join('\n'));
console.log(`\nSaved to ${OUT}`);
