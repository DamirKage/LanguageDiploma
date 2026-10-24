import type { CefrLevel, Recommendation } from '@linguapath/shared';
import { seededRandom } from '../../../lib/text';
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from '../config';
import { nextPathLessons, recommend, type CatalogLesson, type CatalogModule, type LearnerSnapshot, type TopicEvidence } from '../engine';
import { composePlan } from '../plan';

/**
 * Offline simulation of synthetic learners. Each learner has a hidden ("latent")
 * probability of answering each topic correctly. Practice raises it, time without
 * practice lowers it. Strategies only see what the real system sees: answers.
 */

export type Strategy = 'engine' | 'sequential' | 'random';

export interface LearnerProfile {
  name: string;
  description: string;
  /** Initial latent skill per topic; topics not listed start at `defaultSkill`. */
  skill: Record<string, number>;
  defaultSkill: number;
  learnRate: number;
  /** Daily relative loss of skill above the floor when a topic is not practised. */
  forgetRate: number;
  /** Probability of studying on a given day. */
  adherence: number;
  dailyMinutes: number;
}

interface TopicState {
  latent: number;
  answers: Array<{ day: number; correct: boolean; session: number }>;
  lastPracticed: number | null;
  introduced: boolean;
}

interface WordState {
  strength: number; // days until retention falls to ~50 %
  due: number;
  lastSeen: number;
}

const TOPICS = ['greetings', 'to_be', 'numbers', 'family', 'possessive', 'food', 'cases', 'past_events', 'past_tense', 'travel', 'modal_verbs'];

/** A small catalogue shaped like the real A1–A2 path: 3 modules, 8 lessons, 2 topics each. */
export function buildCatalog(): { lessons: CatalogLesson[]; modules: CatalogModule[]; lessonTopics: Record<string, string[]> } {
  const spec: Array<{ id: string; module: string; level: CefrLevel; topics: string[] }> = [
    { id: 'l1', module: 'm1', level: 'A1', topics: ['greetings'] },
    { id: 'l2', module: 'm1', level: 'A1', topics: ['to_be', 'greetings'] },
    { id: 'l3', module: 'm1', level: 'A1', topics: ['numbers', 'to_be'] },
    { id: 'l4', module: 'm2', level: 'A1', topics: ['family', 'possessive'] },
    { id: 'l5', module: 'm2', level: 'A1', topics: ['food', 'cases'] },
    { id: 'l6', module: 'm3', level: 'A2', topics: ['past_events', 'past_tense'] },
    { id: 'l7', module: 'm3', level: 'A2', topics: ['travel', 'modal_verbs'] },
    { id: 'l8', module: 'm3', level: 'A2', topics: ['travel', 'cases'] },
  ];
  const lessons = spec.map((s, i) => ({
    id: s.id,
    title: s.id,
    level: s.level,
    moduleId: s.module,
    pathIndex: i,
    topic: s.topics[0]!,
    exerciseTopics: s.topics,
    estimatedMinutes: 10,
    prerequisites: i > 0 ? [spec[i - 1]!.id] : [],
  }));
  const modules: CatalogModule[] = ['m1', 'm2', 'm3'].map((m) => ({
    id: m,
    title: m,
    level: m === 'm3' ? 'A2' : 'A1',
    lessonIds: spec.filter((s) => s.module === m).map((s) => s.id),
    test: { id: `t-${m}`, title: m, exerciseCount: 8 },
  }));
  return { lessons, modules, lessonTopics: Object.fromEntries(spec.map((s) => [s.id, s.topics])) };
}

const CATALOG = buildCatalog();

export class SimulatedLearner {
  day = 0;
  session = 0;
  topics = new Map<string, TopicState>();
  progress: LearnerSnapshot['progress'] = {};
  testResults: LearnerSnapshot['testResults'] = {};
  words: WordState[] = [];
  lastActive: number | null = null;
  ignoredDays = new Map<string, Set<number>>();
  practicedWeakDays = 0;
  daysWithWeakTopic = 0;
  reviewsDone = 0;
  reviewsRecalled = 0;
  private rand: () => number;

