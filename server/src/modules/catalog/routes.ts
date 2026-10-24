import { z } from 'zod';
import {
  localize,
  type CefrLevel,
  type LanguageDTO,
  type LearningPathDTO,
  type LessonDetailDTO,
  type LocalizedText,
  type TopicDTO,
  type VocabularyItemDTO,
  type WordDTO,
} from '@linguapath/shared';
import { errors } from '../../lib/errors';
import { createApiRouter, idParams, languageCode } from '../../lib/http';
import { Course, Language, Lesson, Test, Topic, Word } from '../../models/content';
import { Enrollment } from '../../models/user';
import { Attempt, LessonProgress, ReviewItem } from '../../models/learning';
import { srsState } from '../srs/sm2';
import { lookupWord } from '../../integrations/dictionary';
import { loadCatalog } from './catalog';

const { router, get } = createApiRouter('/api');

type WordLean = {
  _id: unknown;
  language: string;
  term: string;
  translation: LocalizedText;
  partOfSpeech: string;
  gender?: string | null;
  example: string;
  exampleTranslation: LocalizedText;
  topic: string;
  level: string;
  audioUrl?: string | null;
  imageUrl?: string | null;
};

export function toWordDTO(w: WordLean, locale = 'ru'): WordDTO {
  return {
    id: String(w._id),
    language: w.language,
    term: w.term,
    translation: localize(w.translation, locale),
    partOfSpeech: w.partOfSpeech,
    gender: w.gender ?? null,
    example: w.example,
    exampleTranslation: localize(w.exampleTranslation, locale),
    topic: w.topic,
    level: w.level as CefrLevel,
    audioUrl: w.audioUrl ?? null,
    imageUrl: w.imageUrl ?? null,
  };
}

get(
  '/languages',
  { summary: 'Список доступных для изучения языков', tags: ['Каталог'], access: 'public', returns: 'LanguageDTO[]' },
  async (): Promise<LanguageDTO[]> => {
    const [languages, courses, lessonCounts] = await Promise.all([
      Language.find({ isPublished: true }).sort({ order: 1 }).lean(),
      Course.find({ isPublished: true }).select('language level').lean(),
      Lesson.aggregate<{ _id: string; count: number }>([{ $match: { isPublished: true } }, { $group: { _id: '$language', count: { $sum: 1 } } }]),
    ]);
    const counts = new Map(lessonCounts.map((c) => [c._id, c.count]));
    return languages.map((l) => ({
      code: l.code,
      name: localize(l.name as LocalizedText),
      nativeName: l.nativeName,
      ttsLocale: l.ttsLocale,
      specialChars: l.specialChars,
      levels: courses.filter((c) => c.language === l.code).map((c) => c.level as CefrLevel),
      lessonCount: counts.get(l.code) ?? 0,
      isPublished: l.isPublished,
    }));
  },
);

get(
  '/topics',
  { summary: 'Темы учебных материалов', tags: ['Каталог'], access: 'public', returns: 'TopicDTO[]' },
  async (): Promise<TopicDTO[]> => {
    const topics = await Topic.find().sort({ key: 1 }).lean();
    return topics.map((t) => ({ key: t.key, title: localize(t.title as LocalizedText), kind: t.kind as TopicDTO['kind'] }));
  },
);

get(
  '/languages/:code/path',
  {
    summary: 'Учебный путь по языку: уровни, модули, уроки и прогресс пользователя',
    tags: ['Каталог'],
    access: 'user',
    params: z.object({ code: languageCode }),
    returns: 'LearningPathDTO',
  },
  async ({ params, user }): Promise<LearningPathDTO> => {
    const language = params.code;
    if (!(await Language.exists({ code: language, isPublished: true }))) throw errors.notFound();
    const [catalog, progress, inProgress, testAttempts, enrollment] = await Promise.all([
      loadCatalog(language),
      LessonProgress.find({ user: user.id, language }).lean(),
      Attempt.find({ user: user.id, language, kind: 'lesson', status: 'in_progress' }).select('lesson').lean(),
      Attempt.find({ user: user.id, language, kind: 'test', status: 'completed' }).select('test result').lean(),
      Enrollment.findOne({ user: user.id, language }).lean(),
    ]);
    const progressBy = new Map(progress.map((p) => [String(p.lesson), p]));
    const resumeBy = new Map(inProgress.map((a) => [String(a.lesson), String(a._id)]));
    const best = new Map<string, { percent: number; passed: boolean }>();
    for (const a of testAttempts) {
      const id = String(a.test);
      const prev = best.get(id);
      best.set(id, { percent: Math.max(prev?.percent ?? 0, a.result?.percent ?? 0), passed: !!(prev?.passed || a.result?.passed) });
    }
    const lessonTests = new Map(catalog.tests.filter((t) => t.kind === 'lesson').map((t) => [t.lessonId!, t.id]));

    return {
      language,
      currentLevel: (enrollment?.level as CefrLevel) ?? null,
      levels: catalog.courses.map((course) => {
        const modules = catalog.modules
          .filter((m) => m.courseId === course.id)
          .map((m) => {
            const test = catalog.tests.find((t) => t.kind === 'module' && t.moduleId === m.id);
            const result = test ? best.get(test.id) : undefined;
            return {
              id: m.id,
              title: localize(m.title),
              description: localize(m.description),
              order: m.order,
              test: test ? { id: test.id, title: localize(test.title), bestPercent: result?.percent ?? null, passed: !!result?.passed } : null,
              lessons: catalog.lessons
                .filter((l) => l.moduleId === m.id)
                .map((l) => {
                  const p = progressBy.get(l.id);
                  return {
                    id: l.id,
                    key: l.key,
                    title: localize(l.title),
                    objective: localize(l.objective),
                    topic: l.topic,
                    estimatedMinutes: l.estimatedMinutes,
                    exerciseCount: l.exerciseCount,
                    status: p?.status === 'completed' ? ('completed' as const) : resumeBy.has(l.id) || p ? ('in_progress' as const) : ('not_started' as const),
                    bestPercent: p?.bestPercent ?? null,
                    attempts: p?.attempts ?? 0,
                    resumeAttemptId: resumeBy.get(l.id) ?? null,
                    testId: lessonTests.get(l.id) ?? null,
                  };
                }),
            };
          });
        const lessons = modules.flatMap((m) => m.lessons);
        return {
          level: course.level,
          courseId: course.id,
          title: localize(course.title),
          description: localize(course.description),
          modules,
          completedLessons: lessons.filter((l) => l.status === 'completed').length,
          totalLessons: lessons.length,
        };
      }),
    };
  },
);

