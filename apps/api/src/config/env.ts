import { randomBytes } from 'node:crypto';
import { z } from 'zod';

export const NODE_ENVS = ['development', 'test', 'production'] as const;
export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];
export type LogLevel = (typeof LOG_LEVELS)[number];

/** A browser origin such as `https://app.example.com`: scheme, host and optional port only. */
export function isOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin === value;
  } catch {
    return false;
  }
}

const originListSchema = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean),
  )
  .pipe(
    z.array(
      z.string().refine(isOrigin, {
        error: (issue) =>
          `"${String(issue.input)}" is not an origin; use the form https://app.example.com`,
      }),
    ),
  );

/** Environment variables read by the API. Every variable is documented in `.env.example`. */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(NODE_ENVS).default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
    CORS_ORIGINS: originListSchema,
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).optional(),
    RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100_000).default(300),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(10_000),
    APP_VERSION: z.string().min(1).optional(),
    RENDER_GIT_COMMIT: z.string().min(7).optional(),
    MONGODB_URI: z
      .string()
      .regex(/^mongodb(?:\+srv)?:\/\/\S+$/, 'must start with mongodb:// or mongodb+srv://')
      .optional(),
    APP_URL: z
      .string()
      .refine(isOrigin, 'must be the web app address, such as https://sabaq.example.com')
      .default('http://localhost:5173'),
    JWT_SECRET: z.string().min(32, 'must be at least 32 characters long').optional(),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(20),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASS: z.string().min(1).optional(),
    MAIL_FROM: z.string().min(3).default('Sabaq <no-reply@sabaq.local>'),
    MONGODB_DB_NAME: z
      .string()
      .regex(/^[\w-]{1,38}$/, 'use up to 38 letters, numbers, dashes or underscores')
      .default('sabaq'),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== 'production') return;
    for (const name of ['MONGODB_URI', 'JWT_SECRET', 'SMTP_HOST'] as const) {
      if (!env[name]) {
        context.addIssue({ code: 'custom', path: [name], message: 'is required in production' });
      }
    }
  });

export interface Config {
  env: NodeEnv;
  isProduction: boolean;
  host: string;
  port: number;
  logLevel: LogLevel;
  corsOrigins: string[];
  /** Number of reverse proxies in front of the API; needed for correct client IP addresses. */
  trustProxy: number;
  rateLimit: { windowMs: number; max: number };
  bodyLimit: string;
  shutdownTimeoutMs: number;
  version: string;
  database: {
    /** `null` outside production means: start a temporary in-memory database. */
    uri: string | null;
    name: string;
  };
  /** Public address of the web app, used in links inside e-mails. */
  appUrl: string;
  auth: {
    /** Signs access tokens. Outside production a random secret is generated per start. */
    jwtSecret: string;
    accessTokenTtlSeconds: number;
    refreshTokenTtlDays: number;
    /** Attempts per client address per rate-limit window on sign-in and similar routes. */
    rateLimitMax: number;
  };
  mail: {
    from: string;
    /** `null` outside production means: write e-mails to the log instead of sending them. */
    smtp: { host: string; port: number; user: string | null; pass: string | null } | null;
  };
}

/** Thrown when the environment is invalid; the message lists every problem at once. */
export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid configuration:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

const DEFAULT_LOG_LEVEL: Record<NodeEnv, LogLevel> = {
  development: 'debug',
  test: 'silent',
  production: 'info',
};

/** Reads and validates configuration, failing fast with readable messages. */
export function loadConfig(source: Record<string, string | undefined> = process.env): Config {
  // Treat empty strings like unset variables, as most hosting dashboards do.
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ''),
  );
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    throw new ConfigError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  const env = result.data;
  const isProduction = env.NODE_ENV === 'production';
  return {
    env: env.NODE_ENV,
    isProduction,
    host: env.HOST,
    port: env.PORT,
    logLevel: env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL[env.NODE_ENV],
    corsOrigins: env.CORS_ORIGINS,
    trustProxy: env.TRUST_PROXY ?? (isProduction ? 1 : 0),
    rateLimit: { windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60_000, max: env.RATE_LIMIT_MAX },
    bodyLimit: '100kb',
    shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
    version: env.APP_VERSION ?? env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'dev',
    database: { uri: env.MONGODB_URI ?? null, name: env.MONGODB_DB_NAME },
    appUrl: env.APP_URL,
    auth: {
      jwtSecret: env.JWT_SECRET ?? randomBytes(32).toString('base64url'),
      accessTokenTtlSeconds: 15 * 60,
      refreshTokenTtlDays: 30,
      rateLimitMax: env.AUTH_RATE_LIMIT_MAX,
    },
    mail: {
      from: env.MAIL_FROM,
      smtp: env.SMTP_HOST
        ? {
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            user: env.SMTP_USER ?? null,
            pass: env.SMTP_PASS ?? null,
          }
        : null,
    },
  };
}
