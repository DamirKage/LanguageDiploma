import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { z } from 'zod';
import { localize, type AdminStatsDTO, type AdminUserDTO, type LocalizedText, type Paginated } from '@linguapath/shared';
import { config } from '../../config';
import { AppError, errors } from '../../lib/errors';
import { createApiRouter, idParams, pagination } from '../../lib/http';
import { Course, Language, Lesson, Test, Word } from '../../models/content';
import { AnswerEvent, Attempt, LessonProgress, ReviewLog } from '../../models/learning';
import { Enrollment, User } from '../../models/user';
import { revokeAllSessions } from '../auth/service';

const { router, get, patch, post, delete: del } = createApiRouter('/api/admin');

/* ---------- Users ---------- */

get(
  '/users',
  {
    summary: 'Список пользователей с агрегированными показателями',
    tags: ['Администрирование: пользователи'],
    access: 'admin',
    returns: 'Paginated<AdminUserDTO>',
    query: pagination.extend({ q: z.string().trim().max(80).optional(), role: z.enum(['user', 'admin']).optional() }),
  },
  async ({ query }): Promise<Paginated<AdminUserDTO>> => {
    const filter: Record<string, unknown> = {};
    if (query.role) filter.role = query.role;
    if (query.q) {
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ email: { $regex: escaped, $options: 'i' } }, { name: { $regex: escaped, $options: 'i' } }];
    }
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean(),
      User.countDocuments(filter),
    ]);
    const ids = users.map((u) => u._id);
    const [enrollments, completions] = await Promise.all([
      Enrollment.find({ user: { $in: ids } }).select('user language').lean(),
      LessonProgress.aggregate<{ _id: unknown; count: number }>([
        { $match: { user: { $in: ids }, status: 'completed' } },
        { $group: { _id: '$user', count: { $sum: 1 } } },
      ]),
    ]);
    const done = new Map(completions.map((c) => [String(c._id), c.count]));
    return {
      items: users.map((u) => ({
        id: String(u._id),
        email: u.email,
        name: u.name,
        role: u.role,
        isBlocked: u.isBlocked,
        createdAt: (u.createdAt as Date).toISOString(),
        lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
        languages: enrollments.filter((e) => String(e.user) === String(u._id)).map((e) => e.language),
        lessonsCompleted: done.get(String(u._id)) ?? 0,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  },
);

patch(
  '/users/:id',
  {
    summary: 'Изменить роль или заблокировать пользователя',
    tags: ['Администрирование: пользователи'],
    access: 'admin',
    params: idParams,
    body: z.object({ role: z.enum(['user', 'admin']), isBlocked: z.boolean() }).partial(),
  },
  async ({ params, body, user }) => {
    if (params.id === user.id) throw new AppError(403, 'forbidden', 'Нельзя изменить роль или заблокировать собственный аккаунт');
    const doc = await User.findByIdAndUpdate(params.id, { $set: body }, { returnDocument: 'after' }).lean();
    if (!doc) throw errors.notFound();
    if (body.isBlocked) await revokeAllSessions(params.id);
    return { id: String(doc._id), role: doc.role, isBlocked: doc.isBlocked };
  },
);

/* ---------- Statistics ---------- */

get(
  '/stats',
  {
    summary: 'Агрегированная статистика платформы',
    description: 'Содержит только агрегаты; темы и задания попадают в рейтинг сложности при наличии данных минимум от 3 учащихся.',
    tags: ['Администрирование: статистика'],
    access: 'admin',
    returns: 'AdminStatsDTO',
  },
  async (): Promise<AdminStatsDTO> => {
    const now = Date.now();
    const d7 = new Date(now - 7 * 86400_000);
    const d30 = new Date(now - 30 * 86400_000);
    const dateExpr = (field: string) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: 'Asia/Almaty' } });
    const [total, active7d, active30d, newLast30d, enrollments, attemptsByDay, reviewsByDay, scores, topics, exercises, counts] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'user', lastActiveAt: { $gte: d7 } }),
      User.countDocuments({ role: 'user', lastActiveAt: { $gte: d30 } }),
      User.countDocuments({ role: 'user', createdAt: { $gte: d30 } }),
      Enrollment.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$language', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Attempt.aggregate<{ _id: { date: string; kind: string }; count: number }>([
        { $match: { status: 'completed', completedAt: { $gte: d30 } } },
        { $group: { _id: { date: dateExpr('$completedAt'), kind: '$kind' }, count: { $sum: 1 } } },
      ]),
      ReviewLog.aggregate<{ _id: string; count: number }>([{ $match: { at: { $gte: d30 } } }, { $group: { _id: dateExpr('$at'), count: { $sum: 1 } } }]),
      Attempt.aggregate<{ _id: { language: string; level: string }; avg: number; attempts: number }>([
        { $match: { status: 'completed', kind: { $in: ['lesson', 'test'] }, level: { $ne: null } } },
        { $group: { _id: { language: '$language', level: '$level' }, avg: { $avg: '$result.percent' }, attempts: { $sum: 1 } } },
        { $sort: { '_id.language': 1, '_id.level': 1 } },
      ]),
      AnswerEvent.aggregate<{ _id: { language: string; topic: string }; answers: number; correct: number; learners: unknown[] }>([
        { $match: { isRetry: false, verdict: { $ne: 'skipped' } } },
        {
          $group: {
            _id: { language: '$language', topic: '$topic' },
            answers: { $sum: 1 },
            correct: { $sum: { $cond: [{ $eq: ['$verdict', 'correct'] }, 1, 0] } },
            learners: { $addToSet: '$user' },
          },
        },
      ]),
      AnswerEvent.aggregate<{ _id: string; answers: number; correct: number; learners: unknown[]; lesson: unknown }>([
        { $match: { isRetry: false, verdict: { $ne: 'skipped' } } },
        {
          $group: {
            _id: '$exerciseKey',
            answers: { $sum: 1 },
            correct: { $sum: { $cond: [{ $eq: ['$verdict', 'correct'] }, 1, 0] } },
            learners: { $addToSet: '$user' },
            lesson: { $first: '$lesson' },
          },
        },
      ]),
      Promise.all([Language.countDocuments(), Course.countDocuments(), Lesson.countDocuments(), Word.countDocuments(), Test.countDocuments()]),
    ]);

    const days = Array.from({ length: 30 }, (_, i) => new Date(now - (29 - i) * 86400_000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' }));
    const MIN_LEARNERS = 3;
    const hardExercises = exercises
      .filter((e) => e.learners.length >= MIN_LEARNERS)
      .map((e) => ({ ...e, accuracy: e.correct / e.answers }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 10);
    const lessonTitles = new Map(
      (await Lesson.find({ _id: { $in: hardExercises.map((e) => e.lesson).filter(Boolean) } }).select('title').lean()).map((l) => [
        String(l._id),
        localize(l.title as LocalizedText),
      ]),
    );

    return {
      users: { total, active7d, active30d, newLast30d },
      enrollmentsByLanguage: enrollments.map((e) => ({ language: e._id, count: e.count })),
      completionsByDay: days.map((date) => ({
        date,
        lessons: attemptsByDay.filter((a) => a._id.date === date && a._id.kind !== 'test').reduce((s, a) => s + a.count, 0),
        tests: attemptsByDay.find((a) => a._id.date === date && a._id.kind === 'test')?.count ?? 0,
        reviews: reviewsByDay.find((r) => r._id === date)?.count ?? 0,
      })),
      averageScoreByLanguageLevel: scores.map((s) => ({ language: s._id.language, level: s._id.level, averagePercent: Math.round(s.avg), attempts: s.attempts })),
      hardestTopics: topics
        .filter((t) => t.learners.length >= MIN_LEARNERS)
        .map((t) => ({ language: t._id.language, topic: t._id.topic, accuracy: t.correct / t.answers, answers: t.answers, learners: t.learners.length }))
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 10),
      hardestExercises: hardExercises.map((e) => ({
        key: e._id,
        lessonTitle: lessonTitles.get(String(e.lesson)) ?? '',
        accuracy: e.accuracy,
        answers: e.answers,
      })),
      content: { languages: counts[0], courses: counts[1], lessons: counts[2], words: counts[3], tests: counts[4] },
    };
  },
);

