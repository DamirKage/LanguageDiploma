import { z } from 'zod';
import { createApiRouter, languageCode } from '../../lib/http';
import { getRecommendations, getTodayPlan } from './service';

const { router, get, post } = createApiRouter('/api/me');
const params = z.object({ language: languageCode });

get(
  '/recommendations/:language',
  {
    summary: 'Персональные рекомендации с объяснением причин',
    description: 'Каждая рекомендация содержит коды причин с параметрами и значения признаков, на основе которых рассчитан балл.',
    tags: ['Персонализация'],
    access: 'user',
    returns: 'RecommendationResult',
    params,
  },
  async ({ params, user }) => getRecommendations(user.id, params.language),
);

get(
  '/plan/:language',
  { summary: 'План занятий на сегодня с отметками о выполнении', tags: ['Персонализация'], access: 'user', returns: 'StudyPlan', params },
  async ({ params, user }) => getTodayPlan(user.id, params.language),
);

post(
  '/plan/:language/rebuild',
  { summary: 'Пересобрать план на сегодня по актуальным данным', tags: ['Персонализация'], access: 'user', returns: 'StudyPlan', params },
  async ({ params, user }) => getTodayPlan(user.id, params.language, { rebuild: true }),
);

export const recommendationsRouter = router;