  constructor(
    public profile: LearnerProfile,
    seed: number,
    private catalog = CATALOG,
  ) {
    this.rand = seededRandom(seed);
    for (const t of TOPICS) this.topics.set(t, { latent: profile.skill[t] ?? profile.defaultSkill, answers: [], lastPracticed: null, introduced: false });
  }

  private answer(topic: string, count: number, boost: number) {
    const state = this.topics.get(topic)!;
    state.introduced = true;
    let correct = 0;
    for (let i = 0; i < count; i++) {
      const ok = this.rand() < state.latent;
      if (ok) correct++;
      state.answers.push({ day: this.day, correct: ok, session: this.session });
      // Learning from feedback: mistakes teach slightly more than successes.
      state.latent += this.profile.learnRate * boost * (ok ? 0.6 : 1) * (1 - state.latent);
    }
    state.latent = Math.min(0.98, state.latent);
    state.lastPracticed = this.day;
    return correct / count;
  }

  /** Daily forgetting for every introduced topic not practised today. */
  private forget() {
    for (const state of this.topics.values()) {
      if (!state.introduced || state.lastPracticed === this.day) continue;
      const floor = 0.35;
      state.latent -= this.profile.forgetRate * Math.max(0, state.latent - floor);
    }
  }

  wordRetention(word: WordState): number {
    return Math.pow(0.5, (this.day - word.lastSeen) / word.strength);
  }

  snapshot(now: Date): LearnerSnapshot {
    const dueWords = this.words.filter((w) => w.due <= this.day);
    const overdue = dueWords.filter((w) => w.due < this.day);
    const ignored: Record<string, number> = {};
    for (const [key, days] of this.ignoredDays) ignored[key] = [...days].filter((d) => this.day - d <= 7 && d !== this.day).length;
    return {
      now,
      language: 'sim',
      level: 'A1',
      placementDone: true,
      goals: [],
      dailyMinutes: this.profile.dailyMinutes,
      lessons: this.catalog.lessons,
      modules: this.catalog.modules,
      progress: this.progress,
      inProgress: [],
      testResults: this.testResults,
      topics: [...this.topics.entries()]
        .filter(([, s]) => s.answers.length > 0)
        .map(([topic, s]): TopicEvidence => {
          const bySession = new Map<number, boolean[]>();
          for (const a of s.answers) bySession.set(a.session, [...(bySession.get(a.session) ?? []), a.correct]);
          return {
            topic,
            kind: 'grammar',
            answers: s.answers.length,
            correct: s.answers.filter((a) => a.correct).length,
            recentAnswers: s.answers.slice(-DEFAULT_ENGINE_CONFIG.thresholds.recentWindow).length,
            recentCorrect: s.answers.slice(-DEFAULT_ENGINE_CONFIG.thresholds.recentWindow).filter((a) => a.correct).length,
            lastPracticedAt: s.lastPracticed === null ? null : new Date(+now - (this.day - s.lastPracticed) * 86_400_000),
            sessionAccuracies: [...bySession.values()].filter((v) => v.length >= 2).map((v) => Math.round((v.filter(Boolean).length / v.length) * 100)).slice(-5),
            topCategory: null,
          };
        }),
      srs: {
        due: dueWords.length,
        overdue: overdue.length,
        maxOverdueDays: overdue.reduce((m, w) => Math.max(m, this.day - w.due), 0),
        newAvailable: 0,
        retention30d: this.reviewsDone ? this.reviewsRecalled / this.reviewsDone : null,
        reviews30d: this.reviewsDone,
      },
      lastActiveAt: this.lastActive === null ? null : new Date(+now - (this.day - this.lastActive) * 86_400_000),
      recentAccuracy: this.recentAccuracy(),
      recentAnswers: Math.min(30, [...this.topics.values()].reduce((s, t) => s + t.answers.length, 0)),
      ignored,
    };
  }

  private recentAccuracy(): number | null {
    const all = [...this.topics.values()].flatMap((t) => t.answers).sort((a, b) => a.session - b.session).slice(-30);
    return all.length ? all.filter((a) => a.correct).length / all.length : null;
  }

