import {
  CEFR_LEVELS,
  nextLevel,
  type CefrLevel,
  type DifficultyAdjustment,
  type ErrorCategory,
  type LearningGoal,
  type Recommendation,
  type RecommendationReason,
  type RecommendationResult,
  type RecommendationType,
} from '@linguapath/shared';
import { DEFAULT_ENGINE_CONFIG, REVIEW_MINUTES_PER_CARD, type EngineConfig } from './config';

export const ENGINE_VERSION = 'rules-1.4';

export interface CatalogLesson {
  id: string;
  title: string;
  level: CefrLevel;
  moduleId: string;
  /** Position in the recommended path across all levels of the language. */
  pathIndex: number;
  topic: string;
  exerciseTopics: string[];
  estimatedMinutes: number;
  prerequisites: string[];
}

export interface CatalogModule {
  id: string;
  title: string;
  level: CefrLevel;
  lessonIds: string[];
  test: { id: string; title: string; exerciseCount: number } | null;
}

export interface TopicEvidence {
  topic: string;
  kind: 'grammar' | 'vocabulary' | 'communication';
  /** First-attempt answers only; "almost" counts as 0.7 of a correct answer. */
  answers: number;
  correct: number;
  /** The most recent first-attempt answers (up to the configured window). */
  recentAnswers?: number;
  recentCorrect?: number;
  lastPracticedAt: Date | null;
  /** Accuracy (0–100) per learning session on this topic, oldest first. */
  sessionAccuracies: number[];
  topCategory: { category: ErrorCategory; count: number } | null;
}

