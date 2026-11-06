/**
 * Load test: virtual learners go through the real learning flow over HTTP.
 *
 *   node tools/load/scenario.mjs --url http://localhost:4000 --users 200 --duration 60 --think 0
 *
 * Each virtual learner registers, enrols, skips placement, then repeats a session: open "Today" (plan),
 * the course path, start the next lesson, answer every task, finish it, look at recommendations, the review
 * queue and the progress overview. `--think` is a pause in seconds between requests (0 = as fast as possible,
 * which measures the server's capacity; 3–8 s is close to a real person). The rate limiter of the server under
 * test should be switched off (RATE_LIMIT_ENABLED=false), otherwise it rightly refuses a flood from one IP.
 */
import { performance } from 'node:perf_hooks';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const URL_BASE = args.url ?? 'http://localhost:4000';
const USERS = Number(args.users ?? 100);
const DURATION = Number(args.duration ?? 60) * 1000;
const THINK = Number(args.think ?? 0) * 1000;
const LANGS = (args.langs ?? 'de,en,es,tr,kk').split(',');
const RUN = Date.now().toString(36);

const stats = new Map();
let errors = 0;
const errorSamples = new Map();

function record(label, ms, ok, detail) {
  let s = stats.get(label);
  if (!s) stats.set(label, (s = []));
  s.push(ms);
  if (!ok) {
    errors++;
    const key = `${label}: ${detail}`;
    errorSamples.set(key, (errorSamples.get(key) ?? 0) + 1);
  }
}

async function call(label, method, path, token, body) {
  const t = performance.now();
  let res;
  try {
    res = await fetch(URL_BASE + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    record(label, performance.now() - t, false, err.cause?.code ?? err.message);
    return null;
  }
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  record(label, performance.now() - t, res.ok, res.status);
  return res.ok ? json : null;
}

const sleep = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms * (0.5 + Math.random()))) : Promise.resolve());

/** Some answer of the right shape; correctness does not matter for load. */
function answerFor(ex) {
  const first = (list) => list?.[0] ?? '';
  switch (ex.type) {
    case 'choice':
    case 'dialogue':
      return { type: ex.type, option: first(ex.options) };
    case 'fill_blank':
      return { type: 'fill_blank', text: ex.options ? first(ex.options) : 'test' };
    case 'translate':
      return { type: 'translate', text: 'test answer' };
    case 'order':
      return { type: 'order', tokens: ex.tiles };
    case 'listen':
      return { type: 'listen', text: ex.options ? first(ex.options) : 'test' };
    case 'speak':
      return { type: 'speak', transcript: '', skipped: true };
    case 'error_spot':
      return { type: 'error_spot', index: 0 };
    case 'cloze_text':
      return { type: 'cloze_text', choices: ex.gaps.map((g) => first(g.options)) };
    case 'chat':
      return { type: 'chat', replies: ex.turns.map((t) => first(t.options)) };
    case 'categorize':
      return { type: 'categorize', placement: ex.items.map((text) => ({ text, category: 0 })) };
    case 'reading':
      return { type: 'reading', choices: ex.questions.map((q) => first(q.options)) };
    case 'writing':
      return { type: 'writing', text: 'Das ist ein kurzer Text für den Lasttest mit einigen Wörtern.' };
    default:
      return { type: ex.type, text: 'test' };
  }
}

async function setupLearner(i) {
  const language = LANGS[i % LANGS.length];
  const auth = await call('auth/register', 'POST', '/api/auth/register', null, {
    email: `load-${RUN}-${i}@example.com`,
    password: 'LoadTest2026',
    name: `Нагрузка ${i}`,
  });
  if (!auth) return null;
  const token = auth.accessToken;
  await call('me/enroll', 'POST', '/api/me/enrollments', token, { language });
  await call('placement/skip', 'POST', `/api/placement/${language}/skip`, token, { level: 'A1' });
  return { token, language };
}

