import { Types } from 'mongoose';
import {
  CEFR_LEVELS,
  localize,
  type CefrLevel,
  type ErrorCategory,
  type LearningGoal,
  type LocalizedText,
  type Recommendation,
  type RecommendationResult,
  type StudyPlan,
} from '@linguapath/shared';
import { errors } from '../../lib/errors';
import { endOfLocalDay, localDateKey, localDaysBetween, startOfLocalDay } from '../../lib/time';
import { Topic } from '../../models/content';
import { AnswerEvent, Attempt, DailyPlan, LessonProgress, RecommendationSnapshot, ReviewItem, ReviewLog } from '../../models/learning';
import { Enrollment, User } from '../../models/user';
import { loadCatalog } from '../catalog/catalog';
import { DEFAULT_ENGINE_CONFIG } from './config';
import { ENGINE_VERSION, nextPathLessons, recommend, type LearnerSnapshot, type TopicEvidence } from './engine';
import { composePlan } from './plan';

const SNAPSHOT_REUSE_MS = 10 * 60 * 1000;

export async function buildSnapshot(userId: string, language: string, now = new Date(), locale = 'ru'): Promise<LearnerSnapshot & { tz: string }> {
  const [user, enrollment] = await Promise.all([
    User.findById(userId).lean(),
    Enrollment.findOne({ user: userId, language }).lean(),
  ]);
  if (!user) throw errors.notFound();
  if (!enrollment) throw errors.badRequest('not_enrolled');
  const tz = user.timezone;
  const uid = new Types.ObjectId(userId);

  const [catalog, progress, inProgress, testAttempts, topicDocs, topicAgg, sessionAgg, recentAgg, categoryAgg, recent, reviewItems, reviewLogs, snapshots] =
    await Promise.all([
      loadCatalog(language),
      LessonProgress.find({ user: userId, language }).lean(),
      Attempt.find({ user: userId, language, status: 'in_progress' }).select('kind lesson test title items.verdict practiceTopic startedAt').lean(),
      Attempt.find({ user: userId, language, kind: 'test', status: 'completed' }).select('test result').lean(),
      Topic.find().lean(),
      AnswerEvent.aggregate<{ _id: string; answers: number; correct: number; last: Date }>([
        { $match: { user: uid, language, isRetry: false, verdict: { $ne: 'skipped' } } },
        {
          $group: {
            _id: '$topic',
            answers: { $sum: 1 },
            correct: { $sum: { $switch: { branches: [{ case: { $eq: ['$verdict', 'correct'] }, then: 1 }, { case: { $eq: ['$verdict', 'almost'] }, then: 0.7 }], default: 0 } } },
            last: { $max: '$at' },
          },
        },
      ]),
      AnswerEvent.aggregate<{ _id: { topic: string; attempt: Types.ObjectId }; answers: number; correct: number; at: Date }>([
        { $match: { user: uid, language, isRetry: false, verdict: { $ne: 'skipped' } } },
        {
          $group: {
            _id: { topic: '$topic', attempt: '$attempt' },
            answers: { $sum: 1 },
            correct: { $sum: { $cond: [{ $eq: ['$verdict', 'correct'] }, 1, 0] } },
            at: { $min: '$at' },
          },
        },
        { $sort: { at: 1 } },
      ]),
      AnswerEvent.aggregate<{ _id: string; verdicts: string[] }>([
        { $match: { user: uid, language, isRetry: false, verdict: { $ne: 'skipped' } } },
        { $sort: { at: -1 } },
        { $group: { _id: '$topic', verdicts: { $push: '$verdict' } } },
        { $project: { verdicts: { $slice: ['$verdicts', DEFAULT_ENGINE_CONFIG.thresholds.recentWindow] } } },
      ]),
      AnswerEvent.aggregate<{ _id: { topic: string; category: ErrorCategory }; count: number }>([
        { $match: { user: uid, language, verdict: { $in: ['incorrect', 'almost'] }, at: { $gte: new Date(+now - 30 * 86400_000) } } },
        { $group: { _id: { topic: '$topic', category: '$category' }, count: { $sum: 1 } } },
      ]),
      AnswerEvent.find({ user: userId, language, isRetry: false, verdict: { $ne: 'skipped' } }).sort({ at: -1 }).limit(30).select('verdict').lean(),
      ReviewItem.find({ user: userId, language, dueAt: { $lte: endOfLocalDay(now, tz) } }).select('dueAt lastReviewedAt').lean(),
      ReviewLog.find({ user: userId, language, at: { $gte: new Date(+now - 30 * 86400_000) } }).select('quality').lean(),
      RecommendationSnapshot.find({ user: userId, language, generatedAt: { $gte: new Date(+now - 7 * 86400_000) } })
        .select('items.key followedKeys generatedAt')
        .lean(),
    ]);

  const topicKind = new Map(topicDocs.map((t) => [t.key, t.kind as TopicEvidence['kind']]));
  const recentByTopic = new Map(
    recentAgg.map((r) => [r._id, { answers: r.verdicts.length, correct: r.verdicts.reduce((s, v) => s + (v === 'correct' ? 1 : v === 'almost' ? 0.7 : 0), 0) }]),
  );
  const sessionsByTopic = new Map<string, number[]>();
  for (const s of sessionAgg) {
    // Sessions with a single answer on a topic are too noisy to signal a trend.
    if (s.answers < 2) continue;
    const list = sessionsByTopic.get(s._id.topic) ?? [];
    list.push(Math.round((s.correct / s.answers) * 100));
    sessionsByTopic.set(s._id.topic, list);
  }
  const topCategory = new Map<string, { category: ErrorCategory; count: number }>();
  for (const c of categoryAgg) {
    const current = topCategory.get(c._id.topic);
    if (!current || c.count > current.count) topCategory.set(c._id.topic, { category: c._id.category, count: c.count });
  }

  const startToday = startOfLocalDay(now, tz);
  const reviewed = reviewItems.filter((r) => r.lastReviewedAt);
  const overdue = reviewed.filter((r) => r.dueAt < startToday);
  const maxOverdueDays = overdue.reduce((m, r) => Math.max(m, localDaysBetween(r.dueAt, now, tz)), 0);

  const testResults: LearnerSnapshot['testResults'] = {};
  for (const a of testAttempts) {
    const id = String(a.test);
    const prev = testResults[id];
    const percent = a.result?.percent ?? 0;
    testResults[id] = { bestPercent: Math.max(prev?.bestPercent ?? 0, percent), passed: !!(prev?.passed || a.result?.passed) };
  }

  const ignored: Record<string, number> = {};
  const seenDays = new Map<string, Set<string>>();
  for (const snap of snapshots) {
    const day = localDateKey(snap.generatedAt, tz);
    for (const item of (snap.items as Array<{ key: string }>).slice(0, 3)) {
      if (snap.followedKeys.includes(item.key)) continue;
      const days = seenDays.get(item.key) ?? new Set<string>();
      days.add(day);
      seenDays.set(item.key, days);
    }
  }
  // Today's showing is not yet "ignored": the learner may still act on it.
  for (const [key, days] of seenDays) {
    days.delete(localDateKey(now, tz));
    if (days.size) ignored[key] = days.size;
  }

  const moduleTests = new Map(catalog.tests.filter((t) => t.kind === 'module').map((t) => [t.moduleId!, t]));

  return {
    tz,
    now,
    language,
    level: enrollment.level as CefrLevel,
    placementDone: !!enrollment.placementAt || enrollment.placementSkipped,
    goals: user.goals as LearningGoal[],
    dailyMinutes: user.dailyMinutes,
    lessons: catalog.lessons.map((l) => ({
      id: l.id,
      title: localize(l.title, locale),
      level: l.level,
      moduleId: l.moduleId,
      pathIndex: l.pathIndex,
      topic: l.topic,
      exerciseTopics: l.exerciseTopics,
      estimatedMinutes: l.estimatedMinutes,
      prerequisites: l.prerequisites,
    })),
    modules: catalog.modules.map((m) => {
      const test = moduleTests.get(m.id);
      return {
        id: m.id,
        title: localize(m.title, locale),
        level: m.level,
        lessonIds: catalog.lessons.filter((l) => l.moduleId === m.id).map((l) => l.id),
        test: test ? { id: test.id, title: localize(test.title, locale), exerciseCount: test.exerciseCount } : null,
      };
    }),
    progress: Object.fromEntries(
      progress.map((p) => [String(p.lesson), { status: p.status as 'in_progress' | 'completed', bestPercent: p.bestPercent ?? null, attempts: p.attempts }]),
    ),
    inProgress: inProgress.map((a) => ({
      attemptId: String(a._id),
      kind: a.kind as LearnerSnapshot['inProgress'][number]['kind'],
      lessonId: a.lesson ? String(a.lesson) : null,
      testId: a.test ? String(a.test) : null,
      title: localize(a.title as LocalizedText, locale),
      topic: a.practiceTopic ?? null,
      answered: a.items.filter((i) => i.verdict).length,
      total: a.items.length,
      startedAt: a.startedAt,
    })),
    testResults,
    topics: topicAgg.map((t) => ({
      topic: t._id,
      kind: topicKind.get(t._id) ?? 'grammar',
      answers: t.answers,
      correct: t.correct,
      recentAnswers: recentByTopic.get(t._id)?.answers,
      recentCorrect: recentByTopic.get(t._id)?.correct,
      lastPracticedAt: t.last,
      sessionAccuracies: (sessionsByTopic.get(t._id) ?? []).slice(-5),
      topCategory: topCategory.get(t._id) ?? null,
    })),
    srs: {
      due: reviewed.length,
      overdue: overdue.length,
      maxOverdueDays,
      newAvailable: reviewItems.length - reviewed.length,
      retention30d: reviewLogs.length ? reviewLogs.filter((l) => l.quality >= 3).length / reviewLogs.length : null,
      reviews30d: reviewLogs.length,
    },
    lastActiveAt: user.lastActiveAt ?? null,
    recentAccuracy: recent.length ? recent.reduce((s, e) => s + (e.verdict === 'correct' ? 1 : e.verdict === 'almost' ? 0.7 : 0), 0) / recent.length : null,
    recentAnswers: recent.length,
    ignored,
  };
}