export interface LearnerSnapshot {
  now: Date;
  language: string;
  level: CefrLevel;
  placementDone: boolean;
  goals: LearningGoal[];
  dailyMinutes: number;
  lessons: CatalogLesson[];
  modules: CatalogModule[];
  progress: Record<
    string,
    {
      status: 'in_progress' | 'completed';
      bestPercent: number | null;
      attempts: number;
      /** When the lesson was first completed; used to notice that new material has been waiting. */
      completedAt?: Date | null;
    }
  >;
  inProgress: Array<{
    attemptId: string;
    kind: 'lesson' | 'test' | 'practice' | 'placement';
    lessonId: string | null;
    testId: string | null;
    title: string;
    topic: string | null;
    answered: number;
    total: number;
    startedAt: Date;
  }>;
  testResults: Record<string, { bestPercent: number; passed: boolean }>;
  topics: TopicEvidence[];
  srs: { due: number; overdue: number; maxOverdueDays: number; newAvailable: number; retention30d: number | null; reviews30d: number };
  lastActiveAt: Date | null;
  /** Accuracy over the most recent first-attempt answers (null without data). */
  recentAccuracy: number | null;
  recentAnswers: number;
  /** How many recent recommendation snapshots showed a key in the top 3 without it being started. */
  ignored: Record<string, number>;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round = (x: number, digits = 3) => Math.round(x * 10 ** digits) / 10 ** digits;
const pct = (x: number) => Math.round(x * 100);
const daysBetween = (a: Date, b: Date) => Math.max(0, Math.floor((+b - +a) / 86_400_000));

export function smoothedAccuracy(t: Pick<TopicEvidence, 'answers' | 'correct'>, cfg: EngineConfig = DEFAULT_ENGINE_CONFIG): number {
  const { priorAccuracy, priorStrength } = cfg.thresholds;
  return (t.correct + priorAccuracy * priorStrength) / (t.answers + priorStrength);
}

/**
 * Current accuracy estimate for a topic: the recent window when it holds enough
 * answers (so improvement is noticed), otherwise all answers; both smoothed.
 */
export function currentAccuracy(t: TopicEvidence, cfg: EngineConfig = DEFAULT_ENGINE_CONFIG): { accuracy: number; answers: number; observed: number } {
  if (t.recentAnswers !== undefined && t.recentCorrect !== undefined && t.recentAnswers >= cfg.thresholds.minEvidence) {
    return {
      accuracy: smoothedAccuracy({ answers: t.recentAnswers, correct: t.recentCorrect }, cfg),
      answers: t.recentAnswers,
      observed: t.recentCorrect / t.recentAnswers,
    };
  }
  return { accuracy: smoothedAccuracy(t, cfg), answers: t.answers, observed: t.answers ? t.correct / t.answers : 0 };
}

/**
 * Mastery estimate that accounts for forgetting: the current accuracy decays
 * towards the configured floor with the configured half-life once the grace
 * period after the last practice is over. Without it a topic answered well a
 * month ago looks exactly as strong as one practised yesterday.
 */
export function estimatedMastery(
  t: TopicEvidence,
  now: Date,
  cfg: EngineConfig = DEFAULT_ENGINE_CONFIG,
): { mastery: number; accuracy: number; observed: number; answers: number; days: number; retention: number } {
  const current = currentAccuracy(t, cfg);
  const days = t.lastPracticedAt ? daysBetween(t.lastPracticedAt, now) : 0;
  const { halfLifeDays, graceDays, floor } = cfg.forgetting;
  const retention = 2 ** (-Math.max(0, days - graceDays) / halfLifeDays);
  const mastery = current.accuracy > floor ? floor + (current.accuracy - floor) * retention : current.accuracy;
  return { ...current, mastery, days, retention };
}

/** Remedial need in [0, 1]: 0 at `needCeiling` and above, growing linearly as mastery falls. */
export function needFor(mastery: number, cfg: EngineConfig = DEFAULT_ENGINE_CONFIG): number {
  return clamp01((cfg.thresholds.needCeiling - mastery) / cfg.thresholds.needRange);
}

export function targetDifficultyFor(accuracy: number | null, cfg: EngineConfig = DEFAULT_ENGINE_CONFIG): 1 | 2 | 3 {
  if (accuracy === null) return 2;
  if (accuracy < cfg.thresholds.lowAccuracy) return 1;
  if (accuracy > cfg.thresholds.highAccuracy) return 3;
  return 2;
}

interface Candidate {
  key: string;
  type: RecommendationType;
  features: Partial<Record<keyof EngineConfig['weights'], number>>;
  reasons: RecommendationReason[];
  estimatedMinutes: number;
  target: Recommendation['target'];
}

function goalMatch(topic: string, kind: TopicEvidence['kind'] | undefined, goals: LearningGoal[], cfg: EngineConfig): LearningGoal | null {
  for (const goal of goals) {
    const rule = cfg.goalTopics[goal];
    if (rule.topics?.includes(topic)) return goal;
    if (kind && rule.kinds?.includes(kind)) return goal;
  }
  return null;
}

function scoreCandidate(c: Candidate, s: LearnerSnapshot, cfg: EngineConfig): Recommendation {
  const w = cfg.weights;
  const f = c.features;
  const ignored = s.ignored[c.key] ?? 0;
  const fatigue = Math.min(3, ignored) * w.fatigue;
  const score =
    cfg.prior[c.type] +
    w.need * (f.need ?? 0) +
    w.urgency * (f.urgency ?? 0) +
    w.progress * (f.progress ?? 0) +
    w.momentum * (f.momentum ?? 0) +
    w.trend * (f.trend ?? 0) +
    w.goal * (f.goal ?? 0) -
    fatigue;
  const features: Record<string, number> = {};
  for (const [k, v] of Object.entries(f)) features[k] = round(v ?? 0);
  if (ignored) features.ignored = ignored;
  return {
    key: c.key,
    type: c.type,
    score: round(score),
    estimatedMinutes: Math.max(1, Math.round(c.estimatedMinutes)),
    target: c.target,
    reasons: c.reasons,
    features,
  };
}

function isLessonDone(s: LearnerSnapshot, id: string) {
  return s.progress[id]?.status === 'completed';
}

/** Lessons below the learner's placement level count as satisfied prerequisites. */
function prerequisitesMet(s: LearnerSnapshot, lesson: CatalogLesson, byId: Map<string, CatalogLesson>) {
  const levelIdx = CEFR_LEVELS.indexOf(s.level);
  return lesson.prerequisites.every((p) => {
    const pre = byId.get(p);
    if (!pre) return true;
    return isLessonDone(s, p) || CEFR_LEVELS.indexOf(pre.level) < levelIdx;
  });
}

export function nextPathLessons(s: LearnerSnapshot, count: number): CatalogLesson[] {
  const levelIdx = CEFR_LEVELS.indexOf(s.level);
  const ordered = [...s.lessons].sort((a, b) => a.pathIndex - b.pathIndex);
  const pending = ordered.filter((l) => !isLessonDone(s, l.id));
  const atLevel = pending.filter((l) => CEFR_LEVELS.indexOf(l.level) >= levelIdx);
  return (atLevel.length ? atLevel : pending).slice(0, count);
}

/**
 * Deterministic, rule-based recommender. It is a pure function of the snapshot,
 * so it can be unit-tested, simulated offline and replaced by a learned model
 * that implements the same signature.
 */
export function recommend(s: LearnerSnapshot, cfg: EngineConfig = DEFAULT_ENGINE_CONFIG): RecommendationResult {
  const t = cfg.thresholds;
  const candidates: Candidate[] = [];
  const lessonById = new Map(s.lessons.map((l) => [l.id, l]));
  const topicKinds = new Map(s.topics.map((x) => [x.topic, x.kind]));
  const daysAway = s.lastActiveAt ? daysBetween(s.lastActiveAt, s.now) : null;
  const returning = daysAway !== null && daysAway >= t.returningAfterDays;
  const anyProgress = Object.keys(s.progress).length > 0;

  const targetDifficulty = targetDifficultyFor(s.recentAnswers >= 10 ? s.recentAccuracy : null, cfg);
  let difficultyAdjustment: DifficultyAdjustment = 'same';
  let difficultyReason: RecommendationReason | undefined;
  if (s.recentAnswers >= 10 && s.recentAccuracy !== null) {
    if (targetDifficulty === 3) {
      difficultyAdjustment = 'harder';
      difficultyReason = { code: 'high_recent_accuracy', params: { accuracy: pct(s.recentAccuracy) } };
    } else if (targetDifficulty === 1) {
      difficultyAdjustment = 'easier';
      difficultyReason = { code: 'low_recent_accuracy', params: { accuracy: pct(s.recentAccuracy) } };
    }
  }

  if (!s.placementDone && !anyProgress) {
    candidates.push({
      key: 'placement',
      type: 'placement',
      features: { progress: 1 },
      reasons: [{ code: 'no_placement' }],
      estimatedMinutes: 8,
      target: {},
    });
  }

  for (const a of s.inProgress) {
    if (a.kind === 'placement') continue;
    const ageDays = daysBetween(a.startedAt, s.now);
    const freshness = clamp01(1 - ageDays / 14);
    const completion = a.total ? a.answered / a.total : 0;
    if (freshness === 0 || a.answered === 0) continue;
    const lesson = a.lessonId ? lessonById.get(a.lessonId) : undefined;
    candidates.push({
      key: `resume:${a.attemptId}`,
      type: 'resume',
      features: { momentum: (0.5 + 0.5 * completion) * freshness },
      reasons: [{ code: 'resume_attempt', params: { answered: a.answered, total: a.total } }],
      estimatedMinutes: Math.max(2, (lesson?.estimatedMinutes ?? 8) * (1 - completion)),
      target: { attemptId: a.attemptId, lessonId: a.lessonId ?? undefined, lessonTitle: a.title, testId: a.testId ?? undefined, topic: a.topic ?? undefined },
    });
  }

  const srs = s.srs;
  const reviewLoad = srs.due + Math.min(srs.newAvailable, 15);
  if (reviewLoad > 0) {
    const reasons: RecommendationReason[] = [{ code: 'reviews_due', params: { count: reviewLoad } }];
    if (srs.overdue > 0) reasons.push({ code: 'reviews_overdue', params: { count: srs.overdue, days: srs.maxOverdueDays } });
    const lowRetention = srs.retention30d !== null && srs.reviews30d >= 10 && srs.retention30d < 0.8;
    if (lowRetention) reasons.push({ code: 'low_retention', params: { retention: pct(srs.retention30d!) } });
    if (returning) reasons.push({ code: 'returning_after_break', params: { days: daysAway! } });
    candidates.push({
      key: 'review',
      type: 'review',
      features: {
        urgency: clamp01(0.5 * Math.min(1, reviewLoad / 20) + 0.3 * Math.min(1, srs.maxOverdueDays / 7) + (returning ? 0.2 : 0)),
        need: lowRetention ? clamp01((0.9 - srs.retention30d!) / 0.4) : 0,
      },
      reasons,
      estimatedMinutes: Math.max(2, Math.min(reviewLoad, 20) * REVIEW_MINUTES_PER_CARD),
      target: { reviewCount: Math.min(reviewLoad, 20) },
    });
  }

  /** Need of the weakest topic with low or declining accuracy; gates new material. */
  let maxWeakNeed = 0;
  let weakTopics = 0;
  const weakNeedByTopic = new Map<string, number>();
  for (const topic of s.topics) {
    if (topic.answers < t.minEvidence) continue;
    const est = estimatedMastery(topic, s.now, cfg);
    const goal = goalMatch(topic.topic, topic.kind, s.goals, cfg);
    const sessions = topic.sessionAccuracies;
    const last = sessions.at(-1);
    const prevAvg = sessions.length >= 2 ? sessions.slice(0, -1).slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, sessions.length - 1) : null;
    const declining = last !== undefined && prevAvg !== null && prevAvg - last >= t.trendDrop;
    const days = est.days;
    const lowAccuracy = est.accuracy < t.weakAccuracy;
    const need = needFor(est.mastery, cfg);

    if (lowAccuracy || declining) {
      const reasons: RecommendationReason[] = [];
      if (lowAccuracy) {
        weakTopics++;
        reasons.push({ code: 'low_topic_accuracy', params: { topic: topic.topic, accuracy: pct(est.observed), answers: est.answers } });
      }
      if (declining) reasons.push({ code: 'declining_trend', params: { topic: topic.topic, from: Math.round(prevAvg!), to: Math.round(last!) } });
      if (days >= t.refreshAfterDays) reasons.push({ code: 'not_practiced_recently', params: { topic: topic.topic, days } });
      if (topic.topCategory && topic.topCategory.count >= 3) {
        reasons.push({ code: 'recurring_error', params: { category: topic.topCategory.category, count: topic.topCategory.count } });
      }
      if (goal) reasons.push({ code: 'goal_match', params: { goal } });
      // A declining topic with acceptable accuracy still needs some consolidation.
      const weakNeed = Math.max(need, declining ? 0.3 : 0);
      maxWeakNeed = Math.max(maxWeakNeed, weakNeed);
      weakNeedByTopic.set(topic.topic, weakNeed);
      candidates.push({
        key: `weak_topic:${topic.topic}`,
        type: 'weak_topic',
        features: {
          need: weakNeed,
          trend: declining ? 1 : 0,
          urgency: clamp01(days / 14) * 0.5,
          goal: goal ? 1 : 0,
        },
        reasons,
        estimatedMinutes: 6,
        target: { topic: topic.topic },
      });
    } else if (est.mastery < t.weakAccuracy || days >= t.refreshAfterDays) {
      // Accuracy was fine when last measured, but enough time has passed that it has probably faded.
      const reasons: RecommendationReason[] = [{ code: 'not_practiced_recently', params: { topic: topic.topic, days } }];
      if (goal) reasons.push({ code: 'goal_match', params: { goal } });
      candidates.push({
        key: `topic_refresh:${topic.topic}`,
        type: 'topic_refresh',
        features: { need, urgency: 0.5 * (1 - est.retention), goal: goal ? 1 : 0 },
        reasons,
        estimatedMinutes: 5,
        target: { topic: topic.topic },
      });
    }
  }

