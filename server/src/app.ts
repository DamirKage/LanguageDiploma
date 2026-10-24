import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { AppError, defaultMessage } from './lib/errors';
import { logger } from './lib/logger';
import { adminContentRouter } from './modules/admin/content-routes';
import { adminRouter } from './modules/admin/routes';
import { analyticsRouter } from './modules/analytics/routes';
import { authRouter } from './modules/auth/routes';
import { catalogRouter } from './modules/catalog/routes';
import { learningRouter } from './modules/learning/routes';
import { recommendationsRouter } from './modules/recommendations/routes';
import { reviewsRouter } from './modules/srs/routes';
import { meRouter } from './modules/users/routes';
import { buildOpenApiDocument } from './openapi';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.clientOrigins.includes(origin)),
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }),
  );
  if (!config.isTest) {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/api/health' },
        serializers: {
          req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
          res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
        },
      }),
    );
  }
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 1500,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: () => !config.rateLimitEnabled,
      handler: () => {
        throw new AppError(429, 'rate_limited');
      },
    }),
  );

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down' });
  });

  const openapi = buildOpenApiDocument();
  app.get('/api/openapi.json', (_req, res) => {
    res.json(openapi);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'LinguaPath — документация API' }));

  app.use(
    '/uploads',
    express.static(path.resolve(config.uploadDir), {
      fallthrough: false,
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=604800');
      },
    }),
  );

  app.use(authRouter);
  app.use(meRouter);
  app.use(catalogRouter);
  app.use(learningRouter);
  app.use(reviewsRouter);
  app.use(recommendationsRouter);
  app.use(analyticsRouter);
  app.use(adminContentRouter);
  app.use(adminRouter);

  app.use('/api', (_req, _res, next) => next(new AppError(404, 'not_found')));
  app.use(errorHandler);
  return app;
}

function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  let error: AppError;
  if (err instanceof AppError) error = err;
  else if (err instanceof mongoose.Error.CastError) error = new AppError(400, 'validation_failed');
  else if (err instanceof mongoose.Error.ValidationError) {
    error = new AppError(
      400,
      'validation_failed',
      undefined,
      Object.values(err.errors).map((e) => ({ path: e.path, code: 'invalid', message: e.message })),
    );
  } else if ((err as { type?: string }).type === 'entity.parse.failed') error = new AppError(400, 'validation_failed');
  else if ((err as { status?: number }).status === 404) error = new AppError(404, 'not_found');
  else if ((err as { code?: number }).code === 11000) error = new AppError(409, 'conflict');
  else {
    logger.error({ err, url: req.originalUrl }, 'Unhandled error');
    error = new AppError(500, 'internal');
  }
  res.status(error.status).json({
    error: { code: error.code, message: error.message || defaultMessage(error.code), ...(error.details ? { details: error.details } : {}) },
  });
}