export async function getRecommendations(userId: string, language: string, locale = 'ru'): Promise<RecommendationResult> {
  const now = new Date();
  const snapshot = await buildSnapshot(userId, language, now, locale);
  const result = recommend(snapshot);
  const last = await RecommendationSnapshot.findOne({ user: userId, language }).sort({ generatedAt: -1 }).select('items.key generatedAt').lean();
  const lastKeys = ((last?.items ?? []) as Array<{ key: string }>).slice(0, 3).map((i) => i.key).join('|');
  const keys = result.items.slice(0, 3).map((i) => i.key).join('|');
  if (!last || lastKeys !== keys || +now - +last.generatedAt > SNAPSHOT_REUSE_MS) {
    await RecommendationSnapshot.create({
      user: userId,
      language,
      engineVersion: result.engineVersion,
      generatedAt: now,
      targetDifficulty: result.targetDifficulty,
      difficultyAdjustment: result.difficultyAdjustment,
      difficultyReason: result.difficultyReason ?? null,
      items: result.items,
    });
  }
  return result;
}

export async function markRecommendationFollowed(userId: string, language: string, key: string) {
  const snap = await RecommendationSnapshot.findOne({ user: userId, language, 'items.key': key }).sort({ generatedAt: -1 });
  if (snap && !snap.followedKeys.includes(key)) {
    snap.followedKeys.push(key);
    await snap.save();
  }
}