  const resumeLessons = new Set(s.inProgress.map((a) => a.lessonId).filter(Boolean));
  const [next] = nextPathLessons(s, 1);
  if (next && !resumeLessons.has(next.id)) {
    let progress = 1;
    const reasons: RecommendationReason[] = [{ code: 'next_in_path', params: { level: next.level } }];
    if (next.prerequisites.length && prerequisitesMet(s, next, lessonById)) reasons.push({ code: 'prerequisites_met' });
    if (difficultyAdjustment === 'harder') {
      progress = 1.2;
      reasons.push(difficultyReason!);
    }
    // Mastery gating: the weaker the weakest topic, the more new material waits for consolidation.
    progress *= 1 - cfg.remedialGate * maxWeakNeed;
    if (difficultyAdjustment === 'easier' && weakTopics > 0) progress = Math.min(progress, 0.55);
    if (returning) progress *= 0.8;
    // Progression pressure: the longer no new lesson has been completed, the harder the
    // next one pushes back against remedial work, so consolidation cannot stall the path.
    const lastNew = Object.values(s.progress).reduce<number | null>(
      (m, p) => (p.status === 'completed' && p.completedAt ? Math.max(m ?? 0, +p.completedAt) : m),
      null,
    );
    const daysSinceNew = lastNew === null ? null : daysBetween(new Date(lastNew), s.now);
    const { graceDays, fullDays } = cfg.progression;
    const pressure = daysSinceNew === null ? 0 : clamp01((daysSinceNew - graceDays) / Math.max(1, fullDays - graceDays));
    const goal = goalMatch(next.topic, topicKinds.get(next.topic), s.goals, cfg);
    if (goal) reasons.push({ code: 'goal_match', params: { goal } });
    if (next.estimatedMinutes <= s.dailyMinutes) reasons.push({ code: 'fits_time', params: { minutes: next.estimatedMinutes } });
    candidates.push({
      key: `lesson:${next.id}`,
      type: 'next_lesson',
      features: { progress, urgency: 0.5 * pressure, goal: goal ? 1 : 0 },
      reasons,
      estimatedMinutes: next.estimatedMinutes,
      target: { lessonId: next.id, lessonTitle: next.title, level: next.level },
    });
  }

