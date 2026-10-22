import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

// Validation messages are returned to the Russian-language interface.
z.config(z.locales.ru());

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/slog'),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  PUBLIC_APP_URL: z.string().default('http://localhost:5173'),
  TRUST_PROXY: bool.default(false),
  COOKIE_SECURE: bool.optional(),
  RATE_LIMIT_ENABLED: bool.default(true),
  EXPOSE_DEV_LINKS: bool.default(false),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('Слог <no-reply@slog.local>'),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(5),
  DICTIONARY_API_URL: z.string().default('https://en.wiktionary.org/api/rest_v1/page/definition'),
  DICTIONARY_ENABLED: bool.default(true),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration', z.treeifyError(parsed.error));
  process.exit(1);
}

const env = parsed.data;

if (env.NODE_ENV === 'production' && !env.JWT_ACCESS_SECRET) {
  console.error('JWT_ACCESS_SECRET must be set in production');
  process.exit(1);
}
if (env.NODE_ENV === 'production' && env.EXPOSE_DEV_LINKS) {
  console.error('EXPOSE_DEV_LINKS must not be enabled in production');
  process.exit(1);
}

export const config = {
  env: env.NODE_ENV,
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  mongoUri: env.MONGODB_URI,
  jwtSecret: env.JWT_ACCESS_SECRET ?? 'development-only-secret-change-me-0123456789',
  accessTokenTtlSec: env.ACCESS_TOKEN_TTL_SEC,
  refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
  bcryptRounds: env.BCRYPT_ROUNDS,
  clientOrigins: env.CLIENT_ORIGIN.split(',').map((s) => s.trim()),
  publicAppUrl: env.PUBLIC_APP_URL.replace(/\/$/, ''),
  trustProxy: env.TRUST_PROXY,
  /** Secure cookies require HTTPS; defaults to on in production. */
  cookieSecure: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
  rateLimitEnabled: env.RATE_LIMIT_ENABLED,
  exposeDevLinks: env.EXPOSE_DEV_LINKS,
  smtpUrl: env.SMTP_URL,
  mailFrom: env.MAIL_FROM,
  uploadDir: env.UPLOAD_DIR,
  maxUploadBytes: Math.round(env.MAX_UPLOAD_MB * 1024 * 1024),
  dictionaryApiUrl: env.DICTIONARY_API_URL,
  dictionaryEnabled: env.DICTIONARY_ENABLED,
  logLevel: env.LOG_LEVEL,
};
