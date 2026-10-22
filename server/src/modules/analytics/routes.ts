import { z } from 'zod';
import { createApiRouter, languageCode } from '../../lib/http';
import { getErrorAnalytics, getOverview, getSrsAnalytics, getTimeline, getTopicAnalytics } from './service';

const { router, get } = createApiRouter('/api/me/analytics');
const params = z.object({ language: languageCode });

get(
  '/:language/overview',
  { summary: 'Сводка прогресса по языку', tags: ['Аналитика'], access: 'user', params, returns: 'ProgressOverviewDTO' },
  async ({ params, user }) => getOverview(user.id, params.language),
);

get(
  '/:language/timeline',
  {
    summary: 'Динамика по дням: ответы, точность, минуты, повторения',
    tags: ['Аналитика'],
    access: 'user',
    params,
    query: z.object({ days: z.coerce.number().int().min(7).max(90).default(30) }),
    returns: 'TimelinePointDTO[]',
  },
  async ({ params, query, user }) => getTimeline(user.id, params.language, query.days),
);

get(
  '/:language/topics',
  { summary: 'Точность по темам и её изменение', tags: ['Аналитика'], access: 'user', params, returns: 'TopicAnalyticsDTO[]' },
  async ({ params, user }) => getTopicAnalytics(user.id, params.language),
);

get(
  '/:language/errors',
  { summary: 'Анализ ошибок по категориям, типам заданий и навыкам', tags: ['Аналитика'], access: 'user', params, returns: 'ErrorAnalyticsDTO' },
  async ({ params, user }) => getErrorAnalytics(user.id, params.language),
);

get(
  '/:language/srs',
  { summary: 'Состояние интервального повторения и прогноз нагрузки', tags: ['Аналитика'], access: 'user', params, returns: 'SrsAnalyticsDTO' },
  async ({ params, user }) => getSrsAnalytics(user.id, params.language),
);

export const analyticsRouter = router;
