import type { ReviewGrade, SrsState, Verdict } from '@slog/shared';
import { addLocalDays, localDaysBetween } from '../../lib/time';

export interface SrsSchedule {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueAt: Date;
  lastReviewedAt: Date | null;
}

export const SM2 = {
  initialEase: 2.5,
  minEase: 1.3,
  maxIntervalDays: 365,
  firstInterval: 1,
  secondInterval: 6,
  /** Share of the overdue time credited to the interval when the word was still recalled well. */
  overdueCredit: 0.5,
  leechLapses: 4,
  masteredIntervalDays: 21,
} as const;

/** Quality 0–5 as in SM-2: values below 3 mean the word was not recalled. */
export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

export function gradeToQuality(grade: ReviewGrade): Quality {
  return ({ again: 1, hard: 3, good: 4, easy: 5 } as const)[grade];
}

/**
 * Quality inferred from an auto-checked answer. Fast correct recall counts as
 * "easy"; recognition (multiple choice) is easier than recall, so it is capped at 4.
 */
export function verdictToQuality(verdict: Verdict, mode: 'typed' | 'choice', timeMs?: number): Quality {
  if (verdict === 'correct') {
    if (mode === 'choice') return 4;
    return timeMs !== undefined && timeMs > 0 && timeMs < 8000 ? 5 : 4;
  }
  if (verdict === 'almost') return 3;
  return 1;
}

export function newSchedule(now: Date, tz: string, firstReviewInDays = 1): SrsSchedule {
  return {
    easeFactor: SM2.initialEase,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    dueAt: addLocalDays(now, firstReviewInDays, tz),
    lastReviewedAt: null,
  };
}

function nextEase(ease: number, q: Quality): number {
  const updated = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  return Math.max(SM2.minEase, Math.round(updated * 1000) / 1000);
}

/**
 * Simplified SM-2 with three documented deviations:
 * 1. A failure on a word that has never been recalled does not lower the ease again,
 *    which avoids the "low-interval hell" caused by repeated early failures.
 * 2. When a word is recalled (q ≥ 4) after its due date, half of the overdue time is
 *    credited to the previous interval: the learner demonstrably kept it longer.
 * 3. Due dates are aligned to the start of the learner's local day, so a review is
 *    available for the whole calendar day regardless of time zone.
 */
export function schedule(prev: SrsSchedule, quality: Quality, now: Date, tz: string): SrsSchedule & { overdueDays: number } {
  const overdueDays = Math.max(0, localDaysBetween(prev.dueAt, now, tz));

  if (quality < 3) {
    const learned = prev.repetitions > 0;
    return {
      easeFactor: learned ? nextEase(prev.easeFactor, quality) : prev.easeFactor,
      intervalDays: SM2.firstInterval,
      repetitions: 0,
      lapses: prev.lapses + (learned || prev.lastReviewedAt ? 1 : 0),
      dueAt: addLocalDays(now, SM2.firstInterval, tz),
      lastReviewedAt: now,
      overdueDays,
    };
  }

  const easeFactor = nextEase(prev.easeFactor, quality);
  const repetitions = prev.repetitions + 1;
  let intervalDays: number;
  if (repetitions === 1) intervalDays = SM2.firstInterval;
  else if (repetitions === 2) intervalDays = SM2.secondInterval;
  else {
    const credited = quality >= 4 ? prev.intervalDays + overdueDays * SM2.overdueCredit : prev.intervalDays;
    intervalDays = Math.round(credited * easeFactor);
  }
  intervalDays = Math.min(SM2.maxIntervalDays, Math.max(1, intervalDays));

  return {
    easeFactor,
    intervalDays,
    repetitions,
    lapses: prev.lapses,
    dueAt: addLocalDays(now, intervalDays, tz),
    lastReviewedAt: now,
    overdueDays,
  };
}

export function srsState(s: Pick<SrsSchedule, 'repetitions' | 'lapses' | 'intervalDays'> & { lastReviewedAt?: Date | null }): SrsState {
  if (!s.lastReviewedAt) return 'new';
  if (s.lapses >= SM2.leechLapses && s.repetitions < 2) return 'leech';
  if (s.intervalDays >= SM2.masteredIntervalDays) return 'mastered';
  if (s.repetitions < 2) return 'learning';
  return 'review';
}
