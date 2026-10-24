import { Types } from 'mongoose';
import {
  CEFR_LEVELS,
  LESSON_PASS_PERCENT,
  POINTS,
  localize,
  type AnswerResultDTO,
  type AttemptKind,
  type AttemptStateDTO,
  type AttemptSummaryDTO,
  type CefrLevel,
  type ErrorCategory,
  type Exercise,
  type ExerciseAnswer,
  type LocalizedText,
} from '@linguapath/shared';
import { AppError, errors } from '../../lib/errors';
import { Lesson, Test, Topic } from '../../models/content';
import { AnswerEvent, Attempt, LessonProgress, type AttemptDocument } from '../../models/learning';
import { Enrollment, User } from '../../models/user';
import { introduceWords } from '../srs/service';
import { targetDifficultyFor } from '../recommendations/engine';
import { checkAnswer, expectedAnswer, promptText } from './checker';
import { toPublicExercise } from './presenter';
import { serverText } from './texts';

type AttemptDoc = AttemptDocument;
type Item = AttemptDoc['items'][number];

const MAX_RETRIES_PER_ATTEMPT = 4;
const MAX_ITEM_TIME_MS = 120_000;
const PRACTICE_SIZE = 8;
/** Placement: a level block counts as passed at this share of correct answers. */
const PLACEMENT_BLOCK_PASS = 2 / 3;

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

function makeItem(exercise: Exercise, extra: Partial<{ sourceLesson: Types.ObjectId | null; level: CefrLevel | null; isRetry: boolean }> = {}) {
  return { exercise, seed: randomSeed(), sourceLesson: extra.sourceLesson ?? null, level: extra.level ?? null, isRetry: extra.isRetry ?? false };
}

async function loadOwnAttempt(userId: string, attemptId: string): Promise<AttemptDoc> {
  if (!Types.ObjectId.isValid(attemptId)) throw errors.notFound();
  const attempt = await Attempt.findById(attemptId);
  // Not distinguishing "foreign" from "missing" avoids leaking which attempts exist.
  if (!attempt || String(attempt.user) !== userId) throw errors.notFound();
  return attempt;
}

async function ensureEnrollment(userId: string, language: string) {
  const enrollment = await Enrollment.findOne({ user: userId, language });
  if (!enrollment) throw errors.badRequest('not_enrolled');
  return enrollment;
}

export function toState(attempt: AttemptDoc, locale = 'ru'): AttemptStateDTO {
  const items = attempt.items;
  const current = attempt.status === 'in_progress' ? items[attempt.position] : undefined;
  return {
    id: String(attempt._id),
    kind: attempt.kind as AttemptKind,
    title: localize(attempt.title as LocalizedText, locale),
    language: attempt.language,
    level: (attempt.level as CefrLevel | null) ?? null,
    status: attempt.status as AttemptStateDTO['status'],
    feedbackMode: attempt.feedbackMode as AttemptStateDTO['feedbackMode'],
    position: attempt.position,
    total: items.length,
    answered: items.filter((i) => i.verdict).length,
    current: current
      ? { ...toPublicExercise(current.exercise as Exercise, current.seed, locale), itemIndex: attempt.position, isRetry: current.isRetry }
      : null,
    lessonId: attempt.lesson ? String(attempt.lesson) : null,
  };
}

export async function startLessonAttempt(userId: string, lessonId: string, recommendationKey?: string, now = new Date()) {
  const lesson = await Lesson.findOne({ _id: lessonId, isPublished: true }).lean();
  if (!lesson) throw errors.notFound();
  await ensureEnrollment(userId, lesson.language);
  const existing = await Attempt.findOne({ user: userId, kind: 'lesson', lesson: lesson._id, status: 'in_progress' });
  if (existing) return existing;
  const exercises = lesson.exercises as Exercise[];
  if (exercises.length === 0) throw errors.badRequest('no_exercises');
  const attempt = await Attempt.create({
    user: userId,
    kind: 'lesson',
    language: lesson.language,
    level: lesson.level,
    lesson: lesson._id,
    title: lesson.title,
    feedbackMode: 'immediate',
    items: exercises.map((ex) => makeItem(ex, { sourceLesson: lesson._id })),
    recommendationKey: recommendationKey ?? null,
    startedAt: now,
  });
  await LessonProgress.updateOne(
    { user: userId, lesson: lesson._id },
    { $setOnInsert: { language: lesson.language, status: 'in_progress' }, $set: { lastAttemptAt: now } },
    { upsert: true },
  );
  return attempt;
}

