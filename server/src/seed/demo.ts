import { DateTime } from 'luxon';
import type { Exercise, LearningGoal } from '@linguapath/shared';
import { seededRandom } from '../lib/text';
import { Lesson, Test } from '../models/content';
import { Attempt } from '../models/learning';
import { Enrollment, User } from '../models/user';
import { hashPassword } from '../modules/auth/service';
import {
  completeAttempt,
  startLessonAttempt,
  startPlacementAttempt,
  startPracticeAttempt,
  startTestAttempt,
  submitAnswer,
} from '../modules/learning/attempts';
import { answerReview, getReviewQueue } from '../modules/srs/service';
import { simulateAnswer } from './answer-sim';

const TZ = 'Asia/Almaty';

interface Profile {
  email: string;
  name: string;
  goals: LearningGoal[];
  dailyMinutes: number;
  language: string;
  /** Probability of a correct answer per topic; `default` for the rest. */
  skill: Record<string, number> & { default: number };
  reviewRecall: number;
  /** Placement: how many items of each level block are answered correctly. */
  placementCorrect?: Partial<Record<string, number>>;
  /** Activity script: [daysAgo, action]. */
  script: Array<[number, Action]>;
}

type Action =
  | { kind: 'placement' }
  | { kind: 'lesson'; key: string }
  | { kind: 'module_test'; lessonKey: string }
  | { kind: 'practice'; topic: string }
  | { kind: 'review' };

function at(daysAgo: number, hour: number, now: Date) {
  return DateTime.fromJSDate(now).setZone(TZ).minus({ days: daysAgo }).set({ hour, minute: 0, second: 0 }).toJSDate();
}

async function runAttempt(userId: string, attemptId: string, profile: Profile, rand: () => number, start: Date) {
  let clock = +start;
  for (let guard = 0; guard < 80; guard++) {
    const attempt = await Attempt.findById(attemptId);
    if (!attempt || attempt.position >= attempt.items.length) break;
    const item = attempt.items[attempt.position]!;
    const ex = item.exercise as Exercise;
    let correct = rand() < (profile.skill[ex.topic] ?? profile.skill.default);
    if (attempt.kind === 'placement') {
      const block = attempt.items.filter((i) => i.level === item.level);
      correct = block.indexOf(item) < (profile.placementCorrect?.[item.level ?? ''] ?? 0);
    }
    const timeMs = Math.round(6000 + rand() * 14000);
    clock += timeMs + 2000;
    await submitAnswer(userId, attemptId, { itemIndex: attempt.position, answer: simulateAnswer(ex, correct), timeMs }, 'ru', new Date(clock));
  }
  await completeAttempt(userId, attemptId, 'ru', new Date(clock + 1000));
}

async function runReviews(userId: string, profile: Profile, rand: () => number, when: Date) {
  const queue = await getReviewQueue(userId, profile.language, when, TZ);
  let clock = +when;
  for (const card of queue.cards) {
    clock += 9000;
    const recalled = rand() < profile.reviewRecall;
    const answer =
      card.mode === 'choice'
        ? { mode: 'choice' as const, option: recalled ? card.translation : (card.options ?? []).find((o) => o !== card.translation) ?? '—', timeMs: 5000 }
        : card.mode === 'typed'
          ? { mode: 'typed' as const, text: recalled ? card.term : '—', timeMs: 7000 }
          : { mode: 'flip' as const, grade: recalled ? ('good' as const) : ('again' as const) };
    await answerReview(userId, card.wordId, answer, new Date(clock), TZ);
  }
}

