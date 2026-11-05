import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { AttemptStateDTO, CefrLevel, Exercise, LearningPathDTO } from '@linguapath/shared';
import { Lesson, Test } from '../../src/models/content';
import { AnswerEvent, Attempt, LessonProgress, ReviewItem } from '../../src/models/learning';
import { PLACEMENT_CONFIG, itemDifficulty } from '../../src/modules/learning/placement';
import { simulateAnswer } from '../../src/seed/answer-sim';
import { app, enroll, registerUser, useTestDatabase } from '../helpers';

useTestDatabase();

/** Answers the current exercise using the stored solution (the client never sees it). */
async function answerCurrent(auth: Record<string, string>, state: AttemptStateDTO, correct: boolean) {
  const attempt = await Attempt.findById(state.id).lean();
  const exercise = attempt!.items[state.position]!.exercise as Exercise;
  return request(app)
    .post(`/api/attempts/${state.id}/answers`)
    .set(auth)
    .send({ itemIndex: state.position, answer: simulateAnswer(exercise, correct), timeMs: 4000 });
}

async function playThrough(auth: Record<string, string>, state: AttemptStateDTO, isCorrect: (i: number) => boolean) {
  let current = state;
  let i = 0;
  while (current.current) {
    const res = await answerCurrent(auth, current, isCorrect(i++));
    expect(res.status).toBe(200);
    current = res.body.state;
  }
  return current;
}