export async function startTestAttempt(userId: string, testId: string, recommendationKey?: string, now = new Date()) {
  const test = await Test.findOne({ _id: testId, isPublished: true, kind: { $ne: 'placement' } }).lean();
  if (!test) throw errors.notFound();
  await ensureEnrollment(userId, test.language);
  const existing = await Attempt.findOne({ user: userId, kind: 'test', test: test._id, status: 'in_progress' });
  if (existing) return existing;
  const exercises = test.exercises as Exercise[];
  if (exercises.length === 0) throw errors.badRequest('no_exercises');
  return Attempt.create({
    user: userId,
    kind: 'test',
    language: test.language,
    level: test.level,
    test: test._id,
    lesson: test.lesson,
    title: test.title,
    feedbackMode: 'deferred',
    items: exercises.map((ex) => makeItem(ex)),
    recommendationKey: recommendationKey ?? null,
    startedAt: now,
  });
}

async function placementBlock(language: string, level: CefrLevel) {
  const test = await Test.findOne({ language, kind: 'placement', isPublished: true }).lean();
  if (!test) throw errors.notFound();
  const exercises = (test.exercises as Array<Exercise & { level?: CefrLevel }>).filter((e) => e.level === level);
  return { test, exercises };
}

export async function startPlacementAttempt(userId: string, language: string, now = new Date()) {
  await ensureEnrollment(userId, language);
  const existing = await Attempt.findOne({ user: userId, kind: 'placement', language, status: 'in_progress' });
  if (existing) return existing;
  const { test, exercises } = await placementBlock(language, 'A1');
  if (exercises.length === 0) throw errors.badRequest('no_exercises');
  return Attempt.create({
    user: userId,
    kind: 'placement',
    language,
    test: test._id,
    title: test.title,
    feedbackMode: 'deferred',
    items: exercises.map((ex) => makeItem(ex, { level: 'A1' })),
    placement: { currentLevel: 'A1', estimatedLevel: null, finished: false },
    startedAt: now,
  });
}

export async function startPracticeAttempt(
  userId: string,
  language: string,
  options: { topic?: string; recommendationKey?: string; now?: Date },
) {
  const enrollment = await ensureEnrollment(userId, language);
  const userObjectId = new Types.ObjectId(userId);
  const [lessons, progress, recentEvents, mistakes] = await Promise.all([
    Lesson.find({ language, isPublished: true }).select('exercises level topic').lean(),
    LessonProgress.find({ user: userId, language }).select('lesson').lean(),
    AnswerEvent.find({ user: userId, language, isRetry: false, verdict: { $ne: 'skipped' } }).sort({ at: -1 }).limit(30).select('verdict').lean(),
    AnswerEvent.aggregate<{ _id: string; misses: number }>([
      { $match: { user: userObjectId, language, verdict: 'incorrect', at: { $gte: new Date(Date.now() - 45 * 86400_000) } } },
      { $group: { _id: '$exerciseKey', misses: { $sum: 1 } } },
    ]),
  ]);
  const seen = new Set(progress.map((p) => String(p.lesson)));
  const missed = new Map(mistakes.map((m) => [m._id, m.misses]));
  const accuracy = recentEvents.length ? recentEvents.filter((e) => e.verdict === 'correct').length / recentEvents.length : null;
  const target = targetDifficultyFor(accuracy);
  const levelCap = CEFR_LEVELS.indexOf(enrollment.level as CefrLevel);

  const scored: Array<{ ex: Exercise; lessonId: Types.ObjectId; score: number }> = [];
  for (const lesson of lessons) {
    const lessonSeen = seen.has(String(lesson._id));
    if (!lessonSeen && CEFR_LEVELS.indexOf(lesson.level as CefrLevel) > levelCap) continue;
    for (const ex of lesson.exercises as Exercise[]) {
      if (options.topic && ex.topic !== options.topic && lesson.topic !== options.topic) continue;
      if (ex.type === 'speak') continue;
      const score =
        (missed.get(ex.key) ?? 0) * 3 + (lessonSeen ? 2 : 0) - Math.abs(ex.difficulty - target) + Math.random() * 0.5;
      scored.push({ ex, lessonId: lesson._id, score });
    }
  }
  if (scored.length === 0) throw errors.badRequest('no_exercises');
  scored.sort((a, b) => b.score - a.score);
  const picked = scored.slice(0, PRACTICE_SIZE);

  let title: LocalizedText = serverText('practiceMixed');
  if (options.topic) {
    const topic = await Topic.findOne({ key: options.topic }).lean();
    title = serverText('practiceTopic', { topic: (topic?.title as LocalizedText | undefined) ?? { ru: options.topic } });
  }
  return Attempt.create({
    user: userId,
    kind: 'practice',
    language,
    level: enrollment.level,
    title,
    feedbackMode: 'immediate',
    practiceTopic: options.topic ?? null,
    items: picked.map((p) => makeItem(p.ex, { sourceLesson: p.lessonId })),
    recommendationKey: options.recommendationKey ?? null,
    startedAt: options.now ?? new Date(),
  });
}

