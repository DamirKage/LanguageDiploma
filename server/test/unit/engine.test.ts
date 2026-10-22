import { describe, expect, it } from 'vitest';
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from '../../src/modules/recommendations/config';
import { recommend, smoothedAccuracy, targetDifficultyFor, type LearnerSnapshot, type TopicEvidence } from '../../src/modules/recommendations/engine';
import { composePlan } from '../../src/modules/recommendations/plan';

const NOW = new Date('2026-05-10T12:00:00Z');
const daysAgo = (n: number) => new Date(+NOW - n * 86_400_000);

function lesson(id: string, level: 'A1' | 'A2', moduleId: string, pathIndex: number, topic: string, prerequisites: string[] = []) {
  return { id, title: `Урок ${id}`, level, moduleId, pathIndex, topic, exerciseTopics: [topic], estimatedMinutes: 10, prerequisites };
}

function snapshot(overrides: Partial<LearnerSnapshot> = {}): LearnerSnapshot {
  return {
    now: NOW,
    language: 'de',
    level: 'A1',
    placementDone: true,
    goals: [],
    dailyMinutes: 20,
    lessons: [
      lesson('l1', 'A1', 'm1', 0, 'greetings'),
      lesson('l2', 'A1', 'm1', 1, 'to_be', ['l1']),
      lesson('l3', 'A1', 'm2', 2, 'family', ['l2']),
      lesson('l4', 'A2', 'm3', 3, 'past_events', ['l3']),
    ],
    modules: [
      { id: 'm1', title: 'Знакомство', level: 'A1', lessonIds: ['l1', 'l2'], test: { id: 't1', title: 'Тест 1', exerciseCount: 6 } },
      { id: 'm2', title: 'Мой мир', level: 'A1', lessonIds: ['l3'], test: { id: 't2', title: 'Тест 2', exerciseCount: 6 } },
      { id: 'm3', title: 'Истории', level: 'A2', lessonIds: ['l4'], test: null },
    ],
    progress: {},
    inProgress: [],
    testResults: {},
    topics: [],
    srs: { due: 0, overdue: 0, maxOverdueDays: 0, newAvailable: 0, retention30d: null, reviews30d: 0 },
    lastActiveAt: daysAgo(1),
    recentAccuracy: null,
    recentAnswers: 0,
    ignored: {},
    ...overrides,
  };
}

function topic(name: string, answers: number, accuracy: number, extra: Partial<TopicEvidence> = {}): TopicEvidence {
  return {
    topic: name,
    kind: 'grammar',
    answers,
    correct: answers * accuracy,
    lastPracticedAt: daysAgo(1),
    sessionAccuracies: [],
    topCategory: null,
    ...extra,
  };
}

const done = (bestPercent = 90) => ({ status: 'completed' as const, bestPercent, attempts: 1 });

