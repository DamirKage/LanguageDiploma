import { z } from 'zod';
import { CEFR_LEVELS, DAILY_MINUTES_OPTIONS, LEARNING_GOALS, UI_LOCALES, type EnrollmentDTO } from '@linguapath/shared';
import { errors } from '../../lib/errors';
import { createApiRouter, languageCode } from '../../lib/http';
import { isValidTimezone } from '../../lib/time';
import { Language } from '../../models/content';
import {
  AnswerEvent,
  Attempt,
  DailyPlan,
  LessonProgress,
  RecommendationSnapshot,
  ReviewItem,
  ReviewLog,
} from '../../models/learning';
import { Enrollment, PasswordResetToken, RefreshToken, User } from '../../models/user';
import { changePassword, clearRefreshCookie, startSession, toUserDTO, verifyPassword } from '../auth/service';

const { router, get, patch, post, delete: del } = createApiRouter('/api/me');

type EnrollmentLean = {
  language: string;
  level: string;
  placementLevel?: string | null;
  placementAt?: Date | null;
  createdAt?: Date;
  lastActivityAt?: Date | null;
};

function toEnrollmentDTO(e: EnrollmentLean): EnrollmentDTO {
  return {
    language: e.language,
    level: e.level as EnrollmentDTO['level'],
    placementLevel: (e.placementLevel as EnrollmentDTO['placementLevel']) ?? null,
    placementAt: e.placementAt?.toISOString() ?? null,
    startedAt: (e.createdAt ?? new Date()).toISOString(),
    lastActivityAt: e.lastActivityAt?.toISOString() ?? null,
  };
}

get('', { summary: 'Профиль текущего пользователя', tags: ['Профиль'], access: 'user', returns: 'UserDTO' }, async ({ user }) => {
  const doc = await User.findById(user.id);
  if (!doc) throw errors.notFound();
  return toUserDTO(doc);
});

patch(
  '',
  {
    summary: 'Изменение профиля и учебных настроек',
    tags: ['Профиль'],
    access: 'user',
    returns: 'UserDTO',
    body: z
      .object({
        name: z.string().trim().min(1).max(80),
        timezone: z.string().refine(isValidTimezone, 'Неизвестный часовой пояс'),
        dailyMinutes: z.number().int().refine((v) => (DAILY_MINUTES_OPTIONS as readonly number[]).includes(v), 'Недопустимое значение'),
        goals: z.array(z.enum(LEARNING_GOALS)).max(LEARNING_GOALS.length),
        activeLanguage: languageCode,
        uiLocale: z.enum(UI_LOCALES),
        onboarded: z.literal(true),
      })
      .partial()
      .strict(),
  },
  async ({ body, user }) => {
    if (body.activeLanguage && !(await Enrollment.exists({ user: user.id, language: body.activeLanguage }))) {
      throw errors.badRequest('not_enrolled');
    }
    const doc = await User.findByIdAndUpdate(user.id, { $set: { ...body, ...(body.goals ? { goals: [...new Set(body.goals)] } : {}) } }, { returnDocument: 'after' });
    if (!doc) throw errors.notFound();
    return toUserDTO(doc);
  },
);

patch(
  '/password',
  {
    summary: 'Смена пароля (все другие сессии будут завершены)',
    tags: ['Профиль'],
    access: 'user',
    returns: 'AuthResponse',
    body: z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(1).max(128) }),
  },
  async ({ body, user, req, res }) => {
    const doc = await changePassword(user.id, body.currentPassword, body.newPassword);
    return startSession(doc, res, req.get('user-agent'));
  },
);

del(
  '',
  {
    summary: 'Удаление аккаунта и всех учебных данных пользователя',
    tags: ['Профиль'],
    access: 'user',
    body: z.object({ password: z.string().min(1).max(128) }),
  },
  async ({ body, user, res }) => {
    await verifyPassword(user.id, body.password);
    const filter = { user: user.id };
    await Promise.all([
      Attempt.deleteMany(filter),
      AnswerEvent.deleteMany(filter),
      LessonProgress.deleteMany(filter),
      ReviewItem.deleteMany(filter),
      ReviewLog.deleteMany(filter),
      RecommendationSnapshot.deleteMany(filter),
      DailyPlan.deleteMany(filter),
      Enrollment.deleteMany(filter),
      RefreshToken.deleteMany(filter),
      PasswordResetToken.deleteMany(filter),
    ]);
    await User.deleteOne({ _id: user.id });
    clearRefreshCookie(res);
  },
);

get('/enrollments', { summary: 'Изучаемые языки пользователя', tags: ['Профиль'], access: 'user', returns: 'EnrollmentDTO[]' }, async ({ user }) => {
  const list = await Enrollment.find({ user: user.id }).sort({ createdAt: 1 }).lean();
  return list.map(toEnrollmentDTO);
});

post(
  '/enrollments',
  {
    summary: 'Начать изучение языка',
    description: 'Если язык уже выбран, возвращается существующая запись. Язык становится активным.',
    tags: ['Профиль'],
    access: 'user',
    status: 201,
    returns: 'EnrollmentDTO',
    body: z.object({ language: languageCode, level: z.enum(CEFR_LEVELS).optional() }),
  },
  async ({ body, user }) => {
    if (!(await Language.exists({ code: body.language, isPublished: true }))) throw errors.notFound();
    const enrollment = await Enrollment.findOneAndUpdate(
      { user: user.id, language: body.language },
      { $setOnInsert: { level: body.level ?? 'A1' } },
      { upsert: true, returnDocument: 'after' },
    ).lean();
    await User.updateOne({ _id: user.id }, { $set: { activeLanguage: body.language } });
    return toEnrollmentDTO(enrollment!);
  },
);

patch(
  '/enrollments/:language',
  {
    summary: 'Изменение текущего уровня по языку',
    tags: ['Профиль'],
    access: 'user',
    returns: 'EnrollmentDTO',
    params: z.object({ language: languageCode }),
    body: z.object({ level: z.enum(CEFR_LEVELS) }),
  },
  async ({ params, body, user }) => {
    const enrollment = await Enrollment.findOneAndUpdate(
      { user: user.id, language: params.language },
      { $set: { level: body.level } },
      { returnDocument: 'after' },
    ).lean();
    if (!enrollment) throw errors.badRequest('not_enrolled');
    return toEnrollmentDTO(enrollment);
  },
);

export const meRouter = router;
