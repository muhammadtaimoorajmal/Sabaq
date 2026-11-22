import { pino, type DestinationStream, type Logger, type LoggerOptions } from 'pino';
import type { Config } from '../config/env.js';

/** Fields that must never reach the logs, even if a log call includes them by mistake. */
export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.token',
];

type LoggerConfig = Pick<Config, 'env' | 'logLevel' | 'version'>;

/** Structured JSON logs in production; readable, colored logs during development. */
export function loggerOptions(config: LoggerConfig): LoggerOptions {
  return {
    level: config.logLevel,
    base: { service: 'sabaq-api', version: config.version },
    redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
    ...(config.env === 'development' && {
      transport: { target: 'pino-pretty', options: { ignore: 'pid,hostname,service,version' } },
    }),
  };
}

/** Creates the application logger; `destination` replaces standard output (used by tests). */
export function createLogger(config: LoggerConfig, destination?: DestinationStream): Logger {
  return destination ? pino(loggerOptions(config), destination) : pino(loggerOptions(config));
}
