import { Types } from 'mongoose';
import type {
  CefrLevel,
  ErrorAnalyticsDTO,
  ErrorCategory,
  ExerciseType,
  ProgressOverviewDTO,
  Skill,
  SrsAnalyticsDTO,
  SrsState,
  TimelinePointDTO,
  TopicAnalyticsDTO,
} from '@slog/shared';
import { localize, type LocalizedText } from '@slog/shared';
import { endOfLocalDay, lastLocalDates, localDaysBetween, startOfLocalDay } from '../../lib/time';
import { Word } from '../../models/content';
import { AnswerEvent, Attempt, LessonProgress, ReviewItem, ReviewLog } from '../../models/learning';
import { Enrollment, User } from '../../models/user';
import { loadCatalog } from '../catalog/catalog';
import { srsState } from '../srs/sm2';

const DAY = 86_400_000;
/** Answers on a topic needed before its accuracy is shown as reliable. */
export const MIN_TOPIC_EVIDENCE = 6;

/** First attempts only; "almost" answers count as 0.7 correct. */
const weightedCorrect = {
  $sum: { $switch: { branches: [{ case: { $eq: ['$verdict', 'correct'] }, then: 1 }, { case: { $eq: ['$verdict', 'almost'] }, then: 0.7 }], default: 0 } },
};

const firstAttempts = (user: Types.ObjectId, language: string, extra: Record<string, unknown> = {}) => ({
  $match: { user, language, isRetry: false, verdict: { $ne: 'skipped' }, ...extra },
});

async function userTz(userId: string) {
  const user = await User.findById(userId).select('timezone lastActiveAt').lean();
  return { tz: user?.timezone ?? 'UTC', lastActiveAt: user?.lastActiveAt ?? null };
}

export async function getOverview(userId: string, language: string, now = new Date()): Promise<ProgressOverviewDTO> {
  const uid = new Types.ObjectId(userId);
  const { tz, lastActiveAt } = await userTz(userId);
  const [enrollment, catalog, progress, reviewItems, tests, accuracyAll, accuracy7, activeDays, minutesAnswers, minutesReviews] = await Promise.all([
    Enrollment.findOne({ user: userId, language }).lean(),
    loadCatalog(language),
    LessonProgress.find({ user: userId, language, status: 'completed' }).select('lesson').lean(),
    ReviewItem.find({ user: userId, language }).select('repetitions intervalDays lapses lastReviewedAt dueAt').lean(),
    Attempt.find({ user: userId, language, kind: 'test', status: 'completed' }).select('result').lean(),
    AnswerEvent.aggregate<{ answers: number; correct: number }>([firstAttempts(uid, language), { $group: { _id: null, answers: { $sum: 1 }, correct: weightedCorrect } }]),
    AnswerEvent.aggregate<{ answers: number; correct: number }>([
      firstAttempts(uid, language, { at: { $gte: new Date(+now - 7 * DAY) } }),
      { $group: { _id: null, answers: { $sum: 1 }, correct: weightedCorrect } },
    ]),
    activeLocalDates(uid, language, new Date(+now - 28 * DAY), tz),
    AnswerEvent.aggregate<{ ms: number }>([
      { $match: { user: uid, language, at: { $gte: new Date(+now - 7 * DAY) } } },
      { $group: { _id: null, ms: { $sum: '$timeMs' } } },
    ]),
    ReviewLog.aggregate<{ ms: number }>([
      { $match: { user: uid, language, at: { $gte: new Date(+now - 7 * DAY) } } },
      { $group: { _id: null, ms: { $sum: '$timeMs' } } },
    ]),
  ]);

  const completed = new Set(progress.map((p) => String(p.lesson)));
  const level = (enrollment?.level as CefrLevel) ?? null;
  const levelLessons = catalog.lessons.filter((l) => l.level === level);
  const endToday = endOfLocalDay(now, tz);
  const all = accuracyAll[0];
  const week = accuracy7[0];
  const ms = (minutesAnswers[0]?.ms ?? 0) + (minutesReviews[0]?.ms ?? 0);

  return {
    language,
    level,
    lessons: {
      completed: catalog.lessons.filter((l) => completed.has(l.id)).length,
      total: catalog.lessons.length,
      inLevel: { completed: levelLessons.filter((l) => completed.has(l.id)).length, total: levelLessons.length },
    },
    words: {
      learned: reviewItems.filter((r) => r.repetitions >= 1 || r.intervalDays >= 6).length,
      inReview: reviewItems.length,
      mastered: reviewItems.filter((r) => srsState(r) === 'mastered').length,
      dueToday: reviewItems.filter((r) => r.dueAt <= endToday).length,
    },
    tests: {
      taken: tests.length,
      passed: tests.filter((t) => t.result?.passed).length,
      averagePercent: tests.length ? Math.round(tests.reduce((s, t) => s + (t.result?.percent ?? 0), 0) / tests.length) : null,
    },
    accuracy: {
      overall: all?.answers ? all.correct / all.answers : null,
      last7Days: week?.answers ? week.correct / week.answers : null,
      answers: all?.answers ?? 0,
    },
    rhythm: {
      activeDaysLast28: activeDays.size,
      minutesLast7: Math.round(ms / 60000),
      lastActiveAt: lastActiveAt?.toISOString() ?? null,
      daysSinceLastActivity: lastActiveAt ? localDaysBetween(lastActiveAt, now, tz) : null,
    },
  };
}

