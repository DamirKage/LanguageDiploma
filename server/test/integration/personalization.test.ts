import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { AttemptStateDTO, Exercise, RecommendationResult, ReviewQueueDTO } from '@slog/shared';
import { Lesson } from '../../src/models/content';
import { Attempt, RecommendationSnapshot, ReviewItem, ReviewLog } from '../../src/models/learning';
import { simulateAnswer } from '../../src/seed/answer-sim';
import { app, enroll, registerUser, useTestDatabase } from '../helpers';

useTestDatabase();

async function completeLesson(auth: Record<string, string>, key: string, isCorrect: (ex: Exercise) => boolean) {
  const lesson = await Lesson.findOne({ key }).lean();
  let state = (await request(app).post(`/api/lessons/${lesson!._id}/attempts`).set(auth).send({})).body as AttemptStateDTO;
  while (state.current) {
    const attempt = await Attempt.findById(state.id).lean();
    const ex = attempt!.items[state.position]!.exercise as Exercise;
    const res = await request(app)
      .post(`/api/attempts/${state.id}/answers`)
      .set(auth)
      .send({ itemIndex: state.position, answer: simulateAnswer(ex, isCorrect(ex)), timeMs: 5000 });
    state = res.body.state;
  }
  return (await request(app).post(`/api/attempts/${state.id}/complete`).set(auth)).body;
}

describe('spaced repetition', () => {
  it('schedules lesson words for tomorrow and updates the schedule after each answer', async () => {
    const u = await registerUser();
    await enroll(u.auth, 'en');
    await completeLesson(u.auth, 'en-a1-greetings', () => true);

    const today = (await request(app).get('/api/reviews/en/queue').set(u.auth)).body as ReviewQueueDTO;
    expect(today.cards).toHaveLength(0);

    await ReviewItem.updateMany({ user: u.user.id }, { $set: { dueAt: new Date(Date.now() - 60_000) } });
    const queue = (await request(app).get('/api/reviews/en/queue').set(u.auth)).body as ReviewQueueDTO;
    expect(queue.cards.length).toBeGreaterThan(0);
    const card = queue.cards[0]!;
    expect(card.mode).toBe('choice');
    expect(card.options).toContain(card.translation);
    expect(new Set(card.options).size).toBe(card.options!.length);

    const answer = await request(app).post(`/api/reviews/${card.wordId}/answer`).set(u.auth).send({ mode: 'choice', option: card.translation, timeMs: 3000 });
    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ verdict: 'correct', quality: 4, repetitions: 1, intervalDays: 1 });
    expect(new Date(answer.body.nextDueAt).getTime()).toBeGreaterThan(Date.now());
    expect(await ReviewLog.countDocuments({ user: u.user.id })).toBe(1);

    const wrongCard = queue.cards[1]!;
    const wrong = await request(app).post(`/api/reviews/${wrongCard.wordId}/answer`).set(u.auth).send({ mode: 'flip', grade: 'again' });
    expect(wrong.body).toMatchObject({ verdict: 'incorrect', quality: 1, repetitions: 0 });

    const after = (await request(app).get('/api/reviews/en/queue').set(u.auth)).body as ReviewQueueDTO;
    expect(after.cards.find((c) => c.wordId === card.wordId)).toBeUndefined();
  });

  it('does not let a user answer reviews for words they have not learned', async () => {
    const u = await registerUser();
    const lesson = await Lesson.findOne({ key: 'en-a1-greetings' }).lean();
    const res = await request(app).post(`/api/reviews/${lesson!.words[0]}/answer`).set(u.auth).send({ mode: 'flip', grade: 'good' });
    expect(res.status).toBe(404);
  });
});

