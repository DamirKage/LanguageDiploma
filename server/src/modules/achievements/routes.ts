import { z } from 'zod';
import { CEFR_LEVELS } from '@linguapath/shared';
import { createApiRouter, languageCode } from '../../lib/http';
import { findCertificate, getAchievements, issueCertificate } from './service';

const { router, get, post } = createApiRouter('/api');

get(
  '/me/achievements/:language',
  {
    summary: 'Ритм недели, достижения и статус сертификатов по уровням',
    description: 'Недельная цель — 4 дня занятий; пропущенный день ничего не отнимает. Достижения фиксируются в момент первого достижения и не отбираются.',
    tags: ['Мотивация'],
    access: 'user',
    params: z.object({ language: languageCode }),
    returns: 'AchievementsDTO',
  },
  async ({ params, user }) => getAchievements(user.id, params.language),
);

post(
  '/me/certificates',
  {
    summary: 'Получить сертификат о прохождении уровня',
    description: 'Выдаётся, когда все уроки уровня пройдены не ниже проходного балла и все итоговые тесты модулей уровня сданы. Повторный запрос возвращает уже выданный сертификат.',
    tags: ['Мотивация'],
    access: 'user',
    body: z.object({ language: languageCode, level: z.enum(CEFR_LEVELS) }),
    status: 201,
    returns: 'CertificateDTO',
  },
  async ({ body, user }) => issueCertificate(user.id, body.language, body.level),
);

get(
  '/certificates/:code',
  {
    summary: 'Проверка подлинности сертификата по коду',
    description: 'Открытый метод: по коду с сертификата возвращает имя, язык, уровень, дату и итоги. Почта и другие данные не раскрываются.',
    tags: ['Мотивация'],
    access: 'public',
    params: z.object({ code: z.string().trim().min(6).max(20) }),
    returns: 'CertificateDTO',
  },
  async ({ params }) => findCertificate(params.code),
);

export const achievementsRouter = router;