async function session(learner, until) {
  const { token, language } = learner;
  const plan = await call('GET plan (Сегодня)', 'GET', `/api/me/plan/${language}`, token);
  await sleep(THINK);
  const path = await call('GET path (Программа)', 'GET', `/api/languages/${language}/path`, token);
  await sleep(THINK);
  const lessons = path?.levels?.flatMap((l) => l.modules.flatMap((m) => m.lessons)) ?? [];
  const planned = plan?.items?.find((it) => it.type === 'next_lesson')?.target?.lessonId;
  const lesson = planned ?? lessons.find((l) => l.status !== 'completed')?.id ?? lessons[0]?.id;
  if (!lesson) return;
  await call('GET lesson (теория)', 'GET', `/api/lessons/${lesson}`, token);
  await sleep(THINK);
  let state = await call('POST start lesson', 'POST', `/api/lessons/${lesson}/attempts`, token, {});
  while (state?.current && Date.now() < until) {
    await sleep(THINK);
    const res = await call('POST answer', 'POST', `/api/attempts/${state.id}/answers`, token, {
      itemIndex: state.position,
      answer: answerFor(state.current),
      timeMs: 4000,
    });
    state = res?.state;
  }
  if (state && !state.current) {
    await call('POST complete lesson', 'POST', `/api/attempts/${state.id}/complete`, token);
    await sleep(THINK);
    await call('GET recommendations', 'GET', `/api/me/recommendations/${language}`, token);
    await call('GET review queue', 'GET', `/api/reviews/${language}/queue`, token);
    await call('GET analytics overview', 'GET', `/api/me/analytics/${language}/overview`, token);
  }
}

function pct(sorted, p) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0;
}

async function main() {
  console.log(`Сервер ${URL_BASE}: ${USERS} виртуальных учеников, ${DURATION / 1000} с, пауза ${THINK / 1000} с`);
  const learners = [];
  for (let i = 0; i < USERS; i += 20) {
    const batch = await Promise.all(Array.from({ length: Math.min(20, USERS - i) }, (_, k) => setupLearner(i + k)));
    learners.push(...batch.filter(Boolean));
  }
  const setup = new Map(stats);
  stats.clear();
  const setupErrors = errors;
  errors = 0;
  errorSamples.clear();

  const started = Date.now();
  const until = started + DURATION;
  await Promise.all(
    learners.map(async (l) => {
      // People do not all click at the same second: starts are spread over a few think pauses.
      await new Promise((r) => setTimeout(r, Math.random() * Math.max(2000, THINK * 4)));
      while (Date.now() < until) await session(l, until);
    }),
  );
  const seconds = (Date.now() - started) / 1000;

  const rows = [...stats.entries()].map(([label, list]) => {
    const s = [...list].sort((a, b) => a - b);
    return { label, n: s.length, p50: pct(s, 50), p95: pct(s, 95), p99: pct(s, 99), max: s.at(-1) };
  });
  const all = [...stats.values()].flat().sort((a, b) => a - b);
  const reg = [...(setup.get('auth/register') ?? [])].sort((a, b) => a - b);
  const result = {
    users: learners.length,
    seconds: Math.round(seconds),
    think: THINK / 1000,
    requests: all.length,
    rps: Math.round(all.length / seconds),
    p50: Math.round(pct(all, 50)),
    p95: Math.round(pct(all, 95)),
    p99: Math.round(pct(all, 99)),
    errors,
    errorRate: all.length ? +(errors / all.length * 100).toFixed(2) : 0,
    registerP95: Math.round(pct(reg, 95)),
    setupErrors,
    rows: rows.map((r) => ({ ...r, p50: Math.round(r.p50), p95: Math.round(r.p95), p99: Math.round(r.p99), max: Math.round(r.max) })),
    errorSamples: Object.fromEntries(errorSamples),
  };
  console.table(result.rows);
  console.log(`Запросов: ${result.requests}, ${result.rps} в секунду; задержка p50 ${result.p50} мс, p95 ${result.p95} мс, p99 ${result.p99} мс; ошибок ${result.errors} (${result.errorRate}%)`);
  if (errors) console.log(result.errorSamples);
  if (args.json) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(args.json, JSON.stringify(result, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