export async function createDemoLearner(profile: Profile, password: string, now = new Date()) {
  const existing = await User.findOne({ email: profile.email });
  if (existing) return { created: false, id: String(existing._id) };
  const user = await User.create({
    email: profile.email,
    name: profile.name,
    passwordHash: await hashPassword(password),
    isDemo: true,
    timezone: TZ,
    goals: profile.goals,
    dailyMinutes: profile.dailyMinutes,
    activeLanguage: profile.language,
    onboarded: true,
  });
  const userId = String(user._id);
  const firstDay = Math.max(...profile.script.map(([d]) => d));
  await Enrollment.create({ user: userId, language: profile.language, level: 'A1', createdAt: at(firstDay, 18, now) });
  const rand = seededRandom(profile.email.length * 7919);

  for (const [daysAgo, action] of [...profile.script].sort((a, b) => b[0] - a[0])) {
    const when = at(daysAgo, action.kind === 'review' ? 8 : 19, now);
    if (action.kind === 'review') {
      await runReviews(userId, profile, rand, when);
      continue;
    }
    let attemptId: string;
    if (action.kind === 'placement') attemptId = String((await startPlacementAttempt(userId, profile.language, when))._id);
    else if (action.kind === 'lesson') {
      const lesson = await Lesson.findOne({ key: action.key }).lean();
      if (!lesson) continue;
      attemptId = String((await startLessonAttempt(userId, String(lesson._id), undefined, when))._id);
    } else if (action.kind === 'module_test') {
      const lesson = await Lesson.findOne({ key: action.lessonKey }).lean();
      const test = lesson ? await Test.findOne({ kind: 'module', module: lesson.module }).lean() : null;
      if (!test) continue;
      attemptId = String((await startTestAttempt(userId, String(test._id), undefined, when))._id);
    } else {
      attemptId = String((await startPracticeAttempt(userId, profile.language, { topic: action.topic, now: when }))._id);
    }
    await runAttempt(userId, attemptId, profile, rand, when);
  }
  await User.updateOne({ _id: userId }, { $set: { lastActiveAt: at(Math.min(...profile.script.map(([d]) => d)), 20, now) } });
  return { created: true, id: userId };
}

export const DEMO_PROFILES: Profile[] = [
  {
    email: 'demo@linguapath.local',
    name: 'Алия Демо',
    goals: ['travel', 'conversation'],
    dailyMinutes: 20,
    language: 'de',
    skill: { default: 0.88, cases: 0.35, possessive: 0.45, articles: 0.5 },
    reviewRecall: 0.8,
    placementCorrect: { A1: 1 },
    script: [
      [20, { kind: 'placement' }],
      [19, { kind: 'lesson', key: 'de-a1-greetings' }],
      [18, { kind: 'review' }],
      [17, { kind: 'lesson', key: 'de-a1-sein' }],
      [15, { kind: 'review' }],
      [15, { kind: 'lesson', key: 'de-a1-numbers' }],
      [13, { kind: 'lesson', key: 'de-a1-family' }],
      [12, { kind: 'review' }],
      [10, { kind: 'lesson', key: 'de-a1-cafe' }],
      [9, { kind: 'module_test', lessonKey: 'de-a1-greetings' }],
      [8, { kind: 'review' }],
      [7, { kind: 'practice', topic: 'possessive' }],
      [5, { kind: 'review' }],
      [4, { kind: 'practice', topic: 'cases' }],
      [2, { kind: 'review' }],
    ],
  },
  {
    email: 'arman@demo.linguapath.local',
    name: 'Арман Демо',
    goals: ['work'],
    dailyMinutes: 15,
    language: 'en',
    skill: { default: 0.85, past_tense: 0.5, articles: 0.55 },
    reviewRecall: 0.85,
    placementCorrect: { A1: 2 },
    script: [
      [14, { kind: 'placement' }],
      [13, { kind: 'lesson', key: 'en-a1-greetings' }],
      [12, { kind: 'lesson', key: 'en-a1-to-be' }],
      [10, { kind: 'review' }],
      [9, { kind: 'lesson', key: 'en-a1-numbers' }],
      [6, { kind: 'review' }],
      [5, { kind: 'lesson', key: 'en-a1-family' }],
      [3, { kind: 'review' }],
    ],
  },
  {
    email: 'dana@demo.linguapath.local',
    name: 'Дана Демо',
    goals: ['culture', 'study'],
    dailyMinutes: 10,
    language: 'de',
    skill: { default: 0.75, cases: 0.4, to_be: 0.6 },
    reviewRecall: 0.7,
    script: [
      [11, { kind: 'lesson', key: 'de-a1-greetings' }],
      [10, { kind: 'lesson', key: 'de-a1-sein' }],
      [8, { kind: 'review' }],
      [6, { kind: 'lesson', key: 'de-a1-cafe' }],
      [1, { kind: 'review' }],
    ],
  },
  {
    email: 'timur@demo.linguapath.local',
    name: 'Тимур Демо',
    goals: ['travel'],
    dailyMinutes: 15,
    language: 'de',
    skill: { default: 0.8, cases: 0.45, possessive: 0.55 },
    reviewRecall: 0.75,
    script: [
      [9, { kind: 'lesson', key: 'de-a1-greetings' }],
      [8, { kind: 'lesson', key: 'de-a1-family' }],
      [6, { kind: 'review' }],
      [5, { kind: 'lesson', key: 'de-a1-cafe' }],
      [3, { kind: 'review' }],
    ],
  },
];