export async function getAttemptState(userId: string, attemptId: string, locale = 'ru') {
  return toState(await loadOwnAttempt(userId, attemptId), locale);
}

function scoreItems(items: Item[]) {
  const scored = items.filter((i) => !i.isRetry);
  const counted = scored.filter((i) => i.verdict !== 'skipped');
  const correct = counted.filter((i) => i.verdict === 'correct').length;
  const almost = counted.filter((i) => i.verdict === 'almost').length;
  const incorrect = counted.filter((i) => i.verdict === 'incorrect').length;
  const skipped = scored.length - counted.length;
  const points = counted.reduce((s, i) => s + (i.points ?? 0), 0);
  const maxPoints = counted.length * POINTS.correct;
  const percent = maxPoints === 0 ? 0 : Math.round((points / maxPoints) * 100);
  return { correct, almost, incorrect, skipped, total: scored.length, points, maxPoints, percent };
}

async function advancePlacement(attempt: AttemptDoc) {
  const level = attempt.placement!.currentLevel as CefrLevel;
  const block = attempt.items.filter((i) => i.level === level);
  if (block.some((i) => !i.verdict)) return;
  const share = block.filter((i) => i.verdict === 'correct').length / Math.max(1, block.length);
  const next = CEFR_LEVELS[CEFR_LEVELS.indexOf(level) + 1];
  if (share >= PLACEMENT_BLOCK_PASS && next) {
    const { exercises } = await placementBlock(attempt.language, next);
    if (exercises.length > 0) {
      attempt.items.push(...exercises.map((ex) => makeItem(ex, { level: next })));
      attempt.placement!.currentLevel = next;
      return;
    }
  }
  attempt.placement!.estimatedLevel = share >= PLACEMENT_BLOCK_PASS ? (next ? level : 'B2') : level;
  attempt.placement!.finished = true;
}

