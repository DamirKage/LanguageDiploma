import { z } from 'zod';
import { CEFR_LEVELS } from '@slog/shared';
import { AppError, errors } from '../../lib/errors';
import { createApiRouter, idParams, languageCode, objectId, pagination } from '../../lib/http';
import { Course, CourseModule, Language, Lesson, Test, Topic, Word } from '../../models/content';
import { LessonProgress, ReviewItem } from '../../models/learning';
import { assertUniqueKeys, exerciseSchema, localizedText, optionalLocalizedText, theoryBlockSchema } from '../content/schemas';

const { router, get, post, put, patch, delete: del } = createApiRouter('/api/admin');
const tags = ['Администрирование: контент'];

/** Serialises a lean document for the admin UI: `_id` becomes `id`, internals are dropped. */
export function plain<T extends { _id: unknown }>(doc: T): Omit<T, '_id' | '__v'> & { id: string } {
  const { _id, __v, ...rest } = doc as T & { __v?: number };
  void __v;
  return { id: String(_id), ...rest };
}

async function ensureUniqueExerciseKeys(exercises: Array<{ key: string }>, ownLessonId?: string, ownTestId?: string) {
  const duplicate = assertUniqueKeys(exercises);
  if (duplicate) throw new AppError(400, 'validation_failed', `Ключ задания «${duplicate}» повторяется`);
  const keys = exercises.map((e) => e.key);
  if (keys.length === 0) return;
  const clashLesson = await Lesson.findOne({ 'exercises.key': { $in: keys }, ...(ownLessonId ? { _id: { $ne: ownLessonId } } : {}) }).select('key').lean();
  const clashTest = await Test.findOne({ 'exercises.key': { $in: keys }, ...(ownTestId ? { _id: { $ne: ownTestId } } : {}) }).select('_id').lean();
  if (clashLesson || clashTest) throw new AppError(409, 'conflict', 'Ключ задания уже используется в другом уроке или тесте');
}

/* ---------- Languages ---------- */

const languageBody = z.object({
  code: languageCode,
  name: localizedText,
  nativeName: z.string().trim().min(1).max(60),
  ttsLocale: z.string().trim().regex(/^[a-z]{2,3}-[A-Z]{2}$/, 'Формат: kk-KZ'),
  specialChars: z.array(z.string().min(1).max(4)).max(40).default([]),
  order: z.number().int().min(0).max(1000).default(0),
  isPublished: z.boolean().default(false),
});

get('/languages', { summary: 'Все языки, включая скрытые', tags, access: 'admin' }, async () =>
  (await Language.find().sort({ order: 1 }).lean()).map(plain),
);

post('/languages', { summary: 'Добавить язык', tags, access: 'admin', status: 201, body: languageBody }, async ({ body }) => {
  if (await Language.exists({ code: body.code })) throw errors.conflict();
  return plain((await Language.create(body)).toObject());
});

patch(
  '/languages/:code',
  { summary: 'Изменить язык', tags, access: 'admin', params: z.object({ code: languageCode }), body: languageBody.omit({ code: true }).partial() },
  async ({ params, body }) => {
    const doc = await Language.findOneAndUpdate({ code: params.code }, { $set: body }, { returnDocument: 'after' }).lean();
    if (!doc) throw errors.notFound();
    return plain(doc);
  },
);

del(
  '/languages/:code',
  { summary: 'Удалить язык без учебных материалов', description: 'Язык с курсами удалить нельзя — его можно скрыть.', tags, access: 'admin', params: z.object({ code: languageCode }) },
  async ({ params }) => {
    if (await Course.exists({ language: params.code })) throw new AppError(409, 'conflict', 'Сначала удалите курсы этого языка или скройте язык');
    const res = await Language.deleteOne({ code: params.code });
    if (res.deletedCount === 0) throw errors.notFound();
  },
);

/* ---------- Topics ---------- */

const topicBody = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,40}$/, 'Ключ: латиница в нижнем регистре и «_»'),
  title: localizedText,
  kind: z.enum(['grammar', 'vocabulary', 'communication']),
});

get('/topics', { summary: 'Темы', tags, access: 'admin' }, async () => (await Topic.find().sort({ key: 1 }).lean()).map(plain));

post('/topics', { summary: 'Добавить тему', tags, access: 'admin', status: 201, body: topicBody }, async ({ body }) => {
  if (await Topic.exists({ key: body.key })) throw errors.conflict();
  return plain((await Topic.create(body)).toObject());
});

