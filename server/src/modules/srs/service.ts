import { Types } from 'mongoose';
import {
  localize,
  type ReviewAnswer,
  type ReviewAnswerResultDTO,
  type ReviewCardDTO,
  type ReviewMode,
  type ReviewQueueDTO,
  type Verdict,
} from '@slog/shared';
import { errors } from '../../lib/errors';
import { matchText, shuffle, strictKey } from '../../lib/text';
import { endOfLocalDay, startOfLocalDay } from '../../lib/time';
import { Word } from '../../models/content';
import { ReviewItem, ReviewLog } from '../../models/learning';
import { User } from '../../models/user';
import { gradeToQuality, newSchedule, schedule, srsState, verdictToQuality, type Quality } from './sm2';

export const QUEUE_LIMITS = { sessionSize: 20, newPerDay: 15 } as const;

type WordLean = {
  _id: Types.ObjectId;
  term: string;
  translation: { ru: string };
  partOfSpeech: string;
  gender?: string | null;
  example: string;
  exampleTranslation: { ru: string };
  audioUrl?: string | null;
  topic: string;
};

/** Adds words to the learner's review schedule; already scheduled words are left untouched. */
export async function introduceWords(userId: string, language: string, wordIds: Types.ObjectId[], now: Date, tz: string): Promise<number> {
  if (wordIds.length === 0) return 0;
  const initial = newSchedule(now, tz);
  const result = await ReviewItem.bulkWrite(
    wordIds.map((word) => ({
      updateOne: {
        filter: { user: new Types.ObjectId(userId), word },
        update: { $setOnInsert: { language, introducedAt: now, ...initial } },
        upsert: true,
      },
    })),
  );
  return result.upsertedCount;
}

async function countNewReviewedToday(userId: string, language: string, now: Date, tz: string) {
  const dayStart = startOfLocalDay(now, tz);
  const logs = await ReviewLog.aggregate<{ _id: Types.ObjectId }>([
    { $match: { user: new Types.ObjectId(userId), language, at: { $gte: dayStart } } },
    { $group: { _id: '$word' } },
  ]);
  if (logs.length === 0) return 0;
  return ReviewItem.countDocuments({
    user: userId,
    word: { $in: logs.map((l) => l._id) },
    introducedAt: { $gte: dayStart },
  });
}

function chooseMode(repetitions: number, lapses: number, preferred: 'auto' | 'flip'): ReviewMode {
  if (preferred === 'flip') return 'flip';
  if (lapses >= 4) return 'flip';
  return repetitions < 2 ? 'choice' : 'typed';
}

export async function getReviewQueue(
  userId: string,
  language: string,
  now: Date,
  tz: string,
  preferred: 'auto' | 'flip' = 'auto',
  locale = 'ru',
): Promise<ReviewQueueDTO> {
  const dayEnd = endOfLocalDay(now, tz);
  const due = await ReviewItem.find({ user: userId, language, dueAt: { $lte: dayEnd } }).lean();
  const reviewed = due.filter((d) => d.lastReviewedAt);
  const fresh = due.filter((d) => !d.lastReviewedAt).sort((a, b) => +a.introducedAt - +b.introducedAt);

  const newAllowance = Math.max(0, QUEUE_LIMITS.newPerDay - (await countNewReviewedToday(userId, language, now, tz)));
  // Most overdue relative to their interval first: those are closest to being forgotten.
  reviewed.sort((a, b) => {
    const ra = (+now - +a.dueAt) / Math.max(1, a.intervalDays);
    const rb = (+now - +b.dueAt) / Math.max(1, b.intervalDays);
    return rb - ra;
  });
  const selected = [...reviewed, ...fresh.slice(0, newAllowance)].slice(0, QUEUE_LIMITS.sessionSize);

  const words = await Word.find({ _id: { $in: selected.map((s) => s.word) } }).lean<WordLean[]>();
  const byId = new Map(words.map((w) => [String(w._id), w]));
  const distractorPool = await Word.find({ language, isPublished: true }).select('translation topic').lean<WordLean[]>();

  const cards: ReviewCardDTO[] = [];
  for (const item of selected) {
    const word = byId.get(String(item.word));
    if (!word) continue;
    const mode = chooseMode(item.repetitions, item.lapses, preferred);
    const translation = localize(word.translation, locale);
    let options: string[] | undefined;
    if (mode === 'choice') {
      const seed = parseInt(String(item._id).slice(-6), 16);
      const sameTopic = distractorPool.filter((w) => w.topic === word.topic && String(w._id) !== String(word._id));
      const others = distractorPool.filter((w) => w.topic !== word.topic);
      const pool = [...shuffle(sameTopic, seed), ...shuffle(others, seed + 1)]
        .map((w) => localize(w.translation, locale))
        .filter((t, i, arr) => t !== translation && arr.indexOf(t) === i);
      options = shuffle([translation, ...pool.slice(0, 3)], seed + 2);
    }
    cards.push({
      wordId: String(word._id),
      term: word.term,
      translation,
      partOfSpeech: word.partOfSpeech,
      gender: word.gender ?? null,
      example: word.example,
      exampleTranslation: localize(word.exampleTranslation, locale),
      audioUrl: word.audioUrl ?? null,
      mode,
      options,
      state: srsState(item),
      isNew: !item.lastReviewedAt,
    });
  }

  return {
    language,
    dueCount: reviewed.length,
    newCount: Math.min(fresh.length, newAllowance),
    cards,
  };
}