describe('catalogue', () => {
  it('lists the five languages with levels A1–B2', async () => {
    const res = await request(app).get('/api/languages');
    expect(res.status).toBe(200);
    expect(res.body.map((l: { code: string }) => l.code)).toEqual(['kk', 'en', 'tr', 'de', 'es']);
    for (const lang of res.body) expect(lang.levels).toEqual(['A1', 'A2', 'B1', 'B2', 'C1']);
  });

  it('returns the learning path with modules, tests and lesson statuses', async () => {
    const u = await registerUser();
    await enroll(u.auth, 'de');
    const res = await request(app).get('/api/languages/de/path').set(u.auth);
    const path = res.body as LearningPathDTO;
    expect(path.levels).toHaveLength(4);
    expect(path.levels[0]!.modules[0]!.lessons[0]).toMatchObject({ status: 'not_started', key: 'de-a1-greetings' });
    expect(path.levels[0]!.modules[0]!.test).not.toBeNull();
  });

  it('serves lesson details without answers', async () => {
    const u = await registerUser();
    const lesson = await Lesson.findOne({ key: 'kk-a1-greetings' }).lean();
    const res = await request(app).get(`/api/lessons/${lesson!._id}`).set(u.auth);
    expect(res.status).toBe(200);
    expect(res.body.theory.length).toBeGreaterThan(0);
    expect(res.body.words.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toContain('correctIndex');
  });
});

describe('lesson attempt', () => {
  it('requires enrolment in the lesson language', async () => {
    const u = await registerUser();
    const lesson = await Lesson.findOne({ key: 'es-a1-greetings' }).lean();
    const res = await request(app).post(`/api/lessons/${lesson!._id}/attempts`).set(u.auth).send({});
    expect(res.body.error.code).toBe('not_enrolled');
  });

  it('runs a lesson end-to-end: feedback, score, progress and new review words', async () => {
    const u = await registerUser();
    await enroll(u.auth, 'de');
    const lesson = await Lesson.findOne({ key: 'de-a1-greetings' }).lean();
    const start = await request(app).post(`/api/lessons/${lesson!._id}/attempts`).set(u.auth).send({});
    expect(start.status).toBe(201);
    let state = start.body as AttemptStateDTO;
    const total = state.total;
    expect(state.current).not.toBeNull();
    expect(state.current).not.toHaveProperty('answers');

    const resume = await request(app).post(`/api/lessons/${lesson!._id}/attempts`).set(u.auth).send({});
    expect(resume.body.id).toBe(state.id);

    const wrong = await answerCurrent(u.auth, state, false);
    expect(wrong.body.feedback.verdict).toBe('incorrect');
    expect(wrong.body.feedback.expected).toBeTruthy();
    expect(wrong.body.feedback.explanation).toBeTruthy();
    state = wrong.body.state;
    expect(state.total).toBe(total);

    const mismatch = await request(app).post(`/api/attempts/${state.id}/answers`).set(u.auth).send({ itemIndex: 0, answer: { type: 'choice', option: 'x' } });
    expect(mismatch.status).toBe(409);

    state = await playThrough(u.auth, state, () => true);
    expect(state.current).toBeNull();

    const summary = await request(app).post(`/api/attempts/${state.id}/complete`).set(u.auth);
    expect(summary.status).toBe(200);
    expect(summary.body).toMatchObject({ kind: 'lesson', total, correct: total - 1, incorrect: 1, passed: true });
    expect(summary.body.percent).toBe(Math.round(((total - 1) * 10 * 100) / (total * 10)));
    expect(summary.body.wordsAdded).toBe(lesson!.words.length);
    expect(summary.body.review).toHaveLength(total);
    expect(summary.body.next).not.toBeNull();

    const again = await request(app).post(`/api/attempts/${state.id}/complete`).set(u.auth);
    expect(again.body.percent).toBe(summary.body.percent);

    const progress = await LessonProgress.findOne({ user: u.user.id, lesson: lesson!._id }).lean();
    expect(progress).toMatchObject({ status: 'completed', bestPercent: summary.body.percent, attempts: 1 });
    expect(await ReviewItem.countDocuments({ user: u.user.id })).toBe(lesson!.words.length);
    expect(await AnswerEvent.countDocuments({ user: u.user.id })).toBe(total);

    const path = await request(app).get('/api/languages/de/path').set(u.auth);
    expect(path.body.levels[0].modules[0].lessons[0].status).toBe('completed');
  });

  it('refuses to complete an unfinished attempt and hides attempts of other users', async () => {
    const a = await registerUser();
    const b = await registerUser();
    await enroll(a.auth, 'en');
    const lesson = await Lesson.findOne({ key: 'en-a1-greetings' }).lean();
    const start = await request(app).post(`/api/lessons/${lesson!._id}/attempts`).set(a.auth).send({});
    expect((await request(app).post(`/api/attempts/${start.body.id}/complete`).set(a.auth)).body.error.code).toBe('attempt_not_finished');
    expect((await request(app).get(`/api/attempts/${start.body.id}`).set(b.auth)).status).toBe(404);
    expect((await answerCurrent(b.auth, start.body, true)).status).toBe(404);
  });
});

describe('tests and placement', () => {
  it('gives no feedback during a module test and reports it at the end', async () => {
    const u = await registerUser();
    await enroll(u.auth, 'tr');
    const test = await Test.findOne({ language: 'tr', kind: 'module' }).lean();
    const start = await request(app).post(`/api/tests/${test!._id}/attempts`).set(u.auth).send({});
    expect(start.body.feedbackMode).toBe('deferred');
    const first = await answerCurrent(u.auth, start.body, true);
    expect(first.body.feedback).toBeNull();
    const finished = await playThrough(u.auth, first.body.state, (i) => i % 2 === 0);
    const summary = await request(app).post(`/api/attempts/${finished.id}/complete`).set(u.auth);
    expect(summary.body.kind).toBe('test');
    expect(summary.body.review.every((r: { explanation: string }) => r.explanation.length > 0)).toBe(true);
  });

  /** Plays an adaptive placement as a learner in the middle of `level`: items no harder than that are solved. */
  async function placeAs(auth: Record<string, string>, language: string, level: CefrLevel | null, selfAssessment = 'basics') {
    const start = await request(app).post(`/api/placement/${language}/attempts`).set(auth).send({ selfAssessment });
    expect(start.status).toBe(201);
    let state = start.body as AttemptStateDTO;
    expect(state.total).toBe(1);
    expect(state.maxItems).toBe(20);
    while (state.current) {
      const attempt = await Attempt.findById(state.id).lean();
      const item = attempt!.items[state.position]!;
      const exercise = item.exercise as Exercise;
      const correct = level !== null && itemDifficulty({ level: item.level as CefrLevel, difficulty: exercise.difficulty }) <= PLACEMENT_CONFIG.levelCentre[level];
      const res = await answerCurrent(auth, state, correct);
      expect(res.status).toBe(200);
      state = res.body.state;
    }
    return state;
  }

  it('runs an adaptive placement item by item and sets the enrolment level', async () => {
    const u = await registerUser();
    await enroll(u.auth, 'de');
    const state = await placeAs(u.auth, 'de', 'A2');
    expect(state.total).toBeGreaterThanOrEqual(8);
    expect(state.total).toBeLessThanOrEqual(20);
    const summary = await request(app).post(`/api/attempts/${state.id}/complete`).set(u.auth);
    expect(summary.body.placement).toMatchObject({ estimatedLevel: 'A2', selfAssessment: 'basics' });
    expect(summary.body.placement.perSkill.length).toBeGreaterThanOrEqual(3);
    expect(['low', 'mid', 'high']).toContain(summary.body.placement.band);
    const enrollments = await request(app).get('/api/me/enrollments').set(u.auth);
    expect(enrollments.body[0]).toMatchObject({ language: 'de', level: 'A2', placementLevel: 'A2' });
  });

  it('reaches B2 for a strong learner and A1 for a beginner who answers "don\'t know"', async () => {
    const strong = await registerUser();
    await enroll(strong.auth, 'es');
    const s1 = await placeAs(strong.auth, 'es', 'B2', 'confident');
    const r1 = await request(app).post(`/api/attempts/${s1.id}/complete`).set(strong.auth);
    expect(r1.body.placement.estimatedLevel).toBe('B2');

    const beginner = await registerUser();
    await enroll(beginner.auth, 'kk');
    let state = (await request(app).post('/api/placement/kk/attempts').set(beginner.auth).send({ selfAssessment: 'beginner' })).body as AttemptStateDTO;
    while (state.current) {
      const attempt = await Attempt.findById(state.id).lean();
      const exercise = attempt!.items[state.position]!.exercise as Exercise;
      const res = await request(app)
        .post(`/api/attempts/${state.id}/answers`)
        .set(beginner.auth)
        .send({ itemIndex: state.position, answer: simulateAnswer(exercise, true), dontKnow: true });
      state = res.body.state;
    }
    const r2 = await request(app).post(`/api/attempts/${state.id}/complete`).set(beginner.auth);
    expect(r2.body.placement.estimatedLevel).toBe('A1');
    expect(r2.body.correct).toBe(0);
  });
});

describe('targeted practice', () => {
  it('builds a practice session for a topic, preferring previously missed exercises', async () => {
    const u = await registerUser();
    await enroll(u.auth, 'de');
    const lesson = await Lesson.findOne({ key: 'de-a1-family' }).lean();
    const start = await request(app).post(`/api/lessons/${lesson!._id}/attempts`).set(u.auth).send({});
    const done = await playThrough(u.auth, start.body, () => false);
    await request(app).post(`/api/attempts/${done.id}/complete`).set(u.auth);

    const practice = await request(app).post('/api/practice/attempts').set(u.auth).send({ language: 'de', topic: 'possessive' });
    expect(practice.status).toBe(201);
    expect(practice.body.kind).toBe('practice');
    expect(practice.body.title).toContain('Практика');
    const attempt = await Attempt.findById(practice.body.id).lean();
    for (const item of attempt!.items) {
      const ex = item.exercise as Exercise;
      expect(ex.topic === 'possessive' || ex.key.startsWith('de-a1-family')).toBe(true);
    }
  });
});