patch(
  '/topics/:key',
  { summary: 'Изменить тему', tags, access: 'admin', params: z.object({ key: z.string().max(60) }), body: topicBody.omit({ key: true }).partial() },
  async ({ params, body }) => {
    const doc = await Topic.findOneAndUpdate({ key: params.key }, { $set: body }, { returnDocument: 'after' }).lean();
    if (!doc) throw errors.notFound();
    return plain(doc);
  },
);

/* ---------- Courses ---------- */

const courseBody = z.object({
  language: languageCode,
  level: z.enum(CEFR_LEVELS),
  title: localizedText,
  description: optionalLocalizedText.default({ ru: '' }),
  isPublished: z.boolean().default(false),
});

get('/courses', { summary: 'Курсы (уровни) языка', tags, access: 'admin', query: z.object({ language: languageCode.optional() }) }, async ({ query }) =>
  (await Course.find(query.language ? { language: query.language } : {}).sort({ language: 1, level: 1 }).lean()).map(plain),
);

post('/courses', { summary: 'Создать курс', tags, access: 'admin', status: 201, body: courseBody }, async ({ body }) => {
  if (!(await Language.exists({ code: body.language }))) throw errors.notFound();
  if (await Course.exists({ language: body.language, level: body.level })) throw new AppError(409, 'conflict', 'Курс этого уровня уже существует');
  return plain((await Course.create(body)).toObject());
});

patch(
  '/courses/:id',
  { summary: 'Изменить курс', tags, access: 'admin', params: idParams, body: courseBody.pick({ title: true, description: true, isPublished: true }).partial() },
  async ({ params, body }) => {
    const doc = await Course.findByIdAndUpdate(params.id, { $set: body }, { returnDocument: 'after' }).lean();
    if (!doc) throw errors.notFound();
    return plain(doc);
  },
);

del('/courses/:id', { summary: 'Удалить пустой курс', tags, access: 'admin', params: idParams }, async ({ params }) => {
  if (await CourseModule.exists({ course: params.id })) throw new AppError(409, 'conflict', 'Сначала удалите модули курса');
  const res = await Course.deleteOne({ _id: params.id });
  if (res.deletedCount === 0) throw errors.notFound();
});

/* ---------- Modules ---------- */

const moduleBody = z.object({
  course: objectId,
  title: localizedText,
  description: optionalLocalizedText.default({ ru: '' }),
  order: z.number().int().min(0).max(1000).default(0),
  isPublished: z.boolean().default(false),
});

get('/modules', { summary: 'Модули курса', tags, access: 'admin', query: z.object({ course: objectId }) }, async ({ query }) =>
  (await CourseModule.find({ course: query.course }).sort({ order: 1 }).lean()).map(plain),
);

post('/modules', { summary: 'Создать модуль', tags, access: 'admin', status: 201, body: moduleBody }, async ({ body }) => {
  const course = await Course.findById(body.course).lean();
  if (!course) throw errors.notFound();
  return plain((await CourseModule.create({ ...body, language: course.language, level: course.level })).toObject());
});

patch(
  '/modules/:id',
  { summary: 'Изменить модуль', tags, access: 'admin', params: idParams, body: moduleBody.omit({ course: true }).partial() },
  async ({ params, body }) => {
    const doc = await CourseModule.findByIdAndUpdate(params.id, { $set: body }, { returnDocument: 'after' }).lean();
    if (!doc) throw errors.notFound();
    return plain(doc);
  },
);

del('/modules/:id', { summary: 'Удалить пустой модуль', tags, access: 'admin', params: idParams }, async ({ params }) => {
  if (await Lesson.exists({ module: params.id })) throw new AppError(409, 'conflict', 'Сначала удалите или перенесите уроки модуля');
  await Test.deleteMany({ module: params.id, kind: 'module' });
  const res = await CourseModule.deleteOne({ _id: params.id });
  if (res.deletedCount === 0) throw errors.notFound();
});

/* ---------- Lessons ---------- */

const lessonBody = z.object({
  key: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{2,80}$/, 'Ключ: латиница, цифры, «-» и «_»'),
  module: objectId,
  title: localizedText,
  objective: localizedText,
  topic: z.string().trim().min(1).max(60),
  order: z.number().int().min(0).max(1000).default(0),
  estimatedMinutes: z.number().int().min(1).max(90).default(10),
  prerequisites: z.array(objectId).max(10).default([]),
  theory: z.array(theoryBlockSchema).max(10).default([]),
  words: z.array(objectId).max(60).default([]),
  exercises: z.array(exerciseSchema).max(40).default([]),
  isPublished: z.boolean().default(false),
});