describe('recommendations react to performance', () => {
  it('recommends placement first, then reacts to a weak topic with an explained practice recommendation', async () => {
    const u = await registerUser();
    await enroll(u.auth, 'de');
    const initial = (await request(app).get('/api/me/recommendations/de').set(u.auth)).body as RecommendationResult;
    expect(initial.items[0]!.type).toBe('placement');

    // Learner gets every possessive-pronoun exercise wrong but is otherwise accurate.
    await completeLesson(u.auth, 'de-a1-greetings', () => true);
    await completeLesson(u.auth, 'de-a1-family', (ex) => ex.topic !== 'possessive');
    await completeLesson(u.auth, 'de-a1-sein', () => true);
    const lesson = await Lesson.findOne({ key: 'de-a1-family' }).lean();
    // A second pass with the same mistakes gives the engine enough evidence.
    await completeLesson(u.auth, 'de-a1-family', (ex) => ex.topic !== 'possessive');

    const recs = (await request(app).get('/api/me/recommendations/de').set(u.auth)).body as RecommendationResult;
    const weak = recs.items.find((i) => i.key === 'weak_topic:possessive');
    expect(weak).toBeDefined();
    expect(weak!.reasons[0]).toMatchObject({ code: 'low_topic_accuracy', params: { topic: 'possessive' } });
    expect(recs.items.some((i) => i.type === 'placement')).toBe(false);
    expect(lesson).toBeTruthy();

    const practice = await request(app).post('/api/practice/attempts').set(u.auth).send({ language: 'de', topic: 'possessive', recommendationKey: weak!.key });
    expect(practice.status).toBe(201);
    const snap = await RecommendationSnapshot.findOne({ user: u.user.id, 'items.key': weak!.key }).sort({ generatedAt: -1 }).lean();
    expect(snap!.followedKeys).toContain(weak!.key);
  });

  it('builds a daily plan within the time budget and marks finished items as done', async () => {
    const u = await registerUser();
    await enroll(u.auth, 'es');
    await request(app).patch('/api/me').set(u.auth).send({ dailyMinutes: 15 });
    await request(app).post('/api/placement/es/skip').set(u.auth).send({ level: 'A1' });
    const plan = (await request(app).get('/api/me/plan/es').set(u.auth)).body;
    expect(plan.budgetMinutes).toBe(15);
    expect(plan.items.length).toBeGreaterThan(0);
    const first = plan.items.find((i: { type: string }) => i.type === 'next_lesson');
    expect(first.done).toBe(false);
    const lesson = await Lesson.findById(first.target.lessonId).lean();
    await completeLesson(u.auth, lesson!.key, () => true);
    const after = (await request(app).get('/api/me/plan/es').set(u.auth)).body;
    expect(after.items.find((i: { key: string }) => i.key === first.key).done).toBe(true);
    expect(after.upcoming[0].lessonId).not.toBe(first.target.lessonId);
  });
});

describe('analytics', () => {
  it('derives the overview, topic accuracy, error categories and timeline from stored answers', async () => {
    const u = await registerUser();
    await enroll(u.auth, 'en');
    await completeLesson(u.auth, 'en-a1-to-be', (ex) => ex.type !== 'fill_blank');

    const overview = (await request(app).get('/api/me/analytics/en/overview').set(u.auth)).body;
    expect(overview.lessons.completed).toBe(1);
    expect(overview.words.inReview).toBeGreaterThan(0);
    expect(overview.accuracy.answers).toBeGreaterThan(0);
    expect(overview.accuracy.overall).toBeGreaterThan(0);
    expect(overview.accuracy.overall).toBeLessThan(1);
    expect(overview.rhythm.activeDaysLast28).toBe(1);

    const errors = (await request(app).get('/api/me/analytics/en/errors').set(u.auth)).body;
    const fill = errors.byExerciseType.find((t: { type: string }) => t.type === 'fill_blank');
    expect(fill.rate).toBe(1);
    expect(errors.recent.length).toBeGreaterThan(0);
    expect(errors.byCategory[0].category).toBe('grammar');

    const topics = (await request(app).get('/api/me/analytics/en/topics').set(u.auth)).body;
    expect(topics.find((t: { topic: string }) => t.topic === 'to_be')).toBeDefined();

    const timeline = (await request(app).get('/api/me/analytics/en/timeline?days=14').set(u.auth)).body;
    expect(timeline).toHaveLength(14);
    expect(timeline.at(-1).answers).toBeGreaterThan(0);

    const srs = (await request(app).get('/api/me/analytics/en/srs').set(u.auth)).body;
    expect(srs.states.new).toBeGreaterThan(0);
    expect(srs.forecast).toHaveLength(14);
  });

  it('keeps analytics private to each learner', async () => {
    const a = await registerUser();
    const b = await registerUser();
    await enroll(a.auth, 'tr');
    await completeLesson(a.auth, 'tr-a1-greetings', () => true);
    const bOverview = (await request(app).get('/api/me/analytics/tr/overview').set(b.auth)).body;
    expect(bOverview.accuracy.answers).toBe(0);
    expect(bOverview.lessons.completed).toBe(0);
  });
});