export async function submitAnswer(
  userId: string,
  attemptId: string,
  input: { itemIndex: number; answer: ExerciseAnswer; timeMs?: number },
  locale = 'ru',
  now = new Date(),
): Promise<AnswerResultDTO> {
  const attempt = await loadOwnAttempt(userId, attemptId);
  if (attempt.status === 'completed') throw errors.conflict('attempt_completed');
  if (input.itemIndex !== attempt.position) throw errors.conflict('answer_mismatch');
  const item = attempt.items[attempt.position];
  if (!item) throw errors.conflict('attempt_completed');
  const exercise = item.exercise as Exercise;
  if (input.answer.type !== exercise.type) throw new AppError(400, 'answer_mismatch');

  const result = checkAnswer(exercise, input.answer, attempt.language, locale);
  const timeMs = Math.max(0, Math.min(input.timeMs ?? 0, MAX_ITEM_TIME_MS));
  item.answer = input.answer;
  item.verdict = result.verdict;
  item.points = item.isRetry ? 0 : result.points;
  item.timeMs = timeMs;
  item.answeredAt = now;

  await AnswerEvent.create({
    user: userId,
    language: attempt.language,
    attempt: attempt._id,
    attemptKind: attempt.kind,
    lesson: item.sourceLesson ?? attempt.lesson ?? null,
    exerciseKey: exercise.key,
    type: exercise.type,
    skill: exercise.skill,
    topic: exercise.topic,
    category: result.category as ErrorCategory,
    difficulty: exercise.difficulty,
    verdict: result.verdict,
    isRetry: item.isRetry,
    prompt: promptText(exercise, locale).slice(0, 300),
    given: result.given.slice(0, 300),
    expected: expectedAnswer(exercise, locale).slice(0, 300),
    timeMs,
    at: now,
  });

  const retries = attempt.items.filter((i) => i.isRetry).length;
  if (
    attempt.feedbackMode === 'immediate' &&
    result.verdict === 'incorrect' &&
    !item.isRetry &&
    retries < MAX_RETRIES_PER_ATTEMPT
  ) {
    attempt.items.push(makeItem(exercise, { sourceLesson: item.sourceLesson ?? null, isRetry: true }));
  }

  attempt.position += 1;
  if (attempt.kind === 'placement' && attempt.position >= attempt.items.length) await advancePlacement(attempt);
  attempt.markModified('items');
  await attempt.save();
  await User.updateOne({ _id: userId }, { $set: { lastActiveAt: now } });

  return {
    feedback: attempt.feedbackMode === 'immediate' ? result.feedback : null,
    state: toState(attempt, locale),
  };
}

function summarize(attempt: AttemptDoc, locale: string) {
  const scored = attempt.items.filter((i) => !i.isRetry && i.verdict && i.verdict !== 'skipped');
  const byTopicMap = new Map<string, { correct: number; total: number }>();
  const byCategoryMap = new Map<ErrorCategory, number>();
  for (const item of scored) {
    const ex = item.exercise as Exercise;
    const t = byTopicMap.get(ex.topic) ?? { correct: 0, total: 0 };
    t.total += 1;
    if (item.verdict === 'correct') t.correct += 1;
    else if (item.verdict === 'almost') t.correct += POINTS.almost / POINTS.correct;
    byTopicMap.set(ex.topic, t);
    if (item.verdict !== 'correct') {
      const category: ErrorCategory = item.verdict === 'almost' ? (ex.type === 'speak' ? 'pronunciation' : 'spelling') : ex.errorCategory;
      byCategoryMap.set(category, (byCategoryMap.get(category) ?? 0) + 1);
    }
  }
  const byTopic = [...byTopicMap.entries()].map(([topic, v]) => ({
    topic,
    correct: Math.round(v.correct * 10) / 10,
    total: v.total,
    percent: Math.round((v.correct / v.total) * 100),
  }));
  return {
    byTopic,
    byCategory: [...byCategoryMap.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    strengths: byTopic.filter((t) => t.total >= 2 && t.percent >= 85).map((t) => t.topic),
    weaknesses: byTopic.filter((t) => t.percent < 60).map((t) => t.topic),
    review: attempt.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.isRetry)
      .map(({ item, index }) => {
        const ex = item.exercise as Exercise;
        const answer = item.answer as ExerciseAnswer | null;
        const check = answer ? checkAnswer(ex, answer, attempt.language, locale) : null;
        return {
          itemIndex: index,
          type: ex.type,
          topic: ex.topic,
          prompt: promptText(ex, locale),
          given: check?.given ?? '',
          expected: expectedAnswer(ex, locale),
          verdict: (item.verdict ?? 'skipped') as AttemptSummaryDTO['review'][number]['verdict'],
          explanation: localize(ex.explanation, locale),
        };
      }),
  };
}