get(
  '/lessons',
  { summary: 'Уроки модуля или языка (без заданий)', tags, access: 'admin', query: z.object({ module: objectId.optional(), language: languageCode.optional() }) },
  async ({ query }) => {
    const filter: Record<string, unknown> = {};
    if (query.module) filter.module = query.module;
    if (query.language) filter.language = query.language;
    const lessons = await Lesson.find(filter).sort({ level: 1, order: 1 }).select('-theory').lean();
    return lessons.map((l) => {
      const { exercises, ...rest } = plain(l);
      return { ...rest, exerciseCount: (exercises as unknown[]).length };
    });
  },
);

get('/lessons/:id', { summary: 'Урок целиком, включая задания и ответы', tags, access: 'admin', params: idParams }, async ({ params }) => {
  const lesson = await Lesson.findById(params.id).lean();
  if (!lesson) throw errors.notFound();
  return plain(lesson);
});

async function lessonPayload(body: z.infer<typeof lessonBody>, ownId?: string) {
  const mod = await CourseModule.findById(body.module).lean();
  if (!mod) throw errors.notFound();
  if (await Lesson.exists({ key: body.key, ...(ownId ? { _id: { $ne: ownId } } : {}) })) throw new AppError(409, 'conflict', 'Урок с таким ключом уже существует');
  await ensureUniqueExerciseKeys(body.exercises, ownId);
  const wordCount = await Word.countDocuments({ _id: { $in: body.words }, language: mod.language });
  if (wordCount !== new Set(body.words).size) throw new AppError(400, 'validation_failed', 'Некоторые слова не найдены или относятся к другому языку');
  return { ...body, course: mod.course, language: mod.language, level: mod.level };
}

post('/lessons', { summary: 'Создать урок', tags, access: 'admin', status: 201, body: lessonBody }, async ({ body }) =>
  plain((await Lesson.create(await lessonPayload(body))).toObject()),
);

put('/lessons/:id', { summary: 'Сохранить урок целиком', tags, access: 'admin', params: idParams, body: lessonBody }, async ({ params, body }) => {
  if (!(await Lesson.exists({ _id: params.id }))) throw errors.notFound();
  const doc = await Lesson.findByIdAndUpdate(params.id, { $set: await lessonPayload(body, params.id) }, { returnDocument: 'after' }).lean();
  return plain(doc!);
});

patch(
  '/lessons/:id/publication',
  { summary: 'Опубликовать или скрыть урок', tags, access: 'admin', params: idParams, body: z.object({ isPublished: z.boolean() }) },
  async ({ params, body }) => {
    const doc = await Lesson.findByIdAndUpdate(params.id, { $set: body }, { returnDocument: 'after' }).select('isPublished').lean();
    if (!doc) throw errors.notFound();
    return { id: String(doc._id), isPublished: doc.isPublished };
  },
);

del(
  '/lessons/:id',
  { summary: 'Удалить урок', description: 'История попыток сохраняется: попытки хранят снимок заданий.', tags, access: 'admin', params: idParams },
  async ({ params }) => {
    const res = await Lesson.deleteOne({ _id: params.id });
    if (res.deletedCount === 0) throw errors.notFound();
    await Promise.all([
      LessonProgress.deleteMany({ lesson: params.id }),
      Test.deleteMany({ lesson: params.id, kind: 'lesson' }),
      Lesson.updateMany({ prerequisites: params.id }, { $pull: { prerequisites: params.id } }),
    ]);
  },
);

/* ---------- Words ---------- */