async function activeLocalDates(uid: Types.ObjectId, language: string, since: Date, tz: string): Promise<Set<string>> {
  const group = [
    { $match: { user: uid, language, at: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$at', timezone: tz } } } },
  ];
  const [a, r] = await Promise.all([AnswerEvent.aggregate<{ _id: string }>(group), ReviewLog.aggregate<{ _id: string }>(group)]);
  return new Set([...a, ...r].map((d) => d._id));
}

export async function getTimeline(userId: string, language: string, days: number, now = new Date()): Promise<TimelinePointDTO[]> {
  const uid = new Types.ObjectId(userId);
  const { tz } = await userTz(userId);
  const since = startOfLocalDay(new Date(+now - (days - 1) * DAY), tz);
  const dateExpr = { $dateToString: { format: '%Y-%m-%d', date: '$at', timezone: tz } };
  const [answers, reviews] = await Promise.all([
    AnswerEvent.aggregate<{ _id: string; answers: number; firstAnswers: number; correct: number; ms: number }>([
      { $match: { user: uid, language, at: { $gte: since }, verdict: { $ne: 'skipped' } } },
      {
        $group: {
          _id: dateExpr,
          answers: { $sum: 1 },
          firstAnswers: { $sum: { $cond: ['$isRetry', 0, 1] } },
          correct: { $sum: { $cond: [{ $and: [{ $not: ['$isRetry'] }, { $eq: ['$verdict', 'correct'] }] }, 1, { $cond: [{ $and: [{ $not: ['$isRetry'] }, { $eq: ['$verdict', 'almost'] }] }, 0.7, 0] }] } },
          ms: { $sum: '$timeMs' },
        },
      },
    ]),
    ReviewLog.aggregate<{ _id: string; count: number; ms: number }>([
      { $match: { user: uid, language, at: { $gte: since } } },
      { $group: { _id: dateExpr, count: { $sum: 1 }, ms: { $sum: '$timeMs' } } },
    ]),
  ]);
  const a = new Map(answers.map((x) => [x._id, x]));
  const r = new Map(reviews.map((x) => [x._id, x]));
  return lastLocalDates(now, days, tz).map((date) => {
    const day = a.get(date);
    const rev = r.get(date);
    return {
      date,
      answers: day?.firstAnswers ?? 0,
      correct: Math.round((day?.correct ?? 0) * 10) / 10,
      accuracy: day?.firstAnswers ? day.correct / day.firstAnswers : null,
      minutes: Math.round(((day?.ms ?? 0) + (rev?.ms ?? 0)) / 60000),
      reviews: rev?.count ?? 0,
    };
  });
}

export async function getTopicAnalytics(userId: string, language: string, now = new Date()): Promise<TopicAnalyticsDTO[]> {
  const uid = new Types.ObjectId(userId);
  const recentSince = new Date(+now - 14 * DAY);
  const previousSince = new Date(+now - 28 * DAY);
  const rows = await AnswerEvent.aggregate<{
    _id: string;
    answers: number;
    correct: number;
    recentAnswers: number;
    recentCorrect: number;
    prevAnswers: number;
    prevCorrect: number;
    last: Date;
  }>([
    firstAttempts(uid, language),
    {
      $group: {
        _id: '$topic',
        answers: { $sum: 1 },
        correct: weightedCorrect,
        recentAnswers: { $sum: { $cond: [{ $gte: ['$at', recentSince] }, 1, 0] } },
        recentCorrect: { $sum: { $cond: [{ $and: [{ $gte: ['$at', recentSince] }, { $eq: ['$verdict', 'correct'] }] }, 1, 0] } },
        prevAnswers: { $sum: { $cond: [{ $and: [{ $gte: ['$at', previousSince] }, { $lt: ['$at', recentSince] }] }, 1, 0] } },
        prevCorrect: {
          $sum: { $cond: [{ $and: [{ $gte: ['$at', previousSince] }, { $lt: ['$at', recentSince] }, { $eq: ['$verdict', 'correct'] }] }, 1, 0] },
        },
        last: { $max: '$at' },
      },
    },
  ]);
  return rows
    .map((r) => ({
      topic: r._id,
      answers: r.answers,
      accuracy: r.correct / r.answers,
      recentAccuracy: r.recentAnswers >= 3 ? r.recentCorrect / r.recentAnswers : null,
      previousAccuracy: r.prevAnswers >= 3 ? r.prevCorrect / r.prevAnswers : null,
      lastPracticedAt: r.last?.toISOString() ?? null,
      enoughData: r.answers >= MIN_TOPIC_EVIDENCE,
    }))
    .sort((a, b) => Number(b.enoughData) - Number(a.enoughData) || a.accuracy - b.accuracy);
}

export async function getErrorAnalytics(userId: string, language: string): Promise<ErrorAnalyticsDTO> {
  const uid = new Types.ObjectId(userId);
  const isError = { $cond: [{ $in: ['$verdict', ['incorrect', 'almost']] }, 1, 0] };
  const groupBy = (field: string) =>
    AnswerEvent.aggregate<{ _id: string; errors: number; answers: number }>([
      firstAttempts(uid, language),
      { $group: { _id: `$${field}`, errors: { $sum: isError }, answers: { $sum: 1 } } },
      { $sort: { errors: -1 } },
    ]);
  const [byCategory, byType, bySkill, recent, total] = await Promise.all([
    AnswerEvent.aggregate<{ _id: ErrorCategory; errors: number }>([
      firstAttempts(uid, language, { verdict: { $in: ['incorrect', 'almost'] } }),
      { $group: { _id: '$category', errors: { $sum: 1 } } },
      { $sort: { errors: -1 } },
    ]),
    groupBy('type'),
    groupBy('skill'),
    AnswerEvent.find({ user: userId, language, verdict: { $in: ['incorrect', 'almost'] } }).sort({ at: -1 }).limit(20).lean(),
    AnswerEvent.countDocuments({ user: userId, language, isRetry: false, verdict: { $ne: 'skipped' } }),
  ]);
  return {
    byCategory: byCategory.map((c) => ({ category: c._id, errors: c.errors, answers: total, rate: total ? c.errors / total : 0 })),
    byExerciseType: byType.map((t) => ({ type: t._id as ExerciseType, errors: t.errors, answers: t.answers, rate: t.answers ? t.errors / t.answers : 0 })),
    bySkill: bySkill.map((t) => ({ skill: t._id as Skill, errors: t.errors, answers: t.answers, rate: t.answers ? t.errors / t.answers : 0 })),
    recent: recent.map((e) => ({
      at: e.at.toISOString(),
      topic: e.topic,
      category: e.category as ErrorCategory,
      type: e.type as ExerciseType,
      prompt: e.prompt,
      given: e.given,
      expected: e.expected,
    })),
  };
}

export async function getSrsAnalytics(userId: string, language: string, now = new Date()): Promise<SrsAnalyticsDTO> {
  const { tz } = await userTz(userId);
  const [items, logs] = await Promise.all([
    ReviewItem.find({ user: userId, language }).lean(),
    ReviewLog.find({ user: userId, language, at: { $gte: new Date(+now - 30 * DAY) } }).select('quality').lean(),
  ]);
  const endToday = endOfLocalDay(now, tz);
  const startToday = startOfLocalDay(now, tz);
  const forecastDates = lastLocalDates(new Date(+now + 13 * DAY), 14, tz);
  const forecast = new Map(forecastDates.map((d) => [d, 0]));
  const states: Record<SrsState, number> = { new: 0, learning: 0, review: 0, mastered: 0, leech: 0 };
  for (const item of items) {
    states[srsState(item)] += 1;
    const offset = Math.max(0, localDaysBetween(now, item.dueAt, tz));
    const date = forecastDates[offset];
    if (date && forecast.has(date)) forecast.set(date, (forecast.get(date) ?? 0) + 1);
  }
  const leechItems = items.filter((i) => srsState(i) === 'leech').sort((a, b) => b.lapses - a.lapses).slice(0, 10);
  const leechWords = await Word.find({ _id: { $in: leechItems.map((l) => l.word) } }).select('term translation').lean();
  const wordById = new Map(leechWords.map((w) => [String(w._id), w]));
  return {
    dueToday: items.filter((i) => i.dueAt <= endToday).length,
    overdue: items.filter((i) => i.lastReviewedAt && i.dueAt < startToday).length,
    forecast: [...forecast.entries()].map(([date, count]) => ({ date, count })),
    retention30d: logs.length ? logs.filter((l) => l.quality >= 3).length / logs.length : null,
    reviews30d: logs.length,
    states,
    leeches: leechItems.map((l) => {
      const w = wordById.get(String(l.word));
      return { wordId: String(l.word), term: w?.term ?? '', translation: localize(w?.translation as LocalizedText | undefined), lapses: l.lapses };
    }),
  };
}