  const retry = s.lessons
    .filter((l) => isLessonDone(s, l.id) && (s.progress[l.id]?.bestPercent ?? 100) < t.retryLessonBelow && !resumeLessons.has(l.id))
    .sort((a, b) => (s.progress[a.id]!.bestPercent ?? 0) - (s.progress[b.id]!.bestPercent ?? 0));
  for (const lesson of retry.slice(0, 2)) {
    const best = s.progress[lesson.id]!.bestPercent ?? 0;
    candidates.push({
      key: `retry:${lesson.id}`,
      type: 'retry_lesson',
      features: { need: clamp01((t.retryLessonBelow - best) / 50 + 0.2) },
      reasons: [{ code: 'low_lesson_score', params: { percent: best } }],
      estimatedMinutes: lesson.estimatedMinutes,
      target: { lessonId: lesson.id, lessonTitle: lesson.title, level: lesson.level },
    });
  }

  for (const mod of s.modules) {
    if (!mod.test || mod.lessonIds.length === 0) continue;
    if (!mod.lessonIds.every((id) => isLessonDone(s, id))) continue;
    const result = s.testResults[mod.test.id];
    if (result?.passed) continue;
    // The test checks the module's topics, so it waits while one of them is clearly weak.
    const moduleTopics = mod.lessonIds.flatMap((id) => lessonById.get(id)?.exerciseTopics ?? []);
    const gate = 1 - cfg.remedialGate * Math.max(0, ...moduleTopics.map((x) => weakNeedByTopic.get(x) ?? 0));
    candidates.push({
      key: `module_test:${mod.test.id}`,
      type: 'module_test',
      features: { progress: 0.8 * gate, need: result ? 0.3 * gate : 0 },
      reasons: [{ code: 'module_ready', params: { lessons: mod.lessonIds.length } }],
      estimatedMinutes: Math.max(4, mod.test.exerciseCount * 0.8),
      target: { testId: mod.test.id, moduleTitle: mod.title, level: mod.level },
    });
  }

