import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@slog/shared';
import { config } from '../../config';
import { AppError, errors } from '../../lib/errors';
import { User } from '../../models/user';

export interface AuthUser {
  id: string;
  role: Role;
  email: string;
  timezone: string;
  activeLanguage: string | null;
}

interface AccessPayload {
  sub: string;
  role: Role;
}

export function signAccessToken(userId: string, role: Role): string {
  return jwt.sign({ role } satisfies Omit<AccessPayload, 'sub'>, config.jwtSecret, {
    subject: userId,
    expiresIn: config.accessTokenTtlSec,
    algorithm: 'HS256',
    issuer: 'slog',
  });
}

function readBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

/**
 * Verifies the access token and reloads the user, so blocking an account or
 * changing a role takes effect without waiting for the token to expire.
 */
export function authenticate(access: 'user' | 'admin' | 'optional') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = readBearer(req);
    if (!token) {
      if (access === 'optional') return next();
      throw errors.unauthorized();
    }
    let payload: AccessPayload;
    try {
      payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], issuer: 'slog' }) as AccessPayload;
    } catch (err) {
      if (access === 'optional') return next();
      throw err instanceof jwt.TokenExpiredError ? new AppError(401, 'token_expired') : errors.unauthorized();
    }
    const user = await User.findById(payload.sub).select('role email timezone activeLanguage isBlocked').lean();
    if (!user) throw errors.unauthorized();
    if (user.isBlocked) throw errors.forbidden('account_blocked');
    if (access === 'admin' && user.role !== 'admin') throw errors.forbidden();
    res.locals.user = {
      id: String(user._id),
      role: user.role,
      email: user.email,
      timezone: user.timezone,
      activeLanguage: user.activeLanguage ?? null,
    } satisfies AuthUser;
    next();
  };
}

/**
 * Cookie-authenticated endpoints (refresh, logout) require a custom header.
 * Browsers cannot attach custom headers to cross-site requests without a CORS
 * preflight, which our CORS policy only allows for the configured origins.
 */
export function requireCsrfHeader(req: Request, _res: Response, next: NextFunction) {
  if (req.get('x-requested-with') !== 'slog') throw errors.forbidden('csrf_failed');
  next();
}