/* ---------- Media ---------- */

const ALLOWED_MEDIA: Record<string, string> = {
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/webm': '.webm',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

/** Checks the leading bytes, because the declared MIME type is chosen by the client. */
function matchesSignature(buffer: Buffer, mime: string): boolean {
  const hex = buffer.subarray(0, 12).toString('hex');
  if (mime === 'image/png') return hex.startsWith('89504e47');
  if (mime === 'image/jpeg') return hex.startsWith('ffd8ff');
  if (mime === 'image/webp') return hex.startsWith('52494646') && buffer.subarray(8, 12).toString() === 'WEBP';
  if (mime === 'audio/mpeg') return hex.startsWith('494433') || hex.startsWith('fff');
  if (mime === 'audio/ogg') return buffer.subarray(0, 4).toString() === 'OggS';
  if (mime === 'audio/wav' || mime === 'audio/x-wav') return buffer.subarray(0, 4).toString() === 'RIFF';
  if (mime === 'audio/webm') return hex.startsWith('1a45dfa3');
  return false;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in ALLOWED_MEDIA),
});

post(
  '/media',
  {
    summary: 'Загрузить аудио или изображение',
    description: 'multipart/form-data, поле `file`. Допустимы MP3, OGG, WAV, WebM, PNG, JPEG, WebP.',
    tags: ['Администрирование: контент'],
    access: 'admin',
    status: 201,
    multipart: true,
    middleware: [
      (req, res, next) =>
        upload.single('file')(req, res, (err: unknown) => {
          if (err) return next(new AppError(400, 'upload_rejected'));
          next();
        }),
    ],
  },
  async ({ req }) => {
    const file = req.file;
    if (!file || !matchesSignature(file.buffer, file.mimetype)) throw new AppError(400, 'upload_rejected');
    const name = `${crypto.randomUUID()}${ALLOWED_MEDIA[file.mimetype]}`;
    await fs.mkdir(config.uploadDir, { recursive: true });
    await fs.writeFile(path.join(config.uploadDir, name), file.buffer);
    return { url: `/uploads/${name}`, mimeType: file.mimetype, size: file.size };
  },
);

get('/media', { summary: 'Загруженные файлы', tags: ['Администрирование: контент'], access: 'admin' }, async () => {
  await fs.mkdir(config.uploadDir, { recursive: true });
  const names = (await fs.readdir(config.uploadDir)).filter((n) => !n.startsWith('.'));
  const files = await Promise.all(
    names.map(async (name) => {
      const stat = await fs.stat(path.join(config.uploadDir, name));
      return { name, url: `/uploads/${name}`, size: stat.size, uploadedAt: stat.mtime.toISOString() };
    }),
  );
  return files.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
});

del('/media/:name', { summary: 'Удалить загруженный файл', tags: ['Администрирование: контент'], access: 'admin', params: z.object({ name: z.string().regex(/^[a-f0-9-]{36}\.[a-z0-9]{3,4}$/) }) }, async ({ params }) => {
  try {
    await fs.unlink(path.join(config.uploadDir, params.name));
  } catch {
    throw errors.notFound();
  }
});

export const adminRouter = router;