describe('recommendation engine', () => {
  it('starts a brand-new learner with the placement test, then the first lesson', () => {
    const r = recommend(snapshot({ placementDone: false }));
    expect(r.items[0]).toMatchObject({ type: 'placement', reasons: [{ code: 'no_placement' }] });
    expect(r.items[1]).toMatchObject({ type: 'next_lesson', target: { lessonId: 'l1' } });
  });

  it('recommends the next lesson in path order, respecting completed lessons', () => {
    const r = recommend(snapshot({ progress: { l1: done() } }));
    expect(r.items[0]).toMatchObject({ type: 'next_lesson', key: 'lesson:l2' });
    expect(r.items[0]!.reasons.map((x) => x.code)).toContain('next_in_path');
  });

  it('prioritises a topic with consistently low accuracy and explains why', () => {
    const r = recommend(
      snapshot({
        progress: { l1: done(), l2: done(75) },
        topics: [topic('to_be', 12, 0.4, { topCategory: { category: 'grammar', count: 5 } }), topic('greetings', 10, 0.9)],
        recentAccuracy: 0.65,
        recentAnswers: 22,
      }),
    );
    expect(r.items[0]).toMatchObject({ type: 'weak_topic', target: { topic: 'to_be' } });
    const codes = r.items[0]!.reasons.map((x) => x.code);
    expect(codes).toContain('low_topic_accuracy');
    expect(codes).toContain('recurring_error');
    expect(r.items.some((i) => i.key === 'weak_topic:greetings')).toBe(false);
  });

  it('does not label a topic weak without enough evidence', () => {
    const r = recommend(snapshot({ progress: { l1: done() }, topics: [topic('to_be', 3, 0)] }));
    expect(r.items.some((i) => i.type === 'weak_topic')).toBe(false);
  });

  it('stops recommending remedial practice once the topic improves', () => {
    const weak = recommend(snapshot({ progress: { l1: done() }, topics: [topic('to_be', 10, 0.4)] }));
    const improved = recommend(snapshot({ progress: { l1: done() }, topics: [topic('to_be', 30, 0.85)] }));
    expect(weak.items.some((i) => i.key === 'weak_topic:to_be')).toBe(true);
    expect(improved.items.some((i) => i.key === 'weak_topic:to_be')).toBe(false);
  });

  it('detects a declining trend even when the overall accuracy is acceptable', () => {
    const r = recommend(snapshot({ progress: { l1: done() }, topics: [topic('to_be', 20, 0.78, { sessionAccuracies: [95, 90, 92, 55] })] }));
    const item = r.items.find((i) => i.key === 'weak_topic:to_be');
    expect(item?.reasons.map((x) => x.code)).toContain('declining_trend');
  });

  it('raises difficulty and boosts new material after consistently high accuracy', () => {
    const base = snapshot({ progress: { l1: done() } });
    const strong = recommend({ ...base, recentAccuracy: 0.95, recentAnswers: 30 });
    const neutral = recommend({ ...base, recentAccuracy: 0.75, recentAnswers: 30 });
    expect(strong.difficultyAdjustment).toBe('harder');
    expect(strong.targetDifficulty).toBe(3);
    expect(strong.items[0]!.score).toBeGreaterThan(neutral.items[0]!.score);
  });

  it('lowers difficulty and favours consolidation when recent accuracy is low', () => {
    const r = recommend(
      snapshot({ progress: { l1: done(), l2: done(60) }, topics: [topic('to_be', 10, 0.45)], recentAccuracy: 0.5, recentAnswers: 25 }),
    );
    expect(r.difficultyAdjustment).toBe('easier');
    expect(r.targetDifficulty).toBe(1);
    const weakIdx = r.items.findIndex((i) => i.type === 'weak_topic');
    const nextIdx = r.items.findIndex((i) => i.type === 'next_lesson');
    expect(weakIdx).toBeLessThan(nextIdx);
  });

  it('puts overdue reviews first after a break', () => {
    const r = recommend(
      snapshot({
        progress: { l1: done() },
        lastActiveAt: daysAgo(9),
        srs: { due: 25, overdue: 20, maxOverdueDays: 8, newAvailable: 0, retention30d: 0.6, reviews30d: 40 },
      }),
    );
    expect(r.items[0]!.type).toBe('review');
    const codes = r.items[0]!.reasons.map((x) => x.code);
    expect(codes).toEqual(expect.arrayContaining(['reviews_due', 'reviews_overdue', 'low_retention', 'returning_after_break']));
  });

  it('offers the module test once every lesson in the module is done, until it is passed', () => {
    const ready = recommend(snapshot({ progress: { l1: done(), l2: done() } }));
    expect(ready.items.some((i) => i.key === 'module_test:t1')).toBe(true);
    const passed = recommend(snapshot({ progress: { l1: done(), l2: done() }, testResults: { t1: { bestPercent: 85, passed: true } } }));
    expect(passed.items.some((i) => i.type === 'module_test')).toBe(false);
  });

  it('suggests moving to the next level after the level is complete', () => {
    const r = recommend(
      snapshot({ progress: { l1: done(), l2: done(), l3: done() }, testResults: { t1: { bestPercent: 90, passed: true }, t2: { bestPercent: 80, passed: true } } }),
    );
    expect(r.items.some((i) => i.type === 'level_up' && i.target.level === 'A2')).toBe(true);
  });

  it('suggests retrying a lesson with a low best score', () => {
    const r = recommend(snapshot({ progress: { l1: done(40) } }));
    expect(r.items.find((i) => i.type === 'retry_lesson')).toMatchObject({ target: { lessonId: 'l1' }, reasons: [{ code: 'low_lesson_score', params: { percent: 40 } }] });
  });

  it('resumes unfinished work before starting something new', () => {
    const r = recommend(
      snapshot({
        progress: { l1: done(), l2: { status: 'in_progress', bestPercent: null, attempts: 0 } },
        inProgress: [{ attemptId: 'a1', kind: 'lesson', lessonId: 'l2', testId: null, title: 'Урок l2', topic: null, answered: 6, total: 8, startedAt: daysAgo(1) }],
      }),
    );
    expect(r.items[0]).toMatchObject({ type: 'resume', target: { attemptId: 'a1' } });
    expect(r.items.some((i) => i.key === 'lesson:l2')).toBe(false);
  });

  it('suggests refreshing a mastered topic that has not been practised for a while', () => {
    const r = recommend(snapshot({ progress: { l1: done() }, topics: [topic('greetings', 15, 0.9, { lastPracticedAt: daysAgo(20) })] }));
    expect(r.items.find((i) => i.type === 'topic_refresh')).toMatchObject({ reasons: [{ code: 'not_practiced_recently', params: { days: 20 } }] });
  });

  it('gently lowers the score of items the learner keeps ignoring', () => {
    const s = snapshot({ progress: { l1: done() } });
    const fresh = recommend(s).items.find((i) => i.key === 'lesson:l2')!;
    const ignored = recommend({ ...s, ignored: { 'lesson:l2': 3 } }).items.find((i) => i.key === 'lesson:l2')!;
    expect(ignored.score).toBeLessThan(fresh.score);
    expect(ignored.features.ignored).toBe(3);
  });

  it('takes learning goals into account', () => {
    const s = snapshot({ progress: { l1: done() }, topics: [topic('family', 10, 0.5, { kind: 'vocabulary' }), topic('to_be', 10, 0.5)] });
    const withGoal = recommend({ ...s, goals: ['culture'] });
    const family = withGoal.items.find((i) => i.key === 'weak_topic:family')!;
    expect(family.reasons.map((x) => x.code)).toContain('goal_match');
    expect(withGoal.items.findIndex((i) => i.key === 'weak_topic:family')).toBeLessThan(withGoal.items.findIndex((i) => i.key === 'weak_topic:to_be'));
  });

  it('is deterministic and exposes the features behind each score', () => {
    const s = snapshot({ progress: { l1: done() }, topics: [topic('to_be', 10, 0.4)] });
    expect(recommend(s)).toEqual(recommend(s));
    for (const item of recommend(s).items) expect(Object.keys(item.features).length).toBeGreaterThan(0);
  });

  it('respects configurable weights', () => {
    const s = snapshot({ progress: { l1: done() }, topics: [topic('to_be', 10, 0.35)] });
    const progressHeavy: EngineConfig = { ...DEFAULT_ENGINE_CONFIG, weights: { ...DEFAULT_ENGINE_CONFIG.weights, need: 0.1, progress: 2 } };
    expect(recommend(s).items[0]!.type).toBe('weak_topic');
    expect(recommend(s, progressHeavy).items[0]!.type).toBe('next_lesson');
  });

  it('limits the number of items and the items per type', () => {
    const r = recommend(
      snapshot({
        progress: { l1: done() },
        topics: ['a', 'b', 'c', 'd'].map((t) => topic(t, 10, 0.3)),
        srs: { due: 5, overdue: 0, maxOverdueDays: 0, newAvailable: 3, retention30d: null, reviews30d: 0 },
      }),
    );
    expect(r.items.length).toBeLessThanOrEqual(DEFAULT_ENGINE_CONFIG.thresholds.maxItems);
    expect(r.items.filter((i) => i.type === 'weak_topic').length).toBeLessThanOrEqual(2);
  });
});

