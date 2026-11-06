import crypto from 'node:crypto';
import { DateTime } from 'luxon';
import { Types } from 'mongoose';
import {
  CEFR_LEVELS,
  MILESTONE_KEYS,
  type AchievementsDTO,
  type CefrLevel,
  type CertificateDTO,
  type LevelStatusDTO,
  type MilestoneDTO,
  type MilestoneKey,
} from '@linguapath/shared';
import { errors } from '../../lib/errors';
import { localize } from '@linguapath/shared';
import { Language } from '../../models/content';
import { Achievement, AnswerEvent, Attempt, Certificate, LessonProgress, ReviewItem, ReviewLog } from '../../models/learning';
import { Enrollment, User } from '../../models/user';
import { getTimeline } from '../analytics/service';
import { loadCatalog } from '../catalog/catalog';

/**
 * Motivation without pressure. A week has a modest goal (four active days) and a missed day costs nothing; milestones
 * mark real learning (words recalled in spaced review, finished levels, written texts) and are never taken away;
 * a certificate is issued for a level once every lesson is passed and every module test of the level is passed.
 */

const GOAL_DAYS_PER_WEEK = 4;
const NEW_FOR_MS = 10 * 60_000;
const MIN_GAP_FOR_COMEBACK = 7;

const TARGET: Record<MilestoneKey, number> = {
  placement: 1,
  first_lesson: 1,
  perfect_lesson: 1,
  module_test: 1,
  words_20: 20,
  words_50: 50,
  words_100: 100,
  days_7: 7,
  days_30: 30,
  writing_5: 5,
  listening_10: 10,
  comeback: 1,
  level_complete: 1,
};

interface LearnerFacts {
  tz: string;
  name: string;
  dailyMinutes: number;
  placementDone: boolean;
  completedLessons: Map<string, number>;
  perfectLesson: boolean;
  passedModuleTests: Set<string>;
  wordsInMemory: number;
  wordsIntroduced: number;
  activeDates: string[];
  writing: number;
  listening: number;
  minutes: number;
  certificates: Array<CertificateDTO>;
}

async function gatherFacts(userId: string, language: string): Promise<LearnerFacts> {
  const uid = new Types.ObjectId(userId);
  const [user, enrollment] = await Promise.all([User.findById(userId).lean(), Enrollment.findOne({ user: userId, language }).lean()]);
  if (!user) throw errors.notFound();
  if (!enrollment) throw errors.badRequest('not_enrolled');
  const tz = user.timezone;
  const dateExpr = { $dateToString: { format: '%Y-%m-%d', date: '$at', timezone: tz } };
  const [progress, perfect, tests, words, answerDays, reviewDays, counts, reviewMs, certificates] = await Promise.all([
    LessonProgress.find({ user: userId, language, status: 'completed' }).select('lesson bestPercent').lean(),
    Attempt.exists({ user: userId, language, kind: 'lesson', status: 'completed', 'result.percent': 100 }),
    Attempt.find({ user: userId, language, kind: 'test', status: 'completed', 'result.passed': true }).select('test').lean(),
    ReviewItem.aggregate<{ introduced: number; inMemory: number }>([
      { $match: { user: uid, language } },
      { $group: { _id: null, introduced: { $sum: 1 }, inMemory: { $sum: { $cond: [{ $gte: ['$repetitions', 2] }, 1, 0] } } } },
    ]),
    AnswerEvent.aggregate<{ _id: string }>([{ $match: { user: uid, language } }, { $group: { _id: dateExpr } }]),
    ReviewLog.aggregate<{ _id: string }>([{ $match: { user: uid, language } }, { $group: { _id: dateExpr } }]),
    AnswerEvent.aggregate<{ writing: number; listening: number; ms: number }>([
      { $match: { user: uid, language, verdict: { $ne: 'skipped' } } },
      {
        $group: {
          _id: null,
          writing: { $sum: { $cond: [{ $eq: ['$type', 'writing'] }, 1, 0] } },
          listening: { $sum: { $cond: [{ $eq: ['$skill', 'listening'] }, 1, 0] } },
          ms: { $sum: '$timeMs' },
        },
      },
    ]),
    ReviewLog.aggregate<{ ms: number }>([{ $match: { user: uid, language } }, { $group: { _id: null, ms: { $sum: '$timeMs' } } }]),
    Certificate.find({ user: userId, language }).lean(),
  ]);
  return {
    tz,
    name: user.name,
    dailyMinutes: user.dailyMinutes ?? 15,
    placementDone: !!enrollment.placementAt,
    completedLessons: new Map(progress.map((p) => [String(p.lesson), p.bestPercent ?? 0])),
    perfectLesson: !!perfect,
    passedModuleTests: new Set(tests.map((t) => String(t.test))),
    wordsInMemory: words[0]?.inMemory ?? 0,
    wordsIntroduced: words[0]?.introduced ?? 0,
    activeDates: [...new Set([...answerDays, ...reviewDays].map((d) => d._id))].sort(),
    writing: counts[0]?.writing ?? 0,
    listening: counts[0]?.listening ?? 0,
    minutes: Math.round(((counts[0]?.ms ?? 0) + (reviewMs[0]?.ms ?? 0)) / 60000),
    certificates: certificates.map(toCertificateDTO),
  };
}