  /** Executes one recommended activity. Returns the minutes it took. */
  perform(item: Recommendation): number {
    this.session++;
    const lessonTopics = this.catalog.lessonTopics;
    switch (item.type) {
      case 'next_lesson':
      case 'retry_lesson': {
        const id = item.target.lessonId!;
        const scores = lessonTopics[id]!.map((t) => this.answer(t, 4, 1));
        const percent = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100);
        const prev = this.progress[id];
        this.progress[id] = { status: 'completed', bestPercent: Math.max(prev?.bestPercent ?? 0, percent), attempts: (prev?.attempts ?? 0) + 1 };
        if (!prev) for (let i = 0; i < 6; i++) this.words.push({ strength: 1.5, due: this.day + 1, lastSeen: this.day });
        return 10;
      }
      case 'weak_topic':
      case 'topic_refresh':
        this.answer(item.target.topic!, 8, 1.6);
        return 6;
      case 'module_test': {
        const mod = this.catalog.modules.find((m) => m.test?.id === item.target.testId)!;
        const topics = [...new Set(mod.lessonIds.flatMap((l) => lessonTopics[l]!))];
        const score = topics.map((t) => this.answer(t, 2, 0.5)).reduce((a, b) => a + b, 0) / topics.length;
        const percent = Math.round(score * 100);
        const prev = this.testResults[item.target.testId!];
        this.testResults[item.target.testId!] = { bestPercent: Math.max(prev?.bestPercent ?? 0, percent), passed: !!prev?.passed || percent >= 70 };
        return 6;
      }
      case 'review': {
        const due = this.words.filter((w) => w.due <= this.day).slice(0, 20);
        for (const w of due) {
          const recalled = this.rand() < this.wordRetention(w);
          this.reviewsDone++;
          if (recalled) {
            this.reviewsRecalled++;
            w.strength *= 2.3;
          } else w.strength = Math.max(1, w.strength * 0.6);
          w.lastSeen = this.day;
          w.due = this.day + Math.max(1, Math.round(w.strength));
        }
        return Math.max(2, Math.round(due.length * 0.3));
      }
      default:
        return 1;
    }
  }

  endDay(studied: boolean) {
    if (studied) this.lastActive = this.day;
    this.forget();
    this.day++;
  }

  weakestIntroduced(): { topic: string; latent: number } | null {
    const intro = [...this.topics.entries()].filter(([, s]) => s.introduced);
    if (!intro.length) return null;
    const [topic, s] = intro.sort((a, b) => a[1].latent - b[1].latent)[0]!;
    return { topic, latent: s.latent };
  }
}

function sequentialPlan(snapshot: LearnerSnapshot): Recommendation[] {
  const [next] = nextPathLessons(snapshot, 1);
  const mk = (r: Partial<Recommendation> & Pick<Recommendation, 'key' | 'type'>): Recommendation => ({ score: 1, estimatedMinutes: 10, target: {}, reasons: [], features: {}, ...r });
  const items: Recommendation[] = [];
  if (next) items.push(mk({ key: `lesson:${next.id}`, type: 'next_lesson', target: { lessonId: next.id } }));
  const mod = snapshot.modules.find((m) => m.test && m.lessonIds.every((l) => snapshot.progress[l]) && !snapshot.testResults[m.test.id]?.passed);
  if (mod) items.push(mk({ key: `module_test:${mod.test!.id}`, type: 'module_test', target: { testId: mod.test!.id } }));
  return items;
}

