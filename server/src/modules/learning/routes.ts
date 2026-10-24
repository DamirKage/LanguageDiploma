import { z } from 'zod';
import { CEFR_LEVELS, localize, type AttemptHistoryItemDTO, type LocalizedText, type Paginated } from '@linguapath/shared';
import { createApiRouter, idParams, languageCode, pagination } from '../../lib/http';
import { Attempt } from '../../models/learning';
import { markRecommendationFollowed } from '../recommendations/service';
import {
  completeAttempt,
  getAttemptState,
  getAttemptSummary,
  skipPlacement,
  startLessonAttempt,
  startPlacementAttempt,
  startPracticeAttempt,
  startTestAttempt,
  submitAnswer,
  toState,
} from './attempts';

const text = z.string().max(500);
const answerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('choice'), option: text }),
  z.object({ type: z.literal('fill_blank'), text }),
  z.object({ type: z.literal('translate'), text }),
  z.object({ type: z.literal('order'), tokens: z.array(text).max(30) }),
  z.object({ type: z.literal('match'), pairs: z.array(z.object({ left: text, right: text })).max(10) }),
  z.object({ type: z.literal('listen'), text, skipped: z.boolean().optional() }),
  z.object({ type: z.literal('dialogue'), option: text }),
  z.object({ type: z.literal('speak'), transcript: text, skipped: z.boolean().optional() }),
]);

const startBody = z.object({ recommendationKey: z.string().max(120).optional() }).default({});

const { router, get, post } = createApiRouter('/api');

async function follow(userId: string, language: string, key?: string) {
  if (key) await markRecommendationFollowed(userId, language, key);
}

post(
  '/lessons/:id/attempts',
  {
    summary: 'Начать или продолжить урок',
    description: 'Если у пользователя есть незавершённая попытка этого урока, она возвращается вместо новой.',
    tags: ['Обучение'],
    access: 'user',
    params: idParams,
    body: startBody,
    status: 201,
    returns: 'AttemptStateDTO',
  },
  async ({ params, body, user }) => {
    const attempt = await startLessonAttempt(user.id, params.id, body.recommendationKey);
    await follow(user.id, attempt.language, body.recommendationKey);
    return toState(attempt);
  },
);

post(
  '/tests/:id/attempts',
  { summary: 'Начать тест по уроку или модулю', tags: ['Тестирование'], access: 'user', params: idParams, body: startBody, status: 201, returns: 'AttemptStateDTO' },
  async ({ params, body, user }) => {
    const attempt = await startTestAttempt(user.id, params.id, body.recommendationKey);
    await follow(user.id, attempt.language, body.recommendationKey);
    return toState(attempt);
  },
);

post(
  '/placement/:language/attempts',
  {
    summary: 'Начать адаптивное входное тестирование',
    description: 'Задания выдаются блоками по уровням A1→B2; следующий блок открывается, если правильно решено не менее 2/3 текущего.',
    tags: ['Тестирование'],
    access: 'user',
    params: z.object({ language: languageCode }),
    status: 201,
    returns: 'AttemptStateDTO',
  },
  async ({ params, user }) => toState(await startPlacementAttempt(user.id, params.language)),
);

post(
  '/placement/:language/skip',
  {
    summary: 'Пропустить входное тестирование и выбрать уровень самостоятельно',
    tags: ['Тестирование'],
    access: 'user',
    params: z.object({ language: languageCode }),
    body: z.object({ level: z.enum(CEFR_LEVELS) }),
  },
  async ({ params, body, user }) => {
    const e = await skipPlacement(user.id, params.language, body.level);
    return { language: e.language, level: e.level };
  },
);

post(
  '/practice/attempts',
  {
    summary: 'Начать целевую практику (по теме или по слабым местам)',
    tags: ['Обучение'],
    access: 'user',
    status: 201,
    returns: 'AttemptStateDTO',
    body: z.object({ language: languageCode, topic: z.string().trim().max(60).optional(), recommendationKey: z.string().max(120).optional() }),
  },
  async ({ body, user }) => {
    const attempt = await startPracticeAttempt(user.id, body.language, { topic: body.topic, recommendationKey: body.recommendationKey });
    await follow(user.id, body.language, body.recommendationKey);
    return toState(attempt);
  },
);

get(
  '/attempts/:id',
  { summary: 'Текущее состояние попытки и очередное задание', tags: ['Обучение'], access: 'user', params: idParams, returns: 'AttemptStateDTO' },
  async ({ params, user }) => getAttemptState(user.id, params.id),
);

post(
  '/attempts/:id/answers',
  {
    summary: 'Отправить ответ на текущее задание',
    description: 'В уроках и практике возвращается немедленная обратная связь, в тестах — только после завершения.',
    tags: ['Обучение'],
    access: 'user',
    params: idParams,
    returns: 'AnswerResultDTO',
    body: z.object({ itemIndex: z.number().int().min(0), answer: answerSchema, timeMs: z.number().int().min(0).max(3_600_000).optional() }),
  },
  async ({ params, body, user }) => submitAnswer(user.id, params.id, body),
);

post(
  '/attempts/:id/complete',
  { summary: 'Завершить попытку и получить итоги', tags: ['Обучение'], access: 'user', params: idParams, returns: 'AttemptSummaryDTO' },
  async ({ params, user }) => completeAttempt(user.id, params.id),
);

get(
  '/attempts/:id/summary',
  { summary: 'Итоги завершённой попытки', tags: ['Обучение'], access: 'user', params: idParams, returns: 'AttemptSummaryDTO' },
  async ({ params, user }) => getAttemptSummary(user.id, params.id),
);

get(
  '/me/attempts',
  {
    summary: 'История завершённых попыток',
    tags: ['Аналитика'],
    access: 'user',
    returns: 'Paginated<AttemptHistoryItemDTO>',
    query: pagination.extend({ language: languageCode.optional(), kind: z.enum(['lesson', 'test', 'practice', 'placement']).optional() }),
  },
  async ({ query, user }): Promise<Paginated<AttemptHistoryItemDTO>> => {
    const filter: Record<string, unknown> = { user: user.id, status: 'completed' };
    if (query.language) filter.language = query.language;
    if (query.kind) filter.kind = query.kind;
    const [items, total] = await Promise.all([
      Attempt.find(filter)
        .sort({ completedAt: -1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .select('kind title language level result completedAt durationSec')
        .lean(),
      Attempt.countDocuments(filter),
    ]);
    return {
      items: items.map((a) => ({
        id: String(a._id),
        kind: a.kind as AttemptHistoryItemDTO['kind'],
        title: localize(a.title as LocalizedText),
        language: a.language,
        level: (a.level as AttemptHistoryItemDTO['level']) ?? null,
        percent: a.result?.percent ?? 0,
        points: a.result?.points ?? 0,
        passed: !!a.result?.passed,
        completedAt: a.completedAt!.toISOString(),
        durationSec: a.durationSec,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  },
);

export const learningRouter = router;