function hadComeback(dates: string[]): boolean {
  for (let i = 1; i < dates.length; i++) {
    const gap = DateTime.fromISO(dates[i]!).diff(DateTime.fromISO(dates[i - 1]!), 'days').days;
    if (gap >= MIN_GAP_FOR_COMEBACK) return true;
  }
  return false;
}

async function levelStatuses(language: string, facts: LearnerFacts): Promise<LevelStatusDTO[]> {
  const catalog = await loadCatalog(language);
  const moduleLevel = new Map(catalog.modules.map((m) => [m.id, m.level]));
  return CEFR_LEVELS.flatMap((level) => {
    const lessons = catalog.lessons.filter((l) => l.level === level);
    if (!lessons.length) return [];
    const tests = catalog.tests.filter((t) => t.kind === 'module' && t.moduleId && moduleLevel.get(t.moduleId) === level);
    const completed = lessons.filter((l) => facts.completedLessons.has(l.id)).length;
    const passed = tests.filter((t) => facts.passedModuleTests.has(t.id)).length;
    return [
      {
        level,
        lessons: { completed, total: lessons.length },
        moduleTests: { passed, total: tests.length },
        eligible: completed === lessons.length && passed === tests.length,
        certificate: facts.certificates.find((c) => c.level === level) ?? null,
      },
    ];
  });
}

function weekOf(timeline: Awaited<ReturnType<typeof getTimeline>>, tz: string, now: Date, dailyMinutes: number) {
  const today = DateTime.fromJSDate(now).setZone(tz).startOf('day');
  const monday = today.minus({ days: today.weekday - 1 });
  const byDate = new Map(timeline.map((d) => [d.date, d]));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = monday.plus({ days: i }).toISODate()!;
    const point = byDate.get(date);
    const active = !!point && (point.answers > 0 || point.reviews > 0);
    return { date, minutes: point?.minutes ?? 0, active, future: date > today.toISODate()! };
  });
  return {
    minutes: days.reduce((s, d) => s + d.minutes, 0),
    goalMinutes: dailyMinutes * GOAL_DAYS_PER_WEEK,
    activeDays: days.filter((d) => d.active).length,
    goalDays: GOAL_DAYS_PER_WEEK,
    days,
  };
}