function randomPlan(snapshot: LearnerSnapshot, rand: () => number, cfg: EngineConfig): Recommendation[] {
  // The same candidate pool as the engine, but picked at random instead of by score.
  const pool = [...recommend(snapshot, { ...cfg, thresholds: { ...cfg.thresholds, maxItems: 20 } }).items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool;
}

export interface RunMetrics {
  meanSkill: number;
  minSkill: number;
  lessonsCompleted: number;
  weakCoverage: number;
  wordRetention: number;
  reviewsDone: number;
  minutes: number;
  /** Gain in mean latent skill of introduced topics per hour of study, percentage points. */
  gainPerHour: number;
}

export function runSimulation(profile: LearnerProfile, strategy: Strategy, seed: number, days = 30, cfg: EngineConfig = DEFAULT_ENGINE_CONFIG): RunMetrics {
  const learner = new SimulatedLearner(profile, seed);
  const rand = seededRandom(seed * 31 + 7);
  let minutes = 0;
  const start = new Date('2026-01-01T09:00:00Z');
  for (let d = 0; d < days; d++) {
    const now = new Date(+start + d * 86_400_000);
    const weakest = learner.weakestIntroduced();
    const hasWeak = !!weakest && weakest.latent < 0.6;
    if (hasWeak) learner.daysWithWeakTopic++;
    const studies = rand() < profile.adherence;
    if (studies) {
      const snap = learner.snapshot(now);
      const items =
        strategy === 'engine'
          ? composePlan(recommend(snap, cfg), profile.dailyMinutes)
          : strategy === 'sequential'
            ? sequentialPlan(snap)
            : randomPlan(snap, rand, cfg);
      let used = 0;
      let practisedWeak = false;
      for (const item of items) {
        if (used >= profile.dailyMinutes) break;
        if (item.type === 'level_up' || item.type === 'placement' || item.type === 'resume') continue;
        if (weakest && item.target.topic === weakest.topic) practisedWeak = true;
        if (weakest && item.target.lessonId && CATALOG.lessonTopics[item.target.lessonId]?.includes(weakest.topic)) practisedWeak = true;
        used += learner.perform(item);
      }
      minutes += used;
      if (hasWeak && practisedWeak) learner.practicedWeakDays++;
    }
    learner.endDay(studies);
  }
  const introduced = [...learner.topics.values()].filter((t) => t.introduced);
  const skills = introduced.map((t) => t.latent);
  const initial = [...learner.topics.entries()].filter(([, t]) => t.introduced).map(([topic]) => profile.skill[topic] ?? profile.defaultSkill);
  const gain = skills.length ? (skills.reduce((a, b) => a + b, 0) - initial.reduce((a, b) => a + b, 0)) / skills.length : 0;
  return {
    minutes,
    gainPerHour: minutes ? (gain * 100) / (minutes / 60) : 0,
    meanSkill: skills.length ? skills.reduce((a, b) => a + b, 0) / skills.length : 0,
    minSkill: skills.length ? Math.min(...skills) : 0,
    lessonsCompleted: Object.keys(learner.progress).length,
    weakCoverage: learner.daysWithWeakTopic ? learner.practicedWeakDays / learner.daysWithWeakTopic : 1,
    wordRetention: learner.words.length ? learner.words.reduce((s, w) => s + learner.wordRetention(w), 0) / learner.words.length : 0,
    reviewsDone: learner.reviewsDone,
  };
}

export const PROFILES: LearnerProfile[] = [
  {
    name: 'grammar-struggler',
    description: 'Хорошо запоминает лексику, но систематически ошибается в падежах и притяжательных формах',
    skill: { cases: 0.25, possessive: 0.3, past_tense: 0.35 },
    defaultSkill: 0.7,
    learnRate: 0.05,
    forgetRate: 0.04,
    adherence: 0.8,
    dailyMinutes: 20,
  },
  {
    name: 'steady-average',
    description: 'Средний учащийся без выраженных слабых мест, занимается почти каждый день',
    skill: {},
    defaultSkill: 0.6,
    learnRate: 0.06,
    forgetRate: 0.03,
    adherence: 0.9,
    dailyMinutes: 15,
  },
  {
    name: 'strong-fast',
    description: 'Сильный учащийся с высокой начальной точностью',
    skill: {},
    defaultSkill: 0.85,
    learnRate: 0.08,
    forgetRate: 0.02,
    adherence: 0.85,
    dailyMinutes: 20,
  },
  {
    name: 'irregular-forgetful',
    description: 'Занимается нерегулярно и быстро забывает',
    skill: {},
    defaultSkill: 0.55,
    learnRate: 0.05,
    forgetRate: 0.08,
    adherence: 0.45,
    dailyMinutes: 15,
  },
  {
    name: 'short-sessions',
    description: 'Занимается каждый день, но только по 10 минут',
    skill: { to_be: 0.35 },
    defaultSkill: 0.6,
    learnRate: 0.06,
    forgetRate: 0.04,
    adherence: 0.95,
    dailyMinutes: 10,
  },
];
