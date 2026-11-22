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
export const envSchema = z.object({
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
  };
}