  const levelLessons = s.lessons.filter((l) => l.level === s.level);
  const levelModules = s.modules.filter((m) => m.level === s.level);
  const following = nextLevel(s.level);
  if (
    following &&
    levelLessons.length > 0 &&
    levelLessons.every((l) => isLessonDone(s, l.id)) &&
    levelModules.every((m) => !m.test || s.testResults[m.test.id]?.passed) &&
    s.lessons.some((l) => l.level === following)
  ) {
    candidates.push({
      key: `level_up:${following}`,
      type: 'level_up',
      features: { progress: 1 },
      reasons: [{ code: 'level_complete', params: { level: s.level, next: following } }],
      estimatedMinutes: 1,
      target: { level: following },
    });
  }

  const ranked = candidates.map((c) => scoreCandidate(c, s, cfg)).sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  const perType = new Map<RecommendationType, number>();
  const items: Recommendation[] = [];
  for (const r of ranked) {
    const limit = cfg.perTypeLimit[r.type] ?? 1;
    const used = perType.get(r.type) ?? 0;
    if (used >= limit) continue;
    perType.set(r.type, used + 1);
    items.push(r);
    if (items.length >= t.maxItems) break;
  }

  return {
    engineVersion: ENGINE_VERSION,
    generatedAt: s.now.toISOString(),
    language: s.language,
    targetDifficulty,
    difficultyAdjustment,
    difficultyReason,
    items,
  };
}