export async function answerReview(
  userId: string,
  wordId: string,
  answer: ReviewAnswer,
  now: Date,
  tz: string,
  locale = 'ru',
): Promise<ReviewAnswerResultDTO> {
  const item = await ReviewItem.findOne({ user: userId, word: wordId });
  if (!item) throw errors.notFound();
  const word = await Word.findById(wordId).lean<WordLean>();
  if (!word) throw errors.notFound();

  let verdict: Verdict;
  let quality: Quality;
  let expected: string;
  if (answer.mode === 'flip') {
    quality = gradeToQuality(answer.grade);
    verdict = quality >= 3 ? 'correct' : 'incorrect';
    expected = word.term;
  } else if (answer.mode === 'typed') {
    const m = matchText(answer.text, [word.term], item.language);
    verdict = m.verdict;
    quality = verdictToQuality(verdict, 'typed', answer.timeMs);
    expected = word.term;
  } else {
    expected = localize(word.translation, locale);
    verdict = strictKey(answer.option, locale) === strictKey(expected, locale) ? 'correct' : 'incorrect';
    quality = verdictToQuality(verdict, 'choice', answer.timeMs);
  }

  const prev = {
    easeFactor: item.easeFactor,
    intervalDays: item.intervalDays,
    repetitions: item.repetitions,
    lapses: item.lapses,
    dueAt: item.dueAt,
    lastReviewedAt: item.lastReviewedAt ?? null,
  };
  const next = schedule(prev, quality, now, tz);
  item.set({
    easeFactor: next.easeFactor,
    intervalDays: next.intervalDays,
    repetitions: next.repetitions,
    lapses: next.lapses,
    dueAt: next.dueAt,
    lastReviewedAt: next.lastReviewedAt,
  });
  await item.save();
  await ReviewLog.create({
    user: userId,
    word: wordId,
    language: item.language,
    at: now,
    mode: answer.mode,
    quality,
    verdict,
    prevIntervalDays: prev.intervalDays,
    newIntervalDays: next.intervalDays,
    prevEase: prev.easeFactor,
    newEase: next.easeFactor,
    overdueDays: next.overdueDays,
    timeMs: answer.mode === 'flip' ? 0 : Math.min(answer.timeMs ?? 0, 120_000),
  });
  await User.updateOne({ _id: userId }, { $set: { lastActiveAt: now } });

  return {
    verdict,
    quality,
    expected,
    nextDueAt: next.dueAt.toISOString(),
    intervalDays: next.intervalDays,
    easeFactor: next.easeFactor,
    repetitions: next.repetitions,
  };
}