async function isPlanItemDone(userId: string, language: string, item: Recommendation, since: Date, tz: string, now: Date): Promise<boolean> {
  const completedSince: Record<string, unknown> = { user: userId, language, status: 'completed', completedAt: { $gte: since } };
  switch (item.type) {
    case 'placement': {
      const e = await Enrollment.findOne({ user: userId, language }).lean();
      return !!e && (!!e.placementAt || e.placementSkipped);
    }
    case 'resume':
      return !!(await Attempt.exists({ _id: item.target.attemptId, status: 'completed' }));
    case 'review': {
      const reviewedToday = await ReviewLog.countDocuments({ user: userId, language, at: { $gte: startOfLocalDay(now, tz) } });
      const stillDue = await ReviewItem.countDocuments({ user: userId, language, dueAt: { $lte: endOfLocalDay(now, tz) } });
      return stillDue === 0 || reviewedToday >= (item.target.reviewCount ?? 1);
    }
    case 'next_lesson':
    case 'retry_lesson':
      return !!(await Attempt.exists({ ...completedSince, kind: 'lesson', lesson: item.target.lessonId }));
    case 'weak_topic':
    case 'topic_refresh':
      return !!(await Attempt.exists({ ...completedSince, kind: 'practice', practiceTopic: item.target.topic }));
    case 'module_test':
      return !!(await Attempt.exists({ ...completedSince, kind: 'test', test: item.target.testId }));
    case 'level_up': {
      const e = await Enrollment.findOne({ user: userId, language }).lean();
      return !!e && CEFR_LEVELS.indexOf(e.level as CefrLevel) >= CEFR_LEVELS.indexOf(item.target.level as CefrLevel);
    }
  }
}

export async function getTodayPlan(userId: string, language: string, options: { rebuild?: boolean; locale?: string } = {}): Promise<StudyPlan> {
  const locale = options.locale ?? 'ru';
  const user = await User.findById(userId).lean();
  if (!user) throw errors.notFound();
  const now = new Date();
  const date = localDateKey(now, user.timezone);
  if (options.rebuild) await DailyPlan.deleteOne({ user: userId, language, date });

  let plan = await DailyPlan.findOne({ user: userId, language, date }).lean();
  if (!plan) {
    const result = await getRecommendations(userId, language, locale);
    const items = composePlan(result, user.dailyMinutes);
    try {
      plan = (
        await DailyPlan.create({ user: userId, language, date, budgetMinutes: user.dailyMinutes, items, engineVersion: ENGINE_VERSION })
      ).toObject();
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
      plan = await DailyPlan.findOne({ user: userId, language, date }).lean();
    }
  }
  const since = (plan!.createdAt as Date) ?? startOfLocalDay(now, user.timezone);
  const items = plan!.items as Recommendation[];
  const done = await Promise.all(items.map((i) => isPlanItemDone(userId, language, i, since, user.timezone, now)));

  const snapshot = await buildSnapshot(userId, language, now, locale);
  const catalog = await loadCatalog(language);
  const moduleTitle = new Map(catalog.modules.map((m) => [m.id, localize(m.title, locale)]));

  return {
    date,
    budgetMinutes: plan!.budgetMinutes,
    plannedMinutes: items.reduce((s, i) => s + i.estimatedMinutes, 0),
    items: items.map((item, i) => ({ ...item, done: done[i]! })),
    upcoming: nextPathLessons(snapshot, 5).map((l) => ({ lessonId: l.id, title: l.title, level: l.level, moduleTitle: moduleTitle.get(l.moduleId) ?? '' })),
  };
}
