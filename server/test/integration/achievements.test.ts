import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { AchievementsDTO, AttemptStateDTO, CertificateDTO, Exercise } from '@linguapath/shared';
import { CourseModule, Lesson, Test } from '../../src/models/content';
import { Attempt } from '../../src/models/learning';
import { simulateAnswer } from '../../src/seed/answer-sim';
import { app, enroll, registerUser, useTestDatabase } from '../helpers';

useTestDatabase();

async function play(auth: Record<string, string>, start: AttemptStateDTO) {
  let state = start;
  while (state.current) {
    const attempt = await Attempt.findById(state.id).lean();
    const ex = attempt!.items[state.position]!.exercise as Exercise;
    const res = await request(app).post(`/api/attempts/${state.id}/answers`).set(auth).send({ itemIndex: state.position, answer: simulateAnswer(ex, true), timeMs: 6000 });
    state = res.body.state;
  }
  return (await request(app).post(`/api/attempts/${state.id}/complete`).set(auth)).body;
}

describe('motivation and certificates', () => {
  it('tracks the week and milestones without penalties', async () => {
    const u = await registerUser();
    await enroll(u.auth, 'en');
    const before = (await request(app).get('/api/me/achievements/en').set(u.auth)).body as AchievementsDTO;
    expect(before.week.days).toHaveLength(7);
    expect(before.week.goalDays).toBe(4);
    expect(before.milestones.every((m) => !m.achieved)).toBe(true);

    const lesson = await Lesson.findOne({ key: 'en-a1-greetings' }).lean();
    await play(u.auth, (await request(app).post(`/api/lessons/${lesson!._id}/attempts`).set(u.auth).send({})).body);
    const after = (await request(app).get('/api/me/achievements/en').set(u.auth)).body as AchievementsDTO;
    const first = after.milestones.find((m) => m.key === 'first_lesson')!;
    expect(first).toMatchObject({ achieved: true, isNew: true });
    expect(after.milestones.find((m) => m.key === 'perfect_lesson')!.achieved).toBe(true);
    expect(after.week.activeDays).toBe(1);
    expect(after.week.minutes).toBeGreaterThan(0);
    // Reached once, kept: the second read returns the same moment.
    const again = (await request(app).get('/api/me/achievements/en').set(u.auth)).body as AchievementsDTO;
    expect(again.milestones.find((m) => m.key === 'first_lesson')!.achievedAt).toBe(first.achievedAt);
  });

  it('issues a level certificate only when every lesson and module test is passed, and lets anyone verify it', async () => {
    const u = await registerUser({ name: 'Айгерим Сапарова' });
    await enroll(u.auth, 'es');
    const early = await request(app).post('/api/me/certificates').set(u.auth).send({ language: 'es', level: 'A1' });
    expect(early.status).toBe(400);
    expect(early.body.error.code).toBe('certificate_not_earned');

    const lessons = await Lesson.find({ language: 'es', level: 'A1', isPublished: true }).lean();
    for (const lesson of lessons) await play(u.auth, (await request(app).post(`/api/lessons/${lesson._id}/attempts`).set(u.auth).send({})).body);
    const modules = await CourseModule.find({ language: 'es', level: 'A1' }).lean();
    const tests = await Test.find({ kind: 'module', module: { $in: modules.map((m) => m._id) }, isPublished: true }).lean();
    expect(tests.length).toBeGreaterThan(0);
    for (const test of tests) await play(u.auth, (await request(app).post(`/api/tests/${test._id}/attempts`).set(u.auth).send({})).body);

    const status = (await request(app).get('/api/me/achievements/es').set(u.auth)).body as AchievementsDTO;
    const a1 = status.levels.find((l) => l.level === 'A1')!;
    expect(a1).toMatchObject({ eligible: true, certificate: null });
    expect(a1.lessons).toEqual({ completed: lessons.length, total: lessons.length });
    expect(status.levels.find((l) => l.level === 'A2')!.eligible).toBe(false);

    const issued = await request(app).post('/api/me/certificates').set(u.auth).send({ language: 'es', level: 'A1' });
    expect(issued.status).toBe(201);
    const cert = issued.body as CertificateDTO;
    expect(cert.code).toMatch(/^LP-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    expect(cert).toMatchObject({ name: 'Айгерим Сапарова', level: 'A1', languageName: 'Испанский' });
    expect(cert.stats.lessons).toBe(lessons.length);
    expect(cert.stats.averagePercent).toBe(100);

    const repeat = await request(app).post('/api/me/certificates').set(u.auth).send({ language: 'es', level: 'A1' });
    expect(repeat.body.code).toBe(cert.code);

    const verify = await request(app).get(`/api/certificates/${cert.code.toLowerCase()}`);
    expect(verify.status).toBe(200);
    expect(verify.body).toMatchObject({ code: cert.code, name: 'Айгерим Сапарова', level: 'A1' });
    expect(JSON.stringify(verify.body)).not.toContain('@');
    expect((await request(app).get('/api/certificates/LP-0000-0000')).status).toBe(404);

    const ms = (await request(app).get('/api/me/achievements/es').set(u.auth)).body as AchievementsDTO;
    expect(ms.milestones.find((m) => m.key === 'level_complete')!.achieved).toBe(true);
    expect(ms.milestones.find((m) => m.key === 'module_test')!.achieved).toBe(true);
  }, 60_000);
});