get(
  '/lessons/:id',
  { summary: 'Урок: цель, теория и словарь (без ответов к заданиям)', tags: ['Каталог'], access: 'user', params: idParams, returns: 'LessonDetailDTO' },
  async ({ params, user }): Promise<LessonDetailDTO> => {
    const lesson = await Lesson.findOne({ _id: params.id, isPublished: true }).populate('module', 'title').populate('words').lean();
    if (!lesson) throw errors.notFound();
    const [progress, resume, test] = await Promise.all([
      LessonProgress.findOne({ user: user.id, lesson: lesson._id }).lean(),
      Attempt.findOne({ user: user.id, lesson: lesson._id, kind: 'lesson', status: 'in_progress' }).select('_id').lean(),
      Test.findOne({ lesson: lesson._id, kind: 'lesson', isPublished: true }).select('_id').lean(),
    ]);
    const theory = lesson.theory as Array<{ title: LocalizedText; body: LocalizedText; examples?: Array<{ target: string; translation: LocalizedText }> }>;
    return {
      id: String(lesson._id),
      key: lesson.key,
      language: lesson.language,
      level: lesson.level as CefrLevel,
      title: localize(lesson.title as LocalizedText),
      objective: localize(lesson.objective as LocalizedText),
      topic: lesson.topic,
      moduleTitle: localize((lesson.module as unknown as { title: LocalizedText }).title),
      estimatedMinutes: lesson.estimatedMinutes,
      exerciseCount: (lesson.exercises as unknown[]).length,
      theory: theory.map((b) => ({
        title: localize(b.title),
        body: localize(b.body),
        examples: (b.examples ?? []).map((e) => ({ target: e.target, translation: localize(e.translation) })),
      })),
      words: (lesson.words as unknown as WordLean[]).map((w) => toWordDTO(w)),
      status: progress?.status === 'completed' ? 'completed' : progress || resume ? 'in_progress' : 'not_started',
      bestPercent: progress?.bestPercent ?? null,
      resumeAttemptId: resume ? String(resume._id) : null,
      testId: test ? String(test._id) : null,
    };
  },
);

get(
  '/languages/:code/vocabulary',
  {
    summary: 'Словарь пользователя: слова из пройденных уроков с состоянием повторения',
    tags: ['Словарь'],
    access: 'user',
    params: z.object({ code: languageCode }),
    query: z.object({
      scope: z.enum(['mine', 'all']).default('mine'),
      q: z.string().trim().max(60).optional(),
      topic: z.string().trim().max(60).optional(),
      state: z.enum(['new', 'learning', 'review', 'mastered', 'leech']).optional(),
    }),
    returns: 'VocabularyItemDTO[]',
  },
  async ({ params, query, user }): Promise<VocabularyItemDTO[]> => {
    const items = await ReviewItem.find({ user: user.id, language: params.code }).lean();
    const byWord = new Map(items.map((i) => [String(i.word), i]));
    const filter: Record<string, unknown> = { language: params.code, isPublished: true };
    if (query.scope === 'mine') filter._id = { $in: items.map((i) => i.word) };
    if (query.topic) filter.topic = query.topic;
    if (query.q) {
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ term: { $regex: escaped, $options: 'i' } }, { 'translation.ru': { $regex: escaped, $options: 'i' } }];
    }
    const words = await Word.find(filter).sort({ level: 1, term: 1 }).limit(500).lean<WordLean[]>();
    const out = words.map((w) => {
      const item = byWord.get(String(w._id));
      return {
        ...toWordDTO(w),
        srs: item
          ? {
              state: srsState(item),
              dueAt: item.dueAt.toISOString(),
              intervalDays: item.intervalDays,
              repetitions: item.repetitions,
              lapses: item.lapses,
              easeFactor: item.easeFactor,
            }
          : null,
      };
    });
    return query.state ? out.filter((w) => w.srs?.state === query.state) : out;
  },
);

get(
  '/dictionary/lookup',
  {
    summary: 'Справка из внешнего словаря (Wiktionary) с кэшированием',
    description: 'Определения предоставляются Wiktionary на английском языке. При недоступности сервиса возвращается 503.',
    tags: ['Словарь'],
    access: 'user',
    query: z.object({ language: languageCode, term: z.string().trim().min(1).max(60) }),
  },
  async ({ query }) => lookupWord(query.language, query.term),
);

export const catalogRouter = router;