describe('helpers', () => {
  it('smooths accuracy towards the prior with little evidence', () => {
    expect(smoothedAccuracy({ answers: 1, correct: 0 })).toBeGreaterThan(0.5);
    expect(smoothedAccuracy({ answers: 100, correct: 30 })).toBeCloseTo(0.316, 2);
  });

  it('maps recent accuracy to a target difficulty', () => {
    expect(targetDifficultyFor(null)).toBe(2);
    expect(targetDifficultyFor(0.4)).toBe(1);
    expect(targetDifficultyFor(0.7)).toBe(2);
    expect(targetDifficultyFor(0.95)).toBe(3);
  });
});

describe('composePlan', () => {
  it('fits the time budget, starts with reviews and always includes a learning activity', () => {
    const r = recommend(
      snapshot({
        progress: { l1: done() },
        topics: [topic('to_be', 10, 0.4), topic('greetings', 10, 0.45)],
        srs: { due: 30, overdue: 10, maxOverdueDays: 3, newAvailable: 0, retention30d: null, reviews30d: 0 },
      }),
    );
    const plan = composePlan(r, 15);
    expect(plan[0]!.type).toBe('review');
    expect(plan[0]!.estimatedMinutes).toBeLessThanOrEqual(7);
    expect(plan.some((p) => p.type !== 'review')).toBe(true);
    expect(plan.filter((p) => p.type === 'weak_topic').length).toBe(1);
    const total = plan.reduce((s, p) => s + p.estimatedMinutes, 0);
    expect(total).toBeLessThanOrEqual(15 + 10);
  });

  it('includes one activity even when it exceeds a tiny budget', () => {
    const plan = composePlan(recommend(snapshot()), 5);
    expect(plan.length).toBeGreaterThanOrEqual(1);
  });
});
