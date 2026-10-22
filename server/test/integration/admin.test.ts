import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { CourseModule, Lesson } from '../../src/models/content';
import { app, registerAdmin, registerUser, useTestDatabase } from '../helpers';

useTestDatabase();

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a5f50000000049454e44ae426082', 'hex');

describe('admin access control', () => {
  it('rejects regular users and anonymous requests', async () => {
    const u = await registerUser();
    expect((await request(app).get('/api/admin/stats')).status).toBe(401);
    expect((await request(app).get('/api/admin/stats').set(u.auth)).status).toBe(403);
    expect((await request(app).post('/api/admin/languages').set(u.auth).send({})).status).toBe(403);
  });

  it('prevents an admin from demoting or blocking themselves', async () => {
    const admin = await registerAdmin();
    const res = await request(app).patch(`/api/admin/users/${admin.user.id}`).set(admin.auth).send({ isBlocked: true });
    expect(res.status).toBe(403);
  });
});

describe('content management', () => {
  it('creates a lesson, validates exercises and publishes it into the learner catalogue', async () => {
    const admin = await registerAdmin();
    const learner = await registerUser();
    await request(app).post('/api/me/enrollments').set(learner.auth).send({ language: 'de' });
    const mod = await CourseModule.findOne({ language: 'de', level: 'A1' }).lean();

    const invalid = await request(app)
      .post('/api/admin/lessons')
      .set(admin.auth)
      .send({
        key: 'de-a1-weather',
        module: String(mod!._id),
        title: { ru: 'Погода' },
        objective: { ru: 'Говорить о погоде' },
        topic: 'travel',
        exercises: [{ key: 'w1', type: 'fill_blank', skill: 'grammar', topic: 'travel', errorCategory: 'grammar', difficulty: 1, explanation: { ru: 'x' }, sentence: 'Es regnet.', answers: ['regnet'] }],
      });
    expect(invalid.status).toBe(400);
    expect(JSON.stringify(invalid.body.error.details)).toContain('___');

    const created = await request(app)
      .post('/api/admin/lessons')
      .set(admin.auth)
      .send({
        key: 'de-a1-weather',
        module: String(mod!._id),
        title: { ru: 'Погода' },
        objective: { ru: 'Говорить о погоде' },
        topic: 'travel',
        order: 9,
        exercises: [
          { key: 'de-a1-weather-1', type: 'fill_blank', skill: 'grammar', topic: 'travel', errorCategory: 'grammar', difficulty: 1, explanation: { ru: 'Es regnet — идёт дождь.' }, sentence: 'Es ___.', answers: ['regnet'] },
        ],
      });
    expect(created.status).toBe(201);
    expect(created.body.isPublished).toBe(false);

    const hidden = await request(app).get('/api/languages/de/path').set(learner.auth);
    expect(JSON.stringify(hidden.body)).not.toContain('de-a1-weather');

    await request(app).patch(`/api/admin/lessons/${created.body.id}/publication`).set(admin.auth).send({ isPublished: true });
    const visible = await request(app).get('/api/languages/de/path').set(learner.auth);
    expect(JSON.stringify(visible.body)).toContain('de-a1-weather');

    const duplicateKey = await request(app)
      .post('/api/admin/lessons')
      .set(admin.auth)
      .send({ key: 'de-a1-weather-2', module: String(mod!._id), title: { ru: 'Копия' }, objective: { ru: 'x' }, topic: 'travel', exercises: [{ key: 'de-a1-greetings-1', type: 'speak', skill: 'speaking', topic: 'travel', errorCategory: 'pronunciation', difficulty: 1, explanation: { ru: 'x' }, text: 'Hallo', translation: { ru: 'Привет' } }] });
    expect(duplicateKey.status).toBe(409);

    expect((await request(app).delete(`/api/admin/lessons/${created.body.id}`).set(admin.auth)).status).toBe(204);
    expect(await Lesson.exists({ key: 'de-a1-weather' })).toBeNull();
  });

  it('refuses to delete a module that still has lessons', async () => {
    const admin = await registerAdmin();
    const mod = await CourseModule.findOne({ language: 'es' }).lean();
    const res = await request(app).delete(`/api/admin/modules/${mod!._id}`).set(admin.auth);
    expect(res.status).toBe(409);
  });

  it('manages words and languages', async () => {
    const admin = await registerAdmin();
    const word = await request(app)
      .post('/api/admin/words')
      .set(admin.auth)
      .send({ language: 'es', term: 'la lluvia', translation: { ru: 'дождь' }, partOfSpeech: 'noun', gender: 'f', topic: 'travel' });
    expect(word.status).toBe(201);
    const list = await request(app).get('/api/admin/words?language=es&q=lluvia').set(admin.auth);
    expect(list.body.total).toBe(1);

    const lang = await request(app)
      .post('/api/admin/languages')
      .set(admin.auth)
      .send({ code: 'it', name: { ru: 'Итальянский' }, nativeName: 'Italiano', ttsLocale: 'it-IT' });
    expect(lang.status).toBe(201);
    const publicList = await request(app).get('/api/languages');
    expect(publicList.body.some((l: { code: string }) => l.code === 'it')).toBe(false);
    expect((await request(app).delete('/api/admin/languages/de').set(admin.auth)).status).toBe(409);
    expect((await request(app).delete('/api/admin/languages/it').set(admin.auth)).status).toBe(204);
  });

  it('accepts real images and rejects files whose content does not match the type', async () => {
    const admin = await registerAdmin();
    const ok = await request(app).post('/api/admin/media').set(admin.auth).attach('file', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(ok.status).toBe(201);
    expect(ok.body.url).toMatch(/^\/uploads\/.+\.png$/);
    const fake = await request(app).post('/api/admin/media').set(admin.auth).attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'x.png', contentType: 'image/png' });
    expect(fake.status).toBe(400);
    const html = await request(app).post('/api/admin/media').set(admin.auth).attach('file', Buffer.from('<html>'), { filename: 'x.html', contentType: 'text/html' });
    expect(html.status).toBe(400);
  });
});

describe('users and statistics', () => {
  it('lists users without sensitive fields and can block them', async () => {
    const admin = await registerAdmin();
    const learner = await registerUser();
    const list = await request(app).get(`/api/admin/users?q=${encodeURIComponent(learner.email)}`).set(admin.auth);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).not.toHaveProperty('passwordHash');
    const block = await request(app).patch(`/api/admin/users/${learner.user.id}`).set(admin.auth).send({ isBlocked: true });
    expect(block.body.isBlocked).toBe(true);
    expect((await request(app).get('/api/me').set(learner.auth)).status).toBe(403);
  });

  it('returns aggregated statistics only', async () => {
    const admin = await registerAdmin();
    const res = await request(app).get('/api/admin/stats').set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.content.languages).toBe(5);
    expect(res.body.completionsByDay).toHaveLength(30);
    expect(JSON.stringify(res.body)).not.toMatch(/@example\.com/);
  });
});

describe('API documentation', () => {
  it('publishes an OpenAPI document covering the main resources', async () => {
    const res = await request(app).get('/api/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    for (const path of ['/api/auth/login', '/api/lessons/{id}/attempts', '/api/me/recommendations/{language}', '/api/reviews/{language}/queue', '/api/admin/lessons']) {
      expect(res.body.paths).toHaveProperty([path]);
    }
    expect(res.body.paths['/api/auth/register'].post.requestBody.content['application/json'].schema.properties).toHaveProperty('email');
  });
});
