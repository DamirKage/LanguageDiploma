import { z } from 'zod';
import { createApiRouter, languageCode, objectId } from '../../lib/http';
import { answerReview, getReviewQueue } from './service';

const { router, get, post } = createApiRouter('/api/reviews');

get(
  '/:language/queue',
  {
    summary: 'Очередь слов на повторение на сегодня',
    description: 'Слова с наступившей датой повторения (по часовому поясу пользователя) и ограниченное число новых слов в день.',
    tags: ['Повторение'],
    access: 'user',
    returns: 'ReviewQueueDTO',
    params: z.object({ language: languageCode }),
    query: z.object({ mode: z.enum(['auto', 'flip']).default('auto') }),
  },
  async ({ params, query, user }) => getReviewQueue(user.id, params.language, new Date(), user.timezone, query.mode),
);

post(
  '/:wordId/answer',
  {
    summary: 'Ответ на карточку повторения; пересчитывает расписание по SM-2',
    tags: ['Повторение'],
    access: 'user',
    returns: 'ReviewAnswerResultDTO',
    params: z.object({ wordId: objectId }),
    body: z.discriminatedUnion('mode', [
      z.object({ mode: z.literal('flip'), grade: z.enum(['again', 'hard', 'good', 'easy']) }),
      z.object({ mode: z.literal('typed'), text: z.string().max(200), timeMs: z.number().int().min(0).max(600_000).optional() }),
      z.object({ mode: z.literal('choice'), option: z.string().max(200), timeMs: z.number().int().min(0).max(600_000).optional() }),
    ]),
  },
  async ({ params, body, user }) => answerReview(user.id, params.wordId, body, new Date(), user.timezone),
);

export const reviewsRouter = router;
