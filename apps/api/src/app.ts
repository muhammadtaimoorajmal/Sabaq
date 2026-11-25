import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { accountRouter, usersRouter } from './account/routes.js';
import { AccountService } from './account/service.js';
import { requireAuth } from './auth/middleware.js';
import { authRouter } from './auth/routes.js';
import { AuthService } from './auth/service.js';
import { classesRouter } from './classes/routes.js';
import { ClassService } from './classes/service.js';
import type { Config } from './config/env.js';
import { AppError } from './lib/errors.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { httpLogger, isHealthRequest } from './middleware/http-logger.js';
import { REQUEST_ID_HEADER } from './middleware/request-id.js';
import type { Mailer } from './mail/mailer.js';
import { devRouter } from './routes/dev.js';
import { healthRouter, type HealthCheck } from './routes/health.js';

export interface AppDependencies {
  config: Config;
  logger: Logger;
  mailer: Mailer;
  /** Dependencies reported by `GET /api/health/ready`, such as the database. */
  healthChecks?: HealthCheck[];
  /** The current time; replaced in tests to check expiry and lock-outs. */
  now?: () => Date;
}

/** API responses can contain personal data, so browsers and proxies must not cache them. */
const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

/** Builds the Express application. Has no side effects, so tests can create as many as needed. */
export function createApp({
  config,
  logger,
  mailer,
  healthChecks = [],
  now = () => new Date(),
}: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(httpLogger(logger));

  // A JSON API never renders HTML, so the strictest content security policy applies.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
    }),
  );
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
      maxAge: 600,
      exposedHeaders: [REQUEST_ID_HEADER, 'Retry-After', 'RateLimit', 'RateLimit-Policy'],
    }),
  );
  app.use(noStore);
  app.use(
    '/api',
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      limit: config.rateLimit.max,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: (req) => isHealthRequest(req.originalUrl),
      handler: (_req, _res, next) => {
        next(
          new AppError('rate_limited', 'Too many requests. Please wait a moment and try again.'),
        );
      },
    }),
  );
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(cookieParser());

  app.get(['/', '/api'], (_req, res) => {
    res.json({ name: 'Sabaq API', version: config.version, health: '/api/health' });
  });
  app.use('/api', healthRouter({ version: config.version, checks: healthChecks }));
  const auth = new AuthService({ config, mailer, logger, now });
  app.use('/api/auth', authRouter({ service: auth, config, now }));
  const authenticated = requireAuth({ service: auth, secret: config.auth.jwtSecret, now });
  app.use('/api/classes', classesRouter({ service: new ClassService(), authenticated }));
  const account = new AccountService({ logger, now });
  app.use('/api/account', accountRouter({ service: account, authenticated, config }));
  app.use('/api/users', usersRouter({ service: account }));
  if (!config.isProduction && mailer.outbox) {
    app.use('/api', devRouter({ outbox: mailer.outbox }));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
