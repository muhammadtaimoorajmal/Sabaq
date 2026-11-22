import mongoose, { type Connection } from 'mongoose';
import type { Logger } from 'pino';
import type { HealthCheck } from '../routes/health.js';
import { ALL_MODELS } from './models/index.js';

// Filters on fields the schema does not define are dropped instead of reaching the database.
// Query operator injection is prevented at the boundary: every input is validated with Zod
// (`parseInput`) before it is used in a query, so an object can never arrive where a string
// is expected.
mongoose.set('strictQuery', true);

export interface DatabaseOptions {
  uri: string;
  dbName: string;
  logger: Logger;
  /** Total connection attempts before giving up. */
  attempts?: number;
  /** Delay before the first retry; doubles after each failure, up to 30 seconds. */
  retryDelayMs?: number;
  serverSelectionTimeoutMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

const MAX_RETRY_DELAY_MS = 30_000;

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/** Removes credentials and options from a connection string so it can be logged safely. */
export function redactUri(uri: string): string {
  return uri.replace(/\/\/[^@/]*@/, '//').replace(/\?.*$/s, '');
}

let eventsAttached = false;

function attachConnectionEvents(connection: Connection, logger: Logger) {
  if (eventsAttached) return;
  eventsAttached = true;
  connection.on('disconnected', () => logger.warn('Database connection lost'));
  connection.on('reconnected', () => logger.info('Database connection restored'));
}

/**
 * Connects to MongoDB, retrying with exponential back-off so that a database that is still
 * starting (or briefly unreachable) does not crash the API. Creates any missing indexes.
 */
export async function connectDatabase({
  uri,
  dbName,
  logger,
  attempts = 5,
  retryDelayMs = 1000,
  serverSelectionTimeoutMs = 10_000,
  sleep = wait,
}: DatabaseOptions): Promise<Connection> {
  const target = redactUri(uri);
  for (let attempt = 1; ; attempt += 1) {
    try {
      await mongoose.connect(uri, {
        dbName,
        appName: 'sabaq-api',
        serverSelectionTimeoutMS: serverSelectionTimeoutMs,
        maxPoolSize: 10,
        autoIndex: false,
      });
      break;
    } catch (error) {
      if (attempt >= attempts) {
        throw new Error(
          `Could not connect to the database at ${target} after ${attempts} attempts`,
          {
            cause: error,
          },
        );
      }
      const retryInMs = Math.min(retryDelayMs * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
      logger.warn(
        { err: error, attempt, attempts, retryInMs, target },
        'Database connection failed; retrying',
      );
      await sleep(retryInMs);
    }
  }
  attachConnectionEvents(mongoose.connection, logger);
  await ensureIndexes();
  logger.info({ target, dbName }, 'Connected to the database');
  return mongoose.connection;
}

/** Creates every index the models declare. Safe to repeat; never drops existing indexes. */
export async function ensureIndexes(): Promise<void> {
  await Promise.all(ALL_MODELS.map((model) => model.createIndexes()));
}

export async function disconnectDatabase(logger: Logger): Promise<void> {
  await mongoose.disconnect();
  logger.info('Disconnected from the database');
}

/** Reports the database as down unless it is connected and answers a ping. */
export const databaseHealthCheck: HealthCheck = {
  name: 'database',
  check: async () => {
    const { db, readyState } = mongoose.connection;
    if (readyState !== mongoose.ConnectionStates.connected || !db) {
      throw new Error('Not connected');
    }
    await db.admin().ping();
  },
};
