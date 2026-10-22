import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { SM2, gradeToQuality, newSchedule, schedule, srsState, verdictToQuality, type SrsSchedule } from '../../src/modules/srs/sm2';

const TZ = 'Asia/Almaty';
const day0 = DateTime.fromISO('2026-03-02T09:00', { zone: TZ }).toJSDate();
const plusDays = (d: Date, n: number, hour = 9) => DateTime.fromJSDate(d).setZone(TZ).plus({ days: n }).set({ hour }).toJSDate();
const localDate = (d: Date) => DateTime.fromJSDate(d).setZone(TZ).toISODate();

describe('newSchedule', () => {
  it('schedules a newly introduced word for the next local day', () => {
    const s = newSchedule(day0, TZ);
    expect(s).toMatchObject({ easeFactor: 2.5, intervalDays: 0, repetitions: 0, lapses: 0, lastReviewedAt: null });
    expect(localDate(s.dueAt)).toBe('2026-03-03');
    expect(DateTime.fromJSDate(s.dueAt).setZone(TZ).hour).toBe(0);
  });
});

describe('schedule (simplified SM-2)', () => {
  it('grows intervals 1 → 6 → round(6 × EF) on successful recall', () => {
    let s: SrsSchedule = newSchedule(day0, TZ);
    let now = plusDays(day0, 1);
    s = schedule(s, 4, now, TZ);
    expect(s).toMatchObject({ repetitions: 1, intervalDays: 1 });
    now = plusDays(now, 1);
    s = schedule(s, 4, now, TZ);
    expect(s).toMatchObject({ repetitions: 2, intervalDays: 6 });
    now = plusDays(now, 6);
    s = schedule(s, 4, now, TZ);
    expect(s.repetitions).toBe(3);
    expect(s.intervalDays).toBe(Math.round(6 * s.easeFactor));
    expect(localDate(s.dueAt)).toBe(localDate(plusDays(now, s.intervalDays)));
  });

  it('applies the SM-2 ease update: easy raises it, hard lowers it', () => {
    const s = newSchedule(day0, TZ);
    expect(schedule(s, 5, day0, TZ).easeFactor).toBeCloseTo(2.6);
    expect(schedule(s, 4, day0, TZ).easeFactor).toBeCloseTo(2.5);
    expect(schedule(s, 3, day0, TZ).easeFactor).toBeCloseTo(2.36);
  });

  it('resets repetitions and counts a lapse when a learned word is forgotten', () => {
    let s = schedule(newSchedule(day0, TZ), 4, day0, TZ);
    s = schedule(s, 4, plusDays(day0, 1), TZ);
    const failed = schedule(s, 1, plusDays(day0, 7), TZ);
    expect(failed).toMatchObject({ repetitions: 0, intervalDays: 1, lapses: 1 });
    expect(failed.easeFactor).toBeLessThan(s.easeFactor);
  });

  it('does not keep lowering the ease on repeated failures of an unlearned word', () => {
    let s = schedule(newSchedule(day0, TZ), 1, day0, TZ);
    const ease = s.easeFactor;
    for (let i = 1; i <= 5; i++) s = schedule(s, 1, plusDays(day0, i), TZ);
    expect(s.easeFactor).toBe(ease);
    expect(s.lapses).toBe(5);
    expect(srsState(s)).toBe('leech');
  });

  it('never lets the ease fall below the floor', () => {
    let s: SrsSchedule = { ...newSchedule(day0, TZ), repetitions: 3, intervalDays: 10, easeFactor: 1.35 };
    s = schedule(s, 3, day0, TZ);
    expect(s.easeFactor).toBe(SM2.minEase);
  });

  it('credits part of the overdue time when a late review is still recalled well', () => {
    const due = plusDays(day0, 0, 0);
    const prev: SrsSchedule = { easeFactor: 2.5, intervalDays: 10, repetitions: 3, lapses: 0, dueAt: due, lastReviewedAt: plusDays(day0, -10) };
    const onTime = schedule(prev, 4, day0, TZ);
    const late = schedule(prev, 4, plusDays(day0, 10), TZ);
    expect(late.overdueDays).toBe(10);
    expect(onTime.intervalDays).toBe(25);
    expect(late.intervalDays).toBe(Math.round((10 + 10 * SM2.overdueCredit) * 2.5));
    const lateHard = schedule(prev, 3, plusDays(day0, 10), TZ);
    expect(lateHard.intervalDays).toBe(Math.round(10 * lateHard.easeFactor));
  });

  it('caps intervals at the maximum', () => {
    const prev: SrsSchedule = { easeFactor: 3, intervalDays: 300, repetitions: 8, lapses: 0, dueAt: day0, lastReviewedAt: plusDays(day0, -300) };
    expect(schedule(prev, 5, day0, TZ).intervalDays).toBe(SM2.maxIntervalDays);
  });

  it('aligns due dates to the learner’s local day in different time zones', () => {
    const lateEvening = DateTime.fromISO('2026-03-02T23:30', { zone: 'America/New_York' }).toJSDate();
    const s = schedule(newSchedule(lateEvening, 'America/New_York'), 4, lateEvening, 'America/New_York');
    expect(DateTime.fromJSDate(s.dueAt).setZone('America/New_York').toISODate()).toBe('2026-03-03');
    const sameMomentAlmaty = schedule(newSchedule(lateEvening, TZ), 4, lateEvening, TZ);
    expect(DateTime.fromJSDate(sameMomentAlmaty.dueAt).setZone(TZ).toISODate()).toBe('2026-03-04');
  });
});

describe('quality mapping', () => {
  it('maps self-grades and auto-checked answers to SM-2 quality', () => {
    expect(gradeToQuality('again')).toBe(1);
    expect(gradeToQuality('easy')).toBe(5);
    expect(verdictToQuality('correct', 'typed', 3000)).toBe(5);
    expect(verdictToQuality('correct', 'typed', 15000)).toBe(4);
    expect(verdictToQuality('correct', 'choice', 1000)).toBe(4);
    expect(verdictToQuality('almost', 'typed')).toBe(3);
    expect(verdictToQuality('incorrect', 'choice')).toBe(1);
  });

  it('classifies states', () => {
    expect(srsState({ repetitions: 0, lapses: 0, intervalDays: 0, lastReviewedAt: null })).toBe('new');
    expect(srsState({ repetitions: 1, lapses: 0, intervalDays: 1, lastReviewedAt: day0 })).toBe('learning');
    expect(srsState({ repetitions: 3, lapses: 0, intervalDays: 15, lastReviewedAt: day0 })).toBe('review');
    expect(srsState({ repetitions: 5, lapses: 0, intervalDays: 40, lastReviewedAt: day0 })).toBe('mastered');
  });
});