export async function completeAttempt(userId: string, attemptId: string, locale = 'ru', now = new Date()): Promise<AttemptSummaryDTO> {
  const attempt = await loadOwnAttempt(userId, attemptId);
  if (attempt.status === 'completed') return buildSummary(attempt, locale);
  if (attempt.position < attempt.items.length) throw errors.conflict('attempt_not_finished');

  const user = await User.findById(userId).select('timezone').lean();
  const tz = user?.timezone ?? 'UTC';
  const score = scoreItems(attempt.items);
  let passPercent = LESSON_PASS_PERCENT;
  let wordsAdded = 0;

  if (attempt.kind === 'test' && attempt.test) {
    const test = await Test.findById(attempt.test).select('passPercent').lean();
    passPercent = test?.passPercent ?? passPercent;
  }

  if (attempt.kind === 'lesson' && attempt.lesson) {
    const lesson = await Lesson.findById(attempt.lesson).select('words').lean();
    const progress = await LessonProgress.findOne({ user: userId, lesson: attempt.lesson });
    const best = Math.max(progress?.bestPercent ?? 0, score.percent);
    await LessonProgress.updateOne(
      { user: userId, lesson: attempt.lesson },
      {
        $set: {
          language: attempt.language,
          status: 'completed',
          bestPercent: best,
          lastPercent: score.percent,
          lastAttemptAt: now,
          completedAt: progress?.completedAt ?? now,
        },
        $inc: { attempts: 1 },
      },
      { upsert: true },
    );
    wordsAdded = await introduceWords(userId, attempt.language, (lesson?.words ?? []) as Types.ObjectId[], now, tz);
  }

  if (attempt.kind === 'placement') {
    const estimated = (attempt.placement?.estimatedLevel as CefrLevel | null) ?? 'A1';
    await Enrollment.updateOne(
      { user: userId, language: attempt.language },
      { $set: { level: estimated, placementLevel: estimated, placementAt: now, placementSkipped: false } },
    );
    attempt.level = estimated;
  }

  attempt.status = 'completed';
  attempt.completedAt = now;
  attempt.durationSec = Math.round(attempt.items.reduce((s, i) => s + (i.timeMs ?? 0), 0) / 1000);
  attempt.result = { ...score, passed: score.percent >= passPercent, wordsAdded };
  await attempt.save();
  await Enrollment.updateOne({ user: userId, language: attempt.language }, { $set: { lastActivityAt: now } });

  return buildSummary(attempt, locale);
}

export async function getAttemptSummary(userId: string, attemptId: string, locale = 'ru') {
  const attempt = await loadOwnAttempt(userId, attemptId);
  if (attempt.status !== 'completed') throw errors.conflict('attempt_not_finished');
  return buildSummary(attempt, locale);
}

async function buildSummary(attempt: AttemptDoc, locale: string): Promise<AttemptSummaryDTO> {
  const { getRecommendations } = await import('../recommendations/service');
  const details = summarize(attempt, locale);
  const r = attempt.result!;
  let placement: AttemptSummaryDTO['placement'];
  if (attempt.kind === 'placement') {
    const perLevel = CEFR_LEVELS.map((level) => {
      const block = attempt.items.filter((i) => i.level === level);
      return { level, correct: block.filter((i) => i.verdict === 'correct').length, total: block.length };
    }).filter((l) => l.total > 0);
    placement = { estimatedLevel: (attempt.placement?.estimatedLevel as CefrLevel) ?? 'A1', perLevel };
  }
  const recs = await getRecommendations(String(attempt.user), attempt.language);
  const ownKey = attempt.lesson ? `lesson:${String(attempt.lesson)}` : null;
  const next = recs.items.find((i) => i.key !== ownKey && i.target.lessonId !== String(attempt.lesson ?? '')) ?? null;
  return {
    id: String(attempt._id),
    kind: attempt.kind as AttemptKind,
    title: localize(attempt.title as LocalizedText, locale),
    language: attempt.language,
    level: (attempt.level as CefrLevel | null) ?? null,
    lessonId: attempt.lesson ? String(attempt.lesson) : null,
    testId: attempt.test ? String(attempt.test) : null,
    completedAt: attempt.completedAt!.toISOString(),
    percent: r.percent ?? 0,
    points: r.points ?? 0,
    maxPoints: r.maxPoints ?? 0,
    correct: r.correct ?? 0,
    almost: r.almost ?? 0,
    incorrect: r.incorrect ?? 0,
    skipped: r.skipped ?? 0,
    total: r.total ?? 0,
    durationSec: attempt.durationSec,
    passed: !!r.passed,
    wordsAdded: r.wordsAdded ?? 0,
    ...details,
    placement,
    next,
  };
}

export async function skipPlacement(userId: string, language: string, level: CefrLevel) {
  const enrollment = await ensureEnrollment(userId, language);
  enrollment.level = level;
  enrollment.placementSkipped = true;
  await enrollment.save();
  return enrollment;
}
