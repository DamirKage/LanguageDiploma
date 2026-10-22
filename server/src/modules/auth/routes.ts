import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../../config';
import { AppError } from '../../lib/errors';
import { createApiRouter } from '../../lib/http';
import { isValidTimezone } from '../../lib/time';
import { requireCsrfHeader } from './middleware';
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  login,
  register,
  requestPasswordReset,
  resetPassword,
  revokeRefreshToken,
  rotateRefreshToken,
  startSession,
} from './service';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => !config.rateLimitEnabled,
  handler: () => {
    throw new AppError(429, 'rate_limited');
  },
});

const email = z.string().trim().toLowerCase().email('Некорректный адрес электронной почты').max(254);
const password = z.string().min(1).max(128);

const { router, post } = createApiRouter('/api/auth');

post(
  '/register',
  {
    summary: 'Регистрация нового пользователя',
    tags: ['Аутентификация'],
    access: 'public',
    status: 201,
    returns: 'AuthResponse',
    middleware: [authLimiter],
    body: z.object({
      email,
      password,
      name: z.string().trim().min(1).max(80),
      timezone: z.string().refine(isValidTimezone, 'Неизвестный часовой пояс').optional(),
    }),
  },
  async ({ body, req, res }) => {
    const user = await register(body);
    return startSession(user, res, req.get('user-agent'));
  },
);

post(
  '/login',
  {
    summary: 'Вход по адресу электронной почты и паролю',
    tags: ['Аутентификация'],
    access: 'public',
    returns: 'AuthResponse',
    middleware: [authLimiter],
    body: z.object({ email, password }),
  },
  async ({ body, req, res }) => {
    const user = await login(body.email, body.password);
    return startSession(user, res, req.get('user-agent'));
  },
);

post(
  '/refresh',
  {
    summary: 'Обновление access-токена по refresh-cookie (с ротацией)',
    description: 'Требует заголовок `X-Requested-With: slog` для защиты от CSRF.',
    tags: ['Аутентификация'],
    access: 'public',
    returns: 'AuthResponse',
    middleware: [requireCsrfHeader],
  },
  async ({ req, res }) => rotateRefreshToken(req.cookies?.[REFRESH_COOKIE], res, req.get('user-agent')),
);

post(
  '/logout',
  {
    summary: 'Выход: отзыв refresh-токена текущего устройства',
    tags: ['Аутентификация'],
    access: 'public',
    middleware: [requireCsrfHeader],
  },
  async ({ req, res }) => {
    await revokeRefreshToken(req.cookies?.[REFRESH_COOKIE]);
    clearRefreshCookie(res);
  },
);

post(
  '/forgot-password',
  {
    summary: 'Запрос ссылки для восстановления пароля',
    description: 'Ответ одинаков вне зависимости от существования аккаунта.',
    tags: ['Аутентификация'],
    access: 'public',
    status: 202,
    middleware: [authLimiter],
    body: z.object({ email }),
  },
  async ({ body }) => ({ ok: true, ...(await requestPasswordReset(body.email)) }),
);

post(
  '/reset-password',
  {
    summary: 'Установка нового пароля по токену из письма',
    tags: ['Аутентификация'],
    access: 'public',
    middleware: [authLimiter],
    body: z.object({ token: z.string().min(10).max(200), password }),
  },
  async ({ body }) => {
    await resetPassword(body.token, body.password);
    return { ok: true };
  },
);

export const authRouter = router;