export async function getAchievements(userId: string, language: string, now = new Date()): Promise<AchievementsDTO> {
  const facts = await gatherFacts(userId, language);
  const weekday = DateTime.fromJSDate(now).setZone(facts.tz).weekday;
  const [levels, timeline] = await Promise.all([levelStatuses(language, facts), getTimeline(userId, language, Math.max(7, weekday), now)]);

  const current: Record<MilestoneKey, number> = {
    placement: facts.placementDone ? 1 : 0,
    first_lesson: Math.min(1, facts.completedLessons.size),
    perfect_lesson: facts.perfectLesson ? 1 : 0,
    module_test: Math.min(1, facts.passedModuleTests.size),
    words_20: facts.wordsInMemory,
    words_50: facts.wordsInMemory,
    words_100: facts.wordsInMemory,
    days_7: facts.activeDates.length,
    days_30: facts.activeDates.length,
    writing_5: facts.writing,
    listening_10: facts.listening,
    comeback: hadComeback(facts.activeDates) ? 1 : 0,
    level_complete: facts.certificates.length ? 1 : 0,
  };

  // The first time a milestone is reached is remembered, so it stays even if, say, a word later slips from memory.
  const stored = await Achievement.find({ user: userId, language }).lean();
  const when = new Map(stored.map((a) => [a.key as MilestoneKey, a.achievedAt]));
  const fresh = MILESTONE_KEYS.filter((k) => current[k] >= TARGET[k] && !when.has(k));
  if (fresh.length) {
    await Achievement.insertMany(
      fresh.map((key) => ({ user: userId, language, key, achievedAt: now })),
      { ordered: false },
    ).catch((err: { code?: number }) => {
      if (err.code !== 11000) throw err;
    });
    for (const k of fresh) when.set(k, now);
  }

  const milestones: MilestoneDTO[] = MILESTONE_KEYS.map((key) => {
    const at = when.get(key) ?? null;
    return {
      key,
      achieved: !!at,
      achievedAt: at ? at.toISOString() : null,
      current: at ? TARGET[key] : Math.min(current[key], TARGET[key]),
      target: TARGET[key],
      isNew: !!at && +now - +at < NEW_FOR_MS,
    };
  });

  return { language, week: weekOf(timeline, facts.tz, now, facts.dailyMinutes), milestones, levels };
}

function toCertificateDTO(c: {
  code: string;
  name: string;
  language: string;
  languageName: string;
  level: string;
  issuedAt: Date;
  stats?: { [K in keyof CertificateDTO['stats']]?: number | null } | null;
}): CertificateDTO {
  return {
    code: c.code,
    name: c.name,
    language: c.language,
    languageName: c.languageName,
    level: c.level as CefrLevel,
    issuedAt: c.issuedAt.toISOString(),
    stats: {
      lessons: c.stats?.lessons ?? 0,
      averagePercent: c.stats?.averagePercent ?? 0,
      moduleTests: c.stats?.moduleTests ?? 0,
      words: c.stats?.words ?? 0,
      minutes: c.stats?.minutes ?? 0,
      activeDays: c.stats?.activeDays ?? 0,
    },
  };
}

/** Code such as LP-7K3M-Q9TD: no 0/O or 1/I, so it can be read out and typed by hand. */
function certificateCode() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(8);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
  return `LP-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export async function issueCertificate(userId: string, language: string, level: CefrLevel, now = new Date()): Promise<CertificateDTO> {
  const facts = await gatherFacts(userId, language);
  const existing = facts.certificates.find((c) => c.level === level);
  if (existing) return existing;
  const status = (await levelStatuses(language, facts)).find((s) => s.level === level);
  if (!status?.eligible) throw errors.badRequest('certificate_not_earned');

  const catalog = await loadCatalog(language);
  const lessonIds = catalog.lessons.filter((l) => l.level === level).map((l) => l.id);
  const percents = lessonIds.map((id) => facts.completedLessons.get(id) ?? 0);
  const languageDoc = await Language.findOne({ code: language }).select('name').lean();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const doc = await Certificate.create({
        code: certificateCode(),
        user: userId,
        name: facts.name,
        language,
        languageName: languageDoc?.name ? localize(languageDoc.name as { ru: string }, 'ru') : language,
        level,
        issuedAt: now,
        stats: {
          lessons: lessonIds.length,
          averagePercent: Math.round(percents.reduce((a, b) => a + b, 0) / Math.max(1, percents.length)),
          moduleTests: status.moduleTests.total,
          words: facts.wordsIntroduced,
          minutes: facts.minutes,
          activeDays: facts.activeDates.length,
        },
      });
      return toCertificateDTO(doc.toObject());
    } catch (err) {
      const e = err as { code?: number; keyPattern?: Record<string, unknown> };
      if (e.code !== 11000) throw err;
      // Issued in parallel by a second request: return that one.
      if (e.keyPattern?.user) {
        const doc = await Certificate.findOne({ user: userId, language, level }).lean();
        if (doc) return toCertificateDTO(doc);
      }
      // Otherwise the random code collided: try another.
    }
  }
  throw new Error('certificate_code_collision');
}

export async function findCertificate(code: string): Promise<CertificateDTO> {
  const doc = await Certificate.findOne({ code: code.trim().toUpperCase() }).lean();
  if (!doc) throw errors.notFound();
  return toCertificateDTO(doc);
}
