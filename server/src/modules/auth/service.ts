import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import type { UserDTO } from '@slog/shared';
import { config } from '../../config';
import { AppError, errors } from '../../lib/errors';
import { PasswordResetToken, RefreshToken, User, type UserDoc } from '../../models/user';
import { sendMail } from '../../integrations/mailer';
import { signAccessToken } from './middleware';

export const REFRESH_COOKIE = 'slog_rt';
const RESET_TTL_MS = 60 * 60 * 1000;
const REUSE_GRACE_MS = 10_000;

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const randomToken = () => crypto.randomBytes(48).toString('base64url');

export function toUserDTO(user: UserDoc): UserDTO {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    uiLocale: user.uiLocale,
    timezone: user.timezone,
    dailyMinutes: user.dailyMinutes,
    goals: user.goals as UserDTO['goals'],
    activeLanguage: user.activeLanguage ?? null,
    onboarded: user.onboarded,
    createdAt: (user.get('createdAt') as Date).toISOString(),
  };
}

export function validatePasswordStrength(password: string, email?: string) {
  const hasLetter = /\p{L}/u.test(password);
  const hasDigit = /\d/.test(password);
  const tooSimilar = email ? password.toLowerCase().includes(email.split('@')[0]!.toLowerCase()) : false;
  if (password.length < 8 || !hasLetter || !hasDigit || tooSimilar) throw new AppError(400, 'weak_password');
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, config.bcryptRounds);
}

/** Constant-work comparison target so unknown emails take as long as wrong passwords. */
const DUMMY_HASH = bcrypt.hashSync('dummy-password-0', 4);

async function issueRefreshToken(userId: string, family: string, userAgent?: string) {
  const token = randomToken();
  await RefreshToken.create({
    user: userId,
    tokenHash: sha256(token),
    family,
    expiresAt: new Date(Date.now() + config.refreshTokenTtlDays * 86400_000),
    userAgent: userAgent?.slice(0, 300),
  });
  return token;
}

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: config.refreshTokenTtlDays * 86400_000,
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: config.cookieSecure, sameSite: 'strict', path: '/api/auth' });
}

export async function startSession(user: UserDoc, res: Response, userAgent?: string) {
  const refresh = await issueRefreshToken(String(user._id), crypto.randomUUID(), userAgent);
  setRefreshCookie(res, refresh);
  return {
    user: toUserDTO(user),
    accessToken: signAccessToken(String(user._id), user.role),
    expiresIn: config.accessTokenTtlSec,
  };
}

export async function register(input: { email: string; password: string; name: string; timezone?: string }) {
  validatePasswordStrength(input.password, input.email);
  const exists = await User.exists({ email: input.email });
  if (exists) throw errors.conflict('email_taken');
  try {
    return await User.create({
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      timezone: input.timezone ?? 'Asia/Almaty',
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw errors.conflict('email_taken');
    throw err;
  }
}

export async function login(email: string, password: string): Promise<UserDoc> {
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'invalid_credentials');
  if (user.isBlocked) throw errors.forbidden('account_blocked');
  return user;
}

/**
 * Rotates the refresh token. Presenting a token that was already rotated means it
 * leaked or was replayed, so the whole token family is revoked.
 */
export async function rotateRefreshToken(token: string | undefined, res: Response, userAgent?: string) {
  if (!token) throw errors.unauthorized();
  const stored = await RefreshToken.findOne({ tokenHash: sha256(token) });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    clearRefreshCookie(res);
    throw errors.unauthorized('token_expired');
  }
  // Two tabs refreshing at the same moment present the same token; only a later
  // reuse is treated as theft.
  const concurrent = stored.usedAt && Date.now() - stored.usedAt.getTime() < REUSE_GRACE_MS;
  if (stored.usedAt && !concurrent) {
    await RefreshToken.updateMany({ family: stored.family }, { $set: { revokedAt: new Date() } });
    clearRefreshCookie(res);
    throw errors.unauthorized('token_expired');
  }
  const user = await User.findById(stored.user);
  if (!user || user.isBlocked) {
    clearRefreshCookie(res);
    throw errors.unauthorized();
  }
  if (!concurrent) {
    const claimed = await RefreshToken.updateOne({ _id: stored._id, usedAt: null }, { $set: { usedAt: new Date() } });
    if (claimed.modifiedCount !== 1) throw errors.unauthorized('token_expired');
  }
  const next = await issueRefreshToken(String(user._id), stored.family, userAgent);
  setRefreshCookie(res, next);
  return {
    user: toUserDTO(user),
    accessToken: signAccessToken(String(user._id), user.role),
    expiresIn: config.accessTokenTtlSec,
  };
}

export async function revokeRefreshToken(token: string | undefined) {
  if (!token) return;
  const stored = await RefreshToken.findOne({ tokenHash: sha256(token) });
  if (stored) await RefreshToken.updateMany({ family: stored.family }, { $set: { revokedAt: new Date() } });
}

export async function revokeAllSessions(userId: string) {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function requestPasswordReset(email: string): Promise<{ devResetUrl?: string }> {
  const user = await User.findOne({ email });
  if (!user || user.isBlocked) return {};
  const token = randomToken();
  await PasswordResetToken.create({ user: user._id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) });
  const url = `${config.publicAppUrl}/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: user.email,
    subject: 'Восстановление пароля — Слог',
    text: `Здравствуйте, ${user.name}!\n\nЧтобы задать новый пароль, перейдите по ссылке (действует 1 час):\n${url}\n\nЕсли вы не запрашивали восстановление, просто проигнорируйте это письмо.`,
  });
  return config.exposeDevLinks ? { devResetUrl: url } : {};
}

export async function resetPassword(token: string, password: string) {
  const record = await PasswordResetToken.findOne({ tokenHash: sha256(token) });
  if (!record || record.usedAt || record.expiresAt < new Date()) throw new AppError(400, 'invalid_token');
  const user = await User.findById(record.user);
  if (!user) throw new AppError(400, 'invalid_token');
  validatePasswordStrength(password, user.email);
  const claimed = await PasswordResetToken.updateOne({ _id: record._id, usedAt: null }, { $set: { usedAt: new Date() } });
  if (claimed.modifiedCount !== 1) throw new AppError(400, 'invalid_token');
  user.passwordHash = await hashPassword(password);
  await user.save();
  await revokeAllSessions(String(user._id));
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw errors.notFound();
  if (!(await bcrypt.compare(current, user.passwordHash))) throw new AppError(400, 'wrong_password');
  validatePasswordStrength(next, user.email);
  user.passwordHash = await hashPassword(next);
  await user.save();
  await revokeAllSessions(userId);
  return user;
}

export async function verifyPassword(userId: string, password: string) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new AppError(400, 'wrong_password');
  return user;
}