const wordBody = z.object({
  language: languageCode,
  term: z.string().trim().min(1).max(80),
  translation: localizedText,
  partOfSpeech: z.enum(['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'phrase', 'numeral', 'preposition', 'conjunction', 'interjection', 'other']),
  gender: z.enum(['m', 'f', 'n', 'mf']).nullable().default(null),
  example: z.string().trim().max(300).default(''),
  exampleTranslation: optionalLocalizedText.default({ ru: '' }),
  topic: z.string().trim().min(1).max(60),
  level: z.enum(CEFR_LEVELS).default('A1'),
  audioUrl: z.string().max(500).nullable().default(null),
  imageUrl: z.string().max(500).nullable().default(null),
  isPublished: z.boolean().default(true),
});

get(
  '/words',
  { summary: 'Словарь языка', tags, access: 'admin', query: pagination.extend({ language: languageCode, q: z.string().trim().max(60).optional() }) },
  async ({ query }) => {
    const filter: Record<string, unknown> = { language: query.language };
    if (query.q) {
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ term: { $regex: escaped, $options: 'i' } }, { 'translation.ru': { $regex: escaped, $options: 'i' } }];
    }
    const [items, total] = await Promise.all([
      Word.find(filter).sort({ term: 1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean(),
      Word.countDocuments(filter),
    ]);
    return { items: items.map(plain), total, page: query.page, pageSize: query.pageSize };
  },
);

post('/words', { summary: 'Добавить слово', tags, access: 'admin', status: 201, body: wordBody }, async ({ body }) => {
  if (await Word.exists({ language: body.language, term: body.term })) throw new AppError(409, 'conflict', 'Такое слово уже есть в словаре');
  return plain((await Word.create(body)).toObject());
});

patch('/words/:id', { summary: 'Изменить слово', tags, access: 'admin', params: idParams, body: wordBody.omit({ language: true }).partial() }, async ({ params, body }) => {
  const doc = await Word.findByIdAndUpdate(params.id, { $set: body }, { returnDocument: 'after' }).lean();
  if (!doc) throw errors.notFound();
  return plain(doc);
});

del('/words/:id', { summary: 'Удалить слово (и убрать его из уроков и повторения)', tags, access: 'admin', params: idParams }, async ({ params }) => {
  const res = await Word.deleteOne({ _id: params.id });
  if (res.deletedCount === 0) throw errors.notFound();
  await Promise.all([Lesson.updateMany({ words: params.id }, { $pull: { words: params.id } }), ReviewItem.deleteMany({ word: params.id })]);
});

/* ---------- Tests ---------- */

const testBody = z
  .object({
    kind: z.enum(['placement', 'module', 'lesson']),
    language: languageCode,
    level: z.enum(CEFR_LEVELS).nullable().default(null),
    module: objectId.nullable().default(null),
    lesson: objectId.nullable().default(null),
    title: localizedText,
    passPercent: z.number().int().min(1).max(100).default(70),
    exercises: z.array(exerciseSchema).min(1).max(60),
    isPublished: z.boolean().default(false),
  })
  .refine((t) => t.kind !== 'module' || t.module, { message: 'Для итогового теста модуля укажите модуль', path: ['module'] })
  .refine((t) => t.kind !== 'lesson' || t.lesson, { message: 'Для теста по уроку укажите урок', path: ['lesson'] })
  .refine((t) => t.kind !== 'placement' || t.exercises.every((e) => e.level), { message: 'Во входном тесте у каждого задания должен быть уровень', path: ['exercises'] });

get('/tests', { summary: 'Тесты языка', tags, access: 'admin', query: z.object({ language: languageCode.optional() }) }, async ({ query }) => {
  const tests = await Test.find(query.language ? { language: query.language } : {}).sort({ kind: 1 }).lean();
  return tests.map((t) => {
    const { exercises, ...rest } = plain(t);
    return { ...rest, exerciseCount: (exercises as unknown[]).length };
  });
});

get('/tests/:id', { summary: 'Тест целиком', tags, access: 'admin', params: idParams }, async ({ params }) => {
  const test = await Test.findById(params.id).lean();
  if (!test) throw errors.notFound();
  return plain(test);
});

post('/tests', { summary: 'Создать тест', tags, access: 'admin', status: 201, body: testBody }, async ({ body }) => {
  await ensureUniqueExerciseKeys(body.exercises);
  return plain((await Test.create(body)).toObject());
});

put('/tests/:id', { summary: 'Сохранить тест целиком', tags, access: 'admin', params: idParams, body: testBody }, async ({ params, body }) => {
  if (!(await Test.exists({ _id: params.id }))) throw errors.notFound();
  await ensureUniqueExerciseKeys(body.exercises, undefined, params.id);
  return plain((await Test.findByIdAndUpdate(params.id, { $set: body }, { returnDocument: 'after' }).lean())!);
});

del('/tests/:id', { summary: 'Удалить тест', tags, access: 'admin', params: idParams }, async ({ params }) => {
  const res = await Test.deleteOne({ _id: params.id });
  if (res.deletedCount === 0) throw errors.notFound();
});

export const adminContentRouter = router;
